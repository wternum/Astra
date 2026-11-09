import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import KnowledgeInspector, { entryCode } from "../src/components/knowledge/KnowledgeInspector";
import type { KnowledgeEntry } from "../src/lib/knowledge";

const body = [
  "## 正文开始",
  "第一段应该直接出现。",
  ...Array.from({ length: 80 }, (_, index) => `${index + 1}. 这是第 ${index + 1} 条正文。`),
  "正文结束，不应被截断。",
].join("\n");

const entry: KnowledgeEntry = {
  id: 201,
  name: "用于辅助访问的条目标题",
  category: "开发",
  description: "不应出现在正文上方的描述",
  templateText: body,
  tags: ["视觉", "结构"],
  enabled: true,
  sourceUrl: "https://example.com/source",
};

function renderInspector(item: KnowledgeEntry) {
  return renderToStaticMarkup(<KnowledgeInspector
    entry={item}
    entries={[item]}
    edges={[]}
    onSelect={() => {}}
    onEdit={() => {}}
    onUse={() => {}}
    onToggle={() => {}}
    onCopy={() => {}}
    copied={false}
    onFocus={() => {}}
    focused={false}
    onClose={() => {}}
    onDelete={() => {}}
    onCreateRelated={() => {}}
  />);
}

test("opens the full document without the former metadata header", () => {
  const html = renderInspector(entry);
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>正文<\/button>/);
  assert.match(html, /第一段应该直接出现/);
  assert.match(html, /正文结束，不应被截断/);
  assert.doesNotMatch(html, /kg-inspector-title|kg-inspector-description|不应出现在正文上方的描述/);
  assert.doesNotMatch(html, /从此新建关联知识/);
  assert.match(html, /aria-label="复制正文"/);
  assert.match(html, /aria-label="关闭知识详情"/);
});

test("keeps the original text available for copying and built-ins read-only", () => {
  assert.ok(entryCode(entry).includes(body));
  const html = renderInspector({ ...entry, id: -1, isBuiltin: true });
  assert.match(html, /正文结束，不应被截断/);
  assert.match(html, /用于工作台/);
  assert.doesNotMatch(html, /编辑当前知识|删除当前知识/);
});