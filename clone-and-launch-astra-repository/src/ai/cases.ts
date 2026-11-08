/**
 * Few-shot case library for prompt engineering.
 *
 * Each case shows the model *how* a vague one-line request should be judged
 * and then rewritten into a natural-language prompt. Cases are selected by the
 * AI-judged category and injected as examples, so the output style adapts to
 * the domain instead of following one fixed template.
 */
import type { LayerId } from "@/lib/semantic";
import { frontendKind, isFrontendRequest, type FrontendKind } from "@/ai/frontend";

export interface PromptCase {
  id: string;
  category: LayerId;
  title: string;
  input: string;
  judgement: string;
  optimized: string;
  webKind?: FrontendKind;
  language?: "zh" | "en";
}

export const PROMPT_CASES: PromptCase[] = [
  {
    id: "web-landing",
    category: "coding",
    webKind: "site",
    language: "zh",
    title: "一句话做一个网站",
    input: "帮我做一个优美的网页",
    judgement: "网站构建请求；用途、主题和技术栈都没给，不能虚构真实品牌或固定成单文件 HTML。应选一个标明为演示的具体主题，用统一的构图、类型尺度、颜色职责和真实视觉锚点把「优美」落成可执行的方向。",
    optimized: "## 目标与交付\n请为一个明确标注为演示的创意项目构建一页视觉有辨识度、可运行的网站；如果已有项目，沿用它的技术栈，不从零改框架。\n\n## 原始需求与已知信息\n<user_request>帮我做一个优美的网页</user_request>\n已知：用户只要求网页优美。默认假设：暂以创意项目展示为演示主题，名称和内容只是可替换样例，不当作真实品牌事实。\n\n## 执行步骤\n先确定页面希望访客完成的一个主要动作，再围绕它设计首屏与后续内容。选择一种与主题一致的视觉方向，说明展示字体与正文字体各自的职责、画布与行动色如何分配、内容宽度和留白节奏。用与项目相关的作品或场景作为主视觉；缺少真实素材时用注明可替换的示意素材。只为内容进入与主要操作设计两处克制的动效，写明触发、时长与缓动。\n\n## 输出契约\n交付完整源码、运行命令及主要可替换内容；桌面与手机均可用，主要导航和行动按钮须有真实行为。不要使用统一三卡片、纯渐变充当主视觉或虚构的客户评价。\n\n## 质量检查\n交付前验证首屏层级、交互、键盘焦点、窄屏排版与 reduced-motion；不得编造品牌事实。",
  },
  {
    id: "web-open-english",
    category: "coding",
    webKind: "site",
    language: "en",
    title: "A beautiful website from one line",
    input: "I want to make a beautiful website",
    judgement: "A website build, not a request for web-design advice. No product, audience or existing stack is specified; pick one clearly labelled demo direction, never imply it is the user's real business.",
    optimized: "## Goal and deliverable\nBuild a distinctive, working website rather than a mockup. Choose one provisional demo subject because none was provided, label it as an assumption, and keep its copy and images replaceable.\n\n## Request and known information\n<user_request>I want to make a beautiful website</user_request>\nThe only stated preference is visual quality. There is no supplied brand, audience, content or technical stack.\n\n## Execution plan\nDefine the visitor's main job first. Choose one coherent art direction and describe the layout composition, display/body typography, color roles, spacing rhythm and a relevant visual anchor. Keep the first viewport focused; let each later section earn its place. If motion helps, specify two intentional moments with trigger and timing; include reduced-motion behavior.\n\n## Output contract\nShip a working page in the existing project stack, or choose a small runnable setup if this is a new project. Include real navigation/CTA behavior, responsive layouts, accessible focus states and a concise run command.\n\n## Quality checks\nVerify desktop/mobile layout, image fallback, keyboard use and that the main action works. Do not fabricate product claims or testimonials.",
  },
  {
    id: "web-landing-english",
    category: "coding",
    webKind: "landing",
    language: "en",
    title: "A focused product launch",
    input: "Build a calm landing page for my SaaS product with a working demo booking form",
    judgement: "The page has a conversion job: explain the product and make a demo booking work. Product claims, screenshots and customer quotes were not provided.",
    optimized: "## Goal and deliverable\nBuild a working SaaS landing page whose main visitor action is booking a demo. Keep one clear first-view composition instead of feature-card clutter.\n\n## Request and known information\n<user_request>Build a calm landing page for my SaaS product with a working demo booking form</user_request>\nKnown: SaaS, calm tone, working demo booking. Provisional assumptions: product details and assets are missing; label the copy and product UI visual as replaceable demo content.\n\n## Execution plan\nMake the product's value readable before the first CTA, then show only evidence needed to understand it. Use a restrained typography scale, canvas/text/action color roles and a relevant product interface as the visual anchor. Connect the form to a real validation and success/error flow. If motion helps, use only purposeful entry and interaction feedback.\n\n## Output contract\nDeliver runnable source in the existing stack, a responsive page with a working booking form, accessible keyboard focus and a run command.\n\n## Quality checks\nCheck the first viewport, form states and mobile layout. Do not fabricate capabilities, customer logos or usage figures.",
  },
  {
    id: "web-portfolio-english",
    category: "coding",
    webKind: "portfolio",
    language: "en",
    title: "A photographer's portfolio",
    input: "Make a quiet portfolio for a photographer featuring portraits and landscapes",
    judgement: "An image-led portfolio. Portraits and landscapes are the subject, so the site should not resemble a feature-card SaaS page or invent the photographer's work.",
    optimized: "## Goal and deliverable\nBuild a working portfolio that lets visitors explore portrait and landscape work and reach a contact action.\n\n## Request and known information\n<user_request>Make a quiet portfolio for a photographer featuring portraits and landscapes</user_request>\nKnown: photography, two genres, quiet mood. Provisional assumptions: no original photos were supplied; label demo images as replaceable rather than claiming they are the photographer's.\n\n## Execution plan\nMake the imagery the anchor, choose image crop and pacing before decorative elements, and give display typography and readable captions different roles. Use a quiet canvas/text palette with one restrained action color. Let navigation, project switching and contact work with keyboard and touch; use motion only when it improves browsing.\n\n## Output contract\nDeliver runnable page source in the project stack with responsive image layouts, loading fallback, accessible focus and a run command.\n\n## Quality checks\nVerify desktop/mobile crops and contact interaction. Do not fabricate awards, clients or a career history.",
  },
  {
    id: "web-store-english",
    category: "coding",
    webKind: "storefront",
    language: "en",
    title: "A handmade ceramics shop",
    input: "Create a warm online shop for my ceramics with product filters and a working cart",
    judgement: "A storefront with a browsing and purchasing job; real filter/cart state matters more than a cinematic marketing hero. Product prices, stock and reviews are unknown.",
    optimized: "## Goal and deliverable\nBuild a working ceramics storefront where visitors can filter products and add them to a functional cart.\n\n## Request and known information\n<user_request>Create a warm online shop for my ceramics with product filters and a working cart</user_request>\nKnown: ceramics, warm feeling, filters and cart. Provisional assumptions: prices, inventory and photography have not been supplied; label demo products and images as replaceable.\n\n## Execution plan\nLead with relevant product imagery showing material and scale. Give display and reading typography distinct roles, and assign canvas, text and purchase colors a consistent job. Organize the layout around useful product information. Product filters must update the list, and the cart must update quantity with empty and error feedback. Limit animation to product switching and cart state.\n\n## Output contract\nDeliver runnable source, responsive product layouts, working filters and cart, keyboard focus, asset fallbacks and a run command.\n\n## Quality checks\nTest the purchase journey on phone and desktop. Do not fabricate prices, stock, reviews or sales figures.",
  },
  {
    id: "web-dashboard-english",
    category: "coding",
    webKind: "product-ui",
    language: "en",
    title: "A useful operations dashboard",
    input: "Build an operations dashboard with date filters and useful empty states",
    judgement: "A work interface, not a landing page: put the user's core decision, readable data and recoverable filter states first.",
    optimized: "## Goal and deliverable\nBuild a working operations dashboard for reading trends and narrowing the date range.\n\n## Request and known information\n<user_request>Build an operations dashboard with date filters and useful empty states</user_request>\nKnown: operations dashboard, date filters and empty states. Provisional assumptions: metric names and live API are unknown; mark demo data clearly.\n\n## Execution plan\nOrganize the layout by the decision the operator makes, not by a marketing hero. Give display and data typography clear roles, and assign canvas, surface, text and action color roles so charts are legible. Date filters update the displayed data; loading, empty and error states explain the next action. Use motion only for state changes.\n\n## Output contract\nDeliver runnable dashboard source in the existing stack, accessible filter behavior, responsive table/chart handling, keyboard focus and setup instructions.\n\n## Quality checks\nVerify filters and empty/error paths on mobile and desktop. Do not fabricate real business metrics.",
  },
  {
    id: "web-product-launch",
    category: "coding",
    webKind: "landing",
    title: "给产品做落地页",
    input: "帮我的 SaaS 产品做一个极简的落地页，要能让用户预约演示",
    judgement: "产品转化页；访客工作的核心是理解价值并预约演示，用户指定了 SaaS、极简和预约。产品功能未给，不能编造成绩或客户 Logo。",
    optimized: "## 目标与交付\n在现有技术栈中制作 SaaS 产品落地页，主行动是预约演示。视觉方向以清晰的产品界面和克制排版建立可信感，而非无关的炫光。\n\n## 原始需求与已知信息\n<user_request>帮我的 SaaS 产品做一个极简的落地页，要能让用户预约演示</user_request>\n已知：SaaS、极简、预约演示。默认假设：具体功能、产品截图和品牌名称未提供，使用明确可替换的演示内容，不虚构客户评价与数据。\n\n## 执行步骤\n首屏只表达产品做什么、为谁解决什么问题，以及预约演示按钮；用可替换的产品界面图作为主视觉。后续只保留理解产品与建立信任所必需的内容。定下画布、文本和行动色各自职责，以及标题与正文的字号节奏。让按钮真正打开或提交预约流程；动效用于说明界面与操作，写明时长和 reduced-motion 退化。\n\n## 输出契约\n交付可运行页面、响应式布局、表单校验与提交成功/失败状态、键盘焦点和运行方法。\n\n## 质量检查\n验证手机与桌面首屏、预约流程和信息真实性；不得编造产品能力或客户名单。",
  },
  {
    id: "web-photography",
    category: "coding",
    webKind: "portfolio",
    title: "摄影作品集",
    input: "给摄影师做一个安静的作品集，重点展示人像和风景照片",
    judgement: "影像驱动作品集；内容主角是人像和风景，页面节奏应该服务于照片，不应采用 SaaS 落地页或功能卡结构。",
    optimized: "## 目标与交付\n构建摄影师作品集，让访客自然浏览人像与风景作品并找到联系入口。\n\n## 原始需求与已知信息\n<user_request>给摄影师做一个安静的作品集，重点展示人像和风景照片</user_request>\n已知：摄影师、人像与风景、安静气质。默认假设：用户没有提供原始作品照片，暂使用注明可替换的示意图，不冒称是真实作品。\n\n## 执行步骤\n让照片占据视线主导，标题与导航轻量化；用留白构图描述图片比例、裁切、图注与相册节奏。分开人像与风景的观看方式，不给每张图都加厚重圆角卡。限定画布与文字颜色的职责，选择适合阅读的展示字体/正文排版。作品切换只加必要的过渡，说明键盘、触屏与 reduced-motion。\n\n## 输出契约\n交付在现有项目可运行的页面，包含可用的作品切换和联系入口、移动端图像裁切和加载降级。\n\n## 质量检查\n核对照片仍是焦点、文字可读、移动端无横向溢出，且没有虚构作品经历或奖项。",
  },
  {
    id: "web-shop",
    category: "coding",
    webKind: "storefront",
    title: "手作品牌网店",
    input: "为我的手作陶瓷店做一个温暖的网店，能筛选产品和加入购物车",
    judgement: "电商产品页面；主题是手作陶瓷与温暖感，用户明确要求筛选和购物车，不能把产品页写成纯宣传落地页或捏造价格评价。",
    optimized: "## 目标与交付\n构建一个让访客浏览、筛选并选择手作陶瓷商品的温暖网店。\n\n## 原始需求与已知信息\n<user_request>为我的手作陶瓷店做一个温暖的网店，能筛选产品和加入购物车</user_request>\n已知：手作陶瓷、温暖气质、筛选与加入购物车。默认假设：用户尚未给商品图片、价格与库存，示意数据必须注明可替换。\n\n## 执行步骤\n以陶瓷的真实质地和使用场景作为视觉主角，选温暖但可读的画布/文字/行动色；布局围绕商品图、价格、选项和购买行动组织，标题与正文字体建立层级。必须满足「能筛选产品和加入购物车」：让筛选影响实际商品列表，让加入购物车更新数量与反馈，处理空筛选和缺货状态。仅对图像切换与购物车反馈加入克制动效。\n\n## 输出契约\n交付完整可运行的网店页面、移动端商品列表、键盘可用的筛选和购物车交互、图片缺失时的替代方案及运行说明。\n\n## 质量检查\n核对购买路径可用、产品信息有来源、没有虚构评价或销量，手机/桌面都能完成核心操作。",
  },
  {
    id: "web-dashboard",
    category: "coding",
    webKind: "product-ui",
    title: "数据分析工作台",
    input: "做一个给运营看的数据分析后台，支持日期筛选与空状态",
    judgement: "产品工作界面，不是营销页；核心是数据阅读和操作反馈。需要真实筛选与空/加载/错误态，不要强加全屏英雄图。",
    optimized: "## 目标与交付\n构建供运营同事读数、按日期筛选和定位变化的数据分析工作台，信息优先于装饰。\n\n## 原始需求与已知信息\n<user_request>做一个给运营看的数据分析后台，支持日期筛选与空状态</user_request>\n已知：运营使用、日期筛选和空状态。默认假设：未提供真实指标和 API，使用标为演示的数据；不捏造业务成果。\n\n## 执行步骤\n围绕最重要的判断建立信息层级，决定顶部时间范围、指标、趋势与明细的阅读顺序。为画布、内容表面、正文、图表与行动色指定职责，并为数字使用可读的字体字号尺度。日期筛选必须更新图表和数据；为空、加载与出错时给出可恢复的反馈。动效只服务于状态变化，不加入营销首屏或滚动剧场。\n\n## 输出契约\n交付在原项目栈可运行的界面；输出结构应包含实际可操作的筛选、空/加载/错误状态、键盘焦点及手机/桌面布局说明。\n\n## 质量检查\n验证筛选结果、空/错/加载路径、数据标注和可读性；不得虚构业务指标或冒称演示数据为真实业务数据。",
  },
  {
    id: "photo-rename",
    category: "coding",
    title: "批量改照片名",
    input: "写个脚本批量改照片名，重名的别覆盖",
    judgement: "文件自动化脚本；明确约束是“重名不覆盖”。未说明语言和命名规则，应默认 Python 并按拍摄日期命名，同时处理无 EXIF、重名、非图片文件等边界。",
    optimized: "请帮我写一个 Python 脚本，批量重命名一个文件夹里的照片。我没有指定命名规则，请默认按拍摄时间命名（例如 2024-05-01_142233.jpg），读不到拍摄时间时退回到文件修改时间。\n\n最重要的一条要求是：遇到重名绝对不能覆盖已有文件，请自动在文件名后追加序号。请只处理常见图片格式，跳过其他文件，并在运行前打印一份“原名 → 新名”的预览，确认后再真正执行。\n\n请给出完整可运行的代码、需要安装的依赖和运行命令，并说明如何修改命名格式。不要假设我的目录结构，路径通过命令行参数传入。",
  },
  {
    id: "shop-name",
    category: "creative",
    title: "给小店起名",
    input: "给我的小店想个名字",
    judgement: "品牌命名创意；缺少店铺品类、风格和目标顾客，这些会决定命名方向。应让模型先给出多个差异明显的方向，并提醒商标核查，而不是编造店铺信息。",
    optimized: "我想给自己的小店起个名字，但还没想好方向。请你作为品牌命名顾问，先从三到四个彼此差异明显的方向发散，比如温暖生活感、简洁现代感、有趣谐音感、文化意象感，每个方向给出三个候选名。\n\n每个名字请附一句话说明它的含义和适合的店铺气质，并标注读起来是否顺口、好不好记。由于我没有说明卖什么，请在开头列出你最想问我的两个问题（例如品类和目标顾客），然后基于常见的街边小店先给出这一版。\n\n最后挑出你最推荐的三个，说明理由，并提醒我上线前需要自行核查商标与重名情况。请不要编造我店铺的历史或故事。",
  },
  {
    id: "overfitting",
    category: "learning",
    title: "解释过拟合",
    input: "跟新人讲讲什么是过拟合",
    judgement: "概念讲解；受众是刚入门的新人，要求通俗。应先用生活比喻建立直觉，再给机器学习例子和识别/缓解方法，控制术语密度。",
    optimized: "请向一位刚接触机器学习的新人解释什么是“过拟合”。对方没有数学背景，所以请先用一个生活中的比喻建立直觉，比如学生死记硬背考题却不会做新题。\n\n讲清直觉后，再用一个简单的机器学习例子说明它在模型里是什么样子：训练时表现很好，换到新数据就变差。接着告诉对方怎么发现过拟合，以及两三种最常用的缓解办法，每种用一句话说明为什么有效。\n\n整体控制在一页以内，必须用到的术语第一次出现时顺手解释。最后用一个小问题帮对方自查是否真的理解了。",
  },
  {
    id: "subscription",
    category: "analysis",
    title: "要不要做订阅",
    input: "我们小店要不要做线上订阅",
    judgement: "经营决策分析；需要结论先行、比较方案、列出关键假设与验证方法。缺少店铺类型、客群与成本数据，必须提示模型不编造数字。",
    optimized: "我经营一家小店，正在考虑要不要推出线上订阅服务。请你作为经营顾问帮我分析，并先给出一个明确的倾向性结论，再说明理由。\n\n请比较“推出订阅”“暂不推出、先做会员或预售”“完全不做”这几条路径，分别说明适合什么条件、主要成本和风险。由于我没有提供具体数据，请不要编造数字，而是告诉我做决定前最需要先验证的三个假设，以及用最低成本验证它们的方法。\n\n结尾给我一个两周内可以执行的小规模试点方案。如果有信息缺口会显著影响结论，请先列出最多两个问题。",
  },
  {
    id: "apology-email",
    category: "work",
    title: "延期道歉邮件",
    input: "帮我写封给客户的道歉邮件，项目要延期两周",
    judgement: "职场沟通；目的是维护信任并给出补救。约束是延期两周、语气诚恳。需要主题行、原因、补救、新时间点，且不替用户编造具体原因和承诺。",
    optimized: "请帮我写一封发给客户的道歉邮件，说明项目需要延期两周。语气要诚恳、克制、承担责任，但不要过度卑微，也不要推卸给第三方。\n\n邮件请包含一个清楚的主题行，开头直接说明延期这件事，再简要说明原因（具体原因我还没给，请留一个明显的占位让我填写），然后给出补救措施和新的交付时间点，最后说明我们会如何同步进度，并邀请对方提出顾虑。\n\n篇幅控制在 200 字左右，可以直接发送。请不要替我编造任何对方没听过的承诺或补偿。",
  },
  {
    id: "xhs-copy",
    category: "marketing",
    title: "小红书种草文案",
    input: "帮我写一条卖手工香薰的小红书文案",
    judgement: "社媒营销文案；平台是小红书，需要口语化、场景化、有标题钩子和话题标签。不能编造销量、成分认证或用户评价。",
    optimized: "请帮我写一条小红书笔记，推广我自己做的手工香薰。请用真实分享者的口吻，而不是硬广腔，开头用一个能让人停下来的标题和第一句话，比如一个具体的生活场景。\n\n正文用短句和适量表情，讲清楚它带来的感受和适合的使用时刻，把产品特点转成读者能感知的好处。结尾自然地引导互动，并附上五到八个相关话题标签。\n\n请给出两个不同风格的版本供我选择。我没有提供具体香型和价格，涉及的地方请用占位提示；不要编造销量、认证或顾客评价。",
  },
  {
    id: "sales-data",
    category: "data",
    title: "解读销售数据",
    input: "帮我看看这个月销售为啥下滑",
    judgement: "数据诊断；用户还没给数据，需要模型先说明要哪些数据、按什么框架拆解（流量×转化×客单价），并区分相关与因果。",
    optimized: "我们这个月的销售额下滑了，我想找出原因。请你作为数据分析师，先告诉我需要提供哪些数据才能判断（例如按周的访问量、转化率、客单价、渠道和品类拆分），以及每项数据用来回答什么问题。\n\n然后给我一个排查框架：先把销售额拆成流量、转化率和客单价，再逐层定位是哪一环变化最大，最后结合活动、季节和竞品等外部因素判断。请明确区分“数据显示的变化”和“推测的原因”，不要把相关性当成因果。\n\n在我提供数据之前，请不要编造任何数字；拿到数据后，按“结论—证据—下一步动作”的顺序给我一页报告。",
  },
  {
    id: "article",
    category: "writing",
    title: "写一篇文章",
    input: "写篇关于远程办公的文章",
    judgement: "内容写作；主题宽泛，缺少读者、立场与篇幅。应让模型选一个有观点的切入角度，面向明确读者，避免泛泛而谈和编造数据。",
    optimized: "请写一篇关于远程办公的文章。这个话题很宽，请不要写成面面俱到的综述，而是选一个有观点的切入角度，比如“远程办公真正考验的不是自律，而是协作方式”，并在开头说明你选择的角度。\n\n默认读者是刚开始远程工作的职场人，篇幅约 1200 字。请用一个具体的工作场景开头，每一部分都给出能落地的做法，避免空洞的口号。语气自然、有观点，但不说教。\n\n请不要编造统计数据或名人引言；需要论据时用常识性的场景说明。结尾给读者一两条明天就能尝试的建议。",
  },
];

/** Pick examples from the same job, not merely the same broad coding category. */
export function pickCases(category: string, text: string, count = 2): PromptCase[] {
  const lower = text.toLowerCase();
  const frontend = isFrontendRequest(text);
  const kind = frontend ? frontendKind(text) : null;
  const language = /[\u3400-\u9fff]/.test(text) ? "zh" : "en";
  const caseLanguage = (item: PromptCase) => item.language || (/[\u3400-\u9fff]/.test(item.input) ? "zh" : "en");
  let pool = frontend
    ? PROMPT_CASES.filter(item => item.webKind)
    : PROMPT_CASES.filter(item => item.category === category && !item.webKind);
  // Do not teach a small model Chinese prose when its input and deliverable are English.
  if (frontend && pool.some(item => caseLanguage(item) === language)) {
    pool = pool.filter(item => caseLanguage(item) === language);
  }
  const scored = pool.map(item => {
    let score = frontend ? (item.webKind === kind ? 40 : item.webKind === "site" ? 12 : 0) : 12;
    if (caseLanguage(item) === language) score += 8;
    for (const token of item.input.split(/[，,\s]/)) {
      if (token.length >= 2 && lower.includes(token.slice(0, 2).toLowerCase())) score += 1;
    }
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(entry => entry.item);
}
