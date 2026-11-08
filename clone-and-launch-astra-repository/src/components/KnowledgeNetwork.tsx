"use client";

/**
 * Interactive knowledge network — categories orbit the ASTRA hub, entries orbit
 * their category. Nodes and links reveal how knowledge is organised before the
 * user opens the library grid.
 *
 * Rendering is a single DPR-aware canvas with animated link particles; reduced
 * motion gets a static frame. Hover highlights a node's neighbourhood, and a
 * click filters the library to that category or entry.
 */
import { useEffect, useRef } from "react";
import type { KnowledgeEntry } from "@/lib/knowledge";
import { paletteForEntry } from "@/lib/knowledge-palette";

type NodeKind = "hub" | "category" | "entry";

interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  category: string;
  x: number;
  y: number;
  r: number;
  accent: string;
  delay: number;
}

interface GraphLink {
  from: string;
  to: string;
  accent: string;
  width: number;
  phase: number;
}

interface PositionedNode extends GraphNode {
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
}

function buildGraph(entries: KnowledgeEntry[], width: number, height: number) {
  const nodes: PositionedNode[] = [];
  const links: GraphLink[] = [];
  const cx = width / 2;
  const cy = height / 2;
  // Elliptical spread: use the wide canvas instead of clustering near the hub.
  const ringX = Math.max(width * 0.3, 120);
  const ringY = Math.max(height * 0.3, 78);
  nodes.push({
    id: "hub", kind: "hub", label: "ASTRA 知识库", category: "", x: cx, y: cy,
    baseX: cx, baseY: cy, targetX: cx, targetY: cy,
    r: Math.max(17, height * 0.062), accent: "#e8b877", delay: 0,
  });

  const grouped = new Map<string, KnowledgeEntry[]>();
  for (const entry of entries) {
    const key = entry.category || "通用";
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  }
  const categories = [...grouped.entries()];
  categories.forEach(([category, list], index) => {
    const angle = -Math.PI / 2 + (index / Math.max(categories.length, 1)) * Math.PI * 2;
    const x = cx + Math.cos(angle) * ringX;
    const y = cy + Math.sin(angle) * ringY;
    const palette = paletteForEntry({ category });
    const categoryRadius = Math.max(9, height * 0.032);
    nodes.push({
      id: `cat:${category}`, kind: "category", label: category, category,
      x, y, baseX: x, baseY: y, targetX: x, targetY: y,
      r: categoryRadius, accent: palette.colors.accent,
      delay: index * 70,
    });
    links.push({ from: "hub", to: `cat:${category}`, accent: palette.colors.accent, width: 1.35, phase: index * 0.7 });

    const visible = list.slice(0, 6);
    const spread = 1.75;
    visible.forEach((entry, entryIndex) => {
      const offset = (entryIndex - (visible.length - 1) / 2) * (spread / Math.max(visible.length, 1));
      const childAngle = angle + offset;
      const ex = cx + Math.cos(childAngle) * ringX * 1.32;
      const ey = cy + Math.sin(childAngle) * ringY * 1.34;
      const entryPalette = paletteForEntry(entry);
      const nodeId = `entry:${entry.id}`;
      nodes.push({
        id: nodeId, kind: "entry", label: entry.name, category,
        x: ex, y: ey, baseX: ex, baseY: ey, targetX: ex, targetY: ey,
        r: Math.max(4, height * 0.016), accent: entryPalette.colors.highlight,
        delay: index * 70 + entryIndex * 55,
      });
      links.push({ from: `cat:${category}`, to: nodeId, accent: entryPalette.colors.accent, width: 0.95, phase: entryIndex * 0.5 + index * 0.31 });
    });
    if (list.length > visible.length) {
      const ghostAngle = angle + spread * 0.62;
      const gx = cx + Math.cos(ghostAngle) * ringX * 1.32;
      const gy = cy + Math.sin(ghostAngle) * ringY * 1.34;
      nodes.push({
        id: `more:${category}`, kind: "entry", label: `+${list.length - visible.length}`,
        category, x: gx, y: gy, baseX: gx, baseY: gy, targetX: gx, targetY: gy,
        r: Math.max(3, height * 0.012), accent: palette.colors.text,
        delay: index * 70 + 320,
      });
      links.push({ from: `cat:${category}`, to: `more:${category}`, accent: palette.colors.accent, width: 0.6, phase: 1.2 });
    }
  });

  return { nodes, links };
}

export default function KnowledgeNetwork({
  entries, activeCategory, onCategory, onEntry,
}: {
  entries: KnowledgeEntry[];
  activeCategory: string;
  onCategory: (category: string) => void;
  onEntry: (entry: KnowledgeEntry) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<string | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let time = 0;
    let graph = { nodes: [] as PositionedNode[], links: [] as GraphLink[] };
    const nodeById = new Map<string, PositionedNode>();

    const rebuild = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      graph = buildGraph(entriesRef.current, width, height);
      nodeById.clear();
      for (const node of graph.nodes) nodeById.set(node.id, node);
      if (reduceMotion) {
        for (const node of graph.nodes) { node.x = node.targetX; node.y = node.targetY; }
        draw();
      }
    };

    const neighbourIds = (id: string | null) => {
      const set = new Set<string>();
      if (!id) return set;
      set.add(id);
      for (const link of graph.links) {
        if (link.from === id) set.add(link.to);
        if (link.to === id) set.add(link.from);
      }
      return set;
    };

    const starfield = Array.from({ length: 90 }, (_, index) => ({
      x: ((index * 73) % 997) / 997,
      y: ((index * 137 + 41) % 991) / 991,
      r: 0.4 + ((index * 29) % 13) / 13,
      phase: index * 0.7,
    }));

    function draw() {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);

      // Deep-space stage so glowing nodes stay legible in both themes.
      const backdrop = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      backdrop.addColorStop(0, "#191638");
      backdrop.addColorStop(0.55, "#0d0f22");
      backdrop.addColorStop(1, "#070812");
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);
      for (const star of starfield) {
        const twinkle = reduceMotion ? 0.4 : 0.22 + 0.3 * (Math.sin(time * 0.7 + star.phase) + 1) / 2;
        ctx.globalAlpha = twinkle * 0.55;
        ctx.fillStyle = "#cfd4ff";
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const hovered = hoverRef.current;
      const active = neighbourIds(hovered);

      // Links, with a slow particle drifting along each one.
      for (const link of graph.links) {
        const from = nodeById.get(link.from);
        const to = nodeById.get(link.to);
        if (!from || !to) continue;
        const lit = !hovered || (active.has(link.from) && active.has(link.to));
        const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        gradient.addColorStop(0, from.accent);
        gradient.addColorStop(1, to.accent);
        ctx.globalAlpha = lit ? 0.42 : 0.12;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = link.width * (lit ? 1.35 : 1);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        const progress = reduceMotion ? 0.5 : (time * 0.22 + link.phase) % 1;
        const px = from.x + (to.x - from.x) * progress;
        const py = from.y + (to.y - from.y) * progress;
        ctx.globalAlpha = lit ? 0.8 : 0.18;
        ctx.fillStyle = to.accent;
        ctx.beginPath();
        ctx.arc(px, py, lit ? 1.9 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Hub halo and category rings.
      const hub = nodeById.get("hub");
      if (hub) {
        const halo = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, hub.r * 3.6);
        halo.addColorStop(0, "rgba(232,184,119,0.34)");
        halo.addColorStop(0.55, "rgba(167,138,250,0.12)");
        halo.addColorStop(1, "rgba(167,138,250,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, hub.r * 3.6, 0, Math.PI * 2);
        ctx.fill();

        const wave = reduceMotion ? 0.5 : (Math.sin(time * 1.2) + 1) / 2;
        ctx.globalAlpha = 0.16 + wave * 0.16;
        ctx.strokeStyle = "rgba(232,184,119,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hub.x, hub.y, hub.r * (1.75 + wave * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const node of graph.nodes) {
        const lit = !hovered || active.has(node.id);
        const radius = node.r * (node.id === hovered ? 1.42 : node.kind === "hub" ? 1 : node.kind === "category" ? 1.12 : 1);
        if (node.kind === "hub") {
          const core = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
          core.addColorStop(0, "#fff8ea");
          core.addColorStop(0.45, node.accent);
          core.addColorStop(1, "rgba(232,184,119,0.22)");
          ctx.fillStyle = core;
        } else {
          const core = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 1.6);
          core.addColorStop(0, node.accent);
          core.addColorStop(1, node.kind === "category" ? "rgba(0,0,0,0)" : node.accent + "00");
          ctx.fillStyle = node.kind === "category" ? node.accent : node.accent;
        }
        ctx.globalAlpha = lit ? 1 : 0.32;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (node.kind === "category") {
          const isActive = activeCategory === node.category;
          ctx.globalAlpha = lit ? 1 : 0.32;
          ctx.strokeStyle = isActive ? node.accent : "rgba(255,255,255,0.4)";
          ctx.lineWidth = isActive ? 1.8 : 1.1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * (isActive ? 1.85 : 1.55), 0, Math.PI * 2);
          ctx.stroke();

          // Labels sit tangent to the hub axis: radial placement collides with
          // the hub label on one side and the entry nodes on the other.
          const awayX = node.x - (hub?.x ?? width / 2);
          const awayY = node.y - (hub?.y ?? height / 2);
          const awayLength = Math.hypot(awayX, awayY) || 1;
          const tangentX = -awayY / awayLength;
          const tangentY = awayX / awayLength;
          const labelSize = Math.max(9.5, Math.round(radius * 0.62));
          ctx.font = `700 ${labelSize}px Arial, "PingFang SC", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const metrics = ctx.measureText(node.label);
          const padX = labelSize * 0.75;
          const padY = labelSize * 0.42;
          const boxW = metrics.width + padX * 2;
          const boxH = labelSize + padY * 2;
          // Measure first, then clear the node's selection ring entirely.
          const labelDistance = radius * 1.72 + boxW / 2 + 7;
          const rawLabelX = node.x + tangentX * labelDistance;
          const rawLabelY = node.y + tangentY * labelDistance;
          // Keep labels inside the canvas so edge categories are never clipped.
          const labelX = Math.min(width - boxW / 2 - 5, Math.max(boxW / 2 + 5, rawLabelX));
          const labelY = Math.min(height - boxH / 2 - 5, Math.max(boxH / 2 + 5, rawLabelY));
          ctx.globalAlpha = lit ? 1 : 0.45;
          ctx.fillStyle = isActive ? "rgba(12,14,32,0.92)" : "rgba(22,24,48,0.78)";
          // Guide line stops before the label pill so it can never bleed through
          // vertical labels, where the line would look like a doubled glyph.
          const guideGap = boxH / 2 + 3;
          const guideLength = Math.max(0, Math.hypot(labelX - node.x, labelY - node.y) - guideGap);
          ctx.globalAlpha = lit ? 0.34 : 0.12;
          ctx.strokeStyle = node.accent;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(node.x + tangentX * radius, node.y + tangentY * radius);
          ctx.lineTo(node.x + tangentX * (radius + guideLength), node.y + tangentY * (radius + guideLength));
          ctx.stroke();

          ctx.globalAlpha = 1;
          ctx.fillStyle = isActive ? "rgba(10,12,28,0.97)" : "rgba(17,20,40,0.95)";
          ctx.beginPath();
          ctx.roundRect(labelX - boxW / 2, labelY - boxH / 2, boxW, boxH, boxH / 2);
          ctx.fill();
          if (isActive) {
            ctx.strokeStyle = node.accent;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.fillText(node.label, labelX, labelY);
        }

        if (node.kind === "entry" && node.id === hovered && !node.id.startsWith("more:")) {
          const labelSize = Math.max(9.5, Math.round(height * 0.033));
          ctx.font = `700 ${labelSize}px Arial, "PingFang SC", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const metrics = ctx.measureText(node.label);
          const boxW = metrics.width + labelSize * 1.5;
          const boxH = labelSize + labelSize * 0.85;
          const radialX = (node.x - (hub?.x ?? width / 2)) / (Math.hypot(node.x - (hub?.x ?? width / 2), node.y - (hub?.y ?? height / 2)) || 1);
          const radialY = (node.y - (hub?.y ?? height / 2)) / (Math.hypot(node.x - (hub?.x ?? width / 2), node.y - (hub?.y ?? height / 2)) || 1);
          const tipDistance = radius + boxW / 2 + 10;
          const rawX = node.x + radialX * tipDistance;
          const rawY = node.y + radialY * tipDistance;
          const tipX = Math.min(width - boxW / 2 - 5, Math.max(boxW / 2 + 5, rawX));
          const tipY = Math.min(height - boxH / 2 - 5, Math.max(boxH / 2 + 5, rawY));
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(12,14,32,0.94)";
          ctx.beginPath();
          ctx.roundRect(tipX - boxW / 2, tipY - boxH / 2, boxW, boxH, boxH / 2);
          ctx.fill();
          ctx.strokeStyle = node.accent;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.fillText(node.label, tipX, tipY);
        }
      }

      // Draw the hub label last so it is never overlapped by category pills.
      const hubNode = nodeById.get("hub");
      if (hubNode) {
        const labelSize = Math.max(9, Math.round(hubNode.r * 0.38));
        ctx.font = `800 ${labelSize}px Arial, "PingFang SC", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const metrics = ctx.measureText(hubNode.label);
        const boxW = metrics.width + labelSize * 1.2;
        const boxH = labelSize + labelSize * 0.95;
        const labelY = Math.min(height - boxH / 2 - 5, hubNode.y + hubNode.r + boxH / 2 + Math.max(8, hubNode.r * 0.42));
        ctx.globalAlpha = 0.96;
        ctx.fillStyle = "rgba(255,247,229,0.9)";
        ctx.beginPath();
        ctx.roundRect(hubNode.x - boxW / 2, labelY - boxH / 2, boxW, boxH, boxH / 2);
        ctx.fill();
        ctx.fillStyle = "#231a12";
        ctx.fillText(hubNode.label, hubNode.x, labelY);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    }

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      time += dt;
      for (const node of graph.nodes) {
        if (node.kind === "hub") continue;
        const dx = node.targetX - node.x;
        const dy = node.targetY - node.y;
        node.x += dx * Math.min(1, dt * 6);
        node.y += dy * Math.min(1, dt * 6);
        if (!reduceMotion) {
          node.x += Math.cos(time * 0.9 + node.delay) * dt * 2.2;
          node.y += Math.sin(time * 0.75 + node.delay) * dt * 2.2;
        }
      }
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    const pointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let nearest: PositionedNode | null = null;
      let best = 22;
      for (const node of graph.nodes) {
        const distance = Math.hypot(node.x - x, node.y - y);
        const hitRadius = Math.max(best, node.r * 2.6);
        if (distance < hitRadius && distance < best + node.r * 1.6) {
          nearest = node;
          best = distance;
        }
      }
      hoverRef.current = nearest ? nearest.id : null;
      canvas.style.cursor = nearest && nearest.kind !== "hub" ? "pointer" : "default";
      canvas.title = nearest && nearest.kind !== "hub" ? nearest.label : "";
      if (reduceMotion) draw();
    };

    const pointerLeave = () => {
      hoverRef.current = null;
      canvas.style.cursor = "default";
      canvas.title = "";
      if (reduceMotion) draw();
    };

    const pointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      for (const node of graph.nodes) {
        if (Math.hypot(node.x - x, node.y - y) <= Math.max(node.r * 2.2, 12)) {
          if (node.kind === "category") onCategory(node.category);
          else if (node.kind === "entry" && !node.id.startsWith("more:")) {
            const entry = entriesRef.current.find(item => `entry:${item.id}` === node.id);
            if (entry) onEntry(entry);
          }
          return;
        }
      }
    };

    const observer = new ResizeObserver(() => rebuild());
    observer.observe(canvas);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("pointerdown", pointerDown);
    rebuild();
    if (!reduceMotion) frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("pointerdown", pointerDown);
    };
  }, [activeCategory, onCategory, onEntry]);

  return (
    <canvas
      ref={canvasRef}
      className="kb-network-canvas"
      aria-label="知识分类关系网络"
      role="img"
    />
  );
}
