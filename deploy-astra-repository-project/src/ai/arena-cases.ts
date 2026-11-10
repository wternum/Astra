/**
 * Few-shot app specs for the Arena Code target.
 *
 * Each example shows the level of detail the spec writer should reach for one
 * kind of build that Arena's own starter list covers (landing page, dashboard,
 * game, storefront, tool, clone, visualization). Exactly one example in the
 * request's language is injected per call; its inputs double as UI starters.
 */
import type { FrontendKind } from "@/ai/frontend";
import type { ArenaLanguage, ArenaSpecDraft } from "@/ai/arena";

export interface ArenaCase {
  id: string;
  kind: FrontendKind;
  language: ArenaLanguage;
  input: string;
  spec: ArenaSpecDraft;
}

export const ARENA_CASES: ArenaCase[] = [
  {
    id: "arena-game-zh", kind: "game", language: "zh", input: "做一个打砖块小游戏",
    spec: {
      title: "霓虹打砖块 Brick Rush",
      summary: "一款霓虹风打砖块网页游戏「Brick Rush」，三关递进、道具掉落，打开就能玩，键盘和触屏都顺手。",
      coreLoop: "挡板接球反弹击碎砖块，清空砖块进入下一关；球掉落扣一条命，三条命用完结算。",
      features: ["3 关不同砖块布局，第 2 关起出现需要打 2 次的硬砖","球速每关提升 12%，挡板随鼠标、方向键或手指拖动","击碎砖块 15% 概率掉落道具：加长挡板 / 多球 / 减速，持续 10 秒","3 条命，掉球后 1 秒倒计时再发球"],
      backlog: ["连续击碎 5 块触发连击 ×2 计分","最高分存 localStorage，破纪录时结算卡显示「新纪录」","加入第 4 关 Boss 砖块：会左右移动且需要击打 5 次"],
      interactions: ["鼠标移动、←→ 或手指拖动控制挡板，空格或点击发球", "砖块碎裂时 200ms 碎片粒子，挡板接球时轻微压缩", "P 键或按钮暂停，窗口失焦自动暂停"],
      states: ["开始页：标题、操作说明与开始按钮","进行中：分数、关卡、剩余生命","暂停：半透明遮罩与继续按钮","通关 / 失败：结算卡与再来一局"],
      visual: { style: "霓虹街机，深色背景上发光的砖块与球", palette: "画布 #0B0F1A、砖块 #22D3EE / #F472B6 / #FACC15、挡板 #E6EAF2、文字 #CBD5E1", type: "标题用粗体等宽字，分数 28px 等宽数字", layout: "16:10 游戏区居中、最大 720px，手机竖屏占满宽度", signature: "击碎最后一块砖时全屏霓虹闪烁 400ms", motion: "砖块碎裂 200ms、道具下落旋转、过关标题弹入 300ms" },
      content: ["开局 3 步操作引导，结算卡 3 条随机鼓励语"],
      acceptance: ["键盘、鼠标、触屏都能完整游玩三关","道具效果生效并在 10 秒后恢复","暂停、失败、通关、重开都正确切换","375px 与 1440px 宽度下可玩，控制台无报错"],
    },
  },
  {
    id: "arena-game-en", kind: "game", language: "en", input: "Make a playable space shooter game",
    spec: {
      title: "Starfall Defender",
      summary: "A neon arcade space shooter, \"Starfall Defender\": dodge, shoot and survive escalating waves, playable instantly with keyboard or touch.",
      coreLoop: "Move the ship, auto-fire at descending enemy waves, collect power-ups and survive as long as possible.",
      features: ["Ship moves with arrow keys / WASD or drag on touch, auto-firing every 250ms","Waves of 3 enemy types (drifter, zigzag, tank with 3 HP), getting 10% faster each wave","Power-ups drop 10% of the time: spread shot, shield, rapid fire for 8 seconds","3 lives with 1.5 seconds of invulnerability after a hit"],
      backlog: ["A boss every 5th wave with a visible health bar","Best score and highest wave saved in localStorage","Add a combo multiplier that grows with consecutive hits and resets on damage"],
      interactions: ["Hits flash enemies white for 80ms and spawn particles", "Taking damage shakes the screen for 250ms", "P or the pause button pauses; losing focus auto-pauses"],
      states: ["Title screen with controls","Playing: score, wave and lives HUD","Paused overlay","Game over: score, best, wave reached and Play again"],
      visual: { style: "Neon vector arcade on a starfield", palette: "space #070A14, stars #94A3B8, ship #22D3EE, enemies #F472B6, power-ups #FACC15", type: "Bold monospace title, 24px tabular score", layout: "Portrait 9:16 play area centered on desktop, full screen on phones", signature: "Parallax starfield that speeds up when a boss arrives", motion: "Explosion particles 300ms, wave banner slides in 400ms" },
      content: ["Wave names (e.g. \"Wave 3 – Crossfire\") and 3 rotating game-over lines"],
      acceptance: ["Fully playable with keyboard and touch","Enemy types and power-ups behave as described","Pause, game over and restart all work","Works at 375px and 1440px wide with no console errors"],
    },
  },
  {
    id: "arena-tool-zh", kind: "tool", language: "zh", input: "做一个番茄钟应用",
    spec: {
      title: "番茄专注 Tomato Focus",
      summary: "一个温暖克制的番茄钟应用「Tomato Focus」：专注计时、任务清单和每周统计放在一个页面里。",
      coreLoop: "选一个任务开始 25 分钟专注，结束自动进入休息；完成的番茄记到任务和统计里。",
      features: ["25 / 5 / 15 分钟专注、短休、长休，每 4 个番茄自动长休，时长可在设置里改","大号环形倒计时，开始 / 暂停 / 跳过 / 重置","任务清单：新增、勾选完成、删除，显示每个任务已用番茄数","所有数据与设置存 localStorage，刷新后恢复"],
      backlog: ["结束时播放提示音并发送浏览器通知（用户允许时）","本周统计：7 天柱状图与总专注时长","加入白噪音选择（雨声、咖啡馆）并用 Web Audio 生成"],
      interactions: ["空格开始 / 暂停，N 跳过，快捷键在底部提示", "倒计时剩 1 分钟时环形进度变色", "删除任务 5 秒内可撤销"],
      states: ["空任务：引导添加第一个任务并可填入示例","专注中 / 休息中两种配色","暂停：时间闪烁","计时结束：自动进入下一阶段"],
      visual: { style: "温暖的纸感界面，红番茄色只用于专注态", palette: "画布 #FAF6EF、卡片 #FFFFFF、正文 #2B2420、专注 #E4572E、休息 #0F766E", type: "倒计时 72px 等宽数字，正文 15px", layout: "桌面左计时右任务双栏，768px 以下上下排列", signature: "番茄完成时环形进度化成一颗小番茄落入任务", motion: "环形进度平滑走动，完成动画 600ms" },
      content: ["预置 4 个逼真的示例任务与过去 7 天的专注记录"],
      acceptance: ["计时、暂停、跳过、长休循环都按规则运行","任务增删改与番茄计数正确，刷新后数据仍在","倒计时结束自动切换专注 / 休息并更新番茄计数","375px 与 1440px 宽度下布局正常，控制台无报错"],
    },
  },
  {
    id: "arena-tool-en", kind: "tool", language: "en", input: "Build a markdown editor with dark mode",
    spec: {
      title: "Inkwell",
      summary: "A focused Markdown editor, \"Inkwell\", with live preview, multiple documents and a remembered dark mode.",
      coreLoop: "Pick or create a document, write Markdown on the left and see the rendered preview on the right as you type.",
      features: ["Type in the split view and the live preview updates instantly: headings, lists, links, tables, code blocks and checkboxes","Click toolbar buttons or press Ctrl/Cmd+B, I, K to apply bold, italic, link and code","Changes save to localStorage automatically with a \"Saved\" indicator","Toggle light / dark theme; it follows the system by default and is remembered"],
      backlog: ["Multiple documents in a sidebar: create, rename, delete with undo","Word count, reading time and export to .md or HTML","Add a command palette (Ctrl/Cmd+P) to search and switch documents"],
      interactions: ["Preview scroll follows the editor", "Saved indicator fades in for 1.5 seconds after each change", "Esc toggles a distraction-free mode"],
      states: ["First open: a sample document explaining the syntax","Editing","Empty document placeholder hint","Saved indicator after each change"],
      visual: { style: "Quiet writing tool with editorial typography", palette: "light paper #FBFAF7, ink #1F2328, accent #2563EB; dark #0F1115, text #E6E6E6, accent #7AA2F7", type: "Monospace editor at 15px, serif preview headings, 1.7 line height", layout: "Sidebar + 50/50 split on desktop; tabs for Edit / Preview below 768px", signature: "Smooth crossfade when switching themes", motion: "200ms theme transition, 150ms toolbar feedback" },
      content: ["Three realistic sample documents: a README, meeting notes and a blog draft"],
      acceptance: ["Markdown renders correctly in the preview, including tables and code","Content and theme survive a reload","Toolbar buttons and shortcuts work","Works at 375px and 1440px wide with no console errors"],
    },
  },
  {
    id: "arena-clone-zh", kind: "clone", language: "zh", input: "复刻一个音乐播放器界面",
    spec: {
      title: "潮汐音乐 Tide",
      summary: "复刻主流音乐 App 的桌面播放界面，品牌自拟为「潮汐音乐 Tide」：侧栏导航、歌单网格和底部播放条都能操作。",
      coreLoop: "浏览首页歌单，点开歌单看曲目，点击播放后底部播放条显示进度并可控制。",
      features: ["左侧导航：首页、搜索、我的歌单，切换真实改变主区内容","首页 12 张歌单卡片，封面用 CSS 渐变与几何图形绘制","歌单详情：曲目列表含序号、时长，双击或点按播放","底部播放条：播放 / 暂停、上一首 / 下一首、可拖动进度条和音量（模拟计时）"],
      backlog: ["喜欢按钮切换并在「我喜欢」列表中出现","搜索框按歌名和歌手实时过滤","加入可展开的全屏歌词视图，随进度高亮当前行"],
      interactions: ["卡片悬停浮起并出现播放按钮", "正在播放的曲目高亮并有跳动的音柱", "空格播放 / 暂停，←→ 快退快进 10 秒"],
      states: ["首页浏览","歌单详情","播放中 / 暂停","空歌单"],
      visual: { style: "深色沉浸式音乐界面，信息密度贴近主流播放器", palette: "背景 #0E0F13、侧栏 #15171D、卡片 #1C1F27、文字 #E8EAF0、强调 #1ED6A3", type: "系统字体，歌单标题 16px 粗体，次要信息 13px 灰色", layout: "侧栏 240px + 主区网格 + 底部 88px 播放条；手机端侧栏变底部标签栏", signature: "播放时封面主色渐变铺满歌单详情顶部", motion: "页面切换 220ms 淡入，进度条平滑走动" },
      content: ["自拟 12 个歌单与 60 首虚构歌曲（歌名、歌手、时长），不使用真实歌手或平台 Logo"],
      acceptance: ["导航、歌单详情、播放条交互都能实际操作","正在播放的曲目高亮，空格可以播放 / 暂停","没有使用任何真实平台的 Logo 或商标","375px 与 1440px 宽度下布局正常，控制台无报错"],
    },
  },
  {
    id: "arena-clone-en", kind: "clone", language: "en", input: "Clone a video streaming homepage",
    spec: {
      title: "Reelhouse",
      summary: "Recreate a streaming service homepage under an invented brand, \"Reelhouse\": a hero feature, scrolling title rows and a detail modal.",
      coreLoop: "Browse rows of titles, hover for a preview card, open a detail modal and add titles to My List.",
      features: ["Auto-rotating hero with title, synopsis, Play and More info buttons","6 horizontal rows (Trending, New, Top 10…) scrollable with arrows, drag or swipe","Hover cards expand with rating, runtime and genres","Detail modal with episodes or similar titles, closable with Esc"],
      backlog: ["My List add/remove, persisted in localStorage and shown as its own row","Search overlay filtering titles by name and genre","Add a profile picker screen before the homepage with 4 invented profiles"],
      interactions: ["Row arrows appear on hover and scroll by one page", "The header turns solid after scrolling 80px", "Keyboard focus moves through cards with visible outlines"],
      states: ["Browsing","Hover preview","Detail modal open","Empty row"],
      visual: { style: "Cinematic dark streaming UI with an invented wordmark", palette: "background #0B0B0F, surface #17171F, text #F2F2F5, muted #9A9AA8, brand accent #FF4D6D", type: "Bold condensed display for hero titles, 14px system UI text", layout: "Full-bleed hero at 70vh, rows of 16:9 cards; 2.3 cards visible per row on phones", signature: "Hero background slowly zooms (Ken Burns) behind a gradient", motion: "Card expand 180ms, modal scale-in 220ms" },
      content: ["40 invented titles with names, years, genres, ratings and synopses; posters drawn with CSS gradients and typography"],
      acceptance: ["Rows scroll, hover cards expand and the modal opens and closes","The hero rotates and its buttons respond","No real streaming brand logos or copyrighted posters","Works at 375px and 1440px wide with no console errors"],
    },
  },
  {
    id: "arena-visual-zh", kind: "visual", language: "zh", input: "用 three.js 做一个 3D 太阳系模拟",
    spec: {
      title: "星轨 Orbit",
      summary: "用 three.js 做一个可交互的 3D 太阳系「星轨 Orbit」：八大行星按相对周期公转，可旋转、缩放并查看行星资料。",
      coreLoop: "打开即看到太阳与行星在轨道上运行，拖动旋转视角，点击行星查看资料并跟随它。",
      features: ["太阳发光、八大行星按真实相对公转周期运行，并显示轨道线","时间速度滑块（0–50 倍）与播放 / 暂停","鼠标拖拽旋转、滚轮缩放、右键平移（OrbitControls）","点击行星：镜头平滑飞过去并显示资料卡（直径、公转周期、卫星数）"],
      backlog: ["「真实比例 / 易观察比例」切换","背景星空与土星环、地球卫星","加入小行星带与可开关的行星名称和轨道显示"],
      interactions: ["悬停行星时名称标签高亮", "资料卡可关闭，Esc 返回总览", "手机端双指缩放与单指旋转"],
      states: ["总览运行中","暂停","跟随某颗行星","资料卡打开"],
      visual: { style: "深空写实，太阳辉光与柔和环境光", palette: "背景 #03040A、轨道 #334155、标签 #E2E8F0、强调 #FBBF24、面板 #0F172A", type: "行星名 12px 大写无衬线，资料卡数值用等宽数字", layout: "全屏画布，右上角折叠控制面板，资料卡在左下", signature: "飞向行星时的镜头缓动与轨迹拖尾", motion: "镜头飞行 1.2 秒 ease-in-out，标签淡入 150ms" },
      content: ["八大行星的常识数据（直径、公转周期、卫星数）准确一致"],
      acceptance: ["打开即运行，速度滑块与暂停都生效","拖拽、缩放、点击跟随流畅","资料卡数据正确","375px 与 1440px 宽度下可用，控制台无报错"],
      constraints: ["用 three.js"],
    },
  },
  {
    id: "arena-visual-en", kind: "visual", language: "en", input: "Create a particle galaxy simulation",
    spec: {
      title: "Nebula Drift",
      summary: "An interactive particle galaxy, \"Nebula Drift\": 20,000 stars swirl in spiral arms, and people can reshape the galaxy live.",
      coreLoop: "The galaxy is already spinning on load; drag to orbit the camera, tweak sliders, and click to drop a gravity well.",
      features: ["20,000 GPU-friendly particles forming 2–6 spiral arms","Sliders for arm count, rotation speed, spread and particle count, applied live","Drag to orbit, wheel or pinch to zoom","Click to add a temporary gravity well that bends nearby particles for 5 seconds"],
      backlog: ["Preset buttons: Milky, Ring, Starburst","Pause / resume and Screenshot (downloads a PNG)","Add a second galaxy that can be set on a collision course"],
      interactions: ["Slider changes morph the galaxy over 600ms instead of snapping", "The cursor shows a faint ring where a gravity well would land", "The control panel collapses to an icon"],
      states: ["Running","Gravity well active","Adjusting sliders","Reduced-motion: slow rotation and no trails"],
      visual: { style: "Deep space with additive glowing particles", palette: "space #02030A, core #FDE68A, arms #60A5FA → #C084FC, dust #F472B6, panel #0B1020", type: "Small uppercase sans labels, tabular numbers on sliders", layout: "Full-bleed canvas, panel top-right, bottom sheet on phones", signature: "Gravity wells leave a short glowing swirl", motion: "Continuous rotation driven by delta time; 600ms preset morphs" },
      content: ["Short preset descriptions and a one-line tip for first-time visitors"],
      acceptance: ["It runs on load at a smooth frame rate","Sliders and gravity wells work","Camera controls work with mouse and touch","Works at 375px and 1440px wide with no console errors"],
    },
  },
  {
    id: "arena-landing-zh", kind: "landing", language: "zh", input: "给一款记账 App 做一个落地页",
    spec: {
      title: "小满记账",
      summary: "为记账 App「小满记账」做一个转化落地页：首屏讲清「3 秒记一笔」，引导下载或预约内测。",
      coreLoop: "访客在首屏看懂产品价值，浏览功能演示与用户评价，最后提交手机号预约内测。",
      features: ["首屏：品牌名、主张「3 秒记一笔，月底不慌」、主按钮「预约内测」与手机记账界面主视觉","首屏手机界面自动演示一笔记账过程（循环）","3 个功能区块：语音记账、自动分类、月度报告，各配可交互小演示","预约表单：手机号校验、提交中、成功页与重复提交提示"],
      backlog: ["价格区：免费版 / 会员版，月付年付切换","FAQ 6 条可展开收起","加入「每月能省多少钱」的交互计算器区块"],
      interactions: ["导航锚点平滑滚动并高亮当前区块", "区块进入视口依次揭示 400ms", "手机端汉堡菜单"],
      states: ["首屏入场动画","表单未填 / 校验错误 / 提交中 / 成功","功能演示进行中","移动端菜单展开"],
      visual: { style: "清新温暖的生活方式品牌，圆润但不幼稚", palette: "画布 #FFFBF5、表面 #FFFFFF、正文 #1F2933、主色 #16A34A、点缀 #F59E0B", type: "标题 56px 粗体，正文 17px，行宽 36 字", layout: "最大宽度 1180px，首屏左文案右手机；768px 以下手机图移到文案下方", signature: "首屏手机里的记账演示：输入金额后账单卡片飞入列表", motion: "首屏元素依次入场 300–600ms，数字滚动 800ms" },
      content: ["自拟 3 条用户评价（昵称、职业、一句话）与 2 套价格方案，数据前后一致"],
      acceptance: ["首屏主张、主按钮与演示动画正常","预约表单的校验、提交中与成功状态都能操作","所有文案完整、没有占位文字","375px 与 1440px 宽度下布局正常，控制台无报错"],
    },
  },
  {
    id: "arena-landing-en", kind: "landing", language: "en", input: "Build a landing page for an AI note-taking app",
    spec: {
      title: "Quillmind",
      summary: "A conversion landing page for \"Quillmind\", an AI note-taking app, built around one claim: meetings become clean notes in seconds.",
      coreLoop: "Visitors grasp the value from the hero demo, see proof and pricing, then join the waitlist.",
      features: ["Hero: wordmark, claim \"Your meetings, already written up\", Join waitlist button and an animated note-generation demo","A live demo panel: pick a sample transcript and watch it turn into a summary with action items","Three feature sections (Capture, Summarize, Share), each with a small interactive visual","Waitlist form with email validation, loading, success and already-joined states"],
      backlog: ["Pricing with Free / Pro / Team and a monthly / yearly toggle (yearly saves 20%)","Testimonials carousel with 3 realistic quotes","Add an integrations strip with invented app icons drawn in SVG"],
      interactions: ["Sticky header with anchor links that highlight the current section", "Sections reveal on scroll over 400ms", "Mobile menu toggles open and closed"],
      states: ["Hero entrance","Demo idle / generating / done","Form empty / invalid / submitting / success","Mobile menu open"],
      visual: { style: "Editorial calm with ink-on-paper warmth", palette: "paper #FAF8F4, surface #FFFFFF, ink #161616, accent #4F46E5 used sparingly, highlight #F59E0B", type: "Serif display at 60px, 17px sans body, 65-character lines", layout: "1180px max width, hero split 55/45, single column below 768px", signature: "Typed-out summary in the hero demo with a blinking caret", motion: "Hero staggered entrance 300–600ms, 120ms button press" },
      content: ["Invented brand copy, 3 testimonials with names and roles, and 3 pricing tiers that stay consistent"],
      acceptance: ["The hero demo and live demo panel both work","The waitlist flow works, including validation and success","All copy is complete with no placeholder text","Works at 375px and 1440px wide with no console errors"],
    },
  },
  {
    id: "arena-dashboard-zh", kind: "product-ui", language: "zh", input: "做一个电商运营数据看板",
    spec: {
      title: "鲸选运营台",
      summary: "电商品牌「鲸选」的运营数据看板：一眼看到销售、流量与转化，按日期和渠道筛选并下钻到订单。",
      coreLoop: "打开看关键指标与趋势，调整日期和渠道筛选，点击图表或表格查看明细。",
      features: ["4 个指标卡：销售额、订单数、转化率、客单价，显示环比涨跌","销售额趋势折线图（日 / 周切换）与渠道占比环形图","日期范围（近 7 / 30 / 90 天）与渠道筛选同时更新所有图表和表格","热销商品 Top 10 表格：排序、搜索、分页"],
      backlog: ["点击订单行打开侧边详情抽屉","导出当前筛选数据为 CSV","加入「异常提醒」：转化率环比下跌超过 15% 时在顶部显示提示条"],
      interactions: ["图表悬停显示数值提示，点击图例显隐系列", "筛选后 200ms 过渡并显示「已更新」轻提示", "表头点击排序并显示箭头"],
      states: ["加载骨架屏","筛选无数据的空状态","模拟加载失败与重试按钮","正常数据视图"],
      visual: { style: "清爽专业的数据界面，涨绿跌红只用于变化值", palette: "画布 #F5F7FA、卡片 #FFFFFF、正文 #1E293B、主色 #2563EB、涨 #16A34A、跌 #DC2626", type: "指标 30px 表格数字，正文 14px", layout: "侧栏 220px + 12 列网格，1024px 以下侧栏收起，手机卡片纵排", signature: "指标卡里的迷你趋势线与数字滚动", motion: "图表首次绘制 400ms，筛选切换 200ms" },
      content: ["90 天逼真的模拟订单数据，指标卡数值等于明细合计"],
      acceptance: ["筛选同时更新指标、图表与表格","表格排序、搜索、分页都能操作","加载、空、错误状态可见","375px 与 1440px 宽度下布局正常，控制台无报错"],
    },
  },
  {
    id: "arena-dashboard-en", kind: "product-ui", language: "en", input: "Build a SaaS analytics dashboard",
    spec: {
      title: "Pulseboard",
      summary: "An analytics dashboard for an invented SaaS, \"Pulseboard\", showing revenue, users and churn with filters and drill-downs.",
      coreLoop: "Scan KPIs and trends, narrow by date range and plan, then drill into accounts from the table.",
      features: ["KPI cards: MRR, active users, churn rate and ARPU, each with change vs the previous period","MRR area chart with daily / weekly toggle and a plan-mix stacked bar chart","Date range (7 / 30 / 90 days) and plan filters update every widget together","Accounts table with sorting, search and pagination"],
      backlog: ["Clicking an account opens a side panel with its usage history","Export the filtered table to CSV","Add a cohort retention heatmap view"],
      interactions: ["Chart tooltips on hover; clicking legend items toggles series", "Filters apply within 200ms with a subtle fade", "Keyboard navigation through table rows"],
      states: ["Loading skeletons","Empty state for filters with no data","Simulated error with Retry","Normal view"],
      visual: { style: "Crisp B2B analytics with restrained color", palette: "canvas #F6F7F9, cards #FFFFFF, text #111827, primary #0EA5E9, up #10B981, down #EF4444", type: "Tabular numbers, 30px KPIs, 14px body", layout: "Sidebar + 12-column grid; sidebar collapses below 1024px; cards stack on phones", signature: "Sparkline in each KPI card that redraws on filter change", motion: "400ms initial chart draw, 200ms filter transitions" },
      content: ["90 days of realistic mock data for 120 accounts with consistent totals"],
      acceptance: ["Filters update KPIs, charts and the table together","Sorting, search and pagination work","Loading, empty and error states are reachable","Works at 375px and 1440px wide with no console errors"],
    },
  },
  {
    id: "arena-store-zh", kind: "storefront", language: "zh", input: "做一个手作陶瓷网店，能筛选商品和加入购物车",
    spec: {
      title: "土与火 Clay & Fire",
      summary: "手作陶瓷品牌「土与火」的网店：浏览、筛选、选规格并加入购物车，质感温暖。",
      coreLoop: "浏览商品网格，按类别和价格筛选，进入详情选规格，加入购物车并完成模拟下单。",
      features: ["12 件商品网格：图、名称、价格、「新品 / 限量」标签","按类别（杯 / 碗 / 盘 / 花器）与价格区间筛选，按价格或新品排序","商品详情：釉色选择、数量、库存提示","加入购物车后右侧抽屉打开，可改数量、删除，小计与总价实时计算"],
      backlog: ["购物车存 localStorage，刷新后仍在","模拟结账：收货信息校验与下单成功页","加入「搭配推荐」：详情页展示与当前商品同釉色的 3 件商品"],
      interactions: ["加入购物车时角标跳动并出现提示", "商品图悬停切换第二视角", "筛选切换时网格平滑重排"],
      states: ["正常浏览","筛选无结果","购物车为空","商品详情打开"],
      visual: { style: "温暖的手作质感，留白充足", palette: "画布 #F7F2EA、卡片 #FFFFFF、正文 #2E2620、主色 #B4532A、点缀 #5B7553", type: "标题用衬线展示字 40px，商品名 16px，价格 18px 粗体", layout: "桌面 4 列、平板 3 列、手机 2 列，购物车为右侧抽屉", signature: "商品图用 CSS 渐变与噪点纹理画出釉面质感", motion: "购物车抽屉 240ms 滑入，角标跳动 150ms" },
      content: ["12 件自拟商品（名称、釉色、尺寸、价格、库存），文案有手作故事感"],
      constraints: ["能筛选商品和加入购物车"],
      acceptance: ["筛选、排序、加入购物车、修改数量都能操作","小计与总价计算正确","空购物车与筛选无结果都有清楚提示","375px 与 1440px 宽度下布局正常，控制台无报错"],
    },
  },
  {
    id: "arena-store-en", kind: "storefront", language: "en", input: "Create an online store for specialty coffee beans",
    spec: {
      title: "Ember & Bean",
      summary: "An online store for an invented roaster, \"Ember & Bean\": browse single-origin beans, filter by roast and flavor, and check out a cart.",
      coreLoop: "Browse beans, filter by roast and flavor, choose grind and size, add to cart and complete a mock checkout.",
      features: ["12 coffees with origin, roast level, tasting notes and price","Filters for roast (light / medium / dark), origin and flavor notes, plus sort by price","Product detail with grind (whole / filter / espresso), size (250g / 1kg) and quantity","Cart drawer with quantity changes, removal, subtotal, shipping and total"],
      backlog: ["Cart persists in localStorage","Mock checkout with validation and an order-confirmed screen","Add a subscription option with delivery frequency on the product page"],
      interactions: ["The cart badge bounces and a toast confirms each add", "Hovering a bag reveals its tasting notes", "Filter changes animate the grid instead of reloading"],
      states: ["Browsing","No filter results","Empty cart","Product detail open"],
      visual: { style: "Warm craft roastery with tactile packaging", palette: "canvas #F8F4EE, surface #FFFFFF, text #2A211B, primary #9A3412, accent #3F6212", type: "Serif display headings at 44px, 16px body, prices in bold tabular numbers", layout: "4 columns on desktop, 2 on phones; cart as a right drawer", signature: "Coffee bags drawn in CSS with a roast-level color band", motion: "240ms cart slide-in, 150ms badge bounce" },
      content: ["12 invented coffees with origins, farms, tasting notes and prices that stay consistent"],
      acceptance: ["Filters, sorting, variants and cart changes all work","Subtotals and totals are correct","Empty-cart and no-result states are clear","Works at 375px and 1440px wide with no console errors"],
    },
  },
];

const FALLBACK_KIND: Partial<Record<FrontendKind, FrontendKind>> = {
  site: "landing", editorial: "landing", portfolio: "landing", redesign: "landing", component: "tool",
};

/** Exactly one example in the request's language: same kind, then the closest kind, then a tool. */
export function pickArenaCase(kind: FrontendKind, language: ArenaLanguage): ArenaCase | null {
  const pool = ARENA_CASES.filter(item => item.language === language);
  return pool.find(item => item.kind === kind)
    || pool.find(item => item.kind === FALLBACK_KIND[kind])
    || pool.find(item => item.kind === "tool")
    || null;
}
