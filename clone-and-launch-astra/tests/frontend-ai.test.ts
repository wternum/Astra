import assert from "node:assert/strict";
import { it } from "node:test";
import { normalizeAnalysis, optimizeWithAi } from "../src/ai/engine";
import { PROMPT_CASES } from "../src/ai/cases";

const provider = { provider: "custom" as const, model: "test-model", baseUrl: "https://example.test/v1" };

it("passes a user-grounded website brief into the real two-stage AI flow", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { messages: { role: string; content: string }[] }[] = [];
  const english = PROMPT_CASES.find(item => item.id === "web-open-english")!;
  const shop = PROMPT_CASES.find(item => item.id === "web-shop")!;

  const analysisFor = (text: string) => text === shop.input ? {
    category: "coding",
    domain: "手作陶瓷网店",
    role: "电商设计工程师",
    goal: "让访客浏览并购买手作陶瓷",
    audience: "未说明",
    deliverable: "可运行的网店页面",
    constraints: ["能筛选产品和加入购物车"],
    assumptions: ["商品数据为可替换的演示数据"],
    successCriteria: ["筛选和购物车有真实状态"],
    frontendDesign: {
      visualDirection: "让陶瓷质感与温暖的留白承担品牌印象",
      composition: "从商品实物、信息到购买路径",
      typography: "温和展示字与可读正文",
      colorRoles: "纸色画布与深色文字，行动色仅给购买",
      visualAnchor: "产品实物图",
      motion: "加入购物车时短促反馈",
      interactions: "筛选更新列表，购物车更新数量",
      implementation: "沿用用户的项目技术栈",
    },
  } : {
    category: "coding",
    domain: "Website design and development",
    goal: "Build a beautiful working site",
    audience: "not specified",
    deliverable: "a runnable website",
    assumptions: ["Use a clearly labelled demo subject"],
    successCriteria: ["Working navigation", "Responsive layout"],
    frontendDesign: {
      visualDirection: "Choose one coherent editorial direction for a labelled demo project",
      composition: "One focused first viewport, then useful supporting sections",
      typography: "Distinct display and reading roles",
      colorRoles: "Canvas, text and action colors each have a job",
      visualAnchor: "Relevant work or product media, not a decorative gradient",
      motion: "Two purposeful transitions with reduced-motion support",
      interactions: "Navigation and primary action must work",
      implementation: "Reuse the project's stack when there is one",
    },
  };

  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body || "{}")) as { messages: { role: string; content: string }[] };
    requests.push(request);
    const input = request.messages.at(-1)?.content || "";
    const promptCase = input.includes(shop.input) ? shop : english;
    const content = requests.length % 2 === 1
      ? JSON.stringify(analysisFor(promptCase.input))
      : JSON.stringify({ optimized: promptCase.optimized, changes: ["Matched the user's job"], rationale: "Task-specific structure" });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], model: "test-model" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const website = await optimizeWithAi(english.input, provider);
    assert.equal(website.analysis.frontend?.kind, "site");
    assert.equal(website.quality.ok, true);
    assert.equal(website.repairAttempts, 0);
    assert.equal(requests.length, 2);
    assert.match(requests[1].messages[0].content, /For website-building requests/);
    assert.match(requests[1].messages[0].content, /I want to make a beautiful website/);
    assert.doesNotMatch(requests[1].messages[0].content, /写个脚本批量改照片名/);
    assert.match(requests[1].messages[1].content, /"kind": "site"/);
    assert.match(website.optimized, /## Goal and deliverable/);

    const storefront = await optimizeWithAi(shop.input, provider);
    assert.equal(storefront.analysis.frontend?.kind, "storefront");
    assert.equal(storefront.quality.ok, true);
    assert.equal(requests.length, 4);
    assert.match(requests[3].messages[0].content, /手作陶瓷店/);
    assert.match(requests[3].messages[1].content, /"kind": "storefront"/);
    assert.match(requests[3].messages[1].content, /筛选更新列表，购物车更新数量/);
    assert.doesNotMatch(requests[3].messages[0].content, /A beautiful website from one line/);
    assert.notEqual(website.optimized, storefront.optimized);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("honors AI-proposed design decisions without turning them into known facts", () => {
  const text = "我想做个漂亮的咖啡店官网，不要自动播放视频";
  const analysis = normalizeAnalysis({
    category: "coding",
    domain: "咖啡品牌官网",
    constraints: ["不要自动播放视频"],
    knownFacts: ["咖啡店官网", "不要自动播放视频"],
    frontendDesign: { visualDirection: "让咖啡空间的照片与暖色排版形成安静氛围" },
  }, text);
  assert.equal(analysis.frontend?.kind, "landing");
  assert.equal(analysis.frontend?.source, "ai");
  assert.ok(analysis.frontend?.visualDirection.includes("咖啡空间"));
  assert.ok(analysis.constraints.includes("不要自动播放视频"));
  assert.ok(!analysis.knownFacts.includes("照片已提供"));
});