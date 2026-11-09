import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// Custom endpoints only support HTTPS public DNS hosts. Reject IP literals and
// private DNS answers, then pin the checked IPv4 address for the actual socket.
export function customUrls(input: unknown) {
  if (typeof input !== "string" || input.trim().length < 9 || input.length > 500) throw new Error("请输入有效的公网 HTTPS API 地址");
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("URL 格式无效，请输入 https:// 开头的地址"); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port && url.port !== "443") throw new Error("仅支持使用标准 443 端口的 HTTPS 公网 API 地址");
  if (url.username || url.password || url.search || url.hash) throw new Error("URL 不能包含账号、密码、查询参数或片段");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".test") || !hostname.includes(".") || isIP(hostname)) throw new Error("不支持本机、IP 地址或内网主机，请使用公网 HTTPS 域名");
  if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.length > 253 || hostname.split(".").some(part => !part || part.length > 63 || part.startsWith("-") || part.endsWith("-"))) throw new Error("域名格式不正确");
  const path = url.pathname.replace(/\/+$/, "");
  let base: string;
  if (path.endsWith("/chat/completions")) base = path.slice(0, -"/chat/completions".length);
  else if (path.endsWith("/models")) base = path.slice(0, -"/models".length);
  else base = path && path !== "/" ? path : "/v1";
  if (!base || base === "/") base = "/v1";
  if (base.includes("..") || base.includes("//") || /%2f|%5c/i.test(base)) throw new Error("不支持该路径格式");
  const origin = url.origin;
  return { hostname, baseUrl: `${origin}${base}`, chatUrl: `${origin}${base}/chat/completions`, modelsUrl: `${origin}${base}/models` };
}

function isPublicV4(ip: string) {
  const [a, b, c] = ip.split(".").map(Number);
  if (a <= 0 || a >= 224 || [10, 127, 169].includes(a)) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && [0, 168, 88].includes(b)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export async function customRequest(baseUrl: unknown, path: "models" | "chat", init: { method: "GET" | "POST"; key?: string; body?: string; timeout?: number }) {
  const urls = customUrls(baseUrl);
  let answers: { address: string; family: number }[];
  try { answers = await lookup(urls.hostname, { family: 4, all: true, verbatim: true }); }
  catch { throw new Error("无法解析该公网域名；请检查域名是否正确以及是否支持 IPv4"); }
  if (!answers.length || answers.some(answer => !isPublicV4(answer.address))) throw new Error("域名解析到内网或保留地址，已阻止连接");
  const pinned = answers[0].address;
  const dispatcher = new Agent({ connect: { lookup: (host, opts, cb) => {
    if (host.toLowerCase() !== urls.hostname) { cb(new Error("Unexpected host"), "", 4); return; }
    if (opts.all) cb(null, [{ address: pinned, family: 4 }]);
    else cb(null, pinned, 4);
  } }, connections: 1 });
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.key) headers.Authorization = `Bearer ${init.key}`;
    if (init.body) headers["Content-Type"] = "application/json";
    const response = await undiciFetch(path === "models" ? urls.modelsUrl : urls.chatUrl, {
      method: init.method, headers, body: init.body, dispatcher, redirect: "error",
      signal: AbortSignal.timeout(init.timeout ?? 20_000),
    });
    const length = Number(response.headers.get("content-length"));
    if (length > 2_000_000) throw new Error("服务商返回内容过大，已停止读取");
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("服务商返回内容过大，已停止读取");
    return { status: response.status, text };
  } catch (error) {
    if (error instanceof Error && /\b(URL|地址|域名|内容过大|Unexpected host)\b/.test(error.message)) throw error;
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("连接超时，请检查服务商地址或稍后重试");
    throw new Error("无法连接此 API；请检查地址、证书和服务商的接口兼容性");
  } finally { await dispatcher.close(); }
}
