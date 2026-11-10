/**
 * Deterministic quality gate for Arena prompts.
 *
 * `evaluateArenaPrompt` reads the rendered text (so a hand-edited prompt can be
 * re-checked); `enforceArenaSpec` repairs the *spec* for every failed critical
 * check and the prompt is rendered again. Because each critical check has a
 * code-level fix, the free tier never needs an extra repair call.
 */
import {
  ARENA_HEADINGS, ARENA_LIMITS, ARENA_REQUIRED_HEADINGS, PLACEHOLDER_PATTERN, arenaKindDefaults, arenaLanguage,
  fillTo, fitsLanguage, namedTech, palettePreset, renderArenaPrompt,
  type ArenaLanguage, type ArenaSpec, type RenderArenaOptions,
} from "@/ai/arena";
import { pickArenaCase } from "@/ai/arena-cases";
import { BLOCKING_PATTERN, containsApproximately, similarity, type PromptCheck, type PromptQuality } from "@/ai/quality";
import { understand } from "@/lib/semantic";

/** Asking the builder to plan, ask or document instead of shipping the app. */
export const ARENA_META_PATTERN = /先(?:输出|给出|提供|写出?)(?:方案|计划|设计稿|结构|大纲|线框)|先(?:向用户)?提问|先确认需求|运行命令|(?:写|编写|提供)\s*README|README\s*(?:文档|说明)|部署步骤|安装说明|ask (?:me|the user|questions) (?:first|before)|(?:present|propose|outline) (?:a |the )?plan (?:first|before)|run command|deployment steps|write (?:a )?README|setup instructions/i;

/** A feature names something a voter can do or see, not an adjective such as 「好玩」. */
export const ACTION = /\d|点击|点按|拖|切换|输入|显示|保存|筛选|过滤|搜索|删除|新建|新增|添加|播放|暂停|打开|关闭|提交|导出|计算|更新|控制|移动|发射|收藏|排序|分页|滑动|缩放|旋转|选择|生成|撤销|统计|提示|展开|收起|高亮|滚动|预约|购买|结账|编辑|重命名|上传|发送|悬停|跳转|轮播|校验|演示|计时|记录|还原|展示|弹出|出现|进入|开局|触发|自适应|响应|闪烁|\b(?:click|drag|toggle|type|show|save|filter|search|delete|add|create|play|pause|open|close|submit|export|calculat|update|move|sort|zoom|rotate|swipe|press|select|pick|choose|watch|scroll|join|validat|switch|expand|collapse|highlight|animat|load|send|upload|edit|rename|track|book|buy|checkout|navigat|hover|tap|reveal|reorder|change|recreate|display|persist|generate|undo|remember|restore|shoot|collect|dodge|explain|begin|resize|appear|trigger|respond|adapt)/i;
/** Digits, Chinese numerals with a measure word, or English number words. */
export const QUANTITY = /\d|[一二两三四五六七八九十几百千]\s*(?:条|个|件|篇|位|首|张|天|款|颗|种|类|组|套|大|项|部|名|步|关|局|页|段)|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens?|several|hundreds?)\b/i;
const STATE = /状态|空|加载|错误|失败|成功|暂停|结束|开始|未开始|进行中|胜|负|重置|选中|无结果|提交|\b(?:state|empty|loading|error|fail|success|pause|over|start|ready|playing|win|lose|reset|selected|no result|submit|offline|open)/i;
const HEX = /#[0-9a-f]{3,8}\b/i;
const TYPE_WORD = /字体|字号|字阶|字重|\bfont|\btype|typeface|typography/i;
const LAYOUT_WORD = /布局|栅格|网格|宽|列|居中|侧栏|layout|grid|column|width|sidebar|centered|full[- ]?(?:bleed|width|screen)/i;
const SANDBOX_KEYS = /API Key|后端|backend/i;
const SANDBOX_IMPORTS = /import|依赖|dependenc/i;
const FUNCTION_CHARS = /[个的了吗呢吧着和与或也都很就把被给让]/;
const EN_STOP = new Set(["make", "build", "create", "clone", "design", "develop", "write", "code", "implement", "generate", "recreate", "give", "show", "add", "let", "can", "could", "would", "should", "want", "need", "with", "that", "this", "please", "help", "simple", "nice", "beautiful", "some", "for", "and", "the", "from", "into", "your", "have", "like", "just", "very"]);

function sections(text: string) {
  const map = new Map<string, string>();
  const headings: string[] = [];
  const parts = text.split(/^##\s+/m);
  for (const part of parts.slice(1)) {
    const newline = part.indexOf("\n");
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
    headings.push(heading);
    map.set(heading, newline === -1 ? "" : part.slice(newline + 1).trim());
  }
  return { map, headings };
}

const listItems = (body: string) => body.split("\n").map(line => line.trim()).filter(line => /^(?:\d+[.、)]|[-*•])\s+/.test(line)).map(line => line.replace(/^(?:\d+[.、)]|[-*•])\s+/, ""));

/** Words the user explicitly named (Spotify, three.js, Markdown…) and the request's key terms. */
function requestTerms(original: string, language: ArenaLanguage) {
  const named = [...new Set([...(original.match(/[A-Za-z][A-Za-z0-9.+#-]{2,}/g) || []), ...namedTech(original)])]
    .filter(word => language === "zh" || /^[A-Z]/.test(word) || namedTech(original).includes(word))
    .filter(word => !EN_STOP.has(word.toLowerCase()));
  let keys: string[] = [];
  if (language === "zh") {
    for (const run of original.match(/[㐀-鿿]+/g) || []) {
      for (let i = 0; i < run.length - 1; i++) {
        const gram = run.slice(i, i + 2);
        if (!FUNCTION_CHARS.test(gram) && !/^(?:做一|帮我|我想|我要|需要|可以|一下|一款|写一|给我)$/.test(gram)) keys.push(gram);
      }
    }
  } else {
    keys = (original.toLowerCase().match(/[a-z]{4,}/g) || []).filter(word => !EN_STOP.has(word));
  }
  return { named, keys: [...new Set(keys)] };
}

/** Character-bigram overlap for Chinese; word overlap for English, where shared letter pairs mean nothing. */
function overlap(a: string, b: string, language: ArenaLanguage) {
  if (language === "zh") return similarity(a, b);
  const words = (value: string) => new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(word => !EN_STOP.has(word)));
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  left.forEach(word => { if (right.has(word)) shared++; });
  return (2 * shared) / (left.size + right.size);
}

export interface ArenaEvaluateOptions {
  /** User knowledge passed to the renderer; the reference block is then expected. */
  knowledgeCount?: number;
}

export function evaluateArenaPrompt(prompt: string, original: string, spec: ArenaSpec | null, options: ArenaEvaluateOptions = {}): PromptQuality {
  const text = prompt.trim();
  const language = spec?.language || arenaLanguage(original);
  const h = ARENA_HEADINGS[language];
  const { map, headings } = sections(text);
  const checks: PromptCheck[] = [];
  const weights: Record<string, number> = {};
  const add = (id: string, label: string, weight: number, passed: boolean, detail: string) => { checks.push({ id, label, passed, detail }); weights[id] = weight; };
  const section = (title: string) => map.get(title) || "";
  // Everything except user-supplied reference notes counts as instructions.
  const instructions = text.replace(new RegExp(`^##\\s+${h.reference}[\\s\\S]*?(?=^##\\s|$(?![\\s\\S]))`, "m"), "");

  const required = ARENA_REQUIRED_HEADINGS(language);
  const ordered = required.every(title => headings.includes(title))
    && required.map(title => headings.indexOf(title)).every((index, i, all) => i === 0 || index > all[i - 1]);
  add("arena-structure", "七段结构完整", 12, ordered, ordered ? "核心体验、功能、交互状态、视觉、内容、技术要求、完成标准按顺序齐全" : `缺少或打乱了：${required.filter(title => !headings.includes(title)).join("、") || "段落顺序"}`);

  const { named, keys } = requestTerms(original, language);
  const lower = instructions.toLowerCase();
  const missingNamed = named.filter(word => !lower.includes(word.toLowerCase()));
  const covered = keys.filter(key => lower.includes(key.toLowerCase())).length;
  const coverage = keys.length ? covered / keys.length : 1;
  const intent = missingNamed.length === 0 && coverage >= 0.5;
  add("arena-intent", "忠于原始需求", 12, intent, intent ? "点名的对象与原话关键词都在提示词里" : missingNamed.length ? `没有提到：${missingNamed.join("、")}` : `原话关键词只覆盖了 ${Math.round(coverage * 100)}%`);

  const constraints = [...new Set([...(spec?.constraints || []), ...understand(original).constraints])];
  const missingConstraints = constraints.filter(item => !containsApproximately(instructions, item));
  add("constraints", "明确要求未丢失", 14, missingConstraints.length === 0, missingConstraints.length ? `未覆盖：${missingConstraints.join("；")}` : `${constraints.length} 条原文要求均已写入`);

  const tech = namedTech(original);
  if (tech.length) {
    const techText = `${section(h.tech)}\n${section(h.features)}`.toLowerCase();
    const missingTech = tech.filter(item => !techText.includes(item.toLowerCase()));
    add("arena-tech", "用户指定的技术", 8, missingTech.length === 0, missingTech.length ? `技术要求里没有：${missingTech.join("、")}` : `已落实 ${tech.join("、")}`);
  }

  const features = listItems(section(h.features));
  const concrete = features.filter(item => ACTION.test(item)).length;
  add("arena-features", "功能具体可验证", 14, concrete >= 4, `${concrete} / ${features.length} 条功能写成了可观察的行为`);

  const states = listItems(section(h.interactions)).filter(item => STATE.test(item)).length;
  add("arena-states", "状态与反馈", 10, states >= 2, states >= 2 ? `覆盖 ${states} 条状态或反馈` : "缺少空、加载、错误、暂停或结束等状态说明");

  const visual = section(h.visual);
  const visualOk = HEX.test(visual) && TYPE_WORD.test(visual) && LAYOUT_WORD.test(visual);
  add("arena-visual", "视觉方向具体", 12, visualOk, visualOk ? "有色值、字体层级与布局" : "视觉设计需要色值、字体层级和布局");

  const techSection = section(h.tech);
  const sandbox = SANDBOX_KEYS.test(techSection) && SANDBOX_IMPORTS.test(techSection);
  add("arena-sandbox", "沙箱运行约束", 10, sandbox, sandbox ? "说明了免密钥 / 免后端与依赖规则" : "技术要求缺少免 API Key、免后端或依赖与 import 规则");

  const done = listItems(section(h.done)).length;
  add("arena-done", "完成标准可自查", 8, done >= 4, `${done} 条完成标准`);

  const meta = ARENA_META_PATTERN.test(instructions) || BLOCKING_PATTERN.test(instructions);
  add("arena-meta", "直接交付应用", 6, !meta, meta ? "要求先提问、先出方案或写说明文档" : "没有让模型停下来提问或只交方案");

  if (language === "en") {
    const han = (instructions.match(/[㐀-鿿]/g) || []).length;
    const sameLanguage = han <= Math.max(12, instructions.length * 0.025);
    add("language", "沿用用户语言", 6, sameLanguage, sameLanguage ? "英文输入对应英文提示词" : `英文输入中混入 ${han} 个中文字符`);
  }

  const contentBody = section(h.content);
  const placeholder = PLACEHOLDER_PATTERN.test(instructions.replace(/需求原话：「[^」]*」|Original request: "[^"]*"/g, ""));
  const contentOk = !placeholder && QUANTITY.test(contentBody);
  add("arena-content", "内容完整逼真", 4, contentOk, placeholder ? "出现了占位文字或待办标记" : contentOk ? "示例内容有数量和类型" : "内容与数据没有写明数量");

  const scope = features.length <= ARENA_LIMITS.features[1] && text.length >= 500 && text.length <= 4500;
  add("arena-scope", "范围适中", 2, scope, `${features.length} 条功能，${text.length} 字`);

  const example = pickArenaCase(spec?.kind || "tool", language);
  // Only model-written specs can copy the example; offline specs use per-kind defaults.
  if (example && spec?.origin === "ai" && overlap(original, example.input, language) < 0.6) {
    const copied = overlap(features.join(" "), example.spec.features.join(" "), language) >= 0.45;
    add("arena-original", "没有照抄示例", 4, !copied, copied ? "功能列表与示例过于相似" : "内容针对本次需求");
  }

  if (options.knowledgeCount) {
    const cited = map.has(h.reference);
    add("knowledge", "知识库已引用", 2, cited, cited ? `引用了 ${options.knowledgeCount} 条用户资料` : "相关知识没有进入提示词");
  }

  const critical = ["arena-structure", "arena-intent", "constraints", "arena-tech", "arena-features", "arena-states", "arena-visual", "arena-sandbox", "arena-done", "arena-meta", "language"];
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const score = Math.round(checks.reduce((sum, check) => sum + (check.passed ? weights[check.id] : 0), 0) / totalWeight * 100);
  const criticalPassed = checks.filter(check => critical.includes(check.id)).every(check => check.passed);
  return {
    score,
    passed: checks.filter(check => check.passed).length,
    total: checks.length,
    ok: criticalPassed && score >= 80,
    checks,
    issues: checks.filter(check => !check.passed).map(check => `${check.label}：${check.detail}`),
  };
}

const keepItems = (items: string[], language: ArenaLanguage) => items.filter(item => !ARENA_META_PATTERN.test(item) && !BLOCKING_PATTERN.test(item) && !PLACEHOLDER_PATTERN.test(item) && fitsLanguage(item, language));

/** Repairs the spec for each failed check. Returns the new spec and a note per fix. */
export function enforceArenaSpec(spec: ArenaSpec, original: string, failed: string[]): { spec: ArenaSpec; fixes: string[] } {
  const next: ArenaSpec = { ...spec, visual: { ...spec.visual } };
  const defaults = arenaKindDefaults(next.kind, next.language);
  const fixes: string[] = [];
  const fail = (id: string) => failed.includes(id);
  if (fail("arena-meta") || fail("language") || fail("arena-content")) {
    next.features = keepItems(next.features, next.language);
    next.interactions = keepItems(next.interactions, next.language);
    next.states = keepItems(next.states, next.language);
    next.content = keepItems(next.content, next.language);
    next.acceptance = keepItems(next.acceptance, next.language);
    next.followUps = keepItems(next.followUps, next.language);
    for (const key of ["coreLoop", "summary"] as const) {
      if (!keepItems([next[key]], next.language).length) next[key] = key === "coreLoop" ? defaults.coreLoop : next.summary && fitsLanguage(next.summary, next.language) ? next.summary : defaults.coreLoop;
    }
    fixes.push("删除了让模型先提问、先出方案、写说明，或语言不一致、带占位的条目");
  }
  if (fail("arena-features") || next.features.length < ARENA_LIMITS.features[0]) {
    const concrete = next.features.filter(item => ACTION.test(item));
    next.features = fillTo(concrete.length >= 4 ? next.features : concrete, defaults.features, ARENA_LIMITS.features[0], ARENA_LIMITS.features[1]);
    if (fail("arena-features")) fixes.push("用该类型的默认功能补足可验证的功能清单");
  }
  if (fail("arena-states") || next.states.length < ARENA_LIMITS.states[0]) {
    next.states = fillTo(next.states, defaults.states, ARENA_LIMITS.states[0] + 1, ARENA_LIMITS.states[1]);
    next.interactions = fillTo(next.interactions, defaults.interactions, ARENA_LIMITS.interactions[0], ARENA_LIMITS.interactions[1]);
    if (fail("arena-states")) fixes.push("补齐空、加载、错误、暂停或结束等状态");
  }
  if (fail("arena-visual")) {
    if (!HEX.test(next.visual.palette)) next.visual.palette = palettePreset(original, next.language);
    if (!TYPE_WORD.test(next.visual.type)) next.visual.type = defaults.visual.type;
    if (!LAYOUT_WORD.test(next.visual.layout)) next.visual.layout = defaults.visual.layout;
    fixes.push("补充了带色值的配色、字体层级和布局");
  }
  if (fail("arena-done") || next.acceptance.length < ARENA_LIMITS.acceptance[0]) {
    next.acceptance = fillTo(next.acceptance, defaults.acceptance, ARENA_LIMITS.acceptance[0], ARENA_LIMITS.acceptance[1]);
    if (fail("arena-done")) fixes.push("补足可在预览中自查的完成标准");
  }
  if (!next.content.length) next.content = [...defaults.content];
  else if (fail("arena-content") && !next.content.some(item => QUANTITY.test(item))) {
    next.content = [defaults.content[0], ...next.content].slice(0, ARENA_LIMITS.content[1]);
    fixes.push("给示例内容写明数量");
  }
  if (fail("constraints")) {
    next.constraints = [...new Set([...next.constraints, ...understand(original).constraints])];
    fixes.push("把原话中的明确要求写进技术要求");
  }
  if (fail("arena-tech")) {
    next.tech = namedTech(original);
    fixes.push(`写入用户指定的技术：${next.tech.join("、")}`);
  }
  if (fail("arena-intent")) {
    next.quoteRequest = true;
    fixes.push("附上需求原话，避免规格偏离用户点名的对象");
  }
  if (fail("arena-scope")) next.features = next.features.slice(0, ARENA_LIMITS.features[1]);
  return { spec: next, fixes };
}

const CRITICAL_FIXABLE = ["arena-structure", "arena-intent", "constraints", "arena-tech", "arena-features", "arena-states", "arena-visual", "arena-sandbox", "arena-done", "arena-meta", "language", "arena-content", "arena-scope"];

/** Render → check → repair the spec → render again (at most twice). */
export function finalizeArenaSpec(spec: ArenaSpec, original: string, options: RenderArenaOptions = {}) {
  let current = spec;
  const fixes: string[] = [];
  const render = (value: ArenaSpec) => renderArenaPrompt(value, { ...options, request: original });
  let prompt = render(current);
  let quality = evaluateArenaPrompt(prompt, original, current, { knowledgeCount: options.knowledge?.length });
  for (let round = 0; round < 2; round++) {
    const failed = quality.checks.filter(check => !check.passed && CRITICAL_FIXABLE.includes(check.id)).map(check => check.id);
    if (!failed.length) break;
    const repaired = enforceArenaSpec(current, original, failed);
    current = repaired.spec;
    fixes.push(...repaired.fixes);
    prompt = render(current);
    quality = evaluateArenaPrompt(prompt, original, current, { knowledgeCount: options.knowledge?.length });
  }
  return { spec: current, prompt, quality, fixes: [...new Set(fixes)] };
}
