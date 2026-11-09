"use client";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Check, Copy, ExternalLink, Focus, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { RELATION_LABELS, type GraphEdge } from "@/lib/knowledge-graph";
import { paletteForEntry } from "@/lib/knowledge-palette";

export function entryCode(item: KnowledgeEntry) {
  return `<knowledge_base>\n标题：${item.name}\n分类：${item.category || "通用"}\n${item.tags?.length ? `关联：${item.tags.join("、")}\n` : ""}${item.sourceUrl ? `来源：${item.sourceUrl}\n` : ""}${item.description ? `说明：${item.description}\n` : ""}${item.templateText}\n</knowledge_base>`;
}

export default function KnowledgeInspector({ entry, edges, entries, onSelect, onEdit, onUse, onToggle, onCopy, copied, onFocus, focused, onClose, onDelete, onCreateRelated }: {
  entry: KnowledgeEntry; edges: GraphEdge[]; entries: KnowledgeEntry[]; onSelect: (id: number) => void;
  onEdit: () => void; onUse: () => void; onToggle: () => void; onCopy: () => void; copied: boolean;
  onFocus: () => void; focused: boolean; onClose: () => void; onDelete: () => void; onCreateRelated?: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "content" | "code">("overview");
  const palette = paletteForEntry(entry);
  const related = edges.filter(edge => edge.sourceIds.includes(entry.id) && edge.kind !== "contains");
  return <div className="kg-inspector-content">
    <div className="kg-inspector-top"><span className="kg-eyebrow">知识详情 · 图谱内操作</span><button className="kg-icon" onClick={onClose} aria-label="关闭知识详情"><X size={16} /></button></div>
    <div className="kg-inspector-title"><span className="kg-entry-icon" style={{ color: palette.colors.accent, background: `${palette.colors.accent}16` }}><BookOpen size={21} /></span><span className="kg-category-label">{entry.category || "通用"}</span>{!entry.isBuiltin && <button className={`kg-status ${entry.enabled !== false ? "on" : ""}`} onClick={onToggle} aria-pressed={entry.enabled !== false}><i />{entry.enabled !== false ? "已启用" : "已停用"}</button>}</div>
    <h3>{entry.name}</h3><p className="kg-inspector-description">{entry.description || "用户提供的参考知识"}</p>
    <div className="kg-detail-tabs" role="tablist" aria-label="知识详情视图">{([['overview', '概览'], ['content', '原文'], ['code', '引用代码']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div className="kg-inspector-scroll" role="tabpanel">
      {tab === "overview" && <><span className="kg-section-label">内容摘要</span><p className="kg-content-excerpt">{entry.templateText.slice(0, 220)}{entry.templateText.length > 220 ? "…" : ""}</p><div className="kg-preview-tags">{(entry.tags || []).map(tag => <span key={tag}>#{tag}</span>)}</div><div className="kg-section-row"><span className="kg-section-label">关联知识</span><small>{related.length} 条可见关联</small></div><div className="kg-related-list">{related.slice(0, 8).map(edge => {
        const otherId = edge.sourceIds.find(id => id !== entry.id);
        const other = entries.find(item => item.id === otherId);
        return <button key={edge.id} onClick={() => other && onSelect(other.id)} disabled={!other}><Link2 size={13} /><span>{other?.name || edge.label}<small>{edge.origin === "共享关键词" ? `共享 · ${edge.label}` : RELATION_LABELS[edge.kind]}</small></span><ArrowUpRight size={13} /></button>;
      })}{!related.length && <p className="kg-muted">当前视图暂无关联。添加关键词或明确关系，让知识连接起来。</p>}</div><div className="kg-provenance"><span className="kg-section-label">来源与更新</span><p>{entry.source === "seed" ? "ASTRA 预置示例 · 可编辑" : entry.isBuiltin ? "内置提示词示例" : "用户创建"}</p>{entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源链接 <ExternalLink size={12} /></a> : <small>未提供外部来源，内容未经外部核验</small>}<small>{entry.updatedAt ? `更新于 ${new Date(entry.updatedAt).toLocaleDateString("zh-CN")}` : entry.createdAt ? `创建于 ${new Date(entry.createdAt).toLocaleDateString("zh-CN")}` : "更新时间未记录"}</small></div></>}
      {tab === "content" && <><span className="kg-section-label">完整原文 · {entry.templateText.length} 字</span><p className="kg-full-content">{entry.templateText}</p></>}
      {tab === "code" && <><div className="kg-section-row"><span className="kg-section-label">独立参考资料块</span><button className="kg-text-button" onClick={onCopy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "已复制" : "复制"}</button></div><pre className="kg-code">{entryCode(entry)}</pre><p className="kg-muted">仅在当前任务相关且条目已启用时注入，最多引用 3 条、约 2,400 字。</p></>}
    </div>
    {onCreateRelated && <button className="kg-create-related" onClick={onCreateRelated} title="以当前知识为起点，在图谱中创建一条已连线的知识"><Plus size={14} />从此新建关联知识</button>}
    <div className="kg-inspector-actions"><button className="kg-button kg-primary" onClick={onUse}>用于工作台 <ArrowUpRight size={15} /></button>{!entry.isBuiltin && <><button className="kg-icon kg-bordered" onClick={onEdit} aria-label="编辑当前知识"><Pencil size={16} /></button><button className="kg-icon kg-bordered" onClick={onDelete} aria-label="删除当前知识"><Trash2 size={15} /></button></>}<button className={`kg-icon kg-bordered ${focused ? "active" : ""}`} onClick={onFocus} aria-label={focused ? "退出邻域聚焦" : "聚焦关联知识"} aria-pressed={focused}><Focus size={17} /></button></div>
  </div>;
}

export function RelationInspector({ edge, entries, onSelect, onClose }: { edge: GraphEdge; entries: KnowledgeEntry[]; onSelect: (id: number) => void; onClose: () => void }) {
  const source = entries.find(item => `entry:${item.id}` === edge.source);
  const target = entries.find(item => `entry:${item.id}` === edge.target);
  return <div className="kg-inspector-content"><div className="kg-inspector-top"><span className="kg-eyebrow">关系详情</span><button className="kg-icon" onClick={onClose} aria-label="关闭关系详情"><X size={16} /></button></div><span className="kg-relation-symbol"><Link2 size={25} /></span><h3>{RELATION_LABELS[edge.kind]}</h3><p className="kg-inspector-description">{edge.origin} · {edge.kind === "shared" || edge.kind === "topic" ? "自动匹配，不代表事实引用" : "可追溯的显式关系"}</p><div className="kg-relation-endpoints">{source && <button onClick={() => onSelect(source.id)}>{source.name}<ArrowRight size={14} /></button>}<span>{RELATION_LABELS[edge.kind]}</span>{target && <button onClick={() => onSelect(target.id)}>{target.name}<ArrowRight size={14} /></button>}</div><span className="kg-section-label">判断依据</span>{edge.evidence.map(item => <p className="kg-evidence" key={item}>{item}</p>)}<div className="kg-editor-note">共享关键词只说明主题相似。若要表达事实上的参考或依赖，请在编辑知识时添加明确关系。</div></div>;
}
