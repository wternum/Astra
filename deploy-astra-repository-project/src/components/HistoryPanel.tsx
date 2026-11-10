"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Copy, History, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import type { WorkspaceImport } from "@/components/Optimizer";
import { analyzePrompt, SCENARIOS, type AnalysisResult, type OptimizeOptions, type OptimizeResult } from "@/lib/optimizer";
import { frontendKindLabel, FRONTEND_KINDS, type FrontendKind } from "@/ai/frontend";
import { confirmAction } from "@/lib/confirm";

interface HistoryItem {
  id: number;
  originalPrompt: string;
  optimizedPrompt: string;
  scenario: string;
  scoreBefore: number;
  scoreAfter: number;
  createdAt: string;
  settings: { options?: Partial<OptimizeOptions>; engine?: "local" | "ai"; model?: string; target?: "arena" | "general"; arenaKind?: string | null; followUps?: string[] | null } | null;
  analysis: { before?: AnalysisResult; after?: AnalysisResult; changes?: string[]; rationale?: string } | null;
}
interface FavoriteItem {
  id: number;
  title: string;
  prompt: string;
  category: string;
  note: string | null;
  createdAt: string;
}

type ImportData = Omit<WorkspaceImport, "id">;

export default function HistoryPanel({ onRestore, onCountChange }: { onRestore: (draft: ImportData) => void; onCountChange: (count: number) => void }) {
  const [tab, setTab] = useState<"history" | "favorites">("history");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setBusy(true);
    try {
      const [historyResponse, favoritesResponse] = await Promise.all([fetch("/api/history", { cache: "no-store" }), fetch("/api/favorites", { cache: "no-store" })]);
      const [h, f] = await Promise.all([historyResponse.json(), favoritesResponse.json()]);
      if (!historyResponse.ok || !favoritesResponse.ok) throw new Error("暂时无法读取作品，请稍后重试");
      if (Array.isArray(h)) { setHistory(h); onCountChange(h.length); }
      if (Array.isArray(f)) setFavorites(f);
    } catch (e) { setMessage(e instanceof Error ? e.message : "加载失败"); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); /* Initial load only. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredHistory = useMemo(() => history.filter(h => `${h.originalPrompt} ${h.optimizedPrompt} ${h.scenario}`.toLowerCase().includes(search.toLowerCase())), [history, search]);
  const filteredFavorites = useMemo(() => favorites.filter(f => `${f.title} ${f.prompt} ${f.category}`.toLowerCase().includes(search.toLowerCase())), [favorites, search]);
  const averageDelta = history.length ? Math.round(history.reduce((sum, h) => sum + h.scoreAfter - h.scoreBefore, 0) / history.length) : 0;

  const copy = async (key: string, content: string) => {
    try { await navigator.clipboard.writeText(content); setCopied(key); window.setTimeout(() => setCopied(null), 1800); }
    catch { setMessage("复制失败，请展开后手动选择文本"); }
  };
  const remove = async (kind: "history" | "favorites", id: number) => {
    if (!await confirmAction("这条记录将被永久删除，无法恢复。", { title: "删除这条记录？", subtitle: "删除后不可撤销，收藏的提示词不受影响。", confirmLabel: "确认删除", danger: true })) return;
    try { const response = await fetch(`/api/${kind}?id=${id}`, { method: "DELETE" }); if (!response.ok) throw new Error(); await load(); setMessage("已删除记录"); }
    catch { setMessage("删除失败，请稍后重试"); }
  };
  const clearAll = async () => {
    if (!await confirmAction("所有优化历史将被清空，收藏的提示词不会被删除。", { title: "清空全部历史？", subtitle: "此操作不可撤销，建议先导出重要内容。", confirmLabel: "确认清空", danger: true })) return;
    try { const response = await fetch("/api/history?all=1", { method: "DELETE" }); if (!response.ok) throw new Error(); await load(); setMessage("优化历史已清空"); }
    catch { setMessage("清空失败，请稍后重试"); }
  };
  const restoreHistory = (item: HistoryItem) => {
    const result: OptimizeResult = {
      optimized: item.optimizedPrompt,
      before: item.analysis?.before?.dimensions ? item.analysis.before : analyzePrompt(item.originalPrompt),
      after: item.analysis?.after?.dimensions ? item.analysis.after : analyzePrompt(item.optimizedPrompt),
      changes: Array.isArray(item.analysis?.changes) ? item.analysis.changes : ["已从历史记录重新载入"],
      rationale: item.analysis?.rationale || "历史版本已载入，可以继续编辑或重新优化。",
      engine: item.settings?.engine === "ai" ? "ai" : "local",
      model: item.settings?.model || undefined,
      historyId: item.id,
      createdAt: item.createdAt,
      ...(item.settings?.target === "arena" ? { target: "arena" as const, followUps: Array.isArray(item.settings.followUps) ? item.settings.followUps : [] } : {}),
    };
    onRestore({ prompt: item.originalPrompt, scenario: item.scenario, options: item.settings?.options, result, target: item.settings?.target === "arena" ? "arena" : "general" });
  };
  /** "Arena · 网页游戏" for Arena records, otherwise the general scenario label. */
  const kindLabel = (item: HistoryItem) => {
    if (item.settings?.target !== "arena") return SCENARIOS.find(s => s.id === item.scenario)?.label || "通用任务";
    const kind = (FRONTEND_KINDS as readonly string[]).includes(item.settings.arenaKind || "") ? item.settings.arenaKind as FrontendKind : null;
    return kind ? `Arena · ${frontendKindLabel(kind)}` : "Arena";
  };
  const date = (value: string) => new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });

  return (
    <div className="archive-page">
      <div className="archive-stats"><div className="archive-stat"><span>优化</span><strong>{String(history.length).padStart(2, "0")}</strong></div><div className="archive-stat"><span>收藏</span><strong>{String(favorites.length).padStart(2, "0")}</strong></div><div className="archive-stat accent"><span>平均变化</span><strong>{averageDelta > 0 ? "+" : ""}{averageDelta}</strong></div></div>
      <div className="archive-toolbar"><div className="archive-tabs"><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History size={17} /> 优化历史 <span>{history.length}</span></button><button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}><Star size={17} /> 我的收藏 <span>{favorites.length}</span></button></div><div className="archive-controls"><div className="search-field"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索" aria-label="搜索" /></div><button className="icon-button bordered" onClick={load} title="刷新" aria-label="刷新作品"><RefreshCw size={16} className={busy ? "spin" : ""} /></button></div></div>
      {message && <div className="inline-notice"><Check size={15} /> {message}</div>}
      {tab === "history" ? <div className="archive-list">{filteredHistory.map((item, index) => <article className="history-item" key={item.id}><div className="history-left"><span className="history-index">{String(index + 1).padStart(2, "0")}</span><div className="history-track" /></div><div className="history-main"><div className="history-meta"><span><Clock3 size={14} /> {date(item.createdAt)}</span><span className="history-dot" /><span>{kindLabel(item)}</span><span className={`history-engine ${item.settings?.engine === "ai" ? "ai" : ""}`}>{item.settings?.engine === "ai" ? "AI 深度" : "本地构建"}</span></div><h3>{item.originalPrompt}</h3><div className="history-bottom"><div className="history-score"><span>输入 {item.scoreBefore}</span><ArrowRight size={14} /><strong>优化 {item.scoreAfter}</strong></div><div className="history-actions"><button onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? "收起全文" : "查看优化稿"} <ChevronDown size={14} className={expanded === item.id ? "rotated" : ""} /></button><button onClick={() => copy(`h-${item.id}`, item.optimizedPrompt)}>{copied === `h-${item.id}` ? <Check size={15} /> : <Copy size={15} />} 复制</button><button className="history-continue" onClick={() => restoreHistory(item)}>继续打磨 <ArrowUpRight size={15} /></button><button className="history-delete" onClick={() => remove("history", item.id)} aria-label="删除记录"><Trash2 size={16} /></button></div></div>{expanded === item.id && <pre className="history-expanded">{item.optimizedPrompt}</pre>}</div></article>)}{filteredHistory.length === 0 && <div className="empty-state"><div><History size={25} /></div><h3>{history.length ? "没有匹配的记录" : "暂无历史"}</h3></div>}{history.length > 0 && <div className="archive-clear"><button onClick={clearAll}><Trash2 size={15} /> 清空全部历史</button></div>}</div> : <div className="favorite-grid">{filteredFavorites.map(item => <article className="favorite-card" key={item.id}><div className="favorite-top"><span className="favorite-spark">✳</span><span className="favorite-category">{item.category}</span><button onClick={() => remove("favorites", item.id)} aria-label="删除收藏"><Trash2 size={15} /></button></div><h3>{item.title}</h3><p className="favorite-preview">{item.prompt}</p><div className="favorite-foot"><span>{date(item.createdAt)}</span><div><button onClick={() => copy(`f-${item.id}`, item.prompt)} title="复制提示词">{copied === `f-${item.id}` ? <Check size={17} /> : <Copy size={17} />}</button><button onClick={() => onRestore({ prompt: item.prompt })} title="带入工作台">继续使用 <ArrowUpRight size={15} /></button></div></div></article>)}{filteredFavorites.length === 0 && <div className="empty-state favorite-empty"><div><Star size={25} /></div><h3>{favorites.length ? "没有找到匹配的收藏" : "好想法，值得留着"}</h3><p>{favorites.length ? "试试其他关键词。" : "在工作台优化后点击「收藏」，随时找回它。"}</p></div>}</div>}
    </div>
  );
}
