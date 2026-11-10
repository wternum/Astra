/**
 * Deterministic quality gate for generated prompts.
 *
 * These checks do not pretend to predict model quality. They verify the parts
 * that can be checked reliably: the original request survived, explicit
 * constraints were not dropped, the prompt has an output contract and success
 * criteria, assumptions are labelled, and it does not stop to ask for input.
 */
import type { NeedAnalysis } from "@/ai/engine";
import type { FrontendBrief } from "@/ai/frontend";
import { isDesignOnlyRequest } from "@/ai/frontend";
import { formatKnowledgeBlock, type KnowledgeSnippet } from "@/lib/knowledge";

/** Phrases that make the executing model stop and wait for the user instead of delivering. */
export const BLOCKING_PATTERN = /请先回答|请先提供|请补充.{0,12}(?:后|再)|收到上述信息后|等待(?:你|您|用户)提供|回答上述问题后|确认后再|please (?:first |start by )?(?:ask|provide|answer).*before|wait (?:for|until) (?:the user|more information)/i;

export interface PromptCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PromptQuality {
  score: number;
  passed: number;
  total: number;
  ok: boolean;
  checks: PromptCheck[];
  issues: string[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

function bigrams(value: string) {
  const text = normalize(value);
  const grams = new Set<string>();
  for (let index = 0; index < text.length - 1; index++) grams.add(text.slice(index, index + 2));
  return grams;
}

/** Character-bigram similarity works for Chinese and mixed Chinese/English text. */
export function similarity(a: string, b: string) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size || !right.size) return normalize(a) === normalize(b) ? 1 : 0;
  let shared = 0;
  left.forEach(item => { if (right.has(item)) shared++; });
  return (2 * shared) / (left.size + right.size);
}

export function containsApproximately(haystack: string, needle: string) {
  const source = normalize(haystack);
  const target = normalize(needle);
  if (!target) return true;
  if (source.includes(target)) return true;
  // Long clauses may be faithfully rewritten; require substantial semantic overlap.
  return target.length > 12 && similarity(haystack, needle) >= 0.52;
}

export function evaluatePrompt(optimized: string, original: string, analysis: NeedAnalysis): PromptQuality {
  const text = optimized.trim();
  const originalBlock = /<user_request>([\s\S]*?)<\/user_request>/i.exec(text);
  const instructions = text
    .replace(/<user_request>[\s\S]*?<\/user_request>/gi, "")
    .replace(/<knowledge_base>[\s\S]*?<\/knowledge_base>/gi, "");
  const checks: PromptCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail: string) => checks.push({ id, label, passed, detail });

  const sourcePreserved = Boolean(originalBlock && normalize(originalBlock[1]) === normalize(original.trim()));
  add("source", "原始需求保留", sourcePreserved, sourcePreserved ? "原始需求被完整保留在独立输入区" : "没有找到原始需求，可能改写了用户意图");

  const missingConstraints = analysis.constraints.filter(item => !containsApproximately(instructions, item));
  add("constraints", "硬性约束未丢失", missingConstraints.length === 0,
    missingConstraints.length ? `未覆盖：${missingConstraints.join("；")}` : `${analysis.constraints.length} 条原文约束均已覆盖`);

  const headings = (text.match(/^##\s+.+$/gm) || []).map(item => item.replace(/^##\s+/, "").trim());
  const expected = /[\u3400-\u9fff]/.test(original)
    ? ["目标与交付", "原始需求与已知信息", "执行步骤", "输出契约", "质量检查"]
    : ["Goal and deliverable", "Request and known information", "Execution plan", "Output contract", "Quality checks"];
  const orderedSections = expected.every((title, index) => headings[index]?.toLowerCase() === title.toLowerCase());
  add("structure", "指令与资料分层", orderedSections && sourcePreserved,
    orderedSections && sourcePreserved ? "五个任务区块按顺序组织，原始输入独立分隔" : "缺少按顺序组织的目标、资料、执行、输出与检查区块");

  const hasOutput = /输出|交付|返回|deliver|output|return/i.test(instructions) && /格式|结构|篇幅|形式|字段|文件|源码|清单|列表|页面|交互|字数|长度|format|structure|file|length|code|source/i.test(instructions);
  add("output", "输出契约明确", hasOutput, hasOutput ? "已定义交付形式与呈现要求" : "缺少可验收的输出格式、结构或篇幅要求");

  const hasCriteria = /质量检查|验收标准|质量标准|交付前.*(?:核对|检查)|成功标准|quality checks|acceptance criteria|before delivery.*(?:check|verify)/i.test(instructions);
  add("criteria", "成功标准可检查", hasCriteria, hasCriteria ? "包含交付前的质量检查" : "没有告诉执行模型怎样判断结果是否合格");

  const blocking = BLOCKING_PATTERN.test(instructions);
  add("executable", "无需等待即可执行", !blocking, blocking ? "仍要求执行模型先提问或等待资料" : "缺失信息采用默认假设，能够直接开始执行");

  const labelsAssumptions = analysis.assumptions.length === 0 || /默认假设|合理假设|假设[：:]|如果未说明|default assumptions?|provisional|\bassumptions?\b|if not specified/i.test(instructions);
  const grounded = /不要编造|不得编造|不要虚构|不得虚构|没有虚构|避免虚构|不冒充|不编造|不虚构|不要捏造|不得捏造|do not (?:invent|fabricate)|never (?:invent|fabricate)/i.test(instructions);
  add("grounding", "假设与事实边界", labelsAssumptions && grounded,
    labelsAssumptions && grounded ? "默认假设已标注，并要求不编造事实" : "需要明确标注假设，并加入不编造事实的边界");

  const lengthOkay = text.length >= 180 && instructions.length <= 5000 && text.length <= 8000;
  const noWrapper = !/^```/.test(text) && !/^(?:好的|当然可以|以下是).{0,20}(?:提示词|优化稿)/.test(text);
  add("ready", "可直接复制使用", lengthOkay && noWrapper,
    lengthOkay && noWrapper ? `${text.length} 字，无额外解释或代码围栏` : "内容过短、过长，或包含提示词之外的解释");

  const weights: Record<string, number> = { source: 20, constraints: 18, structure: 14, output: 14, criteria: 12, executable: 10, grounding: 8, ready: 4 };
  if (analysis.frontend) {
    const visual = /构图|布局|首屏|阅读顺序|信息层级|composition|layout|hierarchy|hero/i.test(instructions)
      && /字体|排版|字阶|typography|type scale|font/i.test(instructions)
      && /画布|颜色|配色|色彩|color|colour|palette/i.test(instructions)
      && /视觉|产品图|作品|图片|照片|素材|影像|图表|visual|imagery|photograph|image|chart/i.test(instructions);
    add("frontend-direction", "视觉方向具体", visual,
      visual ? "构图、字体、颜色职责与视觉主体均有说明" : "需要具体写出布局、字体、颜色职责及与主题相关的视觉主体");
    weights["frontend-direction"] = 12;
    const delivery = /手机|移动端|窄屏|responsive|mobile/i.test(instructions)
      && /键盘|焦点|无障碍|accessib|keyboard|focus/i.test(instructions)
      && /可运行|运行命令|可操作|交互|真实行为|源码|build|run|working|functional|interactive/i.test(instructions);
    add("frontend-delivery", "前端交付可验证", delivery,
      delivery ? "包括响应式、可访问性和可运行的交互验证" : "需要明确手机布局、键盘或焦点态、可运行的主要交互与验证方式");
    weights["frontend-delivery"] = 12;
    if (!isDesignOnlyRequest(original)) {
      const goal = instructions.split(/^##\s+/m)[1] || "";
      const outputSection = instructions.split(/^## (?:输出契约|Output contract)\s*$/im)[1]?.split(/^##\s+/m)[0] || "";
      const target = `${goal} ${outputSection}`;
      const deliverCode = /可运行.{0,12}(?:网店|网站|网页|页面|界面|组件|应用)|完整(?:的)?(?:网店|网站|网页|页面|界面|应用)源码|可运行(?:的)?代码|源码|实现(?:一个|网站|页面)|(?:create|build|implement|ship|deliver)\s+(?:a\s+)?(?:fully\s+)?(?:working|functional|runnable|ready-to-deploy|deployable|complete).{0,45}(?:website|webpage|page|site|app|HTML|CSS|JavaScript)|(?:working|runnable|functional)\s+(?:website|webpage|page|site|app)|ready-to-deploy\s+(?:HTML|CSS|JS)|source code|working code|runnable code/i.test(target);
      const onlyDesign = /(?:design specification|mockup outline|wireframe|设计规范|线框图|仅(?:输出|提供).*设计说明)/i.test(goal)
        && !/working (?:website|page|site|app)|可运行|源码|source code/i.test(goal);
      add("frontend-build", "交付真正可运行的网站", deliverCode && !onlyDesign,
        deliverCode && !onlyDesign ? "目标与输出要求交付可运行实现，不止是设计稿" : "用户要做网站：目标或输出只要求了设计说明/原型，没有明确交付可运行网站和源码");
      weights["frontend-build"] = 14;
    }
    const stack = analysis.frontend.explicitSignals
      .find(item => /^(?:技术约束|Stack)[:：]/i.test(item))?.split(/[:：]/).slice(1).join(":").trim();
    const features = ["筛选", "购物车", "预约", "搜索", "登录", "支付", "filter", "cart", "booking", "search", "login", "checkout"]
      .filter(term => original.toLowerCase().includes(term.toLowerCase()));
    const explicitMissing = [
      ...(stack && !instructions.toLowerCase().includes(stack.toLowerCase()) ? [stack] : []),
      ...features.filter(term => !instructions.toLowerCase().includes(term.toLowerCase())),
    ];
    if (stack || features.length) {
      add("frontend-user", "用户指定的功能与技术栈", explicitMissing.length === 0,
        explicitMissing.length ? `指令区未落实：${explicitMissing.join("、")}` : "用户明确指定的功能与技术栈均落实到执行指令中");
      weights["frontend-user"] = 10;
    }
  }
  if (!/[\u3400-\u9fff]/.test(original) && /[a-z]{3}/i.test(original)) {
    const unexpectedHan = (instructions.match(/[\u3400-\u9fff]/g) || []).length;
    const sameLanguage = unexpectedHan <= Math.max(12, instructions.length * 0.025);
    add("language", "沿用用户语言", sameLanguage,
      sameLanguage ? "英语输入对应英文执行指令" : `英文输入中混入 ${unexpectedHan} 个中文字符，需要重写为英文`);
    weights.language = 6;
  }
  const knowledge = analysis.knowledge || [];
  if (knowledge.length) {
    const hasBlock = /<knowledge_base>[\s\S]*?<\/knowledge_base>/i.test(text);
    const cited = knowledge.some(item => text.includes(item.title)
      || (item.content.length >= 8 && text.includes(item.content.slice(0, 16))));
    add("knowledge", "知识库已引用", hasBlock && cited,
      hasBlock && cited ? `作为独立资料块引用了 ${knowledge.length} 条相关知识` : "相关知识未进入提示词，需要保留在独立资料块中");
    weights.knowledge = 8;
  }
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const score = Math.round(checks.reduce((sum, check) => sum + (check.passed ? weights[check.id] || 0 : 0), 0) / totalWeight * 100);
  const critical = ["source", "constraints", "structure", "output", "criteria", "executable", "grounding"];
  if (analysis.frontend) critical.push("frontend-direction", "frontend-delivery", ...(isDesignOnlyRequest(original) ? [] : ["frontend-build"]));
  if (checks.some(check => check.id === "frontend-user")) critical.push("frontend-user");
  if (checks.some(check => check.id === "language")) critical.push("language");
  if (checks.some(check => check.id === "knowledge")) critical.push("knowledge");
  const criticalPassed = critical.every(id => checks.find(check => check.id === id)?.passed);
  return {
    score,
    passed: checks.filter(check => check.passed).length,
    total: checks.length,
    ok: criticalPassed && score >= 80,
    checks,
    issues: checks.filter(check => !check.passed).map(check => `${check.label}：${check.detail}`),
  };
}

/** Deterministic last-mile enforcement for a verifiable safety contract. */
export function enforceGrounding(optimized: string) {
  const text = optimized.trim();
  if (/不要编造|不得编造|不要虚构|不得虚构|不编造|不虚构|不要捏造|不得捏造|do not (?:invent|fabricate)|never (?:invent|fabricate)/i.test(text.replace(/<user_request>[\s\S]*?<\/user_request>/gi, ""))) return text;
  const english = /^## Goal and deliverable/im.test(text);
  const rule = english
    ? "- Do not invent product claims, people, dates, data or testimonials. Mark genuinely unknown details as replaceable assumptions rather than facts."
    : "- 不得编造用户未提供的事实、原因、日期、姓名、数据或承诺；确需补充时使用【待补充】占位，不要把默认假设写成事实。";
  if (/^## (?:质量检查|Quality checks)\s*$/im.test(text)) return `${text}\n${rule}`;
  return `${text}\n\n## ${english ? "Quality checks" : "质量检查"}\n${rule}`;
}

/** Complete only the missing frontend requirements using this request's brief. */
export function enforceFrontendContract(optimized: string, brief: FrontendBrief, missing: string[]) {
  let text = optimized.trim();
  const english = /^## Goal and deliverable/im.test(text);
  const insertBefore = (heading: string, addition: string) => {
    const index = text.indexOf(heading);
    text = index === -1 ? `${text}\n\n${addition}` : `${text.slice(0, index).trimEnd()}\n\n${addition}\n\n${text.slice(index)}`;
  };
  if (missing.includes("frontend-direction")) {
    const addition = english
      ? `Design direction to implement: ${brief.visualDirection} Layout and composition: ${brief.composition} Typography: ${brief.typography} Color roles: ${brief.colorRoles} Relevant imagery or visual subject: ${brief.visualAnchor}`
      : `需要落实的视觉方向：${brief.visualDirection} 页面布局与构图：${brief.composition} 字体与排版：${brief.typography} 画布/文字/行动色的职责：${brief.colorRoles} 真实视觉主体与素材方案：${brief.visualAnchor}`;
    insertBefore(english ? "## Output contract" : "## 输出契约", addition);
  }
  if (missing.includes("frontend-delivery")) {
    const addition = english
      ? `Responsive and accessible delivery: ${brief.implementation} ${brief.interactions} Check mobile and desktop layouts, working actions, keyboard focus, readable contrast and reduced-motion behavior where motion is used.`
      : `响应式与无障碍交付：${brief.implementation} ${brief.interactions} 请验证手机和桌面布局、主要操作、键盘焦点、文字对比度，以及使用动效时的 reduced-motion 退化。`;
    insertBefore(english ? "## Quality checks" : "## 质量检查", addition);
  }
  return text;
}

/** Keep relevant user-authored knowledge available even if the model omits it. */
export function enforceKnowledge(optimized: string, snippets: KnowledgeSnippet[]) {
  const text = optimized.trim();
  if (!snippets.length || /<knowledge_base>[\s\S]*?<\/knowledge_base>/i.test(text)) return text;
  const english = /^## Goal and deliverable/im.test(text);
  const block = formatKnowledgeBlock(snippets, english);
  const requestHeading = english ? "## Request and known information" : "## 原始需求与已知信息";
  const start = text.indexOf(requestHeading);
  if (start === -1) return `${text}\n\n${block}`;
  const afterHeading = start + requestHeading.length;
  const next = text.slice(afterHeading).search(/^##\s+/m);
  const insertAt = next === -1 ? text.length : afterHeading + next;
  return `${text.slice(0, insertAt).trimEnd()}\n\n${block}\n\n${text.slice(insertAt).trimStart()}`;
}
