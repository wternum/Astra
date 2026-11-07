"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, Cpu, Gift, KeyRound, Loader2, LockKeyhole, PlugZap, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import type { ModelConfig, ProviderId } from "@/lib/optimizer";
import SmartSelect from "@/components/SmartSelect";

export interface ProviderStatus {
  id: ProviderId; name: string; description: string; defaultModel: string; serverConfigured: boolean;
  access: "public" | "free-tier" | "byok"; requiresKey: boolean; limits: string; privacy: string; docsUrl: string; keyUrl?: string;
}
type ListedModel = { id: string; name: string; context?: number };
const ACCESS_TABS = [
  { id: "public", label: "公共体验", icon: Gift },
  { id: "free-tier", label: "免费额度", icon: Sparkles },
  { id: "byok", label: "自定义接入", icon: SlidersHorizontal },
] as const;

export default function ModelDialog({ open, onClose, onConnect, onDisconnect, current, providers }: {
  open: boolean; onClose: () => void; onConnect: (config: ModelConfig) => void; onDisconnect: () => void;
  current: ModelConfig | null; providers: ProviderStatus[];
}) {
  const [provider, setProvider] = useState<ProviderId>("pollinations");
  const [access, setAccess] = useState<ProviderStatus["access"]>("public");
  const [model, setModel] = useState("openai-fast");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [catalog, setCatalog] = useState<ListedModel[]>([{ id: "openrouter/free", name: "自动路由 · 仅免费模型" }]);
  const [discovered, setDiscovered] = useState<ListedModel[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = providers.find(p => p.id === provider);
  const visibleProviders = providers.filter(p => p.access === access);
  const isCustom = provider === "custom";

  useEffect(() => {
    if (!open) return;
    const preferred = providers.find(p => p.id === current?.provider) || providers.find(p => p.access === "public") || providers[0];
    if (preferred) { setProvider(preferred.id); setAccess(preferred.access); setModel(current?.provider === preferred.id ? current.model : preferred.defaultModel); }
    setKey(current?.apiKey || ""); setBaseUrl(current?.baseUrl || ""); setError(""); setStatus("");
  }, [open, current, providers]);

  useEffect(() => {
    if (!open || access !== "free-tier") return;
    let active = true;
    setCatalogLoading(true);
    fetch("/api/model?catalog=openrouter").then(r => r.json()).then(data => {
      if (!active) return;
      if (Array.isArray(data.models) && data.models.length) setCatalog(data.models);
      if (data.warning) setStatus(data.warning);
    }).catch(() => { if (active) setStatus("免费模型目录暂时不可用，仍可选择自动免费路由。"); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [open, access]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 30);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", handler); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  const chooseProvider = (p: ProviderStatus) => {
    setProvider(p.id); setModel(p.id === current?.provider ? current!.model : p.defaultModel);
    setKey(p.id === current?.provider ? current?.apiKey || "" : "");
    if (p.id === "custom") {
      if (current?.provider === "custom") setBaseUrl(current.baseUrl || "");
      else {
        try {
          const saved = JSON.parse(localStorage.getItem("promptforge:custom-endpoint:v1") || "null");
          if (saved && typeof saved.baseUrl === "string") setBaseUrl(saved.baseUrl);
          if (saved && typeof saved.model === "string") setModel(saved.model);
        } catch { /* No remembered address. */ }
      }
    }
    setError(""); setStatus("");
  };
  const config = (): ModelConfig => ({ provider, model: model.trim(), apiKey: selected?.requiresKey || isCustom ? key.trim() || undefined : undefined, baseUrl: isCustom ? baseUrl.trim() : undefined });
  const discover = async () => {
    if (!baseUrl.trim()) { setError("请先填写 API 地址"); return; }
    setDetecting(true); setError(""); setStatus(""); setDiscovered([]);
    try {
      const response = await fetch("/api/model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover", modelConfig: config() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "探测失败");
      const items = data.models as ListedModel[];
      setDiscovered(items); setModel(items.find(m => m.id === model)?.id || items[0].id);
      setStatus(`已发现 ${items.length} 个模型。`);
    } catch (e) { setError(e instanceof Error ? e.message : "探测失败；也可手动输入模型 ID"); }
    finally { setDetecting(false); }
  };
  const connect = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setTesting(true);
    try {
      const response = await fetch("/api/model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelConfig: config() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "连接失败");
      onConnect(config());
    } catch (e) { setError(e instanceof Error ? e.message : "连接失败，请检查配置"); }
    finally { setTesting(false); }
  };
  const switchTab = (tab: typeof ACCESS_TABS[number]["id"]) => {
    setAccess(tab); const first = providers.find(p => p.access === tab && (tab !== "byok" || p.id === "custom"));
    if (first) chooseProvider(first);
  };

  return <div className="dialog-scrim" onMouseDown={e => { if (e.target === e.currentTarget && !testing && !detecting) onClose(); }}>
    <div className="dialog-panel model-dialog-v3" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="model-title">
      <div className="dialog-heading"><div className="dialog-icon"><PlugZap size={23} /></div><button className="icon-button" onClick={onClose} aria-label="关闭模型连接"><X size={19} /></button></div>
      <h2 id="model-title" className="dialog-title">连接模型</h2>
      <div className="model-access-tabs">{ACCESS_TABS.map(tab => { const Icon = tab.icon; return <button key={tab.id} className={access === tab.id ? "active" : ""} onClick={() => switchTab(tab.id)}><Icon size={16} />{tab.label}</button>; })}</div>
      <form onSubmit={connect}>
        {access === "public" ? <div className="public-provider-card"><div className="public-provider-top"><span className="public-gift"><Gift size={24} /></span><span className="no-key-sticker">无需密钥</span></div><h3>Pollinations · GPT-OSS 20B</h3><p>免费，请求间隔至少 30 秒。</p></div> : <>
          {access === "byok" && <div className="provider-choice"><button type="button" className={`provider-choice-item ${isCustom ? "chosen" : ""}`} onClick={() => { const p = providers.find(item => item.id === "custom"); if (p) chooseProvider(p); }}><SlidersHorizontal size={17} /><strong>自定义 URL</strong><span>任意公网兼容接口</span></button>{visibleProviders.filter(p => p.id !== "custom").map(p => <button type="button" key={p.id} className={`provider-choice-item ${provider === p.id ? "chosen" : ""}`} onClick={() => chooseProvider(p)}><Cpu size={17} /><strong>{p.name}</strong><span>官方预设</span></button>)}</div>}
          {access === "free-tier" && <div className="provider-compact">OpenRouter 免费额度 · 仅提供 :free 模型，不会自动切换收费模型。</div>}
          {isCustom && <><label className="field-label mt-6" htmlFor="custom-url">API 地址</label><div className="input-with-icon"><PlugZap size={17} /><input id="custom-url" className="form-input" type="url" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); setDiscovered([]); setStatus(""); }} placeholder="https://your-provider.com/v1" maxLength={500} autoComplete="url" /></div></>}
          <label className="field-label mt-6" htmlFor="model-key">API Key <span>{isCustom ? "可留空（公开接口）" : selected?.serverConfigured ? "服务端已配置，可留空" : "仅在当前页面内存中"}</span></label><div className="input-with-icon"><KeyRound size={17} /><input id="model-key" className="form-input" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={selected?.serverConfigured && !isCustom ? "服务端已配置，可留空" : "粘贴 API Key（如服务商要求）"} /></div>
          {isCustom && <button type="button" className="detect-button" onClick={discover} disabled={detecting || !baseUrl.trim()}>{detecting ? <Loader2 size={16} className="spin" /> : <Search size={16} />}{detecting ? "正在探测模型..." : "探测可用模型"}<ArrowRight size={14} /></button>}
          {selected?.keyUrl && <a className="provider-key-link" href={selected.keyUrl} target="_blank" rel="noreferrer">前往 {selected.name} 获取 Key <ArrowUpRight size={14} /></a>}
          <div className="field-label mt-6">模型</div>
          {isCustom && discovered.length > 0 && <SmartSelect value={discovered.some(item => item.id === model) ? model : ""} options={discovered.map(item => ({ value: item.id, label: item.name, detail: item.id !== item.name ? item.id : undefined }))} onChange={setModel} placeholder="选择模型" searchable />}
          {access === "free-tier" ? <SmartSelect value={model} options={catalog.map(item => ({ value: item.id, label: item.name, detail: item.context ? `${Math.round(item.context / 1000)}K 上下文 · ${item.id}` : item.id }))} onChange={setModel} placeholder="选择免费模型" searchable /> : <div className={`input-with-icon ${isCustom && discovered.length ? "mt-3" : ""}`}><Cpu size={17} /><input className="form-input" value={model} onChange={e => setModel(e.target.value)} maxLength={140} placeholder="模型 ID" /></div>}
        </>}
        {selected && <div className="model-terms"><div><ShieldCheck size={15} /><p>{selected.privacy}</p></div><div><RefreshCw size={15} /><p>{selected.limits}</p></div>{!isCustom && <a href={selected.docsUrl} target="_blank" rel="noreferrer">查看官方文档 <ArrowUpRight size={13} /></a>}</div>}
        {status && <div className="model-status" role="status"><Check size={15} />{status}</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="button-primary model-submit" disabled={testing || detecting || !model.trim() || isCustom && !baseUrl.trim() || Boolean(selected?.requiresKey && !key.trim() && !selected?.serverConfigured)}>{testing ? <><Loader2 size={17} className="spin" />正在验证模型...</> : <>验证并使用当前模型 <ArrowRight size={17} /></>}</button>
      </form>
      <div className="dialog-footer">{current && <button className="text-link danger" onClick={() => { onDisconnect(); onClose(); }}>断开连接</button>}<button className="text-link" onClick={onClose}><LockKeyhole size={14} /> 关闭</button></div>
    </div>
  </div>;
}
