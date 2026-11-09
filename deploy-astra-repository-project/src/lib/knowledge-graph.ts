import type { KnowledgeEntry } from "./knowledge";
import { paletteForEntry } from "./knowledge-palette";

export const paletteForCategory = (category: string) => paletteForEntry({ category }).colors.accent;

export type RelationKind = "references" | "depends_on";
export interface KnowledgeRelation { targetId: number; kind: RelationKind }
export type GraphNodeKind = "entry" | "category" | "topic" | "core" | "library";
export type GraphEdgeKind = "contains" | "shared" | "topic" | "hub" | RelationKind;
export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  category: string;
  entry?: KnowledgeEntry;
  position: { x: number; y: number };
  tagline?: string;
  count?: number;
  accent?: string;
  icon?: string;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  label: string;
  evidence: string[];
  sourceIds: number[];
  origin: "分类字段" | "共享关键词" | "用户标注" | "知识域结构";
}
export interface KnowledgeGraph { nodes: GraphNode[]; edges: GraphEdge[]; totalEntries: number; hiddenEntries: number }
export const RELATION_LABELS: Record<GraphEdgeKind, string> = {
  contains: "包含", shared: "共享关键词", topic: "涉及", hub: "知识域", references: "参考", depends_on: "依赖",
};
export const canonicalTag = (tag: string) => tag.trim().normalize("NFKC").toLocaleLowerCase();
const TAU = Math.PI * 2;
export interface OrbitCore { label: string; accent: string; tagline: string }

/** Only explicit, inspectable relationships. No decorative hub or inferred facts. */
export function buildKnowledgeGraph(entries: KnowledgeEntry[], options: {
  layout?: "network" | "category" | "orbit"; showTopics?: boolean; limit?: number; core?: OrbitCore;
} = {}): KnowledgeGraph {
  const limit = options.limit ?? 40;
  const visible = entries.slice(0, limit);
  const ids = new Set(visible.map(entry => entry.id));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const groups = new Map<string, KnowledgeEntry[]>();
  for (const entry of visible) {
    const category = entry.category || "通用";
    groups.set(category, [...(groups.get(category) || []), entry]);
  }
  const groupList = [...groups.entries()];

  // 星座轨道 layout: one bright core, categories on the inner orbit,
  // knowledge entries as stars on the outer orbits of their category slice.
  if (options.layout === "orbit" && options.core) {
    const core = options.core;
    nodes.push({ id: "core", kind: "core", label: core.label, category: "", position: { x: 0, y: 0 }, accent: core.accent, tagline: core.tagline });
    const slices = Math.max(groupList.length, 1);
    groupList.forEach(([category, list], groupIndex) => {
      const base = -Math.PI / 2 + (groupIndex / slices) * TAU;
      const accent = paletteForCategory(category);
      nodes.push({ id: `category:${category}`, kind: "category", label: category, category, position: { x: Math.cos(base) * 138, y: Math.sin(base) * 138 }, accent });
      edges.push({ id: `contains:core:${category}`, source: "core", target: `category:${category}`, kind: "contains", label: "包含", evidence: [`知识域：${core.label} → ${category}`], sourceIds: [], origin: "分类字段" });
      list.forEach((entry, index) => {
        const spread = list.length === 1 ? 0 : ((index / (list.length - 1)) - 0.5) * (TAU / slices) * 0.7;
        const angle = base + spread;
        const radius = 272 + (index % 2) * 96;
        nodes.push({ id: `entry:${entry.id}`, kind: "entry", label: entry.name, category, entry, position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius } });
        edges.push({ id: `contains:${entry.id}`, source: `category:${category}`, target: `entry:${entry.id}`, kind: "contains", label: "包含", evidence: [`分类：${category}`], sourceIds: [entry.id], origin: "分类字段" });
      });
    });
  } else {

  const columns = Math.min(3, Math.max(1, groupList.length));
  const columnHeights = [0, 0, 0];
  groupList.forEach(([category, list], groupIndex) => {
    const column = groupIndex % columns;
    const x = column * 238;
    const y = columnHeights[column];
    if (options.layout === "category") {
      nodes.push({ id: `category:${category}`, kind: "category", label: category, category, position: { x, y } });
    }
    list.forEach((entry, index) => {
      const position = options.layout === "category"
        ? { x, y: y + 72 + index * 118 }
        : { x: (groupIndex * 0 + visible.indexOf(entry)) % 3 * 238, y: Math.floor(visible.indexOf(entry) / 3) * 126 };
      nodes.push({ id: `entry:${entry.id}`, kind: "entry", label: entry.name, category, entry, position });
      if (options.layout === "category") edges.push({ id: `contains:${entry.id}`, source: `category:${category}`, target: `entry:${entry.id}`, kind: "contains", label: "包含", evidence: [`分类：${category}`], sourceIds: [entry.id], origin: "分类字段" });
    });
    columnHeights[column] += list.length * 118 + 144;
  });

  }

  // Resolve tag aliases by Unicode normalization + case folding. Keep original display labels.
  const topics = new Map<string, { label: string; entries: KnowledgeEntry[] }>();
  for (const entry of visible) {
    const seen = new Set<string>();
    for (const raw of entry.tags || []) {
      const key = canonicalTag(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const topic = topics.get(key) || { label: raw.trim(), entries: [] };
      topic.entries.push(entry);
      topics.set(key, topic);
    }
  }
  if (options.showTopics) {
    let index = 0;
    for (const [key, topic] of topics) {
      if (topic.entries.length < 2) continue;
      const id = `topic:${key}`;
      nodes.push({ id, kind: "topic", label: topic.label, category: "关键词", position: { x: (index % 4) * 220, y: -160 - Math.floor(index / 4) * 110 } });
      for (const entry of topic.entries) edges.push({ id: `topic:${key}:${entry.id}`, source: `entry:${entry.id}`, target: id, kind: "topic", label: "涉及", evidence: [`关键词：${topic.label}`], sourceIds: [entry.id], origin: "共享关键词" });
      index++;
    }
  } else {
    // A maximum-spanning forest keeps shared-keyword connections readable without
    // turning every shared tag into a complete graph. All evidence remains available.
    const candidates: (GraphEdge & { weight: number })[] = [];
    for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i], b = visible[j];
      const shared = (a.tags || []).filter(tag => (b.tags || []).some(other => canonicalTag(other) === canonicalTag(tag)));
      if (!shared.length) continue;
      candidates.push({ id: `shared:${a.id}:${b.id}`, source: `entry:${a.id}`, target: `entry:${b.id}`, kind: "shared", label: shared[0], weight: shared.length + (a.category !== b.category ? 0.5 : 0), evidence: shared.map(tag => `共同关键词：${tag}`), sourceIds: [a.id, b.id], origin: "共享关键词" });
    }
    candidates.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
    const parent = new Map(visible.map(entry => [entry.id, entry.id]));
    const root = (id: number): number => { const p = parent.get(id)!; return p === id ? id : root(p); };
    for (const edge of candidates) {
      const a = root(Number(edge.source.slice(6))), b = root(Number(edge.target.slice(6)));
      if (a === b) continue;
      parent.set(a, b);
      edges.push(edge);
    }
  }
  for (const entry of visible) for (const relation of entry.relations || []) {
    if (!ids.has(relation.targetId) || relation.targetId === entry.id) continue;
    edges.push({ id: `manual:${entry.id}:${relation.targetId}:${relation.kind}`, source: `entry:${entry.id}`, target: `entry:${relation.targetId}`, kind: relation.kind, label: RELATION_LABELS[relation.kind], evidence: [`${entry.name} ${RELATION_LABELS[relation.kind]} ${entries.find(item => item.id === relation.targetId)?.name || relation.targetId}`], sourceIds: [entry.id, relation.targetId], origin: "用户标注" });
  }
  return { nodes, edges, totalEntries: entries.length, hiddenEntries: Math.max(0, entries.length - visible.length) };
}

export function neighborhood(graph: KnowledgeGraph, id: string | null, depth = 1): Set<string> {
  const result = new Set<string>();
  if (!id || !graph.nodes.some(node => node.id === id)) return result;
  result.add(id);
  for (let hop = 0; hop < depth; hop++) {
    const current = new Set(result);
    for (const edge of graph.edges) {
      if (current.has(edge.source)) result.add(edge.target);
      if (current.has(edge.target)) result.add(edge.source);
    }
  }
  return result;
}

export function validateRelations(raw: unknown, ownId: number, entries: KnowledgeEntry[]): KnowledgeRelation[] {
  if (!Array.isArray(raw)) return [];
  const validIds = new Set(entries.filter(entry => !entry.isBuiltin && entry.id !== ownId).map(entry => entry.id));
  const seen = new Set<string>();
  const output: KnowledgeRelation[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const targetId = Number(item.targetId);
    const kind = item.kind;
    if (!validIds.has(targetId) || (kind !== "references" && kind !== "depends_on")) continue;
    const key = `${targetId}:${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ targetId, kind });
  }
  return output;
}
