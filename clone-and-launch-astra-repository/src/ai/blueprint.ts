/**
 * Prompt architecture selected for the user's task.
 *
 * This is intentionally a *skeleton*, not a prompt template. The AI fills every
 * section with task-specific content. The architecture follows the common part
 * of the current OpenAI, Anthropic and Gemini guidance:
 *   goal & success criteria -> instructions -> examples/context -> output contract
 *   -> verification. Instructions and user data stay in separate blocks.
 */
import type { LayerId } from "@/lib/semantic";
import type { NeedAnalysis } from "@/ai/engine";
import { FRONTEND_REFERENCES, isEnglishRequest } from "@/ai/frontend";

export interface PromptBlueprint {
  role: string;
  sections: readonly { id: string; title: string; purpose: string }[];
  steps: readonly string[];
  checks: readonly string[];
}

interface TaskProfile {
  role: string;
  steps: readonly string[];
  checks: readonly string[];
}

const PROFILES: Record<LayerId, TaskProfile> = {
  coding: {
    role: "能交付可运行成果的资深工程师",
    steps: ["先明确运行环境、输入、输出和验收方式，缺失项采用已声明的默认假设", "给出完整实现，而不是伪代码或零散片段", "处理输入为空、格式错误、重复、权限或失败等真实边界情况", "按给出的验收方式检查实现，并说明如何运行和验证"],
    checks: ["交付物可以直接运行或复现", "依赖、运行命令与文件结构清楚", "关键边界和失败路径已覆盖"],
  },
  writing: {
    role: "重视读者收益与文字质感的资深编辑",
    steps: ["先确定中心观点、目标读者和读完后应获得的收获", "用一个具体场景或有信息量的开头进入主题", "按清晰的叙事顺序完成正文，每段都提供新信息", "删除套话、重复和未经证实的素材，统一语气后交付"],
    checks: ["开头与标题服务于真实读者", "每段都有实质内容且逻辑连贯", "没有虚构引用、数据或亲身经历"],
  },
  analysis: {
    role: "能区分事实、推断与决策风险的战略分析师",
    steps: ["先写出评价维度和倾向性结论，避免只罗列信息", "分别比较可行路径的收益、成本、适用条件和风险", "把原文事实、合理推断与待验证假设明确分开", "给出优先级明确的下一步行动和验证指标"],
    checks: ["结论明确且有对应依据", "至少比较两种真正可行的路径", "没有虚构数据，关键不确定性已说明"],
  },
  marketing: {
    role: "能把产品特点转成受众收益的品牌与增长顾问",
    steps: ["确定一个最值得强调的核心主张及其受众收益", "用目标人群熟悉的场景和语言展开，而不是堆砌卖点", "检查所有承诺是否有原文依据，删除夸张和空泛表达", "以自然、明确的下一步行动收尾"],
    checks: ["核心主张真实、具体且可感知", "语气与投放渠道和目标人群一致", "有清晰行动引导且没有虚构背书"],
  },
  learning: {
    role: "擅长由浅入深建立直觉的教学导师",
    steps: ["先判断读者已有知识，用生活化类比建立直觉", "再解释核心机制，并在术语首次出现时顺手定义", "用一个完整例子把概念落到实际情境", "指出一个常见误解，并用简短问题帮助读者自查"],
    checks: ["直觉先于理论，术语有解释", "至少有一个完整且准确的例子", "覆盖常见误解且没有超纲展开"],
  },
  creative: {
    role: "既能发散又能筛选落地想法的创意总监",
    steps: ["先确定评价创意优劣的标准，再开始发散", "从彼此明显不同的方向提出候选，避免同义改写凑数", "说明每个方向的记忆点、适用情境和潜在风险", "按标准筛选最值得推进的候选，并说明取舍与落地建议"],
    checks: ["候选方向存在真实差异", "每个候选都有具体亮点而非只有名称", "有明确推荐、取舍理由和可行性提醒"],
  },
  data: {
    role: "重视统计口径和证据边界的数据分析师",
    steps: ["先列出指标定义、时间范围和缺失数据，避免直接猜测原因", "按关键维度拆解变化并定位贡献最大的环节", "区分观察到的变化、相关性证据和因果推测", "给出下一步需要验证的数据与具体动作"],
    checks: ["所有数字都能追溯到用户输入", "统计口径与数据局限清楚", "没有把相关性直接写成因果"],
  },
  work: {
    role: "擅长让对方快速理解并采取行动的职场沟通顾问",
    steps: ["先说明沟通目的，以及对方读完后需要知道或做什么", "按重要性组织信息，删除不影响决策的铺垫", "把下一步写成可执行动作，缺失的人名日期使用明确占位", "检查语气、承诺和事实是否与原文一致"],
    checks: ["目的和重点在开头即可看见", "下一步具体、可执行且责任边界清楚", "没有虚构人名、日期、承诺或经历"],
  },
  general: {
    role: "能把模糊需求转成直接可用结果的领域专家",
    steps: ["先明确最终结果和做好它的判断标准", "采用已声明的合理假设补齐必要条件", "直接完成核心交付，不用方法论代替实际结果", "检查是否完整回应原需求并说明重要不确定性"],
    checks: ["结果直接回应原始目标", "内容具体可用而非泛泛建议", "重要假设和不确定性已标明"],
  },
};

const BASE_SECTIONS = [
  { id: "goal", title: "目标与交付", purpose: "说明最终要解决什么、给谁使用、交付物是什么，以及为什么这样做" },
  { id: "source", title: "原始需求与已知信息", purpose: "原文放在独立标签中；事实、用户约束与默认假设分开，防止把推断写成事实" },
  { id: "instructions", title: "执行步骤", purpose: "仅保留会影响结果的步骤；顺序重要时使用编号，内容由任务领域决定" },
  { id: "output", title: "输出契约", purpose: "明确结构、格式、语气、篇幅和必须包含的内容，让结果可以验收" },
  { id: "quality", title: "质量检查", purpose: "给出 2-4 条可观察的验收标准，要求交付前内部核对，不输出核对过程" },
] as const;

const ENGLISH_SECTIONS = [
  { id: "goal", title: "Goal and deliverable", purpose: "The user's actual job, audience, deliverable and why it matters" },
  { id: "source", title: "Request and known information", purpose: "Verbatim original in its own tag; separate known facts from provisional assumptions" },
  { id: "instructions", title: "Execution plan", purpose: "Only the task-specific steps needed to produce the result" },
  { id: "output", title: "Output contract", purpose: "Deliverable, format, structure, tone and working behavior" },
  { id: "quality", title: "Quality checks", purpose: "A few observable acceptance criteria checked before delivery" },
] as const;

export function createBlueprint(analysis: NeedAnalysis): PromptBlueprint {
  const profile = PROFILES[analysis.category] || PROFILES.general;
  const frontend = analysis.frontend;
  const english = isEnglishRequest(analysis.text);
  const steps = frontend ? english ? [
    `Choose the job of this ${frontend.label} and the main visitor action. ${frontend.visualDirection}`,
    `Set the composition and content order: ${frontend.composition} Give typography and colors clear jobs.`,
    `Plan relevant media and working interactions: ${frontend.visualAnchor} ${frontend.interactions}`,
    `Implement and check mobile/desktop behavior: ${frontend.implementation}`,
  ] : [
    `确定这次${frontend.label}的用途和唯一最重要的用户行为；${frontend.visualDirection}`,
    `组织页面构图与内容顺序：${frontend.composition} 字体与颜色按职责定义，而非装饰性堆叠。`,
    `确定相关视觉素材与交互：${frontend.visualAnchor} ${frontend.interactions}`,
    `按原有技术栈实现并在手机与桌面验证：${frontend.implementation}`,
  ] : analysis.complexity === "simple" ? profile.steps.filter((_, index) => index !== 1).slice(0, 3) : [...profile.steps];
  const frontendChecks = frontend ? english ? [
    "The visual direction fits the visitor's job, with one focused first-view or core workspace task",
    "Type hierarchy, color roles, relevant media and content rhythm remain consistent and readable",
    "The main interaction works; mobile/desktop layout and keyboard focus can be verified",
  ] : [
    "视觉方向与目标用户一致，首屏或核心工作区只有一个清楚的任务",
    "字体层级、颜色职责、素材与页面节奏一致且可读",
    "主要交互真实可用，手机/桌面布局与键盘焦点可验证",
  ] : profile.checks;
  const checks = [...new Set([...analysis.successCriteria, ...frontendChecks])].filter(Boolean).slice(0, 4);
  return { role: analysis.role || profile.role, sections: english ? ENGLISH_SECTIONS : BASE_SECTIONS, steps, checks };
}

/** Serialised for the builder, keeping dynamic context separate from its rules. */
export function blueprintContext(analysis: NeedAnalysis, blueprint: PromptBlueprint, original: string) {
  return {
    goal: analysis.goal,
    domain: analysis.domain,
    audience: analysis.audience,
    deliverable: analysis.deliverable,
    knownFacts: analysis.knownFacts,
    explicitConstraints: analysis.constraints,
    defaultAssumptions: analysis.assumptions,
    hiddenNeedsToAddress: analysis.hiddenNeeds,
    output: { tone: analysis.tone, format: analysis.format },
    architecture: blueprint.sections,
    executionGuidance: blueprint.steps,
    acceptanceCriteria: blueprint.checks,
    originalRequest: original,
    ...(analysis.frontend ? {
      frontendBrief: analysis.frontend,
      designReferenceLessons: FRONTEND_REFERENCES.map(reference => `${reference.name}: ${isEnglishRequest(original) ? reference.lessonEn : reference.lesson}`),
      language: isEnglishRequest(original) ? "English" : "中文",
    } : {}),
  };
}

export const PROMPT_ENGINEERING_REFERENCES = [
  { name: "OpenAI · Prompt engineering", url: "https://platform.openai.com/docs/guides/prompt-engineering", note: "Identity → Instructions → Examples → Context；结构化分隔、少样本示例与系统化评估。" },
  { name: "Anthropic · Prompting best practices", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices", note: "清晰直接、解释约束原因、结构化示例、任务拆链与交付前自检。" },
  { name: "Anthropic · Define success criteria and evals", url: "https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests", note: "先定义可衡量的成功标准，再用代码或模型评分迭代提示词。" },
  { name: "Google Gemini · Prompt design strategies", url: "https://ai.google.dev/gemini-api/docs/prompting-strategies", note: "精确直接、结构一致、明确参数、复杂任务分步。" },
  { name: "Anthropic Skills · skill-creator", url: "https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md", note: "提示词保持精简，解释为什么；用真实测试用例评估，而不是不断堆叠规则。" },
] as const;
