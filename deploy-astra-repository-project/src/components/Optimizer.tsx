"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, ClipboardCheck,
  Clock3, Copy, Download, FileText, FlaskConical, Layers, Loader2,
  Pencil, Play, Plus, RotateCcw, Save, Send, Sparkles, Star, Swords,
  PlugZap, Wand2, X,
} from "lucide-react";
import {
  analyzePrompt, DEFAULT_OPTIONS, inferScenario, type ModelConfig, type OptimizeOptions,
  type OptimizeResult,
} from "@/lib/optimizer";
import { subscribeAiStatus, type AiStatus } from "@/ai/client";
import { localAnalysis, type NeedAnalysis } from "@/ai/engine";
import type { PromptQuality } from "@/ai/quality";
import { evaluateArenaPrompt } from "@/ai/arena-quality";
import { PROMPT_CASES } from "@/ai/cases";
import { ARENA_CASES } from "@/ai/arena-cases";
import { frontendKindLabel } from "@/ai/frontend";
import { normalizeScope, normalizeTarget, TARGET_DEFAULTS, type ArenaScope, type PromptTarget } from "@/ai/targets";
import ArenaRounds from "@/components/ArenaRounds";
import type { ArenaRound } from "@/ai/arena-rounds";
import type { KnowledgeSnippet } from "@/lib/knowledge";

/** Arena Code mode on the official site, where the optimized prompt is pasted. */
const ARENA_CODE_URL = "https://arena.ai/code";

export interface WorkspaceImport {
  id: number;
  prompt: string;
  scenario?: string;
  options?: Partial<OptimizeOptions>;
  result?: OptimizeResult;
  target?: PromptTarget;
}

const TEMPLATE_CATEGORIES: Record<string, string> = { general: "通用", writing: "写作", coding: "开发", analysis: "分析", marketing: "营销", learning: "学习", creative: "创意", data: "数据", work: "效率" };
const TARGET_KEY = "astra:target:v1";
const SCOPE_KEY = "astra:arena-scope:v1";

function storedTarget(): PromptTarget {
  try { return normalizeTarget(localStorage.getItem(TARGET_KEY), TARGET_DEFAULTS.target); } catch { return TARGET_DEFAULTS.target; }
}

function storedScope(): ArenaScope {
  try { return normalizeScope(localStorage.getItem(SCOPE_KEY)); } catch { return TARGET_DEFAULTS.arena.scope; }
}

/** Quick-start chips: Arena build prompts, or the general task examples. */
const STARTERS: Record<PromptTarget, { id: string; input: string; label: string }[]> = {
  arena: ARENA_CASES.filter(item => item.language === "zh").map(item => ({ id: item.id, input: item.input, label: frontendKindLabel(item.kind) })),
  general: PROMPT_CASES.map(item => ({ id: item.id, input: item.input, label: TEMPLATE_CATEGORIES[item.category] || "灵感" })),
};

export default function Optimizer({
  incoming, modelConfig, onOpenModel, onOpenKnowledge, onGenerated,
}: {
  incoming: WorkspaceImport | null;
  modelConfig: ModelConfig | null;
  onOpenModel: () => void;
  onOpenKnowledge: () => void;
  onGenerated?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"local" | "ai">("local");
  const [aiAnalysis, setAiAnalysis] = useState<NeedAnalysis | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>({ phase: "idle" });
  const [stage, setStage] = useState<"idle" | "analyze" | "blueprint" | "build" | "verify" | "done">("idle");
  const [resultQuality, setResultQuality] = useState<PromptQuality | null>(null);
  const [resultMeta, setResultMeta] = useState<{ analysis: NeedAnalysis; cases: { id: string; title: string }[] } | null>(null);
  const [starterSeed, setStarterSeed] = useState(0);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [versions, setVersions] = useState<OptimizeResult[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [sourcePrompt, setSourcePrompt] = useState("");
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
  const [templateName, setTemplateName] = useState("");
  const [notice, setNotice] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [resultKnowledge, setResultKnowledge] = useState<KnowledgeSnippet[]>([]);
  const [target, setTarget] = useState<PromptTarget>(storedTarget);
  const [sourceTarget, setSourceTarget] = useState<PromptTarget>(target);
  const [scope, setScope] = useState<ArenaScope>(storedScope);
  const requestRef = useRef<AbortController | null>(null);
  const isPublic = modelConfig?.provider === "pollinations";
  const arena = target === "arena";

  useEffect(() => { try { localStorage.setItem(TARGET_KEY, target); } catch { /* Optional preference. */ } }, [target]);
  useEffect(() => { try { localStorage.setItem(SCOPE_KEY, scope); } catch { /* Optional preference. */ } }, [scope]);

  useEffect(() => {
    if (!loading && !tryLoading) { setElapsed(0); return; }
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading, tryLoading]);

  useEffect(() => subscribeAiStatus(setAiStatus), []);
  useEffect(() => {
    const refresh = async () => {
      try {
        // Arena prompts skip the starter notes, so the count follows the target.
        const response = await fetch(`/api/knowledge?target=${target}`, { cache: "no-store" });
        const data = await response.json();
        if (typeof data.enabledCount === "number") setKnowledgeCount(data.enabledCount);
      } catch { /* Knowledge stays optional. */ }
    };
    void refresh();
    window.addEventListener("astra:knowledge-updated", refresh);
    return () => window.removeEventListener("astra:knowledge-updated", refresh);
  }, [target]);

  const trimmed = prompt.trim();
  const preview = useMemo(() => localAnalysis(trimmed, null, target), [trimmed, target]);
  const aiFresh = Boolean(aiAnalysis && aiAnalysis.source === "ai" && aiAnalysis.text === trimmed && (aiAnalysis.target || "general") === target);
  const activeAnalysis = aiFresh && aiAnalysis ? aiAnalysis : preview;
  const starters = useMemo(() => {
    const pool = [...STARTERS[target]];
    for (let i = pool.length - 1; i > 0; i--) { const j = (i * 7 + starterSeed * 13 + 3) % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 3);
  }, [starterSeed, target]);

  const detected = useMemo(() => inferScenario(prompt), [prompt]);
  const stale = Boolean(result && (sourcePrompt !== prompt || sourceTarget !== target));

  useEffect(() => {
    if (!incoming) {
      try {
        const stored = localStorage.getItem("promptforge:draft:v2");
        if (stored) {
          const data = JSON.parse(stored);
          if (typeof data.prompt === "string") setPrompt(data.prompt);
        }
      } catch { /* Browser storage may be disabled. */ }
    }
    setDraftLoaded(true);
    // Load the local draft only once; later imports are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try { localStorage.setItem("promptforge:draft:v2", JSON.stringify({ prompt })); } catch { /* Optional convenience. */ }
  }, [prompt, draftLoaded]);

  useEffect(() => {
    if (!incoming) return;
    // Results saved before Arena mode existed are general prompts.
    const restoredTarget = incoming.target || incoming.result?.target || (incoming.result ? "general" : undefined);
    if (restoredTarget) { setTarget(restoredTarget); setSourceTarget(restoredTarget); }
    setPrompt(incoming.prompt);
    setAiAnalysis(null); setResultMeta(null); setResultQuality(null);
    setResult(incoming.result || null);
    setVersions(incoming.result ? [incoming.result] : []);
    setActiveVersion(0);
    setSourcePrompt(incoming.result ? incoming.prompt : "");
    setEditedText(incoming.result?.optimized || "");
    setError("");
    setTryResult(null);
    setEditing(false);
    window.setTimeout(() => document.getElementById("studio-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [incoming]);

  // AI is the primary engine whenever a channel is connected; offline building stays available.
  useEffect(() => { setMode(modelConfig ? "ai" : "local"); }, [modelConfig]);

  const jumpToInput = () => {
    document.getElementById("goal")?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("goal")?.focus();
  };

  const applyQuickStart = (item: { input: string }) => {
    setPrompt(item.input);
    setAiAnalysis(null); setResultMeta(null); setResultQuality(null);
    setResult(null); setVersions([]); setError(""); setTryResult(null); setStage("idle");
    document.getElementById("goal")?.focus();
  };

  const generate = async (isRevision = false, forceMode?: "local" | "ai", scopeOverride?: ArenaScope) => {
    const runScope = scopeOverride || scope;
    if (loading) return;
    const runMode = forceMode || mode;
    if (!prompt.trim()) { jumpToInput(); return; }
    if (runMode === "ai" && !modelConfig) { onOpenModel(); return; }
    if (isRevision && !feedback.trim()) { setError("请先写下希望如何调整这版提示词"); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(""); setNotice(""); setResultQuality(null);
    if (runMode === "ai" && !(aiFresh || isRevision)) setStage("analyze"); else setStage("blueprint");
    try {
      // Judge the user's sentence before using that analysis to build the prompt.
      let analysisForBuild: NeedAnalysis | null = runMode === "ai" && aiFresh ? aiAnalysis : null;
      if (runMode === "ai" && !analysisForBuild && !isRevision) {
        const judged = await fetch("/api/understand", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ prompt: trimmed, modelConfig, target, useKnowledge }),
        });
        const judgedData = await judged.json();
        if (!judged.ok) throw new Error(judgedData.error || "需求判定失败");
        analysisForBuild = judgedData as NeedAnalysis;
        setAiAnalysis(analysisForBuild);
      }
      // Step 2 — compile a task-specific architecture, then build from it.
      setStage("blueprint");
      await Promise.resolve();
      setStage("build");
      const response = await fetch("/api/optimize", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          prompt, options: DEFAULT_OPTIONS, mode: runMode, modelConfig: runMode === "ai" ? modelConfig : undefined,
          useKnowledge, target, scope: runScope,
          analysis: runMode === "ai" ? analysisForBuild || (aiFresh ? aiAnalysis : undefined) : undefined,
          feedback: isRevision ? feedback : "",
          previousPrompt: isRevision ? result?.optimized : undefined,
          parentHistoryId: isRevision ? result?.historyId : undefined,
        }),
      });
      const data = await response.json();
      setStage("verify");
      if (!response.ok) throw new Error(data.error || "生成失败，请稍后重试");
      const output = data as OptimizeResult;
      const returned = data.analysis && typeof data.analysis === "object" ? data.analysis as NeedAnalysis : null;
      if (returned?.source === "ai") setAiAnalysis(returned);
      setResultMeta(returned ? { analysis: returned, cases: Array.isArray(data.cases) ? data.cases : [] } : null);
      setResultQuality(data.quality && typeof data.quality === "object" ? data.quality as PromptQuality : null);
      setResultKnowledge(Array.isArray(data.knowledgeUsed) ? data.knowledgeUsed as KnowledgeSnippet[] : []);
      setStage("done");
      const nextVersions = isRevision && sourcePrompt === prompt && sourceTarget === target ? [...versions, output] : [output];
      setVersions(nextVersions); setActiveVersion(nextVersions.length - 1);
      setResult(output); setEditedText(output.optimized); setSourcePrompt(prompt); setSourceTarget(target);
      setFeedback(""); setEditing(false); setTryResult(null);
      setFavoriteSaved(false);
      if (output.historyId) onGenerated?.();
      window.setTimeout(() => document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setStage("idle");
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
    setEditing(false); setTryResult(null); setFavoriteSaved(false); setResultQuality(null); setResultMeta(null);
  };

  const copyResult = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.optimized); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setNotice("复制失败，请选中文本手动复制"); }
  };

  /** Copy the prompt, then open Arena's Code mode in a new tab so it can be pasted there. */
  const copyAndOpenArena = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.optimized); setCopied(true); window.setTimeout(() => setCopied(false), 2000); setNotice("已复制，在 Arena 的输入框中粘贴即可"); }
    catch { setNotice("复制失败，请先手动复制提示词，再到 Arena 粘贴"); }
    window.open(ARENA_CODE_URL, "_blank", "noopener,noreferrer");
  };

  /** The spec is unchanged, so switching the first-turn scope re-renders without a model call. */
  const changeScope = () => {
    const next: ArenaScope = scope === "core" ? "full" : "core";
    setScope(next);
    if (result?.target === "arena" && sourcePrompt === prompt && !loading) void generate(false, undefined, next);
  };

  const updateRounds = (rounds: ArenaRound[]) => {
    if (!result) return;
    const updated: OptimizeResult = { ...result, arenaRounds: rounds };
    setResult(updated); setVersions(old => old.map((item, i) => i === activeVersion ? updated : item));
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
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: prompt.slice(0, 32) || "我的提示词", prompt: result.optimized, category: detected.label, note: result.engine === "ai" ? "AI 优化" : "离线构建" }) });
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
      // Arena checks read the rendered text, so a hand-edited prompt can be re-checked.
      setResultQuality(result.target === "arena" ? evaluateArenaPrompt(updated.optimized, sourcePrompt || prompt, resultMeta?.analysis.arena || null) : null);
      setEditing(false); setTryResult(null); setNotice("修订已保存");
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存失败"); }
  };

  const createTemplate = async () => {
    if (!result || !templateName.trim()) return;
    try {
      const response = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: templateName.trim(), category: TEMPLATE_CATEGORIES[detected.id] || "通用", description: "从工作台保存的提示词知识", templateText: result.optimized, enabled: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存到知识库失败");
      setTemplateName(""); setNotice("已保存到知识库，之后会自动匹配相关任务");
      window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存到知识库失败"); }
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

  const progressSteps = arena ? [
    { id: "analyze", label: "构思应用规格" },
    { id: "blueprint", label: "补齐细节" },
    { id: "build", label: "组装提示词" },
    { id: "verify", label: "检查可用性" },
  ] as const : [
    { id: "analyze", label: "理解意图" },
    { id: "blueprint", label: "组织结构" },
    { id: "build", label: "生成提示词" },
    { id: "verify", label: "检查可用性" },
  ] as const;
  const progressIndex = progressSteps.findIndex(item => item.id === stage);
  const progressMessage = aiStatus.phase === "waiting"
    ? `免费通道排队中，还需约 ${aiStatus.seconds} 秒`
    : aiStatus.phase === "calling"
      ? aiStatus.label
      : arena
        ? stage === "analyze" ? "正在构思应用规格" : "正在组装 Arena 提示词并校验"
        : stage === "analyze" ? "正在理解你真正想完成的事" : "正在整理成可直接使用的提示词";

  return (
    <div className="studio-stack flow-studio">
      <section id="studio-composer" className="surface composer-card flow-composer">
        <div className="flow-composer-head">
          <div><span className="flow-index">01 / 你的想法</span>{arena
            ? <><h3>一句话，写出 Arena Code 提示词</h3><p>说出你想让模型做的应用，我们会写成可以直接粘贴到 arena.ai Code 模式的提示词：功能、状态、视觉和运行约束一次写清。</p></>
            : <><h3>说一句话就够了</h3><p>写下你想做的事，我们会把它整理成可以直接使用的提示词。</p></>}</div>
          <button type="button" className="flow-generate" onClick={() => void generate()} disabled={loading || !trimmed}>
            {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            {loading ? "正在优化" : "优化提示词"}<ArrowRight size={15} />
          </button>
        </div>
        <div className="prompt-input-wrap flow-input-wrap">
          <textarea id="goal" className="prompt-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={12000} placeholder={arena ? "例如：做一个能玩的霓虹贪吃蛇……" : "例如：我想做一个漂亮的网站……"} aria-label="原始提示词" />
          <div className="input-footer"><span><kbd>⌘ / Ctrl + Enter</kbd> 生成</span><span className="input-count">{prompt && <button onClick={() => { setPrompt(""); document.getElementById("goal")?.focus(); }} title="清空输入" aria-label="清空输入"><X size={13} /></button>}{prompt.length.toLocaleString()} / 12,000</span></div>
        </div>
        <div className="flow-composer-foot">
          <span className="flow-private-note">{trimmed ? "已收到你的想法，点击优化即可开始" : arena ? "游戏、工具、看板、落地页、网店、复刻都可以" : "不需要填写角色、格式或一整份说明"}</span>
          <div className="flow-foot-actions">
            <button type="button" className={`flow-knowledge-toggle flow-target-toggle ${arena ? "active" : ""}`} onClick={() => setTarget(value => value === "arena" ? "general" : "arena")} aria-pressed={arena} title={arena ? "当前生成用于 arena.ai Code 模式的提示词，点击切换为通用提示词" : "当前为通用提示词，点击切换为 arena.ai Code 模式提示词"}><Swords size={13} />{arena ? "目标 · Arena Code" : "目标 · 通用"}</button>
            {arena && <button type="button" className={`flow-knowledge-toggle flow-scope-toggle ${scope === "core" ? "active" : ""}`} onClick={changeScope} aria-pressed={scope === "core"} title={scope === "core" ? "首轮只做核心闭环，其余功能进入待办，由后续轮次加入。点击切换为完整首轮" : "首轮一次写满全部功能。点击切换为核心首轮 + 逐轮扩展"}><Layers size={13} />{scope === "core" ? "首轮 · 核心" : "首轮 · 完整"}</button>}
            <button type="button" className={`flow-knowledge-toggle ${useKnowledge ? "active" : ""}`} onClick={() => setUseKnowledge(value => !value)} aria-pressed={useKnowledge} title="切换是否让相关知识参与提示词构建"><BookOpen size={13} />知识库 {knowledgeCount} 条 · {useKnowledge ? "参与构建" : "关闭"}</button>
            <button type="button" className="flow-knowledge-open" onClick={onOpenKnowledge} aria-label="管理知识库" title="管理知识库"><ArrowUpRight size={13} /></button>
            <button type="button" className="flow-model-link" onClick={onOpenModel}><PlugZap size={13} />{mode === "ai" ? isPublic ? "免费 AI 已连接" : "自定义 AI 已连接" : "离线模式 · 连接 AI"}<ArrowUpRight size={12} /></button>
          </div>
        </div>
        {!trimmed && <div className="flow-starters" key={starterSeed}>
          <div className="flow-starter-head"><span>试试一句话</span><button type="button" onClick={() => setStarterSeed(value => value + 1)}><RotateCcw size={13} /> 换一批</button></div>
          <div className="quick-start-grid">{starters.map((item, index) => <button type="button" key={item.id} className={`quick-start quick-${["peach", "blue", "mint"][index % 3]}`} onClick={() => applyQuickStart(item)}><span className="quick-category">{item.label}</span><span className="quick-title">{item.input} <ArrowUpRight size={14} /></span></button>)}</div>
        </div>}
      </section>

      <section id="result-section" className={`flow-result ${loading ? "is-loading" : result && !error ? "has-result" : ""}`} aria-label="优化后的提示词">
        <div className="flow-result-head">
          <div><span className="flow-index">02 / 优化结果</span><h3>{loading ? "正在把想法变成提示词" : "优化后的提示词"}</h3></div>
          {result && !loading && !error && !editing && result.target === "arena" && <button type="button" className="flow-open-arena" onClick={() => void copyAndOpenArena()} title="复制提示词并在新标签页打开 arena.ai 的 Code 模式">复制并打开 Arena <ArrowUpRight size={14} /></button>}
          {result && !loading && !error && !editing && <button type="button" className="flow-copy" onClick={copyResult}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制提示词"}</button>}
        </div>

        {loading ? <div className="flow-progress" role="status" aria-live="polite">
          <div className="flow-progress-top"><span className="flow-pulse-dot" /> <strong>{progressMessage}</strong><small>{elapsed}s</small></div>
          <div className="flow-progress-track"><span style={{ width: `${Math.max(12, (progressIndex + 1) * 22)}%` }} /></div>
          <div className="flow-progress-steps">{progressSteps.map((item, index) => <span key={item.id} className={index < progressIndex ? "complete" : index === progressIndex ? "current" : ""}>{index < progressIndex ? <Check size={12} /> : <i />}{item.label}</span>)}</div>
          <div className="flow-writing" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="flow-progress-bottom"><span>{stage === "analyze" ? "正在判断用途与方向" : activeAnalysis.domain ? `按「${activeAnalysis.domain}」整理表达` : "正在梳理你的要求"}</span><button type="button" onClick={() => requestRef.current?.abort()}>取消生成</button></div>
        </div> : error ? <div className="flow-error" role="alert"><CircleHelp size={18} /><span>{error}</span>{mode === "ai" && <button type="button" onClick={() => { setError(""); void generate(false, "local"); }}>使用离线模式</button>}<button type="button" onClick={() => setError("")} aria-label="关闭错误"><X size={16} /></button></div> : result ? <div className="flow-finished" key={result.historyId || result.createdAt || result.optimized.slice(0, 30)}>
          {stale && <div className="flow-stale"><Clock3 size={14} /> 输入已更新。下方仍是上一版结果，点击上方按钮重新优化。</div>}
          <div className="flow-output-meta"><span className="flow-result-source"><span className="flow-live-dot" />{result.engine === "ai" ? "AI 优化" : "离线构建"}{resultMeta?.analysis.domain && (result.engine === "ai" || result.target === "arena") ? ` · ${resultMeta.analysis.domain}` : ""}{resultKnowledge.length > 0 && <span className="flow-knowledge-badge">知识库 {resultKnowledge.length} 条</span>}</span><span>{result.optimized.length.toLocaleString()} 字</span></div>
          <div className="flow-document">{editing ? <textarea className="flow-editor" value={editedText} onChange={e => setEditedText(e.target.value)} maxLength={16000} autoFocus aria-label="编辑优化后的提示词" /> : <pre>{result.optimized}</pre>}</div>
          <div className="flow-output-actions">
            <div>{editing ? <><button type="button" onClick={saveEdit}><Save size={15} /> 保存修订</button><button type="button" onClick={() => { setEditing(false); setEditedText(result.optimized); }}>取消</button></> : <><button type="button" onClick={() => { setEditing(true); setEditedText(result.optimized); }}><Pencil size={15} /> 编辑</button><button type="button" onClick={downloadResult}><Download size={15} /> 下载</button></>}</div>
            <div><button type="button" onClick={favoriteResult} disabled={favoriteSaved}>{favoriteSaved ? <Check size={15} /> : <Star size={15} />}{favoriteSaved ? "已收藏" : "收藏"}</button></div>
          </div>
          {versions.length > 1 && <div className="flow-versions"><span>版本</span>{versions.map((version, index) => <button type="button" key={`${version.historyId || index}-${index}`} className={activeVersion === index ? "active" : ""} onClick={() => selectVersion(index)}>V{index + 1}</button>)}</div>}
          {notice && <div className="flow-notice" role="status"><Check size={14} />{notice}</div>}
          {result.target === "arena" && result.arenaSpec && <ArenaRounds historyId={result.historyId} spec={result.arenaSpec} scope={result.arenaScope || "core"} rounds={result.arenaRounds || []} modelConfig={modelConfig} onChange={updateRounds} />}
          <div className="flow-secondary">
            <details className="flow-detail"><summary><RotateCcw size={16} /> 继续调整 <ChevronDown size={15} /></summary><div className="flow-detail-body"><p>告诉我哪里还不对，我会基于这版重新优化。</p><div className="flow-revision"><input className="form-input" value={feedback} onChange={e => setFeedback(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && feedback.trim() && !loading) void generate(true); }} placeholder="例如：更简短一些，强调实际操作" maxLength={600} /><button type="button" onClick={() => void generate(true)} disabled={loading || !feedback.trim()}><Send size={15} /> 生成新版</button></div></div></details>
            <details className="flow-detail"><summary><ClipboardCheck size={16} /> 更多操作与校验 <ChevronDown size={15} /></summary>
              <div className="flow-detail-body flow-more-body">
                {resultMeta && <p>{resultMeta.analysis.summary}</p>}
                {resultQuality && <div className="flow-checks"><strong>工程检查 · {resultQuality.passed}/{resultQuality.total} 项通过</strong>{resultQuality.checks.map(check => <span key={check.id} className={check.passed ? "pass" : "fail"} title={check.detail}>{check.passed ? <Check size={12} /> : <X size={12} />}{check.label}</span>)}</div>}
                {resultKnowledge.length > 0 && <div className="flow-knowledge-used"><strong>本次引用的知识</strong>{resultKnowledge.map(item => <span key={item.id}>{item.title} · {item.category}</span>)}</div>}
                {result.changes.length > 0 && <ul>{result.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>}
                <p className="flow-score-note">结构校验不等于实际回答质量，建议使用同一模型试跑。</p>
                {result.target !== "arena" && <div className="flow-extra-item"><div><strong><FlaskConical size={15} /> 效果试跑</strong><small>比较原始与优化提示词的真实回答。</small></div>
                    {modelConfig ? <button type="button" className="flow-small-action" onClick={runComparison} disabled={tryLoading}>{tryLoading ? <Loader2 size={15} className="spin" /> : <Play size={15} />}{tryLoading ? "试跑中..." : "开始试跑"}</button> : <button type="button" className="flow-small-action" onClick={onOpenModel}>连接模型 <ArrowRight size={15} /></button>}
                    {tryError && <p className="flow-try-error">{tryError}</p>}
                    {tryResult && <div className="flow-try-result"><div><strong>原始提示词</strong><pre>{tryResult.originalResponse}</pre></div><div><strong>优化后的提示词</strong><pre>{tryResult.optimizedResponse}</pre></div></div>}
                </div>}
                <div className="flow-extra-item"><div><strong><FileText size={15} /> 保存到知识库</strong><small>以后遇到相关任务时，AI 会自动参考这些内容。</small></div><div className="flow-revision"><input className="form-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="给这条知识起个名字" maxLength={60} /><button type="button" onClick={createTemplate} disabled={!templateName.trim()}><Plus size={15} /> 保存</button></div></div>
              </div>
            </details>
          </div>
        </div> : <div className="flow-empty" key={trimmed ? "input-ready" : "waiting-input"}><span className="flow-empty-icon"><Wand2 size={20} /></span><p>{trimmed ? "点击「优化提示词」，结果就会出现在这里。" : "你的优化结果会出现在这里。"}</p></div>}
      </section>
    </div>
  );
}
