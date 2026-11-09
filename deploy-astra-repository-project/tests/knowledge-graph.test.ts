import test from "node:test";
import assert from "node:assert/strict";
import { buildKnowledgeGraph, canonicalTag, neighborhood, validateRelations } from "../src/lib/knowledge-graph";
import { buildHubGraph, libraryCounts, libraryForCategory, libraryForEntry, normalizeLibrary, LIBRARIES } from "../src/lib/knowledge-library";
import { normalizeKnowledgeEntries, selectRelevantKnowledge } from "../src/lib/knowledge";
import { SEED_KNOWLEDGE } from "../src/lib/knowledge-seed";
import type { KnowledgeEntry } from "../src/lib/knowledge";

const entry = (id: number, tags: string[], category = "开发"): KnowledgeEntry => ({ id, name: `知识 ${id}`, category, tags, description: "", templateText: "参考内容", enabled: true });

test("seed graph has no decorative hub and keeps every entry visible", () => {
  const graph = buildKnowledgeGraph(SEED_KNOWLEDGE);
  assert.equal(graph.nodes.filter(node => node.kind === "entry").length, 12);
  assert.equal(graph.nodes.some(node => node.id === "hub"), false);
  assert.equal(graph.hiddenEntries, 0);
  assert.ok(graph.edges.every(edge => edge.evidence.length && edge.sourceIds.length));
});
test("keyword aliases are resolved without losing display labels", () => {
  assert.equal(canonicalTag(" ＡＩ "), canonicalTag("ai"));
  const graph = buildKnowledgeGraph([entry(1, ["AI", "ai"]), entry(2, ["ＡＩ"])], { showTopics: true });
  assert.equal(graph.nodes.filter(node => node.kind === "topic").length, 1);
  assert.equal(graph.edges.filter(edge => edge.kind === "topic").length, 2);
});
test("shared-keyword view is a sparse forest, not a complete graph", () => {
  const graph = buildKnowledgeGraph(Array.from({ length: 8 }, (_, i) => entry(i + 1, ["共享"])));
  assert.equal(graph.edges.filter(edge => edge.kind === "shared").length, 7);
});
test("manual relations are directed, deduplicated and cannot target missing entries", () => {
  const entries = [entry(1, []), entry(2, [])];
  const relations = validateRelations([{ targetId: 2, kind: "references" }, { targetId: 2, kind: "references" }, { targetId: 1, kind: "depends_on" }, { targetId: 99, kind: "references" }], 1, entries);
  assert.deepEqual(relations, [{ targetId: 2, kind: "references" }]);
  entries[0].relations = relations;
  const edge = buildKnowledgeGraph(entries).edges.find(edge => edge.kind === "references")!;
  assert.equal(edge.source, "entry:1"); assert.equal(edge.target, "entry:2"); assert.equal(edge.origin, "用户标注");
});
test("neighborhood expansion is bounded and pagination is explicit", () => {
  const entries = [entry(1, ["a"]), entry(2, ["a", "b"]), entry(3, ["b"])];
  const graph = buildKnowledgeGraph(entries);
  assert.equal(neighborhood(graph, "entry:1", 1).size, 2);
  assert.equal(neighborhood(graph, "entry:1", 2).size, 3);
  const limited = buildKnowledgeGraph(entries, { limit: 1 });
  assert.equal(limited.hiddenEntries, 2); assert.equal(limited.nodes.length, 1);
});
test("category layout creates explicit membership edges", () => {
  const graph = buildKnowledgeGraph(SEED_KNOWLEDGE, { layout: "category" });
  assert.equal(graph.edges.filter(edge => edge.kind === "contains").length, SEED_KNOWLEDGE.length);
  assert.equal(graph.nodes.filter(node => node.kind === "category").length, new Set(SEED_KNOWLEDGE.map(item => item.category || "通用")).size);
});
test("the hub is built from four large knowledge libraries with real counts", () => {
  const fixtures = [
    entry(1, [], "通用"), entry(2, [], "开发"), entry(3, [], "开发"),
    entry(4, [], "数据"), entry(5, [], "分析"), entry(6, [], "品牌"),
    entry(7, [], "写作"), entry(8, [], "营销"),
  ];
  const hub = buildHubGraph(fixtures);
  assert.equal(hub.nodes.length, 4);
  assert.equal(hub.nodes[0].kind, "library");
  assert.equal(hub.nodes[0].id, "lib:center");
  assert.equal(hub.edges.length, 3);
  assert.ok(hub.edges.every(edge => edge.kind === "hub"));
  const counts = libraryCounts(fixtures);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), fixtures.length);
  assert.equal(counts.center, 1); // 通用
  assert.equal(counts.frontend, 2); // 开发
  assert.equal(counts.backend, 2); // 数据 + 分析
  assert.equal(counts.creative, 3); // 品牌 + 写作 + 营销
  assert.ok(hub.nodes.every(node => node.count !== undefined && node.accent && node.tagline));
});
test("library membership comes from an explicit field or the category", () => {
  assert.equal(libraryForCategory("开发"), "frontend");
  assert.equal(libraryForCategory("后端"), "backend"); // category named after a library
  assert.equal(libraryForCategory("未知分类"), "center");
  assert.equal(libraryForEntry({ library: "creative", category: "开发" }), "creative");
  assert.equal(normalizeLibrary("backend"), "backend");
  assert.equal(normalizeLibrary("nope"), "");
  assert.equal(LIBRARIES.length, 4);
});
test("orbit layout puts the core first and connects categories through it", () => {
  const graph = buildKnowledgeGraph(SEED_KNOWLEDGE, { layout: "orbit", core: { label: "创作", accent: "#f0a54a", tagline: "品牌、文案与创意表达" } });
  assert.equal(graph.nodes[0].id, "core");
  assert.equal(graph.nodes[0].kind, "core");
  const categories = graph.nodes.filter(node => node.kind === "category");
  assert.equal(categories.length, new Set(SEED_KNOWLEDGE.map(item => item.category || "通用")).size);
  assert.ok(categories.every(node => Math.abs(Math.hypot(node.position.x, node.position.y) - 138) < 0.5));
  const entries = graph.nodes.filter(node => node.kind === "entry");
  assert.ok(entries.every(node => Math.hypot(node.position.x, node.position.y) >= 270));
  assert.equal(graph.edges.filter(edge => edge.source === "core").length, categories.length);
  assert.equal(graph.edges.filter(edge => edge.kind === "contains").length, categories.length + SEED_KNOWLEDGE.length);
});
test("legacy entries normalize safely and disabled knowledge is not retrieved", () => {
  const [legacy] = normalizeKnowledgeEntries([{ id: 1, name: "旧知识", templateText: "品牌语气", sourceUrl: "javascript:alert(1)" }]);
  assert.equal(legacy.sourceUrl, ""); assert.deepEqual(legacy.relations, []); assert.equal(legacy.enabled, true);
  assert.equal(selectRelevantKnowledge("品牌语气", [{ ...legacy, enabled: false }]).length, 0);
  assert.equal(selectRelevantKnowledge("品牌语气", [legacy]).length, 1);
});
