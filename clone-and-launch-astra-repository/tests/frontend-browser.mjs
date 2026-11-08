/**
 * Run with ./start.sh dev, then node tests/frontend-browser.mjs.
 * Set LIVE_AI=1 for an optional real free-model run (subject to provider limits).
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.APP_URL || "http://localhost:5173";
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", error => errors.push(error.message));

try {
  await page.addInitScript(() => localStorage.setItem("promptforge:model:v3", "local"));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator("#studio-composer").scrollIntoViewIfNeeded();
  assert.equal(await page.locator(".understanding-card, .prompt-pipeline, .launch-card").count(), 0);
  assert.equal(await page.locator(".flow-starters .quick-start").count(), 3);
  const composer = await page.locator(".flow-composer").boundingBox();
  const result = await page.locator(".flow-result").boundingBox();
  assert.ok(composer && result && composer.width > 800 && result.y > composer.y + composer.height && result.y - composer.y - composer.height < 50);
  console.log("empty: full-width input, three examples, output directly below, no side card");
  await page.locator(".flow-composer").screenshot({ path: "/tmp/astra-flow-empty.png" });

  const sentence = "我想要做一个漂亮的网站";
  await page.fill("#goal", sentence);
  assert.equal(await page.locator(".flow-starters").count(), 0);
  assert.match(await page.locator(".flow-empty").innerText(), /点击.*优化提示词/);
  console.log("typing: examples disappear and the output area remains in place");

  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).includes("/api/optimize")) await new Promise(resolve => setTimeout(resolve, 1600));
      return original(...args);
    };
  });
  await page.locator(".flow-generate").click();
  await page.waitForSelector(".flow-progress");
  assert.equal(await page.locator(".flow-document").count(), 0);
  assert.equal(await page.locator(".flow-progress-steps span").count(), 4);
  assert.match(await page.locator(".flow-progress").innerText(), /组织结构|生成提示词|检查可用性/);
  await page.locator(".flow-result").screenshot({ path: "/tmp/astra-flow-loading.png" });
  console.log("loading: animated progress and writing placeholders appear in the output area");

  await page.waitForSelector(".flow-document pre", { timeout: 15000 });
  const optimized = await page.locator(".flow-document pre").innerText();
  assert.ok(optimized.length > sentence.length);
  assert.ok(optimized.includes(sentence));
  assert.equal(await page.locator(".flow-progress").count(), 0);
  assert.ok(await page.locator(".flow-copy").isVisible());
  await page.locator(".flow-result").screenshot({ path: "/tmp/astra-flow-ready.png" });
  console.log("ready: usable prompt appears immediately below input");

  await page.getByRole("button", { name: "编辑", exact: true }).click();
  assert.ok(await page.getByRole("textbox", { name: "编辑优化后的提示词" }).isVisible());
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.locator(".flow-detail summary").first().click();
  assert.ok(await page.locator(".flow-revision input").first().isVisible());
  console.log("secondary actions: editing and follow-up refinement remain available");

  await page.fill("#goal", "");
  assert.equal(await page.locator(".flow-starters .quick-start").count(), 3);
  await page.locator(".flow-starters .quick-start").first().click();
  assert.notEqual(await page.inputValue("#goal"), "");
  assert.equal(await page.locator(".flow-starters").count(), 0);
  console.log("example: clicking one fills the input and removes the example row");

  await page.getByRole("button", { name: "手册" }).click();
  const references = await page.locator(".reference-item strong").allInnerTexts();
  for (const name of ["Recent", "Refero Styles", "Scrolltide"]) assert.ok(references.includes(name));
  console.log("guide: public design references remain available");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", error => errors.push(`mobile: ${error.message}`));
  await mobile.addInitScript(() => localStorage.setItem("promptforge:model:v3", "local"));
  await mobile.goto(origin, { waitUntil: "networkidle" });
  await mobile.fill("#goal", "给摄影师做一个安静的作品集");
  assert.equal(await mobile.locator(".flow-starters").count(), 0);
  await mobile.locator(".flow-generate").click();
  await mobile.waitForSelector(".flow-document pre", { timeout: 15000 });
  assert.ok((await mobile.locator(".flow-document pre").innerText()).length > 100);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await mobile.locator(".theme-mode-button").nth(1).click();
  assert.equal(await mobile.locator("html").getAttribute("data-theme"), "dark");
  await mobile.waitForTimeout(450);
  await mobile.screenshot({ path: "/tmp/astra-flow-mobile.png", fullPage: true });
  console.log("mobile: one-column result, dark mode and no horizontal overflow");

  if (process.env.LIVE_AI === "1") {
    const live = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    live.on("pageerror", error => errors.push(`live: ${error.message}`));
    await live.addInitScript(() => localStorage.setItem("promptforge:model:v3", JSON.stringify({ provider: "pollinations", model: "openai-fast" })));
    await live.goto(origin, { waitUntil: "networkidle" });
    await live.fill("#goal", "I want to make a beautiful website");
    await live.locator(".flow-generate").click();
    await live.waitForSelector(".flow-document pre", { timeout: 300000 });
    const output = await live.locator(".flow-document pre").innerText();
    assert.match(output, /## Goal and deliverable/);
    assert.match(output, /<user_request>I want to make a beautiful website<\/user_request>/);
    await live.locator(".flow-detail summary").nth(1).click();
    const failed = await live.locator(".flow-checks .fail").allInnerTexts();
    assert.deepEqual(failed, []);
    console.log(`live AI: ${output.length} characters, ${await live.locator(".flow-checks strong").innerText()}`);
    await live.screenshot({ path: "/tmp/astra-flow-live.png", fullPage: true });
  }

  assert.deepEqual(errors, []);
  console.log("browser smoke test passed without uncaught errors");
} finally {
  await browser.close();
}
