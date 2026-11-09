import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeKnowledgeEntries } from "../src/lib/knowledge";
import { SEED_KNOWLEDGE } from "../src/lib/knowledge-seed";
import { ALL_KNOWLEDGE, belongsToBranch, CARD_HEIGHT, CARD_WIDTH, orderedKnowledgeGraph } from "../src/lib/knowledge-layout";
import type { KnowledgeGraph } from "../src/lib/knowledge-graph";
const entries = normalizeKnowledgeEntries(SEED_KNOWLEDGE);
function noOverlap(graph: KnowledgeGraph) {
  for (const a of graph.nodes) for (const b of graph.nodes) {
    if (a.id >= b.id) continue;
    const aw = a.kind === "entry" ? CARD_WIDTH : 176, ah = a.kind === "entry" ? CARD_HEIGHT : 64;
    const bw = b.kind === "entry" ? CARD_WIDTH : 176, bh = b.kind === "entry" ? CARD_HEIGHT : 64;
    assert.ok(a.position.x + aw <= b.position.x || b.position.x + bw <= a.position.x || a.position.y + ah <= b.position.y || b.position.y + bh <= a.position.y, `${a.id} overlaps ${b.id}`);
  }
}
test("all knowledge has a deterministic aligned grid without overlaps", () => {
  const graph = orderedKnowledgeGraph(entries, ALL_KNOWLEDGE);
  assert.equal(graph.nodes.length, 12);
  noOverlap(graph);
  assert.deepEqual(graph.nodes.map(n => [n.id, n.position]), orderedKnowledgeGraph([...entries].reverse(), ALL_KNOWLEDGE).nodes.map(n => [n.id, n.position]));
  assert.equal(new Set(graph.nodes.map(node => node.position.x)).size, 3);
});
test("every domain and child category opens a non-overlapping left-to-right branch", () => {
  for (const library of ["center", "frontend", "backend", "creative"]) {
    const branch = { library, category: "", tag: "" };
    const scoped = entries.filter(item => belongsToBranch(item, branch));
    const graph = orderedKnowledgeGraph(scoped, branch);
    noOverlap(graph);
    assert.ok(graph.nodes.filter(node => node.kind === "category").every(node => node.position.x === 0));
    assert.ok(graph.nodes.filter(node => node.kind === "entry").every(node => node.position.x >= 260));
    const ids = new Set(graph.nodes.map(node => node.id));
    assert.ok(graph.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)));
    for (const category of new Set(scoped.map(item => item.category))) {
      const child = { ...branch, category };
      noOverlap(orderedKnowledgeGraph(entries.filter(item => belongsToBranch(item, child)), child));
    }
  }
});
test("a keyword filters only matching descendants and limit tracks hidden entries", () => {
  const branch = { library: "frontend", category: "开发", tag: "交互" };
  const taggedEntries = normalizeKnowledgeEntries([
    { id: 901, name: "交互规则", category: "开发", templateText: "交互说明", tags: ["交互"] },
    { id: 902, name: "视觉规则", category: "开发", templateText: "视觉说明", tags: ["视觉"] },
    { id: 903, name: "品牌交互", category: "品牌", templateText: "品牌说明", tags: ["交互"] },
  ]);
  const filtered = taggedEntries.filter(item => belongsToBranch(item, branch));
  assert.deepEqual(filtered.map(item => item.id), [901]);
  assert.ok(filtered.every(item => item.tags?.includes("交互")));
  const graph = orderedKnowledgeGraph(filtered, branch);
  assert.equal(graph.nodes.filter(item => item.kind === "topic").length, 1);
  noOverlap(graph);
  assert.equal(orderedKnowledgeGraph(entries, ALL_KNOWLEDGE, 3).hiddenEntries, entries.length - 3);
  assert.equal(orderedKnowledgeGraph([], branch).nodes.length, 0);
});
