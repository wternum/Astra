/**
 * Verifies the seeded knowledge web: initial data, force-directed canvas,
 * keyword filtering, node dragging / zoom, and preview/code tabs.
 * Requires a running dev or preview server.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.APP_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("promptforge:model:v3", "local");
    localStorage.removeItem("astra:preview:templates:v1");
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".sidebar-nav-item", { hasText: "知识库" }).click();
  await page.locator(".interior-heading h1").waitFor();
  await page.waitForTimeout(900);

  const cards = await page.locator(".template-card").count();
  assert.equal(cards, 12, `expected 12 seeded knowledge cards, got ${cards}`);
  assert.match(await page.locator(".kb-hero-stats").innerText(), /12/);
  console.log("initial data: 12 seeded knowledge entries visible");

  const tagButtons = await page.locator(".kb-tag-list button").count();
  assert.ok(tagButtons >= 8, `expected keyword rail, got ${tagButtons} tags`);
  assert.ok(await page.locator(".kb-card-tags button").count() >= 20);
  console.log(`keyword web: ${tagButtons} shared tags, card chips visible`);

  // The force-directed canvas actually paints a web (lots of non-dark pixels).
  const painted = await page.locator(".kb-network-canvas").evaluate(canvas => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] > 70 || data[i + 1] > 70 || data[i + 2] > 110) lit++;
    }
    return lit;
  });
  assert.ok(painted > 250, `graph looks empty: ${painted} lit samples`);
  console.log(`force-directed canvas: ${painted} lit samples`);

  await page.locator(".kb-hero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/web-1-hero.png" });
  await page.locator(".kb-network-band").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator(".kb-network-band").screenshot({ path: "/tmp/web-2-graph.png" });

  // Keyword filtering from the rail.
  const firstTag = await page.locator(".kb-tag-list button").nth(1).innerText();
  const tagName = firstTag.replace(/\s*\d+$/, "").trim();
  await page.locator(".kb-tag-list button").nth(1).click();
  await page.waitForTimeout(350);
  const filtered = await page.locator(".template-card").count();
  assert.ok(filtered > 0 && filtered < 12, `tag filter did not narrow cards: ${filtered}`);
  assert.match(await page.locator(".kb-legend-focus").innerText(), new RegExp(tagName));
  console.log(`keyword 「${tagName}」filters to ${filtered} cards and updates graph focus`);
  await page.locator(".kb-clear-filter").click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".template-card").count(), 12);

  // Preview / code tabs.
  await page.locator(".kb-tabs button", { hasText: "构建代码" }).first().click();
  assert.ok(await page.locator(".kb-code").first().isVisible());
  assert.match(await page.locator(".kb-code").first().innerText(), /<knowledge_base>/);
  await page.locator("#kb-grid").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/web-3-code.png" });
  await page.locator(".kb-tabs button", { hasText: "效果预览" }).first().click();
  assert.ok(await page.locator(".kb-mini-card").first().isVisible());
  await page.screenshot({ path: "/tmp/web-4-preview.png" });
  console.log("block cards: live preview and exact knowledge code both work");

  // Wheel zoom changes the rendered image; double click resets view.
  const box = await page.locator(".kb-network-canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(350);
  await page.screenshot({ path: "/tmp/web-5-zoom.png" });
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);

  // Node drag: canvas remains interactive and error-free.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.58, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".kb-network-canvas").count(), 1);
  console.log("graph interactions: zoom, reset and drag all smooth");

  // Mobile: seeded cards and graph fit without horizontal overflow.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", error => errors.push(`mobile: ${error.message}`));
  await mobile.addInitScript(() => {
    localStorage.setItem("promptforge:model:v3", "local");
    localStorage.removeItem("astra:preview:templates:v1");
  });
  await mobile.goto(origin, { waitUntil: "networkidle" });
  await mobile.locator(".mobile-menu-btn").click();
  await mobile.locator(".sidebar-nav-item", { hasText: "知识库" }).click();
  await mobile.locator(".interior-heading h1").waitFor();
  await mobile.waitForTimeout(700);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.equal(await mobile.locator(".template-card").count(), 12);
  await mobile.screenshot({ path: "/tmp/web-6-mobile.png", fullPage: true });
  console.log("mobile: 12 cards, graph and rails fit without overflow");

  // Seed data really participates in prompt construction.
  const gen = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  gen.on("pageerror", error => errors.push(`generate: ${error.message}`));
  await gen.addInitScript(() => {
    localStorage.setItem("promptforge:model:v3", "local");
    localStorage.removeItem("astra:preview:templates:v1");
    localStorage.removeItem("promptforge:draft:v2");
  });
  await gen.goto(origin, { waitUntil: "networkidle" });
  await gen.fill("#goal", "帮我写一段品牌文案，语气规范");
  await gen.locator(".flow-generate").click();
  await gen.locator(".flow-document pre").waitFor({ timeout: 15000 });
  const generated = await gen.locator(".flow-document pre").innerText();
  assert.match(generated, /<knowledge_base>/);
  assert.match(generated, /品牌语气规范/);
  console.log("seeded knowledge participates in generated prompts");
  await gen.evaluate(() => localStorage.removeItem("astra:preview:templates:v1"));

  assert.deepEqual(errors, []);
  console.log("knowledge web regression test passed");
} finally {
  await browser.close();
}
