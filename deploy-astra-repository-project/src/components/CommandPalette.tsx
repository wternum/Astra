"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Command, CornerDownLeft, History, Moon, PlugZap, Search, Sparkles, Sun, Wand2, X } from "lucide-react";

export const THEMES = [
  { id: "light", name: "白色", description: "纯白界面 · 清晰专注", color: "#ffffff" },
  { id: "dark", name: "暗色", description: "柔和深灰 · 夜间舒适", color: "#18181b" },
] as const;
export type StudioTheme = typeof THEMES[number]["id"];
export type PaletteDestination = "studio" | "templates" | "history" | "guide";
interface Action { id: string; label: string; hint: string; keywords: string; icon: ReactNode; run: () => void }

export default function CommandPalette({ open, onClose, onNavigate, onUsePrompt, onOpenModel, onTheme, theme }: {
  open: boolean; onClose: () => void; onNavigate: (view: PaletteDestination) => void;
  onUsePrompt: (prompt: string, scenario: string) => void; onOpenModel: () => void;
  onTheme: (theme: StudioTheme) => void; theme: StudioTheme;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const actions = useMemo<Action[]>(() => [
    { id: "studio", label: "打开创作工作台", hint: "STUDIO", keywords: "workspace gongzuotai 工作台", icon: <Wand2 size={18} />, run: () => onNavigate("studio") },
    { id: "templates", label: "打开知识库", hint: "KNOWLEDGE", keywords: "knowledge zhishiku 知识 资料 模板", icon: <BookOpen size={18} />, run: () => onNavigate("templates") },
    { id: "history", label: "查看历史与收藏", hint: "ARCHIVE", keywords: "history favorite 历史 收藏", icon: <History size={18} />, run: () => onNavigate("history") },
    { id: "guide", label: "打开提示词手册", hint: "GUIDE", keywords: "guide help 帮助 手册", icon: <BookOpen size={18} />, run: () => onNavigate("guide") },
    { id: "model", label: "连接免费 AI 模型", hint: "NO KEY", keywords: "model ai free 免费 模型 pollinations openrouter", icon: <PlugZap size={18} />, run: onOpenModel },
    { id: "focus", label: "聚焦输入框", hint: "FOCUS", keywords: "input write 输入 写作", icon: <Search size={18} />, run: () => { onNavigate("studio"); window.setTimeout(() => document.getElementById("goal")?.focus(), 100); } },
    { id: "generate", label: "生成优化提示词", hint: "⌘ ↵", keywords: "generate optimize 生成 优化", icon: <Sparkles size={18} />, run: () => { onNavigate("studio"); window.setTimeout(() => window.dispatchEvent(new CustomEvent("promptforge:generate")), 100); } },
    { id: "arena-game", label: "试试：Arena 小游戏", hint: "STARTER", keywords: "arena game 游戏 对战 打砖块", icon: <Wand2 size={18} />, run: () => onUsePrompt("做一个打砖块小游戏，要有道具和三个关卡", "coding") },
    { id: "arena-tool", label: "试试：Arena 工具应用", hint: "STARTER", keywords: "arena tool markdown 编辑器 应用", icon: <Wand2 size={18} />, run: () => onUsePrompt("做一个 Markdown 编辑器，支持暗色模式和实时预览", "coding") },
    ...THEMES.map(item => ({ id: `theme-${item.id}`, label: `${theme === item.id ? "当前模式：" : "切换到"}${item.name}模式`, hint: "APPEARANCE", keywords: `theme appearance 主题 外观 模式 ${item.id} ${item.name} ${item.id === "dark" ? "dark night 夜间 暗黑 深色" : "light white 白天 浅色 纯白"}`, icon: item.id === "dark" ? <Moon size={18} /> : <Sun size={18} />, run: () => onTheme(item.id) })),
  ], [onNavigate, onUsePrompt, onOpenModel, onTheme, theme]);
  const filtered = actions.filter(action => `${action.label} ${action.keywords}`.toLowerCase().includes(query.toLowerCase()));


  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 40);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const nodes = inputRef.current?.querySelectorAll<HTMLElement>("input,button");
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.clearTimeout(focusTimer); window.removeEventListener("keydown", handler); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const execute = (action: Action) => { onClose(); action.run(); };

  return <div className="command-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="command-panel" ref={inputRef} role="dialog" aria-modal="true" aria-label="快捷命令面板"><div className="command-search"><Search size={21} /><input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} placeholder="搜索操作" aria-label="搜索快捷操作" aria-controls="command-results" aria-activedescendant={filtered[active] ? `command-${filtered[active].id}` : undefined} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); } if (e.key === "Enter" && filtered[active]) { e.preventDefault(); execute(filtered[active]); } }} /><button onClick={onClose} aria-label="关闭命令面板"><X size={18} /></button></div><div className="command-caption"><Command size={13} /> 快捷操作 <span>↑ ↓ 选择 · Enter 执行</span></div><div className="command-results" id="command-results" role="listbox">{filtered.map((action, index) => <button key={action.id} id={`command-${action.id}`} role="option" aria-selected={active === index} className={active === index ? "active" : ""} onMouseEnter={() => setActive(index)} onClick={() => execute(action)}><span className="command-action-icon">{action.icon}</span><strong>{action.label}</strong><small>{action.hint}</small>{active === index && <CornerDownLeft size={15} />}</button>)}{!filtered.length && <div className="command-empty">没有匹配的操作。</div>}</div><div className="command-footer"><span><kbd>esc</kbd> 关闭 <ArrowRight size={13} /></span></div></div></div>;
}
