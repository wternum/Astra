import { LIBRARY_IDS } from "./knowledge-library";
import type { PromptTarget } from "@/ai/targets";

/**
 * Knowledge base entries and relevance-based retrieval.
 *
 * A knowledge entry is user-authored reference material (brand voice, product
 * facts, writing rules, project conventions). Built-in example prompts are
 * shown in the library but are never injected as facts. Only enabled,
 * user-created entries relevant to the current sentence are used.
 */
export interface KnowledgeEntry {
  id: number;
  name: string;
  category: string;
  description: string;
  templateText: string;
  tags?: string[];
  enabled?: boolean;
  isBuiltin?: boolean;
  accent?: string;
  scenario?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  sourceUrl?: string;
  relations?: import("./knowledge-graph").KnowledgeRelation[];
  library?: string;
}

export interface KnowledgeSnippet {
  id: number;
  title: string;
  category: string;
  description: string;
  tags: string[];
  content: string;
  score: number;
}

export function normalizeKnowledgeEntries(raw: unknown[]): KnowledgeEntry[] {
  return raw
    .filter(item => item && typeof item === "object")
    .map(item => {
      const entry = item as Record<string, unknown>;
      return {
        id: Number(entry.id) || 0,
        name: typeof entry.name === "string" ? entry.name.trim() : "",
        category: typeof entry.category === "string" ? entry.category.trim() : "通用",
        description: typeof entry.description === "string" ? entry.description.trim() : "",
        templateText: typeof entry.templateText === "string" ? entry.templateText.trim() : "",
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter((tag): tag is string => typeof tag === "string").map(tag => tag.trim()).filter(Boolean).slice(0, 6)
          : typeof entry.tags === "string"
            ? (entry.tags as string).split(/[,，\s]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 6)
            : [],
        enabled: entry.enabled !== false,
        isBuiltin: Boolean(entry.isBuiltin),
        accent: typeof entry.accent === "string" ? entry.accent : "violet",
        scenario: typeof entry.scenario === "string" ? entry.scenario : "general",
        source: typeof entry.source === "string" ? entry.source : "user",
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
        sourceUrl: typeof entry.sourceUrl === "string" && /^https?:\/\//i.test(entry.sourceUrl) ? entry.sourceUrl.slice(0, 2048) : "",
        relations: Array.isArray(entry.relations) ? entry.relations.filter((relation): relation is { targetId: number; kind: "references" | "depends_on" } => Boolean(relation && typeof relation === "object" && Number.isInteger(relation.targetId) && relation.targetId > 0 && relation.targetId !== Number(entry.id) && (relation.kind === "references" || relation.kind === "depends_on"))).slice(0, 12) : [],
        library: typeof entry.library === "string" && LIBRARY_IDS.includes(entry.library) ? entry.library : "",
      };
    })
    .filter(entry => entry.id > 0 || entry.name);
}

/**
 * High-frequency Chinese bigrams and English function words. Without this list
 * 「做一个…」 matched every entry containing 「一个」, so starter notes were
 * injected into nearly every request.
 */
const STOP_TOKENS = new Set([
  "一个", "一下", "一些", "一种", "一份", "一篇", "一款", "做一", "做个", "写一", "写个", "这个", "那个", "这些", "那些",
  "帮我", "给我", "我想", "我要", "想要", "需要", "可以", "能够", "什么", "怎么", "如何", "我们", "你们", "他们",
  "进行", "以及", "或者", "还是", "就是", "不是", "没有", "已经", "因为", "所以", "但是", "如果", "然后", "自己",
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "are", "can", "use", "make",
  "build", "create", "want", "need", "please", "help", "an", "of", "to", "in", "on", "is", "it", "my", "me",
]);

function tokens(value: string) {
  const normalized = value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, " ");
  const output: string[] = [];
  for (const word of normalized.split(" ").filter(Boolean)) {
    if (/^[a-z0-9]+$/.test(word)) {
      if (word.length >= 2 && !STOP_TOKENS.has(word)) output.push(word);
    } else {
      for (let i = 0; i < word.length - 1; i++) {
        const gram = word.slice(i, i + 2);
        if (!STOP_TOKENS.has(gram)) output.push(gram);
      }
    }
  }
  return output;
}

function scoreField(query: Set<string>, value: string, weight: number, matched: Set<string>) {
  let score = 0;
  const seen = new Set<string>();
  for (const token of tokens(value)) {
    if (query.has(token) && !seen.has(token)) { score += weight; seen.add(token); matched.add(token); }
  }
  return score;
}

const MAX_ENTRY_CHARS = 850;
const MAX_TOTAL_CHARS = 2400;
const MIN_SCORE = 2;

export interface KnowledgeSelectOptions {
  maxItems?: number;
  /** Arena prompts skip starter notes: they teach prompt writing and are not facts about the app. */
  target?: PromptTarget;
}

/** True when an entry may be injected into prompts built for this target. */
export function isInjectableKnowledge(entry: Pick<KnowledgeEntry, "isBuiltin" | "enabled" | "source">, target: PromptTarget = "general") {
  return !entry.isBuiltin && entry.enabled !== false && !(target === "arena" && entry.source === "seed");
}

/** Selects a few relevant, enabled, user-authored entries for prompt construction. */
export function selectRelevantKnowledge(
  text: string,
  raw: unknown[],
  options: KnowledgeSelectOptions = {},
): KnowledgeSnippet[] {
  const maxItems = options.maxItems ?? 3;
  const entries = normalizeKnowledgeEntries(raw).filter(entry => isInjectableKnowledge(entry, options.target) && entry.templateText);
  const query = new Set(tokens(text));
  if (!entries.length || !query.size) return [];
  const lower = text.toLowerCase();
  const scored = entries.map(entry => {
    const matched = new Set<string>();
    let score = scoreField(query, entry.name, 4, matched)
      + scoreField(query, entry.description, 2, matched)
      + scoreField(query, entry.category, 1.5, matched)
      + scoreField(query, entry.templateText, 0.7, matched)
      + scoreField(query, (entry.tags || []).join(" "), 2.4, matched);
    if (entry.category === "通用") score += 0.8;
    const plainName = entry.name.toLowerCase();
    const titleNamed = plainName.length >= 2 && lower.includes(plainName);
    if (titleNamed) score += 10;
    const tagNamed = (entry.tags || []).some(tag => tag.length >= 2 && lower.includes(tag.toLowerCase()));
    // One shared word is not relevance: require two distinct matches unless the
    // request names the entry's title or one of its tags.
    const relevant = score >= MIN_SCORE && (titleNamed || tagNamed || matched.size >= 2);
    return { entry, score, relevant };
  }).filter(item => item.relevant)
    .sort((a, b) => b.score - a.score || (b.entry.createdAt || "").localeCompare(a.entry.createdAt || ""));

  const output: KnowledgeSnippet[] = [];
  let total = 0;
  for (const { entry, score } of scored) {
    if (output.length >= maxItems || total >= MAX_TOTAL_CHARS) break;
    const content = entry.templateText.slice(0, Math.min(MAX_ENTRY_CHARS, MAX_TOTAL_CHARS - total));
    if (!content) continue;
    total += content.length;
    output.push({
      id: entry.id,
      title: entry.name,
      category: entry.category,
      description: entry.description.slice(0, 180),
      tags: entry.tags || [],
      content,
      score: Math.round(score * 10) / 10,
    });
  }
  return output;
}

/** Compact serialisation for the prompt compiler (keeps content separate from rules). */
export function knowledgeForCompiler(snippets: KnowledgeSnippet[]) {
  return snippets.map(item => ({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description,
    tags: item.tags,
    excerpt: item.content,
    relevance: item.score,
  }));
}

/** Deterministic reference block used when the generated prompt drops the knowledge. */
export function formatKnowledgeBlock(snippets: KnowledgeSnippet[], english = false) {
  if (!snippets.length) return "";
  const heading = english ? "Knowledge base reference" : "知识库参考";
  const note = english
    ? "The following entries are user-supplied reference material. Apply only the relevant parts and do not treat unrelated entries as facts."
    : "以下条目由用户在知识库中提供。只采用与当前任务相关的部分，不要把无关条目写成事实。";
  const lines = snippets.map(item => {
    const label = english ? `Title: ${item.title}` : `标题：${item.title}`;
    const category = english ? `Category: ${item.category}` : `分类：${item.category}`;
    const description = item.description ? (english ? `Description: ${item.description}` : `说明：${item.description}`) : "";
    const tags = item.tags?.length ? (english ? `Tags: ${item.tags.join(", ")}` : `关联：${item.tags.join("、")}`) : "";
    return [label, category, description, tags, item.content].filter(Boolean).join("\n");
  });
  return `<knowledge_base>\n${heading}\n${note}\n\n${lines.join("\n\n")}\n</knowledge_base>`;
}
