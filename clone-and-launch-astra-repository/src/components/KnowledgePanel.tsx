"use client";

/**
 * Knowledge library with a Creative-Tim-style block gallery:
 *  - category rail + search for quick selection
 *  - an interactive knowledge network showing category / entry relationships
 *  - cards that show the live rendered effect AND the exact <knowledge_base> code
 *  - a five-role colour token card per entry
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Copy, Pencil,
  Plus, Search, Sparkles, Trash2, X,
} from "lucide-react";
import SmartSelect from "@/components/SmartSelect";
import KnowledgeNetwork from "@/components/KnowledgeNetwork";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { PALETTES, paletteForEntry, paletteById, swatchHex } from "@/lib/knowledge-palette";

const CATEGORIES = ["通用", "品牌", "写作", "开发", "分析", "营销", "学习", "数据", "效率"];
const EMPTY_FORM = { name: "", category: "通用", description: "", content: "", enabled: true, palette: "violet" };
const TOKEN_LABELS: [string, "canvas" | "surface" | "text" | "accent" | "highlight"][] = [
  ["画布", "canvas"], ["表面", "surface"], ["正文", "text"], ["强调", "accent"], ["高光", "highlight"],
];

function entryCode(item: KnowledgeEntry) {
  return `<knowledge_base>
标题：${item.name}
分类：${item.category || "通用"}
${item.description ? `说明：${item.description}\n` : ""}${item.templateText}
</knowledge_base>`;
}

export default function KnowledgePanel({ onUseKnowledge }: { onUseKnowledge: (text: string, scenario: string) => void }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"mine" | "builtin">("mine");
  const [viewMode, setViewMode] = useState<Record<number, "preview" | "code">>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/knowledge", { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data.entries)) setEntries(data.entries);
    } catch { setMessage("知识库暂时无法同步。"); }
  };
  useEffect(() => { load(); }, []);

  const custom = useMemo(() => entries.filter(item => !item.isBuiltin), [entries]);
  const builtin = useMemo(() => entries.filter(item => item.isBuiltin), [entries]);
  const enabled = custom.filter(item => item.enabled !== false).length;
  const categoryCount = useMemo(() => new Set(custom.map(item => item.category || "通用")).size, [custom]);
  const sourceEntries = scope === "mine" ? custom : builtin;
  const categories = useMemo(() => ["全部", ...new Set(sourceEntries.map(item => item.category || "通用"))], [sourceEntries]);
  const filtered = useMemo(() => sourceEntries.filter(item => {
    const inCategory = category === "全部" || item.category === category;
    const haystack = `${item.name} ${item.description} ${item.templateText}`.toLowerCase();
    return inCategory && (!query || haystack.includes(query.toLowerCase()));
  }), [sourceEntries, category, query]);
  const latest = useMemo(() => custom[0], [custom]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setMessage("");
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  const startEdit = (item: KnowledgeEntry) => {
    setEditingId(item.id);
    setForm({
      name: item.name, category: item.category || "通用", description: item.description || "",
      content: item.templateText, enabled: item.enabled !== false,
      palette: paletteForEntry(item).id,
    });
    setFormOpen(true);
    setMessage("");
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) { setMessage("请填写条目标题与知识内容"); return; }
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(), category: form.category, description: form.description.trim(),
        templateText: form.content.trim(), enabled: form.enabled, accent: form.palette,
      };
      const response = await fetch("/api/knowledge", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setCategory("全部");
      setScope("mine");
      setMessage(editingId ? "知识条目已更新" : "知识已保存，构建提示词时会自动匹配相关内容");
      window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  };

  const toggle = async (item: KnowledgeEntry) => {
    const next = item.enabled === false;
    setEntries(old => old.map(entry => entry.id === item.id ? { ...entry, enabled: next } : entry));
    try {
      const response = await fetch("/api/knowledge", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, enabled: next }),
      });
      if (!response.ok) throw new Error();
      setMessage(next ? "已启用：相关内容会参与提示词构建" : "已停用：该条目不会参与构建");
      window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
    } catch {
      setEntries(old => old.map(entry => entry.id === item.id ? { ...entry, enabled: !next } : entry));
      setMessage("状态更新失败，请重试");
    }
  };

  const remove = async (item: KnowledgeEntry) => {
    if (!window.confirm(`删除知识条目「${item.name}」？`)) return;
    try {
      const response = await fetch(`/api/knowledge?id=${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      await load();
      setMessage("知识条目已删除");
      window.dispatchEvent(new CustomEvent("astra:knowledge-updated"));
    } catch { setMessage("删除失败，请重试"); }
  };

  const copy = async (item: KnowledgeEntry) => {
    try {
      await navigator.clipboard.writeText(entryCode(item));
      setCopied(item.id);
      window.setTimeout(() => setCopied(null), 1800);
    } catch { setMessage("复制失败，请展开后手动选择"); }
  };

  const switchScope = (next: "mine" | "builtin") => {
    setScope(next);
    setCategory("全部");
    setQuery("");
  };

  return (
    <div className="library-page kb-page">
      <section className="kb-hero">
        <div className="kb-hero-copy">
          <span className="kb-kicker">KNOWLEDGE GRAPH</span>
          <h2>让知识，<br />沿网络生长。</h2>
          <p>保存品牌事实、写作规范、项目约定。输入一句话时，AI 会沿着这张网络自动引用相关知识来构建提示词。</p>
          <div className="kb-hero-stats">
            <span><strong>{String(custom.length).padStart(2, "0")}</strong><small>条知识</small></span>
            <i />
            <span><strong>{String(categoryCount).padStart(2, "0")}</strong><small>个分类</small></span>
            <i />
            <span><strong>{String(enabled).padStart(2, "0")}</strong><small>参与构建</small></span>
          </div>
        </div>
        <div className="kb-hero-side">
          {latest ? <div className="kb-latest">
            <span className="kb-kicker">最近新增</span>
            <div className="kb-latest-row">
              <div className="kb-latest-swatches">{Object.values(paletteForEntry(latest).colors).map((color, index) => <span key={index} style={{ background: color }} />)}</div>
              <div><strong>{latest.name}</strong><small>{latest.category || "通用"} · {latest.enabled !== false ? "参与构建" : "已停用"}</small></div>
            </div>
            <p>{latest.description || latest.templateText.slice(0, 88)}</p>
          </div> : <div className="kb-latest kb-latest-empty"><span className="kb-kicker">最近新增</span><p>新建第一条知识，网络就会开始生长。</p></div>}
          <button className="button-dark kb-create" onClick={startCreate}><Plus size={16} />新建知识</button>
        </div>
      </section>

      <section className="kb-network-band">
        <div className="kb-network-head">
          <div><span className="kb-kicker">LIVE GRAPH</span><h3>知识关系网络</h3></div>
          <p>点击分类节点即可筛选下方知识；点击条目节点可直接打开内容。</p>
        </div>
        <div className="kb-network-stage">
          <KnowledgeNetwork entries={sourceEntries} activeCategory={category} onCategory={value => { setCategory(value); setQuery(""); document.getElementById("kb-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} onEntry={item => { setExpanded(expanded === item.id ? null : item.id); document.getElementById("kb-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          <aside className="kb-network-legend">
            <span className="kb-kicker">如何阅读</span>
            <ul>
              <li><i className="legend-hub" />核心知识库</li>
              <li><i className="legend-cat" />分类节点</li>
              <li><i className="legend-entry" />知识条目</li>
              <li><i className="legend-line" />连线上流动的光点代表构建时的引用关系</li>
            </ul>
            {category !== "全部" && <button className="kb-clear-filter" onClick={() => setCategory("全部")}>清除「{category}」筛选 <X size={13} /></button>}
          </aside>
        </div>
      </section>

      <div className="knowledge-scope">
        <button className={scope === "mine" ? "active" : ""} onClick={() => switchScope("mine")}>我的知识 <span>{custom.length}</span></button>
        <button className={scope === "builtin" ? "active" : ""} onClick={() => switchScope("builtin")}>内置示例 <span>{builtin.length}</span></button>
        <small>{scope === "mine" ? "只有这里已启用的条目会参与 AI 构建" : "内置提示词仅供取用，不会作为事实注入"}</small>
      </div>

      <div className="library-toolbar">
        <div className="category-list">{categories.map(value => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div>
        <div className="library-toolbar-actions">
          <div className="search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索知识、标题或内容..." aria-label="搜索知识库" /></div>
          <button className="button-dark" onClick={startCreate}><Plus size={16} />新建知识</button>
        </div>
      </div>

      {message && <div className="inline-notice"><Check size={15} /> {message}<button onClick={() => setMessage("")} aria-label="关闭提示"><X size={14} /></button></div>}

      {formOpen && <section className="template-create surface kb-form" ref={formRef}>
        <div className="template-create-head">
          <div><h3>{editingId ? "编辑知识" : "新建知识"}</h3><p>内容是构建提示词时的参考材料，不会覆盖用户当前输入。</p></div>
          <button className="icon-button" onClick={() => { setFormOpen(false); setEditingId(null); }} aria-label="关闭表单"><X size={17} /></button>
        </div>
        <div className="kb-form-layout">
          <div className="template-form-grid">
            <div><label className="field-label" htmlFor="knowledge-name">标题</label><input id="knowledge-name" className="form-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="例如：品牌语气规范" maxLength={60} /></div>
            <div><label className="field-label" htmlFor="knowledge-category">分类</label><SmartSelect id="knowledge-category" value={form.category} options={CATEGORIES.map(value => ({ value, label: value }))} onChange={value => setForm({ ...form, category: value })} placeholder="选择分类" /></div>
            <div className="form-wide"><label className="field-label" htmlFor="knowledge-description">用途说明</label><input id="knowledge-description" className="form-input" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="这条知识适合哪类任务" maxLength={240} /></div>
            <div className="form-wide"><label className="field-label" htmlFor="knowledge-content">知识内容</label><textarea id="knowledge-content" className="form-textarea" rows={6} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="粘贴事实、术语、风格要求或项目约定" maxLength={10000} /></div>
            <div className="form-wide">
              <span className="field-label">配色</span>
              <div className="kb-palette-picker">{PALETTES.map(palette => {
                const active = form.palette === palette.id;
                return <button key={palette.id} type="button" className={`kb-palette-chip ${active ? "active" : ""}`} onClick={() => setForm({ ...form, palette: palette.id })} aria-pressed={active}>
                  <span className="kb-palette-dots"><i style={{ background: palette.colors.canvas }} /><i style={{ background: palette.colors.accent }} /><i style={{ background: palette.colors.highlight }} /></span>
                  <span>{palette.label}</span>
                </button>;
              })}</div>
            </div>
          </div>
          <aside className="kb-form-preview">
            <span className="kb-kicker">卡片预览</span>
            <div className="kb-mini-card" style={{ "--kb-accent": paletteById(form.palette).colors.accent, "--kb-surface": paletteById(form.palette).colors.surface, "--kb-text": paletteById(form.palette).colors.text } as React.CSSProperties}>
              <div className="kb-mini-frame"><i /><i /><i /></div>
              <span className="kb-mini-tag">{form.category || "通用"}</span>
              <h4>{form.name || "知识标题"}</h4>
              <p>{form.description || "知识用途说明会显示在这里"}</p>
              <div className="kb-mini-palette">{TOKEN_LABELS.map(([label, key]) => <i key={key} title={`${label} ${swatchHex(paletteById(form.palette).colors[key])}`} style={{ background: paletteById(form.palette).colors[key] }} />)}</div>
              <span className="kb-mini-cta">参与构建 <ArrowUpRight size={11} /></span>
            </div>
          </aside>
        </div>
        <div className="knowledge-form-actions">
          <label className="knowledge-switch"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} /><span />参与提示词构建</label>
          <button className="button-primary" onClick={save} disabled={busy || !form.name.trim() || !form.content.trim()}>{busy ? "保存中..." : "保存知识"} <ArrowRight size={16} /></button>
        </div>
      </section>}

      <div className="kb-grid" id="kb-grid">
        {filtered.map((item, index) => {
          const builtin = Boolean(item.isBuiltin);
          const active = item.enabled !== false;
          const palette = paletteForEntry(item);
          const view = viewMode[item.id] || "preview";
          const open = expanded === item.id;
          return (
            <article
              key={item.id}
              className={`kb-card template-card ${open ? "is-open" : ""}`}
              style={{
                "--kb-accent": palette.colors.accent,
                "--kb-highlight": palette.colors.highlight,
                "--kb-surface": palette.colors.surface,
                "--kb-canvas": palette.colors.canvas,
                "--kb-text": palette.colors.text,
                transitionDelay: `${Math.min(index, 8) * 45}ms`,
              } as React.CSSProperties}
            >
              <div className="kb-palette-bar">{TOKEN_LABELS.map(([label, key]) => <span key={key} title={`${label} · ${swatchHex(palette.colors[key])}`} style={{ background: palette.colors[key] }} />)}</div>

              <div className="kb-card-top">
                <span className="template-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="template-category">{item.category || "通用"}</span>
                <span className="kb-palette-name">{palette.label}</span>
                {!builtin && <div className="knowledge-card-actions">
                  <button onClick={() => startEdit(item)} title="编辑知识" aria-label={`编辑 ${item.name}`}><Pencil size={14} /></button>
                  <button onClick={() => remove(item)} title="删除知识" aria-label={`删除 ${item.name}`}><Trash2 size={14} /></button>
                </div>}
              </div>

              <div className="kb-card-icon"><BookOpen size={20} /></div>
              <h3>{item.name}</h3>
              <p className="template-desc">{item.description || (builtin ? "内置示例提示词，仅供工作台取用" : "用户提供的参考知识")}</p>

              <div className="kb-tabs" role="tablist" aria-label={`${item.name} 展示方式`}>
                <button role="tab" aria-selected={view === "preview"} className={view === "preview" ? "active" : ""} onClick={() => setViewMode(old => ({ ...old, [item.id]: "preview" }))}><Sparkles size={13} />效果预览</button>
                <button role="tab" aria-selected={view === "code"} className={view === "code" ? "active" : ""} onClick={() => setViewMode(old => ({ ...old, [item.id]: "code" }))}><Copy size={13} />构建代码</button>
              </div>

              <div className="kb-stage">
                {view === "preview" ? (
                  <div className="kb-mini-card">
                    <div className="kb-mini-frame"><i /><i /><i /></div>
                    <span className="kb-mini-tag">{item.category || "通用"}</span>
                    <h4>{item.name}</h4>
                    <p>{(item.description || item.templateText).slice(0, 84)}{((item.description || item.templateText).length > 84) ? "…" : ""}</p>
                    <div className="kb-mini-palette">{TOKEN_LABELS.map(([label, key]) => <i key={key} title={`${label} · ${swatchHex(palette.colors[key])}`} style={{ background: palette.colors[key] }} />)}</div>
                    <span className="kb-mini-cta">查看内容 <ArrowUpRight size={11} /></span>
                  </div>
                ) : (
                  <pre className="kb-code"><code>{entryCode(item).split("\n").map((line, lineIndex) => <span key={lineIndex} className={line.startsWith("<") || line.startsWith("</") ? "tag" : line.startsWith("标题") || line.startsWith("分类") || line.startsWith("说明") ? "key" : ""}>{line}</span>)}</code></pre>
                )}
              </div>

              {!builtin ? <button className={`knowledge-state ${active ? "active" : ""}`} onClick={() => toggle(item)} aria-pressed={active}><span className="knowledge-state-dot" />{active ? "参与提示词构建" : "已停用"}</button> : <p className="knowledge-builtin-note">内置示例不会作为事实注入 AI 构建过程。</p>}

              <div className="template-card-bottom">
                <button className="template-preview" onClick={() => setExpanded(open ? null : item.id)}>{open ? "收起详情" : "查看详情"} <ChevronDown size={14} className={open ? "rotated" : ""} /></button>
                <div>
                  <button className="template-copy" onClick={() => copy(item)} title="复制知识代码" aria-label={`复制 ${item.name}`}>{copied === item.id ? <Check size={17} /> : <Copy size={17} />}</button>
                  <button className="template-use" onClick={() => onUseKnowledge(item.templateText, item.scenario || "auto")}>使用 <ArrowUpRight size={15} /></button>
                </div>
              </div>

              {open && <div className="kb-detail">
                <div className="kb-detail-col">
                  <span className="kb-kicker">前端展示效果</span>
                  <div className="kb-preview-large">
                    <div className="kb-preview-nav"><span style={{ background: palette.colors.accent }} /><i /><i /><i /></div>
                    <h4>{item.name}</h4>
                    <p>{item.templateText.slice(0, 190)}{item.templateText.length > 190 ? "…" : ""}</p>
                    <div className="kb-preview-row">
                      <div className="kb-mini-palette">{TOKEN_LABELS.map(([label, key]) => <i key={key} title={`${label} · ${swatchHex(palette.colors[key])}`} style={{ background: palette.colors[key] }} />)}</div>
                      <span className="kb-mini-cta" style={{ background: palette.colors.accent, color: palette.colors.canvas }}>应用知识 <ArrowUpRight size={11} /></span>
                    </div>
                  </div>
                </div>
                <div className="kb-detail-col">
                  <span className="kb-kicker">注入构建的代码</span>
                  <pre className="kb-code kb-code-large"><code>{entryCode(item)}</code></pre>
                </div>
              </div>}
            </article>
          );
        })}
      </div>

      {!filtered.length && <div className="empty-state"><div><Search size={25} /></div><h3>{scope === "mine" ? "还没有自己的知识" : "没有匹配的内置示例"}</h3><p>{scope === "mine" ? "新建一条品牌事实、写作规范或项目约定，AI 构建提示词时就能自动参考。" : "试试清除筛选条件。"}</p>{scope === "mine" ? <button onClick={startCreate}>新建知识 <ArrowRight size={15} /></button> : <button onClick={() => { setQuery(""); setCategory("全部"); }}>清除筛选 <ArrowRight size={15} /></button>}</div>}
    </div>
  );
}
