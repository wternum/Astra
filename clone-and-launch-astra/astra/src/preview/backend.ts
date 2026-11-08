/**
 * Browser preview adapter.
 *
 * The pulled ASTRA repository is a Next.js application whose `/api/*` route
 * handlers run on the server. This Vite preview serves the same React UI and
 * maps those routes onto the repository's own browser-safe optimizer engine,
 * with browser storage standing in for PostgreSQL. The pulled source files are
 * kept untouched; this file only provides the preview runtime.
 */
import {
  analyzeBrief,
  analyzePrompt,
  normalizeOptions,
  BUILTIN_TEMPLATES,
  type OptimizeResult,
} from "@/lib/optimizer";
import { buildSemanticResult, LAYERS, type LayerId } from "@/lib/semantic";
import { chat, listModels, type AiConfig } from "@/ai/client";
import { analyzeNeed, localAnalysis, optimizeWithAi, runComparison, type NeedAnalysis } from "@/ai/engine";
import { isEnglishRequest } from "@/ai/frontend";
import { formatKnowledgeBlock, normalizeKnowledgeEntries, selectRelevantKnowledge } from "@/lib/knowledge";
import { SEED_KNOWLEDGE } from "@/lib/knowledge-seed";
import { validateRelations } from "@/lib/knowledge-graph";
import { normalizeLibrary } from "@/lib/knowledge-library";

type Json = Record<string, unknown>;

const HISTORY_KEY = "astra:preview:history:v1";
const FAVORITES_KEY = "astra:preview:favorites:v1";
const TEMPLATES_KEY = "astra:preview:templates:v1";
const KNOWLEDGE_KEY = TEMPLATES_KEY;

const PROVIDERS = [
  {
    id: "pollinations",
    name: "免费 AI · Pollinations",
    description: "GPT-OSS 20B · 无需注册或密钥",
    defaultModel: "openai-fast",
    serverConfigured: true,
    access: "public",
    requiresKey: false,
    limits: "官方免费通道：同一 IP 每 45 秒仅能获得 1 次回复。ASTRA 会自动排队并显示倒计时；免费模式下需求判定与提示词构建在同一次请求中完成。",
    privacy: "公共实验通道。提示词会发送给 Pollinations 及其上游服务；请勿输入密钥、个人身份、客户机密等敏感内容。",
    docsUrl: "https://github.com/pollinations/pollinations/blob/master/APIDOCS.md",
  },
  {
    id: "custom",
    name: "自定义接口",
    description: "任意 OpenAI 兼容地址 / Key / 模型",
    defaultModel: "",
    serverConfigured: false,
    access: "byok",
    requiresKey: false,
    limits: "额度与计费由你填写的服务商决定。自定义接口没有排队限制，需求判定会在输入时实时进行，再基于判定构建提示词。",
    privacy: "浏览器直接请求你填写的地址；Key 只保存在当前标签页会话中，关闭页面即清除，不写入历史记录。",
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
  },
];

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browser storage can be unavailable; preview stays functional. */
  }
}

function nextId(items: { id: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit): Promise<Json> {
  try {
    if (init?.body && typeof init.body === "string") return JSON.parse(init.body) as Json;
    if (input instanceof Request) return (await input.clone().json()) as Json;
  } catch {
    /* Ignore malformed payloads. */
  }
  return {};
}

type AiBody = { provider?: string; model?: string; apiKey?: string; baseUrl?: string };

function toAiConfig(raw: unknown): AiConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as AiBody;
  if (value.provider === "pollinations") return { provider: "pollinations", model: value.model || "openai-fast" };
  if (value.provider === "custom") return { provider: "custom", model: value.model || "", apiKey: value.apiKey, baseUrl: value.baseUrl };
  return null;
}

function pickLayer(raw: unknown): LayerId | null {
  return typeof raw === "string" && LAYERS.some(l => l.id === raw) ? raw as LayerId : null;
}

function ensureSeedKnowledge() {
  // Only populate on the very first visit. An existing (even empty) store means
  // the user has taken ownership and should not see the samples reappear.
  try {
    if (window.localStorage.getItem(KNOWLEDGE_KEY) !== null) return;
    window.localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(SEED_KNOWLEDGE));
  } catch { /* Storage optional; graph still uses a temporary in-memory seed. */ }
}

function readKnowledge(): Json[] {
  ensureSeedKnowledge();
  // An existing empty array means the user intentionally cleared the library;
  // never resurrect the sample entries in that case.
  return normalizeKnowledgeEntries(readStore<Json[]>(KNOWLEDGE_KEY, [])) as unknown as Json[];
}

function persistKnowledge(entries: Json[]) {
  try { window.localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(entries)); }
  catch { throw new Error("浏览器存储不可用或空间不足，未保存。请先导出备份。"); }
}

function knowledgeSource(body: Json): string {
  if (typeof body.sourceUrl !== "string" || !body.sourceUrl.trim()) return "";
  try { const url = new URL(body.sourceUrl.trim()); return ["http:", "https:"].includes(url.protocol) ? url.href.slice(0, 2048) : ""; }
  catch { return ""; }
}

function readTags(body: Json): string[] {
  const raw = body.tags;
  const tags = Array.isArray(raw)
    ? raw.filter((tag): tag is string => typeof tag === "string").map(tag => tag.trim())
    : typeof raw === "string" ? raw.split(/[,，\s]+/).map(tag => tag.trim()) : [];
  return tags.filter(Boolean).slice(0, 6);
}

function knowledgeCatalog() {
  return [...BUILTIN_TEMPLATES, ...readKnowledge()];
}

function createKnowledgeEntry(body: Json) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const content = typeof body.templateText === "string" ? body.templateText.trim()
    : typeof body.content === "string" ? body.content.trim() : "";
  if (!name || name.length > 60 || !content || content.length > 10000) return null;
  if (typeof body.sourceUrl === "string" && body.sourceUrl.trim() && !knowledgeSource(body)) throw new Error("来源链接必须是有效的 http 或 https 地址");
  const custom = readKnowledge();
  const catalog = knowledgeCatalog() as unknown as { id: number }[];
  const id = nextId(catalog);
  const row = {
    id, name,
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim().slice(0, 30) : "通用",
    description: typeof body.description === "string" ? body.description.trim().slice(0, 240) : "",
    templateText: content, tags: readTags(body), scenario: "general", isBuiltin: false,
    enabled: body.enabled !== false,
    accent: typeof body.accent === "string" && body.accent.trim() ? body.accent.trim().slice(0, 16) : "violet",
    source: "user", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    sourceUrl: knowledgeSource(body),
    relations: validateRelations(body.relations, id, normalizeKnowledgeEntries(custom)),
    library: normalizeLibrary(body.library),
  };
  persistKnowledge([row, ...custom]);
  return row;
}

function updateKnowledgeEntry(body: Json) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return null;
  const custom = readKnowledge();
  const index = custom.findIndex(item => Number(item.id) === id);
  if (index === -1) return null;
  if (typeof body.sourceUrl === "string" && body.sourceUrl.trim() && !knowledgeSource(body)) throw new Error("来源链接必须是有效的 http 或 https 地址");
  const next = { ...custom[index] };
  for (const key of ["name", "category", "description", "templateText", "accent"] as const) {
    if (typeof body[key] === "string") next[key] = body[key].trim();
  }
  if (typeof body.content === "string") next.templateText = body.content.trim();
  if (typeof body.enabled === "boolean") next.enabled = body.enabled;
  if (body.tags !== undefined) next.tags = readTags(body);
  if (body.relations !== undefined) next.relations = validateRelations(body.relations, id, normalizeKnowledgeEntries(custom));
  if (body.sourceUrl !== undefined) next.sourceUrl = knowledgeSource(body);
  if (body.library !== undefined) next.library = normalizeLibrary(body.library);
  if (!String(next.name || "").trim() || String(next.name).length > 60 || !String(next.templateText || "").trim() || String(next.templateText).length > 10000) return null;
  next.updatedAt = new Date().toISOString();
  custom[index] = next;
  persistKnowledge(custom);
  return next;
}

function saveHistory(prompt: string, result: OptimizeResult, extra: Json) {
  const history = readStore<Json[]>(HISTORY_KEY, []);
  const record = {
    id: nextId(history as unknown as { id: number }[]),
    originalPrompt: prompt,
    optimizedPrompt: result.optimized,
    scenario: extra.scenario,
    settings: { engine: result.engine, model: result.model || null, ...extra },
    scoreBefore: result.before.score,
    scoreAfter: result.after.score,
    analysis: { before: result.before, after: result.after, changes: result.changes, rationale: result.rationale },
    createdAt: new Date().toISOString(),
  };
  writeStore(HISTORY_KEY, [record, ...history].slice(0, 200));
  return record.id;
}

async function handleOptimize(body: Json, signal?: AbortSignal) {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "请先输入想要优化的提示词" }, 400);
  if (prompt.length > 12000) return json({ error: "提示词不能超过 12000 字" }, 400);

  const options = normalizeOptions(body.options);
  const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 600) : "";
  const previous = typeof body.previousPrompt === "string" ? body.previousPrompt : "";
  const forced = pickLayer(body.layerId);
  const config = body.mode === "ai" ? toAiConfig(body.modelConfig) : null;
  ensureSeedKnowledge();
  const knowledge = body.useKnowledge === false ? [] : selectRelevantKnowledge(prompt, readKnowledge());

  if (body.mode === "ai" && !config) return json({ error: "请先连接免费 AI 或自定义接口" }, 400);

  if (config) {
    const output = await optimizeWithAi(prompt, config, {
      analysis: (body.analysis && typeof body.analysis === "object" ? body.analysis : null) as NeedAnalysis | null,
      forced, feedback, previous, knowledge, signal,
    });
    const result: OptimizeResult = {
      optimized: output.optimized,
      before: analyzeBrief(prompt, options),
      after: analyzePrompt(output.optimized),
      changes: output.changes.length ? output.changes : ["由 AI 根据需求判定重新构建了提示词"],
      rationale: output.rationale || output.analysis.strategy,
      engine: "ai",
      model: output.model,
      createdAt: new Date().toISOString(),
    };
    const historyId = saveHistory(prompt, result, {
      scenario: output.analysis.category, options, feedback: feedback || null,
      domain: output.analysis.domain, summary: output.analysis.summary,
      parentHistoryId: typeof body.parentHistoryId === "number" ? body.parentHistoryId : null,
    });
    return json({ ...result, historyId, analysis: output.analysis, cases: output.cases, quality: output.quality, repairAttempts: output.repairAttempts, knowledgeUsed: output.knowledgeUsed });
  }

  // Offline fallback: deterministic natural-language builder (no network).
  const { result, understanding } = buildSemanticResult(prompt, options, feedback, forced, "local");
  if (knowledge.length) result.optimized = `${result.optimized.trim()}\n\n${formatKnowledgeBlock(knowledge, isEnglishRequest(prompt))}`;
  const historyId = saveHistory(prompt, result, {
    scenario: understanding.layer.id, options, feedback: feedback || null, summary: understanding.summary,
  });
  return json({ ...result, historyId, analysis: localAnalysis(prompt, forced), cases: [], quality: null, repairAttempts: 0, knowledgeUsed: knowledge });
}

async function route(pathname: string, method: string, search: URLSearchParams, body: Json, signal?: AbortSignal): Promise<Response> {
  if (pathname === "/api/health") return json({ ok: true });

  if (pathname === "/api/model") {
    if (method === "GET") {
      return json({ providers: PROVIDERS, publicQueue: { waiting: 0, cooldownSeconds: 0 } });
    }
    if (method === "POST") {
      const config = toAiConfig(body.modelConfig);
      if (!config) return json({ error: "不支持的模型通道" }, 400);
      if (body.action === "discover") {
        try {
          return json({ models: await listModels(config), baseUrl: config.baseUrl });
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "探测失败" }, 400);
        }
      }
      try {
        const reply = await chat(config, [
          { role: "system", content: "这是一条连接测试。请只回复两个字：可用。" },
          { role: "user", content: "测试连接" },
        ], { label: "正在验证模型连接", temperature: 0, maxTokens: 1200, signal });
        return json({ connected: true, model: reply.model, reply: reply.text.slice(0, 40) });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "连接测试失败" }, 400);
      }
    }
  }

  if (pathname === "/api/understand" && method === "POST") {
    const text = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 12000) : "";
    if (!text) return json({ error: "请先输入一句话" }, 400);
    const forced = pickLayer(body.layerId);
    const config = toAiConfig(body.modelConfig);
    if (!config) return json(localAnalysis(text, forced));
    try {
      return json(await analyzeNeed(text, config, { forced, signal }));
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      return json({ error: error instanceof Error ? error.message : "需求判定失败" }, 502);
    }
  }

  if (pathname === "/api/optimize" && method === "POST") {
    try {
      return await handleOptimize(body, signal);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      return json({ error: error instanceof Error ? error.message : "AI 优化失败" }, 502);
    }
  }

  if (pathname === "/api/history") {
    if (method === "GET") return json(readStore<Json[]>(HISTORY_KEY, []));
    if (method === "PATCH") {
      const id = Number(body.id);
      const optimized = typeof body.optimized === "string" ? body.optimized.trim() : "";
      if (!Number.isInteger(id) || !optimized) return json({ error: "请提供有效的记录和提示词" }, 400);
      const history = readStore<Json[]>(HISTORY_KEY, []);
      const match = history.find(item => item.id === id);
      if (!match) return json({ error: "记录不存在" }, 404);
      const after = analyzePrompt(optimized);
      match.optimizedPrompt = optimized;
      match.scoreAfter = after.score;
      const analysis = (match.analysis && typeof match.analysis === "object" ? match.analysis : {}) as Json;
      match.analysis = { ...analysis, after, rationale: "用户已在工作台中手动修订此版本。" };
      writeStore(HISTORY_KEY, history);
      return json(match);
    }
    if (method === "DELETE") {
      if (search.get("all") === "1") writeStore(HISTORY_KEY, []);
      else {
        const id = Number(search.get("id"));
        writeStore(HISTORY_KEY, readStore<Json[]>(HISTORY_KEY, []).filter(item => item.id !== id));
      }
      return json({ success: true });
    }
  }

  if (pathname === "/api/favorites") {
    if (method === "GET") return json(readStore<Json[]>(FAVORITES_KEY, []));
    if (method === "POST") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) return json({ error: "提示词不能为空" }, 400);
      const favorites = readStore<Json[]>(FAVORITES_KEY, []);
      const row = {
        id: nextId(favorites as unknown as { id: number }[]),
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "未命名提示词",
        prompt,
        category: typeof body.category === "string" ? body.category : "通用",
        note: typeof body.note === "string" ? body.note : "",
        createdAt: new Date().toISOString(),
      };
      writeStore(FAVORITES_KEY, [row, ...favorites]);
      return json(row);
    }
    if (method === "DELETE") {
      const id = Number(search.get("id"));
      writeStore(FAVORITES_KEY, readStore<Json[]>(FAVORITES_KEY, []).filter(item => item.id !== id));
      return json({ success: true });
    }
  }

  if (pathname === "/api/knowledge") {
    ensureSeedKnowledge();
    const entries = knowledgeCatalog();
    if (method === "GET") {
      const custom = readKnowledge();
      return json({ entries, customCount: custom.length, enabledCount: custom.filter(item => item.enabled !== false).length });
    }
    if (method === "POST") {
      const row = createKnowledgeEntry(body);
      if (!row) return json({ error: "请填写知识条目标题与内容（不超过 10000 字）" }, 400);
      return json(row);
    }
    if (method === "PATCH") {
      const row = updateKnowledgeEntry(body);
      if (!row) return json({ error: "知识条目不存在或内容不完整" }, 400);
      return json(row);
    }
    if (method === "DELETE") {
      const id = Number(search.get("id"));
      if (!Number.isInteger(id) || id < 1) return json({ error: "内置示例不可删除" }, 400);
      const remaining = readKnowledge().filter(item => Number(item.id) !== id).map(item => ({ ...item, relations: Array.isArray(item.relations) ? item.relations.filter(relation => Number(relation?.targetId) !== id) : [] }));
      persistKnowledge(remaining);
      return json({ success: true });
    }
  }

  if (pathname === "/api/templates") {
    ensureSeedKnowledge();
    if (method === "GET") return json(knowledgeCatalog());
    if (method === "POST") {
      const row = createKnowledgeEntry(body);
      if (!row) return json({ error: "请填写名称和内容" }, 400);
      return json(row);
    }
    if (method === "PATCH") {
      const row = updateKnowledgeEntry(body);
      if (!row) return json({ error: "知识条目不存在或内容不完整" }, 400);
      return json(row);
    }
    if (method === "DELETE") {
      const id = Number(search.get("id"));
      if (!Number.isInteger(id) || id < 1) return json({ error: "内置示例不可删除" }, 400);
      persistKnowledge(readKnowledge().filter(item => Number(item.id) !== id).map(item => ({ ...item, relations: Array.isArray(item.relations) ? item.relations.filter(relation => Number(relation?.targetId) !== id) : [] })));
      return json({ success: true });
    }
  }

  if (pathname === "/api/try" && method === "POST") {
    const original = typeof body.original === "string" ? body.original : "";
    const optimized = typeof body.optimized === "string" ? body.optimized : "";
    if (!optimized || !original) return json({ error: "请先生成优化后的提示词" }, 400);
    const config = toAiConfig(body.modelConfig);
    if (!config) return json({ error: "请先连接模型" }, 400);
    try {
      return json(await runComparison(original, optimized, config, signal));
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      return json({ error: error instanceof Error ? error.message : "试跑失败" }, 502);
    }
  }

  return json({ error: "接口不存在" }, 404);
}

let installed = false;

export function installPreviewBackend() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let url: URL;
    try {
      url = new URL(rawUrl, window.location.origin);
    } catch {
      return originalFetch(input, init);
    }

    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    const method = (
      init?.method ||
      (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET")
    ).toUpperCase();
    const body = await requestBody(input, init);

    try {
      return await route(url.pathname, method, url.searchParams, body, init?.signal || (input instanceof Request ? input.signal : undefined));
    } catch (error) {
      // Let cancellations reject like a real aborted fetch so the UI can react.
      if ((error as Error)?.name === "AbortError") throw error;
      return json({ error: error instanceof Error ? error.message : "预览接口暂时不可用" }, 500);
    }
  };
}
