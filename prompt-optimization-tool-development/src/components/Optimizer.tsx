"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import SmartSelect from "@/components/SmartSelect";
import {
  ArrowRight, ArrowUpRight, Brain, Check, ChevronDown, CircleHelp, ClipboardCheck,
  Clock3, Compass, Copy, Download, FileText, FlaskConical, Lightbulb, Loader2,
  Pencil, Play, Plus, RotateCcw, Save, Send, SlidersHorizontal, Sparkles, Star,
  Target, Wand2, X,
} from "lucide-react";
import {
  analyzeBrief, analyzePrompt, DEFAULT_OPTIONS, FORMATS, inferIntent, inferScenario, LANGUAGES,
  SCENARIOS, STRATEGIES, TONES, type ModelConfig, type OptimizeOptions,
  type OptimizeResult, type Strategy,
} from "@/lib/optimizer";

export interface WorkspaceImport {
  id: number;
  prompt: string;
  scenario?: string;
  options?: Partial<OptimizeOptions>;
  result?: OptimizeResult;
}

type ResultTab = "prompt" | "diagnosis" | "test";

const QUICK_STARTS = [
  { label: "内容写作", title: "把模糊想法写成好文章", prompt: "写一篇面向初入职场的年轻人的文章，解释为什么建立个人知识库比收集更多工具更重要。", scenario: "writing", color: "peach" },
  { label: "代码开发", title: "让代码一次写到位", prompt: "用 Python 写一个批量重命名照片文件的脚本，按拍摄日期排序，遇到重名文件不要覆盖。", scenario: "coding", color: "blue" },
  { label: "分析决策", title: "从多个角度看清问题", prompt: "我们是一家小型咖啡店，正在考虑是否开设线上订阅服务。请分析可行性和最值得先验证的假设。", scenario: "analysis", color: "mint" },
];

const STRATEGY_ICONS = { precise: Target, deep: Brain, creative: Compass };
const FEEDBACK_CHIPS = ["更简洁一些", "增加可执行步骤", "拓展创意角度", "强调风险与边界"];
const TEMPLATE_CATEGORIES: Record<string, string> = { general: "通用", writing: "写作", coding: "开发", analysis: "分析", marketing: "营销", learning: "学习", creative: "创意", data: "数据", work: "效率" };

function SectionHeading({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div className="section-heading-main"><div><h3>{title}</h3></div></div>
      {right}
    </div>
  );
}

function TogglePill({ checked, onClick, icon, title, description }: { checked: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string }) {
  return (
    <button type="button" className={`toggle-pill ${checked ? "is-on" : ""}`} onClick={onClick} aria-pressed={checked}>
      <span className="toggle-icon">{icon}</span>
      <span className="toggle-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="toggle-switch"><span /></span>
    </button>
  );
}

export default function Optimizer({
  incoming, modelConfig, onOpenModel, onGenerated,
}: {
  incoming: WorkspaceImport | null;
  modelConfig: ModelConfig | null;
  onOpenModel: () => void;
  onGenerated?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<OptimizeOptions>(DEFAULT_OPTIONS);
  const [mode, setMode] = useState<"local" | "ai">("local");
  const [briefOpen, setBriefOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [versions, setVersions] = useState<OptimizeResult[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [resultTab, setResultTab] = useState<ResultTab>("prompt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [favoriteSaved, setFavoriteSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [tryLoading, setTryLoading] = useState(false);
  const [tryError, setTryError] = useState("");
  const [tryResult, setTryResult] = useState<{ originalResponse: string; optimizedResponse: string; model: string } | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [notice, setNotice] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const isPublic = modelConfig?.provider === "pollinations";

  useEffect(() => {
    if (!loading && !tryLoading) { setElapsed(0); return; }
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading, tryLoading]);

  const live = useMemo(() => analyzeBrief(prompt, options), [prompt, options]);
  const detected = useMemo(() => inferScenario(prompt), [prompt]);
  const detectedIntent = useMemo(() => inferIntent(prompt, detected), [prompt, detected]);
  const activeScenario = options.scenario === "auto" ? detected : SCENARIOS.find(s => s.id === options.scenario) || detected;
  const filledFields = [options.context, options.audience, options.deliverable, options.successCriteria, options.mustInclude, options.avoid, options.example].filter(Boolean).length;
  const stale = Boolean(result && sourcePrompt !== prompt);

  useEffect(() => {
    if (!incoming) {
      try {
        const stored = localStorage.getItem("promptforge:draft:v2");
        if (stored) {
          const data = JSON.parse(stored);
          if (typeof data.prompt === "string") setPrompt(data.prompt);
          if (data.options && typeof data.options === "object") setOptions({ ...DEFAULT_OPTIONS, ...data.options });
        }
      } catch { /* Browser storage may be disabled. */ }
    }
    setDraftLoaded(true);
    // Load the local draft only once; later imports are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try { localStorage.setItem("promptforge:draft:v2", JSON.stringify({ prompt, options })); } catch { /* Optional convenience. */ }
  }, [prompt, options, draftLoaded]);

  useEffect(() => {
    if (!incoming) return;
    setPrompt(incoming.prompt);
    setOptions({ ...DEFAULT_OPTIONS, ...incoming.options, scenario: incoming.scenario || incoming.options?.scenario || "auto" });
    setResult(incoming.result || null);
    setVersions(incoming.result ? [incoming.result] : []);
    setActiveVersion(0);
    setSourcePrompt(incoming.result ? incoming.prompt : "");
    setEditedText(incoming.result?.optimized || "");
    setResultTab("prompt");
    setError("");
    setTryResult(null);
    setEditing(false);
    window.setTimeout(() => document.getElementById("studio-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [incoming]);

  useEffect(() => { if (modelConfig) setMode("ai"); else setMode("local"); }, [modelConfig]);

  const set = <K extends keyof OptimizeOptions>(key: K, value: OptimizeOptions[K]) => setOptions(old => ({ ...old, [key]: value }));
  const jumpTo = (id: string) => {
    if (["context", "audience", "deliverable", "successCriteria", "avoid", "mustInclude"].includes(id)) setBriefOpen(true);
    window.setTimeout(() => { const element = document.getElementById(id); element?.scrollIntoView({ behavior: "smooth", block: "center" }); element?.focus(); }, 100);
  };

  const applyQuickStart = (item: typeof QUICK_STARTS[number]) => {
    setPrompt(item.prompt);
    setOptions({ ...DEFAULT_OPTIONS, scenario: item.scenario });
    setResult(null); setVersions([]); setError(""); setTryResult(null);
    document.getElementById("goal")?.focus();
  };

  const generate = async (isRevision = false) => {
    if (loading) return;
    if (!prompt.trim()) { jumpTo("goal"); return; }
    if (mode === "ai" && !modelConfig) { onOpenModel(); return; }
    if (isRevision && !feedback.trim()) { setError("请先写下希望如何调整这版提示词"); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/optimize", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          prompt, options, mode, modelConfig: mode === "ai" ? modelConfig : undefined,
          feedback: isRevision ? feedback : "",
          previousPrompt: isRevision ? result?.optimized : undefined,
          parentHistoryId: isRevision ? result?.historyId : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成失败，请稍后重试");
      const output = data as OptimizeResult;
      const nextVersions = isRevision && sourcePrompt === prompt ? [...versions, output] : [output];
      setVersions(nextVersions); setActiveVersion(nextVersions.length - 1);
      setResult(output); setEditedText(output.optimized); setSourcePrompt(prompt);
      setResultTab("prompt"); setFeedback(""); setEditing(false); setTryResult(null);
      setFavoriteSaved(false);
      if (output.historyId) onGenerated?.();
      window.setTimeout(() => document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error && e.name === "AbortError" ? "已取消等待。你可以调整设置后重新生成。" : e instanceof Error ? e.message : "生成失败，请重试");
    } finally { setLoading(false); requestRef.current = null; }
  };

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && document.getElementById("goal")?.getClientRects().length) { event.preventDefault(); void generate(); }
    };
    const command = () => { void generate(); };
    window.addEventListener("keydown", keyboard);
    window.addEventListener("promptforge:generate", command);
    return () => { window.removeEventListener("keydown", keyboard); window.removeEventListener("promptforge:generate", command); };
  });

  const selectVersion = (index: number) => {
    setActiveVersion(index); setResult(versions[index]); setEditedText(versions[index].optimized);
    setEditing(false); setTryResult(null); setFavoriteSaved(false);
  };

  const copyResult = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.optimized); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setNotice("复制失败，请选中文本手动复制"); }
  };

  const downloadResult = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.optimized], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `astra-${new Date().toISOString().slice(0, 10)}.txt`; anchor.click();
    URL.revokeObjectURL(url);
  };

  const favoriteResult = async () => {
    if (!result) return;
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: prompt.slice(0, 32) || "我的提示词", prompt: result.optimized, category: activeScenario.label, note: `${result.engine === "ai" ? "AI 深度优化" : "本地结构化优化"} · ${STRATEGIES.find(s => s.id === options.strategy)?.label}` }) });
      if (!response.ok) throw new Error("收藏失败，请稍后再试");
      setFavoriteSaved(true); setNotice("已保存到「我的收藏」");
    } catch (e) { setNotice(e instanceof Error ? e.message : "收藏失败"); }
  };

  const saveEdit = async () => {
    if (!result || !editedText.trim()) return;
    try {
      if (result.historyId) {
        const response = await fetch("/api/history", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: result.historyId, optimized: editedText.trim() }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "保存失败");
      }
      const updated: OptimizeResult = { ...result, optimized: editedText.trim(), after: analyzePrompt(editedText.trim()), rationale: "已手动修订并重新评估文本完整度。" };
      setResult(updated); setVersions(old => old.map((item, i) => i === activeVersion ? updated : item));
      setEditing(false); setTryResult(null); setNotice("修订已保存，评分已重新计算");
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存失败"); }
  };

  const createTemplate = async () => {
    if (!result || !templateName.trim()) return;
    try {
      const response = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: templateName.trim(), category: TEMPLATE_CATEGORIES[activeScenario.id] || "通用", description: "从工作台创建的自定义提示词模板", templateText: result.optimized }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存模板失败");
      setSaveAsTemplate(false); setTemplateName(""); setNotice("已保存到模板库");
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存模板失败"); }
  };

  const runComparison = async () => {
    if (!result) return;
    if (!modelConfig) { onOpenModel(); return; }
    setTryLoading(true); setTryError("");
    try {
      const response = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original: sourcePrompt || prompt, optimized: result.optimized, modelConfig }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "试跑失败");
      setTryResult(data);
    } catch (e) { setTryError(e instanceof Error ? e.message : "试跑失败"); }
    finally { setTryLoading(false); }
  };

  const scoreStyle: CSSProperties = { background: `conic-gradient(var(--primary) ${live.score}%, var(--track) ${live.score}% 100%)` };
  const delta = result ? result.after.score - result.before.score : 0;

  return (
    <div className="studio-stack">
      <div id="studio-composer" className="composer-grid">
        <section className="surface composer-card">
          <SectionHeading title="输入提示词" right={<div className="composer-heading-actions"><button className="composer-quick-generate" onClick={() => generate()} disabled={loading || !prompt.trim()}>{loading ? "生成中..." : "生成"} <ArrowRight size={14} /></button></div>} />
          <div className="prompt-input-wrap">
            <textarea id="goal" className="prompt-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={12000} placeholder="例如：帮我做一份面向新用户的产品介绍，希望清楚、有说服力，但不要太像广告……" aria-label="原始提示词" />
            <div className="input-footer"><span><kbd>⌘ / Ctrl + Enter</kbd> 生成</span><span className="input-count">{prompt && <button onClick={() => { setPrompt(""); document.getElementById("goal")?.focus(); }} title="清空输入" aria-label="清空输入"><X size={13} /></button>}{prompt.length.toLocaleString()} / 12,000</span></div>
          </div>
          <div className="starter-heading"><span>示例</span><span className="starter-line" /></div>
          <div className="quick-start-grid">
            {QUICK_STARTS.map(item => (
              <button key={item.title} className={`quick-start quick-${item.color}`} onClick={() => applyQuickStart(item)}>
                <span className="quick-category">{item.label}</span>
                <span className="quick-title">{item.title} <ArrowUpRight size={14} /></span>
              </button>
            ))}
          </div>
        </section>

        <aside className="surface insight-card">
          <div className="insight-top"><span className="eyebrow">输入诊断</span></div>
          <div className="insight-score-area">
            <div className="score-ring" style={scoreStyle}><div className="score-ring-inner"><strong>{live.score}</strong><small>/ 100</small></div></div>
            <div className="insight-score-text"><p className="insight-score-title">{!prompt ? "尚未输入" : live.score >= 75 ? "信息较完整" : live.score >= 50 ? "可继续补充" : "信息不足"}</p></div>
          </div>
          <div className="insight-separator" />
          <div className="detected-row"><span><Compass size={15} /> 场景</span><strong>{prompt ? detected.label : "—"}</strong></div>
          <div className="detected-row detected-intent"><span><Target size={15} /> 任务</span><strong>{prompt ? detectedIntent.label : "—"}</strong></div>
          <div className="insight-bars">
            {live.dimensions.map(d => <div key={d.key} className="mini-bar-row"><span>{d.label}</span><div className="mini-bar-track"><div style={{ width: `${d.score}%` }} /></div><b>{d.score}</b></div>)}
          </div>
          <div className="insight-suggestions"><div className="insight-suggestions-title"><Lightbulb size={15} /><strong>建议补充</strong></div>
            {prompt ? live.issues.slice(0, 2).map(item => <button key={item.id} className="suggestion-row" onClick={() => jumpTo(item.id)}><span>{item.title}</span><span>{item.action} <ArrowRight size={13} /></span></button>) : <p className="empty-suggestion">输入后显示缺失信息。</p>}
            {prompt && live.issues.length === 0 && <p className="empty-suggestion">信息已完整。</p>}
          </div>
        </aside>
      </div>

      <div className="settings-grid">
        <section className="surface brief-card">
          <SectionHeading title="补充信息" right={<button className="subtle-button" onClick={() => setBriefOpen(v => !v)}>{filledFields ? `已填写 ${filledFields} 项` : "展开"} <ChevronDown size={16} className={briefOpen ? "rotated" : ""} /></button>} />
          {briefOpen && <div className="brief-fields">
            <div className="field-span"><label className="field-label" htmlFor="context">背景</label><textarea id="context" className="form-textarea" value={options.context} onChange={e => set("context", e.target.value)} placeholder="任务背景、已知条件" rows={2} /></div>
            <div><label className="field-label" htmlFor="audience">受众</label><input id="audience" className="form-input" value={options.audience} onChange={e => set("audience", e.target.value)} placeholder="例如：产品经理" /></div>
            <div><label className="field-label" htmlFor="deliverable">交付物</label><input id="deliverable" className="form-input" value={options.deliverable} onChange={e => set("deliverable", e.target.value)} placeholder="例如：客户方案" /></div>
            <div><label className="field-label" htmlFor="mustInclude">必须包含</label><input id="mustInclude" className="form-input" value={options.mustInclude} onChange={e => set("mustInclude", e.target.value)} placeholder="例如：案例、预算" /></div>
            <div><label className="field-label" htmlFor="avoid">避免</label><input id="avoid" className="form-input" value={options.avoid} onChange={e => set("avoid", e.target.value)} placeholder="例如：术语堆砌" /></div>
            <div className="field-span"><label className="field-label" htmlFor="successCriteria">验收标准</label><input id="successCriteria" className="form-input" value={options.successCriteria} onChange={e => set("successCriteria", e.target.value)} placeholder="例如：可直接执行" /></div>
          </div>}
          {!briefOpen && <div className="collapsed-note" onClick={() => setBriefOpen(true)}>点击展开背景、受众、交付物与质量标准 <ArrowRight size={15} /></div>}
        </section>

        <section className="surface controls-card">
          <SectionHeading title="优化设置" />
          <div className="control-label">优化策略</div>
          <div className="strategy-grid">{STRATEGIES.map(item => { const Icon = STRATEGY_ICONS[item.id]; return <button key={item.id} className={`strategy-card strategy-${item.id} ${options.strategy === item.id ? "active" : ""}`} aria-pressed={options.strategy === item.id} onClick={() => set("strategy", item.id)}><Icon size={18} /><span>{item.label}</span></button>; })}</div>
          <div className="control-divider" />
          <div className="control-label">任务类型</div>
          <div className="scenario-cloud"><button className={`scenario-chip ${options.scenario === "auto" ? "active" : ""}`} onClick={() => set("scenario", "auto")}>✦ 自动 · {detected.label}</button>{SCENARIOS.slice(1).map(s => <button key={s.id} className={`scenario-chip ${options.scenario === s.id ? "active" : ""}`} onClick={() => set("scenario", s.id)}>{s.label}</button>)}</div>
          <div className="control-divider" />
          <div className="three-selects">
            <div><label className="field-label" htmlFor="format">呈现形式</label><SmartSelect id="format" value={options.format} onChange={value => set("format", value)} options={FORMATS.map(item => ({ value: item.value, label: item.label }))} placeholder="选择呈现形式" /></div>
            <div><label className="field-label" htmlFor="tone">表达语气</label><SmartSelect id="tone" value={options.tone} onChange={value => set("tone", value)} options={TONES.map(item => ({ value: item.value, label: item.label }))} placeholder="选择表达语气" /></div>
            <div><label className="field-label" htmlFor="language">输出语言</label><SmartSelect id="language" value={options.language} onChange={value => set("language", value)} options={LANGUAGES.map(item => ({ value: item.value, label: item.label }))} placeholder="选择输出语言" /></div>
          </div>
          <div className="depth-control"><span className="control-label">结果篇幅</span><div className="segmented">{([{ id: "compact", label: "精简" }, { id: "balanced", label: "标准" }, { id: "detailed", label: "深入" }] as const).map(d => <button key={d.id} className={options.detail === d.id ? "active" : ""} onClick={() => set("detail", d.id)}>{d.label}</button>)}</div></div>
          <button className="advanced-trigger" onClick={() => setAdvancedOpen(v => !v)}><span><SlidersHorizontal size={16} /> 进阶设置</span><ChevronDown size={16} className={advancedOpen ? "rotated" : ""} /></button>
          {advancedOpen && <div className="advanced-body">
            <div className="toggle-grid">
              <TogglePill title="领域角色" description="专业视角" icon={<Target size={16} />} checked={options.enableRole} onClick={() => set("enableRole", !options.enableRole)} />
              <TogglePill title="依据摘要" description="关键理由" icon={<Brain size={16} />} checked={options.enableReasoning} onClick={() => set("enableReasoning", !options.enableReasoning)} />
              <TogglePill title="拓展视角" description="补充角度" icon={<Compass size={16} />} checked={options.enableExplore} onClick={() => set("enableExplore", !options.enableExplore)} />
              <TogglePill title="输出自检" description="检查遗漏" icon={<ClipboardCheck size={16} />} checked={options.enableSelfCheck} onClick={() => set("enableSelfCheck", !options.enableSelfCheck)} />
            </div>
            {options.enableRole && <div><label className="field-label" htmlFor="role">自定义角色</label><input id="role" className="form-input" value={options.role} onChange={e => set("role", e.target.value)} placeholder={`默认：${activeScenario.role}`} /></div>}
            <div><label className="field-label" htmlFor="example">参考示例</label><textarea id="example" className="form-textarea" value={options.example} onChange={e => set("example", e.target.value)} placeholder="粘贴参考表达" rows={2} /></div>
          </div>}
        </section>
      </div>

      <section className={`launch-card ${loading ? "is-working" : ""}`}>
        <div className="launch-orb" aria-hidden="true">{mode === "ai" ? <Sparkles size={22} /> : <Wand2 size={22} />}</div>
        <div className="launch-copy"><h3>{mode === "local" ? "本地生成" : "AI 生成"}</h3>{loading && <div className="generation-progress" role="status"><span className="progress-stripes" /><span>处理中 · {elapsed}s</span><button onClick={() => requestRef.current?.abort()}>取消</button></div>}</div>
        <div className="launch-actions"><div className="engine-switch"><button className={mode === "local" ? "active" : ""} onClick={() => setMode("local")} disabled={loading}><Wand2 size={15} /> 本地构建</button><button className={mode === "ai" ? "active" : ""} onClick={() => { if (!modelConfig) onOpenModel(); else setMode("ai"); }} disabled={loading}><Sparkles size={15} /> {isPublic ? "免费 AI" : "AI 深度优化"}</button></div><button className="launch-button" onClick={() => generate()} disabled={loading || !prompt.trim()}>{loading ? <><Loader2 size={18} className="spin" /> 构思中 · {elapsed}s</> : <>{mode === "ai" ? isPublic ? "免费生成优化稿" : "开始 AI 优化" : "生成优化提示词"} <ArrowRight size={18} /></>}</button><button className="launch-channel-link" onClick={onOpenModel}>{mode === "ai" ? "切换模型" : "连接模型"} <ArrowUpRight size={12} /></button></div>
      </section>
      {error && <div className="workspace-error" role="alert"><CircleHelp size={17} /> {error} <button onClick={() => setError("")} aria-label="关闭"><X size={15} /></button></div>}

      {result ? <section id="result-section" className="result-section">
        <div className="result-section-header"><div><h2>优化结果</h2></div><div className="result-score-pill"><span>完整度变化</span><strong>{delta > 0 ? "+" : ""}{delta}</strong><small>{result.before.score} → {result.after.score}</small></div></div>
        {stale && <div className="stale-banner"><Clock3 size={16} /> 输入已修改，请重新生成。</div>}
        <div className="result-shell">
          <div className="result-toolbar"><div className="result-tabs"><button className={resultTab === "prompt" ? "active" : ""} onClick={() => setResultTab("prompt")}><FileText size={16} /> 优化稿</button><button className={resultTab === "diagnosis" ? "active" : ""} onClick={() => setResultTab("diagnosis")}><SlidersHorizontal size={16} /> 改进报告</button><button className={resultTab === "test" ? "active" : ""} onClick={() => setResultTab("test")}><FlaskConical size={16} /> 效果试跑</button></div><span className={`result-engine-badge ${result.engine === "ai" ? "ai" : ""}`}><span className="live-dot" /> {result.engine === "ai" ? `AI · ${result.model}` : "本地结构化构建"}</span></div>
          {resultTab === "prompt" && <div className="result-content">
            <div className="version-row"><div className="version-list"><span>版本记录</span>{versions.map((v, index) => <button key={`${v.historyId || index}-${index}`} className={activeVersion === index ? "active" : ""} onClick={() => selectVersion(index)}>V{index + 1} <small>{v.engine === "ai" ? "AI" : "本地"}</small></button>)}</div><span className="result-char-count">{result.optimized.length.toLocaleString()} 字</span></div>
            <div className="document-wrap"><div className="document-heading"><span className="document-dot" /><span>优化后的提示词</span><span className="document-file">PROMPT.md</span></div>{editing ? <textarea className="document-editor" value={editedText} onChange={e => setEditedText(e.target.value)} maxLength={16000} autoFocus aria-label="编辑优化后的提示词" /> : <div className="document-lines">{result.optimized.split("\n").map((line, i) => <div key={i} className={`document-line ${/^#{1,3} /.test(line) ? "heading" : ""}`}><span className="line-number">{String(i + 1).padStart(2, "0")}</span><span className="line-content">{line || "\u00a0"}</span></div>)}</div>}</div>
            <div className="result-actions"><div className="result-actions-main">{editing ? <><button className="button-primary" onClick={saveEdit} disabled={!editedText.trim()}><Save size={16} /> 保存修订</button><button className="button-ghost" onClick={() => { setEditing(false); setEditedText(result.optimized); }}>取消</button></> : <><button className="button-primary" onClick={copyResult}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "已复制" : "复制提示词"}</button><button className="button-ghost" onClick={() => { setEditing(true); setEditedText(result.optimized); }}><Pencil size={16} /> 编辑</button><button className="button-ghost" onClick={downloadResult}><Download size={16} /> 下载</button></>}</div><div className="result-actions-side"><button className={`button-ghost ${favoriteSaved ? "saved" : ""}`} onClick={favoriteResult} disabled={favoriteSaved}><Star size={16} /> {favoriteSaved ? "已收藏" : "收藏"}</button><button className="button-ghost" onClick={() => setSaveAsTemplate(v => !v)}><Plus size={16} /> 存为模板</button></div></div>
            {saveAsTemplate && <div className="save-template-row"><input className="form-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="给这个模板起个名字" maxLength={60} /><button className="button-dark" onClick={createTemplate} disabled={!templateName.trim()}>保存到模板库</button><button className="icon-button" onClick={() => setSaveAsTemplate(false)} aria-label="关闭"><X size={17} /></button></div>}
            {notice && <div className="inline-notice" role="status"><Check size={14} /> {notice}</div>}
            <div className="revision-box"><div className="revision-title"><span className="revision-icon"><RotateCcw size={17} /></span><div><strong>继续调整</strong></div></div><div className="feedback-chips">{FEEDBACK_CHIPS.map(chip => <button key={chip} onClick={() => setFeedback(chip)}>{chip}</button>)}</div><div className="revision-input-row"><input className="form-input" value={feedback} onChange={e => setFeedback(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && feedback.trim() && !loading) generate(true); }} placeholder="调整意见" maxLength={600} /><button className="button-dark" onClick={() => generate(true)} disabled={loading || !feedback.trim()}>{loading ? <Loader2 size={17} className="spin" /> : <Send size={17} />} 生成新版本</button></div></div>
          </div>}
          {resultTab === "diagnosis" && <div className="diagnosis-content"><div className="diagnosis-top"><div className="diagnosis-score-card"><span>输入完整度</span><strong>{result.before.score}<small>/100</small></strong></div><ArrowRight size={22} className="diagnosis-arrow" /><div className="diagnosis-score-card after"><span>优化稿完整度</span><strong>{result.after.score}<small>/100</small></strong></div></div><p className="score-disclaimer"><CircleHelp size={15} /> 评分仅供参考。</p><div className="diagnosis-columns"><div><h4><Target size={17} /> 六维对比</h4>{result.before.dimensions.map((d, i) => <div className="compare-row" key={d.key}><span>{d.label}</span><div className="compare-tracks"><div className="compare-track before"><i style={{ width: `${d.score}%` }} /></div><div className="compare-track after"><i style={{ width: `${result.after.dimensions[i]?.score ?? 0}%` }} /></div></div><b>{d.score} → {result.after.dimensions[i]?.score ?? 0}</b></div>)}<div className="compare-legend"><span><i className="before" /> 输入</span><span><i className="after" /> 优化稿</span></div></div><div><h4><Sparkles size={17} /> 改动</h4><div className="rationale-card">{result.rationale}</div><ul className="change-list">{result.changes.map((change, i) => <li key={i}><Check size={15} />{change}</li>)}</ul></div></div></div>}
          {resultTab === "test" && <div className="test-content"><div className="test-intro"><div className="test-icon"><FlaskConical size={22} /></div><div><h3>效果试跑</h3><p>同一模型分别执行原始与优化提示词。</p></div></div>{!modelConfig ? <div className="test-connect"><p>连接模型后试跑。</p><button className="button-dark" onClick={onOpenModel}>连接模型 <ArrowRight size={16} /></button></div> : <><div className="test-control"><span><span className="live-dot" /> 当前模型：{modelConfig.model}</span><button className="button-dark" onClick={runComparison} disabled={tryLoading}>{tryLoading ? <><Loader2 size={16} className="spin" /> 试跑中...</> : <><Play size={16} /> 开始试跑</>}</button></div>{tryError && <div className="form-error" role="alert">{tryError}</div>}{tryResult && <div className="test-compare"><div><div className="test-answer-header"><span>原始提示词</span><small>{tryResult.originalResponse.length} 字</small></div><pre>{tryResult.originalResponse}</pre></div><div><div className="test-answer-header optimized"><span>优化后提示词</span><small>{tryResult.optimizedResponse.length} 字</small></div><pre>{tryResult.optimizedResponse}</pre></div></div>}</>}</div>}
        </div>
      </section> : <section className="awaiting-strip"><span className="awaiting-symbol">✳</span><div><strong>输入提示词后开始优化。</strong></div></section>}
    </div>
  );
}
