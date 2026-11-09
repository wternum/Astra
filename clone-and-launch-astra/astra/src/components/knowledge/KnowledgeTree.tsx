"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Hash, Layers3, PanelLeftClose, Plus, X } from "lucide-react";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { LIBRARIES, libraryForEntry } from "@/lib/knowledge-library";
import { canonicalTag } from "@/lib/knowledge-graph";
import { ALL_KNOWLEDGE, type KnowledgeBranch } from "@/lib/knowledge-layout";

export default function KnowledgeTree({ entries, branch, scope, customCount, builtinCount, onNavigate, onScope, onClose, onCreate }: {
  entries: KnowledgeEntry[]; branch: KnowledgeBranch; scope: "mine" | "builtin"; customCount: number; builtinCount: number;
  onNavigate: (branch: KnowledgeBranch) => void; onScope: (scope: "mine" | "builtin") => void; onClose: () => void; onCreate: () => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(LIBRARIES.map(library => library.id));
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (branch.library === "all") return;
    setExpanded(old => old.includes(branch.library) ? old : [...old, branch.library]);
    if (branch.category) {
      const key = `${branch.library}:${branch.category}`;
      setExpandedCategories(old => old.includes(key) ? old : [...old, key]);
    }
  }, [branch.library, branch.category]);
  const tree = useMemo(() => LIBRARIES.map(library => {
    const list = entries.filter(entry => libraryForEntry(entry) === library.id);
    const categories = [...new Set(list.map(entry => entry.category || "通用"))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return { library, count: list.length, categories: categories.map(category => {
      const rows = list.filter(item => (item.category || "通用") === category);
      const keywords = new Map<string, { label: string; count: number }>();
      rows.forEach(entry => new Set((entry.tags || []).map(canonicalTag)).forEach(key => {
        const existing = keywords.get(key);
        keywords.set(key, { label: existing?.label || entry.tags?.find(tag => canonicalTag(tag) === key) || key, count: (existing?.count || 0) + 1 });
      }));
      return { name: category, count: rows.length, tags: [...keywords.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-CN")) };
    }) };
  }), [entries]);
  const matches = (text: string) => !filter.trim() || text.toLowerCase().includes(filter.trim().toLowerCase());
  const toggleDomain = (id: string) => setExpanded(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]);
  return <>
    <div className="kn-nav-heading"><span><Layers3 size={17} />知识标签</span><button className="kg-icon" onClick={onClose} title="收起标签导航" aria-label="收起标签导航"><PanelLeftClose size={16} /></button></div>
    <div className="kn-source-tabs" role="tablist" aria-label="知识来源">
      <button role="tab" aria-selected={scope === "mine"} className={scope === "mine" ? "active" : ""} onClick={() => onScope("mine")}>我的知识 <small>{customCount}</small></button>
      <button role="tab" aria-selected={scope === "builtin"} className={scope === "builtin" ? "active" : ""} onClick={() => onScope("builtin")}>内置示例 <small>{builtinCount}</small></button>
    </div>
    <div className="kn-tag-search"><Hash size={13} /><input aria-label="查找标签" placeholder="查找标签…" value={filter} onChange={event => setFilter(event.target.value)} />{filter && <button className="kg-icon" aria-label="清空标签搜索" onClick={() => setFilter("")}><X size={12} /></button>}</div>
    <nav className="kn-tree-scroll nowheel" aria-label="知识标签导航">
      <button className={`kn-tree-all ${branch.library === "all" ? "active" : ""}`} aria-current={branch.library === "all" ? "page" : undefined} onClick={() => onNavigate(ALL_KNOWLEDGE)}><Layers3 size={15} /><span>全部知识</span><small>{entries.length}</small></button>
      <div className="kn-tree-caption"><span>知识域 / 子标签</span><button onClick={() => setExpanded(expanded.length ? [] : LIBRARIES.map(item => item.id))}>{expanded.length ? "收起全部" : "展开全部"}</button></div>
      <ul className="kn-tree-list">{tree.filter(({ library, categories }) => matches(library.name) || categories.some(item => matches(item.name) || item.tags.some(tag => matches(tag.label)))).map(({ library, count, categories }) => {
        const isExpanded = expanded.includes(library.id) || !!filter;
        const current = branch.library === library.id;
        return <li key={library.id} className="kn-tree-domain" style={{ "--branch-accent": library.accent } as CSSProperties}>
          <div className={`kn-tree-row ${current && !branch.category ? "active" : ""}`}>
            <button className="kn-tree-chevron" aria-label={`${isExpanded ? "收起" : "展开"}${library.name}标签`} aria-expanded={isExpanded} onClick={() => toggleDomain(library.id)}>{isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
            <button className="kn-tree-label" aria-label={`打开${library.name}知识域`} aria-current={current && !branch.category ? "page" : undefined} onClick={() => { setExpanded(old => old.includes(library.id) ? old : [...old, library.id]); onNavigate({ library: library.id, category: "", tag: "" }); }}><i /><span>{library.name}</span><small>{count}</small></button>
          </div>
          {isExpanded && <ul className="kn-tree-children">{categories.filter(item => matches(library.name) || matches(item.name) || item.tags.some(tag => matches(tag.label))).map(item => {
            const key = `${library.id}:${item.name}`;
            const categorySelected = current && branch.category === item.name;
            const opened = expandedCategories.includes(key) || !!filter;
            return <li key={item.name}>
              <div className={`kn-tree-row kn-category-row ${categorySelected && !branch.tag ? "active" : ""}`}>
                <button className="kn-tree-chevron" aria-label={`${opened ? "收起" : "展开"}${library.name}·${item.name}子标签`} aria-expanded={opened} onClick={() => setExpandedCategories(old => old.includes(key) ? old.filter(value => value !== key) : [...old, key])}>{opened ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
                <button className="kn-tree-label" aria-label={`打开${library.name}·${item.name}分类`} aria-current={categorySelected && !branch.tag ? "page" : undefined} onClick={() => { setExpandedCategories(old => old.includes(key) ? old : [...old, key]); onNavigate({ library: library.id, category: item.name, tag: "" }); }}>{categorySelected ? <FolderOpen size={13} /> : <Folder size={13} />}<span>{item.name}</span><small>{item.count}</small></button>
              </div>
              {opened && item.tags.length > 0 && <ul className="kn-tree-keywords">{item.tags.filter(tag => matches(library.name) || matches(item.name) || matches(tag.label)).map(tag => <li key={tag.label}><button aria-label={`打开${library.name}·${item.name}·${tag.label}子标签`} aria-current={categorySelected && branch.tag === tag.label ? "page" : undefined} className={`kn-keyword ${categorySelected && branch.tag === tag.label ? "active" : ""}`} onClick={() => onNavigate({ library: library.id, category: item.name, tag: tag.label })}><Hash size={12} /><span>{tag.label}</span><small>{tag.count}</small></button></li>)}</ul>}
            </li>;
          })}{!categories.length && <li className="kn-tree-empty">暂无子标签</li>}</ul>}
        </li>;
      })}</ul>
      {filter && !tree.some(({ library, categories }) => matches(library.name) || categories.some(item => matches(item.name) || item.tags.some(tag => matches(tag.label)))) && <p className="kn-tree-empty">没有匹配的标签</p>}
    </nav>
    <div className="kn-nav-footer"><button onClick={onCreate}><Plus size={14} />在当前标签下新建</button><span><i />内容保存在当前浏览器</span></div>
  </>;
}
