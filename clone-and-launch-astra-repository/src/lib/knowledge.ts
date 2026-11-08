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
      };
    })
    .filter(entry => entry.id > 0 || entry.name);
}

function tokens(value: string) {
  const normalized = value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, " ");
  const output: string[] = [];
  for (const word of normalized.split(" ").filter(Boolean)) {
    if (/^[a-z0-9]+$/.test(word)) {
      if (word.length >= 2) output.push(word);
    } else {
      for (let i = 0; i < word.length - 1; i++) output.push(word.slice(i, i + 2));
    }
  }
  return output;
}

function scoreField(query: Set<string>, value: string, weight: number) {
  let score = 0;
  const seen = new Set<string>();
  for (const token of tokens(value)) {
    if (query.has(token) && !seen.has(token)) { score += weight; seen.add(token); }
  }
  return score;
}

const MAX_ENTRY_CHARS = 850;
const MAX_TOTAL_CHARS = 2400;

/** Selects a few relevant, enabled, user-authored entries for prompt construction. */
export function selectRelevantKnowledge(
  text: string,
  raw: unknown[],
  maxItems = 3,
): KnowledgeSnippet[] {
  const entries = normalizeKnowledgeEntries(raw).filter(entry => !entry.isBuiltin && entry.enabled !== false && entry.templateText);
  const query = new Set(tokens(text));
  if (!entries.length || !query.size) return [];
  const lower = text.toLowerCase();
  const scored = entries.map(entry => {
    let score = scoreField(query, entry.name, 4)
      + scoreField(query, entry.description, 2)
      + scoreField(query, entry.category, 1.5)
      + scoreField(query, entry.templateText, 0.7)
      + scoreField(query, (entry.tags || []).join(" "), 2.4);
    if (entry.category === "通用") score += 0.8;
    const plainName = entry.name.toLowerCase();
    if (plainName.length >= 2 && lower.includes(plainName)) score += 10;
    return { entry, score };
  }).filter(item => item.score >= 1)
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
