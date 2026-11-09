"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronRight, CircleHelp, Download, FileText, Focus, GitBranch, Layers3, PanelLeft, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import KnowledgeNetwork, { type DraftPreview } from "@/components/KnowledgeNetwork";
import KnowledgeTree from "@/components/knowledge/KnowledgeTree";
import KnowledgeEditor, { type KnowledgeDraft, type KnowledgePreset } from "@/components/knowledge/KnowledgeEditor";
import KnowledgeInspector, { RelationInspector } from "@/components/knowledge/KnowledgeInspector";
import GroupDialog, { type GroupDialogRequest } from "@/components/knowledge/GroupDialog";
import Dialog from "@/components/knowledge/Dialog";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { buildKnowledgeGraph, neighborhood, type GraphEdge } from "@/lib/knowledge-graph";
import { LIBRARIES, libraryById, libraryForEntry } from "@/lib/knowledge-library";
import { DEFAULT_GROUP, type KnowledgeGroupView } from "@/lib/knowledge-groups";
import { confirmAction } from "@/lib/confirm";
import { ALL_KNOWLEDGE, belongsToBranch, orderedKnowledgeGraph, type KnowledgeBranch } from "@/lib/knowledge-layout";
import "@/knowledge-studio.css";
import "@/knowledge-workspace.css";

type Notice = { text: string; error?: boolean };
type EditorSession = { key: string; entry: KnowledgeEntry | null; preset?: KnowledgePreset };
export default function KnowledgePanel({ onUseKnowledge }: { onUseKnowledge: (text: string, scenario: string) => void }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [scope, setScope] = useState<"mine" | "builtin">("mine");
  const [branch, setBranch] = useState<KnowledgeBranch>(ALL_KNOWLEDGE);
  const [navigationOpen, setNavigationOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 760);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [relationFilter, setRelationFilter] = useState("all");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [depth, setDepth] = useState(1);
  const [limit, setLimit] = useState(80);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [centerSignal, setCenterSignal] = useState(0);
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const [draftPreview, setDraftPreview] = useState<DraftPreview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [groups, setGroups] = useState<KnowledgeGroupView[]>([]);
  const [groupDialog, setGroupDialog] = useState<GroupDialogRequest | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/knowledge", { cache: "no-store" });
      if (!response.ok) throw new Error("知识库加载失败，请重试。");
      const data = await response.json();
      if (!Array.isArray(data.entries)) throw new Error("知识数据格式不正确。");
      setEntries(data.entries);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "知识库加载失败。"); }
    finally { setLoading(false); }
  }, []);
  const loadGroups = useCallback(async () => {
    try {
      const response = await fetch("/api/knowledge/groups", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (Array.isArray(data.groups)) setGroups(data.groups);
    } catch { /* The tree still renders implicit groups from the entries. */ }
  }, []);
  const refreshAll = useCallback(async () => { await Promise.all([load(), loadGroups()]); }, [load, loadGroups]);
  useEffect(() => { void load(); void loadGroups(); }, [load, loadGroups]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 4200); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target as Element).closest("input, textarea, select, [contenteditable]")) { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key === "Escape") { setSearchOpen(false); setFiltersOpen(false); }
    };
    document.addEventListener("mousedown", close); window.addEventListener("keydown", shortcuts);
    const mobile = window.matchMedia("(max-width: 760px)");
    const adapt = () => { if (mobile.matches) setNavigationOpen(false); };
    mobile.addEventListener("change", adapt);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", shortcuts); mobile.removeEventListener("change", adapt); };
  }, []);

  const custom = useMemo(() => entries.filter(item => !item.isBuiltin), [entries]);
  const builtin = useMemo(() => entries.filter(item => item.isBuiltin), [entries]);
  const source = scope === "mine" ? custom : builtin;
  const catalogGraph = useMemo(() => buildKnowledgeGraph(source, { limit: 10000 }), [source]);
  const focusedIds = useMemo(() => focusId ? neighborhood(catalogGraph, focusId, depth) : null, [catalogGraph, focusId, depth]);
  const filtered = useMemo(() => source.filter(item => belongsToBranch(item, branch) && (!enabledOnly || item.enabled !== false) && (!focusedIds || focusedIds.has(`entry:${item.id}`))), [source, branch, enabledOnly, focusedIds]);
  const baseGraph = useMemo(() => orderedKnowledgeGraph(filtered, branch, limit), [filtered, branch, limit]);
  const graph = useMemo(() => ({ ...baseGraph, edges: baseGraph.edges.filter(edge => edge.kind === "contains" || edge.kind === "topic" || relationFilter === "all" || (relationFilter === "manual" ? edge.origin === "用户标注" : relationFilter === "shared" ? edge.origin === "共享关键词" : false)) }), [baseGraph, relationFilter]);
  const searchResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return source.filter(item => `${item.name} ${item.description} ${item.templateText} ${(item.tags || []).join(" ")}`.toLowerCase().includes(value));
  }, [source, query]);
  const matchedIds = useMemo(() => query.trim() ? searchResults.map(item => item.id) : null, [query, searchResults]);
  const currentLibrary = libraryById(branch.library);
  const selectedEntry = entries.find(item => item.id === selectedId) || null;
  const hasFilters = relationFilter !== "all" || enabledOnly;
  const viewKey = JSON.stringify([scope, branch.library, branch.category, branch.tag, focusId, depth, enabledOnly]);
  const closeEditor = useCallback(() => { setEditor(null); setDraftPreview(null); dirtyRef.current = false; busyRef.current = false; }, []);
  // Guard every navigation/selection behind one centered confirmation. When the
  // editor is dirty the intended action is queued and replayed after the user
  // confirms, so no interaction is silently dropped.
  const canLeaveEditor = useCallback((after?: () => void): boolean => {
    if (busyRef.current) { setNotice({ text: "正在保存，请稍候。" }); return false; }
    if (dirtyRef.current) {
      void confirmAction("尚未保存的知识内容会丢失，确定放弃修改并继续吗？", {
        title: "放弃未保存的修改？", subtitle: "可以继续编辑，或放弃修改后执行刚才的操作。",
        cancelLabel: "继续编辑", confirmLabel: "放弃并继续", danger: true,
      }).then(confirmed => { if (!confirmed) return; closeEditor(); after?.(); });
      return false;
    }
    closeEditor(); return true;
  }, [closeEditor]);
  const applyNavigate = (next: KnowledgeBranch) => {
    setBranch(next); setSelectedId(null); setSelectedEdge(null); setFocusId(null); setQuery(""); setSearchOpen(false); setLimit(80);
    if (window.innerWidth <= 760) setNavigationOpen(false);
  };
  const navigate = (next: KnowledgeBranch) => {
    if (!canLeaveEditor(() => applyNavigate(next))) return;
    applyNavigate(next);
  };
  const applyScope = (next: "mine" | "builtin") => {
    setScope(next); setBranch(ALL_KNOWLEDGE); setFocusId(null); setSelectedId(null); setSelectedEdge(null); setQuery("");
    // The exemplar library is content-first: open the first prompt immediately
    // so the main content is visible without hunting for a node on the canvas.
    if (next === "builtin" && builtin.length > 0) {
      setSelectedId(builtin[0].id);
      setCenterSignal(value => value + 1);
    }
  };
  const switchScope = (next: "mine" | "builtin") => {
    if (!canLeaveEditor(() => applyScope(next))) return;
    applyScope(next);
  };
  const applySelectEntry = (id: number, reveal: boolean) => {
    const entry = entries.find(item => item.id === id);
    if (!entry) return;
    let shouldReveal = reveal;
    if (!graph.nodes.some(node => node.id === `entry:${id}`)) {
      setScope(entry.isBuiltin ? "builtin" : "mine");
      setBranch({ library: libraryForEntry(entry), category: entry.category || "通用", tag: "" });
      setFocusId(null); setEnabledOnly(false); setLimit(80);
      shouldReveal = true;
    }
    setSelectedId(id); setSelectedEdge(null);
    if (shouldReveal) setCenterSignal(value => value + 1);
  };
  const selectEntry = (id: number, reveal = false) => {
    if (!canLeaveEditor(() => applySelectEntry(id, reveal))) return;
    applySelectEntry(id, reveal);
  };
  const applyFocus = (id: string) => { setFocusId(old => old === id ? null : id); setBranch(ALL_KNOWLEDGE); setSelectedEdge(null); };
  const focusNode = (id: string) => { if (!canLeaveEditor(() => applyFocus(id))) return; applyFocus(id); };
  const chooseSearch = (entry: KnowledgeEntry) => { selectEntry(entry.id, true); setSearchOpen(false); setQuery(""); };
  const applyCreate = (point?: { x: number; y: number }, relatedId?: number) => {
    const selected = selectedId ? entries.find(item => item.id === selectedId && !item.isBuiltin) : null;
    const related = (relatedId ? entries.find(item => item.id === relatedId) : selected) || null;
    const preset: KnowledgePreset = {
      library: related ? libraryForEntry(related) : branch.library !== "all" ? branch.library : undefined,
      category: related?.category || branch.category || undefined,
      tags: related?.tags?.slice(0, 6) || (branch.tag ? [branch.tag] : []),
      relatedId: related?.id,
    };
    const key = `new-${Date.now()}`;
    setScope("mine"); setSelectedEdge(null); setSelectedId(null); setEditor({ key, entry: null, preset });
    setDraftPreview({ key, name: "", category: preset.category || "通用", position: point, relatedId: related?.id });
    if (window.innerWidth <= 760) setNavigationOpen(false);
  };
  const openCreate = (point?: { x: number; y: number }, relatedId?: number) => {
    if (!canLeaveEditor(() => applyCreate(point, relatedId))) return;
    applyCreate(point, relatedId);
  };
  const handleDraftChange = useCallback((next: { name: string; category: string }) => setDraftPreview(old => old && (old.name !== next.name || old.category !== next.category) ? { ...old, ...next } : old), []);
  const handleDirtyChange = useCallback((dirty: boolean, busy: boolean) => { dirtyRef.current = dirty; busyRef.current = busy; }, []);
  const save = async (draft: KnowledgeDraft) => {
    const editing = Boolean(editor?.entry);
    const response = await fetch("/api/knowledge", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(editor?.entry ? { id: editor.entry.id } : {}) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "保存失败，请重试。");
    const saved = data as KnowledgeEntry;
    await refreshAll();
    if (!belongsToBranch(saved, branch)) setBranch({ library: libraryForEntry(saved), category: saved.category || "通用", tag: "" });
    closeEditor(); setScope("mine"); setFocusId(null); setEnabledOnly(false); setQuery(""); setSelectedId(saved.id); setCenterSignal(value => value + 1);
    window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
    setNotice({ text: editing ? "知识已更新，关联同步保存。" : "知识已保存，已加入当前知识网。" });
  };
  const toggle = async (entry: KnowledgeEntry) => {
    const enabled = entry.enabled === false;
    try {
      const response = await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, enabled }) });
      if (!response.ok) throw new Error();
      setEntries(old => old.map(item => item.id === entry.id ? { ...item, enabled } : item));
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
      setDeleteTarget(null); setSelectedId(null); setSelectedEdge(null); setFocusId(null);
      await refreshAll(); window.dispatchEvent(new CustomEvent("astra:knowledge-updated")); setNotice({ text: "已删除知识及指向它的明确关系。" });
    } catch { setNotice({ text: "删除失败，请检查浏览器存储权限后重试。", error: true }); }
    finally { setDeleting(false); }
  };
  const openGroupDialog = (request: GroupDialogRequest) => {
    if (!canLeaveEditor(() => setGroupDialog(request))) return;
    setGroupDialog(request);
  };
  const submitGroup = async (payload: { name?: string; library?: string; accent?: string; moveTo?: string }) => {
    if (!groupDialog) return;
    const request = groupDialog;
    setGroupBusy(true);
    try {
      if (request.mode === "create") {
        const response = await fetch("/api/knowledge/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: payload.name, library: payload.library, accent: payload.accent }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "创建分组失败。");
        await refreshAll();
        setBranch({ library: data.library, category: data.name, tag: "" });
        setScope("mine"); setFocusId(null); setEnabledOnly(false); setQuery("");
        window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
        setNotice({ text: `分组「${data.name}」已创建，可直接在里面新建知识。` });
      } else if (request.mode === "rename") {
        const response = await fetch("/api/knowledge/groups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: request.group.id, name: payload.name }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "重命名分组失败。");
        const previous = request.group.name;
        await refreshAll();
        if (branch.library === request.group.library && branch.category === previous) setBranch(old => ({ ...old, category: data.name }));
        window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
        setNotice({ text: data.moved > 0 ? `分组已重命名，${data.moved} 条知识已同步移动到「${data.name}」。` : `分组已重命名为「${data.name}」。` });
      } else {
        const response = await fetch(`/api/knowledge/groups?id=${encodeURIComponent(request.group.id)}&moveTo=${encodeURIComponent(payload.moveTo || DEFAULT_GROUP)}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "删除分组失败。");
        const previous = request.group.name;
        await refreshAll();
        if (branch.library === request.group.library && branch.category === previous) setBranch({ library: request.group.library, category: "", tag: "" });
        setSelectedId(null); setFocusId(null);
        window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
        setNotice({ text: data.moved > 0 ? `分组「${previous}」已删除，${data.moved} 条知识已移动到「${data.moveTo || DEFAULT_GROUP}」。` : `分组「${previous}」已删除。` });
      }
      setGroupDialog(null);
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "分组操作失败，请重试。", error: true }); }
    finally { setGroupBusy(false); }
  };
  const copy = async (entry: KnowledgeEntry) => {
    const { entryCode } = await import("@/components/knowledge/KnowledgeInspector");
    try { await navigator.clipboard.writeText(entryCode(entry)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setNotice({ text: "无法访问剪贴板，请在引用代码中手动选择复制。", error: true }); }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), entries: custom }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `astra-knowledge-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ text: `已导出 ${custom.length} 条知识及其关系。` });
  };
  const inspector = selectedEntry ? <div className="kg-inspector"><KnowledgeInspector key={selectedEntry.id} entry={selectedEntry} edges={catalogGraph.edges} entries={entries}
    onSelect={id => selectEntry(id, true)} onEdit={() => { setEditor({ key: `edit-${selectedEntry.id}`, entry: selectedEntry }); setDraftPreview(null); }}
    onUse={() => onUseKnowledge(selectedEntry.templateText, selectedEntry.scenario || "auto")} onToggle={() => void toggle(selectedEntry)}
    onCopy={() => void copy(selectedEntry)} copied={copied} onFocus={() => focusNode(`entry:${selectedEntry.id}`)} focused={focusId === `entry:${selectedEntry.id}`}
    onClose={() => setSelectedId(null)} onDelete={() => setDeleteTarget(selectedEntry)} onCreateRelated={selectedEntry.isBuiltin ? undefined : () => openCreate(undefined, selectedEntry.id)} /></div> : null;
  const dock = editor ? <KnowledgeEditor key={editor.key} entry={editor.entry} entries={entries} groups={groups} initial={editor.preset} onSave={save} onClose={closeEditor} onDraftChange={handleDraftChange} onDirtyChange={handleDirtyChange} />
    : selectedEdge ? <div className="kg-inspector"><RelationInspector edge={selectedEdge} entries={entries} onSelect={id => selectEntry(id, true)} onClose={() => setSelectedEdge(null)} /></div> : inspector;
  const navigation = <KnowledgeTree entries={source} branch={branch} scope={scope} customCount={custom.length} builtinCount={builtin.length} groups={groups} onNavigate={navigate} onScope={switchScope} onClose={() => setNavigationOpen(false)} onCreate={() => openCreate()} onCreateGroup={library => openGroupDialog({ mode: "create", library })} onEditGroup={group => openGroupDialog(group.id.startsWith("delete:") ? { mode: "delete", group: { ...group, id: group.id.slice(7) } } : { mode: "rename", group })} />;
  const toolbar = <>
    <div className="kn-location"><button className={`kg-icon kn-nav-toggle ${navigationOpen ? "active" : ""}`} aria-label={navigationOpen ? "折叠标签导航" : "展开标签导航"} title="标签导航" onClick={() => setNavigationOpen(value => !value)}><PanelLeft size={17} /></button>
      <nav className="kn-breadcrumb" aria-label="知识网路径"><button onClick={() => navigate(ALL_KNOWLEDGE)} className={branch.library === "all" ? "current" : ""}><Layers3 size={14} /><span>全部知识</span></button>{currentLibrary && <><ChevronRight size={12} /><button className={!branch.category ? "current" : ""} onClick={() => navigate({ library: branch.library, category: "", tag: "" })}>{currentLibrary.name}</button></>}{branch.category && <><ChevronRight size={12} /><button className={!branch.tag ? "current" : ""} onClick={() => navigate({ ...branch, tag: "" })}>{branch.category}</button></>}{branch.tag && <><ChevronRight size={12} /><span className="current">#{branch.tag}</span></>}</nav>
      {focusId && <button className="kn-focus-chip" onClick={() => setFocusId(null)} title="返回完整分支"><Focus size={12} />聚焦中<X size={12} /></button>}
    </div>
    <div className="kn-toolbar-actions">
      <div ref={searchRef} className="kn-search"><Search size={15} /><input ref={searchInput} value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true); setSearchIndex(0); }} onFocus={() => setSearchOpen(true)} onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); setSearchIndex(value => Math.min(value + 1, Math.max(0, Math.min(searchResults.length, 7) - 1))); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setSearchIndex(value => Math.max(value - 1, 0)); }
        else if (event.key === "Enter" && searchResults[searchIndex]) { event.preventDefault(); chooseSearch(searchResults[searchIndex]); }
        else if (event.key === "Escape") setSearchOpen(false);
      }} role="combobox" aria-label="搜索知识" aria-expanded={searchOpen && !!query} aria-controls={searchOpen && query ? "kn-search-results" : undefined} aria-autocomplete="list" aria-activedescendant={searchOpen && query && searchResults[searchIndex] ? `kn-search-${searchResults[searchIndex].id}` : undefined} placeholder="搜索知识…" />{query ? <button className="kg-icon" onClick={() => setQuery("")} aria-label="清空搜索"><X size={13} /></button> : <kbd>/</kbd>}
        {searchOpen && query && <div className="kn-search-results" id="kn-search-results" role="listbox"><div className="kn-search-caption">全库搜索 · {searchResults.length} 个结果</div>{searchResults.slice(0, 7).map((entry, index) => <button key={entry.id} id={`kn-search-${entry.id}`} role="option" aria-selected={index === searchIndex} className={index === searchIndex ? "active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => chooseSearch(entry)}><FileText size={16} /><span>{entry.name}<small>{libraryById(libraryForEntry(entry))?.name} / {entry.category}</small></span><ArrowRight size={13} /></button>)}{!searchResults.length && <p>没有找到相关知识，试试其他关键词。</p>}</div>}
      </div>
      <div ref={filtersRef} className="kn-filter-wrap"><button className={`kn-toolbar-icon ${hasFilters || filtersOpen ? "active" : ""}`} aria-label="筛选知识与关系" aria-expanded={filtersOpen} title="筛选" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={16} />{hasFilters && <i />}</button>
        {filtersOpen && <div className="kn-filter-popover nowheel"><header><strong>画布筛选</strong><button className="kg-icon" onClick={() => setFiltersOpen(false)} aria-label="关闭筛选"><X size={14} /></button></header><label>显示关系<select aria-label="显示关系" value={relationFilter} onChange={event => setRelationFilter(event.target.value)}><option value="all">全部关系</option><option value="manual">仅参考与依赖</option><option value="shared">仅共享关键词</option><option value="none">隐藏知识间连线</option></select></label><label className="kn-filter-check"><input type="checkbox" checked={enabledOnly} onChange={event => setEnabledOnly(event.target.checked)} />仅显示已启用知识</label>{focusId && <label>邻域范围<select aria-label="邻域深度" value={depth} onChange={event => setDepth(Number(event.target.value))}><option value={1}>1 跳关联</option><option value={2}>2 跳关联</option></select></label>}<button className="kg-text-button" onClick={() => { setRelationFilter("all"); setEnabledOnly(false); }}>重置筛选</button></div>}
      </div>
      <button className="kg-button kg-primary kn-new-button" onClick={() => openCreate()}><Plus size={16} /><span>新建知识</span></button>
    </div>
  </>;

  return <div className="kg-page kg-organized">
    <header className="kn-page-heading"><div className="kn-heading-left"><span className="kn-heading-icon"><GitBranch size={22} /></span><div><div className="kn-title"><h1>知识库</h1><span>提示词写作</span></div><p>整理事实、约束与设计规范，让每一条知识真正进入提示词。</p></div></div><div className="kn-heading-right"><span className="kn-header-count"><b>{custom.length}</b> 条知识<span>·</span>{groups.filter(group => group.count > 0).length} 个分组<span>·</span>{LIBRARIES.length} 个知识域</span><button className="kg-button" onClick={exportData} disabled={!custom.length}><Download size={14} /><span>导出</span></button><button className="kg-icon kn-help" aria-label="知识网使用说明" title="使用说明" onClick={() => setHelp(true)}><CircleHelp size={18} /></button></div></header>
    {loadError ? <div className="kn-state"><CircleHelp size={30} /><h3>暂时无法加载知识库</h3><p>{loadError}</p><button className="kg-button" onClick={() => void load()}>重新加载</button></div>
      : loading ? <div className="kn-state"><span className="kg-spinner" /><p>正在整理知识网…</p></div>
      : <KnowledgeNetwork graph={graph} viewKey={viewKey} selectedId={selectedId} selectedEdgeId={selectedEdge?.id || null} onSelect={id => selectEntry(id)}
           onEdgeSelect={edge => { const apply = () => { setSelectedEdge(edge); setSelectedId(null); }; if (!canLeaveEditor(apply)) return; apply(); }}
          onCategory={category => navigate({ ...branch, category, tag: "" })} onTag={tag => navigate({ ...branch, tag })} onFocus={focusNode}
           centerSignal={centerSignal} onCreate={openCreate} onNewGroup={() => openGroupDialog({ mode: "create", library: branch.library === "all" ? "center" : branch.library })} onClearSelection={() => { if (!editor) { setSelectedId(null); setSelectedEdge(null); } }}
          navigation={navigation} navigationOpen={navigationOpen} onCloseNavigation={() => setNavigationOpen(false)} toolbar={toolbar} dock={dock} draft={draftPreview} matchedIds={matchedIds}
           onReset={() => { navigate(ALL_KNOWLEDGE); setEnabledOnly(false); setFocusId(null); }} />}
    {baseGraph.hiddenEntries > 0 && !loading && !loadError && <button className="kn-load-more" onClick={() => setLimit(value => value + 80)}>加载更多（还有 {baseGraph.hiddenEntries} 条）</button>}
    {notice && <div className={`kn-toast ${notice.error ? "error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <CircleHelp size={16} /> : <Check size={16} />}{notice.text}<button className="kg-icon" onClick={() => setNotice(null)} aria-label="关闭提示"><X size={14} /></button></div>}
    {groupDialog && <GroupDialog request={groupDialog} entries={entries} busy={groupBusy} onClose={() => { if (!groupBusy) setGroupDialog(null); }}
      onCreate={draft => void submitGroup({ name: draft.name, library: draft.library, accent: draft.accent })}
      onRename={name => void submitGroup({ name })}
      onDelete={moveTo => void submitGroup({ moveTo })} />}
    {deleteTarget && <Dialog title="删除这个知识节点？" subtitle="此操作不可撤销，建议先导出备份。" onClose={() => { if (!deleting) setDeleteTarget(null); }} busy={deleting}><div className="kg-delete-body"><strong>{deleteTarget.name}</strong><p>知识节点及指向它的明确关系将被删除，历史提示词不受影响。</p></div><footer className="kg-dialog-footer"><button className="kg-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>保留知识</button><button className="kg-button kg-danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "删除中…" : "确认删除"}</button></footer></Dialog>}
    {help && <Dialog title="像整理文件夹一样，探索知识网" subtitle="标签导航与画布操作" onClose={() => setHelp(false)}><div className="kg-help-body">{[
      ["01", "从左侧逐层展开", "知识域 → 分类 → 关键词。点击任意子标签，右侧只展示对应内容，并按固定间距排列；路径导航可返回上一层。"],
      ["02", "滚轮缩放，拖动移动", "鼠标在空白画布或知识卡片上，直接滚动即可缩放。拖动空白平移画布，拖动卡片调整节点位置；标签栏与编辑栏独立滚动。"],
      ["03", "整理不丢失内容", "手动拖动的位置会保存在当前浏览器。左下角「整理布局」恢复规则排列，「适应画布」调整视野，100% 按钮恢复原始比例。"],
      ["04", "在网内新增与编辑", "点击新建、双击空白或右键新建，直接写内容即可。当前分类与关联会自动带入，不必再选手动分类。未保存的编辑在切换前会提醒。"],
      ["05", "分组随建随删", "知识域右侧的「+」或左下角「新建分组」可创建分组，支持先建空分组再写知识。悬停分组可重命名或删除：重命名会同步分组内的知识，删除时可选择把知识移动到其他分组，内容不会丢失。"],
    ].map(([number, title, text]) => <div key={number}><span>{number}</span><section><h3>{title}</h3><p>{text}</p></section></div>)}<p className="kg-editor-note">共享关键词表示主题相似，并不代表事实引用；参考与依赖由你明确标注。只有已启用且与任务相关的知识会用于提示词构建。</p></div></Dialog>}
  </div>;
}
