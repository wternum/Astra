/**
 * Initial knowledge base so the library and the knowledge graph are useful on
 * first visit. These are ordinary editable entries (not read-only built-ins),
 * stored once in browser storage. Deleting every entry does not re-seed them.
 */
import type { KnowledgeEntry } from "@/lib/knowledge";

interface SeedSpec {
  name: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  accent: string;
}

const SEED_SPECS: SeedSpec[] = [
  {
    name: "品牌语气规范", category: "品牌",
    description: "面向城市年轻用户的品牌表达规则",
    content: "语气温暖、克制、不端着；避免夸张形容词和空泛口号。品牌表达围绕低糖、日常、可信赖三个词展开。对外文案优先使用短句，不用网络化热词，不编造用户评价。",
    tags: ["语气", "文案", "品牌"], accent: "amber",
  },
  {
    name: "产品价值主张", category: "品牌",
    description: "产品对外沟通时必须守住的三点",
    content: "介绍产品时先说为谁解决什么问题，再说怎么做，最后才是功能清单。所有价值主张必须能从产品现有能力推导出来，禁止使用「行业第一」「彻底改变」等无法证实的说法。",
    tags: ["文案", "品牌", "表达"], accent: "amber",
  },
  {
    name: "网页视觉规范", category: "开发",
    description: "网页与落地页构建的统一视觉约定",
    content: "首屏只表达一个核心主张，配套一个主行动。统一字体层级、画布与行动色职责；桌面与手机断点都要验证，保证文字对比度和键盘焦点。图片缺失时用明确标注的可替换演示素材，不用纯渐变冒充产品图。",
    tags: ["布局", "交互", "视觉"], accent: "cyan",
  },
  {
    name: "前端交付清单", category: "开发",
    description: "任何页面或组件交付前必须完成",
    content: "交付完整可运行源码、运行命令与依赖说明；验证主要导航、按钮、表单状态与键盘操作；检查手机、平板、桌面三个宽度；处理空状态、加载状态与错误状态；使用动效时提供 reduced-motion 退化。",
    tags: ["交互", "布局", "验收"], accent: "cyan",
  },
  {
    name: "数据口径说明", category: "数据",
    description: "分析任务必须遵守的统计约定",
    content: "转化率按自然日统计并排除内部测试账号；环比使用相同长度的时间窗口。相关关系不能直接写成因果，缺失数据需标注为估算或留空，不得补造数字。结论先给口径再给数值。",
    tags: ["指标", "验收", "表达"], accent: "lime",
  },
  {
    name: "会议纪要结构", category: "效率",
    description: "会议记录与决策同步的固定结构",
    content: "分开记录已决定事项、待确认问题和行动项；行动项必须带责任人和时间。没有确认的信息写成「待确认」，不要替团队补写承诺。结尾附一页可执行的下一步。",
    tags: ["表达", "验收", "流程"], accent: "slate",
  },
  {
    name: "对外邮件语气", category: "写作",
    description: "客户沟通邮件的写作约定",
    content: "主题行直接说明目的；正文第一段给出背景与影响，第二段给出补救或方案，结尾给明确下一步。语气诚恳、简洁、承担责任，但不过度致歉，不推卸给第三方。",
    tags: ["语气", "文案", "表达"], accent: "rose",
  },
  {
    name: "长文写作骨架", category: "写作",
    description: "需要观点与信息密度的文章结构",
    content: "先确定读者读完能带走什么，再选一个有立场的切入角度。开头用具体场景，每一段提供新信息，结尾给一两条可执行建议。不编造统计、名人引言或案例。",
    tags: ["文案", "表达", "布局"], accent: "rose",
  },
  {
    name: "营销用词禁区", category: "营销",
    description: "推广内容中禁止出现的主张",
    content: "不使用「最」「第一」「100%」等无法证实的表述；不编造销量、奖项、认证与客户评价。把功能转写成用户能感知的具体收益，结尾给一个真实可完成的行动。",
    tags: ["文案", "品牌", "验收"], accent: "violet",
  },
  {
    name: "新手讲解方法", category: "学习",
    description: "面向零基础受众解释复杂概念",
    content: "先用生活比喻建立直觉，再讲原理，随后给一个完整例子并指出常见误解。术语首次出现时顺手解释；控制在一页以内，结尾用一个小问题帮助读者自查。",
    tags: ["表达", "视觉", "流程"], accent: "violet",
  },
  {
    name: "方案比较框架", category: "分析",
    description: "需要权衡取舍时的分析结构",
    content: "先给倾向性结论，再列出比较维度；至少比较两种真正可行的路径，分别说明适用条件、代价与风险。区分事实、推测与待验证假设，最后给两周内可执行的小规模验证方案。",
    tags: ["指标", "流程", "验收"], accent: "lime",
  },
  {
    name: "创意发散原则", category: "创意",
    description: "命名、构思与灵感类任务的评价标准",
    content: "候选方向之间必须有明显差异，而不是同一想法的换词；每个方向说明亮点、适用情境和潜在风险。最后按记忆点、可落地性筛出推荐项，并提醒商标与重名需另行核查。",
    tags: ["视觉", "品牌", "流程"], accent: "slate",
  },
];

/** Stable ids start at 101 so built-in example ids (-1..-8) never collide. */
export const SEED_KNOWLEDGE: KnowledgeEntry[] = SEED_SPECS.map((item, index) => ({
  id: 101 + index,
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
  createdAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
}));
