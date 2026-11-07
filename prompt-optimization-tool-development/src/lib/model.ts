import type { ModelConfig, ProviderId } from "@/lib/optimizer";
import { customRequest, customUrls } from "@/lib/custom-endpoint";

export type ProviderAccess = "public" | "free-tier" | "byok";
type Provider = {
  id: ProviderId;
  name: string;
  endpoint: string;
  defaultModel: string;
  envKey: string;
  envModel: string;
  description: string;
  access: ProviderAccess;
  requiresKey: boolean;
  limits: string;
  privacy: string;
  docsUrl: string;
  keyUrl?: string;
};

// Fixed endpoint allowlist. User input can never choose an arbitrary fetch URL.
export const PROVIDERS: Record<ProviderId, Provider> = {
  pollinations: {
    id: "pollinations", name: "Pollinations 公共通道", endpoint: "https://text.pollinations.ai/openai",
    defaultModel: "openai-fast", envKey: "", envModel: "", access: "public", requiresKey: false,
    description: "GPT-OSS 20B · 无需注册或密钥",
    limits: "官方 Classic API：同一 IP 同时仅一个文本请求，间隔至少 30 秒。本站排队间隔为 31 秒；共享额度可能繁忙，无在线率保证。",
    privacy: "公共实验通道。提示词会发送给 Pollinations 及其上游服务；请勿输入密钥、个人身份、客户机密等敏感内容。服务条款与数据处理以官方说明为准。",
    docsUrl: "https://github.com/pollinations/pollinations/blob/master/APIDOCS.md",
  },
  openrouter: {
    id: "openrouter", name: "OpenRouter 免费模型", endpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openrouter/free", envKey: "OPENROUTER_API_KEY", envModel: "OPENROUTER_MODEL", access: "free-tier", requiresKey: true,
    description: "免费账号额度 · 多个 :free 模型",
    limits: "免费模型有每分钟和每日请求上限；当前额度、模型可用性与上游限制以 OpenRouter 账号页为准。这里只允许免费模型，不会自动切到付费版本。",
    privacy: "需要你自己的免费 API Key。不同免费模型的上游数据政策不同，部分可能使用请求训练模型；敏感内容请使用本地模式或审查过的服务商。",
    docsUrl: "https://openrouter.ai/docs/api-reference/limits", keyUrl: "https://openrouter.ai/settings/keys",
  },
  deepseek: {
    id: "deepseek", name: "DeepSeek", endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-flash", envKey: "DEEPSEEK_API_KEY", envModel: "DEEPSEEK_MODEL", access: "byok", requiresKey: true,
    description: "中文理解与深度分析", limits: "使用你的账号与模型额度，可能按服务商规则计费。",
    privacy: "密钥仅用于服务端转发，不写入历史或数据库。提示词会发送给 DeepSeek。",
    docsUrl: "https://api-docs.deepseek.com/", keyUrl: "https://platform.deepseek.com/api_keys",
  },
  openai: {
    id: "openai", name: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4.1-mini", envKey: "OPENAI_API_KEY", envModel: "OPENAI_MODEL", access: "byok", requiresKey: true,
    description: "通用推理与内容创作", limits: "使用你的 OpenAI API 账号额度，可能产生费用；ChatGPT 订阅不等于 API 额度。",
    privacy: "密钥仅用于服务端转发，不写入历史或数据库。提示词会发送给 OpenAI。",
    docsUrl: "https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create", keyUrl: "https://platform.openai.com/api-keys",
  },
  siliconflow: {
    id: "siliconflow", name: "硅基流动", endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash", envKey: "SILICONFLOW_API_KEY", envModel: "SILICONFLOW_MODEL", access: "byok", requiresKey: true,
    description: "丰富的开源模型选择", limits: "使用你的账号额度；是否免费取决于所选模型与账号政策。",
    privacy: "密钥仅用于服务端转发，不写入历史或数据库。提示词会发送给硅基流动。",
    docsUrl: "https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions", keyUrl: "https://cloud.siliconflow.cn/account/ak",
  },
  custom: {
    id: "custom", name: "自定义兼容接口", endpoint: "", defaultModel: "", envKey: "", envModel: "",
    access: "byok", requiresKey: false, description: "填写 URL / Key，探测并切换模型",
    limits: "按所填第三方服务商的额度和计费规则使用；模型探测只读取列表，不保证每个模型都支持对话。",
    privacy: "本站会将请求发送到你填写的公网 HTTPS 服务商；Key 只保留在当前页面内存，不写入数据库。",
    docsUrl: "https://platform.openai.com/docs/api-reference/models/list",
  },
};

type PublicState = { tail: Promise<void>; nextAt: number; waiting: number };
type CatalogState = { at: number; models: { id: string; name: string; context?: number }[] };
const globalState = globalThis as typeof globalThis & { __pfPublic?: PublicState; __pfCatalog?: CatalogState };
const publicState = globalState.__pfPublic ??= { tail: Promise.resolve(), nextAt: 0, waiting: 0 };
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function providerStatus() {
  return Object.values(PROVIDERS).map(provider => ({
    id: provider.id, name: provider.name, description: provider.description,
    defaultModel: process.env[provider.envModel] || provider.defaultModel,
    serverConfigured: provider.id === "custom" ? false : !provider.requiresKey || Boolean(process.env[provider.envKey]),
    access: provider.access, requiresKey: provider.requiresKey, limits: provider.limits,
    privacy: provider.privacy, docsUrl: provider.docsUrl, keyUrl: provider.keyUrl,
  }));
}

export function publicQueueStatus() {
  return { waiting: publicState.waiting, cooldownSeconds: Math.max(0, Math.ceil((publicState.nextAt - Date.now()) / 1000)) };
}

async function schedulePublic<T>(job: () => Promise<T>): Promise<T> {
  if (publicState.waiting >= 2) throw new Error("公共免费通道正在排队，请稍后再试，或切换到本地构建。免费版需要遵守每次至少 30 秒的间隔。");
  publicState.waiting += 1;
  const run = publicState.tail.then(async () => {
    const wait = Math.max(0, publicState.nextAt - Date.now());
    if (wait) await sleep(wait);
    try { return await job(); }
    finally {
      publicState.waiting -= 1;
      publicState.nextAt = Math.max(publicState.nextAt, Date.now() + 31_000);
    }
  });
  publicState.tail = run.then(() => undefined, () => undefined);
  return run;
}

export function getSafeModelConfig(input: unknown): { provider: Provider; model: string; key: string; baseUrl?: string } {
  const value = input && typeof input === "object" ? input as Partial<ModelConfig> : {};
  const provider = PROVIDERS[value.provider as ProviderId];
  if (!provider) throw new Error("请选择受支持的模型服务商");
  const key = provider.id === "custom" ? (typeof value.apiKey === "string" ? value.apiKey.trim() : "") : provider.requiresKey ? ((typeof value.apiKey === "string" ? value.apiKey.trim() : "") || process.env[provider.envKey] || "") : "";
  if (provider.requiresKey && !key) throw new Error(`请先填写 ${provider.name} 的 API Key，或在服务端配置 ${provider.envKey}`);
  if (key.length > 500 || /[\r\n]/.test(key)) throw new Error("API Key 格式不正确");
  const requested = typeof value.model === "string" ? value.model.trim() : "";
  const model = provider.id === "pollinations" ? "openai-fast" : requested || process.env[provider.envModel] || provider.defaultModel;
  if (!/^[\w./:-]{1,140}$/.test(model)) throw new Error("请选择有效的模型 ID");
  if (provider.id === "openrouter" && model !== "openrouter/free" && !model.endsWith(":free")) throw new Error("此通道只允许 :free 免费模型或 openrouter/free，避免意外产生费用");
  const baseUrl = provider.id === "custom" ? customUrls(value.baseUrl).baseUrl : undefined;
  return { provider, model, key, baseUrl };
}

type Message = { role: "system" | "user" | "assistant"; content: string };
async function requestModel(provider: Provider, model: string, key: string, messages: Message[]): Promise<{ text: string; model: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70_000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(provider.endpoint, {
      method: "POST", headers,
      body: JSON.stringify({ model, messages, stream: false, ...(provider.access !== "byok" ? { max_tokens: 3200 } : {}) }),
      signal: controller.signal, cache: "no-store",
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      if (provider.id === "pollinations" && response.status === 402) {
        const retry = Math.min(300, Math.max(31, Number(response.headers.get("retry-after")) || 31));
        publicState.nextAt = Math.max(publicState.nextAt, Date.now() + retry * 1000);
        throw new Error(`公共免费通道的共享额度正忙，请约 ${retry} 秒后重试；也可以立即切换本地构建。`);
      }
      if (response.status === 401 || response.status === 403) throw new Error("模型认证失败，请检查 API Key、账号权限与地区可用性");
      if (response.status === 429) throw new Error("模型额度或请求频率已达上限，请稍后重试或更换通道");
      if (response.status === 402) throw new Error("该账号或模型额度不足，请检查服务商额度；本站不会自动改用付费模型");
      let detail = "";
      try { const parsed = JSON.parse(raw); if (typeof parsed?.error?.message === "string") detail = parsed.error.message.slice(0, 180); } catch { if (raw.length < 200 && !raw.includes("<")) detail = raw; }
      if (key) detail = detail.split(key).join("[redacted]");
      throw new Error(`模型请求失败（${response.status}）${detail ? `：${detail}` : "，请检查模型名称或服务状态"}`);
    }
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("模型输出被长度限制截断，请选择精简篇幅或更换模型后重试");
    const content = choice?.message?.content;
    const text = typeof content === "string" ? content.trim() : Array.isArray(content) ? content.map((part: { text?: string }) => part?.text || "").join("\n").trim() : "";
    if (!text) throw new Error("模型返回了空内容，请更换模型后重试");
    return { text, model: typeof data?.model === "string" ? data.model : model };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("模型响应超时，请稍后重试或更换通道");
    if (error instanceof TypeError) throw new Error("无法连接模型服务，请检查网络；本地构建仍可使用");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function callModel(config: unknown, messages: Message[]): Promise<{ text: string; model: string }> {
  const { provider, model, key, baseUrl } = getSafeModelConfig(config);
  if (provider.id === "custom") {
    const response = await customRequest(baseUrl, "chat", { method: "POST", key, body: JSON.stringify({ model, messages, stream: false }), timeout: 75_000 });
    if (response.status === 401 || response.status === 403) throw new Error("认证失败，请核对 API Key 与服务商权限");
    if (response.status === 429) throw new Error("此服务商达到请求频率或额度上限，请稍后重试");
    if (response.status < 200 || response.status >= 300) {
      let detail = "";
      try { const data = JSON.parse(response.text); detail = String(data?.error?.message || "").slice(0, 180); } catch { /* No JSON error body. */ }
      if (key) detail = detail.split(key).join("[redacted]");
      throw new Error(`第三方接口返回 ${response.status}${detail ? `：${detail}` : "，请检查 URL、Key 与模型 ID"}`);
    }
    let data: { choices?: { message?: { content?: string | { text?: string }[] }; finish_reason?: string }[]; model?: string };
    try { data = JSON.parse(response.text); } catch { throw new Error("第三方接口不是兼容的 JSON 响应"); }
    if (data.choices?.[0]?.finish_reason === "length") throw new Error("模型回复被截断，请调整任务或更换模型");
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : Array.isArray(content) ? content.map(part => part.text || "").join("\n").trim() : "";
    if (!text) throw new Error("第三方接口未返回 choices[0].message.content，请确认兼容 OpenAI Chat Completions");
    return { text, model: data.model || model };
  }
  if (provider.id === "pollinations") return schedulePublic(() => requestModel(provider, model, key, messages));
  return requestModel(provider, model, key, messages);
}

export async function discoverModels(config: unknown) {
  const value = config && typeof config === "object" ? config as Partial<ModelConfig> : {};
  if (value.provider !== "custom") throw new Error("模型探测仅用于自定义兼容接口");
  const key = typeof value.apiKey === "string" ? value.apiKey.trim() : "";
  if (key.length > 500 || /[\r\n]/.test(key)) throw new Error("API Key 格式不正确");
  const response = await customRequest(value.baseUrl, "models", { method: "GET", key, timeout: 20_000 });
  if (response.status === 401 || response.status === 403) throw new Error("探测被拒绝，请检查 Key 或模型列表访问权限");
  if (response.status < 200 || response.status >= 300) throw new Error(`模型列表请求返回 ${response.status}；部分服务商不支持 /models，可以手动输入模型 ID`);
  let data: unknown;
  try { data = JSON.parse(response.text); } catch { throw new Error("模型列表未返回 JSON，可手动输入模型 ID"); }
  const payload = data as { data?: unknown; models?: unknown };
  const raw = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  const models = raw.map((item: unknown) => {
    if (typeof item === "string") return { id: item, name: item };
    if (!item || typeof item !== "object") return null;
    const record = item as { id?: unknown; name?: unknown };
    const id = typeof record.id === "string" ? record.id : typeof record.name === "string" ? record.name : "";
    return id ? { id, name: typeof record.name === "string" ? record.name : id } : null;
  }).filter((item: { id: string; name: string } | null): item is { id: string; name: string } => Boolean(item && /^[\w./:-]{1,140}$/.test(item.id))).slice(0, 300);
  if (!models.length) throw new Error("没有读到模型 ID；可在下方手动输入模型名称");
  return { models, baseUrl: customUrls(value.baseUrl).baseUrl };
}

export async function freeModelCatalog(): Promise<{ models: CatalogState["models"]; warning?: string }> {
  if (globalState.__pfCatalog && Date.now() - globalState.__pfCatalog.at < 10 * 60_000) return { models: globalState.__pfCatalog.models };
  const fallback = [{ id: "openrouter/free", name: "自动路由 · 仅免费模型" }];
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15_000), next: { revalidate: 600 } });
    if (!response.ok) throw new Error("catalog unavailable");
    const data = await response.json();
    const models = (Array.isArray(data?.data) ? data.data : [])
      .filter((item: { id?: string; pricing?: { prompt?: string; completion?: string } }) => typeof item.id === "string" && item.id.endsWith(":free") && Number(item.pricing?.prompt) === 0 && Number(item.pricing?.completion) === 0)
      .slice(0, 50).map((item: { id: string; name?: string; context_length?: number }) => ({ id: item.id, name: item.name || item.id, context: item.context_length }));
    const result = [fallback[0], ...models];
    globalState.__pfCatalog = { at: Date.now(), models: result };
    return { models: result };
  } catch { return { models: fallback, warning: "免费模型目录暂时无法同步，可先使用自动免费路由。" }; }
}
