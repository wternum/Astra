/**
 * Realistic browser-level test of "连接模型" with a no-CORS OpenAI-compatible
 * mock, the real target endpoint with an invalid key, and the free AI channel.
 * Requires a running Vite server with the same-origin relay: ./start.sh dev.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";

const origin = process.env.APP_URL || "http://127.0.0.1:5173";
const auths = [];
let optionsRequests = 0;
let chatRequests = 0;
const builderPayloads = [];

const analysis = {
  category: "coding",
  domain: "前端网站设计与开发",
  role: "兼具视觉与工程能力的前端开发者",
  knownFacts: ["用户希望得到一个优美的网页"],
  successCriteria: ["交付可运行页面", "手机与桌面布局可用"],
  complexity: "multi-step",
  summary: "我理解你想要一个可运行且视觉有辨识度的网页",
  goal: "构建可运行的响应式网页",
  audience: "未指定，按普通访客处理",
  deliverable: "可运行网页源码",
  tone: "清楚、自然",
  format: "完整源码与运行说明",
  constraints: [],
  hiddenNeeds: ["确定视觉方向", "验证主要交互"],
  assumptions: ["暂用可替换的演示主题"],
  questions: [],
  strategy: "按网站构建任务组织目标、视觉与交付验收",
  inferred: ["audience", "tone", "format"],
  confidence: 92,
  alternatives: [],
  frontendDesign: {
    visualDirection: "为演示主题选择安静的编辑式排版，避免通用渐变卡片",
    composition: "首屏读成一个完整画面，后续区块各有一个明确目的",
    typography: "展示字体承担标题，正文字体保证阅读",
    colorRoles: "画布、正文与行动色分别承担清晰职责",
    visualAnchor: "使用与主题相关、可替换的演示视觉素材",
    motion: "仅在内容进入时保留两处克制动效",
    interactions: "主导航与主要行动必须真实可用",
    implementation: "沿用现有项目栈并给出运行方式",
  },
};

const optimized = `## 目标与交付
请构建一个视觉清晰、可运行的响应式网页。

## 原始需求与已知信息
<user_request>帮我写一个优美的网页</user_request>
默认采用可替换的演示主题，不虚构品牌或客户资料。

## 执行步骤
确定首屏构图、字体层级、颜色职责与内容顺序。使用与主题相关的视觉素材，并实现主要导航和行动按钮。不要编造未提供的产品事实或数据。

## 输出契约
交付完整可运行源码、运行命令、手机与桌面布局，以及键盘焦点和 reduced-motion 处理。

## 质量检查
交付前核对首屏层级、主要交互是否可用、窄屏排版和素材替代方案；不要虚构用户没有提供的事实。`;

const responseText = body => {
  let parsed = {};
  try { parsed = JSON.parse(body || "{}"); } catch { /* empty */ }
  const system = String(parsed.messages?.[0]?.content || "");
  let content;
  if (system.includes("连接测试")) {
    // Reasoning-model shape: visible content is empty, answer is in reasoning_content.
    content = { content: "", reasoning_content: "可用" };
  } else if (system.includes("需求分析师") || system.includes("needs analyst")) {
    content = { content: "", reasoning_content: JSON.stringify(analysis) };
  } else {
    // Builder response arrives as structured content blocks.
    builderPayloads.push(body);
    const userContent = String(parsed.messages?.at(-1)?.content || "");
    const original = /"originalRequest"\s*:\s*"([^"]+)"/.exec(userContent)?.[1] || "帮我写一个优美的网页";
    const draft = optimized.replace(/<user_request>[\s\S]*?<\/user_request>/, `<user_request>${original}</user_request>`);
    content = { content: [{ type: "text", text: JSON.stringify({ optimized: draft, changes: ["识别为网站构建", "补齐视觉与交互要求"], rationale: "按前端任务构建" }) }] };
  }
  return JSON.stringify({
    model: "demo-large",
    choices: [{ index: 0, message: { role: "assistant", ...content }, finish_reason: "stop" }],
  });
};

const upstream = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    optionsRequests += 1;
    // Deliberately no CORS headers, like the real provider.
    res.writeHead(403);
    res.end();
    return;
  }
  auths.push(String(req.headers.authorization || ""));
  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: { models: [{ model: "demo-large", name: "Demo Large" }, { model_id: "demo-mini" }] } }));
    return;
  }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    chatRequests += 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(responseText(body));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${upstream.address().port}/v1`;
const browser = await chromium.launch();
const errors = [];

try {
  const relayHealth = await fetch(`${origin}/__astra/health`).then(response => response.json());
  assert.equal(relayHealth.service, "astra-same-origin-relay");
  console.log("same-origin relay: OK");

  // ---- Custom endpoint: discovery + connection + full optimization ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("promptforge:model:v3", "local");
    localStorage.removeItem("promptforge:custom-endpoint:v1");
    localStorage.setItem("astra:preview:templates:v1", "[]");
    sessionStorage.removeItem("astra:custom-key");
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".topbar-model").click();
  await page.locator(".model-access-tabs button", { hasText: "自定义接口" }).click();
  await page.fill("#custom-url", baseUrl);
  await page.fill("#model-key", "sk-synthetic-valid");

  await page.locator(".detect-button").click();
  await page.locator(".model-status", { hasText: "已发现 2 个模型" }).waitFor({ timeout: 15000 });
  assert.equal(await page.locator("input[placeholder^='模型 ID']").inputValue(), "demo-large");
  console.log("custom discovery: nested model list parsed through relay");

  await page.locator(".model-submit").click();
  await Promise.race([
    page.locator("[role=dialog]").waitFor({ state: "detached", timeout: 20000 }),
    page.locator(".form-error").waitFor({ timeout: 20000 }),
  ]);
  const connectError = await page.locator(".form-error").count() ? await page.locator(".form-error").innerText() : "";
  assert.equal(connectError, "", `custom connection failed: ${connectError}`);
  assert.match(await page.locator(".topbar-model").innerText(), /demo-large|自定义|AI/);
  console.log("custom connection: reasoning_content-only reply accepted");

  await page.evaluate(async () => {
    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "网页视觉规范", category: "开发",
        description: "网页构建的视觉与交互约定",
        templateText: "网页首屏要有明确信息层级，导航与主要按钮必须可操作；桌面和手机布局都要验证。",
        enabled: true,
      }),
    });
    if (!response.ok) throw new Error("knowledge creation failed");
    window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
  });
  await page.fill("#goal", "帮我写一个优美的网页，视觉规范");
  await page.locator(".flow-generate").click();
  await page.locator(".flow-document pre").waitFor({ timeout: 25000 });
  const output = await page.locator(".flow-document pre").innerText();
  assert.match(output, /## 目标与交付/);
  assert.match(output, /<user_request>帮我写一个优美的网页，视觉规范<\/user_request>/);
  assert.match(output, /<knowledge_base>/);
  assert.match(output, /网页视觉规范/);
  assert.ok(builderPayloads.some(payload => payload.includes("knowledgeBase") && payload.includes("网页视觉规范")),
    "builder should receive relevant knowledge in its task context");
  assert.equal(await page.locator(".flow-error").count(), 0);
  assert.ok(chatRequests >= 3, `expected connection + analysis + build, got ${chatRequests}`);
  assert.equal(optionsRequests, 0, "browser CORS preflight should be bypassed by relay");
  assert.ok(auths.every(value => value === "Bearer sk-synthetic-valid"));
  console.log("custom generation: analysis, knowledge and builder JSON accepted, key forwarded through relay");
  await page.evaluate(() => localStorage.setItem("astra:preview:templates:v1", "[]"));

  // ---- Real endpoint with an intentionally invalid key ----
  const real = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  real.on("pageerror", error => errors.push(`real: ${error.message}`));
  await real.addInitScript(() => localStorage.setItem("promptforge:model:v3", "local"));
  await real.goto(origin, { waitUntil: "networkidle" });
  await real.locator(".topbar-model").click();
  await real.locator(".model-access-tabs button", { hasText: "自定义接口" }).click();
  await real.fill("#custom-url", "https://api.yicode.ai/v1");
  await real.fill("#model-key", "sk-invalid-probe");
  await real.fill("input[placeholder^='模型 ID']", "gpt-4o-mini");
  await real.locator(".model-submit").click();
  await real.locator(".form-error").waitFor({ timeout: 40000 });
  const realError = await real.locator(".form-error").innerText();
  assert.match(realError, /401|API Key|拒绝访问/);
  console.log(`real endpoint with invalid key: ${realError}`);

  // ---- Free AI connection through the relay ----
  if (process.env.SKIP_FREE_AI !== "1") {
    const free = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    free.on("pageerror", error => errors.push(`free: ${error.message}`));
    await free.addInitScript(() => {
      localStorage.setItem("promptforge:model:v3", JSON.stringify({ provider: "pollinations", model: "openai-fast" }));
      localStorage.removeItem("astra:pollinations:next-at");
    });
    await free.goto(origin, { waitUntil: "networkidle" });
    await free.locator(".topbar-model").click();
    await free.locator(".model-submit").click();
    await Promise.race([
      free.locator("[role=dialog]").waitFor({ state: "detached", timeout: 180000 }),
      free.locator(".form-error").waitFor({ timeout: 180000 }),
    ]);
    const freeError = await free.locator(".form-error").count()
      ? await free.locator(".form-error").innerText()
      : "";
    if (freeError) console.log(`free AI connection diagnostic: ${freeError}`);
    else console.log("free AI connection: succeeded through relay");
    assert.equal(freeError, "", `free AI connection failed: ${freeError}`);
  }

  assert.deepEqual(errors, []);
  console.log("connect-model regression test passed");
} finally {
  await browser.close();
  upstream.close();
}
