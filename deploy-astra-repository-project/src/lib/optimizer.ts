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
  /** "arena" for Arena Code prompts; absent for the general five-section prompt. */
  target?: "arena" | "general";
  /** Arena only: copyable prompts for later turns of the battle. */
  followUps?: string[];
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
  /** Shared keywords so exemplars connect in the knowledge graph. */
  tags?: string[];
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: -1, name: "落地页：Creative Tim 区块组装方案", category: "开发",
    description: "用 hero-01 / feature-01 / pricing-01 / testimonial-01 / footer-01 / navbar-01 生成可直接落地的产品页结构。",
    templateText: `你是一位精通 Creative Tim UI 与 shadcn/ui 的前端架构师。请为【自由职业者发票整理工具】生成一份可直接落地的 Next.js + Tailwind v4 落地页实现方案。

## 已知事实
产品：面向自由职业者的发票整理工具；只做一件事——把散落的发票收进一个可导出的清单。
目标受众：25–35 岁自由职业者，偏移动办公，重视“可导出”与“简洁”。

## 必须使用的 Creative Tim UI 区块（按顺序组合）
请严格引用以下区块 slug 及其职责，不要自行发明其他块：

1. navbar-01 — 顶部导航：左侧 Logo，中间导航链接（功能/定价/关于），右侧 CTA 按钮（“免费试用”），移动端带汉堡菜单。
2. hero-01 — 首屏英雄区：主标题（一句价值主张）、副标题（1–2 句说明）、主行动按钮（橙色，orange-500）、次要行动按钮（幽灵按钮）、右侧插图或产品截图占位。
3. feature-01 — 功能网格：3 列卡片，每卡含 icon、标题、一句话说明；主题：自动归类、一键导出、多端同步。
4. pricing-01 — 定价表：3 个定价卡（免费/专业/团队），每卡含方案名、价格、功能清单（✓/✗）、CTA 按钮；中间卡高亮为“最受欢迎”。
5. testimonial-01 — 用户证言：引用语、作者姓名、职务、头像圆形占位、5 星评分；横向滚动 3 条。
6. footer-01 — 底部：左侧 Logo + 一句话口号，中间导航链接（帮助/隐私/联系），右侧社交图标与版权信息。

## 设计强制规则（不可违背）
- 品牌主色：orange-500（主按钮、活跃态、高亮边框），严禁使用 violet / purple / indigo 作为品牌色。
- 中性表面：slate / gray / zink；状态色：emerald（成功）、amber（警告）、red（错误）、blue（信息）。
- 字体：正文 text-sm，辅助 text-xs（仅用于时间戳、徽章药丸、侧边栏分组标题），禁止 text-[10px] / text-[11px] 等任意字号。
- Tailwind v4：禁止任意值（如 h-[32px]、max-w-[85%]），必须用数字刻度（h-8、w-12、gap-3、p-4）与标准分数宽度（max-w-sm、max-w-2xl、w-1/2）；只用 sm:/md:/lg:/xl: 响应式前缀。
- 组件模式：内容分组用 Card > CardHeader + CardContent；KPI/统计卡用 CardContent className="px-4 py-0"；可溢出列表用 ScrollArea；禁止内联 style={{}}，全用 Tailwind 类。
- 768px 以下改为单栏；正文对比度 ≥ 4.5:1；键盘可完成全部操作；空/加载/错误状态各有一句说明。

## 输出契约（Markdown）
1. 区块清单：列出 6 个区块的 slug、职责、所在层级。
2. 设计令牌：字体阶梯（5 级）、颜色令牌表（名/十六进制/场景/禁止场景）、间距（4px 基准）、断点。
3. 逐区实现：每个区块给出真实中文标题/副标题/文案（不使用占位文案）、组件清单、关键间距数值、响应式行为。
4. 验收表：3–5 条可勾选条件，包含响应式、可访问性、色彩合规。
5. 安装命令：给出 npx @creative-tim/ui@latest add <slug> 的完整安装命令列表。

不要编造客户名或数据；未知的品牌事实标记为「待定」。`,
    scenario: "coding", isBuiltin: true, accent: "orange", tags: ["结构","视觉","布局","验收","creative-tim"],
  },
  {
    id: -2, name: "仪表盘：Creative Tim 数据区块方案", category: "开发",
    description: "用 sidebar-01 / kpi-card-01 / chart-01 / table-01 生成管理后台首屏。",
    templateText: `你是一位精通 Creative Tim UI 与 shadcn/ui 的仪表盘工程师。请为【小型 SaaS 运营后台】生成首屏实现方案。

## 必须使用的 Creative Tim UI 区块
1. sidebar-01 — 左侧导航栏：宽度 w-64，右侧 border-r，背景 bg-muted/30；导航项带图标，激活态高亮；底部放用户资料卡片。
2. kpi-card-01 — 关键指标卡：每卡含指标标签、数值、变动率（↑/↓）、迷你趋势线；CardContent 用 px-4 py-0；横向排列 4 卡（今日收入、活跃用户、转化率、待处理工单）。
3. chart-01 — 数据图表：折线图或柱状图，含坐标轴、图例、悬停提示；仅用 opacity 与 transform 做交互，不触发布局重排。
4. table-01 — 数据表格：表头行、可排序列、分页；每行含操作按钮组（查看/编辑/删除）；可溢出用 ScrollArea。

## 设计强制规则（不可违背）
- 品牌主色：orange-500，严禁 violet / purple / indigo。
- 正文 text-sm，辅助 text-xs；禁止任意字号值。
- Tailwind v4：禁止任意值，只用数字刻度与标准分数宽度；只用 sm:/md:/lg:/xl:。
- 组件模式：Card > CardHeader + CardContent；ScrollArea 处理可溢出列表；禁止内联 style={{}}。
- 侧边栏：w-64，border-r，bg-muted/30。

## 输出契约（Markdown）
1. 布局结构：侧边栏 + 主内容区的划分与断点行为。
2. 区块清单：4 个区块的 slug、职责、数据字段。
3. 逐区实现：每个区块给出真实中文标签、数值示例、组件清单、关键间距、响应式行为。
4. 验收表：可访问性、色彩合规、数据表格可排序与分页。
5. 安装命令：npx @creative-tim/ui@latest add sidebar-01 kpi-card-01 chart-01 table-01。

不要编造真实业务数据；未知字段标记为「待定》。`,
    scenario: "coding", isBuiltin: true, accent: "orange", tags: ["仪表盘","视觉","布局","验收","creative-tim"],
  },
  {
    id: -3, name: "认证页面：Creative Tim 登录注册方案", category: "开发",
    description: "用 login-01 / register-01 生成登录与注册页。",
    templateText: `你是一位精通 Creative Tim UI 与 shadcn/ui 的认证页面工程师。请为【自由职业者发票整理工具】生成登录页与注册页实现方案。

## 必须使用的 Creative Tim UI 区块
1. login-01 — 登录页：邮箱输入框、密码输入框（显示/隐藏切换），“记住我”复选框，“忘记密码”链接、主登录按钮（橙色）、社交登录分隔线与按钮（GitHub/Google）。
2. register-01 — 注册页：全名、邮箱、密码、确认密码输入框，服务条款复选框，主注册按钮（橙色），已有账户登录链接。

## 设计强制规则（不可违背）
- 品牌主色：orange-500，严禁 violet / purple / indigo。
- 正文 text-sm，辅助 text-xs；禁止任意字号值。
- Tailwind v4：禁止任意值，只用数字刻度与标准分数宽度；只用 sm:/md:/lg:/xl:。
- 表单输入框：标签在上方，输入框 focus 态用 orange-500 边框，错误态用 red 边框并显示错误文本。
- 组件模式：Card > CardHeader + CardContent 包裹表单；禁止内联 style={{}}；移动端单栏居中，最大宽度 max-w-md。
- 可访问性：每个输入框有关联 label，错误信息用 aria-describedby，颜色不单独传达信息。

## 输出契约（Markdown）
1. 页面结构：登录页与注册页的路由、布局、断点行为。
2. 区块清单：login-01、register-01 的职责与字段。
3. 逐区实现：每个表单项的标签、占位符、验证规则、错误文本、按钮行为。
4. 验收表：表单验证、错误提示、色彩合规、键盘导航。
5. 安装命令：npx @creative-tim/ui@latest add login-01 register-01。

不要编造真实用户数据；未知字段标记为「待定》。`,
    scenario: "coding", isBuiltin: true, accent: "orange", tags: ["认证","视觉","布局","验收","creative-tim"],
  },
  {
    id: -4, name: "为产品写一份 DESIGN.md", category: "开发",
    description: "把“现代、干净”翻译成可执行的视觉决策，供后续每个页面复用。",
    templateText: `请为下面的产品写一份可直接放进仓库的 DESIGN.md，目标是让不参与设计讨论的开发也能做出风格一致的页面。

产品：面向 20–35 岁用户的阅读与笔记应用，气质克制、安静、偏纸感。

必须包含：
1. 设计原则：3 条，每条一句可检验的规则（例如「留白优先于分割线」）。
2. 品牌色令牌：主色 orange-500（Creative Tim 品牌色）、中性表面 slate/gray/zinc、状态色 emerald/amber/red/blue；给出十六进制、使用场景、禁止场景；严禁 violet / purple / indigo。
3. 字体：展示字/正文字体栈、字号阶梯（至少 5 级，正文 text-sm，辅助 text-xs）、行高、字重用法、正文行长（60–75 字符）；禁止 text-[10px] / text-[11px]。
4. 间距与栅格：4px 基准（h-8、w-12、gap-3、p-4）、常用间距值、内容最大宽度（max-w-2xl）、断点（sm:/md:/lg:/xl:）。
5. 组件：按钮、输入、卡片（Card > CardHeader + CardContent）、标签、空状态的状态与尺寸规则；KPI 卡用 CardContent className="px-4 py-0"。
6. 动效：时长（反馈 120–220ms，入场 300–600ms）、缓动（cubic-bezier(.2,.8,.2,1)）、允许动画的属性（仅 opacity 与 transform）、reduced-motion 降级。
7. 不要做：列出 5 条最容易破坏一致性的做法。
8. Tailwind v4 约束：禁止任意值，只用数字刻度与标准分数宽度；禁止内联 style={{}}。

未知的品牌事实标记为「待定」，不要自行编造。`,
    scenario: "coding", isBuiltin: true, accent: "orange", tags: ["视觉","布局","约束","creative-tim"],
  },
  {
    id: -5, name: "评审页面的视觉层级", category: "分析",
    description: "用可执行的严重度与修改建议做设计批评，而不是泛泛说“不够高级”。",
    templateText: `请以资深视觉设计师的身份评审下面的页面描述，重点看视觉层级而不是个人喜好。

页面：SaaS 分析工具首页。首屏有主标题、副标题、两个按钮、一张产品截图；第二屏是三列特性卡；第三屏是价格表。

输出格式：
1. 一句话结论：这个页面目前最影响理解的问题是什么。
2. 问题清单：每条包含“位置 / 现象 / 为什么影响理解 / 具体修改值”，按影响程度排序，标注高/中/低。
3. 层级检查：视线第一落点、第二落点是否符合业务优先级；是否存在两个同等重量的主按钮。
4. 排版检查：字号阶梯是否过多或过少，行宽与行高是否适合中文阅读；正文是否 text-sm？
5. 色彩合规：是否使用了 violet / purple / indigo 作为品牌色？品牌主色是否 orange-500？
6. 可访问性：对比度 ≥ 4.5:1、焦点状态、只用颜色传达信息的地方。
7. 保留与删除：明确说出哪些元素应该保留，哪些应该删掉。

不要用“更高级”“更现代”这类无法执行的建议，每条修改都要给出数值或具体样式。`,
    scenario: "analysis", isBuiltin: true, accent: "amber", tags: ["视觉","层级","验收"],
  },
  {
    id: -6, name: "把一句话扩写成可执行提示词", category: "效率",
    description: "用“目标 / 上下文 / 步骤 / 输出契约 / 验收”把模糊需求变成稳定可用的提示词。",
    templateText: `把下面一句话改写成可以反复使用的提示词，不要直接执行任务。

原始想法：“帮我做一个好看的作品集网站。”

改写要求：
1. 目标与交付物：明确页面类型、给谁看、希望访客完成什么动作。
2. 上下文：只使用我提供的信息；缺失的品牌、项目与数据，用“假设：…”显式标注，不得编造。
3. 执行步骤：先信息架构，再组件清单，最后视觉规范，编号排列。
4. 输出契约：Markdown；每个区块不超过 120 字说明；给出可直接使用的真实文案。
5. 验收标准：3–5 条可勾选条件，包含响应式与可访问性。

最后用一段“需要我补充的信息”列出最多 3 个真正影响结果的问题。`,
    scenario: "general", isBuiltin: true, accent: "mint", tags: ["结构","输出","验收"],
  },
  {
    id: -7, name: "研究参考网站并提炼设计规则", category: "创意",
    description: "从优秀站点里提取可迁移的结构与视觉决策，而不是复制外观。",
    templateText: `我要做一个面向设计团队的产品说明页。请帮我建立一份参考分析方法，而不是直接给我配色。

参考方向：近期发布型产品页（可从 recent.design 一类灵感画廊挑选 3–5 个），以及公开的设计规范文档。

输出：
1. 每个参考站点的用途、目标受众、首屏主要传达的信息。
2. 结构观察：区块顺序、主行动位置、证据放在哪里、次级信息如何降低权重。
3. 视觉观察：版心宽度、栅格、字号阶梯、颜色职责、留白节奏、动效使用程度。
4. 提炼成规则：用“因为要达成 X，所以采用 Y”的句式，至少 6 条。
5. 迁移边界：哪些可以借鉴，哪些不能复制（品牌资产、文案、独特插图、具体事实）。
6. 输出一份观察清单（DESIGN NOTES），供我在写页面提示词时作为 <context> 使用。`,
    scenario: "creative", isBuiltin: true, accent: "rose", tags: ["视觉","引用","布局"],
  },
  {
    id: -8, name: "为提示词设计高质量示例", category: "写作",
    description: "用少量示例固定格式与判断边界，覆盖一个正例和一个边界情况。",
    templateText: `我在写一个把会议记录整理成行动项的提示词。请帮我设计 few-shot 示例，不要执行任务。

要求：
1. 给出 2 个示例：一个信息完整的正常样例，一个信息缺失的边界样例。
2. 每个示例同时给出输入与理想输出，用 <example> 分开，输出严格遵循我指定的格式：已决定 / 待确认 / 行动项（责任人 + 时间）。
3. 输出中不要出现示例里没有的信息；缺失的责任人写“未指定”。
4. 示例语言与实际使用语言一致（中文），长度控制在真实输入的量级。
5. 最后解释：这两个示例分别固定了哪一条规则，以及为什么不再增加第三个示例来节省上下文。`,
    scenario: "writing", isBuiltin: true, accent: "violet", tags: ["示例","输出","约束"],
  },
  {
    id: -9, name: "长文档分析与可追溯引用", category: "数据",
    description: "先分块、再引用、最后回答；资料未覆盖时明确说不知道。",
    templateText: `请阅读我提供的产品规格与三份用户访谈记录，输出一份“定价顾虑”分析。

规则：
1. 每份材料放在独立的 <document> 标签内，先列出材料清单与日期。
2. 回答前，先用 <quotes> 引用与定价直接相关的原文片段，并标注来源编号。
3. 结论只依据引用内容；访谈没有提到的内容写“资料中未提及”，不要推测用户想法。
4. 区分事实（用户原话）与推断（你的归纳），推断必须给出依据。
5. 材料之间矛盾时，说明分歧点并给出倾向，不要合并成一条模糊结论。

输出格式：结论摘要（3 条）→ 证据表（来源 / 原话 / 指向的结论）→ 仍需验证的问题（最多 5 条）。`,
    scenario: "data", isBuiltin: true, accent: "lime", tags: ["引用","上下文","输出"],
  },
  {
    id: -10, name: "为交互补全动效与降级", category: "开发",
    description: "把“加点动画”写成触发、时长、缓动、顺序与无障碍降级的完整规格。",
    templateText: `请为一个任务管理应用的首屏设计动效规格，只输出规格表，不要写代码。

页面元素：顶部标题、任务列表（最多 8 条）、右下角新建按钮、完成后出现的成功提示。

每一条动效包含：
· 触发条件（进入视口 / 点击 / 悬停 / 状态变化）
· 变化的属性（仅 opacity 与 transform）
· 时长与缓动曲线
· 延迟与列表递减节奏
· 移动端是否减弱
· prefers-reduced-motion 下的替代表现

限制：单个动效不超过 400ms；列表递延不超过 6 项；不使用持续循环动画；动效不能遮挡主行动按钮。

最后给出一条“不建议加动效”的位置，并说明原因。`,
    scenario: "coding", isBuiltin: true, accent: "slate", tags: ["动效","验收","视觉"],
  },
  {
    id: -11, name: "比较两个设计方向的取舍", category: "分析",
    description: "先给倾向，再用一致的维度比较代价与风险，避免两头都夸。",
    templateText: `我们是一个 4 人团队，要为已有产品重做官网首页。请比较两个方向并给出建议。

方向 A：以强视觉与动效为主的品牌叙事页，首屏只有一句主张和一个按钮。
方向 B：以信息密度为主的产品说明页，首屏同时展示能力、截图与试用入口。

要求：
1. 先给出倾向性结论和适用前提，不要两头都说好。
2. 用同一组维度比较：目标受众匹配度、首屏理解成本、转化路径长度、实现与维护成本、可访问性风险、内容更新成本。
3. 区分事实、推测与待验证假设。
4. 指出在什么条件下结论会反转。
5. 给出一个两周内可执行的小规模验证方案，包含判断成败的指标。

输出用对比表格 + 200 字以内的建议说明。`,
    scenario: "analysis", isBuiltin: true, accent: "cyan", tags: ["结构","验收","迭代"],
  },
  {
    id: -21, name: "后端：REST API 接口设计", category: "后端",
    description: "为资源型业务生成完整的 REST API 接口契约，含路径、方法、请求/响应体、错误码。",
    templateText: `你是一位资深后端架构师。请为【自由职业者发票整理工具】设计一套完整的 REST API 接口契约。

## 业务领域
用户上传发票图片/PDF，系统自动提取关键信息（供应商、金额、日期、税号），生成可导出的发票清单。

## 接口设计要求
请按以下结构输出每个接口：

### 1. 接口清单
| 接口 | 方法 | 路径 | 用途 | 认证要求 |
|------|------|------|------|----------|
| 上传发票 | POST | /api/invoices | 上传发票文件并触发提取 | 需登录 |
| 获取发票列表 | GET | /api/invoices | 分页获取用户的发票列表 | 需登录 |
| 获取发票详情 | GET | /api/invoices/:id | 获取单张发票的完整信息 | 需登录 |
| 导出发票清单 | GET | /api/invoices/export | 导出 CSV/Excel 格式清单 | 需登录 |
| 删除发票 | DELETE | /api/invoices/:id | 删除指定发票 | 需登录 |

### 2. 每个接口的详细规格
请按以下模板详细说明（以“上传发票”为例，其余同理）：

**接口名：上传发票**
- 方法：POST /api/invoices
- 认证：Bearer Token (JWT)
- 请求体：multipart/form-data
  - file (文件，必须，支持 pdf/png/jpg，最大 10MB)
  - category (字符串，可选，发票分类)
- 响应体（200 OK）：
  { "id": "inv_123", "status": "processing", "extracted": null, "createdAt": "2026-01-15T10:30:00Z" }
- 错误响应：
  - 400: 文件类型不支持或文件过大
  - 401: 未认证
  - 413: 文件超过 10MB
  - 500: 服务器处理失败

### 3. 数据模型
请给出核心数据模型的字段定义：
- Invoice: id, userId, fileUrl, status, extractedData (JSON), category, createdAt, updatedAt
- User: id, email, passwordHash, createdAt

### 4. 错误处理规范
- 所有错误响应统一格式：{ "error": { "code": "...", "message": "..." } }
- 错误码使用小写蛇形命名（如 file_type_not_supported）
- 不向前端泄露堆栈跟踪或内部路径

### 5. 验收标准
- 每个接口都有明确的请求/响应体结构
- 错误码覆盖常见场景（参数错误、认证失败、权限不足、服务器错误）
- 数据模型字段有类型与必填标记
- 包含认证与鉴权说明

不要编造第三方服务的 API 密钥或端点；未知集成标记为「待定》。`,
    scenario: "backend", isBuiltin: true, accent: "orange", tags: ["后端","API","REST","验收"],
  },
  {
    id: -22, name: "后端：数据库模型设计", category: "后端",
    description: "生成关系型数据库的表结构、字段类型、索引与关系说明。",
    templateText: `你是一位资深数据库架构师。请为【自由职业者发票整理工具】设计关系型数据库模型。

## 业务领域
用户上传发票，系统提取关键信息，用户可查看、导出、删除自己的发票。

## 表设计要求
请按以下结构输出每个表：

### 1. 表清单
| 表名 | 用途 | 核心字段 |
|------|------|----------|
| users | 用户账号 | id, email, password_hash, created_at |
| invoices | 发票记录 | id, user_id, file_url, status, category, created_at |
| invoice_items | 发票条目 | id, invoice_id, vendor, amount, date, tax_id |

### 2. 每个表的详细规格
**表：users**
- 描述：存储用户账号信息
- 字段：
  - id: UUID, 主键，自动生成
  - email: VARCHAR(255), 唯一，非空，索引
  - password_hash: VARCHAR(255), 非空
  - created_at: TIMESTAMP, 默认当前时间
- 索引：email (唯一)

**表：invoices**
- 描述：存储发票上传记录
- 字段：
  - id: UUID, 主键
  - user_id: UUID, 外键关联 users.id, 非空，索引
  - file_url: TEXT, 非空
  - status: VARCHAR(20), 默认 "processing" (processing/completed/failed)
  - category: VARCHAR(50), 可选
  - extracted_data: JSONB, 可选，存储提取的关键信息
  - created_at: TIMESTAMP, 默认当前时间
  - updated_at: TIMESTAMP, 默认当前时间
- 索引：user_id, status, created_at

**表：invoice_items**
- 描述：存储发票中的行项目
- 字段：
  - id: UUID, 主键
  - invoice_id: UUID, 外键关联 invoices.id, 非空，级联删除
  - vendor: VARCHAR(255), 可选
  - amount: DECIMAL(12,2), 可选
  - date: DATE, 可选
  - tax_id: VARCHAR(50), 可选
- 索引：invoice_id

### 3. 关系说明
- users 1:N invoices (一个用户可有多张发票)
- invoices 1:N invoice_items (一张发票可有多个条目)

### 4. 验收标准
- 每个表都有主键与必要的外键约束
- 外键字段都有索引
- JSONB 用于非结构化提取数据
- 状态字段用枚举或检查约束限制取值
- 包含软删除字段（deleted_at）或说明为何不使用

不要编造真实的数据库连接字符串或凭证；未知扩展标记为「待定》。`,
    scenario: "backend", isBuiltin: true, accent: "cyan", tags: ["后端","数据库","模型","验收"],
  },
  {
    id: -23, name: "后端：认证与会话方案", category: "后端",
    description: "设计基于 JWT 的用户认证流程，含注册、登录、令牌刷新、权限中间件。",
    templateText: `你是一位资深后端安全工程师。请为【自由职业者发票整理工具】设计用户认证与会话管理方案。

## 认证方案概述
采用 JWT（JSON Web Token）+ Refresh Token 方案，短期 Access Token 与长期 Refresh Token 分离存储。

## 接口设计

### 1. 用户注册 POST /api/auth/register
- 请求体：{ email: string, password: string, fullName: string }
- 验证：邮箱格式、密码强度（≥8 字符，含字母与数字）、邮箱唯一性
- 响应：{ user: { id, email, fullName }, accessToken, refreshToken }

### 2. 用户登录 POST /api/auth/login
- 请求体：{ email: string, password: string }
- 验证：邮箱存在、密码匹配、账号未禁用
- 响应：{ user: { id, email, fullName }, accessToken, refreshToken }

### 3. 令牌刷新 POST /api/auth/refresh
- 请求体：{ refreshToken: string }
- 验证：Refresh Token 有效、未过期
- 响应：{ accessToken, refreshToken }

### 4. 用户登出 POST /api/auth/logout
- 请求体：{ refreshToken: string }
- 作用：将 Refresh Token 加入黑名单或从服务器端存储中移除

## 安全规则
- Access Token 过期时间：15 分钟
- Refresh Token 过期时间：7 天
- 密码使用 bcrypt 哈希（成本因子 12）
- JWT 签名使用 HS256，密钥从环境变量读取（JWT_SECRET）
- 所有认证接口需速率限制（每 IP 每分钟最多 10 次）
- 错误响应不透露是邮箱不存在还是密码错误（统一返回“凭证无效”）

## 中间件要求
- 认证中间件：验证 Access Token，将用户信息挂载到请求上下文
- 权限中间件：基于角色（user/admin）控制接口访问

## 输出契约（Markdown）
1. 接口清单与请求/响应体
2. 安全规则与速率限制
3. 中间件流程图（文字描述）
4. 验收标准：令牌过期、刷新、登出、密码重置等场景

不要编造真实的 JWT 密钥或数据库凭证；未知集成标记为「待定》。`,
    scenario: "backend", isBuiltin: true, accent: "slate", tags: ["后端","认证","JWT","安全","验收"],
  },
  {
    id: -24, name: "后端：Next.js App Router 服务架构", category: "后端",
    description: "设计基于 Next.js App Router 的服务端渲染、Server Actions 与 API Route 目录结构。",
    templateText: `你是一位资深全栈架构师。请为【自由职业者发票整理工具】设计基于 Next.js App Router 的服务端架构。

## 目录结构
请给出推荐的 App Router 目录结构，包含每个目录的职责：

app/
├── layout.tsx          # 根布局，字体、主题提供者、全局样式
├── page.tsx            # 首页，服务端组件，获取公开数据
├── login/
│   └── page.tsx        # 登录页，客户端组件（含表单状态）
├── register/
│   └── page.tsx        # 注册页，客户端组件
├── dashboard/
│   ├── layout.tsx      # 仪表盘布局，侧边栏，身份校验
│   └── page.tsx        # 仪表盘首页，服务端组件，获取 KPI 数据
├── invoices/
│   ├── page.tsx        # 发票列表页
│   ├── [id]/
│   │   └── page.tsx    # 发票详情页
│   └── upload/
│       └── page.tsx    # 上传页，客户端组件
├── api/
│   ├── auth/
│   │   ├── register/
│   │   │   └── route.ts
│   │   ├── login/
│   │   │   └── route.ts
│   │   └── logout/
│   │       └── route.ts
│   ├── invoices/
│   │   ├── route.ts    # GET 列表 / POST 上传
│   │   └── [id]/
│   │       └── route.ts # GET 详情 / DELETE 删除
│   └── invoices/
│       └── export/
│           └── route.ts # GET 导出 CSV
├── components/
│   ├── ui/             # shadcn/ui 基础组件
│   ├── invoice-card.tsx
│   └── upload-zone.tsx
├── lib/
│   ├── db.ts           # 数据库连接
│   ├── auth.ts         # JWT 工具函数
│   └── validations.ts  # Zod 校验 schema
└── actions/
    ├── upload-invoice.ts  # Server Action：上传发票
    └── delete-invoice.ts  # Server Action：删除发票

## 架构决策
- 服务端组件（Server Components）为默认，仅在需要交互状态时使用客户端组件（'use client'）
- 数据变更使用 Server Actions，减少 API Route 样板代码
- 只在真正需要 HTTP 接口时才使用 API Route（如第三方webhook、外部集成）
- 所有表单验证使用 Zod，在服务端与客户端共享 schema
- 数据库操作集中在 lib/db.ts，路由层不直接写 SQL/ORM 调用

## 验收标准
- 目录结构清晰，职责边界明确
- 服务端组件优先，客户端组件最小化
- 所有 API 路径与 Server Action 有对应关系
- 包含错误处理与加载状态处理建议

不要编造第三方服务的配置；未知集成标记为「待定》。`,
    scenario: "backend", isBuiltin: true, accent: "mint", tags: ["后端","Next.js","架构","验收"],
  },
];
