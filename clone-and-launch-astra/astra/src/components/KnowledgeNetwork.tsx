"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, Panel, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, useNodesState, useNodesInitialized, useReactFlow, type Node, type NodeProps, type Edge, type EdgeProps } from "@xyflow/react";
import { ArrowUpRight, BookOpen, ChevronRight, FileText, FolderOpen, Hash, LayoutGrid, Maximize, Minimize, Minus, MousePointer2, Move, Plus, Scan, Sparkles, X } from "lucide-react";
import { paletteForEntry } from "@/lib/knowledge-palette";
import { neighborhood, type KnowledgeGraph, type GraphNode, type GraphEdge } from "@/lib/knowledge-graph";
import { CARD_HEIGHT, CARD_WIDTH } from "@/lib/knowledge-layout";
import "@xyflow/react/dist/style.css";

type Point = { x: number; y: number };
export type DraftPreview = { key: string; name: string; category: string; position?: Point; relatedId?: number };
type NodeData = { node: GraphNode; accent: string; active: boolean; dimmed: boolean; draft?: boolean } & Record<string, unknown>;
type FlowNode = Node<NodeData, "knowledge">;
const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];
const STORAGE_KEY = "astra:knowledge:node-positions:v2";
type SavedLayouts = Record<string, Record<string, Point>>;
function readLayouts(): SavedLayouts {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const result: SavedLayouts = {};
    Object.entries(raw).slice(-50).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      result[key] = {};
      Object.entries(value).forEach(([id, point]) => {
        const p = point as Point;
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) result[key][id] = p;
      });
    });
    return result;
  } catch { return {}; }
}
const colorFor = (node: GraphNode) => node.accent || paletteForEntry(node.entry || { category: node.category }).colors.accent;
function Handles() {
  return <>{SIDES.flatMap(side => [<Handle key={`s-${side}`} id={`s-${side}`} type="source" position={side} isConnectable={false} />, <Handle key={`t-${side}`} id={`t-${side}`} type="target" position={side} isConnectable={false} />])}</>;
}
function KnowledgeNode({ data, selected }: NodeProps<FlowNode>) {
  const { node, accent, draft, active, dimmed } = data;
  const entry = node.entry;
  return <div className={`kn-node kn-node-${node.kind} ${selected || active ? "is-active" : ""} ${dimmed ? "is-dimmed" : ""} ${draft ? "is-draft" : ""}`} style={{ "--node-accent": accent } as CSSProperties}>
    <Handles />
    {node.kind === "entry" ? <>
      <div className="kn-node-heading"><span className="kn-node-icon">{draft ? <Sparkles size={17} /> : <FileText size={17} />}</span><strong title={node.label}>{node.label}</strong>{!draft && <ArrowUpRight className="kn-node-open" size={13} />}</div>
      <div className="kn-node-meta"><span><i />{node.category || "通用"}</span><small>{draft ? "草稿预览" : entry?.enabled === false ? "已停用" : entry?.isBuiltin ? "内置示例" : "知识节点"}</small></div>
      <div className="kn-node-tags">{draft ? <span>保存后加入当前知识网</span> : (entry?.tags || []).slice(0, 3).map(tag => <span key={tag}>#{tag}</span>)}{!draft && !entry?.tags?.length && <span>点击查看知识内容</span>}</div>
    </> : <><span className="kn-node-icon">{node.kind === "topic" ? <Hash size={17} /> : <FolderOpen size={17} />}</span><div><strong>{node.label}</strong><small>{node.count || 0} 条知识 · 点击展开</small></div><ChevronRight size={14} /></>}
  </div>;
}
function KnowledgeEdge(props: EdgeProps) {
  const data = props.data as { edge: GraphEdge; active: boolean; dimmed: boolean };
  const structural = data.edge.kind === "contains" || data.edge.kind === "topic";
  const [path, x, y] = structural ? getSmoothStepPath({ ...props, borderRadius: 14, offset: 28 }) : getBezierPath({ ...props, curvature: 0.22 });
  const color = data.edge.kind === "depends_on" ? "#bc965d" : data.edge.kind === "references" ? "#9275c3" : "#c3b5d8";
  return <><BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} interactionWidth={18} style={{ stroke: data.active ? "#8b6bc4" : color, strokeWidth: data.active ? 2 : 1.3, opacity: data.dimmed ? 0.22 : 0.8, strokeDasharray: data.edge.kind === "shared" ? "4 5" : undefined }} />{data.active && <EdgeLabelRenderer><div className="kn-edge-label" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}>{data.edge.label}</div></EdgeLabelRenderer>}</>;
}
const nodeTypes = { knowledge: KnowledgeNode };
const edgeTypes = { knowledge: KnowledgeEdge };
const motionDuration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;

function NetworkInner({ graph, viewKey, selectedId, selectedEdgeId, onSelect, onEdgeSelect, onCategory, onTag, onFocus, centerSignal, onCreate, onClearSelection, navigation, navigationOpen, onCloseNavigation, toolbar, dock, draft, matchedIds, onReset }: {
  graph: KnowledgeGraph; viewKey: string; selectedId: number | null; selectedEdgeId: string | null;
  onSelect: (id: number) => void; onEdgeSelect: (edge: GraphEdge) => void; onCategory: (category: string) => void; onTag: (tag: string) => void; onFocus: (id: string) => void;
  centerSignal: number; onCreate: (point?: Point) => void; onClearSelection: () => void;
  navigation: ReactNode; navigationOpen: boolean; onCloseNavigation: () => void; toolbar: ReactNode; dock?: ReactNode; draft?: DraftPreview | null; matchedIds?: number[] | null; onReset: () => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [arrangement, setArrangement] = useState(0);
  const [layoutNotice, setLayoutNotice] = useState(false);
  const [menu, setMenu] = useState<{ screen: Point; flow: Point } | null>(null);
  const [initialLayouts] = useState(readLayouts);
  const layouts = useRef(initialLayouts);
  const viewport = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const previousLayoutKey = useRef("");
  const pendingFit = useRef(true);
  const lastReveal = useRef(0);
  const draftLocation = useRef<{ key: string; point: Point } | null>(null);
  const revealDraftKey = useRef("");
  const current = useRef({ selectedId, dock: Boolean(dock), graph });
  current.current = { selectedId, dock: Boolean(dock), graph };
  const { getNodes, getViewport, setViewport, screenToFlowPosition, zoomIn, zoomOut, zoomTo } = useReactFlow<FlowNode>();
  const nodesInitialized = useNodesInitialized();
  const signature = graph.nodes.map(node => node.id).join("|");
  const layoutKey = `${viewKey}|${signature}|${arrangement}`;

  const fitGraph = useCallback(() => {
    const element = viewport.current;
    const list = getNodes().filter(node => !node.data.draft);
    if (!element || !list.length) return;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const node of list) {
      left = Math.min(left, node.position.x); top = Math.min(top, node.position.y);
      right = Math.max(right, node.position.x + (node.measured?.width || CARD_WIDTH));
      bottom = Math.max(bottom, node.position.y + (node.measured?.height || CARD_HEIGHT));
    }
    const width = element.clientWidth, height = element.clientHeight;
    const usableW = Math.max(120, width - 70), usableH = Math.max(120, height - 118);
    const scale = Math.max(0.12, Math.min(1, usableW / Math.max(right - left, 1), usableH / Math.max(bottom - top, 1)));
    void setViewport({ x: width / 2 - (left + right) / 2 * scale, y: 52 + usableH / 2 - (top + bottom) / 2 * scale, zoom: scale }, { duration: motionDuration() });
  }, [getNodes, setViewport]);
  const revealNode = useCallback((id: string, center = false) => {
    const element = viewport.current, node = getNodes().find(item => item.id === id);
    if (!element || !node) return;
    const currentViewport = getViewport();
    const scale = center ? Math.max(0.8, Math.min(1, currentViewport.zoom)) : currentViewport.zoom;
    const w = node.measured?.width || CARD_WIDTH, h = node.measured?.height || CARD_HEIGHT;
    if (center) {
      void setViewport({ zoom: scale, x: element.clientWidth / 2 - (node.position.x + w / 2) * scale, y: element.clientHeight / 2 - (node.position.y + h / 2) * scale }, { duration: motionDuration() });
      return;
    }
    const left = node.position.x * scale + currentViewport.x, top = node.position.y * scale + currentViewport.y;
    const right = left + w * scale, bottom = top + h * scale;
    const dx = left < 24 ? 24 - left : right > element.clientWidth - 24 ? element.clientWidth - 24 - right : 0;
    const dy = top < 48 ? 48 - top : bottom > element.clientHeight - 60 ? element.clientHeight - 60 - bottom : 0;
    if (dx || dy) void setViewport({ ...currentViewport, x: currentViewport.x + dx, y: currentViewport.y + dy }, { duration: motionDuration() });
  }, [getNodes, getViewport, setViewport]);

  useEffect(() => {
    const changed = previousLayoutKey.current !== layoutKey;
    if (changed) { previousLayoutKey.current = layoutKey; pendingFit.current = true; setHovered(null); }
    const saved = layouts.current[viewKey] || {};
    setNodes(old => [...graph.nodes.map(node => {
      const previous = !changed ? old.find(item => item.id === node.id) : undefined;
      return { id: node.id, type: "knowledge" as const, position: previous?.position || saved[node.id] || node.position,
        data: { node, accent: colorFor(node), active: false, dimmed: false }, selected: node.id === `entry:${current.current.selectedId}`,
        style: { width: node.kind === "entry" ? CARD_WIDTH : 176 }, draggable: true,
        ariaLabel: `${node.kind === "entry" ? "知识" : "标签"}：${node.label}` };
    }), ...old.filter(node => node.data.draft)]);
  }, [graph, layoutKey, viewKey, setNodes]);
  useEffect(() => {
    if (!nodesInitialized || !pendingFit.current) return;
    const timer = window.setTimeout(() => { pendingFit.current = false; fitGraph(); }, 80);
    return () => window.clearTimeout(timer);
  }, [nodesInitialized, layoutKey, fitGraph]);

  // A draft updates in place. Typing never repositions the graph or changes zoom.
  useEffect(() => {
    if (draft && draftLocation.current?.key !== draft.key) {
      const element = viewport.current;
      const rect = element?.getBoundingClientRect();
      let point = draft.position || (rect ? screenToFlowPosition({ x: rect.left + rect.width / 2 - 100, y: rect.top + rect.height / 2 }) : { x: 0, y: 0 });
      if (!draft.position) {
        const occupied = getNodes().filter(node => !node.data.draft);
        for (let attempt = 0; attempt < 30; attempt++) {
          if (!occupied.some(node => point.x < node.position.x + CARD_WIDTH + 16 && point.x + CARD_WIDTH + 16 > node.position.x && point.y < node.position.y + CARD_HEIGHT + 16 && point.y + CARD_HEIGHT + 16 > node.position.y)) break;
          point = { x: point.x, y: point.y + 148 };
        }
      }
      draftLocation.current = { key: draft.key, point };
    }
    setNodes(old => {
      const base = old.filter(node => node.id !== "draft:new");
      if (!draft || !draftLocation.current) return base;
      const point = draftLocation.current.point;
      return [...base, { id: "draft:new", type: "knowledge" as const, position: point, draggable: true,
        data: { node: { id: "draft:new", kind: "entry" as const, label: draft.name.trim() || "新的知识节点", category: draft.category || "通用", position: point }, accent: "#9272c6", active: true, dimmed: false, draft: true }, style: { width: CARD_WIDTH } }];
    });
  }, [draft, graph, screenToFlowPosition, getNodes, setNodes]);
  useEffect(() => {
    if (!draft || !nodesInitialized || revealDraftKey.current === draft.key) return;
    revealDraftKey.current = draft.key;
    const timer = window.setTimeout(() => revealNode("draft:new"), 320);
    return () => window.clearTimeout(timer);
  }, [draft?.key, nodesInitialized, revealNode]);

  const activeId = hovered || (selectedId === null ? null : `entry:${selectedId}`);
  const adjacent = useMemo(() => neighborhood(graph, hovered), [graph, hovered]);
  useEffect(() => {
    const matches = matchedIds ? new Set(matchedIds.map(id => `entry:${id}`)) : null;
    setNodes(old => old.map(node => ({ ...node, selected: node.id === `entry:${selectedId}`,
      data: { ...node.data, active: node.id === activeId || !!matches?.has(node.id) || !!node.data.draft,
        dimmed: !node.data.draft && (matches ? !matches.has(node.id) : !!hovered && !adjacent.has(node.id)) } })));
  }, [activeId, adjacent, selectedId, hovered, matchedIds, graph, setNodes]);
  useEffect(() => {
    if (!centerSignal || lastReveal.current === centerSignal || selectedId === null || !nodesInitialized) return;
    if (!getNodes().some(node => node.id === `entry:${selectedId}`)) return;
    const timer = window.setTimeout(() => { lastReveal.current = centerSignal; revealNode(`entry:${selectedId}`, true); }, 360);
    return () => window.clearTimeout(timer);
  }, [centerSignal, selectedId, nodesInitialized, layoutKey, getNodes, revealNode]);
  // Resizing a dock preserves zoom and the graph's centre, instead of repeatedly fitting.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let previous = { width: element.clientWidth, height: element.clientHeight };
    let timer = 0;
    const observer = new ResizeObserver(() => {
      const size = { width: element.clientWidth, height: element.clientHeight };
      const dx = (size.width - previous.width) / 2, dy = (size.height - previous.height) / 2;
      previous = size;
      if (pendingFit.current || (!dx && !dy)) return;
      const currentViewport = getViewport();
      void setViewport({ ...currentViewport, x: currentViewport.x + dx, y: currentViewport.y + dy });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (current.current.selectedId !== null) revealNode(`entry:${current.current.selectedId}`); }, 70);
    });
    observer.observe(element);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [getViewport, setViewport, revealNode]);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !current.current.dock) setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [expanded]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest(".kn-context-menu")) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [menu]);
  useEffect(() => { if (!layoutNotice) return; const timer = window.setTimeout(() => setLayoutNotice(false), 2300); return () => window.clearTimeout(timer); }, [layoutNotice]);
  const arrange = () => {
    delete layouts.current[viewKey];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts.current)); } catch { /* Storage can be disabled. */ }
    setArrangement(value => value + 1); setLayoutNotice(true);
  };
  const edges = useMemo<Edge[]>(() => {
    const positions = new Map(nodes.map(node => [node.id, node]));
    const list = [...graph.edges];
    if (draft?.relatedId && graph.nodes.some(node => node.id === `entry:${draft.relatedId}`)) list.push({ id: "draft:relation", source: "draft:new", target: `entry:${draft.relatedId}`, kind: "references", label: "待保存的参考关系", evidence: [], sourceIds: [], origin: "用户标注" });
    return list.map(edge => {
      const source = positions.get(edge.source), target = positions.get(edge.target);
      const sw = Number(source?.style?.width) || CARD_WIDTH, tw = Number(target?.style?.width) || CARD_WIDTH;
      const sourcePosition = source?.position || { x: 0, y: 0 }, targetPosition = target?.position || { x: 0, y: 0 };
      const dx = targetPosition.x + tw / 2 - (sourcePosition.x + sw / 2), dy = targetPosition.y - sourcePosition.y;
      const horizontal = edge.kind === "contains" || edge.kind === "topic" || Math.abs(dx) > Math.abs(dy) * 1.2;
      const from = horizontal ? (dx >= 0 ? Position.Right : Position.Left) : (dy >= 0 ? Position.Bottom : Position.Top);
      const to = horizontal ? (dx >= 0 ? Position.Left : Position.Right) : (dy >= 0 ? Position.Top : Position.Bottom);
      const active = edge.id === selectedEdgeId || !!activeId && (edge.source === activeId || edge.target === activeId);
      const directed = edge.kind === "references" || edge.kind === "depends_on";
      return { id: edge.id, type: "knowledge", source: edge.source, target: edge.target, sourceHandle: `s-${from}`, targetHandle: `t-${to}`,
        markerEnd: directed ? { type: "arrowclosed" as const, width: 13, height: 13, color: "#a58abd" } : undefined,
        data: { edge, active, dimmed: !!activeId && !active }, zIndex: active ? 2 : 0 };
    });
  }, [nodes, graph.edges, graph.nodes, selectedEdgeId, activeId, draft?.key, draft?.relatedId]);
  const entryCount = graph.nodes.filter(node => node.kind === "entry").length;
  return <div ref={root} className={`kn-board ${navigationOpen ? "has-navigation" : ""} ${expanded ? "is-fullscreen" : ""}`}>
    {navigationOpen && <><button className="kn-nav-scrim" onClick={onCloseNavigation} aria-label="关闭标签导航" /><aside className="kn-sidebar nowheel nopan">{navigation}</aside></>}
    <div className="kn-main">
      <div className="kn-toolbar nowheel nopan">{toolbar}</div>
      <div className={`kn-content ${dock ? "has-dock" : ""}`}>
        <div ref={viewport} className="kn-viewport" onDoubleClick={event => {
          if ((event.target as Element).closest(".react-flow__node, .react-flow__edge, .react-flow__panel, button, input, .kn-context-menu")) return;
          onCreate(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}>
          <ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
            onNodeClick={(_, node) => { if (node.data.draft) return; const item = node.data.node; if (item.entry) onSelect(item.entry.id); else if (item.kind === "topic") onTag(item.label); else onCategory(item.category); }}
            onNodeDoubleClick={(_, node) => { if (node.data.node.entry) onFocus(node.id); }}
            onNodeMouseEnter={(_, node) => setHovered(node.id)} onNodeMouseLeave={() => setHovered(null)}
            onNodeDragStop={(_, node) => {
              if (node.data.draft) { if (draftLocation.current) draftLocation.current.point = node.position; return; }
              layouts.current[viewKey] = { ...layouts.current[viewKey], [node.id]: node.position };
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts.current)); } catch { /* Layout remains available in this session. */ }
            }}
            onEdgeClick={(_, edge) => { const item = graph.edges.find(candidate => candidate.id === edge.id); if (item) onEdgeSelect(item); }}
            onPaneClick={() => { setMenu(null); onClearSelection(); }}
            onPaneContextMenu={event => {
              event.preventDefault(); const rect = viewport.current?.getBoundingClientRect(); if (!rect) return;
              setMenu({ screen: { x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 205)), y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 105)) }, flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
            }}
            onMove={(_, value) => setZoom(value.zoom)}
            minZoom={0.12} maxZoom={2.5} zoomOnScroll zoomOnPinch panOnDrag panOnScroll={false} preventScrolling zoomOnDoubleClick={false}
            nodesDraggable nodeDragThreshold={5} nodesConnectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
            noWheelClassName="nowheel" noDragClassName="nodrag" noPanClassName="nopan" proOptions={{ hideAttribution: false }} attributionPosition="bottom-right"
            aria-label="知识网：滚轮直接缩放，拖动空白平移，拖动卡片移动节点，双击空白新建">
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--kn-dot)" />
            <Panel position="top-left"><div className="kn-map-caption"><span className="kn-live-dot" /><span>{entryCount} 个知识节点</span><i />{graph.edges.filter(edge => edge.kind !== "contains").length} 条关联</div></Panel>
            <Panel position="bottom-left"><div className="kn-map-controls">
              <button onClick={() => void zoomOut({ duration: 180 })} aria-label="缩小图谱" title="缩小"><Minus size={16} /></button>
              <button className="kn-zoom-value" onClick={() => void zoomTo(1, { duration: motionDuration() })} aria-label="恢复百分之百缩放" title="恢复 100%">{Math.round(zoom * 100)}%</button>
              <button onClick={() => void zoomIn({ duration: 180 })} aria-label="放大图谱" title="放大"><Plus size={16} /></button><i />
              <button onClick={fitGraph} aria-label="适应画布" title="适应画布"><Scan size={16} /></button>
              <button onClick={arrange} aria-label="重新整理节点布局" title="恢复规则排列"><LayoutGrid size={16} /></button>
              <button onClick={() => setExpanded(value => !value)} aria-label={expanded ? "退出全屏" : "全屏知识网"} title={expanded ? "退出全屏" : "全屏知识网"}>{expanded ? <Minimize size={16} /> : <Maximize size={16} />}</button>
            </div></Panel>
            {!dock && <MiniMap pannable zoomable position="bottom-right" nodeColor={node => colorFor((node as FlowNode).data.node)} maskColor="var(--kn-minimap-mask)" style={{ width: 112, height: 68, marginBottom: 24 }} ariaLabel="知识网缩略导航" />}
          </ReactFlow>
          <div className="kn-gesture-hint"><MousePointer2 size={12} />滚轮缩放<span>·</span><Move size={12} />拖拽移动</div>
          {layoutNotice && <div className="kn-layout-notice" role="status"><LayoutGrid size={14} />已恢复规则排列</div>}
          {menu && <div className="kn-context-menu nowheel nopan" style={{ left: menu.screen.x, top: menu.screen.y }} role="menu" aria-label="画布操作"><button role="menuitem" onClick={() => { const point = menu.flow; setMenu(null); onCreate(point); }}><Plus size={15} />在这里新建知识</button><button role="menuitem" onClick={() => { setMenu(null); arrange(); }}><LayoutGrid size={15} />整理当前布局</button></div>}
          {!graph.nodes.length && !draft && <div className="kn-map-empty"><span><BookOpen size={28} /></span><h3>让这个标签下的知识开始生长</h3><p>在画布内新建节点，分类和关键词会自动连接知识。</p><button className="kg-button kg-primary" onClick={() => onCreate()}><Plus size={15} />新建知识</button><button className="kg-text-button" onClick={onReset}>查看全部知识</button></div>}
        </div>
        {dock && <div className="kn-dock nowheel nopan nodrag">{dock}</div>}
      </div>
    </div>
    {expanded && <button className="kn-fullscreen-close" onClick={() => setExpanded(false)} title="退出全屏" aria-label="关闭全屏视图"><X size={15} /></button>}
  </div>;
}
export default function KnowledgeNetwork(props: Parameters<typeof NetworkInner>[0]) {
  return <ReactFlowProvider><NetworkInner {...props} /></ReactFlowProvider>;
}
