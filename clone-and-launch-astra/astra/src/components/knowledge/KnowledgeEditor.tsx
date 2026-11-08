"use client";
import { useState } from "react";
import { ArrowRight, BookOpen, Link2, Plus, Trash2 } from "lucide-react";
import type { KnowledgeEntry } from "@/lib/knowledge";
import type { KnowledgeRelation } from "@/lib/knowledge-graph";
import { paletteForEntry } from "@/lib/knowledge-palette";
import { LIBRARIES } from "@/lib/knowledge-library";
import Dialog from "./Dialog";

export type KnowledgeDraft = { name: string; category: string; description: string; templateText: string; tags: string[]; sourceUrl: string; relations: KnowledgeRelation[]; enabled: boolean; accent: string; library: string };
const CATEGORIES = ["通用", "品牌", "写作", "开发", "分析", "营销", "学习", "数据", "效率", "创意"];

export default function KnowledgeEditor({ entry, entries, onSave, onClose }: {
  entry: KnowledgeEntry | null; entries: KnowledgeEntry[]; onSave: (draft: KnowledgeDraft) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<KnowledgeDraft>({
    name: entry?.name || "", category: entry?.category || "通用", description: entry?.description || "",
    templateText: entry?.templateText || "", tags: entry?.tags || [], sourceUrl: entry?.sourceUrl || "",
    relations: entry?.relations || [], enabled: entry?.enabled !== false, accent: entry?.accent || paletteForEntry({ category: entry?.category || "通用" }).id,
    library: entry?.library || "",
  });
  const [tagInput, setTagInput] = useState("");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<"references" | "depends_on">("references");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify({ name: entry?.name || "", category: entry?.category || "通用", description: entry?.description || "", templateText: entry?.templateText || "", tags: entry?.tags || [], sourceUrl: entry?.sourceUrl || "", relations: entry?.relations || [], enabled: entry?.enabled !== false, accent: entry?.accent || paletteForEntry({ category: entry?.category || "通用" }).id, library: entry?.library || "" });
  const close = () => { if (!busy && (!dirty || window.confirm("放弃尚未保存的修改？"))) onClose(); };
  const update = <K extends keyof KnowledgeDraft>(key: K, value: KnowledgeDraft[K]) => setForm(old => ({ ...old, [key]: value }));
  const addTags = (raw: string) => {
    const next = raw.split(/[,，、\n]+/).map(tag => tag.trim().slice(0, 24)).filter(Boolean);
    update("tags", [...new Map([...form.tags, ...next].map(tag => [tag.normalize("NFKC").toLowerCase(), tag])).values()].slice(0, 6));
    setTagInput("");
  };
  const suggestions = [...new Set(entries.flatMap(item => item.tags || []))].filter(tag => !form.tags.includes(tag)).slice(0, 6);
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
  return <Dialog title={entry ? "编辑知识" : "新建知识"} subtitle="记录可复用的事实与规范，再连接相关知识。" onClose={close} wide busy={busy}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="kg-editor-body">
        <div className="kg-editor-fields">
          <div className="kg-field-row"><label className="kg-field kg-grow">知识标题 <span>*</span><input autoFocus value={form.name} maxLength={60} onChange={event => update("name", event.target.value)} placeholder="例如：品牌语气规范" required /></label><label className="kg-field kg-category-field">分类<input list="kg-categories" value={form.category} maxLength={30} onChange={event => update("category", event.target.value)} /><datalist id="kg-categories">{CATEGORIES.map(value => <option key={value} value={value} />)}</datalist></label></div>
          <label className="kg-field">知识域 <small>决定它属于哪个大知识库</small><select value={form.library} onChange={event => update("library", event.target.value)}><option value="">按分类自动</option>{LIBRARIES.map(library => <option key={library.id} value={library.id}>{library.name} · {library.tagline}</option>)}</select></label>
          <label className="kg-field">用途说明<input value={form.description} maxLength={240} onChange={event => update("description", event.target.value)} placeholder="一句话说明：这条知识适合什么任务？" /></label>
          <label className="kg-field">知识内容 <span>*</span><textarea rows={6} value={form.templateText} maxLength={10000} onChange={event => update("templateText", event.target.value)} placeholder="粘贴事实、术语、风格要求或项目约定。内容会作为独立参考资料注入提示词。" required /><small>{form.templateText.length.toLocaleString()} / 10,000 字</small></label>
          <div className="kg-field">关键词 <small>最多 6 个 · 回车添加</small><div className="kg-tag-input">{form.tags.map(tag => <button type="button" key={tag} onClick={() => update("tags", form.tags.filter(item => item !== tag))} aria-label={`移除关键词 ${tag}`}>#{tag} <span>×</span></button>)}<input aria-label="添加关键词" value={tagInput} maxLength={120} onChange={event => setTagInput(event.target.value)} onBlur={() => { if (tagInput.trim()) addTags(tagInput); }} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTags(tagInput); } }} placeholder={form.tags.length ? "添加…" : "语气、品牌、文案…"} /></div>{suggestions.length > 0 && <div className="kg-tag-suggestions">常用：{suggestions.map(tag => <button type="button" key={tag} onClick={() => addTags(tag)}>+ {tag}</button>)}</div>}</div>
          <label className="kg-field">来源链接 <small>可选 · 便于核查</small><div className="kg-input-icon"><Link2 size={15} /><input type="url" value={form.sourceUrl} maxLength={2048} onChange={event => update("sourceUrl", event.target.value)} placeholder="https://example.com/brand-guide" /></div></label>
          <div className="kg-field">明确关系 <small>可选 · 指向已有知识</small><div className="kg-relation-add"><select aria-label="关系类型" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="references">参考</option><option value="depends_on">依赖</option></select><select aria-label="关联知识" value={target} onChange={event => setTarget(event.target.value)}><option value="">选择目标知识</option>{targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" className="kg-icon" aria-label="添加关系" disabled={!target || form.relations.length >= 12} onClick={() => { if (!form.relations.some(item => item.targetId === Number(target) && item.kind === kind)) update("relations", [...form.relations, { targetId: Number(target), kind }]); setTarget(""); }}><Plus size={17} /></button></div>{form.relations.map(relation => <div className="kg-relation-draft" key={`${relation.targetId}:${relation.kind}`}><span>{relation.kind === "references" ? "参考" : "依赖"} <ArrowRight size={12} /> {entries.find(item => item.id === relation.targetId)?.name}</span><button type="button" className="kg-icon" aria-label="移除关系" onClick={() => update("relations", form.relations.filter(item => item !== relation))}><Trash2 size={14} /></button></div>)}</div>
        </div>
        <aside className="kg-editor-preview"><span className="kg-eyebrow">构建预览</span><div className="kg-preview-icon"><BookOpen size={23} /></div><h3>{form.name || "你的下一条知识"}</h3><p>{form.description || "清晰的说明，让 AI 更准确地判断何时引用这条知识。"}</p><div className="kg-preview-tags">{form.tags.map(tag => <span key={tag}>#{tag}</span>)}</div><dl><div><dt>知识域</dt><dd>{LIBRARIES.find(library => library.id === form.library)?.name || "按分类自动"}</dd></div><div><dt>分类</dt><dd>{form.category || "通用"}</dd></div><div><dt>明确关系</dt><dd>{form.relations.length} 条</dd></div><div><dt>构建状态</dt><dd>{form.enabled ? "参与匹配" : "暂不参与"}</dd></div></dl><div className="kg-editor-note">关键词连接相似知识；明确关系表达参考或依赖。共享关键词不代表事实引用。</div></aside>
      </div>
      {error && <p className="kg-form-error" role="alert">{error}</p>}
      <footer className="kg-dialog-footer"><label className="kg-checkbox"><input type="checkbox" checked={form.enabled} onChange={event => update("enabled", event.target.checked)} />参与提示词构建</label><div><button type="button" className="kg-button" onClick={close} disabled={busy}>取消</button><button className="kg-button kg-primary" type="submit" disabled={busy}>{busy ? "保存中…" : "保存知识"}<ArrowRight size={15} /></button></div></footer>
    </form>
  </Dialog>;
}
