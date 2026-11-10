"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, ClipboardCheck, Compass, FileText, Lightbulb, ShieldCheck, Target } from "lucide-react";
import { PROMPT_ENGINEERING_REFERENCES } from "@/ai/blueprint";
import { FRONTEND_REFERENCES } from "@/ai/frontend";
import { PROMPT_CASES } from "@/ai/cases";

const PRINCIPLES = [
  { number: "01", title: "先定义成功", en: "SUCCESS CRITERIA", icon: Target, description: "不要只说「写好一点」。把合格结果写成可观察的标准：能否运行、是否覆盖指定读者、是否包含必须的交付物。", example: "我会根据哪 2–4 条标准验收这个结果？" },
  { number: "02", title: "指令与资料分层", en: "CLEAR BOUNDARIES", icon: Compass, description: "角色和规则是指令，用户原文、素材与参考文档是资料。分开后，模型不容易把资料当成新指令，也不容易遗漏原意。", example: "原文独立保留；事实与默认假设分别标注。" },
  { number: "03", title: "示例校准，而非套话", en: "FEW-SHOT", icon: FileText, description: "少量、相关且有差异的示例，比抽象地说「专业一点」更能稳定格式、语气和内容深度。示例只校准写法，不提供虚构事实。", example: "按当前领域选择案例，不复制案例中的场景。" },
  { number: "04", title: "生成之后必须验证", en: "EVALUATE", icon: ClipboardCheck, description: "提示词工程不是一次性写作。先检查原文、约束、输出契约与可执行性，不合格就返修，再用真实试跑判断效果。", example: "结构校验保证可用性，模型试跑判断实际效果。" },
];

const EXAMPLES = [
  { id: "coding", label: "建站", title: "从「做个漂亮的网站」到能落地的构建说明", before: "帮我做一个优美的网页", after: PROMPT_CASES.find(item => item.id === "web-landing")!.optimized, points: ["没有主题时标明演示假设，不虚构品牌", "明确构图、字体、颜色职责与主视觉", "尊重原技术栈并验收真实交互"] },
  { id: "writing", label: "写作", title: "从「写一篇文章」到可以直接执行的写作任务", before: "写篇关于远程办公的文章。", after: "## 目标与交付\n为刚开始远程工作的职场人写一篇约 1200 字、有明确观点的实用文章，帮助读者改善协作方式。\n\n## 原始需求与已知信息\n<user_request>写篇关于远程办公的文章。</user_request>\n默认采用「协作方式比个人自律更重要」作为切入角度，不使用虚构研究数据。\n\n## 执行步骤\n1. 用一个常见远程工作场景开头。\n2. 选择三个真实协作问题，每个给出可执行做法。\n3. 删除空话与重复，保持自然、不说教的语气。\n\n## 输出契约\n完整文章；包含标题、小标题和结尾两条行动建议；约 1200 字。\n\n## 质量检查\n交付前内部核对：观点是否明确、每段是否有新信息、建议是否可执行、是否未编造数据。", points: ["读者、用途和篇幅明确", "原文与默认假设分开", "输出形式与验收标准可检查"] },
  { id: "coding", label: "开发", title: "从「写个脚本」到可运行、可验证的交付", before: "写个 Python 脚本帮我处理 CSV。", after: "## 目标与交付\n提供一个可直接运行的 Python 3 脚本，读取 CSV、按月汇总销售额并导出新文件。\n\n## 原始需求与已知信息\n<user_request>写个 Python 脚本帮我处理 CSV。</user_request>\n默认输入包含 date 与 sales_amount 两列，路径由命令行参数传入。\n\n## 执行步骤\n1. 读取并校验输入，记录无效日期和空值。\n2. 按月汇总，导出结果且不覆盖已有文件。\n3. 给出依赖、完整代码、运行命令和一个最小验证示例。\n\n## 输出契约\n完整脚本加简短运行说明；异常输入不能让程序无提示中断。\n\n## 质量检查\n交付前内部核对：代码可运行、边界已处理、示例与实现一致、未引用不存在的 API。", points: ["输入、输出与运行方式明确", "异常与边界情况被覆盖", "交付前要求实际验证"] },
  { id: "analysis", label: "分析", title: "从「给个建议」到有依据的决策分析", before: "帮我分析该不该做会员订阅。", after: "## 目标与交付\n评估一家小型门店是否应先试点付费会员，给出倾向性结论和两周验证方案。\n\n## 原始需求与已知信息\n<user_request>帮我分析该不该做会员订阅。</user_request>\n未提供营收、客流和成本数据，所有经营数字只能列为待验证项。\n\n## 执行步骤\n1. 比较会员订阅、普通预售和暂不推出三种路径。\n2. 分开陈述事实、推断和关键假设。\n3. 给出最低成本试点、观察指标和停止条件。\n\n## 输出契约\n先结论后依据；用简洁段落加一张路径对比表；不编造营收预测。\n\n## 质量检查\n交付前内部核对：结论明确、至少比较两种路径、风险清楚、下一步可验证。", points: ["结论与证据边界明确", "比较真实可行路径", "下一步能被验证"] },
];

const WORKFLOW = [
  { name: "ANALYZE", subtitle: "需求判定", formula: "GOAL + DOMAIN + FACTS + SUCCESS CRITERIA", description: "AI 先判断真实目标、领域、受众与交付物，摘录原文事实和约束，并给出可检查的成功标准。推测内容单独标记，不与事实混在一起。", steps: [{ key: "输入", value: "一句自然语言，无需先选择场景或格式。" }, { key: "产出", value: "结构化需求分析、默认假设和最多两个可选澄清问题。" }, { key: "验收", value: "领域具体；原文约束完整；成功标准可观察。" }], example: "「做个优美的网页」不应停留在通用任务，而应识别为前端网页设计与开发，并明确视觉、响应式、可访问性等验收点。" },
  { name: "BLUEPRINT", subtitle: "结构设计", formula: "GOAL → SOURCE → INSTRUCTIONS → OUTPUT → QUALITY", description: "系统根据任务类型选择执行步骤和验收项，再组成五段结构。结构是骨架，不是固定文案：网页、命名、文章和分析会使用不同的专业步骤。", steps: [{ key: "目标与交付", value: "做什么、给谁用、为什么这样做。" }, { key: "原始需求与信息", value: "原文独立保留，事实与默认假设分开。" }, { key: "执行 / 输出 / 质量", value: "领域步骤、输出契约和交付前检查。" }], example: "简单任务压缩执行步骤，复杂任务保留完整链路；避免为了显得专业而无限拉长提示词。" },
  { name: "COMPILE", subtitle: "提示词生成", formula: "TASK CONTEXT + RELEVANT FEW-SHOT → READY PROMPT", description: "AI 只拿到当前任务所需的结构化上下文和相关案例，生成可直接复制的提示词。案例用于校准写法，不会替换用户真实需求。", steps: [{ key: "保留", value: "用户原文逐字放入独立标签，所有硬性约束必须覆盖。" }, { key: "补全", value: "把隐含需求转成具体指令，缺失信息采用默认假设。" }, { key: "禁止", value: "不得要求执行模型先提问、等待资料或展示内部思维过程。" }], example: "最终结果是提示词本身，不包含「以下是优化后的提示词」等解释，也不带代码围栏。" },
  { name: "EVALUATE", subtitle: "工程校验", formula: "GENERATE → CHECK → REPAIR → TEST", description: "系统对生成结果做确定性检查；关键项不合格会带着失败原因自动返修一次。校验通过后，仍可用真实模型对比原版与优化版的实际回答。", steps: [{ key: "确定性检查", value: "原文保留、约束覆盖、结构、输出契约、验收标准、可执行性与事实边界。" }, { key: "自动返修", value: "只针对未通过项修复，保留已经正确的任务内容。" }, { key: "真实评估", value: "规则分数不等于回答质量，最终以同模型试跑和用户验收为准。" }], example: "如果生成稿遗漏「不要太像广告」，该校验会失败并触发返修，而不是仍然显示一个好看的分数。" },
];

const FAQ = [
  { q: "一句话真的够吗？会不会误解我？", a: "一句话足以开始。AI 会区分原文事实与默认假设，缺失信息使用明确标注的暂定假设直接生成；如果结果与你的目标有偏差，可以继续在输入框补一句，或在结果下方展开「继续调整」。" },
  { q: "为什么最终提示词有五个区块？", a: "五个区块分别解决目标、资料边界、执行过程、输出形式和验收标准。它们来自当前主流模型指南的共同建议，但每个区块的内容由任务决定，不是把同一套话术套到所有需求上。" },
  { q: "提示词是不是越长越好？", a: "不是。重复或互相冲突的要求会降低可用性。ASTRA 对简单任务压缩步骤，只在复杂任务中保留完整执行链路；每条规则都应该影响结果。" },
  { q: "工程校验 100 分代表回答一定好吗？", a: "不代表。它只说明提示词在结构、约束和可执行性上通过了检查。回答是否准确、是否有创意、是否真正满足你的场景，仍应通过同模型试跑和人工验收判断。" },
  { q: "Arena Code 模式和通用模式有什么不同？", a: "Arena 模式面向 Arena 的 Code 对战：两个匿名模型拿同一条提示词各自做出可运行的应用，投票看功能、易用性、还原度和视觉。提示词因此写成七段规格——可验证的功能、交互与状态、带色值的视觉方向、逼真的示例内容、沙箱运行约束和完成标准，并附可复制的追问提示词。生成后点击「复制并打开 Arena」，到 arena.ai 的 Code 模式粘贴发送即可，本工具不在本地运行对战。通用模式保留原来的五段式，适合写作、分析等一般任务。" },
  { q: "免费 AI 为什么需要排队？", a: "免费通道目前限制同一 IP 每 45 秒一次回复。Arena 模式每次生成只调用 1 次；通用模式的需求判定和提示词生成是两个独立步骤，必要时还会有返修，因此系统会显示真实排队倒计时。自定义接口没有这个平台排队限制。" },
  { q: "为什么建站提示词不能只写「高级感」？", a: "没有用途和视觉方向时，模型容易给出平均化页面。ASTRA 会从你的一句话里提取明确要求，再提出可调整的布局、字体层级、颜色职责、真实视觉素材和交互决策；缺失的品牌或内容会标为演示假设，而不是冒充你的事实。" },
];

export default function GuidePanel({ onUsePrompt }: { onUsePrompt: (prompt: string, scenario: string) => void }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [openFramework, setOpenFramework] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const example = EXAMPLES[exampleIndex];

  return (
    <div className="guide-page">
      <div className="guide-lead"><div className="guide-lead-copy"><h2>一句话，也能编译成可靠的指令。</h2></div></div>
      <section className="guide-section"><div className="guide-section-head"><div><h2>四条工程原则</h2></div></div><div className="principles-grid">{PRINCIPLES.map(item => { const Icon = item.icon; return <div className="principle-card" key={item.number}><div className="principle-top"><span>{item.number}</span><Icon size={21} /></div><h3>{item.title}</h3><p>{item.description}</p><div className="principle-question"><Lightbulb size={15} /> {item.example}</div></div>; })}</div></section>
      <section className="guide-section"><div className="guide-section-head"><div><h2>优化前后</h2></div></div><div className="example-switch">{EXAMPLES.map((item, index) => <button key={item.label} className={exampleIndex === index ? "active" : ""} onClick={() => setExampleIndex(index)}>{item.label}</button>)}</div><div className="example-stage"><div className="example-stage-title"><h3>{example.title}</h3></div><div className="example-columns"><div className="example-before"><span className="example-label">原始想法</span><p>{example.before}</p></div><div className="example-after"><span className="example-label">结构化提示词</span><p className="example-pre">{example.after}</p><button onClick={() => onUsePrompt(example.before, example.id)}>用这句话试试 <ArrowUpRight size={16} /></button></div></div><div className="example-points">{example.points.map(point => <span key={point}><Check size={14} /> {point}</span>)}</div></div></section>
      <section className="guide-section"><div className="guide-section-head"><div><h2>ASTRA 实际工作流程</h2></div></div><div className="framework-list">{WORKFLOW.map((item, index) => <div className={`framework-item ${openFramework === index ? "open" : ""}`} key={item.name}><button className="framework-trigger" onClick={() => setOpenFramework(openFramework === index ? -1 : index)}><span className="framework-index">0{index + 1}</span><span className="framework-name"><strong>{item.name}</strong><small>{item.subtitle}</small></span><span className="framework-formula">{item.formula}</span><ChevronDown size={19} className={openFramework === index ? "rotated" : ""} /></button>{openFramework === index && <div className="framework-body"><p>{item.description}</p><div className="framework-steps">{item.steps.map(step => <div key={step.key}><strong>{step.key}</strong><span>{step.value}</span></div>)}</div><div className="framework-example"><p>{item.example}</p></div></div>}</div>)}</div></section>
      <section className="guide-section"><div className="guide-section-head"><div><h2>设计依据 · 官方资料</h2></div><ShieldCheck size={23} /></div><div className="reference-list">{PROMPT_ENGINEERING_REFERENCES.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="reference-item"><div><strong>{reference.name}</strong><p>{reference.note}</p></div><ArrowUpRight size={17} /></a>)}</div></section>
      <section className="guide-section"><div className="guide-section-head"><div><h2>建站灵感怎么进入提示词</h2></div></div><p className="guide-reference-intro">Recent 提供方向、Refero 提供可复用的视觉规则、Scrolltide 提供动效的构建语言。它们都不能代替你的产品内容，也不会被当成可照抄的页面模板。</p><div className="reference-list">{FRONTEND_REFERENCES.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="reference-item"><div><strong>{reference.name}</strong><p>{reference.lesson}</p></div><ArrowUpRight size={17} /></a>)}</div></section>
      <section className="guide-section guide-faq-section"><div className="guide-section-head"><div><h2>常见问题</h2></div><CircleHelp size={25} className="guide-faq-icon" /></div><div className="faq-list">{FAQ.map((item, index) => <div className="faq-item" key={item.q}><button onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.q}</strong><ChevronDown size={18} className={openFaq === index ? "rotated" : ""} /></button>{openFaq === index && <p>{item.a}</p>}</div>)}</div></section>
      <div className="guide-outro"><div><h2>用一句话开始</h2></div><button onClick={() => onUsePrompt("", "auto")}>打开工作台 <ArrowRight size={18} /></button></div>
    </div>
  );
}
