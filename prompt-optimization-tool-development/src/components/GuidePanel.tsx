"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Brain, Check, ChevronDown, CircleHelp, Compass, Lightbulb, ShieldCheck, Sparkles, Target } from "lucide-react";

const PRINCIPLES = [
  { number: "01", title: "先说清目标", en: "INTENT", icon: Target, description: "「写点什么」和「写一份给新用户看的功能介绍」会得到完全不同的回答。明确最终要交付的东西。", example: "我要的结果是什么？谁会使用它？" },
  { number: "02", title: "给真实语境", en: "CONTEXT", icon: Compass, description: "模型不知道你的项目、读者和资源限制。补充真实背景，比让模型“猜对”可靠得多。", example: "它会在什么场景下使用？已有条件是什么？" },
  { number: "03", title: "画出边界", en: "BOUNDARIES", icon: ShieldCheck, description: "明确不要什么：不要编造数据、不要术语堆砌、不要超过篇幅。边界让回答更聚焦。", example: "哪些内容不能出现？有哪些必须遵守的条件？" },
  { number: "04", title: "定义好答案", en: "QUALITY BAR", icon: Check, description: "说出你判断答案好坏的标准。是否可执行、是否有依据、读者读后能否采取下一步行动。", example: "我会用什么标准验收这个结果？" },
];

const EXAMPLES = [
  { id: "writing", label: "写作", title: "从「写一篇文章」到真正有人读的内容", before: "帮我写一篇关于远程办公的文章。", after: "你是一位关注工作方式的编辑。请为刚开始远程办公的职场新人，写一篇约 800 字的实用文章。先用一个日常工作场景切入，重点解释 3 个最容易被忽略的协作问题，每个问题给出一个可立即尝试的解决办法。语气友好但不要说教；不要编造研究数据。用小标题分段，结尾给一份简短的行动清单。", points: ["明确了读者与篇幅", "用真实使用场景限定内容", "给出可检查的结构与边界"] },
  { id: "coding", label: "开发", title: "从「写个脚本」到可运行的交付", before: "写个 Python 脚本帮我处理 CSV。", after: "请用 Python 3 写一个可直接运行的脚本：读取本地 CSV 文件，按月份汇总 sales_amount 列，并将结果导出到新的 CSV。输入包含 date 和 sales_amount 两列；跳过空值并记录错误行数，遇到无效日期时不要使程序中断。请给出完整代码、依赖说明、一条示例运行命令，以及一个包含 3 行数据的输入输出示例。不要使用不存在的第三方 API。", points: ["任务被拆成可执行步骤", "补全输入输出与异常处理", "明确交付内容而非只要代码"] },
  { id: "analysis", label: "分析", title: "从「给个建议」到可判断的决策", before: "帮我分析该不该做会员订阅。", after: "我们是一家有 2 家门店的独立咖啡品牌，正考虑推出每月付费会员。请从顾客价值、门店执行成本和现金流三个角度分析是否值得先做小规模试点。明确列出需要验证的关键假设；分别说明乐观与保守情境；最后给出 4 周试点的最小方案、需要跟踪的 3 个指标，以及什么情况下应该停止。没有数据时请明确标注假设，不要虚构营收预测。", points: ["增加真实业务背景", "要求比较情境与风险", "明确可验证的下一步"] },
];

const FRAMEWORKS = [
  { name: "RTF", subtitle: "快速上手", formula: "ROLE  +  TASK  +  FORMAT", description: "只有十秒钟？先确定三个最重要的问题：模型扮演谁、具体要完成什么、结果要如何呈现。适合日常的一次性任务。", steps: [{ key: "R · 角色", value: "给出与任务相关的专业视角，而不是空泛地说「你是专家」。" }, { key: "T · 任务", value: "使用具体动词，写清楚交付目标：分析、改写、列出或设计。" }, { key: "F · 格式", value: "选择便于使用的形式：步骤、对比表、邮件正文或 JSON。" }], example: "你是一位用户研究员；请把下面 5 条访谈原话归纳为用户痛点；用「原话 / 痛点 / 可能的产品机会」三列表格输出。" },
  { name: "CO-STAR", subtitle: "精细控制", formula: "CONTEXT  +  OBJECTIVE  +  STYLE  +  TONE  +  AUDIENCE  +  RESPONSE", description: "当你需要严格控制语气、受众和交付形式时，用这六个维度逐项检查。适合品牌文案、对外沟通或有明确读者的内容。", steps: [{ key: "C · 语境", value: "交代已知背景、产品与应用场景。" }, { key: "O · 目标", value: "说清这份输出要达成什么。" }, { key: "S / T · 风格与语气", value: "让表达方式与任务和品牌一致。" }, { key: "A · 受众", value: "标明读者及其知识背景。" }, { key: "R · 回应", value: "明确字数、结构和交付形式。" }], example: "背景：我们要通知老用户一次产品改版。目标：降低更新带来的困惑。风格：简洁、有人情味。受众：每天使用产品的非技术用户。输出：一封不超过 250 字的邮件，包含变化、影响和下一步。" },
  { name: "CRISP", subtitle: "复杂任务", formula: "CAPABILITY  +  ROLE  +  INSTRUCTION  +  SCENE  +  PERFORMANCE", description: "面向需要深入思考和较高质量标准的复杂任务，明确能力、专业视角、任务、场景与验收指标。并非每次都要写满五项。", steps: [{ key: "C · 能力", value: "说明需要的能力，例如逻辑分析、方案设计或文案打磨。" }, { key: "R · 角色", value: "指定契合任务的专业角色。" }, { key: "I · 指令", value: "写下清晰的任务与交付动作。" }, { key: "S · 场景", value: "提供真实约束、现状与使用背景。" }, { key: "P · 标准", value: "设定判断结果是否够好的条件。" }], example: "你是一位擅长订阅产品的增长顾问。我们是 5 人团队，每月营销预算 2 万元。请设计一个 4 周新用户激活实验，优先选择低成本、可验证的方案；输出实验假设、步骤、关键指标和停止条件。" },
];

const FAQ = [
  { q: "提示词是不是越长越好？", a: "不是。越长不一定越有效，重复的要求还可能互相冲突。优先写清目标、关键背景、边界与输出形式；只有复杂任务才值得展开更多细节。工作台的「精简 / 标准 / 深入」会改变提示词的组织深度。" },
  { q: "能让模型突破自身的限制吗？", a: "清晰的指令能减少歧义和不必要的保守回答，帮助模型更充分地使用正常可用的能力；但无法、也不应绕过模型的安全规则或保证它知道未提供的事实。遇到知识边界，要求说明不确定性比强行索取答案更可靠。" },
  { q: "为什么要补充真实背景，而不是让 AI 自己想？", a: "模型可以推断常见情况，但不知道你公司的规模、客户是谁、真实预算或偏好。把这些事实补进去，输出才会针对你的情况。没有背景时，合理的做法是让模型先问关键问题或明确假设。" },
  { q: "什么时候使用参考示例？", a: "当你对风格、格式或精度有清楚的范本时，真实示例尤其有帮助。只放你认可的参考内容；不要为了“看起来完整”填入虚构示例，否则模型会模仿错误的样本。" },
  { q: "怎样判断优化是否真的有效？", a: "规则评分只能判断指令是否更完整，不能保证回答一定更好。连接一个真实模型，在「效果试跑」中让原版和优化版分别执行，再比较相关性、准确性、可执行性与篇幅是否符合预期。" },
];

export default function GuidePanel({ onUsePrompt }: { onUsePrompt: (prompt: string, scenario: string) => void }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [openFramework, setOpenFramework] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const example = EXAMPLES[exampleIndex];

  return (
    <div className="guide-page">
      <div className="guide-lead"><div className="guide-lead-copy"><h2>让模型少猜一点。</h2></div></div>
      <section className="guide-section"><div className="guide-section-head"><div><h2>四个关键</h2></div></div><div className="principles-grid">{PRINCIPLES.map(item => { const Icon = item.icon; return <div className="principle-card" key={item.number}><div className="principle-top"><span>{item.number}</span><Icon size={21} /></div><h3>{item.title}</h3><p>{item.description}</p><div className="principle-question"><Lightbulb size={15} /> {item.example}</div></div>; })}</div></section>
      <section className="guide-section"><div className="guide-section-head"><div><h2>示例</h2></div></div><div className="example-switch">{EXAMPLES.map((item, index) => <button key={item.id} className={exampleIndex === index ? "active" : ""} onClick={() => setExampleIndex(index)}>{item.label}</button>)}</div><div className="example-stage"><div className="example-stage-title"><h3>{example.title}</h3></div><div className="example-columns"><div className="example-before"><span className="example-label">原始想法</span><p>{example.before}</p></div><div className="example-after"><span className="example-label">优化后</span><p>{example.after}</p><button onClick={() => onUsePrompt(example.before, example.id)}>使用示例 <ArrowUpRight size={16} /></button></div></div><div className="example-points">{example.points.map(point => <span key={point}><Check size={14} /> {point}</span>)}</div></div></section>
      <section className="guide-section"><div className="guide-section-head"><div><h2>框架</h2></div></div><div className="framework-list">{FRAMEWORKS.map((item, index) => <div className={`framework-item ${openFramework === index ? "open" : ""}`} key={item.name}><button className="framework-trigger" onClick={() => setOpenFramework(openFramework === index ? -1 : index)}><span className="framework-index">0{index + 1}</span><span className="framework-name"><strong>{item.name}</strong><small>{item.subtitle}</small></span><span className="framework-formula">{item.formula}</span><ChevronDown size={19} className={openFramework === index ? "rotated" : ""} /></button>{openFramework === index && <div className="framework-body"><p>{item.description}</p><div className="framework-steps">{item.steps.map(step => <div key={step.key}><strong>{step.key}</strong><span>{step.value}</span></div>)}</div><div className="framework-example"><p>{item.example}</p></div></div>}</div>)}</div></section>
      <section className="guide-section guide-faq-section"><div className="guide-section-head"><div><h2>常见问题</h2></div><CircleHelp size={25} className="guide-faq-icon" /></div><div className="faq-list">{FAQ.map((item, index) => <div className="faq-item" key={item.q}><button onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.q}</strong><ChevronDown size={18} className={openFaq === index ? "rotated" : ""} /></button>{openFaq === index && <p>{item.a}</p>}</div>)}</div></section>
      <div className="guide-outro"><div><h2>开始优化</h2></div><button onClick={() => onUsePrompt("", "auto")}>打开工作台 <ArrowRight size={18} /></button></div>
    </div>
  );
}
