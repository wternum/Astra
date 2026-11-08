"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Command, Gift, History, Menu, Moon, PlugZap, Shuffle, Sun, Wand2, X } from "lucide-react";
import Optimizer, { type WorkspaceImport } from "@/components/Optimizer";
import BrandMark from "@/components/BrandMark";
import HistoryPanel from "@/components/HistoryPanel";
import KnowledgePanel from "@/components/KnowledgePanel";
import GuidePanel from "@/components/GuidePanel";
import ModelDialog, { type ProviderStatus } from "@/components/ModelDialog";
import CommandPalette, { THEMES, type StudioTheme } from "@/components/CommandPalette";
import type { ModelConfig } from "@/lib/optimizer";

type View = "studio" | "templates" | "history" | "guide";
const NAV: { id: View; label: string; icon: ReactNode }[] = [
  { id: "studio", label: "工作台", icon: <Wand2 size={18} /> },
  { id: "templates", label: "知识库", icon: <BookOpen size={18} /> },
  { id: "history", label: "历史", icon: <History size={18} /> },
  { id: "guide", label: "手册", icon: <BookOpen size={18} /> },
];
const IDEAS = [
  { short: "给我的小店想个名字。", refined: "有受众、有风格、有多个方向的品牌命名任务。", prompt: "为一家主打低糖烘焙的小店想 12 个中文品牌名字。目标顾客是 25–35 岁的城市上班族，希望温暖、好记、不说教。", scenario: "creative", tag: "BRAND / 品牌灵感" },
  { short: "把这个概念讲明白。", refined: "有比喻、有例子、有理解检查的清晰讲解。", prompt: "向没有技术背景的产品经理解释什么是机器学习中的过拟合。先用生活比喻，再给产品推荐系统的例子。", scenario: "learning", tag: "LEARN / 概念拆解" },
  { short: "帮我做个靠谱的计划。", refined: "有阶段、有依赖、有检查点的可执行计划。", prompt: "我想在 6 周内上线一个设计师作品集网站。只有一名前端开发和一名设计师，请制定现实可行的分周计划。", scenario: "work", tag: "BUILD / 行动计划" },
];
const FALLBACK_PROVIDERS: ProviderStatus[] = [
  { id: "pollinations", name: "Pollinations 公共通道", description: "GPT-OSS 20B · 无需密钥", defaultModel: "openai-fast", serverConfigured: true, access: "public", requiresKey: false, limits: "同一 IP 每 45 秒 1 次回复，ASTRA 自动排队。", privacy: "内容会发送至公共第三方服务，请勿输入敏感信息。", docsUrl: "https://github.com/pollinations/pollinations/blob/master/APIDOCS.md" },
  { id: "custom", name: "自定义兼容接口", description: "填写 URL / Key / 模型", defaultModel: "", serverConfigured: false, access: "byok", requiresKey: false, limits: "由第三方服务商决定额度与计费。", privacy: "Key 仅在当前页面内存中使用，不写入数据库。", docsUrl: "https://platform.openai.com/docs/api-reference/models/list" },
];

function InteriorHeading({ title, icon }: { title: string; icon: ReactNode }) {
  return <div className="interior-heading"><div><h1>{title}</h1></div><div className="interior-icon">{icon}</div></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("studio");
  const [incoming, setIncoming] = useState<WorkspaceImport | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>(FALLBACK_PROVIDERS);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState<StudioTheme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [ideaIndex, setIdeaIndex] = useState(0);
  const idea = IDEAS[ideaIndex];

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      try { const saved = localStorage.getItem("promptforge:theme"); setTheme(saved === "dark" || saved === "midnight" ? "dark" : "light"); } catch { setTheme("light"); }
      setThemeReady(true);
    }, 0);
    fetch("/api/model").then(r => r.json()).then(data => {
      if (!Array.isArray(data.providers)) return;
      setProviders(data.providers);
      // Only restore an explicit connection. Do not silently connect on first visit:
      // the hero remains until the user chooses a model.
      let saved: string | null = null;
      try { saved = localStorage.getItem("promptforge:model:v3"); } catch { /* Storage disabled. */ }
      if (!saved || saved === "local") return;
      let choice: { provider?: string; model?: string } | null = null;
      try { choice = saved ? JSON.parse(saved) : null; } catch { return; }
      const preferred = data.providers.find((p: ProviderStatus) => p.id === choice?.provider);
      if (!preferred) return;
      if (preferred.id === "custom") {
        let endpoint: { baseUrl?: string; model?: string } | null = null;
        let sessionKey = "";
        try { endpoint = JSON.parse(localStorage.getItem("promptforge:custom-endpoint:v1") || "null"); sessionKey = sessionStorage.getItem("astra:custom-key") || ""; } catch { /* optional */ }
        if (endpoint?.baseUrl && (choice?.model || endpoint.model)) {
          setModelConfig({ provider: "custom", model: choice?.model || endpoint.model || "", baseUrl: endpoint.baseUrl, apiKey: sessionKey || undefined });
          setModelReady(true);
        }
        return;
      }
      setModelConfig({ provider: preferred.id, model: choice?.model || preferred.defaultModel });
      setModelReady(true);
    }).catch(() => {});
    fetch("/api/history").then(r => r.json()).then(data => { if (Array.isArray(data)) setHistoryCount(data.length); }).catch(() => {});
    const syncAppearance = (event: StorageEvent) => {
      if (event.key !== "promptforge:theme") return;
      setTheme(event.newValue === "dark" || event.newValue === "midnight" ? "dark" : "light");
    };
    window.addEventListener("storage", syncAppearance);
    return () => { window.clearTimeout(preferenceTimer); window.removeEventListener("storage", syncAppearance); };
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; if (!themeReady) return; try { localStorage.setItem("promptforge:theme", theme); } catch { /* Optional preference. */ } }, [theme, themeReady]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setModelOpen(false); setPaletteOpen(v => !v); }
      if (event.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navigate = useCallback((next: View) => { setView(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const loadIntoStudio = useCallback((draft: Omit<WorkspaceImport, "id">) => { setIncoming({ ...draft, id: Date.now() + Math.random() }); navigate("studio"); }, [navigate]);
  const useStarter = useCallback((prompt: string, scenario: string) => loadIntoStudio({ prompt, scenario }), [loadIntoStudio]);
  const openModel = useCallback(() => { setPaletteOpen(false); setModelOpen(true); }, []);
  const closeModel = useCallback(() => setModelOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const changeTheme = useCallback((next: StudioTheme) => setTheme(next), []);
  const connectModel = (config: ModelConfig) => { setModelConfig(config); setModelReady(true); setModelOpen(false); try { localStorage.setItem("promptforge:model:v3", JSON.stringify({ provider: config.provider, model: config.model })); if (config.provider === "custom") { localStorage.setItem("promptforge:custom-endpoint:v1", JSON.stringify({ baseUrl: config.baseUrl, model: config.model })); if (config.apiKey) sessionStorage.setItem("astra:custom-key", config.apiKey); else sessionStorage.removeItem("astra:custom-key"); } } catch { /* Keys never enter storage. */ } };
  const disconnectModel = () => { setModelConfig(null); setModelReady(false); setModelOpen(false); try { localStorage.setItem("promptforge:model:v3", "local"); sessionStorage.removeItem("astra:custom-key"); } catch { /* Optional preference. */ } };
  const isPublic = modelConfig?.provider === "pollinations";
  const workspaceReady = modelReady && Boolean(modelConfig);
  const openKnowledge = useCallback(() => navigate("templates"), [navigate]);

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand"><button type="button" className="brand-home" onClick={() => navigate("studio")} aria-label="ASTRA · 返回工作台"><BrandMark /><span className="brand-wordmark"><strong className="astra-wordmark">ASTRA</strong></span></button><button className="sidebar-close" onClick={() => setMobileMenu(false)} aria-label="关闭菜单"><X size={18} /></button></div>
        <div className="sidebar-nav-area"><nav className="sidebar-nav" aria-label="主导航">{NAV.map(item => <button key={item.id} className={`sidebar-nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><span className="nav-icon">{item.icon}</span><span className="nav-text"><strong>{item.label}</strong></span>{item.id === "history" && historyCount ? <span className="nav-count">{historyCount}</span> : null}</button>)}</nav><button className="sidebar-command" onClick={() => setPaletteOpen(true)}><Command size={15} /><span>快捷操作</span><kbd>⌘ K</kbd></button></div>
        <div className="sidebar-bottom"><button className="sidebar-connection" onClick={openModel}><span className={`connection-indicator ${modelConfig ? "connected" : ""}`} /><span>{modelConfig ? isPublic ? "免费模型已连接" : "模型已连接" : "本地模式"}</span><ArrowUpRight size={15} /></button></div>
      </aside>
      {mobileMenu && <div className="mobile-backdrop" onClick={() => setMobileMenu(false)} />}
      <div className="app-main">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu-btn" onClick={() => setMobileMenu(true)} aria-label="打开菜单"><Menu size={21} /></button><span className="topbar-brand"><BrandMark compact /><strong className="astra-wordmark astra-wordmark--compact">ASTRA</strong></span><strong className="topbar-view-label">{NAV.find(n => n.id === view)?.label}</strong></div><div className="topbar-right"><div className="theme-picker theme-mode-switch" role="group" aria-label="外观模式">{THEMES.map(item => <button key={item.id} type="button" className={`theme-mode-button ${theme === item.id ? "active" : ""}`} onClick={() => changeTheme(item.id)} title={`${item.name}模式`} aria-label={`切换为${item.name}模式`} aria-pressed={theme === item.id}>{item.id === "dark" ? <Moon size={15} /> : <Sun size={15} />}</button>)}</div><button className="topbar-command" onClick={() => setPaletteOpen(true)} title="快捷操作 Ctrl / ⌘ K" aria-label="打开快捷操作"><Command size={16} /><span>K</span></button><button className={`topbar-model ${isPublic ? "free-connected" : modelConfig ? "is-connected" : ""}`} onClick={openModel}>{isPublic ? <Gift size={16} /> : <PlugZap size={16} />}<span>{isPublic ? "免费 AI" : modelConfig ? modelConfig.model : "连接模型"}</span><ArrowUpRight size={14} /></button></div></header>
        <main className={`content-wrap ${workspaceReady ? "connected-workspace" : ""}`}>
          <div style={{ display: view === "studio" ? "block" : "none" }}>
            {!workspaceReady && <>
              <section className="hero-panel"><div className="hero-grid-pattern" /><div className="hero-copy"><h1>让想法，<br /><span>清晰成形</span>。</h1><p>说一句话就够了。系统自动读懂方向与层面，直接写成可用的提示词。</p><div className="hero-actions"><button className="hero-start" onClick={() => { document.getElementById("goal")?.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => document.getElementById("goal")?.focus(), 350); }}>开始优化 <ArrowRight size={17} /></button><button className="hero-connect" onClick={openModel}>连接模型 <PlugZap size={15} /></button></div></div><div className="hero-collage"><div className="hero-idea-card"><div className="hero-idea-top"><span>示例</span><button onClick={() => setIdeaIndex(i => (i + 1) % IDEAS.length)} aria-label="换一个示例"><Shuffle size={15} /> 换一个</button></div><p key={idea.short}>{idea.short}</p><button className="hero-idea-use" onClick={() => loadIntoStudio({ prompt: idea.prompt, scenario: idea.scenario })}>使用示例 <ArrowUpRight size={15} /></button></div></div></section>
              <div className="workspace-heading"><div><h2>一句话，直接优化</h2></div></div>
            </>}
            <Optimizer incoming={incoming} modelConfig={modelConfig} onOpenModel={openModel} onOpenKnowledge={openKnowledge} onGenerated={() => setHistoryCount(old => (old ?? 0) + 1)} />
          </div>
          {view === "templates" && <div className="interior-page kg-interior-page"><KnowledgePanel onUseKnowledge={useStarter} /></div>}
          {view === "history" && <div className="interior-page"><InteriorHeading title="历史" icon={<History size={35} />} /><HistoryPanel onRestore={loadIntoStudio} onCountChange={setHistoryCount} /></div>}
          {view === "guide" && <div className="interior-page"><InteriorHeading title="手册" icon={<BookOpen size={35} />} /><GuidePanel onUsePrompt={useStarter} /></div>}
        </main>
        <footer className="site-footer"><span>ASTRA</span></footer>
      </div>
      <ModelDialog open={modelOpen} onClose={closeModel} onConnect={connectModel} onDisconnect={disconnectModel} current={modelConfig} providers={providers} />
      <CommandPalette key={paletteOpen ? "palette-open" : "palette-closed"} open={paletteOpen} onClose={closePalette} onNavigate={navigate} onUsePrompt={useStarter} onOpenModel={openModel} onTheme={changeTheme} theme={theme} />
    </div>
  );
}
