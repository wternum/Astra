import type { KnowledgeEntry } from "./knowledge";
import { LIBRARIES, LIBRARY_IDS, libraryById, libraryForEntry } from "./knowledge-library";

/**
 * Knowledge groups (分组) — the second level under a 知识域.
 *
 * Entries carry their group as a plain `category` string, so a group only needs
 * a registry entry when the user wants it to exist before any knowledge is
 * written (empty placeholder groups), wants a colour, or wants to rename /
 * delete it later. Groups that only exist because entries use them stay
 * implicit and are merged into the same list with `custom: false`.
 *
 * Renaming or deleting a group rewrites the `category` of the entries that sit
 * inside it, so no historical entry is ever lost.
 */
export interface KnowledgeGroup {
  id: string;
  name: string;
  library: string;
  accent: string;
  createdAt: string;
}

export interface KnowledgeGroupView extends KnowledgeGroup {
  count: number;
  custom: boolean;
}

export const GROUPS_KEY = "astra:knowledge:groups:v1";
export const DEFAULT_GROUP = "通用";
export const MAX_GROUPS = 60;
export const MAX_GROUP_NAME = 20;

const FALLBACK_ACCENT = "violet";

function readRaw(): KnowledgeGroup[] {
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === "object")
      .map(item => {
        const group = item as Record<string, unknown>;
        return {
          id: typeof group.id === "string" && group.id ? group.id.slice(0, 40) : `g-${Math.random().toString(36).slice(2, 10)}`,
          name: normalizeGroupName(group.name),
          library: typeof group.library === "string" && LIBRARY_IDS.includes(group.library) ? group.library : "center",
          accent: typeof group.accent === "string" && group.accent.trim() ? group.accent.trim().slice(0, 16) : FALLBACK_ACCENT,
          createdAt: typeof group.createdAt === "string" ? group.createdAt : "",
        };
      })
      .filter(group => group.name);
  } catch { return []; }
}

function writeRaw(groups: KnowledgeGroup[]) {
  try { window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }
  catch { throw new Error("浏览器存储不可用或空间不足，分组未保存。请先导出备份。"); }
}

export function normalizeGroupName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 30);
}

export function readGroups(): KnowledgeGroup[] {
  return readRaw();
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Accent colour (hex) for a group, falling back to the 知识域 accent. */
export function accentForGroup(group: { accent?: string; library?: string }): string {
  if (group.accent) {
    const named = LIBRARIES.find(library => library.accent === group.accent);
    if (named) return named.accent;
  }
  return libraryById(group.library)?.accent || LIBRARIES[0].accent;
}

export interface GroupDraft { name: string; library: string; accent?: string }

export function createGroup(draft: GroupDraft): KnowledgeGroup {
  const name = normalizeGroupName(draft.name);
  if (!name) throw new Error("请填写分组名称。");
  if (name.length > MAX_GROUP_NAME) throw new Error(`分组名称请控制在 ${MAX_GROUP_NAME} 字以内。`);
  const library = LIBRARY_IDS.includes(draft.library) ? draft.library : "center";
  const groups = readRaw();
  if (groups.some(group => group.library === library && sameName(group.name, name))) {
    throw new Error("该知识域下已有同名分组，换一个名称吧。");
  }
  if (groups.length >= MAX_GROUPS) throw new Error(`分组数量已达上限（${MAX_GROUPS} 个），请先清理不用的分组。`);
  const group: KnowledgeGroup = {
    id: `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name, library,
    accent: typeof draft.accent === "string" && draft.accent.trim() ? draft.accent.trim().slice(0, 16) : FALLBACK_ACCENT,
    createdAt: new Date().toISOString(),
  };
  writeRaw([...groups, group]);
  return group;
}

/**
 * Adopt an implicit group (one that only exists because entries use it) into
 * the registry so it can be renamed or deleted. Returns the existing registry
 * group when the name is already registered.
 */
export function adoptGroup(library: string, name: string, accent?: string): KnowledgeGroup {
  const groupName = normalizeGroupName(name);
  if (!groupName) throw new Error("分组不存在。");
  const target = LIBRARY_IDS.includes(library) ? library : "center";
  const existing = readRaw().find(group => group.library === target && sameName(group.name, groupName));
  if (existing) return existing;
  return createGroup({ name: groupName, library: target, accent });
}

/** Resolve a tree group id (`implicit:<library>:<name>` or a registry id). */
export function resolveGroupId(raw: string): string {
  if (!raw.startsWith("implicit:")) return raw;
  const parts = raw.slice("implicit:".length).split(":");
  const library = parts.shift() || "center";
  return adoptGroup(library, parts.join(":")).id;
}

export interface RenameGroupResult { group: KnowledgeGroup; from: string; library: string; changed: boolean }

/** Registry-only rename. The caller migrates the entries that used `from`. */
export function renameGroup(id: string, name: string): RenameGroupResult {
  const next = normalizeGroupName(name);
  if (!next) throw new Error("请填写分组名称。");
  if (next.length > MAX_GROUP_NAME) throw new Error(`分组名称请控制在 ${MAX_GROUP_NAME} 字以内。`);
  const groups = readRaw();
  const index = groups.findIndex(group => group.id === id);
  if (index === -1) throw new Error("分组不存在，可能已被删除。");
  const current = groups[index];
  if (sameName(current.name, next)) return { group: current, from: current.name, library: current.library, changed: false };
  if (groups.some(group => group.id !== id && group.library === current.library && sameName(group.name, next))) {
    throw new Error("该知识域下已有同名分组，换一个名称吧。");
  }
  const group = { ...current, name: next };
  groups[index] = group;
  writeRaw(groups);
  return { group, from: current.name, library: current.library, changed: true };
}

export interface DeleteGroupResult { group: KnowledgeGroup }

/** Registry-only delete. The caller moves the entries that used the group. */
export function deleteGroup(id: string): DeleteGroupResult {
  const groups = readRaw();
  const index = groups.findIndex(group => group.id === id);
  if (index === -1) throw new Error("分组不存在，可能已被删除。");
  const [removed] = groups.splice(index, 1);
  writeRaw(groups);
  return { group: removed };
}

export interface GroupUsage { name: string; library: string; count: number }

/** Entries that belong to a group name inside one 知识域 (exact match). */
export function entriesInGroup(entries: KnowledgeEntry[], library: string, name: string): KnowledgeEntry[] {
  return entries.filter(entry => !entry.isBuiltin
    && libraryForEntry(entry) === library
    && (entry.category || DEFAULT_GROUP) === name);
}

/** Groups of one 知识域: registry groups first (with counts), then implicit ones. */
export function groupsForLibrary(entries: KnowledgeEntry[], library: string): KnowledgeGroupView[] {
  const registry = readRaw().filter(group => group.library === library);
  const derived = new Map<string, GroupUsage>();
  for (const entry of entries) {
    if (entry.isBuiltin || libraryForEntry(entry) !== library) continue;
    const name = (entry.category || DEFAULT_GROUP).trim() || DEFAULT_GROUP;
    const key = name.toLocaleLowerCase();
    const existing = derived.get(key);
    derived.set(key, { name: existing?.name || name, library, count: (existing?.count || 0) + 1 });
  }
  const views: KnowledgeGroupView[] = registry.map(group => ({
    ...group,
    count: derived.get(group.name.toLocaleLowerCase())?.count || 0,
    custom: true,
  }));
  const registered = new Set(views.map(view => view.name.toLocaleLowerCase()));
  for (const usage of derived.values()) {
    if (registered.has(usage.name.toLocaleLowerCase())) continue;
    views.push({ id: `implicit:${library}:${usage.name}`, name: usage.name, library, accent: "", createdAt: "", count: usage.count, custom: false });
  }
  return views.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

/** All groups with counts, grouped per 知识域, for the panel header and editor. */
export function allGroups(entries: KnowledgeEntry[]): KnowledgeGroupView[] {
  return LIBRARY_IDS.flatMap(library => groupsForLibrary(entries, library));
}

export function countActiveGroups(entries: KnowledgeEntry[]): number {
  return allGroups(entries).filter(group => group.count > 0).length;
}
