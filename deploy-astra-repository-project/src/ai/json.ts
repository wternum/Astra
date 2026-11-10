/**
 * Tolerant JSON helpers for small-model output: fences, raw newlines inside
 * strings, trailing commas, smart quotes and truncated tails.
 * Shared by the general engine and the Arena spec pipeline.
 */

/** Escapes raw control characters that small models often leave inside JSON strings. */
export function repairJson(value: string) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of value) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === "\\") { out += ch; escaped = true; continue; }
      if (ch === "\"") { inString = false; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
    } else {
      if (ch === "\"") inString = true;
      out += ch;
    }
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

export function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const tryParse = (value: string) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null; } catch { return null; } };
  const candidates = [cleaned];
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(cleaned.slice(start, end + 1));
  for (const candidate of candidates) {
    const parsed = tryParse(candidate) || tryParse(repairJson(candidate)) || tryParse(repairJson(candidate.replace(/[“”]/g, "\"")));
    if (parsed) return parsed;
  }
  return null;
}

/** Recovers one JSON string value, tolerating raw newlines and a truncated tail. */
export function extractStringField(raw: string, field: string) {
  const match = new RegExp(`["']${field}(?:Prompt|_prompt)?["']\\s*:\\s*["']`, "i").exec(raw);
  if (!match) return "";
  let index = match.index + match[0].length;
  let value = "";
  let escaped = false;
  for (; index < raw.length; index++) {
    const ch = raw[index];
    if (escaped) { value += ch === "n" ? "\n" : ch === "r" ? "" : ch === "t" ? "\t" : ch; escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"' || ch === "'") break;
    value += ch;
  }
  return value.trim();
}

/**
 * Recovers the complete string items of a JSON array field, e.g. when the reply
 * was cut off by max_tokens: `"features": ["a", "b", "c` yields ["a", "b"].
 */
export function salvageArray(raw: string, field: string): string[] {
  const match = new RegExp(`["']${field}["']\\s*:\\s*\\[`, "i").exec(raw);
  if (!match) return [];
  const items: string[] = [];
  let index = match.index + match[0].length;
  let current: string | null = null;
  let escaped = false;
  for (; index < raw.length; index++) {
    const ch = raw[index];
    if (current === null) {
      if (ch === "]") break;
      if (ch === "\"") current = "";
      continue;
    }
    if (escaped) { current += ch === "n" ? "\n" : ch === "t" ? "\t" : ch; escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === "\"") { if (current.trim()) items.push(current.trim()); current = null; continue; }
    current += ch;
  }
  return items;
}

export const str = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;

export const strList = (value: unknown, max = 6) => Array.isArray(value)
  ? value.map(item => typeof item === "string" ? item.trim() : "").filter(Boolean).slice(0, max)
  : [];
