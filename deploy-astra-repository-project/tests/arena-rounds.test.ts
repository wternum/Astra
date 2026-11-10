import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arenaOfflineSpec, normalizeArenaSpec, type ArenaSpec } from "../src/ai/arena";
import { ARENA_CASES } from "../src/ai/arena-cases";
import {
  buildRoundOffline, evaluateRound, keptFeatures, parseObservations, remainingBacklog, roundFromModel,
  SIDE_WORDS, suggestNextKind, type ArenaRound,
} from "../src/ai/arena-rounds";

const game: ArenaSpec = (() => {
  const item = ARENA_CASES.find(entry => entry.id === "arena-game-zh")!;
  const spec = normalizeArenaSpec({ kind: item.kind, ...item.spec }, item.input);
  assert.ok(spec);
  return spec;
})();

describe("reading the user's notes", () => {
  it("turns mixed left / right notes into neutral issues and ignores praise", () => {
    const { issues } = parseObservations("左边暂停后无法继续；右边刷新后最高分丢失，两边手机上按钮都太小。左边的视觉很好看");
    assert.deepEqual(issues.map(issue => issue.symptom), ["暂停后无法继续", "刷新后最高分丢失", "手机上按钮都太小"]);
    for (const issue of issues) assert.doesNotMatch(issue.symptom, SIDE_WORDS);
  });
  it("splits English notes and strips which side they came from", () => {
    const { issues } = parseObservations("Left side: the pause button does nothing. The right side looks great. Both sides lose the score after a reload");
    assert.deepEqual(issues.map(issue => issue.symptom), ["the pause button does nothing", "lose the score after a reload"]);
  });
  it("treats wishes as new features", () => {
    const { issues, wishes } = parseObservations("想要加一个双人模式；右边的音效不错");
    assert.deepEqual(issues, []);
    assert.deepEqual(wishes, ["加一个双人模式"]);
  });
});

describe("round prompts", () => {
  it("writes a conditional fix round with a regression list", () => {
    const round = buildRoundOffline(game, [], { kind: "fix", observations: "左边暂停后无法继续；右边刷新后最高分丢失" }, "core");
    assert.equal(round.index, 2);
    assert.match(round.prompt, /^第 2 轮 · 修复问题。请在当前项目上直接修改/);
    assert.match(round.prompt, /1\. 若出现：暂停后无法继续 → 定位原因并修复/);
    assert.match(round.prompt, /^## 保持可用（改完逐项回归）$/m);
    for (const feature of game.features) assert.ok(round.prompt.includes(`- ${feature}`), feature);
    assert.doesNotMatch(round.prompt, SIDE_WORDS);
    assert.equal(evaluateRound(round.prompt, game).ok, true);
  });
  it("falls back to a full sweep when a fix round has no notes", () => {
    const round = buildRoundOffline(game, [], { kind: "fix", observations: "" }, "core");
    assert.match(round.prompt, /全面排查并修复现有功能中的问题/);
    assert.match(round.prompt, /修复控制台报错、无效 import/);
  });
  it("adds kind-specific checklists to polish and robustness rounds", () => {
    const polish = buildRoundOffline(game, [], { kind: "polish", observations: "" }, "core");
    assert.match(polish.prompt, /悬停、按下和键盘焦点状态/);
    assert.match(polish.prompt, /得分、升级、失败的反馈动画节奏统一/);
    const robust = buildRoundOffline(game, [], { kind: "robust", observations: "连续点两次开始会出现两个球" }, "core");
    assert.match(robust.prompt, /1\. 若出现：连续点两次开始会出现两个球/);
    assert.match(robust.prompt, /连续快速按方向键不会反向或卡死/);
    const tool = buildRoundOffline(arenaOfflineSpec("做一个番茄钟应用"), [], { kind: "robust", observations: "" }, "core");
    assert.match(tool.prompt, /1000 条数据时滚动与操作依然流畅/);
  });
  it("takes the backlog in order on extend rounds and keeps added features afterwards", () => {
    const first = buildRoundOffline(game, [], { kind: "extend", observations: "" }, "core");
    assert.deepEqual(first.added, game.backlog.slice(0, 2));
    assert.match(first.prompt, /^## 新增功能$/m);
    const rounds: ArenaRound[] = [first];
    assert.deepEqual(remainingBacklog(game, rounds, "core"), game.backlog.slice(2));
    const next = buildRoundOffline(game, rounds, { kind: "fix", observations: "" }, "core");
    assert.equal(next.index, 3);
    for (const feature of first.added) assert.ok(next.prompt.includes(`- ${feature}`), feature);
    const wished = buildRoundOffline(game, rounds, { kind: "extend", observations: "加一个双人模式" }, "core");
    assert.deepEqual(wished.added, ["加一个双人模式"]);
  });
  it("treats the backlog as built when the first turn was full", () => {
    assert.deepEqual(remainingBacklog(game, [], "full"), []);
    assert.ok(keptFeatures(game, [], "full").includes(game.backlog[0]));
  });
  it("suggests fix → polish → robust → extend", () => {
    const make = (kind: ArenaRound["kind"]) => buildRoundOffline(game, [], { kind, observations: "" }, "core");
    assert.equal(suggestNextKind(game, [], "core"), "fix");
    assert.equal(suggestNextKind(game, [make("fix")], "core"), "polish");
    assert.equal(suggestNextKind(game, [make("fix"), make("polish")], "core"), "robust");
    assert.equal(suggestNextKind(game, [make("fix"), make("polish"), make("robust")], "core"), "extend");
    assert.equal(suggestNextKind(game, [make("robust")], "full"), "polish");
  });
  it("keeps English projects in English", () => {
    const spec = arenaOfflineSpec("Build a markdown editor with dark mode");
    const round = buildRoundOffline(spec, [], { kind: "fix", observations: "Left side: the preview stops updating after a table" }, "core");
    assert.match(round.prompt, /^Turn 2 · Fix issues\. Change the current project directly/);
    assert.match(round.prompt, /If you see: the preview stops updating after a table/);
    assert.doesNotMatch(round.prompt, /[㐀-鿿]/);
    assert.equal(evaluateRound(round.prompt, spec).ok, true);
  });
  it("flags a prompt that singles out one side", () => {
    const quality = evaluateRound("第 2 轮 · 修复问题。不要重写整个项目。\n\n## 逐项检查\n1. 左边的暂停坏了\n\n## 保持可用（改完逐项回归）\n- 开始", game);
    assert.equal(quality.checks.find(check => check.id === "round-neutral")?.passed, false);
  });
});

describe("model-structured rounds", () => {
  it("renders issues with reproduce and expected steps, stripped of side words", () => {
    const round = roundFromModel({ issues: [{ symptom: "右边暂停后无法继续", reproduce: "开始游戏，按空格暂停，再按空格", expected: "从暂停处继续，计时与速度不变" }] }, game, [], { kind: "fix", observations: "右边暂停后无法继续" }, "core");
    assert.ok(round);
    assert.equal(round.origin, "ai");
    assert.match(round.prompt, /若出现：暂停后无法继续 → 复现：开始游戏，按空格暂停，再按空格 → 期望：从暂停处继续，计时与速度不变/);
  });
  it("returns null for an empty reply when the user did describe problems", () => {
    assert.equal(roundFromModel({ issues: [] }, game, [], { kind: "fix", observations: "暂停坏了" }, "core"), null);
    assert.equal(roundFromModel(null, game, [], { kind: "fix", observations: "暂停坏了" }, "core"), null);
  });
});
