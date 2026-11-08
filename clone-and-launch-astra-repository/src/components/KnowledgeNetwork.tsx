"use client";

/**
 * A force-directed knowledge web — not a fixed radial chart.
 *
 * Hub → categories → knowledge entries → shared keyword nodes, plus weak
 * cross-links between entries that share keywords. That produces a dense,
 * navigable mesh rather than a star. Nodes can be dragged; the canvas can be
 * panned and zoomed; hovering reveals a node's neighbourhood.
 */
import { useCallback, useEffect, useRef } from "react";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { paletteForEntry } from "@/lib/knowledge-palette";

type Kind = "hub" | "category" | "entry" | "tag";
type EdgeKind = "core" | "branch" | "tag" | "cross";

interface Node {
  id: string;
  kind: Kind;
  label: string;
  category: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  accent: string;
  fixed: boolean;
}

interface Edge {
  a: string;
  b: string;
  kind: EdgeKind;
  accent: string;
  width: number;
  length: number;
  strength: number;
  phase: number;
}

interface Graph {
  nodes: Node[];
  edges: Edge[];
  byId: Map<string, Node>;
}

const TAU = Math.PI * 2;
const catPalette = (category: string) => paletteForEntry({ category }).colors;

function buildGraph(entries: KnowledgeEntry[]): Graph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const byId = new Map<string, Node>();
  const add = (node: Node) => { nodes.push(node); byId.set(node.id, node); };

  add({
    id: "hub", kind: "hub", label: "ASTRA 知识库", category: "",
    x: 0, y: 0, vx: 0, vy: 0, r: 19, accent: "#e8b877", fixed: true,
  });

  const grouped = new Map<string, KnowledgeEntry[]>();
  const tagMap = new Map<string, string[]>();
  for (const entry of entries) {
    const category = entry.category || "通用";
    grouped.set(category, [...(grouped.get(category) || []), entry]);
    for (const tag of (entry.tags || []).slice(0, 4)) {
      tagMap.set(tag, [...(tagMap.get(tag) || []), `entry:${entry.id}`]);
    }
  }

  const categories = [...grouped.keys()];
  const catAngle = new Map<string, number>();
  categories.forEach((category, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(categories.length, 1)) * TAU;
    catAngle.set(category, angle);
    const palette = catPalette(category);
    add({
      id: `cat:${category}`, kind: "category", label: category, category,
      x: Math.cos(angle) * 108, y: Math.sin(angle) * 108,
      vx: 0, vy: 0, r: 11.5, accent: palette.accent, fixed: false,
    });
    edges.push({
      a: "hub", b: `cat:${category}`, kind: "core", accent: palette.accent,
      width: 1.5, length: 108, strength: 0.028, phase: index * 0.8,
    });
  });

  for (const [category, list] of grouped) {
    const angle = catAngle.get(category) ?? 0;
    const palette = catPalette(category);
    list.forEach((entry, index) => {
      const offset = (index - (list.length - 1) / 2) * 0.29;
      const theta = angle + offset;
      const radius = 188 + (index % 2) * 22;
      const id = `entry:${entry.id}`;
      const accent = paletteForEntry(entry).colors.highlight;
      add({
        id, kind: "entry", label: entry.name, category,
        x: Math.cos(theta) * radius, y: Math.sin(theta) * radius,
        vx: 0, vy: 0, r: 6.2, accent, fixed: false,
      });
      edges.push({
        a: `cat:${category}`, b: id, kind: "branch", accent: palette.accent,
        width: 1, length: 86, strength: 0.03, phase: index * 0.43,
      });
    });
  }

  // Shared keywords: each keyword becomes a node that ties entries together
  // across categories, which is what makes this read as a web.
  const tags = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  tags.forEach(([tag, entryIds], index) => {
    const angles = entryIds.map(id => {
      const node = byId.get(id);
      return node ? Math.atan2(node.y, node.x) : 0;
    });
    const meanX = angles.reduce((sum, value) => sum + Math.cos(value), 0);
    const meanY = angles.reduce((sum, value) => sum + Math.sin(value), 0);
    const angle = Math.atan2(meanY, meanX) + (index % 2 ? 0.08 : -0.08);
    add({
      id: `tag:${tag}`, kind: "tag", label: tag, category: tag,
      x: Math.cos(angle) * 262, y: Math.sin(angle) * 262,
      vx: 0, vy: 0, r: 4.2, accent: "#cfc7ff", fixed: false,
    });
    entryIds.forEach((id, entryIndex) => {
      edges.push({
        a: id, b: `tag:${tag}`, kind: "tag", accent: "#9b8cde",
        width: 0.75, length: 118, strength: 0.012,
        phase: entryIndex * 0.6 + index * 0.27,
      });
    });
  });

  // Cross-links between entries sharing a keyword.
  const added = new Set<string>();
  for (const [, entryIds] of tags) {
    for (let i = 0; i < entryIds.length; i++) {
      for (let j = i + 1; j < entryIds.length; j++) {
        const key = [entryIds[i], entryIds[j]].sort().join("|");
        if (added.has(key) || added.size > 28) continue;
        added.add(key);
        const a = byId.get(entryIds[i]);
        const b = byId.get(entryIds[j]);
        if (!a || !b || a.category === b.category) continue;
        edges.push({
          a: entryIds[i], b: entryIds[j], kind: "cross", accent: "#7c83bd",
          width: 0.6, length: 210, strength: 0.0025, phase: added.size * 0.31,
        });
      }
    }
  }

  return { nodes, edges, byId };
}

interface Bounds { halfW: number; halfH: number }

function relax(graph: Graph, alpha: number, bounds: Bounds) {
  const { nodes, edges } = graph;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = Math.max(dx * dx + dy * dy, 90);
      const distance = Math.sqrt(distanceSq);
      const force = Math.min(2.6, (a.kind === "hub" || b.kind === "hub" ? 4200 : 1600) / distanceSq) * alpha;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
      if (!b.fixed) { b.vx += fx; b.vy += fy; }
    }
  }

  for (const edge of edges) {
    const a = graph.byId.get(edge.a);
    const b = graph.byId.get(edge.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy) || 1;
    const force = (distance - edge.length) * edge.strength * alpha;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    if (!a.fixed) { a.vx += fx; a.vy += fy; }
    if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
  }

  for (const node of nodes) {
    if (node.fixed) { node.vx = 0; node.vy = 0; continue; }
    node.vx -= node.x * 0.0016 * alpha;
    node.vy -= node.y * 0.0016 * alpha;
    node.vx *= 0.84;
    node.vy *= 0.84;
    node.x = Math.max(-bounds.halfW, Math.min(bounds.halfW, node.x + Math.max(-9, Math.min(9, node.vx))));
    node.y = Math.max(-bounds.halfH, Math.min(bounds.halfH, node.y + Math.max(-9, Math.min(9, node.vy))));
  }
}

export default function KnowledgeNetwork({
  entries, activeCategory, activeTag, onCategory, onEntry, onTag,
}: {
  entries: KnowledgeEntry[];
  activeCategory: string;
  activeTag: string;
  onCategory: (category: string) => void;
  onEntry: (entry: KnowledgeEntry) => void;
  onTag: (tag: string) => void;
  activeEntries?: KnowledgeEntry[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<string | null>(null);
  const entriesRef = useRef(entries);
  const graphRef = useRef<Graph | null>(null);
  const transformRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  const handlersRef = useRef({ onCategory, onEntry, onTag });
  const filterRef = useRef({ activeCategory, activeTag });
  const signatureRef = useRef("");
  entriesRef.current = entries;
  handlersRef.current = { onCategory, onEntry, onTag };
  filterRef.current = { activeCategory, activeTag };
  signatureRef.current = entries
    .map(item => `${item.id}:${item.name}:${item.category}:${(item.tags || []).join(",")}`)
    .join("|");

  const findNode = useCallback((px: number, py: number) => {
    const canvas = canvasRef.current;
    const graph = graphRef.current;
    if (!canvas || !graph) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 760, rect.height / 540);
    const transform = transformRef.current;
    const worldX = (px - rect.width / 2 - transform.panX) / (scale * transform.zoom);
    const worldY = (py - rect.height / 2 - transform.panY) / (scale * transform.zoom);
    let best: Node | null = null;
    let bestDistance = Infinity;
    for (const node of graph.nodes) {
      const distance = Math.hypot(node.x - worldX, node.y - worldY);
      const hit = Math.max(13, node.r * 2.1);
      if (distance < hit && distance < bestDistance) { best = node; bestDistance = distance; }
    }
    return best;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let time = 0;
    let alpha = 1;
    let graph = buildGraph(entriesRef.current);
    graphRef.current = graph;
    let lastSignature = signatureRef.current;
    let dragging: Node | null = null;
    let panning = false;
    let lastPointer = { x: 0, y: 0 };
    let pointerDownPos = { x: 0, y: 0 };

    const bounds: Bounds = { halfW: 520, halfH: 200 };
    const updateBounds = () => {
      const base = Math.min(width / 760, height / 540);
      bounds.halfW = Math.max(180, width / (2 * base) - 52);
      bounds.halfH = Math.max(120, height / (2 * base) - 54);
    };
    updateBounds();
    // Converge the layout before animating so the first frame already looks
    // like a web rather than a pile of nodes.
    for (let i = 0; i < 260; i++) relax(graph, 1 - i / 300, bounds);

    const starfield = Array.from({ length: 110 }, (_, index) => ({
      x: ((index * 73 + 19) % 997) / 997,
      y: ((index * 137 + 41) % 991) / 991,
      r: 0.35 + ((index * 29) % 13) / 15,
      phase: index * 0.7,
    }));

    const neighbours = (id: string | null) => {
      const set = new Set<string>();
      if (!id) return set;
      set.add(id);
      for (const edge of graph.edges) {
        if (edge.a === id) set.add(edge.b);
        if (edge.b === id) set.add(edge.a);
      }
      return set;
    };

    const roundedLabel = (label: string, x: number, y: number, accent: string, size: number, solid = true) => {
      ctx.font = `700 ${size}px Arial, "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(label);
      const boxW = metrics.width + size * 1.5;
      const boxH = size + size * 0.9;
      ctx.fillStyle = solid ? "rgba(14,16,34,0.96)" : "rgba(14,16,34,0.72)";
      ctx.beginPath();
      ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, boxH / 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha *= 0.72;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText(label, x, y);
    };

    function draw() {
      if (!width || !height) return;
      const transform = transformRef.current;
      const scale = Math.min(width / 760, height / 540) * transform.zoom;
      const hovered = hoverRef.current;
      const active = neighbours(hovered);

      ctx.setTransform(canvas!.width / width, 0, 0, canvas!.height / height, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const backdrop = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      backdrop.addColorStop(0, "#191638");
      backdrop.addColorStop(0.58, "#0d0f22");
      backdrop.addColorStop(1, "#070812");
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);
      for (const star of starfield) {
        const twinkle = reduceMotion ? 0.4 : 0.2 + 0.3 * (Math.sin(time * 0.7 + star.phase) + 1) / 2;
        ctx.globalAlpha = twinkle * 0.5;
        ctx.fillStyle = "#cfd4ff";
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(width / 2 + transform.panX, height / 2 + transform.panY);
      ctx.scale(scale, scale);

      // Edges and the particles travelling along them.
      for (const edge of graph.edges) {
        const a = graph.byId.get(edge.a);
        const b = graph.byId.get(edge.b);
        if (!a || !b) continue;
        const lit = !hovered || (active.has(edge.a) && active.has(edge.b));
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, a.accent);
        gradient.addColorStop(1, b.accent);
        ctx.globalAlpha = lit ? (edge.kind === "cross" ? 0.2 : 0.45) : 0.07;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = edge.width * (lit ? 1.3 : 1);
        if (edge.kind === "tag" || edge.kind === "cross") ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (edge.kind !== "cross") {
          const progress = reduceMotion ? 0.5 : (time * 0.2 + edge.phase) % 1;
          ctx.globalAlpha = lit ? 0.85 : 0.12;
          ctx.fillStyle = b.accent;
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress, lit ? 1.7 : 1.1, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Hub halo.
      const hub = graph.byId.get("hub");
      if (hub) {
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, hub.r * 4.4);
        halo.addColorStop(0, "rgba(232,184,119,0.32)");
        halo.addColorStop(0.5, "rgba(167,138,250,0.1)");
        halo.addColorStop(1, "rgba(167,138,250,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, hub.r * 4.4, 0, TAU);
        ctx.fill();
      }

      // Nodes.
      for (const node of graph.nodes) {
        const lit = !hovered || active.has(node.id);
        const radius = node.r * (node.id === hovered ? 1.5 : 1);
        ctx.globalAlpha = lit ? 1 : 0.25;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * (node.kind === "hub" ? 1.6 : 2.1));
        glow.addColorStop(0, node.kind === "hub" ? "#fff8ea" : node.accent);
        glow.addColorStop(1, "rgba(10,12,28,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * (node.kind === "hub" ? 1.6 : 2.1), 0, TAU);
        ctx.fill();

        if (node.kind === "tag") {
          ctx.save();
          ctx.translate(node.x, node.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = node.accent;
          ctx.fillRect(-radius * 0.78, -radius * 0.78, radius * 1.56, radius * 1.56);
          ctx.restore();
        } else {
          ctx.fillStyle = node.accent;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, TAU);
          ctx.fill();
        }

        if (node.kind === "category") {
          const isCurrent = filterRef.current.activeCategory === node.category;
          ctx.strokeStyle = isCurrent ? node.accent : "rgba(255,255,255,0.45)";
          ctx.lineWidth = isCurrent ? 1.9 : 1.05;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 1.6, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Labels for categories and keywords, placed tangent to the hub axis.
      for (const node of graph.nodes) {
        if (node.kind !== "category" && node.kind !== "tag") continue;
        const lit = !hovered || active.has(node.id);
        ctx.globalAlpha = lit ? 1 : 0.3;
        const length = Math.hypot(node.x, node.y) || 1;
        const tx = -node.y / length;
        const ty = node.x / length;
        const size = node.kind === "category" ? 10.5 : 8.6;
        ctx.font = `700 ${size}px Arial, "PingFang SC", sans-serif`;
        const boxW = ctx.measureText(node.label).width + size * 1.5;
        const distance = node.r * 1.7 + boxW / 2 + 7;
        const lx = Math.max(-bounds.halfW + boxW / 2, Math.min(bounds.halfW - boxW / 2, node.x + tx * distance));
        const ly = Math.max(-bounds.halfH + size, Math.min(bounds.halfH - size, node.y + ty * distance));
        if (node.kind === "category") {
          roundedLabel(node.label, lx, ly, node.accent, size);
        } else {
          ctx.fillStyle = filterRef.current.activeTag === node.label ? "#ffe6b7" : "rgba(215,211,245,0.86)";
          ctx.font = `600 ${size}px Arial, "PingFang SC", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.label, Math.max(-bounds.halfW + 20, Math.min(bounds.halfW - 20, node.x)), Math.min(bounds.halfH - 8, node.y + node.r * 2.7));
        }
      }

      // Hub label always last, with its own opaque pill.
      if (hub) {
        roundedLabel(hub.label, 0, hub.r + 17, hub.accent, 10);
      }

      // Hover tooltip for entries and tags.
      if (hovered) {
        const node = graph.byId.get(hovered);
        if (node && node.kind === "entry") {
          roundedLabel(node.label,
            Math.max(-bounds.halfW + 34, Math.min(bounds.halfW - 34, node.x)),
            Math.max(-bounds.halfH + 12, node.y - node.r * 3.4), node.accent, 10.5);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    const tick = (now: number) => {
      time = now / 1000;
      if (signatureRef.current !== lastSignature) relayout();
      if (!reduceMotion && alpha > 0.035) {
        relax(graph, alpha, bounds);
        alpha *= 0.985;
      }
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    const relayout = () => {
      graph = buildGraph(entriesRef.current);
      graphRef.current = graph;
      lastSignature = signatureRef.current;
      alpha = 1;
      for (let i = 0; i < 260; i++) relax(graph, 1 - i / 300, bounds);
      if (reduceMotion) draw();
    };

    const rebuild = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      updateBounds();
      relayout();
    };

    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const pointerMove = (event: PointerEvent) => {
      const point = local(event);
      if (dragging) {
        const transform = transformRef.current;
        const scale = Math.min(width / 760, height / 540) * transform.zoom;
        dragging.x += (point.x - lastPointer.x) / scale;
        dragging.y += (point.y - lastPointer.y) / scale;
        dragging.vx = 0;
        dragging.vy = 0;
        alpha = Math.max(alpha, 0.16);
        if (reduceMotion) draw();
      } else if (panning) {
        transformRef.current.panX += point.x - lastPointer.x;
        transformRef.current.panY += point.y - lastPointer.y;
        if (reduceMotion) draw();
      } else {
        const node = findNode(point.x, point.y);
        hoverRef.current = node ? node.id : null;
        canvas.style.cursor = node ? (node.kind === "hub" ? "grab" : "pointer") : "grab";
        if (reduceMotion) draw();
      }
      lastPointer = point;
    };

    const pointerDown = (event: PointerEvent) => {
      const point = local(event);
      pointerDownPos = point;
      lastPointer = point;
      const node = findNode(point.x, point.y);
      if (node && node.kind !== "hub") {
        dragging = node;
        canvas.setPointerCapture(event.pointerId);
      } else {
        panning = true;
        canvas.setPointerCapture(event.pointerId);
      }
    };

    const pointerUp = (event: PointerEvent) => {
      const point = local(event);
      const moved = Math.hypot(point.x - pointerDownPos.x, point.y - pointerDownPos.y);
      if (moved < 5 && !dragging) {
        const node = findNode(point.x, point.y);
        if (node?.kind === "category") handlersRef.current.onCategory(node.category);
        else if (node?.kind === "tag") handlersRef.current.onTag(node.label);
        else if (node?.kind === "entry") handlersRef.current.onEntry(entriesRef.current.find(item => `entry:${item.id}` === node.id) || { id: 0, name: "", category: "", description: "", templateText: "" });
      }
      dragging = null;
      panning = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const transform = transformRef.current;
      transform.zoom = Math.max(0.6, Math.min(2, transform.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
      if (reduceMotion) draw();
    };

    const doubleClick = () => {
      transformRef.current = { panX: 0, panY: 0, zoom: 1 };
      alpha = 0.5;
    };

    const observer = new ResizeObserver(rebuild);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("pointerleave", () => { hoverRef.current = null; if (reduceMotion) draw(); });
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("dblclick", doubleClick);
    rebuild();
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", doubleClick);
    };
  }, [findNode]);

  return <canvas ref={canvasRef} className="kb-network-canvas" aria-label="可拖拽缩放的知识关系网络" role="img" />;
}
