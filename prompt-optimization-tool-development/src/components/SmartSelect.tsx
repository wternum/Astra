"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export interface SelectOption { value: string; label: string; detail?: string }

export default function SmartSelect({ id, value, options, onChange, placeholder = "请选择", searchable = false, disabled = false }: {
  id?: string; value: string; options: SelectOption[]; onChange: (value: string) => void;
  placeholder?: string; searchable?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 200, above: false });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const selected = options.find(item => item.value === value);
  const filtered = options.filter(item => `${item.label} ${item.value}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const above = window.innerHeight - rect.bottom < 255 && rect.top > 255;
      setPosition({ top: above ? rect.top - 7 : rect.bottom + 7, left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width, above });
    };
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", outside);
    if (searchable) window.setTimeout(() => searchInput.current?.focus(), 0);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); document.removeEventListener("pointerdown", outside); };
  }, [open, searchable]);

  const choose = (next: string) => { onChange(next); setOpen(false); setSearch(""); setHighlight(0); trigger.current?.focus(); };
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); if (!open) setOpen(true); else setHighlight(index => Math.min(index + 1, filtered.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); event.stopPropagation(); if (!open) setOpen(true); else setHighlight(index => Math.max(0, index - 1)); }
    if (event.key === "Enter" && open && filtered[highlight]) { event.preventDefault(); event.stopPropagation(); choose(filtered[highlight].value); }
  };

  const panel = open && typeof document !== "undefined" ? createPortal(<div ref={popup} className={`smart-select-menu ${position.above ? "opens-up" : ""}`} style={{ position: "fixed", left: position.left, top: position.top, width: position.width, transform: position.above ? "translateY(-100%)" : undefined }} onKeyDown={keyboard}>
    {searchable && <div className="smart-select-search"><Search size={14} /><input ref={searchInput} value={search} onChange={event => { setSearch(event.target.value); setHighlight(0); }} placeholder="搜索选项" aria-label="搜索选项" /></div>}
    <div className="smart-select-options" role="listbox" aria-label={placeholder}>
      {filtered.map((item, index) => <button type="button" key={item.value} role="option" aria-selected={item.value === value} className={`smart-select-option ${item.value === value ? "selected" : ""} ${highlight === index ? "highlighted" : ""}`} onMouseEnter={() => setHighlight(index)} onClick={() => choose(item.value)}><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>{item.value === value && <Check size={15} />}</button>)}
      {!filtered.length && <p className="smart-select-empty">没有匹配的模型，可手动输入模型 ID。</p>}
    </div>

  </div>, document.body) : null;

  return <div className="smart-select-wrap"><button id={id} ref={trigger} type="button" disabled={disabled} className={`smart-select-trigger ${open ? "is-open" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen(wasOpen => !wasOpen); setSearch(""); setHighlight(Math.max(0, options.findIndex(o => o.value === value))); }} onKeyDown={keyboard}><span>{selected?.label || placeholder}</span><ChevronDown size={15} className={open ? "rotated" : ""} /></button>{panel}</div>;
}
