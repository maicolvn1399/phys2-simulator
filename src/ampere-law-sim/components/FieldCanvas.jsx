import { useEffect, useRef } from 'react';
import { fieldAt, contrib } from '../physics/field.js';
import { nf, wlabel } from '../../shared/format.js';

const LIM = 0.28;   // límite al arrastrar
const WIRE_R = 13;  // radio del alambre en pantalla (px)

export default function FieldCanvas(props) {
  const wrapRef = useRef(null), canvasRef = useRef(null);
  const P = useRef(props);
  P.current = props;
  const st = useRef({ W: 0, H: 0, S: 1, CX: 0, CY: 0, particles: [], phase: 0, half: props.view || 0.2, drag: null, hover: null });

  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d'), s = st.current;
    const toS = (x, y) => [s.CX + x * s.S, s.CY - y * s.S];
    const toW = (px, py) => [(px - s.CX) / s.S, (s.CY - py) / s.S];

    function resize() {
      const r = { width: wrapRef.current.offsetWidth, height: wrapRef.current.offsetHeight }, dpr = Math.min(devicePixelRatio || 1, 2);
      s.W = r.width; s.H = r.height;
      cv.width = Math.round(s.W * dpr); cv.height = Math.round(s.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.S = Math.min(s.W, s.H) / (2 * s.half); s.CX = s.W / 2; s.CY = s.H / 2;
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();

    /* --- partículas que siguen la dirección de B (líneas de campo animadas) --- */
    function spawn(p) {
      const wires = P.current.wires;
      for (let k = 0; k < 20; k++) {
        const [x, y] = toW(Math.random() * s.W, Math.random() * s.H);
        if (wires.every(w => Math.hypot(w.x - x, w.y - y) > 0.008)) { p.x = x; p.y = y; break; }
      }
      p.trail = [[p.x, p.y]]; p.age = 0; p.life = 70 + Math.random() * 120;
    }
    s.particles = [];
    for (let i = 0; i < 240; i++) { const p = { x: 0, y: 0 }; spawn(p); p.age = Math.random() * p.life; s.particles.push(p); }
    function stepParticles(dt) {
      const wires = P.current.wires, ds = 0.1 * dt;
      for (const p of s.particles) {
        p.age += dt * 60;
        const b = fieldAt(wires, p.x, p.y), m = Math.hypot(b.bx, b.by);
        if (m < 1e-9 || p.age > p.life) { spawn(p); continue; }
        const b2 = fieldAt(wires, p.x + 0.5 * ds * b.bx / m, p.y + 0.5 * ds * b.by / m), m2 = Math.hypot(b2.bx, b2.by) || m;
        p.x += ds * b2.bx / m2; p.y += ds * b2.by / m2;
        p.trail.push([p.x, p.y]); if (p.trail.length > 16) p.trail.shift();
        if (Math.abs(p.x) > LIM || Math.abs(p.y) > LIM || wires.some(w => Math.hypot(w.x - p.x, w.y - p.y) < 0.005)) spawn(p);
      }
    }

    function arrow(x, y, dx, dy, len, color, lw = 2, head = 5) {
      const ex = x + dx * len, ey = y + dy * len;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - dx * head * 1.7 - dy * head, ey - dy * head * 1.7 + dx * head);
      ctx.lineTo(ex - dx * head * 1.7 + dy * head, ey - dy * head * 1.7 - dx * head);
      ctx.closePath(); ctx.fill();
    }
    function tag(text, x, y, T, color, align = 'left') {
      ctx.font = '11.5px "JetBrains Mono", monospace';
      const w = ctx.measureText(text).width + 10, x0 = align === 'left' ? x : x - w;
      ctx.fillStyle = T.surface; ctx.globalAlpha = 0.88; ctx.fillRect(x0, y - 12, w, 17); ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x0 + 5, y);
    }
    const cm = v => nf(v * 100, 1);

    function draw() {
      const { wires, probe, tokens: T, sel, layers } = P.current;
      // zoom suave hacia la media ventana pedida
      const target = P.current.view || 0.2;
      if (Math.abs(s.half - target) > 1e-5) {
        s.half += (target - s.half) * 0.18; if (Math.abs(s.half - target) < 2e-4) s.half = target;
        s.S = Math.min(s.W, s.H) / (2 * s.half);
      }
      const { W, H } = s;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);

      // cuadrícula: 1 cm fina, 5 cm marcada, ejes con números
      for (let i = -30; i <= 30; i++) {
        const v = i * 0.01, [px] = toS(v, 0), [, py] = toS(0, v);
        if (i % 5 !== 0 && s.S * 0.01 < 9) continue;
        ctx.strokeStyle = i % 5 === 0 ? T.line : T.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      }
      ctx.strokeStyle = T.muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, s.CY); ctx.lineTo(W, s.CY); ctx.moveTo(s.CX, 0); ctx.lineTo(s.CX, H); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = T.muted; ctx.font = '10.5px "JetBrains Mono", monospace';
      const lstep = s.S * 0.01 >= 26 ? 1 : 5;
      for (let i = -25; i <= 25; i += lstep) {
        if (!i) continue;
        const [px] = toS(i / 100, 0), [, py] = toS(0, i / 100);
        if (px > 10 && px < W - 10) { ctx.textAlign = 'center'; ctx.fillText(String(i), px, s.CY + 14); }
        if (py > 10 && py < H - 10) { ctx.textAlign = 'right'; ctx.fillText(String(i), s.CX - 5, py + 4); }
      }
      ctx.textAlign = 'left'; ctx.fillText('x (cm)', W - 48, s.CY - 6); ctx.fillText('y (cm)', s.CX + 6, 14);

      // vectores de B con opacidad según log|B|
      if (layers.arrows && wires.length) {
        const sp = Math.max(30, Math.min(42, W / 22));
        for (let py = sp / 2; py < H; py += sp) for (let px = sp / 2; px < W; px += sp) {
          const [x, y] = toW(px, py);
          if (wires.some(w => Math.hypot(w.x - x, w.y - y) < 0.012)) continue;
          const b = fieldAt(wires, x, y), m = Math.hypot(b.bx, b.by);
          if (m < 1e-8) continue;
          ctx.globalAlpha = 0.1 + 0.55 * Math.max(0, Math.min(1, (Math.log10(m) + 6.3) / 2.2));
          arrow(px - (b.bx / m) * 7, py + (b.by / m) * 7, b.bx / m, -b.by / m, 14, T.field, 1.3, 2.6);
        }
        ctx.globalAlpha = 1;
      }
      // líneas de campo animadas
      if (layers.lines) {
        ctx.strokeStyle = T.field; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        for (const p of s.particles) {
          if (p.trail.length < 2) continue;
          ctx.globalAlpha = 0.55 * Math.max(0, Math.min(1, p.age / 12, (p.life - p.age) / 12));
          ctx.beginPath();
          p.trail.forEach(([x, y], k) => { const [a, b] = toS(x, y); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      const [ppx, ppy] = toS(probe.x, probe.y);
      const w = wires[sel];

      // círculo de Ampère del alambre elegido, que pasa por P
      if (layers.ampere && w) {
        const c = contrib(w, probe.x, probe.y);
        if (!c.onWire) {
          const [wx, wy] = toS(w.x, w.y), R = c.r * s.S;
          ctx.setLineDash([6, 5]); ctx.strokeStyle = T.loop; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(wx, wy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = T.muted; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(ppx, ppy); ctx.stroke();
          const mx = (wx + ppx) / 2, my = (wy + ppy) / 2;
          tag(`r(${wlabel(w.name)}) = ${cm(c.r)} cm`, mx + 6, my - 6, T, T.fg);
          // B_i tangente y del mismo tamaño en todo el círculo: varias flechas fijas + una que recorre
          const n = 8, dirSign = w.s; // +1 antihorario (sale), −1 horario (entra)
          for (let j = 0; j <= n; j++) {
            const a = j === n ? s.phase : (j / n) * Math.PI * 2 + 0.3;
            const x = wx + R * Math.cos(a), y = wy - R * Math.sin(a);
            const tx = -Math.sin(a) * dirSign, ty = -Math.cos(a) * dirSign; // tangente en pantalla
            ctx.globalAlpha = j === n ? 1 : 0.45;
            arrow(x, y, tx, ty, j === n ? 30 : 18, T.loop, j === n ? 2.4 : 1.6, j === n ? 5 : 3.5);
            if (j === n) { ctx.fillStyle = T.loop; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
          }
          ctx.globalAlpha = 1;
        }
      }

      // alambres con su etiqueta y coordenadas
      wires.forEach((wi, i) => {
        const [x, y] = toS(wi.x, wi.y), col = wi.s > 0 ? T.out : T.in;
        ctx.fillStyle = T.surface; ctx.beginPath(); ctx.arc(x, y, WIRE_R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
        if (wi.s > 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
        if (i === sel) { ctx.setLineDash([3, 3]); ctx.strokeStyle = T.fg; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, WIRE_R + 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        const left = x > s.W - 150;
        ctx.font = '600 13px "Instrument Sans", sans-serif'; ctx.fillStyle = T.fg; ctx.textAlign = left ? 'right' : 'left';
        ctx.fillText(`${wlabel(wi.name)} · ${nf(wi.I, 1)} A ${wi.s > 0 ? '⊙' : '⊗'}`, left ? x - WIRE_R - 6 : x + WIRE_R + 6, y - 5);
        tag(`(${cm(wi.x)}; ${cm(wi.y)})`, left ? x - WIRE_R - 4 : x + WIRE_R + 4, y + 12, T, T.muted, left ? 'right' : 'left');
      });

      // aportes de cada alambre en P
      const B = fieldAt(wires, probe.x, probe.y), m = Math.hypot(B.bx, B.by);
      const scaleRef = Math.max(m, ...wires.map(wi => contrib(wi, probe.x, probe.y).mag)) || 1;
      if (layers.parts) wires.forEach(wi => {
        const c = contrib(wi, probe.x, probe.y);
        if (c.onWire || c.mag < 1e-12) return;
        ctx.globalAlpha = 0.85;
        arrow(ppx, ppy, c.bxh, -c.byh, 62 * c.mag / scaleRef, wi.s > 0 ? T.out : T.in, 1.8, 4);
        ctx.globalAlpha = 1;
      });
      // B total en P
      if (m > 1e-11) arrow(ppx, ppy, B.bx / m, -B.by / m, 62 * m / scaleRef < 18 ? 18 : 62 * m / scaleRef, T.probe, 3.4, 6);
      ctx.fillStyle = T.probe; ctx.beginPath(); ctx.arc(ppx, ppy, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T.surface; ctx.lineWidth = 2; ctx.stroke();
      const pl = ppx > s.W - 170;
      ctx.font = '700 14px "Instrument Sans", sans-serif'; ctx.fillStyle = T.fg; ctx.textAlign = pl ? 'right' : 'left';
      ctx.fillText('P', pl ? ppx - 12 : ppx + 12, ppy - 10);
      tag(`(${cm(probe.x)}; ${cm(probe.y)}) cm`, pl ? ppx - 10 : ppx + 10, ppy + 9, T, T.fg, pl ? 'right' : 'left');
      tag(`|B| = ${nf(m * 1e6)} µT`, pl ? ppx - 10 : ppx + 10, ppy + 27, T, T.probe, pl ? 'right' : 'left');

      // lectura bajo el cursor
      if (s.hover && !s.drag) {
        const [hx, hy] = toW(...s.hover), b = fieldAt(wires, hx, hy);
        const txt = `(${cm(hx)}; ${cm(hy)}) cm · |B| = ${nf(Math.hypot(b.bx, b.by) * 1e6)} µT`;
        ctx.font = '12px "JetBrains Mono", monospace';
        const tw = ctx.measureText(txt).width + 14, x0 = Math.min(s.hover[0] + 14, W - tw - 6), y0 = Math.max(s.hover[1] - 30, 6);
        ctx.fillStyle = T.surface; ctx.strokeStyle = T.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(x0, y0, tw, 22); ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.fg; ctx.textAlign = 'left'; ctx.fillText(txt, x0 + 7, y0 + 15);
      }
    }

    /* --- puntero: arrastrar alambres y P, tocar un alambre invierte su corriente --- */
    const ptr = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function hit(px, py) {
      const { wires, probe } = P.current;
      const [qx, qy] = toS(probe.x, probe.y);
      if (Math.hypot(px - qx, py - qy) < 14) return { type: 'probe' };
      for (let i = wires.length - 1; i >= 0; i--) { const [x, y] = toS(wires[i].x, wires[i].y); if (Math.hypot(px - x, py - y) < WIRE_R + 5) return { type: 'wire', i }; }
      return null;
    }
    const snapTo = v => {
      const step = P.current.snap ? 0.005 : 0.001;
      return Math.max(-LIM, Math.min(LIM, Math.round(v / step) * step));
    };
    function down(e) {
      const [px, py] = ptr(e), h = hit(px, py);
      if (!h) return;
      s.drag = { ...h, sx: px, sy: py, moved: false };
      if (h.type === 'wire') P.current.onSelect(h.i);
      cv.setPointerCapture(e.pointerId); e.preventDefault();
    }
    function move(e) {
      const [px, py] = ptr(e);
      s.hover = [px, py];
      if (!s.drag) { cv.style.cursor = hit(px, py) ? 'grab' : 'crosshair'; return; }
      if (Math.hypot(px - s.drag.sx, py - s.drag.sy) > 4) s.drag.moved = true;
      if (!s.drag.moved) return;
      cv.style.cursor = 'grabbing';
      const [x, y] = toW(px, py), sx = snapTo(x), sy = snapTo(y);
      if (s.drag.type === 'wire') P.current.onWireMove(s.drag.i, sx, sy);
      else P.current.onProbeMove(sx, sy);
    }
    function up() {
      if (s.drag && s.drag.type === 'wire' && !s.drag.moved) P.current.onWireToggle(s.drag.i);
      s.drag = null;
    }
    const leave = () => { s.hover = null; };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', leave);

    let raf, last = 0;
    function frame(t) {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
      const p = P.current;
      if (p.animate) {
        if (p.layers.lines) stepParticles(dt);
        const w = p.wires[p.sel];
        s.phase += dt * 1.1 * (w ? w.s : 1); // el marcador gira en el sentido del campo
      }
      if (s.W) draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); cv.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div className="stage" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label="Corte transversal con los alambres, sus coordenadas, el punto P y el campo magnético" style={{ touchAction: 'none' }} />
    </div>
  );
}
