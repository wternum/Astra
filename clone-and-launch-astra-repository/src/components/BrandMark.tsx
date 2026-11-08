// ASTRA brand mark — a restrained Vela-inspired particle meteor.
//
// Idle: Galaxy dust streams converge into a warm Meteor core (the "V").
// Hover: the constellation stays upright; particles gently stream outward.
// Click/tap: a short meteor burst before the particles gather back.
// DPR-aware canvas; reduced-motion users see one static frame.
import { useEffect, useRef } from "react";

type RGB = readonly [number, number, number];

const CORE: RGB = [255, 228, 184];
const GOLD: RGB = [238, 180, 106];
const EMBER: RGB = [222, 126, 66];
const VIOLET: RGB = [150, 132, 220];
const INDIGO: RGB = [82, 98, 180];
const CYAN: RGB = [120, 180, 220];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgba = (c: RGB, alpha: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(alpha).toFixed(3)})`;
const mixColor = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

type Streak = {
  side: -1 | 1;
  t: number;
  speed: number;
  offset: number;
  size: number;
  alpha: number;
  trail: number;
  tone: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: RGB;
};

type Ring = { life: number; max: number; delay: number };
type Star = { x: number; y: number; r: number; phase: number; speed: number };
type Comet = { side: -1 | 1; t: number; speed: number; wait: number };

/** Cubic Bézier arm: steep near the star, flattening into a wide meteor tail. */
function armPoint(side: number, t: number, w: number, h: number): readonly [number, number] {
  const u = 1 - clamp(t);
  const v = clamp(t);
  const p0 = [0.5, 0.82];
  const p1 = [0.5 + side * 0.12, 0.52];
  const p2 = [0.5 + side * 0.3, 0.44];
  const p3 = [0.5 + side * 0.46, 0.24];
  const b0 = u * u * u;
  const b1 = 3 * u * u * v;
  const b2 = 3 * u * v * v;
  const b3 = v * v * v;
  return [
    (b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0]) * w,
    (b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1]) * h,
  ];
}

function armNormal(side: number, t: number, w: number, h: number) {
  const a = armPoint(side, clamp(t - 0.012), w, h);
  const b = armPoint(side, clamp(t + 0.012), w, h);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  return [-dy / length, dx / length] as const;
}

function gaussian() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.35;
}

function makeStreak(initial: boolean): Streak {
  return {
    side: Math.random() < 0.5 ? -1 : 1,
    t: initial ? Math.random() : 0.8 + Math.random() * 0.24,
    speed: 0.13 + Math.random() * 0.27,
    offset: gaussian(),
    size: 0.3 + Math.random() * 1.05,
    alpha: 0.28 + Math.random() * 0.5,
    trail: 0.012 + Math.random() * 0.05,
    tone: Math.random(),
  };
}

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    if (!ctx) return;

    const count = compact ? 90 : 210;
    const streaks: Streak[] = Array.from({ length: count }, () => makeStreak(true));
    const stars: Star[] = Array.from({ length: compact ? 8 : 18 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.85,
      r: 0.22 + Math.random() * 0.48,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.2,
    }));
    const sparks: Spark[] = [];
    const rings: Ring[] = [];
    const comet: Comet = { side: 1, t: 1.2, speed: 0.7, wait: 2.8 };

    const hoverEl = host.closest(".brand-home") || host;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let hoverTarget = 0;
    let hover = 0;
    let flash = 0;
    let scatterDone = false;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let w = 0;
    let h = 0;
    let frame = 0;
    let last = 0;

    const emit = (strong: boolean) => {
      flash = strong ? 0.55 : 0.24;
      rings.push({ life: 0, max: strong ? 0.7 : 0.66, delay: 0 });
      if (strong) rings.push({ life: 0, max: 0.86, delay: 0.12 });
      const amount = strong ? (compact ? 22 : 48) : compact ? 10 : 18;
      const palette: RGB[] = [CORE, GOLD, EMBER, VIOLET, CYAN];
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = w * (0.1 + Math.random() * (strong ? 0.4 : 0.24));
        sparks.push({
          x: w * 0.5,
          y: h * 0.82,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.82,
          life: 0,
          max: 0.55 + Math.random() * 0.72,
          size: 0.4 + Math.random() * 1.3,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
      if (reduceMotion) draw(0, 0);
    };

    const burst = () => emit(true);
    const scatter = () => emit(false);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduceMotion) draw(0, 0);
    };

    function draw(time: number, dt: number) {
      if (!w || !h) return;
      hover += (hoverTarget - hover) * clamp(dt * 6);
      flash = Math.max(0, flash - dt * 3.2);
      const disperse = hover;
      const direction = hover > 0.45 ? 1 : -1;
      const cx = w * 0.5;
      const cy = h * 0.82;

      // Hover releases a little dust outward; the V itself never rotates.
      if (!reduceMotion && hoverTarget === 1 && !scatterDone && hover > 0.78) {
        scatterDone = true;
        scatter();
      }

      ctx.clearRect(0, 0, w, h);

      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.72);
      nebula.addColorStop(0, rgba(GOLD, 0.055 + flash * 0.12));
      nebula.addColorStop(0.45, rgba(VIOLET, 0.035 + hover * 0.025));
      nebula.addColorStop(1, "rgba(8,8,24,0)");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const star of stars) {
        const twinkle = 0.16 + 0.2 * Math.sin(time * star.speed + star.phase);
        ctx.fillStyle = rgba(hover > 0.45 ? CYAN : VIOLET, twinkle * (0.32 + hover * 0.2));
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.r * (w / 100), 0, Math.PI * 2);
        ctx.fill();
      }

      for (const side of [-1, 1] as const) {
        const tip = armPoint(side, 1, w, h);
        const apex = armPoint(side, 0, w, h);
        const gradient = ctx.createLinearGradient(apex[0], apex[1], tip[0], tip[1]);
        gradient.addColorStop(0, rgba(CORE, 0.62));
        gradient.addColorStop(0.16, rgba(GOLD, 0.48));
        gradient.addColorStop(0.42, rgba(EMBER, 0.2));
        gradient.addColorStop(0.72, rgba(VIOLET, 0.1 + hover * 0.08));
        gradient.addColorStop(1, rgba(INDIGO, 0));

        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const p = armPoint(side, i / 40, w, h);
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = gradient;

        ctx.globalAlpha = 0.16 + hover * 0.06;
        ctx.lineWidth = w * (0.11 + hover * 0.02);
        ctx.shadowBlur = w * (0.12 + hover * 0.04);
        ctx.shadowColor = rgba(GOLD, 0.24);
        ctx.stroke();

        ctx.globalAlpha = 0.72;
        ctx.lineWidth = Math.max(0.6, w * 0.01);
        ctx.shadowBlur = w * 0.045;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      ctx.lineCap = "round";
      for (let i = 0; i < streaks.length; i++) {
        const p = streaks[i];
        p.t += p.speed * dt * direction * (0.58 + hover * 1.5);
        if (p.t > 1.08) p.t = -0.04;
        if (p.t < -0.06) p.t = 1.06;

        const t = clamp(p.t);
        const [nx, ny] = armNormal(p.side, t, w, h);
        const bandWidth = w * (0.005 + 0.085 * Math.pow(t, 0.85)) * (1 + disperse * 1.35);
        const drift = (pointerX - 0.5) * w * 0.028 * disperse;
        const spread = p.offset * bandWidth + drift;
        const head = armPoint(p.side, t, w, h);
        const tail = armPoint(
          p.side,
          clamp(t + (direction > 0 ? -p.trail : p.trail) * (1 + disperse * 0.8)),
          w,
          h,
        );

        const warmth = clamp((t - 0.2) / 0.58);
        const warm = p.tone < 0.45 ? GOLD : EMBER;
        const cool = p.tone < 0.45 ? mixColor(VIOLET, CYAN, disperse * 0.6) : INDIGO;
        let color = mixColor(warm, cool, warmth);
        color = mixColor(CORE, color, clamp(t / 0.2) * (1 - disperse * 0.2));

        const focus = 0.18 + 0.7 * Math.pow(1 - t, 1.25);
        const alpha = clamp(p.alpha * focus * (0.62 + hover * 0.18), 0, 0.78);
        ctx.strokeStyle = rgba(color, alpha);
        ctx.lineWidth = Math.max(0.35, p.size * (w / 100) * (1 + hover * 0.12));
        ctx.beginPath();
        ctx.moveTo(tail[0] + nx * spread, tail[1] + ny * spread);
        ctx.lineTo(head[0] + nx * spread, head[1] + ny * spread);
        ctx.stroke();
      }

      // A restrained meteor occasionally travels along one arm.
      if (!reduceMotion) {
        if (comet.wait > 0) comet.wait -= dt;
        else {
          comet.t -= comet.speed * dt * (direction > 0 ? -1 : 1);
          if (comet.t > 1.25 || comet.t < -0.12) {
            comet.t = direction > 0 ? -0.08 : 1.2;
            comet.side = Math.random() < 0.5 ? -1 : 1;
            comet.wait = 3 + Math.random() * 4;
          }
        }
        const ct = clamp(comet.t);
        if (comet.wait <= 0) {
          const head = armPoint(comet.side, ct, w, h);
          const tail = armPoint(comet.side, clamp(ct + 0.16), w, h);
          const streak = ctx.createLinearGradient(head[0], head[1], tail[0], tail[1]);
          streak.addColorStop(0, rgba(CORE, 0.6));
          streak.addColorStop(0.35, rgba(GOLD, 0.3));
          streak.addColorStop(1, rgba(VIOLET, 0));
          ctx.strokeStyle = streak;
          ctx.lineWidth = Math.max(0.7, w * 0.014);
          ctx.shadowBlur = w * 0.045;
          ctx.shadowColor = rgba(GOLD, 0.45);
          ctx.beginPath();
          ctx.moveTo(tail[0], tail[1]);
          ctx.lineTo(head[0], head[1]);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // A soft warm core with a very short, low-contrast flare.
      const pulse = reduceMotion ? 1 : 0.95 + 0.05 * Math.sin(time * 1.4);
      const radius = w * (0.17 + hover * 0.035) * pulse;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      halo.addColorStop(0, rgba(CORE, 0.62));
      halo.addColorStop(0.2, rgba(GOLD, 0.38));
      halo.addColorStop(0.55, rgba(EMBER, 0.12));
      halo.addColorStop(1, rgba(EMBER, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.12);
      const flareLength = h * (0.13 + hover * 0.04);
      const vertical = ctx.createLinearGradient(0, -flareLength, 0, flareLength);
      vertical.addColorStop(0, rgba(GOLD, 0));
      vertical.addColorStop(0.5, rgba(CORE, 0.32));
      vertical.addColorStop(1, rgba(GOLD, 0));
      ctx.strokeStyle = vertical;
      ctx.lineWidth = Math.max(0.4, w * 0.006);
      ctx.beginPath();
      ctx.moveTo(0, -flareLength);
      ctx.lineTo(0, flareLength);
      ctx.stroke();
      const horizontal = ctx.createLinearGradient(-flareLength * 0.6, 0, flareLength * 0.6, 0);
      horizontal.addColorStop(0, rgba(VIOLET, 0));
      horizontal.addColorStop(0.5, rgba(CORE, 0.2));
      horizontal.addColorStop(1, rgba(VIOLET, 0));
      ctx.strokeStyle = horizontal;
      ctx.lineWidth = Math.max(0.35, w * 0.004);
      ctx.beginPath();
      ctx.moveTo(-flareLength * 0.6, 0);
      ctx.lineTo(flareLength * 0.6, 0);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = rgba(CORE, 0.72);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.7, w * (0.011 + hover * 0.003)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.life += dt;
        if (ring.life > ring.max + ring.delay) {
          rings.splice(i, 1);
          continue;
        }
        if (ring.life < ring.delay) continue;
        const progress = clamp((ring.life - ring.delay) / ring.max);
        ctx.strokeStyle = rgba(mixColor(GOLD, CYAN, progress), (1 - progress) * 0.28);
        ctx.lineWidth = Math.max(0.5, w * 0.011 * (1 - progress));
        ctx.beginPath();
        ctx.arc(cx, cy, w * (0.05 + 0.55 * progress), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.max) {
          sparks.splice(i, 1);
          continue;
        }
        const progress = s.life / s.max;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 1 - dt * 1.5;
        s.vy *= 1 - dt * 1.5;
        const alpha = (1 - progress) * 0.62;
        const px = s.x + (pointerX - 0.5) * w * 0.025 * progress;
        const py = s.y + (pointerY - 0.5) * h * 0.025 * progress;
        ctx.strokeStyle = rgba(s.color, alpha * 0.55);
        ctx.lineWidth = Math.max(0.4, s.size * (w / 110));
        ctx.beginPath();
        ctx.moveTo(px - s.vx * 0.025, py - s.vy * 0.025);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.fillStyle = rgba(CORE, alpha * 0.75);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.35, s.size * (w / 180)), 0, Math.PI * 2);
        ctx.fill();
      }

      if (flash > 0) {
        const flashGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.44);
        flashGradient.addColorStop(0, rgba(CORE, flash * 0.22));
        flashGradient.addColorStop(0.4, rgba(GOLD, flash * 0.09));
        flashGradient.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = flashGradient;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      if (!document.hidden) draw(now / 1000, dt);
      frame = window.requestAnimationFrame(tick);
    };

    const enter = () => { hoverTarget = 1; };
    const leave = () => { hoverTarget = 0; scatterDone = false; };
    const down = () => burst();
    const move = (raw: Event) => {
      const event = raw as PointerEvent;
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = clamp((event.clientX - rect.left) / rect.width);
      pointerY = clamp((event.clientY - rect.top) / rect.height);
    };

    hoverEl.addEventListener("pointerenter", enter);
    hoverEl.addEventListener("pointerleave", leave);
    hoverEl.addEventListener("pointerdown", down);
    hoverEl.addEventListener("pointermove", move);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reduceMotion) frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      hoverEl.removeEventListener("pointerenter", enter);
      hoverEl.removeEventListener("pointerleave", leave);
      hoverEl.removeEventListener("pointerdown", down);
      hoverEl.removeEventListener("pointermove", move);
    };
  }, [compact]);

  return (
    <span ref={hostRef} className={`astra-mark${compact ? " astra-mark--compact" : ""}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </span>
  );
}
