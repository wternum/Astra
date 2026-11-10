import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { installPreviewBackend } from "../src/preview/backend";

/** A browser-like global so the preview backend can serve /api/* in Node. */
function installFakeWindow() {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => data.has(key) ? data.get(key)! : null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  };
  Object.assign(globalThis, { window: { localStorage, location: { origin: "http://astra.test" }, fetch: globalThis.fetch.bind(globalThis) } });
  installPreviewBackend();
}

type Json = Record<string, any>;
async function api(path: string, method = "GET", body?: Json): Promise<{ status: number; data: Json }> {
  const fetcher = (globalThis as unknown as { window: { fetch: typeof fetch } }).window.fetch;
  const response = await fetcher(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}

describe("preview backend", () => {
  before(installFakeWindow);

  it("builds an Arena prompt offline through /api/optimize and records it in history", async () => {
    const { status, data } = await api("/api/optimize", "POST", { prompt: "做一个贪吃蛇小游戏", mode: "local", target: "arena", options: {} });
    assert.equal(status, 200);
    assert.equal(data.target, "arena");
    assert.equal(data.engine, "local");
    assert.match(data.optimized, /^## 必须可用的功能$/m);
    assert.equal(data.quality.ok, true, (data.quality.issues || []).join(" | "));
    assert.equal(data.arenaScope, "core");
    assert.ok(data.arenaSpec.backlog.length >= 2);
    assert.deepEqual(data.arenaRounds, []);
    assert.equal(data.analysis.arena.kind, "game");
    assert.deepEqual(data.knowledgeUsed, []);
    const history = await api("/api/history");
    assert.equal(history.data[0].settings.target, "arena");
    assert.equal(history.data[0].settings.arenaKind, "game");
  });

  it("generates the next rounds and stores them on the first turn's history record", async () => {
    const first = await api("/api/optimize", "POST", { prompt: "做一个打砖块小游戏", mode: "local", target: "arena", options: {} });
    const id = first.data.historyId;
    const fix = await api("/api/arena/round", "POST", { historyId: id, kind: "fix", observations: "左边暂停后无法继续；右边刷新后最高分丢失", mode: "local" });
    assert.equal(fix.status, 200);
    assert.equal(fix.data.round.index, 2);
    assert.deepEqual(fix.data.round.issues.map((issue: Json) => issue.symptom), ["暂停后无法继续", "刷新后最高分丢失"]);
    assert.equal(fix.data.quality.ok, true);
    const extend = await api("/api/arena/round", "POST", { historyId: id, kind: "extend", observations: "", mode: "local" });
    assert.equal(extend.data.round.index, 3);
    assert.deepEqual(extend.data.round.added, first.data.arenaSpec.backlog.slice(0, 2));
    const history = await api("/api/history");
    const record = history.data.find((item: Json) => item.id === id);
    assert.equal(record.settings.arenaRounds.length, 2);
    assert.equal((await api("/api/arena/round", "POST", { historyId: 99999, kind: "fix", observations: "", mode: "local" })).status, 404);
    assert.equal((await api("/api/arena/round", "POST", { historyId: id, kind: "nope", observations: "", mode: "local" })).status, 400);
  });

  it("keeps the general offline builder for the general target", async () => {
    const { data } = await api("/api/optimize", "POST", { prompt: "写篇关于远程办公的文章", mode: "local", target: "general", options: {} });
    assert.doesNotMatch(data.optimized, /必须可用的功能/);
    assert.equal(data.quality, null);
    assert.equal(data.target, undefined);
  });

  it("answers /api/understand offline with an Arena spec", async () => {
    const { data } = await api("/api/understand", "POST", { prompt: "Build a markdown editor with dark mode", target: "arena" });
    assert.equal(data.target, "arena");
    assert.equal(data.arena.kind, "tool");
    assert.equal(data.arena.language, "en");
  });

  it("counts only knowledge that will be injected for the target", async () => {
    const arena = await api("/api/knowledge?target=arena");
    const general = await api("/api/knowledge?target=general");
    assert.equal(arena.data.enabledCount, 0);
    assert.equal(general.data.enabledCount, 12);
  });

  it("turns an edited starter entry into the user's own knowledge", async () => {
    const { data } = await api("/api/knowledge");
    const seed = data.entries.find((item: Json) => item.source === "seed");
    const toggled = await api("/api/knowledge", "PATCH", { id: seed.id, enabled: false });
    assert.equal(toggled.data.source, "seed");
    const edited = await api("/api/knowledge", "PATCH", { id: seed.id, templateText: `${seed.templateText}\n我们团队的补充约定。` });
    assert.equal(edited.data.source, "user");
  });
});
