"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, Compass, Database, Download, FileText, Focus, GitBranch, Layers3, LayoutTemplate, Link2, Network, Orbit, Pencil, PenTool, Plus, Search, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";

const LIBRARY_ICONS: Record<string, typeof Compass> = { compass: Compass, layout: LayoutTemplate, database: Database, pen: PenTool };
import KnowledgeNetwork from "@/components/KnowledgeNetwork";
import KnowledgeEditor, { type KnowledgeDraft } from "@/components/knowledge/KnowledgeEditor";
import KnowledgeInspector, { RelationInspector } from "@/components/knowledge/KnowledgeInspector";
import Dialog from "@/components/knowledge/Dialog";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { buildKnowledgeGraph, neighborhood, type GraphEdge } from "@/lib/knowledge-graph";
import { LIBRARIES, buildHubGraph, libraryById, libraryCounts, libraryForEntry, type KnowledgeLibrary } from "@/lib/knowledge-library";
import { paletteForEntry } from "@/lib/knowledge-palette";
import "@/knowledge-studio.css";

type Notice = { text: string; error?: boolean };
export default function KnowledgePanel({ onUseKnowledge }: { onUseKnowledge: (text: string, scenario: string) => void }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [scope, setScope] = useState<"mine" | "builtin">("mine");
  const [activeLibrary, setActiveLibrary] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "cards">("graph");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [tag, setTag] = useState("全部");
  const [layout, setLayout] = useState<"network" | "category" | "orbit">("network");
  const [showTopics, setShowTopics] = useState(false);
  const [relationFilter, setRelationFilter] = useState("all");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [depth, setDepth] = useState(1);
  const [limit, setLimit] = useState(40);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [centerSignal, setCenterSignal] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [editor, setEditor] = useState<{ entry: KnowledgeEntry | null } | null>(null);
  const [detail, setDetail] = useState<KnowledgeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/knowledge", { cache: "no-store" });
      if (!response.ok) throw new Error("知识库加载失败，请重试。");
      const data = await response.json();
      if (!Array.isArray(data.entries)) throw new Error("知识数据格式不正确。");
      setEntries(data.entries);
      setSelectedId(old => old ?? data.entries.find((item: KnowledgeEntry) => !item.isBuiltin)?.id ?? null);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "知识库加载失败。"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 5000); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);

  const custom = useMemo(() => entries.filter(item => !item.isBuiltin), [entries]);
  const builtin = useMemo(() => entries.filter(item => item.isBuiltin), [entries]);
  const source = scope === "mine" ? custom : builtin;
  // null → 中心图谱（四个大知识库）；"all" → 全部知识；其余 → 对应子库。
  const isHubView = view === "graph" && activeLibrary === null;
  const currentLibrary: KnowledgeLibrary | null = activeLibrary && activeLibrary !== "all" ? libraryById(activeLibrary) : null;
  const scoped = useMemo(() => source.filter(item => !activeLibrary || activeLibrary === "all" || libraryForEntry(item) === activeLibrary), [source, activeLibrary]);
  const counts = useMemo(() => libraryCounts(source), [source]);
  const categories = useMemo(() => [...new Set(scoped.map(item => item.category || "通用"))], [scoped]);
  const tags = useMemo(() => [...new Set(scoped.flatMap(item => item.tags || []))].slice(0, 10), [scoped]);
  const enabled = custom.filter(item => item.enabled !== false).length;
  const fullGraph = useMemo(() => buildKnowledgeGraph(custom, { limit: 100000 }), [custom]);

  // 当用户在子库中点击/选中某个分类（细致分支）时，或者选中了一条知识且处于分类隔离模式时，
  // 只显示对应分支的内容，不展示其他无关分支。
  const branchCategory = category !== "全部" ? category : null;

  const filtered = useMemo(() => scoped.filter(item => {
    const text = `${item.name} ${item.description} ${item.templateText} ${(item.tags || []).join(" ")}`.toLowerCase();
    const inBranch = !branchCategory || item.category === branchCategory;
    return inBranch && (tag === "全部" || item.tags?.includes(tag)) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [scoped, branchCategory, tag, query]);
  const hubGraph = useMemo(() => buildHubGraph(source), [source]);
  const effectiveLayout = layout === "orbit" ? (currentLibrary ? "orbit" : "network") : layout;
  const baseGraph = useMemo(() => isHubView ? hubGraph : buildKnowledgeGraph(filtered, {
    layout: effectiveLayout, showTopics, limit,
    core: currentLibrary ? { label: currentLibrary.name, accent: currentLibrary.accent, tagline: currentLibrary.tagline } : undefined,
  }), [isHubView, hubGraph, filtered, effectiveLayout, showTopics, limit, currentLibrary]);
  const graph = useMemo(() => {
    let edges = baseGraph.edges.filter(edge => relationFilter === "all" || (relationFilter === "manual" ? edge.origin === "用户标注" : edge.origin === "共享关键词"));
    let nodes = baseGraph.nodes;
    if (focusId) {
      const ids = neighborhood({ ...baseGraph, edges }, focusId, depth);
      nodes = nodes.filter(node => ids.has(node.id));
      edges = edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    }
    return { ...baseGraph, nodes, edges };
  }, [baseGraph, relationFilter, focusId, depth]);
  const selectedEntry = graph.nodes.find(node => node.id === `entry:${selectedId}`)?.entry;
  const hasFilters = category !== "全部" || tag !== "全部" || !!query || !!focusId || relationFilter !== "all";
  const resetFilters = () => { setCategory("全部"); setTag("全部"); setQuery(""); setFocusId(null); setRelationFilter("all"); };
  const switchScope = (next: "mine" | "builtin") => { setScope(next); backToHub(); };
  const selectEntry = useCallback((id: number) => { setSelectedId(id); setSelectedEdge(null); }, []);
  const focusNode = useCallback((id: string) => { setFocusId(old => old === id ? null : id); setSelectedEdge(null); }, []);
  const enterLibrary = (id: string) => {
    setActiveLibrary(id);
    setLayout("orbit");
    resetFilters();
    setSelectedEdge(null); setDetail(null);
    setSelectedId(null);
    setCenterSignal(value => value + 1);
  };
  const backToHub = () => {
    setActiveLibrary(null); setLayout("network"); resetFilters();
    setSelectedId(null); setSelectedEdge(null); setDetail(null); setFocusId(null);
  };
  const chooseSearch = (entry: KnowledgeEntry) => {
    const library = libraryForEntry(entry);
    if (view === "graph" && activeLibrary !== "all" && library !== activeLibrary) {
      setActiveLibrary(library); setLayout("orbit"); resetFilters();
    } else { setCategory("全部"); setTag("全部"); setFocusId(null); }
    selectEntry(entry.id); setSearchOpen(false); setCenterSignal(value => value + 1);
    if (view === "cards") setDetail(entry);
  };
  const save = async (draft: KnowledgeDraft) => {
    const response = await fetch("/api/knowledge", { method: editor?.entry ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(editor?.entry ? { id: editor.entry.id } : {}) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "保存失败，请重试。");
    const savedLibrary = libraryForEntry({ library: data.library, category: data.category });
    setEditor(null); setScope("mine"); resetFilters();
    setActiveLibrary(savedLibrary); setLayout("orbit");
    setSelectedId(data.id); setCenterSignal(value => value + 1);
    await load(); window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
    setNotice({ text: "知识已保存，图谱关联已更新。" });
  };
  const toggle = async (entry: KnowledgeEntry) => {
    const enabled = entry.enabled === false;
    try {
      const response = await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, enabled }) });
      if (!response.ok) throw new Error();
      setEntries(old => old.map(item => item.id === entry.id ? { ...item, enabled } : item));
      setDetail(old => old?.id === entry.id ? { ...old, enabled } : old);
      window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
      setNotice({ text: enabled ? "已启用，相关内容会参与提示词构建。" : "已停用，不再参与提示词构建。" });
    } catch { setNotice({ text: "状态更新失败，请重试。", error: true }); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/knowledge?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();

      setDeleteTarget(null); setSelectedId(null); setSelectedEdge(null); setFocusId(null); setDetail(null);
      await load(); window.dispatchEvent(new CustomEvent("astra:knowledge-updated")); setNotice({ text: "知识条目及指向它的明确关系已删除。" });
    } catch { setNotice({ text: "删除失败，请检查浏览器存储权限后重试。", error: true }); }
    finally { setDeleting(false); }
  };
  const copy = async (entry: KnowledgeEntry) => {
    const { entryCode } = await import("@/components/knowledge/KnowledgeInspector");
    try { await navigator.clipboard.writeText(entryCode(entry)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setNotice({ text: "无法访问剪贴板，请在引用代码中手动选择复制。", error: true }); }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), entries: custom }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `astra-knowledge-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ text: `已导出 ${custom.length} 条知识，包含来源与关系。` });
  };
  const inspector = (entry: KnowledgeEntry) => <KnowledgeInspector key={entry.id} entry={entry} edges={baseGraph.edges} entries={entries} onSelect={id => { selectEntry(id); setCenterSignal(value => value + 1); setDetail(entries.find(item => item.id === id) || null); }} onEdit={() => { setDetail(null); setEditor({ entry }); }} onUse={() => onUseKnowledge(entry.templateText, entry.scenario || "auto")} onToggle={() => void toggle(entry)} onCopy={() => void copy(entry)} copied={copied} onFocus={() => { setDetail(null); setView("graph"); focusNode(`entry:${entry.id}`); }} focused={focusId === `entry:${entry.id}`} onClose={() => { setSelectedId(null); setDetail(null); }} onDelete={() => { setDetail(null); setDeleteTarget(entry); }} />;

  return <div className="kg-page">
    <header className="kg-page-header"><div><div className="kg-title-line"><h1>知识库</h1><span className="kg-workspace-badge">个人知识空间</span></div><p>把零散的经验，连接成可复用的知识。</p></div><div className="kg-header-actions"><button className="kg-icon kg-help-mobile" onClick={() => setHelp(true)} aria-label="图谱构建说明"><CircleHelp size={17} /></button><button className="kg-button kg-export" onClick={exportData} disabled={!custom.length} aria-label="导出知识备份"><Download size={15} />导出</button><button className="kg-button kg-primary" onClick={() => setEditor({ entry: null })}><Plus size={17} />新建知识</button></div></header>
    <div className="kg-overview"><div><span className="kg-stat-icon"><BookOpen size={17} /></span><strong>{custom.length}</strong><span>知识条目</span></div><div><span className="kg-stat-icon"><Layers3 size={17} /></span><strong>{new Set(custom.map(item => item.category)).size}</strong><span>知识分类</span></div><div><span className="kg-stat-icon"><GitBranch size={17} /></span><strong>{fullGraph.edges.length}</strong><span>知识关联</span></div><div><span className="kg-stat-icon kg-stat-green"><Sparkles size={17} /></span><strong>{enabled}</strong><span>参与构建</span></div><button onClick={() => setHelp(true)}><CircleHelp size={15} />图谱如何构建？<ArrowUpRight size={13} /></button></div>
    <div className="kg-library-tabs"><div role="tablist" aria-label="知识来源"><button role="tab" aria-selected={scope === "mine"} className={scope === "mine" ? "active" : ""} onClick={() => switchScope("mine")}>我的知识 <span>{custom.length}</span></button><button role="tab" aria-selected={scope === "builtin"} className={scope === "builtin" ? "active" : ""} onClick={() => switchScope("builtin")}>内置示例 <span>{builtin.length}</span></button></div><span className="kg-storage-note"><i />保存于当前浏览器</span></div>
    <div className="kg-search-toolbar"><div className="kg-search" ref={searchRef}><Search size={17} /><input role="combobox" aria-label="搜索知识" aria-expanded={searchOpen && !!query} aria-controls="kg-search-results" aria-autocomplete="list" aria-activedescendant={searchOpen && query && filtered[searchIndex] ? `kg-result-${filtered[searchIndex].id}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true); setSearchIndex(0); }} onFocus={() => setSearchOpen(true)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setSearchIndex(index => Math.min(index + 1, Math.min(filtered.length, 6) - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setSearchIndex(index => Math.max(0, index - 1)); } else if (event.key === "Enter" && filtered[searchIndex]) { event.preventDefault(); chooseSearch(filtered[searchIndex]); } else if (event.key === "Escape") setSearchOpen(false); }} placeholder="搜索知识、关键词或内容…" />{query ? <button className="kg-icon" onClick={() => setQuery("")} aria-label="清空搜索"><X size={14} /></button> : <kbd>搜索</kbd>}{searchOpen && query && <div className="kg-search-results" id="kg-search-results" role="listbox">{filtered.slice(0, 6).map((entry, index) => <button key={entry.id} id={`kg-result-${entry.id}`} role="option" aria-selected={index === searchIndex} className={index === searchIndex ? "active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => chooseSearch(entry)}><FileText size={15} /><span>{entry.name}<small>{entry.category}</small></span><ArrowUpRight size={13} /></button>)}{!filtered.length && <p>没有找到相关知识，试试其他关键词。</p>}</div>}</div><label className="kg-select"><SlidersHorizontal size={14} /><select aria-label="筛选知识分类" value={category} onChange={event => { setCategory(event.target.value); setFocusId(null); }}><option value="全部">全部分类</option>{categories.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={13} /></label><div className="kg-view-switch" role="group" aria-label="知识库视图"><button className={view === "graph" ? "active" : ""} aria-pressed={view === "graph"} onClick={() => setView("graph")}><Network size={15} />图谱</button><button className={view === "cards" ? "active" : ""} aria-pressed={view === "cards"} onClick={() => setView("cards")}><Layers3 size={15} />卡片</button></div></div>
    <div className="kg-filter-row"><div className="kg-tag-filters"><span>关键词</span><button className={tag === "全部" ? "active" : ""} onClick={() => { setTag("全部"); setFocusId(null); }}>全部</button>{tags.slice(0, 7).map(value => <button key={value} className={tag === value ? "active" : ""} onClick={() => { setTag(tag === value ? "全部" : value); setFocusId(null); }}>{value}</button>)}</div><span className="kg-result-count">{filtered.length} 条结果{hasFilters && <button onClick={resetFilters}>重置 <X size={12} /></button>}</span></div>
    {(view === "cards" || activeLibrary !== null) && <div className="kg-library-bar">
      {view === "graph" && activeLibrary !== null && <>
        <button className="kg-library-back" onClick={backToHub}><ArrowLeft size={14} />中心图谱</button>
        <span className="kg-library-crumb">/</span>
        <strong className="kg-library-current">{currentLibrary?.name || "全部知识"}</strong>
        {branchCategory && <>
          <span className="kg-library-crumb">/</span>
          <span className="kg-branch-badge">{branchCategory}分支</span>
          <button className="kg-branch-clear" onClick={() => setCategory("全部")} title="查看子库所有分支">显示全部 <X size={12} /></button>
        </>}
        <em>{filtered.length} 条</em>
      </>}
      <div className="kg-library-chips" role="group" aria-label="知识域切换">
        <button className={activeLibrary === null || activeLibrary === "all" ? "active" : ""} onClick={backToHub}><Orbit size={13} />{view === "graph" ? "中心图谱" : "全部知识"}</button>
        {LIBRARIES.map(library => <button key={library.id} className={activeLibrary === library.id ? "active" : ""} onClick={() => enterLibrary(library.id)}><i style={{ background: library.accent }} />{library.name}<small>{counts[library.id] || 0}</small></button>)}
      </div>
    </div>}
    {notice && <div className={`kg-notice ${notice.error ? "error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <CircleHelp size={16} /> : <Check size={16} />}{notice.text}<button className="kg-icon" onClick={() => setNotice(null)} aria-label="关闭提示"><X size={14} /></button></div>}
    {loadError ? <div className="kg-empty"><CircleHelp size={30} /><h3>暂时无法加载知识库</h3><p>{loadError}</p><button className="kg-button" onClick={() => void load()}>重新加载</button></div> : loading ? <div className="kg-empty"><span className="kg-spinner" /><p>正在整理你的知识…</p></div> : view === "graph" ? <section className="kg-graph-panel">
      <div className="kg-graph-toolbar">{isHubView ? <div className="kg-hub-hint"><Orbit size={14} />中心图谱 · 点击知识域进入子库</div> : <div className="kg-layout-switch" role="group" aria-label="图谱布局"><button className={layout === "orbit" ? "active" : ""} aria-pressed={layout === "orbit"} disabled={!currentLibrary} title={currentLibrary ? "星座轨道布局" : "进入子库后可用"} onClick={() => { setLayout("orbit"); setFocusId(null); }}><Orbit size={14} />星座轨道</button><button className={layout === "network" ? "active" : ""} aria-pressed={layout === "network"} onClick={() => { setLayout("network"); setFocusId(null); }}><Network size={14} />关联网络</button><button className={layout === "category" ? "active" : ""} aria-pressed={layout === "category"} onClick={() => { setLayout("category"); setFocusId(null); }}><Layers3 size={14} />分类结构</button></div>}<div className="kg-graph-options"><label className="kg-checkbox"><input type="checkbox" checked={showTopics} onChange={event => { setShowTopics(event.target.checked); setFocusId(null); }} />显示共享关键词</label><select aria-label="筛选关系类型" value={relationFilter} onChange={event => { setRelationFilter(event.target.value); setFocusId(null); }}><option value="all">全部关系</option><option value="shared">共享关键词</option><option value="manual">明确关系</option></select>{focusId && <select aria-label="邻域深度" value={depth} onChange={event => setDepth(Number(event.target.value))}><option value={1}>1 跳邻域</option><option value={2}>2 跳邻域</option></select>}</div></div>
      {focusId && <div className="kg-focus-banner"><Focus size={14} /><span>正在聚焦：{baseGraph.nodes.find(node => node.id === focusId)?.label} 的 {depth} 跳关联</span><button onClick={() => setFocusId(null)}>返回全图 <X size={13} /></button></div>}
      <div className={`kg-graph-body ${isHubView || (!selectedEdge && !selectedEntry) ? "kg-graph-full" : ""}`}><KnowledgeNetwork graph={graph} selectedId={selectedId} selectedEdgeId={selectedEdge?.id || null} onSelect={id => {
        const item = entries.find(e => e.id === id);
        // 点击具体细致条目时，如果是在子库，自动切换到对应细致分支，只显示该分支内容
        if (item && currentLibrary && item.category && category === "全部") {
          setCategory(item.category);
        }
        selectEntry(id);
      }} onEdgeSelect={edge => { setSelectedEdge(edge); setSelectedId(null); }} onCategory={value => { setCategory(category === value ? "全部" : value); setFocusId(null); }} onTag={value => { setTag(tag === value ? "全部" : value); setFocusId(null); }} onFocus={focusNode} layout={effectiveLayout} centerSignal={centerSignal} onOpenLibrary={enterLibrary} onBackToHub={backToHub} />{!isHubView && (selectedEdge || selectedEntry) && <aside className="kg-inspector" aria-label="知识详情面板">{selectedEdge ? <RelationInspector edge={selectedEdge} entries={entries} onSelect={id => { selectEntry(id); setCenterSignal(value => value + 1); }} onClose={() => setSelectedEdge(null)} /> : selectedEntry ? inspector(selectedEntry) : null}</aside>}</div>
      <footer className="kg-graph-legend">{isHubView ? <div>{LIBRARIES.map(library => <span key={library.id}><i style={{ background: library.accent }} />{library.name} · {counts[library.id] || 0} 条</span>)}</div> : <div>{categories.map(value => <span key={value}><i style={{ background: paletteForEntry({ category: value }).colors.accent }} />{value}</span>)}</div>}{isHubView ? <button className="kg-text-button" onClick={() => { setActiveLibrary("all"); setLayout("network"); resetFilters(); setSelectedId(null); setSelectedEdge(null); }}>查看全部知识 <ArrowRight size={13} /></button> : <span className="kg-edge-legend"><i />共享关键词 <b>→</b>明确关系</span>}</footer>
    </section> : <section className="kg-card-grid">{filtered.slice(0, limit).map(entry => <article className="kg-knowledge-card" key={entry.id}><div className="kg-card-meta"><span style={{ color: paletteForEntry(entry).colors.accent }}><BookOpen size={14} />{entry.category}</span>{!entry.isBuiltin ? <button className={`kg-status ${entry.enabled !== false ? "on" : ""}`} onClick={() => void toggle(entry)} aria-pressed={entry.enabled !== false}><i />{entry.enabled !== false ? "已启用" : "已停用"}</button> : <small>内置示例</small>}</div><button className="kg-card-title" onClick={() => setDetail(entry)}>{entry.name}<ArrowUpRight size={16} /></button><p>{entry.description || entry.templateText.slice(0, 80)}</p><div className="kg-preview-tags">{(entry.tags || []).map(value => <button key={value} onClick={() => setTag(value)}>#{value}</button>)}</div><footer><button className="kg-text-button" onClick={() => setDetail(entry)}>查看详情 <ArrowRight size={13} /></button><div>{!entry.isBuiltin && <><button className="kg-icon" onClick={() => setEditor({ entry })} aria-label={`编辑 ${entry.name}`}><Pencil size={14} /></button><button className="kg-icon" onClick={() => setDeleteTarget(entry)} aria-label={`删除 ${entry.name}`}><Trash2 size={14} /></button></>}<button className="kg-text-button" onClick={() => onUseKnowledge(entry.templateText, entry.scenario || "auto")}>使用 <ArrowUpRight size={14} /></button></div></footer></article>)}</section>}
    {!loading && !loadError && !filtered.length && <div className="kg-empty"><BookOpen size={32} /><h3>{source.length ? "没有匹配的知识" : "让第一条知识开始生长"}</h3><p>{source.length ? "换个关键词，或清除筛选后再试试。" : "保存品牌事实、写作规范或项目约定，构建提示词时就能自动参考。"}</p><button className="kg-button kg-primary" onClick={source.length ? resetFilters : () => setEditor({ entry: null })}>{source.length ? "清除筛选" : "新建知识"}<ArrowRight size={15} /></button></div>}
    {!loading && filtered.length > limit && <button className="kg-button kg-load-more" onClick={() => setLimit(value => value + 40)}>再显示 40 条（还有 {filtered.length - limit} 条）<ChevronDown size={15} /></button>}
    <p className="kg-bottom-note"><Sparkles size={13} />{scope === "mine" ? "已启用的知识会按当前任务自动匹配，最多引用 3 条。内置示例不会作为事实注入。" : "内置示例仅供取用，不会作为事实注入 AI 构建过程。"}</p>
    {editor && <KnowledgeEditor key={editor.entry?.id || "new"} entry={editor.entry} entries={entries} onSave={save} onClose={() => setEditor(null)} />}
    {detail && <Dialog title="知识详情" onClose={() => setDetail(null)}><div className="kg-detail-dialog">{inspector(detail)}</div></Dialog>}
    {deleteTarget && <Dialog title="删除这条知识？" subtitle="此操作不可撤销，建议先导出备份。" onClose={() => { if (!deleting) setDeleteTarget(null); }} busy={deleting}><div className="kg-delete-body"><strong>{deleteTarget.name}</strong><p>条目及指向它的明确关系将被删除。历史提示词不会受到影响。</p></div><footer className="kg-dialog-footer"><button className="kg-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>保留知识</button><button className="kg-button kg-danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "删除中…" : "确认删除"}</button></footer></Dialog>}
    {help && <Dialog title="让关联有依据，让知识可追溯" subtitle="轻量知识图谱 · 构建说明" onClose={() => setHelp(false)}><div className="kg-help-body">{[["01", "收集与整理", "保存标题、分类、原文和来源。关键词统一大小写与全半角，减少重复节点。"], ["02", "建立有意义的关系", "共享关键词产生主题关联；参考与依赖由你明确标注。点击连线可以查看判断依据。"], ["03", "从概览逐步探索", "先看关联网络，再按分类、关键词或关系类型筛选。双击节点查看一跳或两跳邻域。"], ["04", "校验后再用于构建", "只有已启用且与任务相关的知识会注入提示词。共享关键词不等于事实引用，来源内容仍需人工核查。"]].map(([number, title, text]) => <div key={number}><span>{number}</span><section><h3>{title}</h3><p>{text}</p></section></div>)}<h4>参考研究</h4><a href="https://neo4j.com/blog/knowledge-graph/how-to-build-knowledge-graph/" target="_blank" rel="noopener noreferrer">Neo4j · How to build a knowledge graph <ArrowUpRight size={13} /></a><a href="https://www.yfiles.com/resources/how-to/guide-to-visualizing-knowledge-graphs" target="_blank" rel="noopener noreferrer">yFiles · Knowledge graph visualization guide <ArrowUpRight size={13} /></a><a href="https://web.stanford.edu/class/cs520/2020/notes/How_Do_Users_Interact_With_a_Knowledge_Graph.html" target="_blank" rel="noopener noreferrer">Stanford · How do users interact with a knowledge graph? <ArrowUpRight size={13} /></a><a href="https://www.w3.org/TR/prov-overview/" target="_blank" rel="noopener noreferrer">W3C · PROV provenance overview <ArrowUpRight size={13} /></a><p className="kg-editor-note">当前采用关键词匹配与人工关系标注，不是 AI 实体抽取或 GraphRAG。默认显示 40 条，主题关联使用稀疏连接；完整原文与明确关系始终保留。</p></div></Dialog>}
  </div>;
}
