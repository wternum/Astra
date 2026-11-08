"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, Panel, Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, useNodesState, useReactFlow, type Node, type NodeProps, type Edge, type EdgeProps } from "@xyflow/react";
import { BookOpen, Compass, Database, FileText, Focus, Hash, LayoutTemplate, Maximize, Minimize, Minus, Orbit, PenTool, Plus, RotateCcw, Tags } from "lucide-react";

const LIBRARY_ICONS: Record<string, typeof Compass> = { compass: Compass, layout: LayoutTemplate, database: Database, pen: PenTool };
import { paletteForEntry } from "@/lib/knowledge-palette";
import { neighborhood, RELATION_LABELS, type KnowledgeGraph, type GraphNode, type GraphEdge } from "@/lib/knowledge-graph";
import "@xyflow/react/dist/style.css";

type KnowledgeFlowNode = Node<{ node: GraphNode; accent: string; active: boolean; dimmed: boolean; onFocus: (id: string) => void }, "knowledge">;
const positions = [Position.Top, Position.Right, Position.Bottom, Position.Left];
function KnowledgeNode({ data, selected }: NodeProps<KnowledgeFlowNode>) {
  const { node, accent, active, dimmed } = data;
  return <div className={`kg-flow-node kg-flow-${node.kind} ${selected || active ? "is-active" : ""} ${dimmed ? "is-dimmed" : ""}`} style={{ "--node-accent": accent } as React.CSSProperties} title={node.label}>
    {/* Handles are absolutely positioned, so they must not become flex items. */}
    {positions.map(position => [<Handle key={`s-${position}`} id={`s-${position}`} type="source" position={position} isConnectable={false} />, <Handle key={`t-${position}`} id={`t-${position}`} type="target" position={position} isConnectable={false} />])}
    {node.kind === "entry" ? <><span className="kg-flow-icon"><FileText size={17} /></span><div><strong>{node.label}</strong><small><i />{node.category}<span>{node.entry?.enabled === false ? "已停用" : node.entry?.isBuiltin ? "示例" : "知识"}</span></small></div></>
      : node.kind === "category" ? <><BookOpen size={15} /><strong>{node.label}</strong><span>分类</span></>
      : node.kind === "core" ? <><div className="kg-orbit-decor" aria-hidden="true"><i className="kg-orbit-ring kg-ring-1" /><i className="kg-orbit-ring kg-ring-2" /><i className="kg-orbit-ring kg-ring-3" /><i className="kg-orbit-sweep" /></div><span className="kg-core-icon"><Orbit size={17} /></span><div><strong>{node.label}</strong><small>{node.tagline}</small></div></>
      : node.kind === "library" ? <><span className="kg-library-icon">{(() => { const Icon = LIBRARY_ICONS[node.icon || "compass"] || Compass; return <Icon size={22} />; })()}</span><div><strong>{node.label}</strong><small>{node.tagline}</small></div><em>{node.count ?? 0}<span>条</span></em><i className="kg-library-orbit" aria-hidden="true" /></>
      : <><Hash size={15} /><strong>{node.label}</strong></>}
  </div>;
}
function KnowledgeEdge(props: EdgeProps) {
  const data = props.data as { edge: GraphEdge; active: boolean; dimmed: boolean; showLabel: boolean };
  const [path, x, y] = getBezierPath({ ...props, curvature: 0.28 });
  const color = data.edge.kind === "hub" ? "#b6a4d8" : data.edge.kind === "depends_on" ? "#c18a43" : data.edge.kind === "references" ? "#8270cc" : data.edge.kind === "contains" ? "#c8c5d1" : "#a39ab8";
  return <><BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} interactionWidth={22} style={{ stroke: data.active ? "#8064c4" : color, strokeWidth: data.active ? 2 : 1.35, strokeDasharray: data.edge.kind === "shared" ? "5 5" : data.edge.kind === "contains" ? "3 5" : undefined, opacity: data.dimmed ? 0.2 : 0.85 }} />{data.showLabel && <EdgeLabelRenderer><div className={`kg-edge-label nodrag nopan ${data.active ? "active" : ""}`} style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)`, opacity: data.dimmed ? 0.3 : 1 }}>{data.edge.label}</div></EdgeLabelRenderer>}</>;
}
const nodeTypes = { knowledge: KnowledgeNode };
const edgeTypes = { knowledge: KnowledgeEdge };
const colorFor = (node: GraphNode) => node.kind === "topic" ? "#9b83cc" : paletteForEntry(node.entry || { category: node.category }).colors.accent;

function NetworkInner({ graph, selectedId, selectedEdgeId, onSelect, onEdgeSelect, onCategory, onTag, onFocus, layout, centerSignal, onOpenLibrary, onBackToHub }: {
  graph: KnowledgeGraph; selectedId: number | null; selectedEdgeId: string | null;
  onSelect: (id: number) => void; onEdgeSelect: (edge: GraphEdge) => void; onCategory: (category: string) => void;
  onTag: (tag: string) => void; onFocus: (id: string) => void; layout: string; centerSignal: number;
  onOpenLibrary?: (id: string) => void; onBackToHub?: () => void;
}) {
  const isHub = graph.nodes.some(node => node.kind === "library");
  const [nodes, setNodes, onNodesChange] = useNodesState<KnowledgeFlowNode>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const { fitView, zoomIn, zoomOut } = useReactFlow<KnowledgeFlowNode>();
  const [compact, setCompact] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const savedPositions = useRef(new Map<string, { x: number; y: number }>());
  const previousLayout = useRef(layout);
  const fitContext = useRef({ graph, selectedId });
  fitContext.current = { graph, selectedId };
  const activeId = hovered || (selectedId ? `entry:${selectedId}` : selectedEdgeId ? null : null);
  const adjacent = useMemo(() => neighborhood(graph, hovered), [graph, hovered]);
  const fitAll = useCallback(() => { void fitView({ padding: 0.2, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350, maxZoom: 0.95 }); }, [fitView]);
  const fit = useCallback(() => {
    const width = wrapper.current?.clientWidth || 0;
    const current = fitContext.current;
    // On phones, fitting every node makes labels unreadable. Focus the current
    // knowledge instead; the minimap and “适应画布” keep the global context.
    const wanted = current.selectedId ? `entry:${current.selectedId}` : current.graph.nodes.find(node => node.kind === "entry")?.id || null;
    const target = width < 520 && wanted && current.graph.nodes.some(node => node.id === wanted) ? [{ id: wanted }] : undefined;
    void fitView({ nodes: target, padding: target ? 0.14 : 0.2,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350, maxZoom: target ? 1 : 0.95 });
  }, [fitView]);
  useEffect(() => {
    if (previousLayout.current !== layout) { savedPositions.current.clear(); previousLayout.current = layout; }
    setNodes(graph.nodes.map(node => ({ id: node.id, type: "knowledge", position: savedPositions.current.get(node.id) || node.position,
      data: { node, accent: colorFor(node), active: false, dimmed: false, onFocus }, ariaLabel: `${node.kind === "entry" ? "知识" : node.kind === "topic" ? "关键词" : "分类"}：${node.label}`,
      style: { width: node.kind === "entry" ? 190 : node.kind === "library" ? 240 : node.kind === "core" ? 178 : 150 }, draggable: true, selected: node.id === `entry:${selectedId}` })));
    const timer = window.setTimeout(fit, 90);
    return () => window.clearTimeout(timer);
  }, [graph, layout, onFocus, setNodes, fit]);
  useEffect(() => {
    setNodes(old => old.map(node => ({ ...node, selected: node.id === `entry:${selectedId}`, data: { ...node.data, active: node.id === activeId, dimmed: Boolean(hovered && !adjacent.has(node.id)) } })));
  }, [activeId, adjacent, selectedId, setNodes]);
  useEffect(() => {
    if (!centerSignal || !selectedId) return;
    const timer = window.setTimeout(() => { void fitView({ nodes: [{ id: `entry:${selectedId}` }], padding: 0.8, maxZoom: 1.1, duration: 350 }); }, 100);
    return () => window.clearTimeout(timer);
  }, [centerSignal, selectedId, fitView]);
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    let timer = 0;
    const observer = new ResizeObserver(entries => { setCompact((entries[0]?.contentRect.width || 0) < 520); window.clearTimeout(timer); timer = window.setTimeout(fit, 140); });
    observer.observe(element);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [fit]);
  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", escape);
    const timer = window.setTimeout(fit, 100);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); window.clearTimeout(timer); };
  }, [expanded, fit]);
  const edges = useMemo<Edge[]>(() => graph.edges.map(edge => {
    const source = graph.nodes.find(node => node.id === edge.source);
    const target = graph.nodes.find(node => node.id === edge.target);
    const dx = (target?.position.x || 0) - (source?.position.x || 0);
    const dy = (target?.position.y || 0) - (source?.position.y || 0);
    const vertical = Math.abs(dy) > Math.abs(dx);
    const side = vertical ? (dy > 0 ? Position.Bottom : Position.Top) : (dx > 0 ? Position.Right : Position.Left);
    const opposite = vertical ? (dy > 0 ? Position.Top : Position.Bottom) : (dx > 0 ? Position.Left : Position.Right);
    const active = edge.id === selectedEdgeId || Boolean(activeId && (edge.source === activeId || edge.target === activeId));
    const directed = edge.kind === "references" || edge.kind === "depends_on" || edge.kind === "topic";
    return { id: edge.id, source: edge.source, target: edge.target, sourceHandle: `s-${side}`, targetHandle: `t-${opposite}`, type: "knowledge",
      markerEnd: directed ? { type: "arrowclosed" as const, width: 13, height: 13, color: active ? "#8064c4" : "#a39ab8" } : undefined,
      data: { edge, active, dimmed: Boolean(hovered && !active), showLabel: edge.kind === "shared" || edge.kind === "references" || edge.kind === "depends_on" || edge.kind === "hub" || active },
      label: RELATION_LABELS[edge.kind], zIndex: active ? 2 : 0 };
  }), [graph, selectedEdgeId, activeId]);
  return <div ref={wrapper} className={`kg-flow-wrap ${expanded ? "is-expanded" : ""}`}>
    <ReactFlow<KnowledgeFlowNode> nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodeClick={(_, node) => {
        const kind = node.data.node.kind;
        if (kind === "entry") onSelect(node.data.node.entry!.id);
        else if (kind === "library") onOpenLibrary?.(node.id.slice(4));
        else if (kind === "core") onBackToHub?.();
        else if (kind === "category") onCategory(node.data.node.category);
        else onTag(node.data.node.label);
      }}
      onNodeDoubleClick={(_, node) => onFocus(node.id)} onNodeMouseEnter={(_, node) => setHovered(node.id)} onNodeMouseLeave={() => setHovered(null)}
      onNodeDragStop={(_, node) => savedPositions.current.set(node.id, node.position)}
      onEdgeClick={(_, edge) => { const match = graph.edges.find(item => item.id === edge.id); if (match) onEdgeSelect(match); }}
      onMove={(_, viewport) => setZoom(viewport.zoom)} onInit={() => window.setTimeout(fit, 60)}
      fitView fitViewOptions={{ padding: 0.2, maxZoom: 0.95 }} minZoom={0.25} maxZoom={1.8}
      nodesConnectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
      zoomOnScroll={false} zoomOnPinch panOnScroll={false} preventScrolling={false} panOnDrag zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: false }} attributionPosition="bottom-right"
      aria-label="知识图谱：Tab 切换节点，回车查看详情，方向键移动节点；使用下方按钮缩放">
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d9d5e2" />
      <Panel position="top-left"><span className="kg-canvas-caption">{isHub ? <><i />4 个知识域 <span>·</span> 点击进入子库</> : <><i />{graph.nodes.filter(node => node.kind === "entry").length} 条知识 <span>·</span> {graph.edges.length} 条关联{compact && <em className="kg-mobile-hint">· 小屏聚焦，拖动探索</em>}</>}</span></Panel>
      <Panel position="bottom-left"><div className="kg-canvas-controls"><button onClick={() => void zoomOut({ duration: 200 })} aria-label="缩小图谱" title="缩小"><Minus size={16} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => void zoomIn({ duration: 200 })} aria-label="放大图谱" title="放大"><Plus size={16} /></button><i /><button onClick={fitAll} aria-label="适应画布" title="适应画布"><RotateCcw size={15} /></button><button onClick={() => setExpanded(value => !value)} aria-label={expanded ? "退出全屏" : "全屏图谱"} title={expanded ? "退出全屏（Esc）" : "全屏"}>{expanded ? <Minimize size={15} /> : <Maximize size={15} />}</button></div></Panel>
      <MiniMap position="bottom-right" pannable zoomable nodeColor={node => colorFor((node as KnowledgeFlowNode).data.node)} nodeStrokeWidth={2} maskColor="var(--kg-minimap-mask, rgba(240,237,246,.65))" style={{ width: 104, height: 68, marginBottom: 24 }} ariaLabel="知识图谱缩略导航" />
    </ReactFlow>
    {!graph.nodes.length && <div className="kg-canvas-empty"><Focus size={30} /><strong>这里还没有匹配的知识</strong><span>试试其他关键词，或清除筛选条件。</span></div>}
    <div className="kg-canvas-help"><Tags size={12} />单击查看 · 双击聚焦 · 拖动画布 · Ctrl + 滚轮缩放</div>
  </div>;
}

export default function KnowledgeNetwork(props: Parameters<typeof NetworkInner>[0]) {
  return <ReactFlowProvider><NetworkInner {...props} /></ReactFlowProvider>;
}
