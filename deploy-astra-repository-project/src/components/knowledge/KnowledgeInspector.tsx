"use client";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, Copy, ExternalLink, Focus, Link2, Maximize2, Pencil, Plus, Trash2, X } from "lucide-react";
import Dialog from "./Dialog";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { RELATION_LABELS, type GraphEdge } from "@/lib/knowledge-graph";

export function entryCode(item: KnowledgeEntry) {
  return `<knowledge_base>\n标题：${item.name}\n分类：${item.category || "通用"}\n${item.tags?.length ? `关联：${item.tags.join("、")}\n` : ""}${item.sourceUrl ? `来源：${item.sourceUrl}\n` : ""}${item.description ? `说明：${item.description}\n` : ""}${item.templateText}\n</knowledge_base>`;
}

type Block =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "bullet" | "number"; text: string; marker?: string }
  | { kind: "table"; rows: string[][] }
  | { kind: "code"; lines: string[] };

/** Turn plain prompt text into a readable document without hiding any of it. */
function parseDocument(text: string): Block[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let table: string[][] = [];
  let code: string[] | null = null;

  const flushTable = () => {
    if (!table.length) return;
    blocks.push({ kind: "table", rows: table });
    table = [];
  };
  const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (code) {
      if (trimmed.startsWith("```")) {
        blocks.push({ kind: "code", lines: code });
        code = null;
      } else code.push(raw);
      continue;
    }
    if (trimmed.startsWith("```")) { flushTable(); code = []; continue; }

    if (!trimmed) { flushTable(); continue; }

    // Markdown tables (used by the backend / API design prompts)
    if (trimmed.startsWith("|")) {
      if (isSeparator(trimmed)) continue;
      table.push(trimmed.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim()));
      continue;
    }
    flushTable();

    if (/^#{2,3}\s/.test(trimmed)) {
      const level = trimmed.startsWith("### ") ? "h3" : "h2";
      blocks.push({ kind: level, text: trimmed.replace(/^#{2,3}\s+/, "") });
      continue;
    }
    const bullet = /^([-·*•])\s+(.+)$/.exec(trimmed);
    if (bullet) { blocks.push({ kind: "bullet", text: bullet[2] }); continue; }
    const numbered = /^(\d+)[.、)]\s*(.+)$/.exec(trimmed);
    if (numbered) { blocks.push({ kind: "number", marker: numbered[1], text: numbered[2] }); continue; }
    blocks.push({ kind: "p", text: trimmed });
  }
  flushTable();
  if (code) blocks.push({ kind: "code", lines: code });
  return blocks;
}

/** Minimal inline emphasis for prompt text: **bold** and `code`. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="kg-doc-strong">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="kg-doc-code">{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function DocumentView({ text }: { text: string }) {
  const blocks = useMemo(() => parseDocument(text), [text]);
  return <div className="kg-doc">
    {blocks.map((block, index) => {
      switch (block.kind) {
        case "h2": return <h4 key={index} className="kg-doc-h2">{inline(block.text)}</h4>;
        case "h3": return <h5 key={index} className="kg-doc-h3">{inline(block.text)}</h5>;
        case "bullet": return <div key={index} className="kg-doc-bullet"><i /><span>{inline(block.text)}</span></div>;
        case "number": return <div key={index} className="kg-doc-number"><b>{block.marker}</b><span>{inline(block.text)}</span></div>;
        case "table": return <div key={index} className="kg-doc-table"><div className="kg-doc-table-scroll"><table><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => r === 0 ? <th key={c}>{inline(cell)}</th> : <td key={c}>{inline(cell)}</td>)}</tr>)}</tbody></table></div></div>;
        case "code": return <pre key={index} className="kg-doc-pre">{block.lines.join("\n")}</pre>;
        default: return <p key={index} className="kg-doc-p">{inline(block.text)}</p>;
      }
    })}
  </div>;
}

type InspectorTab = "content" | "info" | "code";
const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [
  { id: "content", label: "正文" },
  { id: "info", label: "关联" },
  { id: "code", label: "引用" },
];

export default function KnowledgeInspector({ entry, edges, entries, onSelect, onEdit, onUse, onToggle, onCopy, copied, onFocus, focused, onClose, onDelete, onCreateRelated }: {
  entry: KnowledgeEntry; edges: GraphEdge[]; entries: KnowledgeEntry[]; onSelect: (id: number) => void;
  onEdit: () => void; onUse: () => void; onToggle: () => void; onCopy: () => void; copied: boolean;
  onFocus: () => void; focused: boolean; onClose: () => void; onDelete: () => void; onCreateRelated?: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("content");
  const [copiedFull, setCopiedFull] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const tabPrefix = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const related = edges.filter(edge => edge.sourceIds.includes(entry.id) && edge.kind !== "contains");

  const selectTab = (next: InspectorTab) => {
    setTab(next);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = INSPECTOR_TABS.findIndex(item => item.id === tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % INSPECTOR_TABS.length;
    else if (event.key === "ArrowLeft") next = (index + INSPECTOR_TABS.length - 1) % INSPECTOR_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = INSPECTOR_TABS.length - 1;
    else return;
    event.preventDefault();
    selectTab(INSPECTOR_TABS[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  const copyFull = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(entry.templateText);
      setCopyError(false);
      setCopiedFull(true);
      window.setTimeout(() => setCopiedFull(false), 1800);
    } catch {
      setCopiedFull(false);
      setCopyError(true);
    }
  };

  return <div className="kg-inspector-content kg-reader-inspector" role="region" aria-label={`${entry.name}的知识内容`}>
    <div className="kg-reader-toolbar">
      <div className="kg-reader-tabs" role="tablist" aria-label="知识详情视图" onKeyDown={handleTabKeys}>
        {INSPECTOR_TABS.map(({ id, label }) => <button
          key={id}
          id={`${tabPrefix}-${id}`}
          type="button"
          role="tab"
          aria-controls={`${tabPrefix}-panel`}
          aria-selected={tab === id}
          tabIndex={tab === id ? 0 : -1}
          className={tab === id ? "active" : ""}
          onClick={() => selectTab(id)}
        >{label}</button>)}
      </div>
      <div className="kg-reader-tools">
        <button type="button" className="kg-icon" onClick={() => void copyFull()} aria-label={copiedFull ? "正文已复制" : "复制正文"} title={copiedFull ? "正文已复制" : "复制正文"}>
          {copiedFull ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <button type="button" className="kg-icon" onClick={() => setReadingOpen(true)} aria-label="放大阅读" title="放大阅读"><Maximize2 size={16} /></button>
        <button type="button" className="kg-icon" onClick={onClose} aria-label="关闭知识详情" title="关闭"><X size={18} /></button>
      </div>
    </div>
    {copyError && <p className="kg-reader-error" role="status">无法访问剪贴板，请选中正文手动复制。</p>}
    <span className="kg-reader-sr" role="status">{copiedFull ? "正文已复制" : ""}</span>

    <div ref={scrollRef} className="kg-inspector-scroll kg-reader-scroll" id={`${tabPrefix}-panel`} role="tabpanel" aria-labelledby={`${tabPrefix}-${tab}`} tabIndex={0}>
      {tab === "content" && (entry.templateText.trim()
        ? <DocumentView text={entry.templateText} />
        : <p className="kg-muted">暂无正文内容。</p>)}

      {tab === "info" && <>
        <div className="kg-section-row kg-reader-info-heading"><span className="kg-section-label">关联知识</span><small>{related.length} 条可见关联</small></div>
        <div className="kg-related-list">{related.slice(0, 8).map(edge => {
          const otherId = edge.sourceIds.find(id => id !== entry.id);
          const other = entries.find(item => item.id === otherId);
          return <button key={edge.id} onClick={() => other && onSelect(other.id)} disabled={!other}><Link2 size={13} /><span>{other?.name || edge.label}<small>{edge.origin === "共享关键词" ? `共享 · ${edge.label}` : RELATION_LABELS[edge.kind]}</small></span><ArrowUpRight size={13} /></button>;
        })}{!related.length && <p className="kg-muted">当前视图暂无关联。添加关键词或明确关系，让知识连接起来。</p>}</div>
        {onCreateRelated && <button type="button" className="kg-create-related" onClick={onCreateRelated}><Plus size={14} />从此新建关联知识</button>}
        <div className="kg-provenance">
          <span className="kg-section-label">条目信息</span>
          <strong>{entry.name}</strong>
          <p>{entry.category || "通用"}{entry.description ? ` · ${entry.description}` : ""}</p>
          {(entry.tags || []).length > 0 && <div className="kg-preview-tags">{(entry.tags || []).map(tag => <span key={tag}>#{tag}</span>)}</div>}
          {!entry.isBuiltin && <button type="button" className={`kg-status ${entry.enabled !== false ? "on" : ""}`} onClick={onToggle} aria-pressed={entry.enabled !== false}><i />{entry.enabled !== false ? "已启用，点击停用" : "已停用，点击启用"}</button>}
          <span className="kg-section-label kg-reader-source-label">来源与更新</span>
          <p>{entry.source === "seed" ? "ASTRA 精选知识 · 可编辑" : entry.isBuiltin ? "精选提示词范例" : "用户创建"}</p>
          {entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源链接 <ExternalLink size={12} /></a> : <small>未提供外部来源，内容未经外部核验</small>}
          <small>{entry.updatedAt ? `更新于 ${new Date(entry.updatedAt).toLocaleDateString("zh-CN")}` : entry.createdAt ? `创建于 ${new Date(entry.createdAt).toLocaleDateString("zh-CN")}` : "更新时间未记录"}</small>
        </div>
      </>}

      {tab === "code" && <>
        <div className="kg-section-row kg-reader-info-heading"><span className="kg-section-label">独立参考资料块</span><button type="button" className="kg-text-button" onClick={onCopy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "已复制" : "复制"}</button></div>
        <pre className="kg-code">{entryCode(entry)}</pre>
        <p className="kg-muted">仅在当前任务相关且条目已启用时注入，最多引用 3 条、约 2,400 字。</p>
      </>}
    </div>

    {readingOpen && <Dialog wide title="正文" onClose={() => setReadingOpen(false)}>
      <div className="kg-reading">
        <DocumentView text={entry.templateText} />
        {copyError && <p className="kg-reader-error" role="status">无法访问剪贴板，请选中正文手动复制。</p>}
      </div>
      <footer className="kg-dialog-footer kg-reading-footer"><button type="button" className="kg-button" onClick={() => void copyFull()}>{copiedFull ? <Check size={14} /> : <Copy size={14} />}{copiedFull ? "已复制" : "复制正文"}</button></footer>
    </Dialog>}

    <div className="kg-inspector-actions kg-reader-footer"><button type="button" className="kg-button kg-primary" onClick={onUse}>用于工作台 <ArrowUpRight size={15} /></button>{!entry.isBuiltin && <><button type="button" className="kg-icon kg-bordered" onClick={onEdit} aria-label="编辑当前知识" title="编辑知识"><Pencil size={16} /></button><button type="button" className="kg-icon kg-bordered" onClick={onDelete} aria-label="删除当前知识" title="删除知识"><Trash2 size={15} /></button></>}<button type="button" className={`kg-icon kg-bordered ${focused ? "active" : ""}`} onClick={onFocus} aria-label={focused ? "退出邻域聚焦" : "聚焦关联知识"} aria-pressed={focused} title={focused ? "退出聚焦" : "聚焦关联知识"}><Focus size={17} /></button></div>
  </div>;
}

export function RelationInspector({ edge, entries, onSelect, onClose }: { edge: GraphEdge; entries: KnowledgeEntry[]; onSelect: (id: number) => void; onClose: () => void }) {
  const source = entries.find(item => `entry:${item.id}` === edge.source);
  const target = entries.find(item => `entry:${item.id}` === edge.target);
  return <div className="kg-inspector-content"><div className="kg-inspector-top"><span className="kg-eyebrow">关系详情</span><button className="kg-icon" onClick={onClose} aria-label="关闭关系详情"><X size={16} /></button></div><span className="kg-relation-symbol"><Link2 size={25} /></span><h3>{RELATION_LABELS[edge.kind]}</h3><p className="kg-inspector-description">{edge.origin} · {edge.kind === "shared" || edge.kind === "topic" ? "自动匹配，不代表事实引用" : "可追溯的显式关系"}</p><div className="kg-relation-endpoints">{source && <button onClick={() => onSelect(source.id)}>{source.name}<ArrowRight size={14} /></button>}<span>{RELATION_LABELS[edge.kind]}</span>{target && <button onClick={() => onSelect(target.id)}>{target.name}<ArrowRight size={14} /></button>}</div><span className="kg-section-label">判断依据</span>{edge.evidence.map(item => <p className="kg-evidence" key={item}>{item}</p>)}<div className="kg-editor-note">共享关键词只说明主题相似。若要表达事实上的参考或依赖，请在编辑知识时添加明确关系。</div></div>;
}
