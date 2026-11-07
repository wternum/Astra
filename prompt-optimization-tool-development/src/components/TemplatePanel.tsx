"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, LayoutTemplate, Plus, Search, Trash2, X } from "lucide-react";
import SmartSelect from "@/components/SmartSelect";
import { BUILTIN_TEMPLATES } from "@/lib/optimizer";

interface TemplateItem {
  id: number;
  name: string;
  category: string;
  description: string;
  templateText: string;
  scenario: string;
  isBuiltin: boolean;
  accent: string;
}

const CUSTOM_CATEGORIES = ["通用", "写作", "开发", "分析", "创意", "学习", "营销", "数据", "效率"];

export default function TemplatePanel({ onUseTemplate }: { onUseTemplate: (text: string, scenario: string) => void }) {
  const [templates, setTemplates] = useState<TemplateItem[]>(BUILTIN_TEMPLATES);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "通用", description: "", templateText: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const response = await fetch("/api/templates", { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data)) setTemplates(data);
    } catch { setMessage("模板暂时无法同步，当前仍可使用内置任务。 "); }
  };
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => ["全部", ...new Set(templates.map(t => t.category))], [templates]);
  const filtered = templates.filter(t => (category === "全部" || t.category === category) && (!query || `${t.name} ${t.description} ${t.templateText}`.toLowerCase().includes(query.toLowerCase())));

  const copy = async (item: TemplateItem) => {
    try { await navigator.clipboard.writeText(item.templateText); setCopied(item.id); window.setTimeout(() => setCopied(null), 1800); }
    catch { setMessage("复制失败，请展开内容后手动复制"); }
  };
  const create = async () => {
    if (!form.name.trim() || !form.templateText.trim()) { setMessage("请填写模板名称与内容"); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建失败");
      setCreateOpen(false); setForm({ name: "", category: "通用", description: "", templateText: "" }); setCategory("全部");
      setMessage("自定义模板已保存"); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "创建失败"); }
    finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    if (!window.confirm("确定删除这个自定义模板吗？")) return;
    try { const response = await fetch(`/api/templates?id=${id}`, { method: "DELETE" }); if (!response.ok) throw new Error("删除失败"); await load(); setMessage("模板已删除"); }
    catch { setMessage("删除失败，请稍后再试"); }
  };

  return (
    <div className="library-page">
      <div className="library-overview"><div className="library-overview-mark"><span>✳</span></div><div><h2>模板</h2></div><div className="library-count"><strong>{String(templates.length).padStart(2, "0")}</strong><span>个模板</span></div></div>
      <div className="library-toolbar"><div className="category-list">{categories.map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="library-toolbar-actions"><div className="search-field"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索任务、场景..." aria-label="搜索模板" /></div><button className="button-dark" onClick={() => setCreateOpen(v => !v)}>{createOpen ? <X size={16} /> : <Plus size={16} />}{createOpen ? "取消" : "新建模板"}</button></div></div>
      {message && <div className="inline-notice"><Check size={15} /> {message}<button onClick={() => setMessage("")} aria-label="关闭提示"><X size={14} /></button></div>}
      {createOpen && <div className="template-create surface"><div className="template-create-head"><div><h3>新建模板</h3></div></div><div className="template-form-grid"><div><label className="field-label" htmlFor="template-name">名称</label><input id="template-name" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="模板名称" maxLength={60} /></div><div><label className="field-label" htmlFor="template-category">分类</label><SmartSelect id="template-category" value={form.category} options={CUSTOM_CATEGORIES.map(c => ({ value: c, label: c }))} onChange={value => setForm({ ...form, category: value })} placeholder="选择分类" /></div><div className="form-wide"><label className="field-label" htmlFor="template-description">说明</label><input id="template-description" className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="用途" maxLength={240} /></div><div className="form-wide"><label className="field-label" htmlFor="template-content">内容</label><textarea id="template-content" className="form-textarea" rows={5} value={form.templateText} onChange={e => setForm({ ...form, templateText: e.target.value })} placeholder="模板内容" maxLength={10000} /></div></div><button className="button-primary" onClick={create} disabled={busy || !form.name.trim() || !form.templateText.trim()}>{busy ? "保存中..." : "保存"} <ArrowRight size={16} /></button></div>}
      <div className="template-grid">{filtered.map((item, index) => <article key={item.id} className={`template-card accent-${item.accent || "violet"}`}><div className="template-card-top"><span className="template-number">{String(index + 1).padStart(2, "0")}</span><span className="template-category">{item.category}</span>{!item.isBuiltin && <button className="template-delete" onClick={() => remove(item.id)} title="删除模板" aria-label={`删除 ${item.name}`}><Trash2 size={15} /></button>}</div><div className="template-card-icon"><LayoutTemplate size={22} /></div><h3>{item.name}</h3><p className="template-desc">{item.description}</p><div className={`template-sample ${expanded === item.id ? "expanded" : ""}`}><span>示例</span><p>{item.templateText}</p></div><div className="template-card-bottom"><button className="template-preview" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? "收起" : "展开"} <ChevronDown size={14} className={expanded === item.id ? "rotated" : ""} /></button><div><button className="template-copy" onClick={() => copy(item)} title="复制" aria-label={`复制 ${item.name}`}>{copied === item.id ? <Check size={17} /> : <Copy size={17} />}</button><button className="template-use" onClick={() => onUseTemplate(item.templateText, item.scenario)}>使用 <ArrowUpRight size={15} /></button></div></div></article>)}</div>
      {!filtered.length && <div className="empty-state"><div><Search size={25} /></div><h3>没有匹配的模板</h3><button onClick={() => { setQuery(""); setCategory("全部"); }}>清除筛选 <ArrowRight size={15} /></button></div>}
    </div>
  );
}
