/**
 * Starter knowledge for a prompt-writing studio.
 *
 * Every entry is an editable knowledge note (source: "seed"), not a frozen
 * built-in. Content focuses on how to write prompts that reliably produce good
 * results — especially for design and front-end work — and cites the primary
 * documentation it is derived from so the claim can be verified.
 *
 * Deleting every entry does not re-seed it. `SEED_VERSION` lets a newer starter
 * set replace older seed entries without touching anything the user wrote.
 */
import type { KnowledgeEntry } from "@/lib/knowledge";

export const SEED_VERSION = 2;

interface SeedSpec {
  name: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  accent: string;
  sourceUrl?: string;
}

const SEED_SPECS: SeedSpec[] = [
  {
    name: "提示词五段结构", category: "效率",
    description: "复杂任务的通用骨架：目标 → 上下文 → 步骤 → 输出契约 → 验收",
    content:
      "把提示词分成五段，每段只回答一个问题：\n" +
      "1. 目标与交付物：最终要得到什么，给谁用。\n" +
      "2. 上下文与已知事实：只写已确认的信息；缺失处显式标注「假设」，不要编造。\n" +
      "3. 执行步骤：按顺序编号，说明每一步的输入与产出。\n" +
      "4. 输出契约：格式、字段、长度、语言，以及无法完成时如何说明。\n" +
      "5. 质量检查：给出 3–5 条可勾选的验收标准，让结果能被检验。\n" +
      "示例开头：「目标：为 25–35 岁城市上班族写一版低糖烘焙店落地页文案。」短提示词不需要五段，够用即可。",
    tags: ["结构", "输出", "验收"], accent: "violet",
    sourceUrl: "https://platform.openai.com/docs/guides/prompt-engineering",
  },
  {
    name: "输出契约写法", category: "效率",
    description: "先定义结果的形状，再让模型填充内容",
    content:
      "输出契约把「写得好」变成可检查的条件：\n" +
      "· 结构：分几段 / 几个字段，每段一句话还是三条要点。\n" +
      "· 长度：给出数字区间（如 80–120 字），避免「简短一点」这类模糊词。\n" +
      "· 语言与语气：中文 / 英文，正式或口语，是否允许行话。\n" +
      "· 已知与未知：没有依据时输出「未提供」，不要补造事实。\n" +
      "· 失败处理：信息不足时先列出需要补充的 3 个问题，再给临时版本。\n" +
      "反面例子：「写一段吸引人的介绍」。正面例子：「写 3 条各不超过 24 字的标题，动词开头，不使用最高级形容词。」",
    tags: ["输出", "约束", "验收"], accent: "cyan",
    sourceUrl: "https://platform.openai.com/docs/guides/prompt-engineering",
  },
  {
    name: "约束与反例优先", category: "效率",
    description: "用可执行的正向规则替代「不要做得差」",
    content:
      "约束要能被机器执行，也要能被审阅：\n" +
      "· 正向描述：与其说「不要啰嗦」，不如说「每个要点不超过 25 字，全文不超过 5 个要点」。\n" +
      "· 禁用清单：明确禁止最高级、编造数据、虚构客户评价、真实姓名与联系方式。\n" +
      "· 冲突优先级：当品牌语气与转化目标冲突时，先保证事实准确，再优化表达。\n" +
      "· 边界情形：列出 2–3 个容易出错的输入（空数据、超长文本、多语言），说明期望输出。\n" +
      "把约束集中放在一段，避免散落在提示词各处造成重复与冲突。",
    tags: ["约束", "验收", "结构"], accent: "rose",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
  },
  {
    name: "示例驱动（Few-shot）", category: "写作",
    description: "一到两个高质量示例，胜过十句形容词",
    content:
      "示例用于固定格式、语气与判断边界，而不是堆量：\n" +
      "· 数量：先用 1–2 个高质量示例；只有效果不足时才增加到 3–5 个。\n" +
      "· 覆盖：一个正常样例 + 一个边界样例（信息缺失或格式特殊）。\n" +
      "· 形式：用 <example> 包裹输入与输出，和真正的任务分开，避免模型把示例当成待处理内容。\n" +
      "· 一致：示例的格式必须与输出契约完全一致；示例写得随意，输出也会随意。\n" +
      "· 成本：示例会占用上下文并增加费用，定期删掉不再影响结果的示例，用同一组测试用例复测。",
    tags: ["示例", "输出", "约束"], accent: "amber",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags",
  },
  {
    name: "用 XML 标签分隔资料与指令", category: "效率",
    description: "当提示词同时包含资料、示例和指令时，先分块再提问",
    content:
      "多个区块混在一起时，模型容易把资料当指令、把示例当任务。用一致的标签区分：\n" +
      "<context>品牌事实、产品数据、参考网站笔记</context>\n" +
      "<instructions>本次要完成的步骤和顺序</instructions>\n" +
      "<examples>输入 / 输出示范</examples>\n" +
      "<output_format>字段、长度、语言</output_format>\n" +
      "规则：标签名描述用途而不是位置；同一套名字在项目内保持一致；短小的单一任务不必使用标签。\n" +
      "提示词超过两三个区块时，标签能显著降低误解，也方便日后只替换其中一段。",
    tags: ["结构", "上下文", "输出"], accent: "slate",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags",
  },
  {
    name: "长资料放前面，问题放最后", category: "数据",
    description: "长文档任务的顺序与引用约定，减少遗漏和编造",
    content:
      "处理长文档或多份资料时：\n" +
      "· 顺序：长资料放在提示词前部，具体问题与输出要求放在末尾，模型更容易聚焦最后一问。\n" +
      "· 分块：每份资料使用独立的 <document> 标签，附带来源、日期等元信息。\n" +
      "· 先摘录再回答：要求先引用与问题相关的原文片段（<quotes>），再给出结论。\n" +
      "· 不臆测：只依据给定资料作答；资料未覆盖时回答「资料中未提及」，并列出需要补充的内容。\n" +
      "· 冲突处理：不同资料矛盾时，优先最新且标注为权威来源的一方，并说明分歧。",
    tags: ["上下文", "引用", "输出"], accent: "lime",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips",
  },
  {
    name: "设计提示：先定信息架构", category: "开发",
    description: "先决定页面按什么顺序说服人，再决定长什么样",
    content:
      "生成网页前先让模型输出结构，而不是直接写代码：\n" +
      "1. 一句话价值主张：为谁、解决什么、凭什么可信。\n" +
      "2. 段落清单：Hero → 能力/证据 → 工作方式 → 社会证明 → 价格 → FAQ → 收尾 CTA。\n" +
      "3. 每段只承担一个任务，并说明它如何引向下一段。\n" +
      "4. 标出唯一的主动作，其他链接降级为次级样式。\n" +
      "5. 确认结构后再要求实现：组件、间距节奏、响应式断点。\n" +
      "一次要求整页实现，通常得到的是「看起来像网站」的填充内容；分段推进更容易得到可用的真实内容。",
    tags: ["视觉", "结构", "布局"], accent: "lime",
    sourceUrl: "https://docs.lovable.dev/prompting/prompting-one",
  },
  {
    name: "设计令牌与间距节奏", category: "开发",
    description: "用具体数值与职责替代「现代、干净、高级」",
    content:
      "形容词不构成指令。把视觉要求写成可实现的令牌：\n" +
      "· 字体：展示字与正文字体（可用系统字体栈），字号阶梯 12/14/16/24/40，行高 1.5–1.7，正文行长 60–75 字符。\n" +
      "· 颜色：画布、表面、正文、次要文字、边框、唯一行动色，各写清用途；正文对比度 ≥ 4.5:1。\n" +
      "· 间距：4px 基准，段落间距 24/32/48，卡片内边距 20–28；同一层级只用一个值。\n" +
      "· 形状：圆角 8–12，边框 1px，阴影只用于浮层。\n" +
      "· 布局：最大内容宽度 1100–1240，双栏在 768px 以下改为单栏。\n" +
      "把这些写成 DESIGN.md，后续每个新页面都复用它，视觉才不会逐页漂移。",
    tags: ["视觉", "布局", "验收"], accent: "cyan",
    sourceUrl: "https://styles.refero.design/design-md/design-md-template",
  },
  {
    name: "按组件迭代，不重写整页", category: "开发",
    description: "一次只改一个区块，反馈更准，返工更少",
    content:
      "把页面拆成可独立验收的区块：导航、Hero、特性网格、证言、价格、FAQ、页脚。\n" +
      "· 首次生成：先搭骨架与真实文案，再做视觉细节。\n" +
      "· 迭代指令要定位：说明区块名、要改的属性、参考对象，例如「把价格卡的圆角与间距对齐特性卡，行动色只用于主按钮」。\n" +
      "· 不要整页重来：大提示词会同时改动无关部分，让已正确的区块退化。\n" +
      "· 每次修改后检查：三个断点、空/加载/错误状态、键盘焦点、对比度。\n" +
      "· 保留护栏：在提示词中固定「不要新增功能、不要改品牌色、不要替换真实文案」。",
    tags: ["布局", "验收", "迭代"], accent: "violet",
    sourceUrl: "https://docs.lovable.dev/prompting/prompting-one",
  },
  {
    name: "研究参考网站的正确方法", category: "创意",
    description: "学结构与决策，不抄内容与视觉细节",
    content:
      "参考站点的价值在于可迁移的决策，而不是像素复制：\n" +
      "· 选样本：按用途选 3–5 个（产品发布、作品集、文档站），覆盖不同信息密度。\n" +
      "· 记录维度：版心宽度、栅格、字号阶梯、颜色职责、留白节奏、主行动位置、动效触发方式。\n" +
      "· 提炼规则：写成「因为要达成 X，所以采用 Y」的句式，例如「因为首屏要快速建立信任，所以证言紧跟主 CTA」。\n" +
      "· 禁止照搬：不复制品牌名、文案、插图与独特视觉资产；不把参考站的事实当成客户事实。\n" +
      "· 交付：一份 DESIGN.md + 一页结构草图，作为提示词中的 <context>。",
    tags: ["视觉", "布局", "引用"], accent: "amber",
    sourceUrl: "https://recent.design/websites",
  },
  {
    name: "动效规格要可执行", category: "开发",
    description: "触发、时长、缓动、顺序与降级，一个都不能少",
    content:
      "「加一点流畅的动画」不是规格。写成：\n" +
      "· 触发：进入视口 / 悬停 / 点击 / 滚动进度，明确哪一个。\n" +
      "· 属性：只动 opacity 与 transform，避免触发布局重排。\n" +
      "· 时长与缓动：120–220ms 用于反馈，300–600ms 用于区块入场；缓动 cubic-bezier(.2,.8,.2,1)。\n" +
      "· 顺序与节奏：列表按 40–60ms 递延，最多 6 个元素。\n" +
      "· 降级：prefers-reduced-motion 时改为无位移的淡入；移动端减少位移距离。\n" +
      "· 克制：动效服务于理解层级与状态变化，不用于装饰每个元素。",
    tags: ["动效", "验收", "视觉"], accent: "slate",
    sourceUrl: "https://www.scrolltide.co/academy/build-an-animated-website-from-one-prompt",
  },
  {
    name: "迭代与测试，而不是祈祷", category: "分析",
    description: "用一组小测试集判断提示词是否真的变好",
    content:
      "提示词工程是实验，不是写作文：\n" +
      "· 建测试集：收集 10–30 条真实输入，覆盖正常、边界与失败情况，记录理想输出或判定标准。\n" +
      "· 一次只改一处：改结构、改约束、改示例要分开测试，才能知道哪一处起了作用。\n" +
      "· 指标：格式合规率、事实错误数、需要人工重写的比例，而不是「感觉更好」。\n" +
      "· 回归：每次修改都跑同一组用例；有提升才保留，避免为新场景牺牲旧场景。\n" +
      "· 精简：删除不承载需求的段落与示例，指令只写一次；更短的提示词通常更稳定、更便宜。",
    tags: ["迭代", "验收", "结构"], accent: "lime",
    sourceUrl: "https://platform.openai.com/docs/guides/prompt-engineering",
  },
];

/** Stable ids start at 201 so built-in template ids (-1..-9) never collide. */
export function buildSeedKnowledge(idOffset = 0, createdAtOffset = 0): KnowledgeEntry[] {
  return SEED_SPECS.map((item, index) => ({
    id: 201 + idOffset + index,
    name: item.name,
    category: item.category,
    description: item.description,
    templateText: item.content,
    tags: item.tags,
    enabled: true,
    isBuiltin: false,
    accent: item.accent,
    scenario: "general",
    source: "seed",
    sourceUrl: item.sourceUrl,
    createdAt: new Date(Date.UTC(2026, 0, 1 + index + createdAtOffset)).toISOString(),
  }));
}

export const SEED_KNOWLEDGE: KnowledgeEntry[] = buildSeedKnowledge();

/**
 * Pure migration used by the preview backend.
 * Returns the new entry list when the stored starter set is outdated, or null
 * when nothing should change. User-authored and user-edited entries survive:
 * only entries whose `source` is "seed" are replaced.
 */
export function seedKnowledgeFor(stored: string | null, version: number): { entries: KnowledgeEntry[]; version: number } | null {
  if (stored === null) return { entries: SEED_KNOWLEDGE, version: SEED_VERSION };
  if (version >= SEED_VERSION) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(stored); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const kept = parsed.filter(item => !(item && typeof item === "object" && (item as Record<string, unknown>).source === "seed"));
  const highestId = kept.reduce((max, item) => {
    const id = Number((item as Record<string, unknown> | null)?.id);
    return Number.isFinite(id) ? Math.max(max, id) : max;
  }, 200);
  return { entries: [...buildSeedKnowledge(highestId + 1 - 201), ...kept] as KnowledgeEntry[], version: SEED_VERSION };
}
