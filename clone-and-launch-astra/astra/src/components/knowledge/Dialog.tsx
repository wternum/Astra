"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Dialog({ title, subtitle, children, onClose, wide = false, busy = false }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`kg-dialog ${wide ? "kg-dialog-wide" : ""}`} aria-labelledby="kg-dialog-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="kg-dialog-inner">
      <header className="kg-dialog-header"><div><span className="kg-eyebrow">ASTRA KNOWLEDGE</span><h2 id="kg-dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="kg-icon" onClick={onClose} disabled={busy} aria-label="关闭弹窗"><X size={19} /></button></header>
      {children}
    </div>
  </dialog>;
}
