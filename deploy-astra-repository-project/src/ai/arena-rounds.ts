/**
 * Multi-turn rounds for an Arena Code battle.
 *
 * After the first turn the user keeps talking to both anonymous models to fix
 * bugs, polish details, harden the app and add features. Every follow-up message
 * reaches BOTH models, and each side has different bugs, so a round is a neutral,
 * conditional checklist ("if you see X, fix it") that is valid for either build,
 * plus a "keep working" regression list so a fix does not break what works.
 *
 * Rounds are rendered by code. The user's casual notes become issues either by
 * rules (offline) or by one model call that structures them; a bad reply falls
 * back to the rules.
 */
import type { ArenaLanguage, ArenaSpec } from "@/ai/arena";
import { firstTurnFeatures } from "@/ai/arena";
import type { ChatMessage } from "@/ai/client";
import type { FrontendKind } from "@/ai/frontend";
import type { PromptCheck, PromptQuality } from "@/ai/quality";
import type { ArenaScope } from "@/ai/targets";

export type RoundKind = "fix" | "polish" | "robust" | "extend";
export const ROUND_KINDS: readonly RoundKind[] = ["fix", "polish", "robust", "extend"];

export interface ArenaIssue {
  symptom: string;
  reproduce: string;
  expected: string;
}

export interface ArenaRound {
  /** Turn number in the Arena conversation; the first-turn prompt is turn 1. */
  index: number;
  kind: RoundKind;
  observations: string;
  issues: ArenaIssue[];
  /** Features added by this round (extend rounds). */
  added: string[];
  prompt: string;
  origin: "ai" | "rules";
  createdAt: string;
}

export interface RoundRequest {
  kind: RoundKind;
  /** What the user saw in either build, in their own words; sides may be mixed. */
  observations: string;
}

export const ROUND_LABELS: Record<RoundKind, Record<ArenaLanguage, string>> = {
  fix: { zh: "修复问题", en: "Fix issues" },
  polish: { zh: "细节打磨", en: "Polish details" },
  robust: { zh: "健壮性", en: "Harden" },
  extend: { zh: "加功能", en: "Add features" },
};

const MAX_ISSUES = 8;
const MAX_NEW_FEATURES = 3;

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------
type ChecklistKind = "game" | "tool" | "clone" | "visual" | "landing" | "product-ui" | "storefront" | "portfolio";
const CHECKLIST_KIND: Record<FrontendKind, ChecklistKind> = {
  game: "game", tool: "tool", clone: "clone", visual: "visual", landing: "landing", "product-ui": "product-ui",
  storefront: "storefront", portfolio: "portfolio", editorial: "landing", site: "landing", redesign: "landing", component: "tool",
};

const POLISH_COMMON: Record<ArenaLanguage, string[]> = {
  zh: [
    "同类元素使用统一的间距与字号，标题、正文、辅助文字层级清楚",
    "所有可点击元素都有悬停、按下和键盘焦点状态",
    "打开 / 关闭、加载 / 完成、增删等状态切换有 150–300ms 的过渡，不生硬跳变",
    "空状态、错误提示和按钮文案具体友好，不出现原始报错或占位文字",
    "375px 手机宽度下无横向滚动，触控目标不小于 44×44px",
    "深浅背景上的文字对比度足够、清晰可读",
  ],
  en: [
    "Similar elements share spacing and type sizes, with a clear heading / body / caption hierarchy",
    "Every clickable element has hover, pressed and keyboard-focus states",
    "Open / close, loading / done and add / remove changes animate over 150–300ms instead of jumping",
    "Empty states, error messages and button labels are specific and friendly, never raw errors or filler text",
    "No horizontal scrolling at 375px wide, and touch targets are at least 44×44px",
    "Text stays readable with sufficient contrast on both light and dark surfaces",
  ],
};

const POLISH_KIND: Record<ChecklistKind, Record<ArenaLanguage, string>> = {
  game: { zh: "得分、升级、失败的反馈动画节奏统一，画面不卡顿", en: "Feedback for scoring, level-ups and game over shares one rhythm, with no stutter" },
  tool: { zh: "列表、编辑区与工具栏对齐，长文本截断时有省略号和完整提示", en: "Lists, editor and toolbar align, and long text truncates with an ellipsis and a full-text hint" },
  clone: { zh: "间距、圆角、图标尺寸与参考产品的比例一致", en: "Spacing, corner radii and icon sizes match the reference's proportions" },
  visual: { zh: "标注与控制面板不遮挡主体，动画缓动自然", en: "Labels and controls never cover the subject, and easing feels natural" },
  landing: { zh: "首屏层级与留白清楚，区块之间的节奏一致", en: "The hero hierarchy and whitespace are clear, and sections share one rhythm" },
  "product-ui": { zh: "数字右对齐、单位与格式统一，图表配色与图例一致", en: "Numbers align right with consistent units and formats; chart colors match the legend" },
  storefront: { zh: "商品卡片高度一致，价格与按钮位置对齐", en: "Product cards share a height, with prices and buttons aligned" },
  portfolio: { zh: "作品图裁切比例统一，说明文字层级清晰", en: "Artwork crops share an aspect ratio and captions have a clear hierarchy" },
};

const ROBUST_COMMON: Record<ArenaLanguage, string[]> = {
  zh: [
    "刷新页面后状态正确恢复；localStorage 为空或数据损坏时回退到默认值而不报错",
    "快速连续点击、重复提交不会产生重复数据或错误状态",
    "计时器、事件监听和动画在重置或组件卸载时被清理，不会重复触发",
    "窗口缩放、旋转屏幕后布局与画布正确自适应",
    "控制台没有报错和警告（包括重复 key、未处理的 Promise）",
  ],
  en: [
    "State restores correctly after a reload; an empty or corrupted localStorage falls back to defaults without errors",
    "Rapid repeated clicks or submits never create duplicates or a broken state",
    "Timers, listeners and animations are cleaned up on reset or unmount and never fire twice",
    "Layouts and canvases adapt correctly after resizing or rotating the screen",
    "The console shows no errors or warnings (including duplicate keys and unhandled promises)",
  ],
};

const ROBUST_KIND: Record<ChecklistKind, Record<ArenaLanguage, string[]>> = {
  game: {
    zh: ["连续快速按方向键不会反向或卡死", "重新开始会彻底重置分数、速度、计时器和道具", "暂停时所有计时器与动画都停止，继续后不跳帧", "切走标签页时自动暂停"],
    en: ["Mashing direction keys never reverses into itself or freezes", "Restart fully resets score, speed, timers and power-ups", "Pausing stops every timer and animation, and resuming does not skip frames", "Switching tabs pauses automatically"],
  },
  tool: {
    zh: ["空输入、超长文本、特殊字符与 emoji 都能正确处理", "1000 条数据时滚动与操作依然流畅", "删除确认与撤销不会误删其他条目"],
    en: ["Empty input, very long text, special characters and emoji are all handled", "Scrolling and actions stay smooth with 1000 records", "Delete confirmation and undo never remove the wrong item"],
  },
  clone: {
    zh: ["导航切换与返回后状态正确", "快速连续切换视图不会错乱", "空列表与加载失败都有提示"],
    en: ["State is correct after navigating away and back", "Switching views rapidly never mixes up content", "Empty lists and failed loads both show a message"],
  },
  visual: {
    zh: ["参数取最小值、最大值时不崩溃、不卡死", "高分屏上画面清晰不模糊", "帧率过低时自动降低粒子数或特效"],
    en: ["Minimum and maximum parameter values never crash or freeze", "Rendering stays sharp on high-DPI screens", "Particle counts or effects drop automatically when the frame rate is low"],
  },
  landing: {
    zh: ["表单对空值、非法邮箱或手机号、超长输入给出提示", "锚点导航与移动端菜单在各宽度都可用", "提交中禁用按钮，防止重复提交"],
    en: ["The form flags empty values, invalid email or phone and overly long input", "Anchor navigation and the mobile menu work at every width", "The submit button is disabled while submitting"],
  },
  "product-ui": {
    zh: ["空数据、筛选无结果、极大 / 极小数字与负数都格式正确", "连续切换筛选不会闪回旧数据", "加载失败后可以重试并恢复"],
    en: ["Empty data, no-result filters, huge / tiny and negative numbers all format correctly", "Rapid filter changes never flash stale data", "A failed load can be retried and recovers"],
  },
  storefront: {
    zh: ["数量不能小于 1 或超过库存", "价格与总价计算无浮点误差", "刷新后购物车内容与数量正确"],
    en: ["Quantities cannot go below 1 or above stock", "Prices and totals have no floating-point errors", "The cart and its quantities are correct after a reload"],
  },
  portfolio: {
    zh: ["图片加载失败有降级显示", "详情弹层的键盘操作与关闭后的焦点返回正确", "筛选结果为空时有提示"],
    en: ["Failed images show a fallback", "Keyboard use in the detail overlay works and focus returns on close", "An empty filter result shows a message"],
  },
};

const SWEEP: Record<ArenaLanguage, string[]> = {
  zh: ["逐项实际操作下面「保持可用」里的每个功能，修好任何不可用、半成品或点了没反应的部分", "修复控制台报错、无效 import 和未使用的依赖", "确认每种状态（空、加载、错误、成功等适用项）都有清楚的界面反馈"],
  en: ["Actually exercise every feature under \"Keep working\" and fix anything that is broken, half-done or unresponsive", "Fix console errors, broken imports and unused dependencies", "Make sure every relevant state (empty, loading, error, success…) has clear on-screen feedback"],
};

// ---------------------------------------------------------------------------
// Neutral wording: one message reaches both models
// ---------------------------------------------------------------------------
/** Words that point at one side of the battle; a round prompt must not contain them. */
export const SIDE_WORDS = /左边|右边|左侧|右侧|左面|右面|两边|两侧|模型\s*[AB12一二]|[AB]\s*[边侧]|\bleft side\b|\bright side\b|\bboth sides\b|\bmodel\s*[AB12]\b|\bside\s*[AB12]\b/i;
const LEAD_SIDE = /^(?:(?:左边|右边|左侧|右侧|左面|右面|两边|两侧|双方|模型\s*[AB12一二]|[AB]\s*[边侧]|left(?: side)?|right(?: side)?|both(?: sides)?|model\s*[AB12]|side\s*[AB12])\s*(?:和|与|跟|and|&)?\s*)+(?:的|都|也|上|里)?\s*[:：,，]?\s*/i;

function neutral(text: string) {
  return text
    .replace(LEAD_SIDE, "")
    .replace(/(?:左边|右边|左侧|右侧|两边|两侧|模型\s*[AB12一二])(?:的|都|也)?/g, "")
    .replace(/\b(?:on )?(?:the )?(?:left|right) side'?s?\b|\bon both sides\b|\bmodel\s*[AB12]'?s?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[，,。.;；:：\s]+|[，,。.;；\s]+$/g, "")
    .trim();
}

const POSITIVE = /不错|还不错|没问题|挺好|很好|好看|漂亮|流畅|完美|no problem|not bad|looks? (?:good|great|nice)|works? (?:well|fine)|great|nice/gi;
const PROBLEM = /不|没|无法|不能|丢|报错|错误|崩|卡|太小|太大|太慢|太快|重叠|溢出|闪|空白|白屏|乱|失败|消失|遮挡|错位|看不清|难看|慢|bug|broken|doesn'?t|does not|not work|can'?t|cannot|error|crash|missing|lost|overlap|slow|blank|freez|lag|wrong|ugly|too (?:small|big|slow|fast)|stuck|jump/i;
const WISH = /想要|希望|加一个|加个|加入|增加|新增|再加|支持|能不能加|\badd\b|\bwant\b|\bwould like\b|\bsupport\b|\binclude\b/i;

const IS_POSITIVE = new RegExp(POSITIVE.source, "i");

/**
 * Rule-based reading of the user's notes. In fix / polish / robust rounds every
 * sentence that is not pure praise or a wish is a problem; in extend rounds every
 * sentence that is not a problem or praise is a wish.
 */
export function parseObservations(text: string, kind: RoundKind = "fix") {
  const sentences = text
    .split(/[；;。！!？?\n]+|\.(?=\s|$)|[，,](?=\s*(?:左边|右边|左侧|右侧|两边|两侧|模型|left|right|both|model))/i)
    .map(part => part.trim())
    .filter(Boolean);
  const issues: ArenaIssue[] = [];
  const wishes: string[] = [];
  for (const sentence of sentences) {
    const cleaned = neutral(sentence);
    if (cleaned.length < 2) continue;
    const problem = PROBLEM.test(cleaned.replace(POSITIVE, ""));
    const praise = !problem && IS_POSITIVE.test(cleaned);
    if (praise) continue;
    const wish = !problem && (WISH.test(cleaned) || kind === "extend");
    if (wish) wishes.push(cleaned.replace(/^(?:我)?(?:想要|希望|能不能)\s*/, ""));
    else issues.push({ symptom: cleaned, reproduce: "", expected: "" });
  }
  return { issues: issues.slice(0, MAX_ISSUES), wishes: wishes.slice(0, MAX_NEW_FEATURES) };
}

// ---------------------------------------------------------------------------
// Bookkeeping across rounds
// ---------------------------------------------------------------------------
/** Features the project should already have: the first turn plus everything added since. */
export function keptFeatures(spec: ArenaSpec, rounds: ArenaRound[], scope: ArenaScope) {
  return [...new Set([...firstTurnFeatures(spec, scope), ...rounds.flatMap(round => round.added)])];
}

/** Backlog items that no round has added yet (a full first turn already built them). */
export function remainingBacklog(spec: ArenaSpec, rounds: ArenaRound[], scope: ArenaScope) {
  if (scope === "full") return [];
  const added = new Set(rounds.flatMap(round => round.added));
  return spec.backlog.filter(item => !added.has(item));
}

export function suggestNextKind(spec: ArenaSpec, rounds: ArenaRound[], scope: ArenaScope): RoundKind {
  const last = rounds.at(-1)?.kind;
  const backlog = remainingBacklog(spec, rounds, scope).length > 0;
  if (!last || last === "extend") return "fix";
  if (last === "fix") return "polish";
  if (last === "polish") return "robust";
  return backlog ? "extend" : "polish";
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
interface RoundContent {
  issues: ArenaIssue[];
  newFeatures: { feature: string; acceptance: string }[];
}

const FOCUS: Record<RoundKind, Record<ArenaLanguage, string>> = {
  fix: { zh: "修复下面的问题，不新增功能、不改视觉风格。", en: "Fix the problems below. Do not add features or change the visual style." },
  polish: { zh: "打磨视觉与交互细节，不新增功能、不改变已有行为。", en: "Polish visual and interaction details. Do not add features or change existing behavior." },
  robust: { zh: "提升稳定性与边界情况处理，让应用经得起各种操作，不新增功能。", en: "Make the app robust under any use and handle edge cases. Do not add features." },
  extend: { zh: "加入下面的新功能，与现有风格保持一致，现有功能不能受影响。", en: "Add the new features below in the existing style without affecting what already works." },
};

function issueLine(issue: ArenaIssue, en: boolean) {
  const parts = [en ? `If you see: ${issue.symptom}` : `若出现：${issue.symptom}`];
  if (issue.reproduce) parts.push(en ? `Reproduce: ${issue.reproduce}` : `复现：${issue.reproduce}`);
  parts.push(issue.expected
    ? (en ? `Expected: ${issue.expected}` : `期望：${issue.expected}`)
    : (en ? "Find the cause, fix it, then repeat the same steps to confirm" : "定位原因并修复，修完按同样操作再验证一遍"));
  return parts.join(" → ");
}

export function renderRoundPrompt(spec: ArenaSpec, rounds: ArenaRound[], kind: RoundKind, content: RoundContent, scope: ArenaScope) {
  const en = spec.language === "en";
  const language = spec.language;
  const index = rounds.length + 2;
  const checklistKind = CHECKLIST_KIND[spec.kind];
  const lines: string[] = [];
  lines.push(en
    ? `Turn ${index} · ${ROUND_LABELS[kind].en}. Change the current project directly: keep the existing stack, file structure and visual style, and do not rewrite the whole project.`
    : `第 ${index} 轮 · ${ROUND_LABELS[kind].zh}。请在当前项目上直接修改，保留现有技术栈、文件结构和视觉风格，不要重写整个项目。`);

  const focus = kind === "fix" && !content.issues.length
    ? (en ? "Do a full pass over the existing features and fix whatever does not work. Do not add features." : "全面排查并修复现有功能中的问题，不新增功能。")
    : FOCUS[kind][language];
  lines.push(`## ${en ? "This turn only" : "本轮只做这些"}\n${focus}`);

  const checks: string[] = content.issues.map(issue => issueLine(issue, en));
  if (kind === "fix" && !content.issues.length) checks.push(...SWEEP[language]);
  if (kind === "polish") checks.push(...POLISH_COMMON[language], POLISH_KIND[checklistKind][language]);
  if (kind === "robust") checks.push(...ROBUST_KIND[checklistKind][language], ...ROBUST_COMMON[language]);
  if (checks.length) {
    lines.push(`## ${en ? "Check each item and fix it if needed" : "逐项检查，存在就修复"}\n${checks.map((item, i) => `${i + 1}. ${item}`).join("\n")}`);
  }
  if (content.newFeatures.length) {
    const doneText = en ? "Done when: " : "完成标准：";
    lines.push(`## ${en ? "New features" : "新增功能"}\n${content.newFeatures.map((item, i) => `${i + 1}. ${item.feature}${item.acceptance ? ` — ${doneText}${item.acceptance}` : ""}`).join("\n")}`);
  }
  const kept = keptFeatures(spec, rounds, scope);
  lines.push(`## ${en ? "Keep working (re-test after your changes)" : "保持可用（改完逐项回归）"}\n${kept.map(item => `- ${item}`).join("\n")}`);
  lines.push(`## ${en ? "When you finish" : "完成后"}\n${en
    ? "Re-check every item in this turn and under \"Keep working\", and make sure the console is free of errors. End with 3–5 short bullets: what you changed and any known remaining issues."
    : "逐项自查本轮清单和「保持可用」，确认控制台无报错；最后用 3–5 条说明改了什么、还有什么已知问题。"}`);
  return lines.join("\n\n");
}

// ---------------------------------------------------------------------------
// Deterministic checks for a round prompt
// ---------------------------------------------------------------------------
export function evaluateRound(prompt: string, spec: ArenaSpec): PromptQuality {
  const en = spec.language === "en";
  const checks: PromptCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail: string) => checks.push({ id, label, passed, detail });
  const items = (prompt.match(/^\d+\.\s/gm) || []).length;
  add("round-items", "有可执行的检查项", items >= 1, `${items} 条检查项或新增功能`);
  const keep = en ? /^## Keep working/m.test(prompt) : /^## 保持可用/m.test(prompt);
  add("round-regression", "回归清单", keep, keep ? "列出了改完要回归的功能" : "缺少「保持可用」回归清单");
  const scope = en ? /do not rewrite the whole project/i.test(prompt) : /不要重写整个项目/.test(prompt);
  add("round-scope", "在原项目上修改", scope, scope ? "要求在现有项目上直接修改" : "没有限制重写整个项目");
  const sided = SIDE_WORDS.test(prompt);
  add("round-neutral", "对两边都成立", !sided, sided ? "出现了左边 / 右边 / 某个模型的说法，但这条消息会同时发给两个模型" : "没有单侧说法");
  if (en) {
    // The user's own notes may be quoted in another language; only the instructions count.
    const han = (prompt.match(/[㐀-鿿]/g) || []).length;
    const ok = han <= Math.max(12, prompt.length * 0.05);
    add("language", "沿用用户语言", ok, ok ? "英文项目对应英文追问" : `英文项目的追问里混入 ${han} 个中文字符`);
  }
  const passed = checks.filter(check => check.passed).length;
  return {
    score: Math.round(passed / checks.length * 100),
    passed,
    total: checks.length,
    ok: checks.every(check => check.passed),
    checks,
    issues: checks.filter(check => !check.passed).map(check => `${check.label}：${check.detail}`),
  };
}

// ---------------------------------------------------------------------------
// Building a round
// ---------------------------------------------------------------------------
function makeRound(spec: ArenaSpec, rounds: ArenaRound[], request: RoundRequest, content: RoundContent, scope: ArenaScope, origin: ArenaRound["origin"]): ArenaRound {
  const cleanContent: RoundContent = {
    issues: content.issues.map(issue => ({ symptom: neutral(issue.symptom), reproduce: neutral(issue.reproduce), expected: neutral(issue.expected) })).filter(issue => issue.symptom),
    newFeatures: content.newFeatures.map(item => ({ feature: neutral(item.feature), acceptance: neutral(item.acceptance) })).filter(item => item.feature),
  };
  return {
    index: rounds.length + 2,
    kind: request.kind,
    observations: request.observations.trim(),
    issues: cleanContent.issues,
    added: request.kind === "extend" ? cleanContent.newFeatures.map(item => item.feature) : [],
    prompt: renderRoundPrompt(spec, rounds, request.kind, cleanContent, scope),
    origin,
    createdAt: new Date().toISOString(),
  };
}

/** Next features for an extend round: what the user asked for, otherwise the backlog in order. */
function nextFeatures(spec: ArenaSpec, rounds: ArenaRound[], scope: ArenaScope, wishes: string[]) {
  const backlog = remainingBacklog(spec, rounds, scope);
  const picked = wishes.length ? wishes : backlog.slice(0, 2);
  const acceptance = spec.language === "en" ? "it can be used directly in the preview and matches the existing style" : "可以在预览里直接操作，风格与现有界面一致";
  return picked.slice(0, MAX_NEW_FEATURES).map(feature => ({ feature, acceptance }));
}

export function buildRoundOffline(spec: ArenaSpec, rounds: ArenaRound[], request: RoundRequest, scope: ArenaScope): ArenaRound {
  const { issues, wishes } = parseObservations(request.observations, request.kind);
  const newFeatures = request.kind === "extend" ? nextFeatures(spec, rounds, scope, wishes) : [];
  return makeRound(spec, rounds, request, { issues, newFeatures }, scope, "rules");
}

export function roundMessages(spec: ArenaSpec, rounds: ArenaRound[], request: RoundRequest, scope: ArenaScope, original: string): ChatMessage[] {
  const en = spec.language === "en";
  const context = {
    request: original,
    appKind: spec.kind,
    keepWorking: keptFeatures(spec, rounds, scope),
    backlogNext: remainingBacklog(spec, rounds, scope).slice(0, 3),
    previousRounds: rounds.map(round => ({ turn: round.index, kind: round.kind, issues: round.issues.map(issue => issue.symptom), added: round.added })),
    roundKind: request.kind,
    observations: request.observations,
  };
  const system = en
    ? `You are ASTRA's Arena iteration assistant. In an Arena Code battle the user has seen two anonymous models' builds, and the next message goes to BOTH models. Turn the user's casual notes into a checklist that is valid for either build:
- Each issue states the symptom (never say left / right / which model), how to reproduce it and the expected behavior.
- For an "extend" round, list the new features with a verifiable done-when; use the user's wishes first, otherwise the next backlog items.
- Never invent problems the user did not mention. Write everything in English.
Output one JSON object only: {"issues":[{"symptom":"","reproduce":"","expected":""}],"newFeatures":[{"feature":"","acceptance":""}]}`
    : `你是 ASTRA 的 Arena 多轮迭代助手。用户在 Arena Code 对战里看到了两个匿名模型的构建结果，下一条消息会同时发给两个模型。请把用户的口语观察整理成对两边都成立的清单：
- 每条问题写清现象（不要提左边 / 右边 / 哪个模型）、复现步骤和期望行为；
- 加功能轮写出新增功能与可验证的完成标准，优先采用用户想要的功能，否则取 backlogNext 里的下一项；
- 不要编造用户没提到的问题。所有文字使用中文。
只输出一个 JSON 对象：{"issues":[{"symptom":"","reproduce":"","expected":""}],"newFeatures":[{"feature":"","acceptance":""}]}`;
  return [
    { role: "system", content: system },
    { role: "user", content: `<round_context>\n${JSON.stringify(context, null, 2)}\n</round_context>` },
  ];
}

const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 240) : "";

/** A model reply as a round, or null when it holds nothing usable. */
export function roundFromModel(raw: Record<string, unknown> | null, spec: ArenaSpec, rounds: ArenaRound[], request: RoundRequest, scope: ArenaScope): ArenaRound | null {
  if (!raw) return null;
  const issues = (Array.isArray(raw.issues) ? raw.issues : []).flatMap(item => {
    if (typeof item === "string") return [{ symptom: text(item), reproduce: "", expected: "" }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [{ symptom: text(record.symptom ?? record.problem ?? record.issue), reproduce: text(record.reproduce ?? record.steps), expected: text(record.expected ?? record.fix) }];
  }).filter(item => item.symptom).slice(0, MAX_ISSUES);
  const newFeatures = (Array.isArray(raw.newFeatures) ? raw.newFeatures : []).flatMap(item => {
    if (typeof item === "string") return [{ feature: text(item), acceptance: "" }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [{ feature: text(record.feature ?? record.name), acceptance: text(record.acceptance ?? record.doneWhen) }];
  }).filter(item => item.feature).slice(0, MAX_NEW_FEATURES);
  const extend = request.kind === "extend";
  if (!issues.length && !(extend && newFeatures.length) && request.observations.trim()) return null;
  return makeRound(spec, rounds, request, { issues, newFeatures: extend ? (newFeatures.length ? newFeatures : nextFeatures(spec, rounds, scope, [])) : [] }, scope, "ai");
}
