// PromptForge shared domain model and transparent, offline-capable prompt engine.
// Local scores describe instruction completeness; they are not a prediction of model performance.

export type Strategy = "precise" | "deep" | "creative";
export type Detail = "compact" | "balanced" | "detailed";
export type EngineMode = "local" | "ai";
export type ProviderId = "pollinations" | "openrouter" | "openai" | "deepseek" | "siliconflow" | "custom";

export interface ModelConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface OptimizeOptions {
  scenario: string;
  strategy: Strategy;
  detail: Detail;
  role: string;
  context: string;
  audience: string;
  deliverable: string;
  successCriteria: string;
  mustInclude: string;
  avoid: string;
  tone: string;
  format: string;
  language: string;
  enableRole: boolean;
  enableReasoning: boolean;
  enableExplore: boolean;
  enableSelfCheck: boolean;
  example: string;
}

export interface DimensionScore {
  key: string;
  label: string;
  score: number;
  comment: string;
}

export interface DiagnosticIssue {
  id: string;
  title: string;
  detail: string;
  action: string;
}

export interface AnalysisResult {
  score: number;
  dimensions: DimensionScore[];
  issues: DiagnosticIssue[];
  strengths: string[];
}

export interface OptimizeResult {
  optimized: string;
  before: AnalysisResult;
  after: AnalysisResult;
  changes: string[];
  rationale: string;
  engine: EngineMode;
  model?: string;
  historyId?: number;
  createdAt?: string;
}

export interface Scenario {
  id: string;
  label: string;
  en: string;
  role: string;
  focus: string;
  focusEn: string;
  checkpoints: string[];
  checkpointsEn: string[];
  keywords: string[];
}

export const SCENARIOS: Scenario[] = [
  { id: "general", label: "通用任务", en: "General", role: "有经验的领域专家", focus: "厘清目标、补全关键条件，并给出直接可用的结果", focusEn: "clarify the objective, identify missing conditions, and deliver an immediately usable result", checkpoints: ["完整覆盖核心任务", "内容具体而非泛泛而谈", "关键假设有明确说明"], checkpointsEn: ["Cover the full task", "Be specific and actionable", "State important assumptions"], keywords: [] },
  { id: "writing", label: "内容写作", en: "Writing", role: "资深编辑与写作者", focus: "抓住读者、组织清晰叙事，保持自然且有辨识度的表达", focusEn: "write for the intended reader with a clear narrative and a distinctive natural voice", checkpoints: ["开头抓住注意力", "每段都有实质信息", "风格前后一致"], checkpointsEn: ["Open with a clear hook", "Make each paragraph useful", "Keep the voice consistent"], keywords: ["文章", "写作", "改写", "润色", "博客", "故事", "小说", "散文", "公众号", "文稿", "write an article", "blog post", "essay"] },
  { id: "coding", label: "代码开发", en: "Development", role: "资深软件工程师", focus: "实现可运行的方案，兼顾边界情况、可维护性与安全性", focusEn: "deliver runnable code with sensible handling of edge cases, maintainability, and security", checkpoints: ["说明运行方式和依赖", "覆盖错误与边界情况", "避免虚构不存在的 API"], checkpointsEn: ["Explain setup and dependencies", "Handle errors and edge cases", "Do not invent APIs"], keywords: ["代码", "编程", "程序", "脚本", "爬虫", "接口", "前端", "后端", "python", "javascript", "typescript", "react", "next.js", "sql", "api", "bug", "code", "function"] },
  { id: "analysis", label: "分析决策", en: "Analysis", role: "战略分析师", focus: "先给结论，再展开依据、替代方案和风险", focusEn: "lead with conclusions, then explain evidence, alternatives, and risks", checkpoints: ["区分事实与推测", "比较至少两种可行方案", "指出风险与不确定性"], checkpointsEn: ["Separate facts from assumptions", "Compare viable alternatives", "Explain uncertainty and risks"], keywords: ["分析", "评估", "对比", "前景", "趋势", "决策", "研究", "利弊", "可行性", "战略", "analyze", "compare", "evaluate"] },
  { id: "marketing", label: "营销增长", en: "Marketing", role: "品牌策略与增长顾问", focus: "洞察受众痛点，把产品特点转化为可感知的价值", focusEn: "identify audience pain points and turn product features into compelling benefits", checkpoints: ["卖点明确且真实", "语言贴合目标人群", "有清晰的行动指引"], checkpointsEn: ["Make claims specific and truthful", "Write for the audience", "Include a clear next step"], keywords: ["营销", "文案", "广告", "推广", "品牌", "卖点", "转化", "小红书", "抖音", "种草", "宣传", "marketing", "campaign", "copywriting"] },
  { id: "learning", label: "学习解释", en: "Learning", role: "善于启发的教学导师", focus: "由浅入深解释概念，用例子帮助真正理解", focusEn: "explain concepts progressively with concrete examples that build understanding", checkpoints: ["先解释直觉再解释原理", "给出具体例子", "指出常见误解"], checkpointsEn: ["Build intuition before theory", "Include concrete examples", "Address common misconceptions"], keywords: ["解释", "讲解", "教我", "学习", "入门", "理解", "原理", "是什么", "教程", "explain", "teach", "learn"] },
  { id: "creative", label: "灵感创意", en: "Creative", role: "跨领域创意总监", focus: "发散不同方向，寻找新颖但可落地的想法", focusEn: "explore distinct directions and find original ideas that can actually be used", checkpoints: ["不同方案有明显差异", "每个方向说明亮点", "考虑落地可行性"], checkpointsEn: ["Offer meaningfully different ideas", "Explain each idea's appeal", "Consider feasibility"], keywords: ["创意", "点子", "脑暴", "头脑风暴", "取名", "名字", "命名", "灵感", "idea", "brainstorm", "name ideas"] },
  { id: "data", label: "数据洞察", en: "Data", role: "数据分析师", focus: "澄清统计口径，区分相关和因果，并用数据支持结论", focusEn: "clarify metrics, separate correlation from causation, and support findings with data", checkpoints: ["说明数据口径", "结论有数字依据", "标明数据局限"], checkpointsEn: ["Define the metrics", "Support findings with numbers", "Note data limitations"], keywords: ["数据", "指标", "统计", "报表", "表格", "图表", "增长率", "留存", "转化率", "dataset", "statistics", "metrics"] },
  { id: "work", label: "职场效率", en: "Productivity", role: "高效的职场沟通顾问", focus: "提炼重点、明确责任与下一步行动", focusEn: "surface the key point, clarify ownership, and make next actions explicit", checkpoints: ["目的清晰", "信息层级明确", "下一步可直接执行"], checkpointsEn: ["State the purpose clearly", "Prioritize information", "Make next steps executable"], keywords: ["邮件", "会议", "汇报", "总结", "周报", "简历", "面试", "方案", "计划", "email", "meeting", "resume"] },
];

export const STRATEGIES: { id: Strategy; label: string; en: string; description: string }[] = [
  { id: "precise", label: "精准表达", en: "PRECISION", description: "消除歧义，让指令更可执行" },
  { id: "deep", label: "深度推演", en: "DEPTH", description: "多角度思考，追问依据与边界" },
  { id: "creative", label: "创意发散", en: "EXPLORATION", description: "打开思路，探索不止一种答案" },
];

export const FORMATS = [
  { value: "auto", label: "智能匹配" },
  { value: "markdown", label: "Markdown 分层" },
  { value: "list", label: "分点清单" },
  { value: "table", label: "对比表格" },
  { value: "steps", label: "步骤指南" },
  { value: "json", label: "JSON 数据" },
  { value: "prose", label: "自然段落" },
];
export const TONES = [
  { value: "auto", label: "随任务自然调整" },
  { value: "professional", label: "专业严谨" },
  { value: "friendly", label: "亲切易懂" },
  { value: "concise", label: "简洁直接" },
  { value: "inspiring", label: "生动有感染力" },
];
export const LANGUAGES = [
  { value: "auto", label: "跟随原文" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export const DEFAULT_OPTIONS: OptimizeOptions = {
  scenario: "auto",
  strategy: "precise",
  detail: "balanced",
  role: "",
  context: "",
  audience: "",
  deliverable: "",
  successCriteria: "",
  mustInclude: "",
  avoid: "",
  tone: "auto",
  format: "auto",
  language: "auto",
  enableRole: true,
  enableReasoning: true,
  enableExplore: false,
  enableSelfCheck: true,
  example: "",
};

export function normalizeOptions(value: unknown): OptimizeOptions {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: keyof OptimizeOptions, max = 2000) =>
    typeof raw[key] === "string" ? (raw[key] as string).trim().slice(0, max) : DEFAULT_OPTIONS[key] as string;
  const choice = <T extends string>(key: keyof OptimizeOptions, choices: readonly T[], fallback: T): T =>
    choices.includes(raw[key] as T) ? raw[key] as T : fallback;
  const flag = (key: keyof OptimizeOptions) =>
    typeof raw[key] === "boolean" ? raw[key] as boolean : DEFAULT_OPTIONS[key] as boolean;
  return {
    scenario: choice("scenario", ["auto", ...SCENARIOS.map(s => s.id)], "auto"),
    strategy: choice("strategy", ["precise", "deep", "creative"] as const, "precise"),
    detail: choice("detail", ["compact", "balanced", "detailed"] as const, "balanced"),
    role: text("role", 150), context: text("context"), audience: text("audience", 200),
    deliverable: text("deliverable", 300), successCriteria: text("successCriteria", 500),
    mustInclude: text("mustInclude", 500), avoid: text("avoid", 500),
    tone: choice("tone", TONES.map(t => t.value), "auto"),
    format: choice("format", FORMATS.map(f => f.value), "auto"),
    language: choice("language", LANGUAGES.map(l => l.value), "auto"),
    enableRole: flag("enableRole"), enableReasoning: flag("enableReasoning"),
    enableExplore: flag("enableExplore"), enableSelfCheck: flag("enableSelfCheck"),
    example: text("example", 1500),
  };
}

export function inferScenario(raw: string): Scenario {
  if (!raw.trim()) return SCENARIOS[0];
  const text = raw.toLowerCase();
  let best = SCENARIOS[0];
  let bestScore = 0;
  for (const scenario of SCENARIOS.slice(1)) {
    let score = 0;
    for (const word of scenario.keywords) {
      if (text.includes(word.toLowerCase())) score += word.length >= 3 ? 2 : 1;
    }
    if (score > bestScore) { best = scenario; bestScore = score; }
  }
  return best;
}

export function resolveScenario(raw: string, selected: string): Scenario {
  return selected === "auto" ? inferScenario(raw) : SCENARIOS.find(s => s.id === selected) ?? SCENARIOS[0];
}

interface TaskIntent { id: string; label: string; zh: string; en: string; test: RegExp }
const TASK_INTENTS: TaskIntent[] = [
  { id: "code", label: "实现功能", zh: "先明确运行环境、输入与输出，再给出可执行的实现；对错误情况做明确处理。", en: "Clarify runtime, inputs, and outputs; deliver a working implementation and handle failure cases.", test: /(?:代码|程序|脚本|爬虫|函数|接口|python|javascript|typescript|react|sql|implement|build an app|write code)/i },
  { id: "compare", label: "比较选择", zh: "先定义比较维度，再逐项比较关键差异；最后按不同条件给出有依据的选择建议。", en: "Define comparison criteria, evaluate the meaningful differences, and recommend options for different conditions.", test: /(?:对比|比较|选哪个|哪个更|利弊|取舍|vs\.?|versus|compare|which is better)/i },
  { id: "plan", label: "制定计划", zh: "把目标拆成阶段、关键动作与检查点；标出依赖、资源约束和完成标准。", en: "Break the goal into phases, actions, and milestones; identify dependencies, constraints, and success measures.", test: /(?:计划|规划|路线图|时间表|方案|安排|日程|plan|roadmap|schedule)/i },
  { id: "explain", label: "解释概念", zh: "先用直觉或生活类比建立理解，再解释关键原理；给出例子并指出容易混淆的地方。", en: "Build intuition first, explain the core mechanism, then give an example and address common misunderstandings.", test: /(?:解释|讲解|是什么|为什么|原理|教我|入门|explain|what is|why does|teach me)/i },
  { id: "ideate", label: "产生创意", zh: "从不同角度提出互不重复的方向；为每个方向说明亮点与应用场景，再挑出最值得尝试的。", en: "Generate genuinely distinct directions; explain each idea's appeal and use case, then choose the strongest options.", test: /(?:创意|点子|想几个|取名|命名|头脑风暴|灵感|idea|brainstorm|name ideas)/i },
  { id: "write", label: "组织写作", zh: "先明确读者与核心观点，再决定内容结构；用具体细节支撑表达，删掉空泛套话。", en: "Identify the reader and main point, then structure the piece with concrete details rather than generic filler.", test: /(?:写|文章|文案|邮件|故事|改写|润色|write|draft|rewrite|copywriting|email)/i },
  { id: "analyze", label: "分析判断", zh: "先说明结论及其依据，再辨别关键变量、反面证据和信息不足之处。", en: "State the finding and its basis, then examine drivers, counterarguments, and missing information.", test: /(?:分析|研究|评估|趋势|前景|数据|analyze|evaluate|research)/i },
  { id: "summarize", label: "提炼信息", zh: "先找出最重要的事实与决定，再分组归纳；保留与下一步行动有关的细节。", en: "Find the most important facts and decisions, group them clearly, and retain actionable details.", test: /(?:总结|归纳|提炼|纪要|摘要|概括|summarize|summary)/i },
];

export function inferIntent(raw: string, scenario?: Scenario): { id: string; label: string; zh: string; en: string } {
  const byId = (id: string) => TASK_INTENTS.find(item => item.id === id);
  let picked: TaskIntent | undefined;
  if (scenario?.id === "coding") picked = byId("code");
  else if (scenario?.id === "writing" && /写|文章|文案|邮件|write|draft|article|email/i.test(raw)) picked = byId("write");
  else if (scenario?.id === "creative") picked = byId("ideate");
  else if (scenario?.id === "learning") picked = byId("explain");
  else if (scenario?.id === "data") picked = byId("analyze");
  else picked = TASK_INTENTS.find(item => item.test.test(raw));
  return picked || { id: "general", label: "明确任务", zh: "先确认最终目标与必要条件，再完成任务；对关键的不确定之处如实说明。", en: "Clarify the outcome and necessary conditions, then complete the task and state meaningful uncertainty." };
}

const TASK_HINTS = [
  { test: /爬虫|抓取|scrap|crawl/i, label: "网页抓取", zh: "明确要抓取的字段、分页与频率；遵守目标站点规则，不绕过访问控制。", en: "Specify fields, pagination, and request limits; respect the site's access rules." },
  { test: /csv|excel|表格文件/i, label: "表格处理", zh: "说明输入列名、异常行处理及导出格式，并附最小输入输出示例。", en: "Specify column names, malformed-row handling, export format, and a minimal input/output example." },
  { test: /文章|博客|公众号|blog|article/i, label: "文章写作", zh: "先确定中心论点和读者收获，再安排开头、主体层次与有用的结尾。", en: "Define the central argument and reader takeaway, then plan the opening, body, and useful conclusion." },
  { test: /邮件|email/i, label: "邮件沟通", zh: "包含清晰主题行、读者需要知道的变化与明确下一步；避免冗长开场。", en: "Include a clear subject line, what the reader needs to know, and a specific next step." },
  { test: /取名|命名|名字|brand name|name ideas/i, label: "命名创意", zh: "让候选名称在发音、记忆点与品牌定位上有差异；商标与域名可用性需另行核查。", en: "Vary pronunciation, memorability, and positioning; note that trademark and domain availability must be verified separately." },
  { test: /数据|指标|报表|statistics|metrics|dataset/i, label: "数据洞察", zh: "先检查数据口径与缺失信息；区分相关性和因果，不凭空补造数字。", en: "Check metric definitions and missing data; distinguish correlation from causation and never fabricate numbers." },
  { test: /营销|广告|推广|种草|marketing|campaign/i, label: "营销表达", zh: "把功能转译为读者可感知的收益；主张要真实具体，结尾给出明确行动。", en: "Translate features into tangible benefits, make truthful specific claims, and end with a clear call to action." },
  { test: /会议|纪要|meeting|minutes/i, label: "会议纪要", zh: "区分已决定的事项、待确认问题与行动项；行动项标注负责人和期限（如原文提供）。", en: "Separate decisions, open questions, and action items; include owners and deadlines when provided." },
  { test: /简历|面试|resume|interview/i, label: "求职材料", zh: "优先使用可核实的真实经历与量化成果，不虚构学历、项目或绩效。", en: "Use verifiable experience and measurable outcomes; never invent credentials or results." },
];

const has = (text: string, regex: RegExp) => regex.test(text);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function analyzeBrief(raw: string, opts: OptimizeOptions): AnalysisResult {
  const additions = [
    opts.context && `背景 / 使用场景：${opts.context}`,
    opts.audience && `目标受众：${opts.audience}`,
    opts.deliverable && `期待交付形式：${opts.deliverable}`,
    opts.successCriteria && `验收标准：${opts.successCriteria}`,
    opts.mustInclude && `必须包含：${opts.mustInclude}`,
    opts.avoid && `避免：${opts.avoid}`,
    opts.format !== "auto" && `输出格式：${FORMATS.find(f => f.value === opts.format)?.label || opts.format}`,
  ].filter(Boolean);
  return analyzePrompt([raw.trim(), ...additions].join("\n"));
}

export function analyzePrompt(raw: string): AnalysisResult {
  const text = raw.trim();
  if (!text) return {
    score: 0,
    dimensions: ["任务目标", "背景语境", "具体细节", "输出形式", "边界约束", "验收标准"].map((label, i) => ({ key: ["goal", "context", "details", "format", "boundary", "quality"][i], label, score: 0, comment: "等待输入" })),
    issues: [], strengths: [],
  };
  const len = text.length;
  const structured = has(text, /(?:^|\n)\s*(?:#{1,3}\s|【[^】]+】|(?:\d+[.、]|[-•])\s)/m);
  const task = has(text, /(?:请|帮我|需要|希望|写|生成|创建|设计|分析|解释|总结|制定|制作|规划|评估|推荐|翻译|列出|提供|改写|教|build|create|write|analyze|explain|design|generate|summarize|compare)/i);
  // A mere mention of "背景" or "受众" in generic instructions is not actual context.
  const explicitContext = has(text, /(?:^|\n)\s*(?:背景(?:\s*\/\s*使用场景)?|已知条件|项目背景|使用场景|Context|Background)\s*[:：]\s*\S+/im);
  const explicitAudience = has(text, /(?:^|\n)\s*(?:目标对象|目标受众|目标读者|读者|Intended audience|Target audience)\s*[:：]\s*\S+/im);
  const context = explicitContext || has(text, /(?:我们是|我是|我们在|我正在|这是一(?:个|份)|这篇.{0,12}(用于|面向)|for our\s+\w+|we are a\s+\w+|our team\s+)/i);
  const audience = explicitAudience || has(text, /(?:面向|写给|读者是|目标客户是).{2,40}(?:读者|用户|客户|学生|新手|经理|人群)|(?:for|to)\s+(?:new|first-time|beginner|non-technical|existing)\s+(?:users?|readers?|customers?|employees?)/i);
  const format = has(text, /输出格式|输出形式|呈现|按.{0,12}(格式|结构|顺序)|markdown|json|表格|列表|清单|分点|分段|步骤|代码块|format|output requirements|bullet|table|step-by-step/i);
  const quantity = has(text, /\d+\s*(?:字|条|点|个|步|页|段|分钟|小时|种|%|倍|天|周|月|行|words?|items?|steps?|examples?)/i);
  const specific = has(text, /例如|比如|举例|示例|参考|具体|细节|包括|涵盖|包含|使用|基于|例子|such as|for example|include|using/i);
  const boundaries = has(text, /不要|避免|仅|只需|不超过|至少|最多|必须|限制|约束|不得|如果.{0,20}(不|没)|未经|不能|不确定|无法确认|不编造|avoid|must|do not|only|limit|constraint|uncertain/i);
  const quality = has(text, /验收|自检|核查|校验|检查|准确|依据|证据|来源|风险|可执行|可验证|成功标准|质量标准|不要编造|quality|verify|check|evidence|success criteria/i);
  const example = has(text, /例如|比如|示例|参考.{0,8}(风格|答案|格式)|example|sample/i);
  const detailSignals = [specific, quantity, example, structured].filter(Boolean).length;

  const dimensions: DimensionScore[] = [
    { key: "goal", label: "任务目标", score: clamp(16 + (task ? 48 : 0) + (len >= 18 ? 17 : 0) + (len >= 45 ? 10 : 0) + (structured ? 7 : 0)), comment: task ? "有明确的任务动作" : "还不清楚希望模型完成什么" },
    { key: "context", label: "背景语境", score: clamp(12 + (context ? 38 : 0) + (audience ? 28 : 0) + (len >= 100 ? 12 : 0) + (structured && context ? 8 : 0)), comment: context ? (audience ? "背景与受众较清楚" : "有背景，可进一步明确受众") : "缺少任务背景或使用场景" },
    { key: "details", label: "具体细节", score: clamp(14 + Math.min(len / 5, 28) + detailSignals * 12), comment: detailSignals >= 2 ? "提供了可操作的细节" : "可以增加更具体的条件或示例" },
    { key: "format", label: "输出形式", score: clamp(12 + (format ? 63 : 0) + (structured ? 20 : 0) + (quantity && format ? 5 : 0)), comment: format ? "已说明如何呈现结果" : "未明确希望得到什么形式的结果" },
    { key: "boundary", label: "边界约束", score: clamp(12 + (boundaries ? 60 : 0) + (quantity ? 15 : 0) + (len >= 140 ? 8 : 0)), comment: boundaries ? "有明确的边界或限制" : "缺少范围和不希望出现的内容" },
    { key: "quality", label: "验收标准", score: clamp(12 + (quality ? 57 : 0) + (specific ? 13 : 0) + (quantity ? 10 : 0) + (structured && quality ? 8 : 0)), comment: quality ? "有可检查的质量要求" : "缺少判断答案好坏的依据" },
  ];
  const score = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const issues: DiagnosticIssue[] = [];
  if (!task || len < 12) issues.push({ id: "goal", title: "目标仍有点模糊", detail: "说清楚希望模型最终做什么，而不只是给出主题。", action: "补充任务" });
  if (!context) issues.push({ id: "context", title: "缺少使用场景", detail: "补充背景、用途或已知条件，减少模型自行猜测。", action: "添加背景" });
  if (!audience) issues.push({ id: "audience", title: "目标对象未明确", detail: "面向谁，会直接改变内容深度和措辞。", action: "填写受众" });
  if (!format) issues.push({ id: "format", title: "交付形式不明确", detail: "指定清单、表格或段落，结果会更贴近预期。", action: "选择格式" });
  if (!boundaries) issues.push({ id: "avoid", title: "缺少边界条件", detail: "告诉模型哪些内容要避免，能减少无关输出。", action: "添加约束" });
  if (!quality) issues.push({ id: "successCriteria", title: "缺少验收标准", detail: "写下你认为好答案应具备的特征。", action: "填写标准" });
  const strengths: string[] = [];
  if (task && len >= 18) strengths.push("任务方向较明确");
  if (context) strengths.push("已经提供使用语境");
  if (format) strengths.push("已明确输出形式");
  if (quantity) strengths.push("有可量化的要求");
  if (quality) strengths.push("有可检查的质量标准");
  return { score, dimensions, issues, strengths };
}

const ZH_FORMAT: Record<string, string> = {
  markdown: "使用 Markdown 标题和分点组织，层级清楚", list: "用精炼的编号清单逐项呈现", table: "适合比较的信息用表格呈现，必要时补充简短结论", steps: "按可执行的步骤逐项展开", json: "只输出合法 JSON，不添加代码围栏或解释性文字", prose: "用自然、连贯的段落呈现，避免不必要的列表",
};
const EN_FORMAT: Record<string, string> = {
  markdown: "Use clear Markdown headings and bullet points", list: "Use a concise numbered list", table: "Use a table for comparisons and add a short conclusion", steps: "Present an actionable step-by-step guide", json: "Return valid JSON only, without code fences or commentary", prose: "Write in natural, coherent paragraphs without unnecessary lists",
};
const ZH_TONE: Record<string, string> = { professional: "专业严谨", friendly: "亲切易懂", concise: "简洁直接", inspiring: "生动有感染力" };
const EN_TONE: Record<string, string> = { professional: "professional and precise", friendly: "approachable and clear", concise: "concise and direct", inspiring: "vivid and engaging" };

export function buildLocalPrompt(raw: string, input: OptimizeOptions, feedback = ""): OptimizeResult {
  const opts = { ...input };
  if (/简短|精炼|压缩|shorter|concise/i.test(feedback)) opts.detail = "compact";
  if (/详细|深入|展开|更长|more detail|expand/i.test(feedback)) opts.detail = "detailed";
  if (/创意|新颖|发散|creative|original/i.test(feedback)) opts.strategy = "creative";
  if (/严谨|准确|逻辑|precise|rigor/i.test(feedback)) opts.strategy = "precise";
  const scenario = resolveScenario(raw, opts.scenario);
  const intent = inferIntent(raw, scenario);
  const matchedHints = TASK_HINTS.filter(item => item.test.test(raw)).slice(0, opts.detail === "detailed" ? 3 : 2);
  const english = opts.language === "en" || (opts.language === "auto" && !/[\u3400-\u9fff]/.test(raw));
  const inferredFormat = intent.id === "compare" ? "table" : intent.id === "plan" || intent.id === "explain" ? "steps" : intent.id === "write" && /邮件|email/i.test(raw) ? "prose" : ({ coding: "markdown", data: "table", analysis: "markdown", marketing: "prose", writing: "prose", creative: "list", learning: "steps", work: "list" }[scenario.id] ?? "markdown");
  const format = opts.format === "auto" ? inferredFormat : opts.format;
  const s: string[] = [];
  const section = (heading: string, body: string) => s.push(`## ${heading}\n${body}`);
  const role = opts.role || scenario.role;
  if (opts.enableRole) section(english ? "Role" : "角色", english ? `Act as a ${opts.role || scenario.en.toLowerCase() + " specialist"}. Your focus: ${scenario.focusEn}.` : `你是一位${role}。你的工作重点是：${scenario.focus}。`);
  section(english ? "Task" : "任务", raw.trim());
  const contextLines = english
    ? [opts.context && `Context: ${opts.context}`, opts.audience && `Intended audience: ${opts.audience}`, opts.deliverable && `Desired deliverable: ${opts.deliverable}`].filter(Boolean)
    : [opts.context && `背景 / 使用场景：${opts.context}`, opts.audience && `目标对象：${opts.audience}`, opts.deliverable && `期待交付：${opts.deliverable}`].filter(Boolean);
  if (contextLines.length) section(english ? "Context" : "已知背景", contextLines.join("\n"));

  const approach: string[] = [english ? intent.en : intent.zh];
  if (english) {
    if (opts.strategy === "precise") approach.push(opts.detail === "compact" ? "Ask only for truly essential missing information; otherwise state assumptions and proceed." : "Resolve ambiguity using the available context. If a missing detail materially changes the answer, ask up to two focused questions; otherwise state reasonable assumptions and proceed.");
    if (opts.strategy === "deep") approach.push(opts.detail === "compact" ? "Consider important trade-offs before reaching a conclusion." : "Examine the problem from multiple relevant perspectives. Compare meaningful alternatives, distinguish evidence from assumptions, and surface trade-offs before reaching a conclusion.");
    if (opts.strategy === "creative") approach.push(opts.detail === "compact" ? "Offer distinct ideas, then select the strongest." : "Explore several meaningfully different approaches before converging. Seek fresh cross-domain ideas, then select the most useful ones and explain their practical implications.");
    for (const hint of matchedHints.slice(0, opts.detail === "compact" ? 1 : 3)) approach.push(hint.en);
    if (opts.enableReasoning) approach.push(opts.detail === "compact" ? "Briefly state the key reasons for your answer." : "Share a concise, checkable explanation of the conclusion rather than an unfiltered internal chain of thought.");
    if (opts.enableExplore) approach.push(opts.strategy === "creative" ? "Include at least one counterintuitive or cross-domain direction and explain why it could work." : opts.detail === "compact" ? "Mention a stronger alternative if relevant." : "Consider a neglected angle or a stronger alternative when it materially improves the result.");
    if (opts.detail === "detailed") approach.push("Include relevant edge cases, concrete examples, and practical next steps where useful.");
  } else {
    if (opts.strategy === "precise") approach.push(opts.detail === "compact" ? "只追问真正影响结果的缺失信息；否则说明假设后直接完成。" : "消除指令里的歧义。如果缺少的信息会明显改变结果，先提出不超过 2 个关键问题；否则说明合理假设后继续，不要凭空编造背景。");
    if (opts.strategy === "deep") approach.push(opts.detail === "compact" ? "考虑关键取舍，再给出结论。" : "从几个与任务相关的角度拆解问题；比较可行方案，区分事实与假设，说明取舍与潜在风险，再得出结论。");
    if (opts.strategy === "creative") approach.push(opts.detail === "compact" ? "给出不同方向的想法，再选出最有潜力的。" : "探索彼此有明显差异的多个方向，允许跨领域联想；再筛选最有价值的方案，解释新意所在和落地方式。");
    for (const hint of matchedHints.slice(0, opts.detail === "compact" ? 1 : 3)) approach.push(hint.zh);
    if (opts.enableReasoning) approach.push(opts.detail === "compact" ? "简要说明结论的关键理由。" : "在答案中给出简洁、可核查的理由摘要；不必展示未经整理的内部思维过程。");
    if (opts.enableExplore) approach.push(opts.strategy === "creative" ? "额外提供至少一个反常规或跨领域的方向，并解释它为什么可能有效。" : opts.detail === "compact" ? "如有更好的替代方案，简要指出。" : "如有容易被忽视的重要角度或更好的替代方案，主动指出并说明价值。");
    if (opts.detail === "detailed") approach.push("在必要处补充边界情况、具体例子和下一步行动，避免停留在抽象建议。");
  }
  if (approach.length) section(english ? "Approach" : "工作方式", approach.map((x, i) => `${i + 1}. ${x}`).join("\n"));

  const requirements: string[] = [];
  if (english) {
    requirements.push(`Format: ${EN_FORMAT[format] || EN_FORMAT.markdown}.`);
    if (opts.tone !== "auto") requirements.push(`Tone: ${EN_TONE[opts.tone] || opts.tone}.`);
    requirements.push(`Level of detail: ${{ compact: "brief and focused", balanced: "substantial but easy to scan", detailed: "thorough and concrete" }[opts.detail]}.`);
    if (opts.mustInclude) requirements.push(`Must include: ${opts.mustInclude}`);
    if (opts.avoid) requirements.push(`Avoid: ${opts.avoid}`);
    if (feedback.trim()) requirements.push(`Revision request: ${feedback.trim()}`);
  } else {
    requirements.push(`输出形式：${ZH_FORMAT[format] || ZH_FORMAT.markdown}。`);
    if (opts.tone !== "auto") requirements.push(`表达语气：${ZH_TONE[opts.tone] || opts.tone}。`);
    requirements.push(`信息密度：${{ compact: "简洁聚焦，只保留最重要的内容", balanced: "信息充分但易于浏览，重点适当展开", detailed: "尽量深入具体，给出支撑细节和可执行步骤" }[opts.detail]}。`);
    if (opts.mustInclude) requirements.push(`必须包含：${opts.mustInclude}`);
    if (opts.avoid) requirements.push(`避免出现：${opts.avoid}`);
    if (feedback.trim()) requirements.push(`本轮调整意见：${feedback.trim()}`);
  }
  section(english ? "Output requirements" : "输出要求", requirements.map((x, i) => `${i + 1}. ${x}`).join("\n"));
  if (opts.example) section(english ? "Style reference" : "参考示例", english ? `Use the following as a reference for style or level of detail, without copying its factual content:\n${opts.example}` : `以下内容仅用于参考表达风格或细致程度，不要照搬其中的事实：\n${opts.example}`);

  const checks = opts.detail === "compact" ? scenario.checkpoints.slice(0, 1) : scenario.checkpoints.slice(0, opts.detail === "detailed" ? 3 : 2);
  const checksEn = opts.detail === "compact" ? scenario.checkpointsEn.slice(0, 1) : scenario.checkpointsEn.slice(0, opts.detail === "detailed" ? 3 : 2);
  const standards = english ? checksEn : checks;
  if (opts.successCriteria) standards.unshift(english ? `Success criteria: ${opts.successCriteria}` : `成功标准：${opts.successCriteria}`);
  if (opts.enableSelfCheck) standards.push(english ? "Before finalizing, check the answer against every criterion above; do not invent facts, and flag uncertainty when it matters." : "提交前对照以上标准逐项自检；不编造无法确认的事实，对重要不确定性明确说明。");
  if (standards.length) section(english ? "Quality bar" : "验收标准", standards.map(x => `- ${x}`).join("\n"));
  const optimized = s.join("\n\n");
  const changes = [
    `识别到「${intent.label}」任务，以「${scenario.label}」场景组织指令`,
    ...(matchedHints.length ? [`补充${matchedHints.map(hint => hint.label).join("、")}相关的专属要求`] : []),
    opts.enableRole ? "匹配领域角色与工作重点" : "保留直接任务指令",
    opts.context || opts.audience || opts.deliverable ? "纳入提供的真实背景与交付目标" : "未虚构缺失的背景信息",
    `将结果明确为「${FORMATS.find(f => f.value === format)?.label || "结构化"}」输出`,
    opts.enableSelfCheck ? "增加提交前可核对的验收标准" : "保留任务相关的质量要求",
    ...(feedback.trim() ? ["依据本轮反馈进行定向调整"] : []),
  ];
  return {
    optimized,
    before: analyzeBrief(raw, input),
    after: analyzePrompt(optimized),
    changes,
    rationale: `识别出「${intent.label}」任务，采用${STRATEGIES.find(s => s.id === opts.strategy)?.label}策略重组指令。${matchedHints.length ? `针对${matchedHints.map(h => h.label).join("、")}加入了任务专属检查项。` : ""}${opts.context ? "已使用你提供的真实背景。" : "没有凭空补写背景，缺失重要信息时会先澄清。"}`, 
    engine: "local",
    createdAt: new Date().toISOString(),
  };
}

export interface BuiltinTemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  templateText: string;
  scenario: string;
  isBuiltin: boolean;
  accent: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: -1, name: "把复杂概念讲明白", category: "学习", description: "先用直觉与比喻建立理解，再讲原理和常见误区。", templateText: "向刚接触机器学习的产品经理解释什么是过拟合。请用一个生活中的比喻开头，再举一个产品推荐系统的例子。", scenario: "learning", isBuiltin: true, accent: "mint" },
  { id: -2, name: "写出有观点的文章", category: "写作", description: "从观点到结构，让内容有信息密度，而不只是顺滑。", templateText: "写一篇面向独立开发者的文章，主题是：为什么小团队更应该重视产品文档。希望观点明确，有真实的工作场景举例。", scenario: "writing", isBuiltin: true, accent: "peach" },
  { id: -3, name: "做一次扎实的决策分析", category: "分析", description: "比较方案、显式假设与风险，适合重要选择。", templateText: "我们是一支 5 人的 SaaS 团队，准备推出新功能。请比较「先做移动端」和「先完善网页端」两个方向的收益、成本与风险。", scenario: "analysis", isBuiltin: true, accent: "violet" },
  { id: -4, name: "生成可运行的代码", category: "开发", description: "让需求、边界条件和交付形式一次说清楚。", templateText: "用 Python 写一个读取 CSV、按月份汇总销售额并导出新 CSV 的脚本。需要处理空值与日期格式错误，并说明如何运行。", scenario: "coding", isBuiltin: true, accent: "blue" },
  { id: -5, name: "为品牌找出好名字", category: "创意", description: "跨角度发散，同时考虑记忆点和实际可用性。", templateText: "为一家主打低糖烘焙的小店想 12 个中文品牌名字。目标顾客是 25–35 岁的城市上班族，希望温暖、好记、不显得过分健康说教。", scenario: "creative", isBuiltin: true, accent: "yellow" },
  { id: -6, name: "拆解一份数据报告", category: "数据", description: "从数字中找到真正重要的变化与下一步行动。", templateText: "分析一份电商店铺的月度经营数据：访问量增长 18%，加购率从 8% 升到 11%，支付转化率从 3.2% 降到 2.6%。请指出优先排查的问题。", scenario: "data", isBuiltin: true, accent: "mint" },
  { id: -7, name: "写一条不套路的营销文案", category: "营销", description: "找到痛点与真实卖点，避免空泛的形容词。", templateText: "为一款帮助自由职业者自动整理发票的工具写 3 条推广文案。目标人群是经常拖延报销的人，语气轻松但不要夸大功能。", scenario: "marketing", isBuiltin: true, accent: "peach" },
  { id: -8, name: "把会议变成行动", category: "效率", description: "快速提炼决定、负责人、待办与时间节点。", templateText: "帮我整理一次产品例会纪要：团队决定下周优先修复注册流程，设计师周三给新稿，工程师周五完成开发，运营下周一准备发布通知。", scenario: "work", isBuiltin: true, accent: "blue" },
  { id: -9, name: "制定靠谱的执行计划", category: "效率", description: "把大目标拆成可交付的阶段、依赖和检查点。", templateText: "我想在 6 周内上线一个面向设计师的作品集网站。只有一名前端开发和一名设计师，请帮我做一个现实可行的分周计划。", scenario: "work", isBuiltin: true, accent: "violet" },
];
