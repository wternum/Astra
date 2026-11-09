/**
 * Reproduces a provider whose GET /v1/models works from Node but whose CORS
 * preflight rejects Authorization. Discovery and connection must use the
 * same-origin relay provided by vite.config.js.
 *
 * Prerequisite: ./start.sh dev (or ./start.sh preview).
 * Run: node tests/model-discovery.mjs
 */
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";

const origin = process.env.APP_URL || "http://127.0.0.1:5173";
let lastAuthorization = "";
let lastChatBody = "";

const upstream = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/v1/models") {
    lastAuthorization = String(req.headers.authorization || "");
    // No Access-Control-Allow-* headers: direct browser requests must fail.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "demo-large", name: "Demo Large" }, { id: "demo-mini" }] }));
    return;
  }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    lastAuthorization = String(req.headers.authorization || "");
    let body = "";
    for await (const chunk of req) body += chunk;
    lastChatBody = body;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ model: "demo-large", choices: [{ message: { role: "assistant", content: "可用" } }] }));
    return;
  }
  // Deliberately do not implement OPTIONS CORS preflight.
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
const port = upstream.address().port;
const baseUrl = `http://127.0.0.1:${port}/v1`;

const browser = await chromium.launch();
const errors = [];
try {
  const health = await fetch(`${origin}/__astra/health`).then(response => response.json());
  assert.equal(health.service, "astra-same-origin-relay");
  console.log("same-origin relay health: OK");

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".topbar-model").click();
  await page.locator(".model-access-tabs button", { hasText: "自定义接口" }).click();
  await page.fill("#custom-url", baseUrl);
  await page.fill("#model-key", "sk-synthetic-test-key");

  const direct = await page.evaluate(async url => {
    try {
      await fetch(`${url}/models`, { headers: { Authorization: "Bearer sk-synthetic-test-key" } });
      return "unexpectedly succeeded";
    } catch (error) {
      return error instanceof TypeError ? "blocked by CORS" : `failed: ${error.message}`;
    }
  }, baseUrl);
  assert.equal(direct, "blocked by CORS");
  console.log("direct browser request: blocked by provider CORS preflight");

  await page.locator(".detect-button").click();
  await page.locator(".model-status", { hasText: "已发现 2 个模型" }).waitFor({ timeout: 15000 });
  assert.equal(lastAuthorization, "Bearer sk-synthetic-test-key");
  assert.equal(await page.locator(".form-error").count(), 0);
  assert.equal(await page.locator("input[placeholder^='模型 ID']").inputValue(), "demo-large");
  console.log("model discovery: succeeded through same-origin relay with Authorization preserved");

  await page.locator(".model-submit").click();
  await page.locator("[role=dialog]").waitFor({ state: "detached", timeout: 15000 });
  assert.equal(lastAuthorization, "Bearer sk-synthetic-test-key");
  assert.match(lastChatBody, /demo-large/);
  console.log("model connection: chat/completions succeeded through the relay");

  assert.deepEqual(errors, []);
  console.log("model discovery regression test passed");
} finally {
  await browser.close();
  upstream.close();
}
