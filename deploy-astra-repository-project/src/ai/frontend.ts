/**
 * Frontend construction guidance distilled from public design references.
 *
 * These sites are inspiration, not a source of the user's product facts:
 * Recent curates websites by purpose, Refero records design-system roles, and
 * Scrolltide's public tutorials specify layout and motion as build decisions.
 * The actual direction is chosen for each request, never copied from a gallery.
 */
import type { NeedAnalysis } from "@/ai/engine";
import type { PromptTarget } from "@/ai/targets";

export type FrontendKind =
  | "site"
  | "landing"
  | "portfolio"
  | "storefront"
  | "editorial"
  | "product-ui"
  | "component"
  | "redesign"
  | "game"
  | "tool"
  | "clone"
  | "visual";

export interface FrontendBrief {
  kind: FrontendKind;
  label: string;
  source: "ai" | "guided";
  explicitSignals: string[];
  openDecisions: string[];
  visualDirection: string;
  composition: string;
  typography: string;
  colorRoles: string;
  visualAnchor: string;
  motion: string;
  interactions: string;
  implementation: string;
}

export const FRONTEND_REFERENCES = [
  {
    name: "Recent",
    url: "https://recent.design/websites",
    lesson: "先按网站用途和领域找方向，观察阅读顺序与主视觉；它是灵感画廊，不提供可直接复制的构建提示词。",
    lessonEn: "Choose a direction by the website's job and visual hierarchy, not by color first. This is an inspiration gallery, not a prompt library.",
  },
  {
    name: "Refero Styles",
    url: "https://styles.refero.design/design-md/design-md-template",
    lesson: "把视觉方向写成可执行的 DESIGN.md 决策：展示字体与正文字体、画布/文字/行动色的职责、内容宽度与间距节奏；未知品牌事实保持未知。",
    lessonEn: "Record typography roles, canvas/text/action color roles, content measure and spacing rhythm; visual references do not supply product facts.",
  },
  {
    name: "Scrolltide",
    url: "https://www.scrolltide.co/academy/build-an-animated-website-from-one-prompt",
    lesson: "动效要指定触发、持续时间、缓动、顺序和移动端退化；先做适合该产品的版式，再决定是否需要滚动叙事。公开教程可读，付费模板提示词不作为来源。",
    lessonEn: "Specify triggers, durations, easing and mobile/reduced-motion behavior when motion serves the page. Public tutorials are not paid template prompts.",
  },
] as const;

const KIND_LABELS: Record<FrontendKind, string> = {
  site: "网站 / 页面",
  landing: "品牌或产品落地页",
  portfolio: "作品集网站",
  storefront: "电商 / 店铺页面",
  editorial: "内容 / 编辑网站",
  "product-ui": "产品界面 / 控制台",
  component: "页面组件",
  redesign: "现有网站改版",
  game: "网页游戏",
  tool: "工具 / 应用",
  clone: "产品界面复刻",
  visual: "可视化 / 3D 模拟",
};

const ENGLISH_KIND_LABELS: Record<FrontendKind, string> = {
  site: "website / web page",
  landing: "brand or product landing page",
  portfolio: "portfolio website",
  storefront: "online storefront",
  editorial: "editorial website",
  "product-ui": "product interface / dashboard",
  component: "web component",
  redesign: "existing website redesign",
  game: "browser game",
  tool: "web app / tool",
  clone: "product UI clone",
  visual: "visualization / 3D simulation",
};

export function frontendKindLabel(kind: FrontendKind, english = false) {
  return english ? ENGLISH_KIND_LABELS[kind] : KIND_LABELS[kind];
}

export function isEnglishRequest(text: string) {
  return !/[\u3400-\u9fff]/.test(text) && /[a-z]{3}/i.test(text);
}

export function isDesignOnlyRequest(text: string) {
  return /(?:设计规范|设计方案|设计文档|线框图|原型稿|网站规划|页面规划|design specification|design brief|mockup|wireframe|design document)/i.test(text)
    && !/(?:实现|开发|构建|做出|制作|可运行|build|implement|develop|working website|working app)/i.test(text);
}

function match(text: string, expression: RegExp) {
  return expression.exec(text)?.[0] || "";
}

/** Things people ask a coding model to build that are not "pages": games, tools, simulations. */
const APP_NOUN = "游戏|小游戏|应用|工具|编辑器|计时器|番茄钟|待办|看板|计算器|转换器|记账|日历|笔记|白板|画板|播放器|模拟器?|仿真|可视化|3D|三维|three\\.?js|webgl|canvas|粒子|贪吃蛇|俄罗斯方块|扫雷|井字棋|五子棋|2048|打砖块|\\bapp\\b|\\bgame\\b|playable|tetris|snake|editor|timer|tracker|calculator|converter|planner|kanban|todo|whiteboard|drawing app|music player|simulator|simulation|visuali[sz](?:er|ation)|particles?";
const APP_BUILD = new RegExp(`(?:做|建|搭|开发|实现|构建|制作|创建|写|复刻|克隆|仿(?![真佛])|生成|make|build|create|develop|implement|code|write|clone|recreate)[^。！？!?\\n]{0,20}?(?:${APP_NOUN})`, "i");
const ABOUT_APPS = /(?:写|撰写)(?:一篇|篇|一段|一份)|评测|测评|攻略|(?:推荐|介绍)(?:几|一些|一下|一款|几款)|\b(?:review|article|essay|recommend)\b/i;
const CODE_ONLY = /(?:函数|脚本|算法|命令行|\bCLI\b|\bfunction\b|\bscript\b|\balgorithm\b)/i;
const HAS_UI = /(?:界面|页面|网页|\bUI\b|应用|\bapp\b|游戏|\bgame\b)/i;

export function isFrontendRequest(text: string, analysis?: Pick<NeedAnalysis, "category" | "domain">) {
  const input = text.trim();
  if (!input) return false;
  const subject = /网页|网站|网店|商城|落地页|官网|首页|主页|页面|作品集|仪表盘|控制台|后台|数据看板|界面|前端|组件|小程序|web\s?(?:site|page|app)|landing page|product page|checkout page|app screen|web interface|online shop|online store|e-?commerce|portfolio|dashboard|storefront|homepage|UI\b/i.test(input);
  const build = /(?:做|建|搭|设计|开发|实现|构建|制作|创建|重做|改版|优化|生成|想要|我想|需要|给我|帮我|写|复刻|克隆|make|build|design|create|develop|implement|redesign|refine|want|need|give me|clone|recreate)/i.test(input);
  const writingAboutWeb = /(?:写|撰写|总结|分析|讲解|介绍|翻译)(?:一篇|篇|一段|一下)?(?:关于|有关|讨论|解释).{0,35}(?:网页|网站|前端|web\s?(?:site|design))/.test(input)
    || /\b(?:write|explain|summarize|analyze)\s+(?:an?\s+)?(?:article|essay|report|guide|post)\s+(?:about|on)\s+(?:web|website)/i.test(input);
  const analysisOfWeb = /(?:帮我|请|我想|需要)?(?:分析|解释|研究|比较|评估|总结).{0,18}(?:网站|网页|web\s?site)/i.test(input)
    || /\b(?:analyze|explain|compare|evaluate)\s+(?:a\s+|the\s+)?(?:website|web\s?site)/i.test(input);
  if (writingAboutWeb || analysisOfWeb) return false;
  // "做一个贪吃蛇小游戏" / "Build a markdown editor" are app builds even without the word 网页.
  const appBuild = APP_BUILD.test(input) && !ABOUT_APPS.test(input) && !(CODE_ONLY.test(input) && !HAS_UI.test(input));
  return appBuild || subject && (build || /前端|网页设计|web design|website build/i.test(analysis?.domain || ""));
}

const KIND_RULES = {
  component: /组件|按钮|一个区块|一段动效|单独的导航|\bcomponent\b|\bbutton\b|single section/i,
  redesign: /改版|重新设计|重做|改造现有|优化现有|redesign|existing (?:website|site)/i,
  clone: /复刻|克隆|高仿|仿(?![真佛])|\bclone\b|\brecreate\b|\breplica\b/i,
  game: /游戏|贪吃蛇|俄罗斯方块|消消乐|扫雷|井字棋|五子棋|象棋|打砖块|飞机大战|跑酷|2048|数独|连连看|弹球|闯关|\bgame\b|playable|tetris|\bsnake\b|minesweeper|sudoku|tic[- ]tac[- ]toe|breakout|\bpong\b|platformer|arcade|\bchess\b|shooter/i,
  "product-ui": /仪表盘|控制台|后台|工作台|数据看板|数据大屏|管理界面|dashboard|admin panel|console|product UI/i,
  visual: /3D|三维|three\.?js|webgl|canvas|粒子|物理|仿真|模拟|太阳系|星系|分形|生成艺术|着色器|可视化|\bshader\b|simulation|simulator|visuali[sz](?:er|ation)|particles?|physics|solar system|generative art|fractal/i,
  storefront: /商城|网店|电商|商品页|购物车|结账|商品列表|e-?commerce|online shop|online store|storefront|product catalog/i,
  portfolio: /作品集|摄影师|设计师网站|portfolio|photographer|artist website/i,
  editorial: /博客|杂志|文章网站|出版物|刊物|blog|magazine|editorial site|publication/i,
  landing: /落地页|官网|宣传页|活动页|发布页|landing page|campaign page|launch page|marketing site/i,
  tool: /编辑器|计时器|番茄钟|待办|任务清单|看板|计算器|换算|转换器|记账|账本|日历|日程|笔记|备忘录|白板|画板|绘图|播放器|天气|聊天(?:界面|应用)|生成器|工具|应用|小程序|\bapp\b|editor|timer|pomodoro|tracker|calculator|converter|planner|calendar|\bnotes?\b|whiteboard|drawing|player|chat (?:app|ui)|generator|\btool\b|habit|kanban|todo/i,
} as const satisfies Partial<Record<FrontendKind, RegExp>>;

const GENERAL_ORDER = ["component", "redesign", "clone", "game", "product-ui", "visual", "storefront", "portfolio", "editorial", "landing", "tool"] as const;
// Arena has no existing site to redesign, and 「组件」 there is usually an implementation detail.
const ARENA_ORDER = ["clone", "game", "product-ui", "visual", "storefront", "portfolio", "editorial", "landing", "tool", "component"] as const;
const WEB_WORDS = /网站|网页|页面|主页|首页|website|web\s?page|homepage|\bsite\b/i;

/** The kind named by an explicit rule, or null when only the fallback would apply. */
export function matchFrontendKind(text: string, options: { target?: PromptTarget } = {}): FrontendKind | null {
  const order = options.target === "arena" ? ARENA_ORDER : GENERAL_ORDER;
  return order.find(id => KIND_RULES[id].test(text)) || null;
}

export function frontendKind(text: string, options: { target?: PromptTarget } = {}): FrontendKind {
  const kind = matchFrontendKind(text, options);
  if (kind) return kind;
  // Every Arena prompt is a build; without page words it is most likely an app.
  return options.target === "arena" && !WEB_WORDS.test(text) ? "tool" : "site";
}

export const FRONTEND_KINDS = ["site", "landing", "portfolio", "storefront", "editorial", "product-ui", "component", "redesign", "game", "tool", "clone", "visual"] as const satisfies readonly FrontendKind[];

const BASE_GUIDANCE: Record<FrontendKind, Pick<FrontendBrief, "composition" | "visualAnchor" | "motion" | "interactions">> = {
  site: {
    composition: "先为用户的主题选择一种清晰、统一的页面结构；首屏只表达一件事，再按目标组织后续内容，不照搬三张功能卡。",
    visualAnchor: "用产品、作品、地点或使用场景作为视觉主角；没有真实素材时明确使用可替换的演示素材，纯抽象渐变不能替代主体。",
    motion: "若视觉氛围重要，选 2-3 个有功能的动效，分别说明触发、时长与缓动；否则只做清晰的状态反馈。",
    interactions: "让主要行动、导航和页面内交互真实可用，而不是只有 hover 外观。",
  },
  landing: {
    composition: "首屏读成一个完整的品牌画面：品牌、一个主张、一句解释、一个主行动与主视觉；下一屏再给证据，不塞统计条和悬浮促销贴。",
    visualAnchor: "让真实产品、空间、人物或使用场景成为主视觉；适合时用满幅图片/视频，素材缺失则说明演示替代，不用空洞的渐变冒充产品。",
    motion: "按品牌气质设计 2-3 个动效（首屏进入、内容揭示、操作反馈）；明确触发、节奏、缓动与 reduced-motion 退化。",
    interactions: "主 CTA 要有明确去向；导航、滚动定位或表单要真的工作。",
  },
  portfolio: {
    composition: "以作品和作者视角建立阅读顺序，项目、过程、成果各有层次；避免把每件作品装进同样的功能卡。",
    visualAnchor: "以真实作品图片为主角，指定裁切、比例、说明文字和素材缺失时的可替换演示方案。",
    motion: "优先使用有助于浏览作品的进入/切换动效，不要让滚动特效盖过作品本身。",
    interactions: "项目打开、筛选和联系入口应可操作，触屏与键盘都能访问作品。",
  },
  storefront: {
    composition: "从商品价值、商品详情到购买行动建立清晰路径，重视商品信息和信任依据；不把商品购买流程误写成 SaaS 落地页。",
    visualAnchor: "清楚展示真实商品及其质地、尺度和使用情境；产品图缺失时只用明确标记的示意素材，不伪造价格或评价。",
    motion: "只为商品图切换、加入购物车和状态反馈使用动效，减少干扰购买的滚动噪声。",
    interactions: "商品选项、购物车、数量或联系购买入口必须有真实状态和反馈。",
  },
  editorial: {
    composition: "以标题、导读、正文和相关内容形成可阅读的层级；控制行宽，保持文章与目录导航的节奏。",
    visualAnchor: "图片和标题共同服务于内容，不用无关装饰图占据阅读空间；明确图片来源和图注。",
    motion: "以克制的导航反馈和阅读进度为主，避免持续漂浮或抢读者注意的背景动画。",
    interactions: "目录、搜索或文章切换需要真实可用，文本和媒体加载状态清楚。",
  },
  "product-ui": {
    composition: "从用户的核心任务和数据关系组织界面，不强加营销 hero；操作、反馈、错误和空状态属于同一工作流。",
    visualAnchor: "真实产品内容、图表、列表或工作流是视觉锚点，不要用装饰图片遮盖信息。",
    motion: "以状态变化和任务完成反馈为主，避免无关滚动叙事；提供 reduced-motion 支持。",
    interactions: "关键控制、筛选、保存、加载/空/错误状态必须可操作且可恢复。",
  },
  component: {
    composition: "只设计请求的组件和它在所在页面的关系，不凭空追加整个营销网站。",
    visualAnchor: "组件中的内容或实际操作是锚点，不强制插图。",
    motion: "仅在状态转换有意义时加入动效，说明触发、时长和键盘/触屏反馈。",
    interactions: "组件的点击、键盘、禁用、加载与错误行为都应可验证。",
  },
  redesign: {
    composition: "先保留现有产品信息架构与功能，再针对用户指出的问题改进层级、布局和视觉方向，不从零捏造品牌。",
    visualAnchor: "沿用用户现有产品与素材；没有看到原站时明确待检查项，不假称已经审阅过旧站。",
    motion: "尊重原有交互，只有能提升理解和反馈的动效才保留或新增。",
    interactions: "原有主要路径不能失效；新增状态应按现有项目技术栈实现。",
  },
  game: {
    composition: "以可玩的游戏区为首屏主体：棋盘或画布居中，得分、状态和操作提示围绕它组织，不做营销式首屏。",
    visualAnchor: "游戏画面本身是视觉主角：统一的美术风格（像素、霓虹、手绘等），角色、道具与反馈效果用 CSS / SVG / Canvas 绘制。",
    motion: "为得分、碰撞、升级和结束设计即时反馈（150–400ms），保持帧率稳定，并提供 reduced-motion 下的简化反馈。",
    interactions: "键盘与触屏都能操作；开始、暂停、结束与重新开始状态完整，最高分本地保存。",
  },
  tool: {
    composition: "以核心工作区为主：主要操作、内容区与设置在第一屏可见，信息密度适中，不加营销首屏。",
    visualAnchor: "真实的工作内容（文档、任务、数据）是视觉主角，用清晰的层级和状态色而不是装饰图。",
    motion: "只为状态变化提供 120–220ms 的反馈：添加、完成、拖拽、保存成功等。",
    interactions: "核心流程完整可用：增删改、快捷键、本地持久化、空状态与删除确认或撤销。",
  },
  clone: {
    composition: "还原参考产品的信息架构、布局比例和关键交互路径；品牌名、文案与素材全部自拟。",
    visualAnchor: "用自拟品牌的内容与 CSS / SVG 素材重现视觉层级，不使用原产品的 Logo、商标或受版权保护的图片。",
    motion: "复现最能体现原产品体验的 1–2 个交互动效，例如播放进度、切换过渡。",
    interactions: "关键路径可操作：导航切换、列表或卡片交互、播放或详情弹层都要有真实状态。",
  },
  visual: {
    composition: "全屏画布或主视窗是主体，参数、播放/暂停、重置等控制精简地叠加或放在侧边。",
    visualAnchor: "模拟或可视化本身是主角：明确的配色、光照或层次，以及可读的标注。",
    motion: "动画按真实规则驱动（时间步长、缓动），可暂停、调速，并在 reduced-motion 下给出静态降级。",
    interactions: "拖拽旋转或缩放、参数滑块、点击查看详情即时响应，窗口尺寸变化时自适应。",
  },
};

const ENGLISH_GUIDANCE: Record<FrontendKind, Pick<FrontendBrief, "composition" | "visualAnchor" | "motion" | "interactions">> = {
  site: { composition: "Choose one clear page composition for the subject; the first viewport has one job and later sections each earn their place.", visualAnchor: "Show the product, work, place or use context; if real assets are missing, label a replaceable demo visual rather than using an abstract gradient as the subject.", motion: "If it serves the idea, specify two or three purposeful moments with triggers, timing and easing; otherwise favor clear interaction feedback.", interactions: "Navigation and the main action must work, not merely have hover styling." },
  landing: { composition: "Make the first viewport a single branded composition: one claim, a short explanation, one action and a relevant dominant visual; put proof below the fold.", visualAnchor: "Let a real product, place or use context anchor the hero; only use a full-bleed image or video when it suits the message and assets.", motion: "Use only a few brand-appropriate moments, with trigger, duration, easing and reduced-motion behavior.", interactions: "The primary CTA must lead somewhere real; forms or scroll navigation need working behavior." },
  portfolio: { composition: "Organize the reading journey around the work and its maker, not a repeated feature-card grid.", visualAnchor: "Artwork or photography leads; specify crop, scale, captions and explicitly replaceable demo assets if originals are missing.", motion: "Use restrained entry and project-switch transitions that help browsing rather than compete with the work.", interactions: "Projects and contact should be accessible by keyboard and touch." },
  storefront: { composition: "Organize around product discovery, useful detail and the purchase path; do not mistake a shop for a SaaS marketing page.", visualAnchor: "Product imagery shows material and scale; never fabricate prices, reviews or inventory.", motion: "Keep motion for product switching, cart changes and feedback rather than scroll spectacle.", interactions: "Filters, variants and cart updates need real state and feedback." },
  editorial: { composition: "Prioritize headline, introduction, readable body measure and related reading rather than a decorative hero.", visualAnchor: "Imagery and captions support the content and have an explicit source or demo label.", motion: "Favor subtle navigation and reading feedback over moving backgrounds.", interactions: "Contents, search or article navigation work and handle loading gracefully." },
  "product-ui": { composition: "Organize by the user's primary task and data relationships; do not add a marketing hero to a dashboard.", visualAnchor: "Real work, records or charts are the visual focus instead of decorative photos.", motion: "Use motion only to explain state changes; provide reduced-motion support.", interactions: "Filters, save actions, loading, empty and error states all work and are recoverable." },
  component: { composition: "Build only the requested component and its immediate context, not an invented whole site.", visualAnchor: "The content and action are the anchor; imagery is optional.", motion: "Animate only meaningful state transitions with keyboard and touch feedback.", interactions: "Click, keyboard, disabled, loading and error behavior are testable." },
  redesign: { composition: "Preserve the existing product's information architecture and improve only the reported problems; do not invent a new brand.", visualAnchor: "Reuse actual product assets; do not claim to have seen the original site unless it was provided and accessible.", motion: "Keep existing interaction patterns unless changes make the task clearer.", interactions: "Do not break the main journey while improving navigation, focus and feedback." },
  game: { composition: "The playable board or canvas is the first view; score, status and controls frame it. No marketing hero.", visualAnchor: "The game itself is the visual: one coherent art style (pixel, neon, hand-drawn…) drawn with CSS, SVG or Canvas.", motion: "Give instant 150–400ms feedback for scoring, collisions, level-ups and game over; keep the frame rate steady and simplify under reduced motion.", interactions: "Keyboard and touch both work; start, pause, game-over and restart states are complete, and the best score persists locally." },
  tool: { composition: "The working area comes first: main actions, content and settings are visible in the first view with no marketing hero.", visualAnchor: "Real work content (documents, tasks, data) carries the visual, using hierarchy and status colors instead of decoration.", motion: "Use 120–220ms transitions only for state changes such as add, complete, drag and saved.", interactions: "The core flow works end to end: create/edit/delete, shortcuts, local persistence, empty states and confirm or undo." },
  clone: { composition: "Recreate the reference product's information architecture, proportions and key interaction paths with an invented brand, copy and assets.", visualAnchor: "Rebuild the visual hierarchy with original content and CSS/SVG art; never use the original logo, trademarks or copyrighted images.", motion: "Reproduce the one or two interactions that define the original experience, such as playback progress or view transitions.", interactions: "Key paths work: navigation, list or card interactions, playback or detail overlays all have real state." },
  visual: { composition: "A full-bleed canvas or main viewport is the subject; parameter, play/pause and reset controls stay compact as an overlay or side panel.", visualAnchor: "The simulation or visualization is the hero, with a deliberate palette, lighting or depth and readable labels.", motion: "Drive animation from real rules (time step, easing); allow pause and speed control, with a static fallback under reduced motion.", interactions: "Drag to rotate or zoom, parameter sliders and click-for-detail respond immediately and adapt to window resizes." },
};

export function signalsFromText(text: string) {
  const signals: string[] = [];
  const english = isEnglishRequest(text);
  const purpose = match(text, /作品集|摄影|SaaS|餐厅|咖啡|烘焙|书店|服装|音乐|教育|医疗|房产|旅行|金融|产品发布|社群|portfolio|photography|restaurant|cafe|bakery|bookstore|fashion|music|education|travel|fintech/i);
  const style = match(text, /极简|暗黑|深色|温暖|复古|优雅|大胆|优美|高级|科技|编辑感|粗野主义|minimal(?:ist)?|dark|warm|retro|elegant|bold|editorial|brutalist|beautiful|cinematic/i);
  const stack = match(text, /React|Next\.?js|Vue|Vite|Tailwind|Framer Motion|HTML|CSS|原生 JS|TypeScript|Svelte/i);
  const feature = match(text, /预约|搜索|购物车|结账|筛选|登录|地图|联系表单|订阅|动画|滚动|交互|booking|search|cart|checkout|filter|login|map|contact form|subscribe|animation|scroll/i);
  if (purpose) signals.push(`${english ? "Subject" : "主题/领域"}：${purpose}`);
  if (style) signals.push(`${english ? "Style" : "风格线索"}：${style}`);
  if (stack) signals.push(`${english ? "Stack" : "技术约束"}：${stack}`);
  if (feature) signals.push(`${english ? "Behavior" : "功能/动效"}：${feature}`);
  const urls = text.match(/https?:\/\/[^\s，。)]+/gi)?.slice(0, 2) || [];
  for (const url of urls) signals.push(`${english ? "User reference" : "用户提供的参考"}：${url}`);
  return signals;
}

function value(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 360) : fallback;
}

/** Prefer actual AI decisions, falling back to explicit design questions, not a preset visual theme. */
export function buildFrontendBrief(text: string, analysis: NeedAnalysis, raw?: unknown): FrontendBrief | null {
  if (!isFrontendRequest(text, analysis)) return null;
  const kind = frontendKind(text);
  const english = isEnglishRequest(text);
  const base = english ? ENGLISH_GUIDANCE[kind] : BASE_GUIDANCE[kind];
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const ai = Object.values(candidate).some(item => typeof item === "string" && item.trim().length > 5);
  const explicitSignals = signalsFromText(text);
  const openDecisions: string[] = [];
  if (!/品牌|店铺|公司|项目|产品|作品集|摄影|餐厅|咖啡|烘焙|书店|服装|SaaS|portfolio|store|studio|product|for\s+my/i.test(text)) {
    openDecisions.push(english ? "No brand or subject supplied: choose one small demo concept, label it as provisional and do not imply it is a real company." : "未说明具体主题或品牌：先选一个小而完整的演示场景，明确标注为示例，不虚构真实公司与用户。");
  }
  if (!/图片|照片|视频|素材|image|photo|video|asset/i.test(text)) openDecisions.push(english ? "No media provided: use relevant, replaceable demo assets and be explicit about missing originals." : "没有给素材：优先使用可获得且相关的视觉素材；如不可用，提供明确标注的可替换演示方案。");
  if (!/React|Next\.?js|Vue|Vite|Tailwind|HTML|CSS|TypeScript|Svelte/i.test(text)) openDecisions.push(english ? "No stack specified: reuse the current project stack, or pick a small runnable setup for a new project." : "未指定技术栈：若已有项目则沿用它；若是空项目才选择最小可运行的方案并说明。");
  return {
    kind,
    label: english ? ENGLISH_KIND_LABELS[kind] : KIND_LABELS[kind],
    source: ai ? "ai" : "guided",
    explicitSignals,
    openDecisions,
    visualDirection: value(candidate.visualDirection, english ? "Choose a specific art direction for the subject and explain why it fits; do not default to purple gradients or generic 'premium' styling." : "选择一个与用户主题和用途匹配的视觉方向，并说清它为何合适；不要默认套用同一种紫色渐变或高级感。"),
    composition: value(candidate.composition, base.composition),
    typography: value(candidate.typography, english ? "Assign display and reading type separate jobs, with an intentional scale and reading width." : "分别决定展示字体、正文字体、字号比例和阅读行宽，让字形与内容层级服务于主题。"),
    colorRoles: value(candidate.colorRoles, english ? "Assign canvas, surface, text, secondary text and action colors clear roles; check contrast." : "明确画布、表面、正文、次级文字和行动色的职责；只在必要的位置使用强调色并检查对比度。"),
    visualAnchor: value(candidate.visualAnchor, base.visualAnchor),
    motion: value(candidate.motion, base.motion),
    interactions: value(candidate.interactions, base.interactions),
    implementation: value(candidate.implementation, english ? "Reuse the existing project stack; if starting from scratch choose a small runnable setup and deliver source, a run command and browser checks." : "沿用现有项目栈；若从零开始，选一套最小且完整的可运行方案，交付源码、运行命令与浏览器验证方式。"),
  };
}

/** For the model that writes the *prompt*, not for the model building the website. */
export const FRONTEND_BUILDER_RULES = `网页构建请求额外遵守：
- 用户说「做网站」就要求执行者交付真正可运行的网站，不是只写设计说明、线框图或页面方案；只有用户明确要求设计稿/规范时才改交付物。
- 从 frontendBrief 中选择一条与用户主题相符的艺术方向，具体写出画面构图、字体角色、颜色职责、内容节奏、素材/视觉锚点和主要交互，不能只写「做得好看、现代、高级」。这些是可调整的设计建议，不是用户事实。
- 区分网站类型：营销页面的首屏读成一个完整画面，核心品牌、主张、简短说明、单一主要行动和真实主视觉优先；产品控制台、编辑页面和单组件不强加营销首屏或满屏大图。每个后续区块有独立目的；避免通用三卡片、虚假统计和装饰徽章。
- 视觉参考只能借鉴信息层级、类型尺度、颜色职责和动效节奏，不得复制参考网站的专有商标、文案、布局或付费模板提示词。若用户给出具体链接，要求执行者先查看链接再借鉴；无法打开时不要假称已看过。
- 描述交互时给出真实行为而非仅有外观。若需要动效，只选 2-3 个有用途的动效并交代触发、时长、缓动和出现顺序；保证触屏、键盘及 prefers-reduced-motion。尊重用户要求静态页面的情况。
- 素材必须服务于产品、作品、人物或场景。缺图时给出可替换的合理方案，不用抽象渐变冒充产品/地点，不捏造品牌和客户信息。
- 明确手机和桌面断点、文字对比度、焦点态与素材加载，必要时包含空/加载/错误状态。交付完整能运行的页面或组件，并要求构建与浏览器验证。
- 尊重用户指定的技术栈；若已有仓库沿用其组件和视觉语言，不强行改成单文件 HTML 或另一框架。`;

export const FRONTEND_BUILDER_RULES_EN = `For website-building requests:
- When the person asks to make a website, the executing model must implement and deliver a working site, not stop at a design specification, mockup, wireframe or plan. Produce a design-only artifact only if expressly requested.
- Turn the frontendBrief into one concrete art direction for this user's subject: composition, type roles, color roles, content rhythm, relevant media and working interactions. These are proposed decisions, never product facts.
- Match the kind of site. A promotional page has one branded first-view composition, one main action and a relevant dominant visual; a dashboard or component does not need a marketing hero. Give each later section one job. Avoid generic three-card grids and made-up statistics.
- Borrow only reusable hierarchy, typography, color roles and motion rhythm from design references. Do not copy their proprietary identity, page design, wording or paid prompts. For a user-provided URL, tell the builder to inspect it if available; otherwise do not claim it was seen.
- Only if motion serves the task, use two or three purposeful transitions and specify trigger, duration, easing, order and reduced-motion behavior. Honor a request for a static page.
- Let relevant product, work or context media carry the visual. If absent, label demo media as replaceable. An abstract gradient is not a product or a place.
- Deliver working interactions, responsive mobile/desktop layouts, keyboard focus and accessible contrast. Follow the existing project's stack; do not force a single-file HTML implementation.`;