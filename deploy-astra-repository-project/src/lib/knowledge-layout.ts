import type { KnowledgeEntry } from "./knowledge";
import { buildKnowledgeGraph, canonicalTag, type GraphEdge, type GraphNode, type KnowledgeGraph } from "./knowledge-graph";
import { LIBRARIES, libraryForEntry } from "./knowledge-library";
import { paletteForCategory } from "./knowledge-graph";

export type KnowledgeBranch = { library: string; category: string; tag: string };
export const ALL_KNOWLEDGE: KnowledgeBranch = { library: "all", category: "", tag: "" };
export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 104;
export const COLUMN_STEP = 272;
export const ROW_STEP = 148;

export function belongsToBranch(entry: KnowledgeEntry, branch: KnowledgeBranch) {
  return (branch.library === "all" || libraryForEntry(entry) === branch.library)
    && (!branch.category || (entry.category || "通用") === branch.category)
    && (!branch.tag || entry.tags?.some(tag => canonicalTag(tag) === canonicalTag(branch.tag)));
}

/** Stable reading order; neither edits nor selection can randomly shuffle nodes. */
export function sortKnowledge(entries: KnowledgeEntry[]) {
  const domainOrder = new Map(LIBRARIES.map((item, index) => [item.id, index]));
  return [...entries].sort((a, b) =>
    (domainOrder.get(libraryForEntry(a)) ?? 0) - (domainOrder.get(libraryForEntry(b)) ?? 0)
    || (a.category || "通用").localeCompare(b.category || "通用", "zh-CN")
    || a.id - b.id);
}

/** All knowledge is a readable aligned grid. A branch opens as labels → cards. */
export function orderedKnowledgeGraph(entries: KnowledgeEntry[], branch: KnowledgeBranch, limit = 80): KnowledgeGraph {
  const ordered = sortKnowledge(entries);
  const source = buildKnowledgeGraph(ordered, { limit });
  const visible = ordered.slice(0, limit);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [...source.edges];
  if (branch.library === "all" && !branch.category && !branch.tag) {
    visible.forEach((entry, index) => nodes.push({
      id: `entry:${entry.id}`, kind: "entry", label: entry.name, category: entry.category || "通用", entry,
      position: { x: (index % 3) * COLUMN_STEP, y: Math.floor(index / 3) * ROW_STEP },
    }));
  } else {
    const groups = new Map<string, KnowledgeEntry[]>();
    for (const entry of visible) {
      const category = entry.category || "通用";
      groups.set(category, [...(groups.get(category) || []), entry]);
    }
    let y = 0;
    for (const [category, list] of groups) {
      const columns = groups.size === 1 && list.length <= 4 ? 1 : 2;
      const height = Math.ceil(list.length / columns) * ROW_STEP - (ROW_STEP - CARD_HEIGHT);
      const rootId = branch.tag ? `topic:${canonicalTag(branch.tag)}` : `category:${category}`;
      nodes.push({ id: rootId, kind: branch.tag ? "topic" : "category", label: branch.tag || category,
        category, count: list.length, accent: paletteForCategory(category), position: { x: 0, y: y + (height - 64) / 2 } });
      list.forEach((entry, index) => {
        nodes.push({ id: `entry:${entry.id}`, kind: "entry", label: entry.name, category, entry,
          position: { x: 260 + (index % columns) * COLUMN_STEP, y: y + Math.floor(index / columns) * ROW_STEP } });
        edges.push({ id: `structure:${rootId}:${entry.id}`, source: rootId, target: `entry:${entry.id}`,
          kind: branch.tag ? "topic" : "contains", label: branch.tag ? "关键词" : "包含",
          evidence: [branch.tag ? `共同关键词：${branch.tag}` : `分类：${category}`], sourceIds: [entry.id],
          origin: branch.tag ? "共享关键词" : "分类字段" });
      });
      y += height + 64;
    }
  }
  return { nodes, edges, totalEntries: entries.length, hiddenEntries: Math.max(0, entries.length - limit) };
}
