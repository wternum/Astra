/**
 * 一句话理解引擎 / One-line understanding engine.
 *
 * 用户输入一句话，引擎自动判断：这是哪个层面的任务、真正想达成什么、
 * 面向谁、最终要什么、有哪些显式约束、哪些信息缺失，然后用**自然语言**
 * （而不是模板化的分节清单）重构出一条可以直接交给模型执行的提示词。
 *
 * 原则：
 * 1. 不要求用户配置任何选项；所有设置都从原话里推断。
 * 2. 绝不捏造用户没说过的事实、数字、品牌、受众；推断项一律以
 *    「假设 / 如果」的方式写进提示词，让模型自行澄清。
 * 3. 不同层面使用不同的行文骨架和专业要求，避免千篇一律的套话。
 */
import {
  analyzeBrief,
  analyzePrompt,
  DEFAULT_OPTIONS,
  type OptimizeOptions,
  type OptimizeResult,
} from "@/lib/optimizer";

export type LayerId =
  | "writing" | "coding" | "analysis" | "marketing" | "learning"
  | "creative" | "data" | "work" | "general";

export interface Layer {
  id: LayerId;
  label: string;
  en: string;
  role: string;
  roleEn: string;
  rules: readonly (readonly [RegExp, number])[];
  method: string;
  methodEn: string;
  checks: readonly string[];
  checksEn: readonly string[];
  avoid: string;
  avoidEn: string;
  deliverable: string;
  format: string;
  formatEn: string;
}

export const LAYERS: readonly Layer[] = [
  {
    id: "coding", label: "工程实现层", en: "Engineering", role: "资深软件工程师", roleEn: "senior software engineer",
    rules: [
      [/代码|编程|程序|脚本|函数|接口|爬虫|重构|调试|bug|报错|部署|python|javascript|typescript|react|node|sql|api|正则|算法/i, 9],
      [/\b(code|script|function|implement|refactor|debug|regex|endpoint|query|component)\b/i, 8],
      [/写个|写一个|实现|跑起来|可运行|自动化|批量/i, 5],
      [/\.py|\.js|\.ts|json|csv|excel|数据库/i, 4],
    ],
    method: "先说清楚运行环境、输入是什么、最终要产出什么，再给出可以直接运行的实现；把空值、重名、格式错误这类边界情况一并处理好，并在关键处说明为什么这样写。请附上一个最小的运行示例，不要引用不存在或未经确认的库与接口。",
    methodEn: "State the runtime, inputs, and expected output first, then give a directly runnable implementation. Handle edge cases such as empty values, duplicate names, and malformed input, briefly explain the key decisions, and include a minimal runnable example. Do not invent libraries or APIs that may not exist.",
    checks: ["代码是否可以直接运行", "是否说明了依赖与运行方式", "边界与异常情况是否被处理"],
    checksEn: ["the code actually runs", "setup and dependencies are explained", "edge cases are handled"],
    avoid: "不要虚构运行结果、不存在的 API 或用户没有提供的文件路径",
    avoidEn: "do not fabricate outputs, APIs, or file paths the user never provided",
    deliverable: "一份可直接运行的实现与简要说明", format: "代码与必要的文字说明", formatEn: "code with concise explanations",
  },
  {
    id: "writing", label: "内容创作层", en: "Writing", role: "资深编辑与写作者", roleEn: "experienced editor and writer",
    rules: [
      [/写|文章|文案|稿|博客|公众号|故事|小说|散文|朋友圈|标题|润色|改写|续写|开头|结尾/i, 8],
      [/\b(write|draft|article|essay|blog|story|headline|rewrite|copy)\b/i, 7],
      [/篇|字数|段落|读者|文风|笔调/i, 4],
    ],
    method: "先想清楚读者读完应该带走什么，再决定从哪个角度切入、按什么顺序展开；每一段都要有实质信息，避免用漂亮的空话填充篇幅。请让观点、例证和语气前后一致，结尾落在有用的内容上，而不是泛泛的总结。",
    methodEn: "Decide what the reader should take away before choosing the angle and structure. Every paragraph should carry real information rather than polished filler. Keep the voice, claims, and examples consistent, and end with something useful instead of a generic recap.",
    checks: ["开头是否抓住了读者", "每段是否有实质信息", "语气与观点是否前后一致"],
    checksEn: ["the opening earns attention", "each paragraph carries substance", "voice and claims stay consistent"],
    avoid: "不要编造案例、数据、引用或人物经历",
    avoidEn: "do not invent examples, statistics, quotes, or personal anecdotes",
    deliverable: "一篇可以直接使用的完整文稿", format: "自然连贯的段落", formatEn: "natural, coherent prose",
  },
  {
    id: "analysis", label: "分析决策层", en: "Analysis", role: "战略分析师", roleEn: "strategy analyst",
    rules: [
      [/分析|评估|对比|比较|利弊|前景|趋势|决策|可行性|要不要|是否要|该不该|是否应该|权衡|选哪个|研究|判断/i, 9],
      [/\b(analyze|compare|evaluate|assess|trade-?off|decision|feasibility|pros and cons)\b/i, 8],
      [/方案|建议|依据|风险|假设/i, 4],
    ],
    method: "先给出明确的结论，再展开支撑它的依据；把事实、推测和尚未验证的假设分开说，并比较至少两种真正可行的路径，说明各自适合什么条件、代价是什么。请指出最关键的风险和不确定性，不要只给一个看似周全却无法落地的答案。",
    methodEn: "Lead with a clear conclusion, then the evidence behind it. Separate facts from assumptions, compare at least two genuinely viable options with their trade-offs, and name the main risks and uncertainties instead of offering a vague balanced answer.",
    checks: ["结论是否明确", "事实与推测是否被区分", "是否指出风险与不确定性"],
    checksEn: ["the conclusion is explicit", "facts are separated from assumptions", "risks and uncertainty are named"],
    avoid: "不要虚构市场数据、用户反馈或未提供的内部信息",
    avoidEn: "do not invent market data, user feedback, or internal information",
    deliverable: "一份有结论、有依据的分析", format: "先结论后论证的连贯文字", formatEn: "conclusion-first prose with reasoning",
  },
  {
    id: "marketing", label: "传播表达层", en: "Marketing", role: "品牌策略与增长顾问", roleEn: "brand and growth strategist",
    rules: [
      [/营销|文案|广告|推广|卖点|转化|种草|宣传|海报| slogan |小红书|抖音|活动|促销|拉新|品牌定位/i, 9],
      [/\b(marketing|campaign|ad copy|landing page|conversion|promotion|brand voice)\b/i, 8],
      [/吸引|打动|说服力|不像广告/i, 5],
    ],
    method: "先把功能或特点转译成目标人群真正能感知到的收益，再围绕一个最值得强调的核心主张组织表达；说法要真实、具体、可被验证，结尾给出读者下一步可以做什么。请避免夸张承诺和堆砌形容词，也不要用千篇一律的营销腔。",
    methodEn: "Translate features into benefits the audience can actually feel, build the message around one central truthful claim, and end with a concrete next step. Avoid exaggerated promises, adjective stacking, and generic marketing cliches.",
    checks: ["主张是否真实具体", "语言是否贴合目标人群", "读者是否知道下一步做什么"],
    checksEn: ["claims are specific and truthful", "language fits the audience", "the next step is clear"],
    avoid: "不要编造销量、评价、奖项或客户案例",
    avoidEn: "do not fabricate sales figures, testimonials, awards, or case studies",
    deliverable: "一段可以直接发布的传播内容", format: "可直接使用的成稿", formatEn: "ready-to-publish copy",
  },
  {
    id: "learning", label: "知识讲解层", en: "Learning", role: "善于启发的教学导师", roleEn: "patient teaching mentor",
    rules: [
      [/解释|讲解|教我|什么是|原理|入门|弄懂|理解|科普|为什么会|讲明白|区别是|怎么用/i, 9],
      [/\b(explain|teach|learn|understand|what is|how does|tutorial|beginner)\b/i, 8],
      [/比喻|例子|小白|新手|非技术|没基础/i, 5],
    ],
    method: "先用生活化的比喻或一个具体场景建立直觉，再讲清背后的原理；随后给一个能落到实处的例子，并主动点出最常见的误解。请按由浅入深的顺序组织，遇到必须用到的术语时顺手解释，不要让解释本身变成新的门槛。",
    methodEn: "Build intuition with an everyday analogy or concrete scenario before explaining the mechanism, then give a practical example and call out the most common misconception. Move from simple to deep and define unavoidable jargon as it appears.",
    checks: ["是否先建立直觉再讲原理", "是否有具体例子", "是否点出常见误解"],
    checksEn: ["intuition comes before theory", "a concrete example is included", "common misconceptions are addressed"],
    avoid: "不要假设读者已经具备原文没有提到的前置知识",
    avoidEn: "do not assume background knowledge the original message never mentioned",
    deliverable: "一段让人真正读懂的讲解", format: "由浅入深的自然讲解", formatEn: "progressive, plain-language explanation",
  },
  {
    id: "creative", label: "创意发散层", en: "Creative", role: "跨领域创意总监", roleEn: "cross-disciplinary creative director",
    rules: [
      [/创意|点子|脑暴|头脑风暴|取名|命名|名字|灵感|想几个|构思|设计一下| slogan |口号|起个/i, 9],
      [/\b(brainstorm|ideas?|name ideas|creative concepts?|slogan|come up with)\b/i, 8],
      [/新颖|有趣|不同方向|多个|几个|12 个|一组/i, 5],
    ],
    method: "请从几个彼此明显不同的方向发散，而不是把同一个想法换几种说法；每个方向说明它为什么可能打动人、适合什么情境，再从中挑出最值得推进的几个并说清取舍理由。最后顺带考虑实际落地的可行性，别停留在漂亮但用不上的点子。",
    methodEn: "Explore several meaningfully different directions rather than rewording one idea. Explain why each could work and where it fits, then shortlist the strongest options with clear reasoning, and consider practical feasibility.",
    checks: ["不同方向是否有明显差异", "每个方向是否说明了亮点", "是否考虑了落地可行性"],
    checksEn: ["the directions are genuinely different", "each direction explains its appeal", "feasibility is considered"],
    avoid: "不要虚构品牌已有的故事、定位数据或用户评价",
    avoidEn: "do not invent an existing brand story, positioning data, or user reviews",
    deliverable: "一组有差异、有说明的候选方案", format: "分组呈现的候选与推荐理由", formatEn: "grouped candidates with a shortlist rationale",
  },
  {
    id: "data", label: "数据洞察层", en: "Data", role: "数据分析师", roleEn: "data analyst",
    rules: [
      [/数据|指标|统计|报表|图表|增长率|留存|转化率|口径|均值|同比|环比|dataset|sql/i, 9],
      [/\b(data|metrics?|statistics|dataset|dashboard|cohort|conversion rate|retention)\b/i, 8],
      [/数字|变化|下降|上升|占比/i, 4],
    ],
    method: "先确认统计口径、时间范围和缺失情况，再描述真正值得注意的变化；把相关性当成相关性，不要直接写成因果。结论要有原文给出的数字支撑，并说明这些数字的局限和还需要什么数据才能下判断。",
    methodEn: "Clarify metric definitions, time range, and missing data before describing what changed. Treat correlation as correlation, ground conclusions in the numbers actually provided, and state their limitations plus what further data would be needed.",
    checks: ["数据口径是否说清", "结论是否有数字依据", "是否标明数据局限"],
    checksEn: ["metric definitions are clear", "conclusions are backed by numbers", "data limitations are stated"],
    avoid: "不要补造原文没有给出的数字、维度或样本量",
    avoidEn: "do not fabricate figures, dimensions, or sample sizes absent from the input",
    deliverable: "一份指出关键变化与下一步排查方向的解读", format: "先判断后依据的连贯解读", formatEn: "finding-first interpretation with evidence",
  },
  {
    id: "work", label: "职场协作层", en: "Work", role: "职场沟通顾问", roleEn: "workplace communication advisor",
    rules: [
      [/邮件|会议|纪要|汇报|总结|周报|简历|面试|方案|计划|排期|提醒|回复|通知|领导|同事|客户沟通/i, 8],
      [/\b(email|meeting|minutes|report|resume|plan|schedule|stakeholder|follow-?up)\b/i, 7],
      [/周内|阶段|分周|负责人|延期|同步/i, 4],
    ],
    method: "先说清这封信或这份材料的目的，以及对方读完需要知道什么、做什么；把信息按重要性排好，删掉与决定无关的铺垫。下一步要具体到可以直接执行，涉及责任人和时间的地方请留出明确位置（如果原文没给，就用占位说明，不要替我编）。",
    methodEn: "State the purpose and what the reader needs to know or do, order information by importance, and cut anything irrelevant to the decision. Make next steps concrete; where owners or dates are needed but not supplied, use a clearly marked placeholder instead of inventing them.",
    checks: ["目的是否清楚", "信息层级是否明确", "下一步是否可以直接执行"],
    checksEn: ["the purpose is clear", "information is prioritized", "next steps are actionable"],
    avoid: "不要替用户编造人名、日期、承诺或已发生的事实",
    avoidEn: "do not invent names, dates, commitments, or past events",
    deliverable: "一份可以直接发出或提交的材料", format: "重点前置、可直接使用的成稿", formatEn: "priority-first, ready-to-send draft",
  },
  {
    id: "general", label: "通用任务层", en: "General", role: "有经验的领域专家", roleEn: "experienced domain specialist",
    rules: [[/帮我|请|我想|需要|希望|想要|给点|来点/i, 2]],
    method: "先确认我真正想拿到的结果是什么，再把完成它所需的条件补齐，然后直接给出一个可以拿来就用的答案；对影响结果的关键不确定性如实说明，不要用大段方法论代替实际交付。",
    methodEn: "Identify the outcome I actually want, fill in the conditions needed to get there, and deliver a directly usable answer. Be honest about important uncertainty instead of substituting a long methodology for the deliverable.",
    checks: ["是否完整回应了我的目标", "内容是否具体可用", "关键假设是否被说明"],
    checksEn: ["the real goal is fully addressed", "the answer is specific and usable", "key assumptions are stated"],
    avoid: "不要捏造背景、数据或用户没提到的约束",
    avoidEn: "do not fabricate context, data, or constraints the user never gave",
    deliverable: "一个直接可用的结果", format: "清楚易读的自然表达", formatEn: "clear, readable prose",
  },
];

export interface Signal {
  label: string;
  value: string;
  source: "explicit" | "inferred";
}

export interface Gap {
  label: string;
  question: string;
  suggestion: string;
}

export interface Understanding {
  layer: Layer;
  alternatives: readonly { layer: Layer; score: number }[];
  confidence: number;
  goal: string;
  summary: string;
  signals: readonly Signal[];
  constraints: readonly string[];
  assumptions: readonly string[];
  gaps: readonly Gap[];
  language: "zh" | "en";
  tone: string;
  toneEn: string;
  audience: string;
  deliverable: string;
  format: string;
  formatEn: string;
  detail: "compact" | "balanced" | "detailed";
  strategy: "precise" | "deep" | "creative";
}

const clean = (value: string) => value.trim().replace(/^[,，、。；;\s]+|[,，、。；;\s]+$/g, "");
const CONSTRAINT_HINT = /(不要|别|避免|不能|不得|不可|不许|至少|最多|不超过|必须|一定|只|仅限|控制在|以内|少于|不少于|严禁)/;

/** 只剥离否定短语本身，保留分句前面的正常语义（「要不要」是疑问，不是约束）。 */
function domainOnly(part: string) {
  const safe = part.replace(/要不要/g, "是否要");
  return safe
    .split(/(?:不要太?像|不要|别|避免|不能|不得|不可|不许|严禁|至少|最多|不超过|必须|一定)/)[0]
    .trim();
}

function pickLayer(raw: string) {
  // 约束句里的词（例如「不要太像广告」中的「广告」）是**排除项**，
  // 不能当作领域信号，否则会把创意命名误判成营销文案。
  const domainText = raw
    .split(/[，,。；;、\n]|但是|但|不过|另外|同时/)
    .map(clean)
    .map(domainOnly)
    .join(" ");
  const scored = LAYERS.map(layer => ({
    layer,
    score: layer.rules.reduce((sum, [re, weight]) => sum + (re.test(domainText) ? weight : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const top = scored[0].layer.id === "general" && scored[0].score === 0 && scored[1].score > 0 ? scored[1] : scored[0];
  const runnerUp = scored.find(item => item.layer.id !== top.layer.id && item.layer.id !== "general")?.score || 0;
  const confidence = top.score === 0 ? 62 : Math.min(97, Math.round(64 + (top.score / (top.score + runnerUp + 3)) * 30 + Math.min(top.score, 14)));
  return { top, scored, confidence };
}

function detectLanguage(raw: string): "zh" | "en" {
  const chinese = (raw.match(/[\u3400-\u9fff]/g) || []).length;
  return chinese >= 3 || (chinese > 0 && raw.length < 60) ? "zh" : "en";
}

function extractGoal(raw: string): string {
  const first = raw.split(/[。！？!?\n]/).map(clean).find(Boolean) || clean(raw);
  const action = first
    .replace(/^(?:嗯|那个|麻烦|请问|能不能|可以|帮我|请|我想|我要|我需要|想|要|来|麻烦你|帮我个忙|能不能帮我)\s*/i, "")
    .replace(/^(?:一下|个|一份|一篇|一条)\s*/, "");
  const short = action.length > 66 ? `${action.slice(0, 66)}…` : action;
  return clean(short) || clean(first);
}

function extractConstraints(raw: string): string[] {
  const chunks = raw.split(/[，,。；;、\n]|但是|但|不过|另外|同时/).map(clean).filter(Boolean);
  return chunks.filter(part => CONSTRAINT_HINT.test(part.replace(/要不要/g, "")) && part.length > 2).slice(0, 6);
}

function detectTone(raw: string): [string, string] {
  if (/诚恳|真诚|道歉|致歉/i.test(raw)) return ["诚恳、克制而不推诿", "sincere, restrained, and accountable"];
  if (/专业|严谨|正式|学术|商务/i.test(raw)) return ["专业严谨", "professional and precise"];
  if (/亲切|口语|轻松|幽默|活泼|接地气|像朋友/i.test(raw)) return ["亲切自然、像在和人说话", "warm and conversational"];
  if (/简洁|简短|精炼|别太长|不要太长|直接点/i.test(raw)) return ["简洁直接", "concise and direct"];
  if (/有感染力|生动|打动|温暖|有温度/i.test(raw)) return ["生动、有温度", "vivid and warm"];
  return ["清楚、自然、不端着", "clear, natural, and unpretentious"];
}

function detectAudience(raw: string): string {
  const explicit = raw.match(/(?:面向|写给|给|读者是|受众是|目标(?:客户|用户|读者)是|说给)\s*([\u3400-\u9fff\w\s·–-]{2,26}?)(?=[，,。；;、的\s]|$)/);
  if (explicit) return clean(explicit[1]).replace(/^(?:一位|一群|一些)/, "");
  const known = ["新用户", "产品经理", "非技术", "小白", "新手", "上班族", "城市", "学生", "小朋友", "孩子", "客户", "老板", "领导", "团队", "开发者", "用户", "读者", "应届生", "设计师", "面试官"];
  return known.find(word => raw.includes(word)) || "";
}

function detectDeliverable(raw: string, layer: Layer): string {
  const count = raw.match(/(\d+)\s*(?:个|条|点|种|款|步|页|段|字|行|版|items?|ideas?|names?)/i);
  const forms = ["邮件", "文章", "脚本", "方案", "报告", "清单", "表格", "大纲", "文案", "计划", "名字", "标题", "代码", "JSON", "Markdown", "周报", "纪要", "简历", "PPT", "prompt", "提示词"];
  const form = forms.find(word => raw.toLowerCase().includes(word.toLowerCase()));
  if (count && form) return `${count[1]} ${form}`;
  if (count) return `${count[1]} 个候选`;
  if (form) return `一份${form}`;
  return layer.deliverable;
}

function detectFormat(raw: string, layer: Layer): [string, string] {
  if (/表格|对比表|table/i.test(raw)) return ["用表格呈现对比，再补一段简短结论", "use a table for comparisons and add a short conclusion"];
  if (/清单|列表|分点|列出来|list/i.test(raw)) return ["用精炼的清单逐项呈现", "use a concise itemized list"];
  if (/步骤|step|流程/i.test(raw)) return ["按可执行的步骤展开", "present actionable steps"];
  if (/JSON|json/i.test(raw)) return ["只输出合法 JSON，不加代码围栏或额外说明", "return valid JSON only, without code fences or commentary"];
  if (/邮件|email/i.test(raw)) return ["写成一封可以直接发送的邮件，含主题行", "write a ready-to-send email with a subject line"];
  if (/段落|自然|别太结构化|prose/i.test(raw)) return ["用自然连贯的段落书写，避免不必要的列表", "write in natural, coherent paragraphs without unnecessary lists"];
  return [layer.format, layer.formatEn];
}

function buildGaps(raw: string, u: { audience: string; constraints: string[] }): Gap[] {
  const gaps: Gap[] = [];
  if (!u.audience) gaps.push({
    label: "给谁看",
    question: "这段话最终是给谁看的？",
    suggestion: "如果愿意，补一句「面向……」会更准；不选的话我会让模型自己说明假设。",
  });
  if (!/(?:用在|用于|发在|发布|上线|公众号|小红书|店铺|汇报|场景)/.test(raw)) gaps.push({
    label: "用在哪",
    question: "结果会用在什么场合？",
    suggestion: "补一句使用场景，能决定详略和语气。",
  });
  if (u.constraints.length === 0) gaps.push({
    label: "边界",
    question: "有没有一定不想出现的东西？",
    suggestion: "例如「不要太像广告」「不要编数据」，一句话就够。",
  });
  return gaps.slice(0, 2);
}

/** 实时理解：输入变化时立刻调用，纯计算、无副作用。 */
export function understand(raw: string, override?: LayerId | null): Understanding {
  const text = clean(raw);
  const { top, scored, confidence } = pickLayer(text);
  const layer = override ? LAYERS.find(item => item.id === override) || top.layer : top.layer;
  const language = detectLanguage(text);
  const goal = extractGoal(text);
  const constraints = extractConstraints(text);
  const audience = detectAudience(text);
  const deliverable = detectDeliverable(text, layer);
  const [format, formatEn] = detectFormat(text, layer);
  const [tone, toneEn] = detectTone(text);
  const strategy: Understanding["strategy"] = layer.id === "creative" ? "creative" : layer.id === "analysis" || layer.id === "data" ? "deep" : "precise";
  const detail: Understanding["detail"] = /简短|简洁|精炼|别太长|short|concise/i.test(text) ? "compact" : /详细|深入|展开|全面|detailed|in-depth/i.test(text) ? "detailed" : "balanced";

  const signals: Signal[] = [
    { label: "方向", value: `${layer.label} · ${layer.en}`, source: "inferred" },
    { label: "要做的", value: goal, source: "explicit" },
    ...(audience ? [{ label: "给谁", value: audience, source: "explicit" as const }] : []),
    { label: "交付", value: deliverable, source: audience ? "explicit" : "inferred" },
    { label: "语气", value: tone, source: /诚恳|专业|严谨|亲切|口语|轻松|幽默|活泼|简洁|简短|感染|温暖/.test(text) ? "explicit" as const : "inferred" as const },
    { label: "呈现", value: format, source: "inferred" },
  ];

  const assumptions: string[] = [];
  if (!audience) assumptions.push("还没有说明结果面向谁，请按这类任务的常见读者处理，并在开头用一句话写明你的假设");
  if (!/(?:用在|用于|发在|发布|上线|公众号|小红书|店铺|汇报|场景)/.test(text)) assumptions.push("还不清楚具体使用场景，请先按最通用的情形处理，不要假定渠道、预算或时间");
  if (constraints.length === 0) assumptions.push("原文没有给出明确边界，请自行把握分寸，但不要替我增加不存在的限制");

  return {
    layer,
    alternatives: scored.filter(item => item.layer.id !== "general" && item.layer.id !== layer.id).slice(0, 4),
    confidence: override ? 100 : confidence,
    goal,
    summary: text ? `我理解你想${goal}，这属于${layer.label}。` : "",
    signals,
    constraints,
    assumptions,
    gaps: text ? buildGaps(text, { audience, constraints }) : [],
    language,
    tone,
    toneEn,
    audience,
    deliverable,
    format,
    formatEn,
    detail,
    strategy,
  };
}

function naturalChinese(u: Understanding, raw: string, opts: OptimizeOptions, feedback: string, deeper: boolean): string {
  const L = u.layer;
  const paragraphs: string[] = [];
  const explicitBits: string[] = [];
  if (u.audience) explicitBits.push(`读者／使用者是${u.audience}`);
  if (/(?:用在|用于|发在|发布|上线|公众号|小红书|店铺|招牌|汇报)/.test(raw)) {
    const use = raw.match(/((?:用在|用于|发在|发布到|上线|放在)[^，,。；;]{2,26})/);
    if (use) explicitBits.push(`最终${clean(use[1])}`);
  }
  explicitBits.push(`希望拿到${u.deliverable}`);

  paragraphs.push(
    `${opts.enableRole === false ? "" : `请以${opts.role || L.role}的视角，`}帮我完成这件事：${clean(raw).replace(/[。！？!?]+$/, "")}。` +
    `说得更直白一点，我想要的是${u.goal}，${explicitBits.join("，")}。` +
    (explicitBits.length > 1 ? "这些信息会决定内容的深度和措辞，请务必顺着它们来写。" : "请围绕这个目标组织答案，不要偏离到相邻的话题上。")
  );

  paragraphs.push(L.method);

  if (deeper) {
    paragraphs.push("动手之前，请先用一两句话判断这句话里可能藏着但没说出口的需求：读者真正想解决的问题、以及什么才算做得好。把这些判断当作组织答案的依据；如果某个判断没有原文支撑，就明确说这是推测，不要把它写成事实。");
  }

  if (u.constraints.length) {
    paragraphs.push(
      `原文里有几处我特别在意的要求，请当作硬性边界来遵守：${u.constraints.map(c => `「${c}」`).join("、")}。` +
      `如果其中任何一条和你打算采用的做法冲突，请优先满足我的要求，再用一句话说明取舍。`
    );
  }

  if (u.strategy === "deep" && opts.enableReasoning !== false) {
    paragraphs.push("这件事我想看得深一点：请把主要依据和推理过程里可核查的部分简要写出来，区分哪些是已知事实、哪些是你的判断，并指出一个容易被忽略的角度或更强的替代做法。");
  } else if (u.strategy === "creative") {
    paragraphs.push("请让不同方向之间真的有区别，宁可少给几个，也不要把同一个点子换几种说法凑数；每个方向都说说它新在哪、可能用在哪。");
  } else if (u.detail === "detailed") {
    paragraphs.push("请在必要处补上具体例子、边界情况和下一步动作，让结果不用二次加工就能用；但不要为了显得完整而重复已经说过的内容。");
  }

  if (u.detail === "compact") {
    paragraphs.push(`请用${u.tone}的语气，以${u.audience ? `让${u.audience}一眼能懂` : "尽量凝练"}的方式呈现，只保留真正影响结果的内容，不要加开场白、小结和客套话。`);
  } else {
    paragraphs.push(`请用${u.tone}的语气，以${u.format}呈现。表达上保持自然，像人在认真交代一件事，而不是在填一份模板；不要堆术语，也不要写「首先、其次、最后」式的空架子。`);
  }

  paragraphs.push(
    `我只给了这一句话，${u.assumptions.join("；")}。${L.avoid}；如果某个缺失信息会明显改变结果，请先用不超过两句问清楚，否则说明合理假设后直接完成，不要停下来等我补材料。`
  );

  if (opts.enableSelfCheck !== false) {
    paragraphs.push(
      `交付前请对照上面的要求检查一遍：${L.checks.join("、")}；确认没有遗漏我提到的约束，也没有补写我没有提供的事实。`
    );
  }
  if (opts.enableExplore === true) {
    paragraphs.push("另外，如果有一个容易被忽视、但确实能改进结果的角度或替代做法，请主动指出来并说明它的价值。");
  }

  if (opts.context || opts.audience || opts.deliverable || opts.mustInclude || opts.avoid || opts.successCriteria || opts.example) {
    const manual: string[] = [];
    if (opts.context) manual.push(`背景：${opts.context}`);
    if (opts.audience) manual.push(`受众：${opts.audience}`);
    if (opts.deliverable) manual.push(`交付物：${opts.deliverable}`);
    if (opts.mustInclude) manual.push(`必须包含：${opts.mustInclude}`);
    if (opts.avoid) manual.push(`避免：${opts.avoid}`);
    if (opts.successCriteria) manual.push(`验收标准：${opts.successCriteria}`);
    if (opts.example) manual.push(`表达参考（只参考风格，不照搬事实）：${opts.example}`);
    paragraphs.push(`另外，我补充了几点：${manual.join("；")}。这些以我补充的为准。`);
  }

  if (feedback.trim()) {
    paragraphs.push(`这一版请按我的反馈调整：${clean(feedback)}。请做实质修改，不要只是把这句话追加到结尾。`);
  }

  return paragraphs.filter(Boolean).join("\n\n");
}

function naturalEnglish(u: Understanding, raw: string, opts: OptimizeOptions, feedback: string, deeper: boolean): string {
  const L = u.layer;
  const paragraphs: string[] = [];
  paragraphs.push(
    `Act as ${opts.role || L.roleEn}. Here is what I need, in my own words: ${clean(raw).replace(/[.!?]+$/, "")}. ` +
    `Put plainly, the outcome I want is ${u.goal}, and I expect ${u.deliverable}${u.audience ? ` for ${u.audience}` : ""}. Stay focused on that outcome.`
  );
  paragraphs.push(L.methodEn);
  if (deeper) {
    paragraphs.push("Before starting, briefly infer the need behind the words: the problem the reader actually wants solved and what a good outcome would look like. Use those judgements to shape the answer, and label any unsupported inference as a guess rather than a fact.");
  }
  if (u.constraints.length) {
    paragraphs.push(`Treat these requirements as hard constraints: ${u.constraints.map(c => `"${c}"`).join(", ")}. If one conflicts with your preferred approach, honor my constraint and briefly note the trade-off.`);
  }
  paragraphs.push(`Write in a ${u.toneEn} tone and ${u.formatEn}. Keep the wording natural, as if a person were explaining the task carefully, not filling in a template.`);
  paragraphs.push(
    `I have only given you one line, so ${u.assumptions.length ? "do not assume details I never provided — state your assumptions briefly where they matter" : "avoid assumptions"}. ${L.avoidEn}. ` +
    `If a missing detail would materially change the answer, ask at most two focused questions; otherwise state a reasonable assumption and complete the work.`
  );
  paragraphs.push(`Before finishing, check that ${L.checksEn.join("; ")}, and that nothing I said was dropped or invented.`);
  if (feedback.trim()) paragraphs.push(`For this revision, apply my feedback for real rather than appending it: ${clean(feedback)}.`);
  return paragraphs.join("\n\n");
}

/** 用自然语言生成一版完整提示词，并复用原有评分/诊断体系。 */
export function buildSemanticResult(
  raw: string,
  input: Partial<OptimizeOptions> | undefined,
  feedback: string,
  layerOverride: LayerId | null,
  engine: "local" | "ai",
  model?: string,
): { result: OptimizeResult; understanding: Understanding } {
  const prompt = clean(raw);
  const options: OptimizeOptions = { ...DEFAULT_OPTIONS, ...(input || {}) };
  const base = understand(prompt, layerOverride);
  // 默认完全自动；只有用户在「可选的手动微调」里主动改过的项才覆盖推断结果。
  const TONE_ZH: Record<string, string> = { professional: "专业严谨", friendly: "亲切自然", concise: "简洁直接", inspiring: "生动、有感染力" };
  const FORMAT_ZH: Record<string, string> = { markdown: "清楚分层的 Markdown", list: "精炼的编号清单", table: "对比表格加简短结论", steps: "可执行的步骤", json: "合法 JSON，不加代码围栏", prose: "自然连贯的段落" };
  const u: Understanding = {
    ...base,
    detail: options.detail !== "balanced" ? options.detail : base.detail,
    strategy: options.strategy !== "precise" ? options.strategy : base.strategy,
    tone: options.tone !== "auto" ? TONE_ZH[options.tone] || base.tone : base.tone,
    format: options.format !== "auto" ? FORMAT_ZH[options.format] || base.format : base.format,
    language: options.language === "en" ? "en" : options.language === "zh" ? "zh" : base.language,
  };
  if (u.language === "en") options.language = "en";
  const optimized = options.language === "en"
    ? naturalEnglish(u, prompt, options, feedback, engine === "ai")
    : naturalChinese(u, prompt, options, feedback, engine === "ai");

  const changes = [
    `把「${u.goal}」判定为${u.layer.label}，按这个层面的专业要求组织表达`,
    `从原话里读出${u.audience ? `面向${u.audience}、` : ""}要拿到${u.deliverable}，并写进指令`,
    u.constraints.length ? `保留你明确提出的 ${u.constraints.length} 条边界，并要求冲突时优先遵守` : "没有替你增加原文里不存在的限制",
    `用连贯的自然语言重写，去掉模板化的分节与套话`,
    `要求模型在信息不足时先说明假设，不编造事实、数字或案例`,
    `加入与${u.layer.label}匹配的交付前自检：${u.layer.checks.join("、")}`,
  ];

  const rationale = `我把这句话理解为「${u.goal}」，判断它属于${u.layer.label}（把握度 ${u.confidence}%），因此没有让你去选策略、格式或角色，而是直接按这个层面的工作方式把目标、读者、交付物、边界和自检写成一段可以直接交给模型的自然语言指令。${u.constraints.length ? `你提到的 ${u.constraints.length} 条要求被当作硬性边界保留。` : ""}${layerOverride ? "方向按你的手动选择调整。" : ""}`;

  return {
    result: {
      optimized,
      before: analyzeBrief(prompt, options),
      after: analyzePrompt(optimized),
      changes,
      rationale,
      engine,
      model,
      createdAt: new Date().toISOString(),
    },
    understanding: u,
  };
}
