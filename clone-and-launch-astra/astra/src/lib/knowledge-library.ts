import type { KnowledgeEntry } from "./knowledge";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "./knowledge-graph";

/**
 * The knowledge network is organised as four large libraries (知识域).
 * 中心 holds shared facts and team conventions; 前端 / 后端 / 创作 are the
 * domain libraries. Entries keep their own category, so no existing data has
 * to be migrated: a library is either stored explicitly or derived from the
 * category (including categories named after a library).
 */
export type LibraryIcon = "compass" | "layout" | "database" | "pen";
export interface KnowledgeLibrary {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  icon: LibraryIcon;
  categories: string[];
}

export const LIBRARIES: KnowledgeLibrary[] = [
  {
    id: "center", name: "中心", tagline: "通用事实与团队约定",
    description: "跨领域都要遵守的基础事实、流程与验收标准。任何子库都会引用这里的内容。",
    accent: "#a78bfa", icon: "compass", categories: ["通用", "效率", "学习"],
  },
  {
    id: "frontend", name: "前端", tagline: "界面、组件与交付规范",
    description: "页面结构、视觉规范、交互细节与前端交付清单。",
    accent: "#4fc3e8", icon: "layout", categories: ["开发"],
  },
  {
    id: "backend", name: "后端", tagline: "数据、指标与分析口径",
    description: "数据口径、统计约定、分析结构与需要长期维护的规则。",
    accent: "#57d19b", icon: "database", categories: ["数据", "分析"],
  },
  {
    id: "creative", name: "创作", tagline: "品牌、文案与创意表达",
    description: "品牌语气、写作骨架、营销边界与创意发散的评价标准。",
    accent: "#f0a54a", icon: "pen", categories: ["品牌", "写作", "营销", "创意"],
  },
];

export const LIBRARY_IDS = LIBRARIES.map(library => library.id);

export function libraryById(id: string | null | undefined): KnowledgeLibrary | null {
  return LIBRARIES.find(library => library.id === id) || null;
}

export function libraryForCategory(category: string): string {
  const value = category.trim();
  const named = LIBRARIES.find(library => library.name === value);
  if (named) return named.id;
  return LIBRARIES.find(library => library.categories.includes(value))?.id || "center";
}

export function libraryForEntry(entry: { library?: string; category?: string }): string {
  return entry.library && LIBRARY_IDS.includes(entry.library) ? entry.library : libraryForCategory(entry.category || "通用");
}

export function normalizeLibrary(value: unknown): string {
  return typeof value === "string" && LIBRARY_IDS.includes(value) ? value : "";
}

/** Centre of the hub map: 中心 in the middle, the three domain libraries orbiting it. */
export const HUB_POSITIONS: Record<string, { x: number; y: number }> = {
  center: { x: 0, y: 0 },
  frontend: { x: 0, y: -305 },
  backend: { x: 275, y: 165 },
  creative: { x: -275, y: 165 },
};

/** Hub graph: four large knowledge libraries, no decorative filler nodes. */
export function buildHubGraph(entries: KnowledgeEntry[]): KnowledgeGraph {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const id = libraryForEntry(entry);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const nodes: GraphNode[] = LIBRARIES.map(library => ({
    id: `lib:${library.id}`, kind: "library", label: library.name, category: library.name,
    position: HUB_POSITIONS[library.id], tagline: library.tagline, accent: library.accent,
    count: counts.get(library.id) || 0, icon: library.icon,
  }));
  const center = nodes[0];
  const edges: GraphEdge[] = LIBRARIES.filter(library => library.id !== "center").map(library => ({
    id: `hub:center:${library.id}`, source: center.id, target: `lib:${library.id}`, kind: "hub",
    label: "知识域", evidence: [`知识域：中心 → ${library.name}`], sourceIds: [], origin: "知识域结构",
  }));
  return { nodes, edges, totalEntries: entries.length, hiddenEntries: 0 };
}

/** Library counts for the hub panel and breadcrumb. */
export function libraryCounts(entries: KnowledgeEntry[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(LIBRARY_IDS.map(id => [id, 0]));
  for (const entry of entries) counts[libraryForEntry(entry)] = (counts[libraryForEntry(entry)] || 0) + 1;
  return counts;
}
