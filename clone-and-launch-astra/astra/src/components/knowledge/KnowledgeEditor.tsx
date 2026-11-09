"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Link2, Plus, Trash2, X } from "lucide-react";
import type { KnowledgeEntry } from "@/lib/knowledge";
import type { KnowledgeRelation } from "@/lib/knowledge-graph";
import { paletteForEntry } from "@/lib/knowledge-palette";
import { LIBRARIES } from "@/lib/knowledge-library";

export type KnowledgeDraft = { name: string; category: string; description: string; templateText: string; tags: string[]; sourceUrl: string; relations: KnowledgeRelation[]; enabled: boolean; accent: string; library: string };
export type KnowledgePreset = { library?: string; category?: string; relatedId?: number; tags?: string[] };
const CATEGORIES = ["通用", "品牌", "写作", "开发", "分析", "营销", "学习", "数据", "效率", "创意"];

/** In-canvas editor: a side dock, never a page-blocking modal. The graph stays visible and usable. */
export default function KnowledgeEditor({ entry, entries, initial, onSave, onClose, onDraftChange, onDirtyChange }: {
  entry: KnowledgeEntry | null; entries: KnowledgeEntry[]; initial?: KnowledgePreset;
  onSave: (draft: KnowledgeDraft) => Promise<void>; onClose: () => void;
  onDraftChange?: (preview: { name: string; category: string }) => void;
  onDirtyChange?: (dirty: boolean, busy: boolean) => void;
}) {
  const presetRelations: KnowledgeRelation[] = initial?.relatedId ? [{ targetId: initial.relatedId, kind: "references" }] : [];
  const [form, setForm] = useState<KnowledgeDraft>({
    name: entry?.name || "", category: entry?.category || initial?.category || "通用", description: entry?.description || "",
    templateText: entry?.templateText || "", tags: entry?.tags || initial?.tags || [], sourceUrl: entry?.sourceUrl || "",
    relations: entry?.relations || presetRelations, enabled: entry?.enabled !== false,
    accent: entry?.accent || paletteForEntry({ category: entry?.category || initial?.category || "通用" }).id,
    library: entry?.library || initial?.library || "",
  });
  const [tagInput, setTagInput] = useState("");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<"references" | "depends_on">("references");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const relatedName = initial?.relatedId ? entries.find(item => item.id === initial.relatedId)?.name : "";
  const initialForm: KnowledgeDraft = { name: entry?.name || "", category: entry?.category || initial?.category || "通用", description: entry?.description || "", templateText: entry?.templateText || "", tags: entry?.tags || initial?.tags || [], sourceUrl: entry?.sourceUrl || "", relations: entry?.relations || presetRelations, enabled: entry?.enabled !== false, accent: entry?.accent || paletteForEntry({ category: entry?.category || initial?.category || "通用" }).id, library: entry?.library || initial?.library || "" };
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm) || Boolean(tagInput.trim());
  useEffect(() => { onDirtyChange?.(dirty, busy); }, [dirty, busy, onDirtyChange]);
  useEffect(() => { if (!entry) onDraftChange?.({ name: form.name, category: form.category }); }, [form.name, form.category, entry, onDraftChange]);
  const close = () => { if (!busy && (!dirty || window.confirm("放弃尚未保存的修改？"))) onClose(); };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  });
  const update = <K extends keyof KnowledgeDraft>(key: K, value: KnowledgeDraft[K]) => setForm(old => ({ ...old, [key]: value }));
  const addTags = (raw: string) => {
    const next = raw.split(/[,，、\n]+/).map(tag => tag.trim().slice(0, 24)).filter(Boolean);
    update("tags", [...new Map([...form.tags, ...next].map(tag => [tag.normalize("NFKC").toLowerCase(), tag])).values()].slice(0, 6));
    setTagInput("");
  };
  const suggestions = [...new Set(entries.flatMap(item => item.tags || []))].filter(tag => !form.tags.includes(tag)).slice(0, 5);
  const targets = entries.filter(item => !item.isBuiltin && item.id !== entry?.id);
  const submit = async () => {
    if (!form.name.trim() || !form.templateText.trim()) { setError("请填写标题和知识内容。"); return; }
    if (form.sourceUrl.trim()) {
      try { const url = new URL(form.sourceUrl.trim()); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
      catch { setError("来源链接请填写完整的 http 或 https 地址。"); return; }
    }
    setBusy(true); setError("");
    try { await onSave({ ...form, name: form.name.trim(), category: form.category.trim() || "通用", templateText: form.templateText.trim() }); }
    catch (err) { setError(err instanceof Error ? err.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  };
  return <aside className="kg-dock kg-dock-editor nowheel nopan" aria-label={entry ? "编辑知识" : "在知识网中新建知识"}>
    <header className="kg-dock-header"><div><span className="kg-eyebrow">KNOWLEDGE NODE</span><h2>{entry ? "编辑知识节点" : "新建知识节点"}</h2><p>{relatedName ? `从「${relatedName}」延伸，保存后自动连线` : "沿用当前标签，保存后加入知识网"}</p></div><button className="kg-icon" onClick={close} disabled={busy} aria-label="关闭编辑面板"><X size={17} /></button></header>
    <form className="kg-dock-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="kg-dock-scroll nowheel">
        <label className="kg-field">知识标题 <span>*</span><input autoFocus value={form.name} maxLength={60} onChange={event => update("name", event.target.value)} placeholder="例如：品牌语气规范" required /></label>
        {entry ? <div className="kg-field-row"><label className="kg-field kg-grow">分类<input list="kg-categories" value={form.category} maxLength={30} onChange={event => update("category", event.target.value)} /><datalist id="kg-categories">{CATEGORIES.map(value => <option key={value} value={value} />)}</datalist></label><label className="kg-field kg-grow">知识域<select aria-label="知识域" value={form.library} onChange={event => update("library", event.target.value)}><option value="">按分类自动</option>{LIBRARIES.map(library => <option key={library.id} value={library.id}>{library.name}</option>)}</select></label></div>
          : <div className="kg-inherit-card" aria-label="当前归属与关联"><span className="kg-eyebrow">自动归属</span><strong>{[LIBRARIES.find(library => library.id === form.library)?.name, form.category].filter(Boolean).join(" / ") || "将按内容自动归入当前知识网"}</strong><p>{relatedName ? `保存后自动关联「${relatedName}」` : form.tags.length ? `沿用当前标签 ${form.tags.map(tag => `#${tag}`).join(" ")}` : "直接写内容即可，不必再选分类。"}</p></div>}
        <label className="kg-field">用途说明<input value={form.description} maxLength={240} onChange={event => update("description", event.target.value)} placeholder="一句话说明适合什么任务" /></label>
        <label className="kg-field">知识内容 <span>*</span><textarea rows={7} value={form.templateText} maxLength={10000} onChange={event => update("templateText", event.target.value)} placeholder="直接写下事实、规范或约定，保存后会加入当前节点。" required /><small>{form.templateText.length.toLocaleString()} / 10,000 字</small></label>
        {entry && <div className="kg-field">关键词 <small>回车添加 · 用于自动连线</small><div className="kg-tag-input">{form.tags.map(tag => <button type="button" key={tag} onClick={() => update("tags", form.tags.filter(item => item !== tag))} aria-label={`移除关键词 ${tag}`}>#{tag} <span>×</span></button>)}<input aria-label="添加关键词" value={tagInput} maxLength={120} onChange={event => setTagInput(event.target.value)} onBlur={() => { if (tagInput.trim()) addTags(tagInput); }} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTags(tagInput); } }} placeholder="语气、品牌、文案…" /></div>{suggestions.length > 0 && <div className="kg-tag-suggestions">常用：{suggestions.map(tag => <button type="button" key={tag} onClick={() => addTags(tag)}>+ {tag}</button>)}</div>}</div>}
        {entry && <label className="kg-field">来源链接 <small>可选</small><div className="kg-input-icon"><Link2 size={15} /><input type="url" value={form.sourceUrl} maxLength={2048} onChange={event => update("sourceUrl", event.target.value)} placeholder="https://example.com/brand-guide" /></div></label>}
        {entry && <div className="kg-field">明确关系 <small>保存后在图谱中生成连线</small><div className="kg-relation-add"><select aria-label="关系类型" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="references">参考</option><option value="depends_on">依赖</option></select><select aria-label="关联知识" value={target} onChange={event => setTarget(event.target.value)}><option value="">选择目标知识</option>{targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" className="kg-icon" aria-label="添加关系" disabled={!target || form.relations.length >= 12} onClick={() => { if (!form.relations.some(item => item.targetId === Number(target) && item.kind === kind)) update("relations", [...form.relations, { targetId: Number(target), kind }]); setTarget(""); }}><Plus size={17} /></button></div>{form.relations.map(relation => <div className="kg-relation-draft" key={`${relation.targetId}:${relation.kind}`}><span>{relation.kind === "references" ? "参考" : "依赖"} <ArrowRight size={12} /> {entries.find(item => item.id === relation.targetId)?.name}</span><button type="button" className="kg-icon" aria-label="移除关系" onClick={() => update("relations", form.relations.filter(item => item !== relation))}><Trash2 size={14} /></button></div>)}</div>}
      </div>
      {error && <p className="kg-form-error" role="alert">{error}</p>}
      <footer className="kg-dock-footer"><label className="kg-checkbox"><input type="checkbox" checked={form.enabled} onChange={event => update("enabled", event.target.checked)} />参与构建</label><div><button type="button" className="kg-button" onClick={close} disabled={busy}>取消</button><button className="kg-button kg-primary" type="submit" disabled={busy}>{busy ? "保存中…" : "保存到知识网"}<ArrowRight size={14} /></button></div></footer>
    </form>
  </aside>;
}
