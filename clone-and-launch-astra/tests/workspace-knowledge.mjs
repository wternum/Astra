/**
 * Browser test for the connected workspace and knowledge-assisted prompt flow.
 * Requires `./start.sh dev` (or `npm run dev` with vite.config.js).
 * Run: node tests/workspace-knowledge.mjs
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.APP_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
const errors = [];

try {
  // ---- Connected: no hero card, prompt composer at top ----
  const connected = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  connected.on("pageerror", error => errors.push(`connected: ${error.message}`));
  await connected.addInitScript(() => {
    localStorage.setItem("promptforge:model:v3", JSON.stringify({ provider: "pollinations", model: "openai-fast" }));
    localStorage.removeItem("promptforge:custom-endpoint:v1");
  });
  await connected.goto(origin, { waitUntil: "networkidle" });
  await connected.waitForFunction(() => document.querySelectorAll(".hero-panel").length === 0, null, { timeout: 10000 });
  assert.equal(await connected.locator(".workspace-heading").count(), 0);
  const composer = await connected.locator(".flow-composer").boundingBox();
  assert.ok(composer && composer.y < 180, `composer should be near the top, got y=${composer?.y}`);
  assert.match(await connected.locator(".sidebar-nav").innerText(), /知识库/);
  assert.doesNotMatch(await connected.locator(".sidebar-nav").innerText(), /模板库/);
  console.log("connected workspace: hero removed, composer at top, sidebar renamed to 知识库");
  await connected.screenshot({ path: "/tmp/astra-connected-workspace.png" });
  await connected.close();

  // ---- Knowledge library: create, use and disable an entry ----
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(`knowledge: ${error.message}`));
  await page.addInitScript(() => {
    localStorage.setItem("promptforge:model:v3", "local");
    localStorage.setItem("astra:preview:templates:v1", "[]");
    localStorage.removeItem("promptforge:draft:v2");
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".sidebar-nav-item", { hasText: "知识库" }).click();
  await page.locator(".interior-heading h1", { hasText: "知识库" }).waitFor();
  await page.locator(".library-toolbar .button-dark").click();
  await page.fill("#knowledge-name", "品牌语气规范");
  await page.fill("#knowledge-description", "面向年轻用户的品牌表达规则");
  await page.fill("#knowledge-content", "语气温暖克制，不使用夸张形容词；品牌表达低糖、日常、可信赖。");
  await page.getByRole("button", { name: "保存知识" }).click();
  await page.locator(".template-card h3", { hasText: "品牌语气规范" }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator(".knowledge-state.active").count(), 1);
  assert.match(await page.locator(".knowledge-scope button.active").innerText(), /我的知识/);
  assert.equal(await page.locator(".template-card").count(), 1, "built-in examples should be in their own tab");
  await page.locator(".knowledge-scope button", { hasText: "内置示例" }).click();
  assert.ok(await page.locator(".template-card").count() > 3);
  await page.locator(".knowledge-scope button", { hasText: "我的知识" }).click();
  assert.equal(await page.locator(".template-card h3").first().innerText(), "品牌语气规范");
  console.log("knowledge library: user entries first; built-in examples separated");

  await page.locator(".sidebar-nav-item", { hasText: "工作台" }).click();
  await page.fill("#goal", "帮我写一个品牌文案，语气规范");
  assert.equal(await page.locator(".flow-starters").count(), 0);
  assert.match(await page.locator(".flow-knowledge-toggle").innerText(), /1 条 · 参与构建/);
  await page.locator(".flow-generate").click();
  await page.locator(".flow-document pre").waitFor({ timeout: 15000 });
  const withKnowledge = await page.locator(".flow-document pre").innerText();
  assert.match(withKnowledge, /<knowledge_base>/);
  assert.match(withKnowledge, /品牌语气规范/);
  assert.match(await page.locator(".flow-output-meta").innerText(), /知识库 1 条/);
  console.log("offline generation: relevant knowledge injected as an independent block");

  await page.locator(".flow-knowledge-toggle").click();
  assert.match(await page.locator(".flow-knowledge-toggle").innerText(), /关闭/);
  await page.locator(".flow-generate").click();
  await page.waitForFunction(() => {
    const element = document.querySelector(".flow-document pre");
    return element && !element.textContent?.includes("<knowledge_base>");
  }, null, { timeout: 15000 });
  console.log("knowledge toggle: disabling it removes knowledge from the generated prompt");

  await page.evaluate(() => localStorage.setItem("astra:preview:templates:v1", "[]"));
  assert.deepEqual(errors, []);
  console.log("workspace/knowledge regression test passed");
} finally {
  await browser.close();
}
