/**
 * ASTRA AI client — talks directly to an OpenAI-compatible chat endpoint from the browser.
 *
 * Providers:
 *  - pollinations: free anonymous tier (https://text.pollinations.ai/openai, model openai-fast).
 *    Limits: 1 reply / 45 s per IP, and localhost origins are rejected (Turnstile).
 *  - custom: any OpenAI-compatible base URL + optional API key + model id.
 *
 * Reliability features:
 *  - A persistent rate gate for the free tier with live countdown events.
 *  - Automatic retry after `FREE_LIMIT` (402 + Retry-After).
 *  - Fallback through the local proxy (server/ai-proxy.mjs, port 8787) when the browser
 *    request is blocked by CORS or by the localhost Turnstile check.
 */

export type AiProvider = "pollinations" | "custom";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AiStatus =
  | { phase: "idle" }
  | { phase: "waiting"; seconds: number; label: string }
  | { phase: "calling"; label: string; provider: AiProvider };

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const POLLINATIONS_GAP_MS = 46_000;
const GATE_KEY = "astra:pollinations:next-at";

// ---------------------------------------------------------------------------
// Status broadcasting (UI subscribes to show "calling…" / countdowns).
// ---------------------------------------------------------------------------
type Listener = (status: AiStatus) => void;
const listeners = new Set<Listener>();
let currentStatus: AiStatus = { phase: "idle" };

function emit(status: AiStatus) {
  currentStatus = status;
  listeners.forEach(listener => listener(status));
}

export function subscribeAiStatus(listener: Listener) {
  listeners.add(listener);
  listener(currentStatus);
  return () => { listeners.delete(listener); };
}

export function getAiStatus() {
  return currentStatus;
}

// ---------------------------------------------------------------------------
// Free-tier rate gate.
// ---------------------------------------------------------------------------
function readNextAt() {
  try { return Number(localStorage.getItem(GATE_KEY)) || 0; } catch { return 0; }
}

function writeNextAt(value: number) {
  try { localStorage.setItem(GATE_KEY, String(value)); } catch { /* storage optional */ }
}

export function freeCooldownSeconds() {
  return Math.max(0, Math.ceil((readNextAt() - Date.now()) / 1000));
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const timer = window.setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    const onAbort = () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForGate(label: string, signal?: AbortSignal) {
  for (;;) {
    const remaining = readNextAt() - Date.now();
    if (remaining <= 0) return;
    emit({ phase: "waiting", seconds: Math.ceil(remaining / 1000), label });
    await sleep(Math.min(1000, remaining), signal);
  }
}

// ---------------------------------------------------------------------------
// Local proxy fallback.
// ---------------------------------------------------------------------------
let proxyBase: string | null = null;
let proxyCheckedAt = 0;

async function detectProxy(): Promise<string | null> {
  // A successful relay is cached briefly. A failed probe is never cached, so
  // starting ./start.sh after the page loaded does not require a refresh.
  if (proxyBase && Date.now() - proxyCheckedAt < 30_000) return proxyBase;
  const candidates = [
    `${window.location.origin}/__astra`,
    `${window.location.protocol}//${window.location.hostname}:8787`,
    "http://127.0.0.1:8787",
    "http://localhost:8787",
  ];
  for (const base of candidates) {
    try {
      const response = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(1500),
        cache: "no-store",
      });
      if (response.ok) {
        proxyBase = base;
        proxyCheckedAt = Date.now();
        return base;
      }
    } catch { /* try next */ }
  }
  proxyBase = null;
  return null;
}

async function viaProxy(url: string, init: { method: string; headers: Record<string, string>; body?: string }, signal?: AbortSignal) {
  const base = await detectProxy();
  if (!base) return null;
  const response = await fetch(`${base}/forward`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, method: init.method, headers: init.headers, body: init.body }),
    signal,
  });
  if (!response.ok && response.headers.get("X-Astra-Relay-Error") === "1") return null;
  return response;
}

// ---------------------------------------------------------------------------
// Endpoint helpers.
// ---------------------------------------------------------------------------
export function normalizeBaseUrl(raw = "") {
  return raw.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "").replace(/\/models$/i, "");
}

function endpointFor(config: AiConfig) {
  if (config.provider === "pollinations") {
    return { url: POLLINATIONS_URL, headers: { "Content-Type": "application/json" } as Record<string, string> };
  }
  const base = normalizeBaseUrl(config.baseUrl);
  if (!/^https?:\/\//i.test(base)) throw new Error("请先填写以 http(s):// 开头的 API 地址");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  return { url: `${base}/chat/completions`, headers };
}

function describeHttpError(status: number, text: string, provider: AiProvider) {
  let message = "";
  try {
    const data = JSON.parse(text);
    message = data?.error?.message || data?.message || data?.error || "";
    if (typeof message !== "string") message = JSON.stringify(message);
  } catch { message = text.slice(0, 200); }
  if (status === 401 || status === 403) {
    if (/turnstile/i.test(text)) return "免费通道拒绝了本地 localhost 来源的请求，已自动切换本地转发，请重试。";
    return provider === "custom" ? `接口拒绝访问（${status}），请检查 API Key 是否正确。` : `免费通道暂时拒绝请求（${status}）。`;
  }
  if (status === 404) return "接口地址或模型不存在（404），请检查 API 地址与模型 ID。";
  if (status === 429) return "请求过于频繁（429），请稍后再试。";
  if (status >= 500) return `模型服务暂时不可用（${status}），请稍后重试。`;
  return message ? `请求失败（${status}）：${message}` : `请求失败（${status}）`;
}

/** Some OpenAI-compatible relays use reasoning_content, content blocks or text. */
function messageText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as Record<string, unknown>;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const choice = (choices[0] && typeof choices[0] === "object" ? choices[0] : {}) as Record<string, unknown>;
  const message = (choice.message && typeof choice.message === "object" ? choice.message : choice) as Record<string, unknown>;
  const partText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(partText).join("");
    if (!value || typeof value !== "object") return "";
    const part = value as Record<string, unknown>;
    if (typeof part.text === "string") return part.text;
    if (typeof part.content === "string" || Array.isArray(part.content)) return partText(part.content);
    return "";
  };
  // Some reasoning models return content: "" and put the answer or JSON in
  // reasoning_content. Pick the first candidate that actually has text.
  const candidates = [
    message.content, message.reasoning_content, message.reasoning,
    choice.text, root.output_text, root.content, root.response,
  ];
  for (const candidate of candidates) {
    const text = partText(candidate).trim();
    if (text) return text;
  }
  return "";
}

function finishReason(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as Record<string, unknown>;
  const choice = Array.isArray(root.choices) && root.choices[0] && typeof root.choices[0] === "object"
    ? root.choices[0] as Record<string, unknown>
    : {};
  return typeof choice.finish_reason === "string" ? choice.finish_reason : "";
}

/** Accept common model-list response shapes and model-id aliases. */
function modelEntries(data: unknown): { id: string; name: string }[] {
  const arrays: unknown[] = [];
  const visit = (value: unknown, depth: number) => {
    if (Array.isArray(value)) { arrays.push(value); return; }
    if (!value || typeof value !== "object" || depth > 3) return;
    for (const key of ["data", "models", "items", "results", "model_list"] as const) {
      const nested = (value as Record<string, unknown>)[key];
      if (Array.isArray(nested)) arrays.push(nested);
      else if (nested && typeof nested === "object") visit(nested, depth + 1);
    }
  };
  visit(data, 0);
  const output: { id: string; name: string }[] = [];
  for (const array of arrays as unknown[][]) {
    for (const entry of array) {
      if (typeof entry === "string" && entry.trim()) output.push({ id: entry.trim(), name: entry.trim() });
      else if (entry && typeof entry === "object") {
        const item = entry as Record<string, unknown>;
        const id = [item.id, item.model, item.model_id, item.modelId, item.name]
          .find(value => typeof value === "string" && value.trim()) as string | undefined;
        if (id) output.push({ id: id.trim(), name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : id.trim() });
      }
    }
  }
  const seen = new Set<string>();
  return output.filter(item => !seen.has(item.id) && seen.add(item.id));
}

// ---------------------------------------------------------------------------
// Chat completion.
// ---------------------------------------------------------------------------
export interface ChatOptions {
  label?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  signal?: AbortSignal;
}

export async function chat(config: AiConfig, messages: ChatMessage[], options: ChatOptions = {}) {
  const label = options.label || "AI 处理中";
  const { url, headers } = endpointFor(config);
  const model = config.model?.trim() || (config.provider === "pollinations" ? "openai-fast" : "");
  if (!model) throw new Error("请先选择或填写模型 ID");

  const payload: Record<string, unknown> = { model, messages, temperature: options.temperature ?? 0.4 };
  if (options.maxTokens) payload.max_tokens = options.maxTokens;
  if (config.provider === "pollinations") {
    payload.seed = Math.floor(Math.random() * 1e9); // avoid cached replies
    // GPT-OSS counts hidden reasoning toward the output budget. Keep it low for this
    // structured transformation task and leave enough room for both reasoning and JSON.
    payload.reasoning_effort = options.reasoningEffort || "low";
    payload.max_tokens = options.maxTokens || 8000;
  }
  const body = JSON.stringify(payload);

  const attempt = async (retryLeft: number): Promise<{ text: string; model: string }> => {
    if (config.provider === "pollinations") await waitForGate(label, options.signal);
    emit({ phase: "calling", label, provider: config.provider });

    let response: Response | null = null;
    let networkError: unknown = null;
    let rawText = "";
    let relayAttempted = false;

    // Custom APIs with a bearer key often reject the browser's OPTIONS preflight.
    // If a same-origin relay is available, use it before attempting a direct call.
    if (config.provider === "custom" && config.apiKey?.trim() && await detectProxy()) {
      relayAttempted = true;
      response = await viaProxy(url, { method: "POST", headers, body }, options.signal).catch(() => null);
      if (response) rawText = await response.clone().text();
    }
    if (!response) {
      try {
        response = await fetch(url, { method: "POST", headers, body, signal: options.signal });
        rawText = await response.clone().text();
      } catch (error) {
        if ((error as Error)?.name === "AbortError") throw error;
        networkError = error;
      }
    }

    // CORS / network failure or localhost Turnstile → try any remaining relay.
    const turnstile = response && (response.status === 403 || response.status === 401) && /turnstile/i.test(rawText);
    if (!response || turnstile) {
      const proxied = await viaProxy(url, { method: "POST", headers, body }, options.signal).catch(() => null);
      if (proxied) { response = proxied; rawText = await proxied.clone().text(); }
      else if (!response) {
        if (config.provider === "pollinations") writeNextAt(Date.now() + 3000);
        throw new Error(config.provider === "custom"
          ? `无法连接到该接口：服务商的 CORS 预检或网络请求失败，且转发服务不可用${relayAttempted ? "（同源转发已尝试）" : ""}；请通过 ./start.sh dev / preview 启动，或检查 API 地址。`
          : `无法连接免费通道：${(networkError as Error)?.message || "网络错误"}`);
      }
    }

    if (config.provider === "pollinations") writeNextAt(Date.now() + POLLINATIONS_GAP_MS);

    if (!response.ok) {
      if (config.provider === "pollinations" && (response.status === 402 || response.status === 429) && retryLeft > 0) {
        const retryAfter = Number(response.headers.get("retry-after")) || 45;
        writeNextAt(Date.now() + (retryAfter + 1) * 1000);
        return attempt(retryLeft - 1);
      }
      emit({ phase: "idle" });
      throw new Error(describeHttpError(response.status, rawText, config.provider));
    }

    let data: unknown;
    try { data = JSON.parse(rawText); }
    catch {
      emit({ phase: "idle" });
      throw new Error(`模型返回了无法解析的内容（HTTP ${response.status}）：${rawText.slice(0, 120)}`);
    }
    const text = messageText(data);
    const modelName = data && typeof data === "object" && typeof (data as Record<string, unknown>).model === "string"
      ? (data as Record<string, string>).model
      : model;
    emit({ phase: "idle" });
    if (!text) {
      const reason = finishReason(data);
      throw new Error(reason === "length"
        ? "模型输出被 max_tokens 截断，请提高额度或选择更轻量的模型"
        : "模型没有返回内容，请检查模型 ID、额度或服务商返回格式");
    }
    return { text, model: modelName };
  };

  try {
    return await attempt(1);
  } catch (error) {
    emit({ phase: "idle" });
    throw error;
  }
}

/** Lists models from a custom OpenAI-compatible endpoint (GET {base}/models). */
export async function listModels(config: AiConfig): Promise<{ id: string; name: string }[]> {
  const base = normalizeBaseUrl(config.baseUrl);
  if (!/^https?:\/\//i.test(base)) throw new Error("请先填写以 http(s):// 开头的 API 地址");
  const headers: Record<string, string> = {};
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  let response: Response | null = null;
  let relayFailure = "";
  // When an Authorization header is present, the browser sends an OPTIONS
  // preflight. Many model APIs reject it. Prefer the same-origin relay when
  // available, then fall back to a direct CORS request and the standalone proxy.
  const relay = await detectProxy();
  if (relay) {
    try {
      response = await viaProxy(`${base}/models`, { method: "GET", headers });
      if (response && !response.ok && response.headers.get("X-Astra-Relay-Error") === "1") {
        relayFailure = `转发服务返回 ${response.status}`;
        response = null;
      }
    } catch (error) {
      relayFailure = error instanceof Error ? error.message : "转发服务不可用";
    }
  }
  if (!response) {
    try {
      response = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(15000) });
    } catch {
      // Try the remaining relay candidates below.
    }
  }
  if (!response && !relay) {
    response = await viaProxy(`${base}/models`, { method: "GET", headers }).catch(() => null);
  }
  if (!response) {
    throw new Error("浏览器直连被服务商的 CORS 预检拒绝，转发服务也不可用；请通过 ./start.sh dev 或 ./start.sh preview 启动，或手动填写模型 ID。"
      + (relayFailure ? `（${relayFailure}）` : ""));
  }
  const text = await response.text();
  if (!response.ok) throw new Error(describeHttpError(response.status, text, "custom"));
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(`模型列表不是有效的 JSON（HTTP ${response.status}）：${text.slice(0, 120)}`); }
  const models = modelEntries(data);
  if (!models.length) throw new Error("接口没有返回可识别的模型 ID，可手动填写模型 ID。");
  return models.slice(0, 300);
}
