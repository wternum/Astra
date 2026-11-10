import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARENA_REQUIRED_HEADINGS, arenaOfflineSpec, arenaSpecMessages, firstTurnFeatures, namedTech, normalizeArenaSpec,
  renderArenaPrompt, sandboxRules, type ArenaSpec,
} from "../src/ai/arena";
import { ARENA_CASES, pickArenaCase } from "../src/ai/arena-cases";
import { enforceArenaSpec, evaluateArenaPrompt, finalizeArenaSpec } from "../src/ai/arena-quality";
import { salvageArray } from "../src/ai/json";
import { selectRelevantKnowledge } from "../src/lib/knowledge";
import { SEED_KNOWLEDGE } from "../src/lib/knowledge-seed";

const ARENA_PROMPTS = [
  "做一个贪吃蛇小游戏",
  "做一个番茄钟应用",
  "做一个 Markdown 编辑器，支持暗色模式",
  "用 three.js 做一个 3D 太阳系模拟",
  "复刻一个 Spotify 播放器界面",
  "做一个可以拖拽的看板应用",
  "Build a markdown editor with dark mode",
  "Make a playable Tetris game",
  "Create a 3D solar system simulation",
  "Clone the Airbnb homepage",
];

const failing = (quality: { checks: { id: string; passed: boolean }[] }) => quality.checks.filter(check => !check.passed).map(check => check.id);

function caseSpec(index: number): ArenaSpec {
  const item = ARENA_CASES[index];
  const spec = normalizeArenaSpec({ kind: item.kind, ...item.spec }, item.input);
  assert.ok(spec, item.id);
  return spec;
}

describe("Arena few-shot examples", () => {
  for (const [index, item] of ARENA_CASES.entries()) {
    it(`${item.id} passes the Arena gate as written`, () => {
      const spec = caseSpec(index);
      assert.equal(spec.kind, item.kind);
      const quality = evaluateArenaPrompt(renderArenaPrompt(spec), item.input, spec);
      assert.equal(quality.ok, true, `${item.id}: ${quality.issues.join(" | ")}`);
      assert.deepEqual(failing(quality).filter(id => id !== "arena-original"), []);
      const full = evaluateArenaPrompt(renderArenaPrompt(spec, { scope: "full" }), item.input, spec, { scope: "full" });
      assert.equal(full.ok, true, `${item.id} (full): ${full.issues.join(" | ")}`);
    });
    it(`${item.id} splits a core loop from a backlog`, () => {
      assert.ok(item.spec.features.length >= 3 && item.spec.features.length <= 5, item.id);
      assert.ok(item.spec.backlog.length >= 2, item.id);
    });
  }
  it("covers seven Arena build kinds in both languages", () => {
    for (const language of ["zh", "en"] as const) {
      const kinds = ARENA_CASES.filter(item => item.language === language).map(item => item.kind).sort();
      assert.deepEqual(kinds, ["clone", "game", "landing", "product-ui", "storefront", "tool", "visual"]);
    }
  });
  it("picks one example in the request language and falls back by kind", () => {
    assert.equal(pickArenaCase("game", "zh")?.id, "arena-game-zh");
    assert.equal(pickArenaCase("portfolio", "en")?.id, "arena-landing-en");
    assert.equal(pickArenaCase("component", "zh")?.id, "arena-tool-zh");
    const messages = arenaSpecMessages("做一个贪吃蛇小游戏");
    assert.match(messages[1].content, /打砖块/);
    assert.doesNotMatch(messages[1].content, /批量改照片名/);
    assert.equal((messages[1].content.match(/<example>/g) || []).length, 1);
  });
});

describe("Arena offline spec", () => {
  for (const text of [...ARENA_PROMPTS, "给一款记账 App 做一个落地页", "做一个电商运营数据看板", "Create an online store for specialty coffee beans", "给摄影师做一个作品集"]) {
    it(`builds a passing prompt offline for ${text}`, () => {
      const { prompt, quality, spec } = finalizeArenaSpec(arenaOfflineSpec(text), text);
      assert.equal(quality.ok, true, `${text}: ${quality.issues.join(" | ")}`);
      for (const heading of ARENA_REQUIRED_HEADINGS(spec.language)) assert.match(prompt, new RegExp(`^## ${heading}$`, "m"));
      assert.doesNotMatch(prompt, /<user_request>|默认假设|输出契约/);
    });
  }
  it("turns the user's own feature words into concrete features", () => {
    const spec = arenaOfflineSpec("做一个 Markdown 编辑器，支持暗色模式");
    assert.equal(spec.kind, "tool");
    assert.ok(spec.features.some(item => item.includes("Markdown 实时渲染")));
    assert.ok(spec.features.some(item => item.includes("明暗主题")));
    const english = arenaOfflineSpec("Build a markdown editor with dark mode");
    assert.equal(english.language, "en");
    assert.ok(english.features.some(item => /light\/dark/.test(item)));
  });
  it("keeps explicit constraints and named libraries", () => {
    const text = "用 three.js 做一个 3D 太阳系模拟，不要自动播放音乐";
    const { prompt, quality } = finalizeArenaSpec(arenaOfflineSpec(text), text);
    assert.equal(quality.ok, true, quality.issues.join(" | "));
    assert.match(prompt, /必须遵守：「不要自动播放音乐」/);
    assert.match(prompt, /按需求使用 three\.js/);
  });
  it("never injects starter notes into Arena prompts", () => {
    for (const text of ARENA_PROMPTS) assert.deepEqual(selectRelevantKnowledge(text, SEED_KNOWLEDGE, { target: "arena" }), [], text);
  });
});

describe("Arena spec parsing", () => {
  it("recovers from fences, raw newlines and numbered strings", () => {
    const raw = { kind: "game", summary: "霓虹贪吃蛇", features: "1. 方向键控制蛇移动\n2. 吃到食物 +10 分\n3. 每 50 分提速 10%\n4. 空格暂停\n5. 最高分存 localStorage", visual: { palette: "背景 #0B0F1A、蛇 #22D3EE" } };
    const spec = normalizeArenaSpec(raw, "做一个贪吃蛇小游戏");
    assert.ok(spec);
    assert.equal(spec.features[0], "方向键控制蛇移动");
    assert.equal(spec.features.length, 5);
    assert.match(spec.visual.palette, /#0B0F1A/);
  });
  it("salvages complete items from a truncated reply", () => {
    const truncated = '{"kind":"tool","summary":"番茄钟","features":["25 分钟专注计时","开始 / 暂停 / 重置","任务清单增删","每周统计柱状图","通知提醒';
    assert.deepEqual(salvageArray(truncated, "features"), ["25 分钟专注计时", "开始 / 暂停 / 重置", "任务清单增删", "每周统计柱状图"]);
    const spec = normalizeArenaSpec(null, "做一个番茄钟应用", { rawText: truncated });
    assert.ok(spec);
    assert.equal(spec.features[0], "25 分钟专注计时");
    assert.ok(spec.features.length >= 3);
  });
  it("drops wrong-language and placeholder items, then refills from defaults", () => {
    const spec = normalizeArenaSpec({ features: ["Arrow keys move the snake", "吃到食物 +10 分", "TODO: power-ups", "【待补充】"] }, "做一个贪吃蛇小游戏");
    assert.ok(spec);
    assert.ok(spec.features.every(item => !/Arrow keys|TODO|待补充/.test(item)));
    assert.ok(spec.features.includes("吃到食物 +10 分"));
    assert.ok(spec.features.length >= 3);
    const english = normalizeArenaSpec({ features: ["方向键控制", "Arrow keys steer the ship"] }, "Make a playable space shooter game");
    assert.ok(english && english.features.every(item => !/[㐀-鿿]/.test(item)));
  });
  it("returns null when nothing usable came back", () => {
    assert.equal(normalizeArenaSpec(null, "做一个番茄钟应用", { rawText: "抱歉，我无法完成" }), null);
  });
  it("trusts explicit routing over the model's kind", () => {
    assert.equal(normalizeArenaSpec({ kind: "landing", features: ["a"] }, "做一个贪吃蛇小游戏")?.kind, "game");
    assert.equal(normalizeArenaSpec({ kind: "visual", features: ["a"] }, "做个能记录喝水的小东西")?.kind, "visual");
  });
});

describe("Arena rendering", () => {
  it("varies only the environment line by stack and honors a named framework", () => {
    assert.match(sandboxRules("zh", "react", [])[0], /多文件 React 项目/);
    assert.match(sandboxRules("zh", "html", [])[0], /单个 HTML 文件/);
    assert.match(sandboxRules("en", "neutral", [])[0], /stack the platform provides/);
    assert.match(sandboxRules("zh", "react", ["Vue"])[0], /用户指定的 Vue/);
    assert.deepEqual(namedTech("用 React 和 three.js 做，配合 GSAP 动画"), ["React", "three.js", "GSAP"]);
  });
  it("renders English headings and the content policy for clones", () => {
    const text = "Clone the Airbnb homepage";
    const prompt = renderArenaPrompt(arenaOfflineSpec(text));
    assert.match(prompt, /^## Must-work features$/m);
    assert.match(prompt, /text wordmark instead of the official logo/);
    assert.doesNotMatch(prompt, /[㐀-鿿]/);
  });
  it("lists only the core loop in a core first turn and the backlog in a full one", () => {
    const spec = caseSpec(0);
    const core = renderArenaPrompt(spec);
    const full = renderArenaPrompt(spec, { scope: "full" });
    assert.match(core, /本轮先把核心闭环做扎实/);
    assert.doesNotMatch(core, /连续击碎 5 块/);
    assert.match(full, /连续击碎 5 块/);
    assert.doesNotMatch(full, /本轮先把核心闭环做扎实/);
    assert.equal(firstTurnFeatures(spec, "full").length, Math.min(8, spec.features.length + spec.backlog.length));
  });
  it("moves features beyond the core loop into the backlog and keeps legacy follow-ups", () => {
    const spec = normalizeArenaSpec({ features: ["1 关", "2 分", "3 秒暂停", "4 条命", "5 种道具", "6 个关卡", "7 种皮肤"], followUps: ["加入 Boss"] }, "做一个贪吃蛇小游戏");
    assert.ok(spec);
    assert.deepEqual(spec.features, ["1 关", "2 分", "3 秒暂停", "4 条命", "5 种道具"]);
    assert.deepEqual(spec.backlog.slice(0, 3), ["6 个关卡", "7 种皮肤", "加入 Boss"]);
  });
  it("keeps a backlog for offline specs", () => {
    const spec = arenaOfflineSpec("做一个贪吃蛇小游戏");
    assert.ok(spec.features.length >= 3 && spec.features.length <= 5);
    assert.ok(spec.backlog.length >= 2);
  });
});

describe("Arena quality gate", () => {
  const spec = caseSpec(0);
  const input = ARENA_CASES[0].input;
  const good = renderArenaPrompt(spec);
  const mutate = (from: RegExp, to: string) => good.replace(from, to);
  it("flags each kind of damage with its own check", () => {
    assert.ok(failing(evaluateArenaPrompt(mutate(/#[0-9A-F]{6}/gi, "暗色"), input, spec)).includes("arena-visual"));
    assert.ok(failing(evaluateArenaPrompt(`${good}\n\n请先回答我的问题再开始。`, input, spec)).includes("arena-meta"));
    assert.ok(failing(evaluateArenaPrompt(`${good}\n- 运行命令：npm start`, input, spec)).includes("arena-meta"));
    assert.ok(failing(evaluateArenaPrompt(good.replace("## 技术要求", "- 品牌故事：【待补充】\n\n## 技术要求"), input, spec)).includes("arena-content"));
    assert.ok(failing(evaluateArenaPrompt(good.replace(/## 技术要求[\s\S]*?(?=## 完成标准)/, ""), input, spec)).includes("arena-structure"));
  });
  it("repairs a drifted or thin spec in code", () => {
    const thin: ArenaSpec = { ...arenaOfflineSpec("做一个贪吃蛇小游戏"), features: ["好玩"], states: [], acceptance: ["能玩"], visual: { style: "好看", palette: "暗色", type: "", layout: "", signature: "", motion: "" }, summary: "一款太空射击游戏", coreLoop: "射击敌人" };
    const before = evaluateArenaPrompt(renderArenaPrompt(thin), "做一个贪吃蛇小游戏", thin);
    assert.ok(["arena-features", "arena-visual", "arena-done"].every(id => failing(before).includes(id)));
    const { spec: fixed, quality, prompt, fixes } = finalizeArenaSpec(thin, "做一个贪吃蛇小游戏");
    assert.equal(quality.ok, true, quality.issues.join(" | "));
    assert.ok(fixes.length >= 3);
    assert.match(fixed.visual.palette, /#[0-9A-F]{6}/i);
    assert.match(prompt, /需求原话：「做一个贪吃蛇小游戏」/);
  });
  it("requires a named library in the technical requirements", () => {
    const text = "用 three.js 做一个 3D 太阳系模拟";
    const without = { ...arenaOfflineSpec(text), tech: [] };
    assert.ok(failing(evaluateArenaPrompt(renderArenaPrompt(without), text, without)).includes("arena-tech"));
    assert.deepEqual(enforceArenaSpec(without, text, ["arena-tech"]).spec.tech, ["three.js"]);
  });
  it("re-checks a hand-edited prompt from its text", () => {
    const edited = good.replace(/## 完成标准[\s\S]*$/, "## 完成标准\n交付前逐项自查并修复：\n1. 能玩");
    assert.ok(failing(evaluateArenaPrompt(edited, input, spec)).includes("arena-done"));
  });
});
