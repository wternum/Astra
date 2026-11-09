#!/usr/bin/env node
/**
 * ASTRA local AI proxy (zero dependencies, Node 18+).
 *
 * Why: the browser calls AI endpoints directly. Two cases need a relay:
 *   1. Pollinations' free tier rejects requests whose Origin is localhost (Turnstile).
 *   2. Some custom OpenAI-compatible providers do not send CORS headers.
 * The proxy forwards the request server-side (without a browser Origin) and adds CORS.
 *
 *   GET  /health            -> { ok: true }
 *   POST /forward           -> body { url, method?, headers?, body? }
 *
 * Usage: node server/ai-proxy.mjs   (PORT env, default 8787)
 */
import http from "node:http";

const PORT = Number(process.env.AI_PROXY_PORT || process.env.PORT || 8787);
const HOST = process.env.AI_PROXY_HOST || "0.0.0.0";
const MAX_BODY = 2 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key, Api-Key",
  "Access-Control-Expose-Headers": "Retry-After, X-Astra-Relay-Error",
};

const ALLOWED_HEADERS = new Set([
  "content-type", "authorization", "accept", "x-api-key", "api-key",
  "openai-organization", "openai-project", "anthropic-version",
]);

function send(res, status, payload, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...cors, ...extra });
  res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
  if (req.method === "GET" && req.url === "/health") { send(res, 200, { ok: true, service: "astra-ai-proxy" }); return; }
  if (req.method !== "POST" || req.url !== "/forward") { send(res, 404, { error: "not found" }); return; }

  try {
    const { url, method = "POST", headers = {}, body } = JSON.parse(await readBody(req) || "{}");
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      send(res, 400, { error: "invalid url" }, { "X-Astra-Relay-Error": "1" });
      return;
    }
    const safeHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (ALLOWED_HEADERS.has(key.toLowerCase()) && typeof value === "string") safeHeaders[key] = value;
    }
    const upstream = await fetch(url, {
      method: method === "GET" ? "GET" : "POST",
      headers: safeHeaders,
      body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await upstream.text();
    const retryAfter = upstream.headers.get("retry-after");
    send(res, upstream.status, text, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    });
  } catch (error) {
    send(res, 502, { error: `proxy error: ${error?.message || error}` }, { "X-Astra-Relay-Error": "1" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[astra-ai-proxy] listening on http://${HOST}:${PORT}`);
});
