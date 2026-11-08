/**
 * Same-origin relay for OpenAI-compatible endpoints.
 *
 * Browsers send an OPTIONS preflight whenever a custom Authorization header is
 * used. Many model providers do not return CORS headers on that preflight, so a
 * direct GET /models fails even though the endpoint itself is reachable.
 *
 * This Connect middleware is mounted by Vite dev and preview at /__astra/*.
 * It forwards the request from Node (no browser preflight) and never logs keys.
 */
const MAX_BODY = 2 * 1024 * 1024;
const ALLOWED_HEADERS = new Set([
  "content-type", "authorization", "accept", "x-api-key", "api-key",
  "openai-organization", "openai-project", "anthropic-version",
]);

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

function headers(res, status = 200) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function handle(req, res) {
  const path = (req.url || "").split("?")[0];
  if (req.method === "OPTIONS" && path.startsWith("/__astra/")) {
    headers(res, 204);
    res.end();
    return;
  }
  if (req.method === "GET" && path === "/__astra/health") {
    headers(res);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, service: "astra-same-origin-relay" }));
    return;
  }
  if (req.method !== "POST" || path !== "/__astra/forward") return false;

  try {
    const { url, method = "POST", headers: incoming = {}, body } = JSON.parse(await readBody(req) || "{}");
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      headers(res, 400);
      res.setHeader("X-Astra-Relay-Error", "1");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "invalid url" }));
      return true;
    }
    const upstreamHeaders = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (ALLOWED_HEADERS.has(key.toLowerCase()) && typeof value === "string") upstreamHeaders[key] = value;
    }
    const upstreamMethod = method === "GET" ? "GET" : "POST";
    const upstream = await fetch(url, {
      method: upstreamMethod,
      headers: upstreamHeaders,
      body: upstreamMethod === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await upstream.text();
    headers(res, upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);
    res.end(text);
  } catch (error) {
    headers(res, 502);
    res.setHeader("X-Astra-Relay-Error", "1");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: `relay error: ${error?.message || error}` }));
  }
  return true;
}

/** Vite plugin usable in both `vite` dev and `vite preview`. */
export function astraRelay() {
  const middleware = (req, res, next) => {
    if (!(req.url || "").startsWith("/__astra/")) { next(); return; }
    handle(req, res).then(done => { if (!done) next(); }).catch(next);
  };
  return {
    name: "astra-same-origin-relay",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
