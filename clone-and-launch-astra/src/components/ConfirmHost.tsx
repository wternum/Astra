"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import Dialog from "@/components/knowledge/Dialog";
import { CONFIRM_EVENT, type ConfirmDetail } from "@/lib/confirm";

type Pending = ConfirmDetail & { key: number };

/** Single, viewport-centered host for every in-app confirmation. */
export default function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ConfirmDetail>).detail;
      if (!detail || typeof detail.resolve !== "function") return;
      detail.handled = true;
      // A new request supersedes the old one; never leave a promise unresolved.
      pendingRef.current?.resolve(false);
      const next = { ...detail, key: Date.now() + Math.random() };
      pendingRef.current = next;
      setPending(next);
    };
    window.addEventListener(CONFIRM_EVENT, handler);
    return () => window.removeEventListener(CONFIRM_EVENT, handler);
  }, []);
  const finish = (confirmed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    current?.resolve(confirmed);
    setPending(null);
  };
  if (!pending) return null;
  const Icon = pending.danger ? AlertTriangle : HelpCircle;
  return <Dialog key={pending.key}
    title={pending.title || "请确认操作"}
    subtitle={pending.subtitle || "此操作需要你确认后才会执行。"}
    onClose={() => finish(false)}>
    <div className={`astra-confirm-body ${pending.danger ? "is-danger" : ""}`}>
      <span className="astra-confirm-icon"><Icon size={20} /></span>
      <div><strong>{pending.title || "确定继续吗？"}</strong><p>{pending.message}</p></div>
    </div>
    <footer className="kg-dialog-footer">
      <span className="kg-group-footer-hint">可随时取消，不会改动数据</span>
      <div>
        <button className="kg-button" onClick={() => finish(false)}>{pending.cancelLabel || "取消"}</button>
        <button className={`kg-button ${pending.danger ? "kg-danger" : "kg-primary"}`} autoFocus onClick={() => finish(true)}>{pending.confirmLabel || "确认"}</button>
      </div>
    </footer>
  </Dialog>;
}
