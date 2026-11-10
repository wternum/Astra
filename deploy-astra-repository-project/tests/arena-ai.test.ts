import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeNeed, buildArenaRound, optimizeWithAi } from "../src/ai/engine";
import { ARENA_CASES } from "../src/ai/arena-cases";
import { ARENA_REQUIRED_HEADINGS, normalizeArenaSpec } from "../src/ai/arena";

const custom = { provider: "custom" as const, model: "test-model", baseUrl: "https://example.test/v1" };
const free = { provider: "pollinations" as const, model: "openai-fast" };

type Request = { messages: { role: string; content: string }[] };

function mockFetch(replies: string[]) {
  const requests: Request[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body || "{}")) as Request);
    const content = replies[Math.min(requests.length - 1, replies.length - 1)];
    return new Response(JSON.stringify({ choices: [{ message: { content } }], model: "test-model" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  return { requests, restore: () => { globalThis.fetch = original; } };
}

const SHOOTER = "做一个飞机大战小游戏";
const shooterSpec = JSON.stringify({
  kind: "game", title: "星火战机",
  summary: "一款竖版飞机大战网页游戏「星火战机」，三种敌机、Boss 关和火力升级，打开即玩。",
  coreLoop: "操控战机自动射击，躲避弹幕击落敌机，收集道具升级火力，撑过每 5 波出现的 Boss。",
  features: ["战机跟随鼠标或手指移动，每 0.2 秒自动发射子弹", "3 种敌机：直线、蛇形、重甲（3 发击落）", "每 5 波出现 Boss，顶部显示血条", "道具：双发、护盾、清屏炸弹，持续 8 秒", "3 条命，被击中后 1.5 秒无敌闪烁", "最高分存 localStorage"],
  interactions: ["击中敌机白闪 80ms 并爆出粒子", "被击中时屏幕震动 250ms", "P 键或按钮暂停"],
  states: ["开始页：操作说明与开始按钮", "进行中：分数、波次、生命", "暂停：遮罩与继续", "结束：结算卡与再来一局"],
  visual: { style: "复古像素星空", palette: "背景 #05060F、战机 #38BDF8、敌机 #F87171、道具 #FBBF24、文字 #E2E8F0", type: "像素标题字，分数 24px 等宽数字", layout: "9:16 竖版游戏区居中，手机全屏", signature: "Boss 出场时的警报红光扫屏", motion: "爆炸 300ms、波次横幅滑入 400ms" },
  content: ["每波 1 句自拟的波次名，结算 3 条随机评语"],
  constraints: [],
  acceptance: ["鼠标、键盘、触屏都能完整游玩", "道具与 Boss 按描述生效", "暂停、结束、重开正确切换，最高分刷新后仍在", "375px 与 1440px 宽度下可玩，控制台无报错"],
  followUps: ["加入双人模式：WASD 与方向键分别控制两架战机"],
});
/** A lazy reply that just repeats the few-shot example's spec. */
const copiedSpec = JSON.stringify({ kind: "game", ...ARENA_CASES.find(item => item.id === "arena-game-zh")!.spec });

describe("Arena AI flow", () => {
  it("builds the prompt from a single spec call", async () => {
    const mock = mockFetch([shooterSpec]);
    try {
      const output = await optimizeWithAi(SHOOTER, custom, { target: "arena" });
      assert.equal(mock.requests.length, 1);
      const [system, user] = mock.requests[0].messages;
      assert.match(system.content, /Arena Code 对战/);
      assert.match(user.content, /<example>[\s\S]*打砖块/);
      assert.match(user.content, /<user_input>\n做一个飞机大战小游戏\n<\/user_input>/);
      for (const heading of ARENA_REQUIRED_HEADINGS("zh")) assert.match(output.optimized, new RegExp(`^## ${heading}$`, "m"));
      assert.match(output.optimized, /每 0\.2 秒自动发射子弹/);
      assert.match(output.optimized, /多文件 React 项目/);
      assert.equal(output.quality.ok, true, output.quality.issues.join(" | "));
      assert.equal(output.repairAttempts, 0);
      assert.equal(output.analysis.target, "arena");
      assert.equal(output.analysis.arena?.origin, "ai");
      assert.equal(output.cases[0].id, "arena-game-zh");
      assert.equal(output.arenaScope, "core");
      // 6 listed features: 5 core, the sixth plus the old follow-up idea go to the backlog.
      assert.equal(output.analysis.arena?.features.length, 5);
      assert.ok(output.analysis.arena?.backlog.some(item => /双人模式/.test(item)));
      assert.match(output.optimized, /本轮先把核心闭环做扎实/);
    } finally { mock.restore(); }
  });

  it("reuses the judged spec instead of calling the model again", async () => {
    const mock = mockFetch([shooterSpec]);
    try {
      const analysis = await analyzeNeed(SHOOTER, custom, { target: "arena" });
      assert.equal(analysis.arena?.kind, "game");
      const output = await optimizeWithAi(SHOOTER, custom, { target: "arena", analysis });
      assert.equal(mock.requests.length, 1);
      assert.equal(output.quality.ok, true);
    } finally { mock.restore(); }
  });

  it("falls back to the offline spec when the reply is unusable", async () => {
    const mock = mockFetch(["抱歉，我只能用文字描述这个游戏。"]);
    try {
      const output = await optimizeWithAi(SHOOTER, custom, { target: "arena" });
      assert.equal(mock.requests.length, 1);
      assert.equal(output.analysis.arena?.origin, "fallback");
      assert.match(output.changes[0], /离线规格/);
      assert.equal(output.quality.ok, true, output.quality.issues.join(" | "));
    } finally { mock.restore(); }
  });

  it("never spends a second free-tier call on repairs", async () => {
    const mock = mockFetch([copiedSpec]);
    try {
      const output = await optimizeWithAi(SHOOTER, free, { target: "arena" });
      assert.equal(mock.requests.length, 1);
      assert.equal(output.repairAttempts, 0);
      assert.equal(output.quality.checks.find(check => check.id === "arena-original")?.passed, false);
      // Drifted from the request, so the original sentence is quoted.
      assert.match(output.optimized, /需求原话：「做一个飞机大战小游戏」/);
    } finally { mock.restore(); }
  });

  it("rewrites a spec that copies the example once on custom endpoints", async () => {
    const mock = mockFetch([copiedSpec, shooterSpec]);
    try {
      const output = await optimizeWithAi(SHOOTER, custom, { target: "arena" });
      assert.equal(mock.requests.length, 2);
      assert.equal(output.repairAttempts, 1);
      assert.match(mock.requests[1].messages[1].content, /太像了/);
      assert.match(output.optimized, /星火战机/);
      assert.equal(output.quality.checks.find(check => check.id === "arena-original")?.passed, true);
    } finally { mock.restore(); }
  });

  it("revises with one call that carries the previous spec and the feedback", async () => {
    const mock = mockFetch([shooterSpec, shooterSpec]);
    try {
      const analysis = await analyzeNeed(SHOOTER, custom, { target: "arena" });
      await optimizeWithAi(SHOOTER, custom, { target: "arena", analysis, feedback: "加一个双人模式" });
      assert.equal(mock.requests.length, 2);
      assert.match(mock.requests[1].messages[1].content, /上一版规格：[\s\S]*星火战机[\s\S]*用户的修改意见：加一个双人模式/);
    } finally { mock.restore(); }
  });

  it("keeps an English request in English", async () => {
    const reply = JSON.stringify({
      kind: "tool", title: "Streakly", summary: "A habit tracker, \"Streakly\", that makes daily streaks satisfying to keep.",
      coreLoop: "Check off today's habits, watch streaks grow and review the month at a glance.",
      features: ["Add, edit and delete habits with an emoji and a color", "Tap a habit to check it off for today with a 200ms pop", "Streak counter and a 30-day heatmap per habit", "Weekly goal per habit (e.g. 5 of 7 days) with progress rings", "Everything persists in localStorage", "Export all data as JSON"],
      interactions: ["Keyboard: arrow keys move between habits, Space checks off"], states: ["Empty: suggest 3 starter habits", "All done today: celebration banner"],
      visual: { style: "Soft, friendly productivity", palette: "canvas #F7F7F2, cards #FFFFFF, text #1C1C1E, accent #16A34A", type: "Rounded sans, 32px streak numbers", layout: "Single column 640px max, cards stack on phones", signature: "Confetti burst when a streak hits 7", motion: "200ms check pop, 400ms ring fill" },
      content: ["8 sample habits with 60 days of history"], acceptance: ["Habits can be added, checked off and deleted", "Streaks and heatmaps update correctly", "Data survives a reload"], followUps: [],
    });
    const mock = mockFetch([reply]);
    try {
      const output = await optimizeWithAi("Build a habit tracker app", custom, { target: "arena" });
      assert.match(mock.requests[0].messages[0].content, /Arena Code battle/);
      for (const heading of ARENA_REQUIRED_HEADINGS("en")) assert.match(output.optimized, new RegExp(`^## ${heading}$`, "m"));
      assert.doesNotMatch(output.optimized, /[㐀-鿿]/);
      assert.equal(output.quality.ok, true, output.quality.issues.join(" | "));
      assert.ok((output.analysis.arena?.backlog.length || 0) >= 2);
    } finally { mock.restore(); }
  });

  it("leaves the general target unchanged", async () => {
    const mock = mockFetch([JSON.stringify({ category: "writing", domain: "文章写作" }), JSON.stringify({ optimized: "## 目标与交付\n写一篇文章。\n\n## 原始需求与已知信息\n<user_request>写篇关于远程办公的文章</user_request>\n\n## 执行步骤\n先确定观点。\n\n## 输出契约\n输出约 1200 字的文章，结构清楚。\n\n## 质量检查\n交付前检查；不要编造数据。", changes: [], rationale: "" })]);
    try {
      const output = await optimizeWithAi("写篇关于远程办公的文章", custom);
      assert.equal(output.analysis.target, undefined);
      assert.match(output.optimized, /^## 目标与交付/m);
      assert.equal(output.arenaScope, undefined);
    } finally { mock.restore(); }
  });
});

describe("Arena rounds with a model", () => {
  const spec = () => {
    const parsed = normalizeArenaSpec(JSON.parse(shooterSpec), SHOOTER);
    assert.ok(parsed);
    return parsed;
  };
  it("structures the user's notes with one call", async () => {
    const mock = mockFetch([JSON.stringify({ issues: [{ symptom: "右边暂停后无法继续", reproduce: "开始后按空格暂停，再按空格", expected: "从暂停处继续" }] })]);
    try {
      const { round, quality } = await buildArenaRound(spec(), [], { kind: "fix", observations: "右边暂停后无法继续" }, custom, { original: SHOOTER });
      assert.equal(mock.requests.length, 1);
      assert.match(mock.requests[0].messages[0].content, /下一条消息会同时发给两个模型/);
      assert.match(mock.requests[0].messages[1].content, /"observations": "右边暂停后无法继续"/);
      assert.equal(round.origin, "ai");
      assert.match(round.prompt, /若出现：暂停后无法继续 → 复现：开始后按空格暂停，再按空格 → 期望：从暂停处继续/);
      assert.equal(quality.ok, true, quality.issues.join(" | "));
    } finally { mock.restore(); }
  });
  it("falls back to the rules when the reply is unusable", async () => {
    const mock = mockFetch(["好的，我会修复这些问题。"]);
    try {
      const { round } = await buildArenaRound(spec(), [], { kind: "fix", observations: "左边暂停后无法继续" }, custom, { original: SHOOTER });
      assert.equal(mock.requests.length, 1);
      assert.equal(round.origin, "rules");
      assert.match(round.prompt, /若出现：暂停后无法继续/);
    } finally { mock.restore(); }
  });
  it("needs no call for an extend round without notes", async () => {
    const mock = mockFetch(["{}"]);
    try {
      const current = spec();
      const { round } = await buildArenaRound(current, [], { kind: "extend", observations: "" }, custom, { original: SHOOTER });
      assert.equal(mock.requests.length, 0);
      assert.deepEqual(round.added, current.backlog.slice(0, 2));
    } finally { mock.restore(); }
  });
});
