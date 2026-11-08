import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAnalysis, optimizeWithAi } from "../src/ai/engine";
import { selectRelevantKnowledge } from "../src/lib/knowledge";

const entries = [
  {
    id: 1, name: "品牌语气规范", category: "品牌", description: "面向年轻用户的表达规则",
    templateText: "语气温暖克制，不使用夸张形容词；品牌采用低糖、日常、可信赖的表达。", enabled: true, isBuiltin: false,
  },
  {
    id: 2, name: "发布流程约定", category: "通用", description: "内部上线检查清单",
    templateText: "每次发布前检查链接、版本号与回滚方案。", enabled: false, isBuiltin: false,
  },
  {
    id: -1, name: "内置示例", category: "写作", description: "内置任务",
    templateText: "写一篇关于品牌语气的文章", isBuiltin: true,
  },
];

describe("knowledge retrieval", () => {
  it("selects relevant enabled user entries, never disabled or built-in ones", () => {
    const picked = selectRelevantKnowledge("帮我写一个品牌文案，语气规范", entries);
    assert.deepEqual(picked.map(item => item.id), [1]);
    assert.match(picked[0].content, /温暖克制/);
  });
  it("does not inject unrelated knowledge", () => {
    assert.equal(selectRelevantKnowledge("用 Python 写一个批量重命名脚本", entries).length, 0);
  });
});

describe("knowledge-aware prompt compiler", () => {
  it("passes knowledge to the builder and deterministically preserves it in the prompt", async () => {
    const text = "帮我写一个品牌文案，语气规范";
    const analysis = normalizeAnalysis({
      category: "marketing", domain: "品牌文案写作", summary: "我理解你想要一份符合品牌语气规范的文案",
      goal: "写出符合规范的文案", audience: "年轻用户", deliverable: "一段品牌文案",
      tone: "温暖克制", format: "自然段落", constraints: [], hiddenNeeds: ["明确受众", "避免夸张"],
      assumptions: ["暂用通用品牌场景"], questions: [], strategy: "按品牌任务组织", inferred: [],
      confidence: 90, alternatives: [], frontendDesign: null,
    }, text);
    const draft = `## 目标与交付
请写一篇温暖克制、可直接使用的品牌文案。

## 原始需求与已知信息
<user_request>${text}</user_request>
默认假设：暂用通用品牌场景。不要编造用户未提供的事实或数据。

## 执行步骤
先明确受众和主要信息，再组织正文，避免夸张形容词。

## 输出契约
交付一段自然段落文案，说明适用渠道。

## 质量检查
交付前核对语气、受众和事实边界；不要编造品牌数据。`;
    const payloads: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
      payloads.push(String(init?.body || ""));
      return new Response(JSON.stringify({
        model: "mock-model",
        choices: [{ message: { content: JSON.stringify({ optimized: draft, changes: ["识别品牌文案任务"], rationale: "按品牌语气构建" }) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    try {
      const snippets = selectRelevantKnowledge(text, entries);
      const output = await optimizeWithAi(text, { provider: "custom", model: "mock-model", baseUrl: "http://example.test/v1" }, {
        analysis, knowledge: snippets,
      });
      assert.ok(payloads.length > 0);
      assert.match(payloads[0], /knowledgeBase/);
      assert.match(payloads[0], /品牌语气规范/);
      assert.match(output.optimized, /<knowledge_base>/);
      assert.match(output.optimized, /品牌语气规范/);
      assert.equal(output.quality.checks.find(item => item.id === "knowledge")?.passed, true);
      assert.deepEqual(output.knowledgeUsed.map(item => item.id), [1]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
