import { useEffect, useRef } from 'react';
import { Er, qEnc } from './physics.js';
import { nf, sciText } from '../shared/format.js';

const HALF = 2.25;          // la ventana muestra ±2,25 R (la superficie gaussiana llega hasta 2 R)
const RING_N = 16;          // flechas de E sobre la superficie gaussiana
const SPOKES = 24;          // trayectorias del "flujo" animado

const rgba = (hex, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Puntos de carga fijos (en el disco unitario) para dibujar la distribución en el corte transversal. */
function makeDots(n) {
  let a = 20261112;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: n }, () => { const rr = Math.sqrt(rnd()), th = rnd() * 2 * Math.PI; return { x: rr * Math.cos(th), y: rr * Math.sin(th), rr, u: rnd() }; });
}
const DOTS = makeDots(300);

/** Corte transversal de la esfera aislante, la superficie gaussiana (r) y el campo E.
 *  Props: Q (nC), R y r (cm), dist ('uniform' | 'linear'), tokens, animate, layers { vec, enc, dots }, onRadius(r en cm). */
export default function GaussCanvas(props) {
  const wrapRef = useRef(null), canvasRef = useRef(null);
  const P = useRef(props);
  P.current = props;
  const st = useRef({ W: 0, H: 0, S: 1, CX: 0, CY: 0, phase: 0, drag: false, hover: null });

  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d'), s = st.current;

    function resize() {
      const w = wrapRef.current.offsetWidth, h = wrapRef.current.offsetHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      s.W = w; s.H = h; s.CX = w / 2; s.CY = h / 2;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();

    function arrow(x, y, dx, dy, len, color, lw = 2, head = 5) {
      const ex = x + dx * len, ey = y + dy * len;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex - dx * head * 0.6, ey - dy * head * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - dx * head * 1.7 - dy * head, ey - dy * head * 1.7 + dx * head);
      ctx.lineTo(ex - dx * head * 1.7 + dy * head, ey - dy * head * 1.7 - dx * head);
      ctx.closePath(); ctx.fill();
    }
    function tag(text, x, y, T, color, align = 'left') {
      ctx.font = '11.5px "JetBrains Mono", monospace';
      const w = ctx.measureText(text).width + 10, x0 = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
      ctx.fillStyle = T.surface; ctx.globalAlpha = 0.9; ctx.fillRect(x0, y - 12, w, 17); ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x0 + 5, y);
    }

    function draw() {
      const { Q, R, r, dist, tokens: T, layers } = P.current;
      const { W, H, CX, CY } = s;
      const S = (s.S = Math.min(W, H) / (2 * HALF * R));          // px por cm
      const Rp = R * S, rp = r * S;
      const Qc = Q * 1e-9, Rm = R / 100;
      const Eref = Math.abs(Er(Qc, Rm, Rm, dist));                   // |E| en la superficie de la esfera (el máximo)
      const E = Er(Qc, Rm, r / 100, dist);
      const base = Q >= 0 ? T.out : T.in;
      const sgn = E >= 0 ? 1 : -1;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);

      // regla horizontal con marcas en cm
      ctx.strokeStyle = T.muted; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(W, CY); ctx.stroke(); ctx.globalAlpha = 1;
      const raw = 60 / S, pw = 10 ** Math.floor(Math.log10(raw)), f = raw / pw, step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pw;
      ctx.fillStyle = T.muted; ctx.font = '10.5px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      for (let v = -Math.floor(HALF * R / step) * step; v <= HALF * R + 1e-9; v += step) {
        const px = CX + v * S;
        if (px < 8 || px > W - 8) continue;
        ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.moveTo(px, CY - 4); ctx.lineTo(px, CY + 4); ctx.stroke(); ctx.globalAlpha = 1;
        if (Math.abs(v) > 1e-9) ctx.fillText(nf(v, step < 1 ? 1 : 0), px, CY + 16);
      }
      ctx.textAlign = 'left'; ctx.fillText('x (cm)', W - 46, CY - 8);

      // esfera aislante: relleno según el tipo de distribución
      if (dist === 'linear') {
        const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Rp);
        g.addColorStop(0, rgba(base, 0.02)); g.addColorStop(1, rgba(base, 0.3));
        ctx.fillStyle = g;
      } else ctx.fillStyle = rgba(base, 0.14);
      ctx.beginPath(); ctx.arc(CX, CY, Rp, 0, Math.PI * 2); ctx.fill();

      // carga encerrada (la parte de la esfera que cabe dentro de la superficie gaussiana)
      if (layers.enc) {
        ctx.fillStyle = rgba(base, 0.2);
        ctx.beginPath(); ctx.arc(CX, CY, Math.min(rp, Rp), 0, Math.PI * 2); ctx.fill();
      }

      // cargas: más densas donde ρ es mayor; las encerradas se ven más marcadas
      if (layers.dots) {
        ctx.strokeStyle = base; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        const g = 3.2;
        for (const d of DOTS) {
          if (dist === 'linear' && d.u > d.rr) continue;
          const x = CX + d.x * Rp * 0.96, y = CY - d.y * Rp * 0.96, inside = Math.hypot(x - CX, y - CY) < rp;
          ctx.globalAlpha = layers.enc ? (inside ? 0.95 : 0.4) : 0.7;
          ctx.beginPath(); ctx.moveTo(x - g, y); ctx.lineTo(x + g, y);
          if (Q >= 0) { ctx.moveTo(x, y - g); ctx.lineTo(x, y + g); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // borde de la esfera
      ctx.strokeStyle = base; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(CX, CY, Rp, 0, Math.PI * 2); ctx.stroke();

      // vectores E en una rejilla (dirección radial, tamaño y opacidad según |E|)
      if (layers.vec && Eref > 0) {
        const sp = Math.max(34, Math.min(46, W / 18));
        for (let py = sp / 2; py < H; py += sp) for (let px = sp / 2; px < W; px += sp) {
          const dx = px - CX, dy = py - CY, d = Math.hypot(dx, dy);
          if (d < 14) continue;
          const e = Er(Qc, Rm, d / S / 100, dist), m = Math.min(1, Math.abs(e) / Eref);
          if (m < 0.03) continue;
          const ux = (dx / d) * (e >= 0 ? 1 : -1), uy = (dy / d) * (e >= 0 ? 1 : -1);
          ctx.globalAlpha = 0.12 + 0.5 * m;
          arrow(px - ux * 6, py - uy * 6, ux, uy, 6 + 10 * m, T.field, 1.3, 2.6);
        }
        ctx.globalAlpha = 1;
      }

      // superficie gaussiana
      ctx.setLineDash([7, 5]); ctx.strokeStyle = T.loop; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(CX, CY, rp, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

      // E sobre la superficie: radial, del mismo tamaño en todos los puntos (por eso se saca de la integral)
      if (Eref > 0 && Math.abs(E) > 0) {
        const len = Math.min(10 + 48 * Math.abs(E) / Eref, sgn < 0 ? Math.max(8, rp * 0.9) : 1e9);
        for (let k = 0; k < RING_N; k++) {
          const a = (k / RING_N) * Math.PI * 2 + Math.PI / RING_N, ux = Math.cos(a), uy = -Math.sin(a);
          arrow(CX + ux * rp, CY + uy * rp, ux * sgn, uy * sgn, len, base, 2.2, 5);
        }
      }

      // un elemento de área dA con su normal (siempre hacia afuera) y E: son paralelos si Q > 0 y antiparalelos si Q < 0
      {
        const a = (38 * Math.PI) / 180, ux = Math.cos(a), uy = -Math.sin(a), tx = -uy, ty = ux;
        const px = CX + ux * rp, py = CY + uy * rp;
        ctx.strokeStyle = T.loop; ctx.lineWidth = 7; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(CX, CY, rp, -a - 0.06, -a + 0.06); ctx.stroke();
        arrow(px + tx * 12, py + ty * 12, ux, uy, 30, T.loop, 2.4, 5.5);
        tag('dA', px + tx * 12 + ux * 40, py + ty * 12 + uy * 40 + 4, T, T.loop, 'center');
        if (Eref > 0 && Math.abs(E) > 0) tag('E', px - tx * 12 + ux * sgn * (10 + 48 * Math.abs(E) / Eref + 14), py - ty * 12 + uy * sgn * (10 + 48 * Math.abs(E) / Eref + 14) + 4, T, base, 'center');
      }

      // flujo animado: puntos que cruzan la superficie (brillo ∝ |q_enc / Q|, o sea ∝ |Φ|)
      if (P.current.animate && Q !== 0) {
        const frac = Math.abs(qEnc(Qc, Rm, r / 100, dist) / Qc), band = Math.max(26, Math.min(70, Rp * 0.4));
        ctx.fillStyle = T.loop;
        for (let k = 0; k < SPOKES; k++) {
          const a = (k / SPOKES) * Math.PI * 2 + 0.13;
          for (let j = 0; j < 3; j++) {
            const u = (s.phase * 0.35 + j / 3 + k * 0.037) % 1, off = (u - 0.5) * band * sgn, rr = rp + off;
            if (rr < 3) continue;
            ctx.globalAlpha = frac * Math.sin(Math.PI * u) * 0.95;
            ctx.beginPath(); ctx.arc(CX + Math.cos(a) * rr, CY - Math.sin(a) * rr, 2.4, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // etiquetas: R, r, región y carga
      {
        const aR = (205 * Math.PI) / 180, ar = (-32 * Math.PI) / 180;
        ctx.strokeStyle = base; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(aR) * Rp, CY - Math.sin(aR) * Rp); ctx.stroke();
        ctx.strokeStyle = T.loop;
        ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(ar) * rp, CY - Math.sin(ar) * rp); ctx.stroke(); ctx.globalAlpha = 1;
        tag(`R = ${nf(R, 1)} cm`, CX + Math.cos(aR) * Rp * 0.5 - 4, CY - Math.sin(aR) * Rp * 0.5 - 6, T, base, 'right');
        tag(`r = ${nf(r, 1)} cm`, CX + Math.cos(ar) * rp * 0.5 + 6, CY - Math.sin(ar) * rp * 0.5 + 16, T, T.loop);
        ctx.fillStyle = T.fg; ctx.beginPath(); ctx.arc(CX, CY, 3, 0, Math.PI * 2); ctx.fill();

        const reg = Math.abs(r - R) < 0.05 ? 'r = R · sobre la superficie' : r < R ? 'r < R · dentro de la esfera' : 'r > R · fuera de la esfera';
        tag(`Q = ${Q > 0 ? '+' : ''}${nf(Q, 1)} nC · ${dist === 'linear' ? 'ρ = ρ₀ r/R' : 'ρ uniforme'}`, 10, 22, T, base);
        tag(reg, 10, 44, T, T.loop);
        tag(`E = ${sciText(E)} N/C ${E === 0 ? '' : E > 0 ? '(sale)' : '(entra)'}`, 10, 66, T, T.fg);
      }

      // lectura bajo el cursor
      if (s.hover && !s.drag) {
        const d = Math.hypot(s.hover[0] - CX, s.hover[1] - CY) / S, e = Er(Qc, Rm, d / 100, dist);
        const txt = `r = ${nf(d, 1)} cm · E = ${sciText(e)} N/C`;
        ctx.font = '12px "JetBrains Mono", monospace';
        const tw = ctx.measureText(txt).width + 14, x0 = Math.min(s.hover[0] + 14, W - tw - 6), y0 = Math.max(s.hover[1] - 30, 6);
        ctx.fillStyle = T.surface; ctx.strokeStyle = T.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(x0, y0, tw, 22); ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.fg; ctx.textAlign = 'left'; ctx.fillText(txt, x0 + 7, y0 + 15);
      }
    }

    // puntero: tocar o arrastrar en cualquier parte del lienzo pone la superficie gaussiana a esa distancia del centro
    const ptr = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function setFrom(px, py) {
      const { R, onRadius } = P.current;
      const d = Math.hypot(px - s.CX, py - s.CY) / s.S;
      onRadius(Math.max(0.1, Math.min(2 * R, Math.round(d * 10) / 10)));
    }
    function down(e) { const [px, py] = ptr(e); s.drag = true; setFrom(px, py); cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; e.preventDefault(); }
    function move(e) { const [px, py] = ptr(e); s.hover = [px, py]; if (s.drag) setFrom(px, py); else cv.style.cursor = 'crosshair'; }
    function up() { s.drag = false; cv.style.cursor = 'crosshair'; }
    const leave = () => { s.hover = null; };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', leave);

    let raf, last = 0;
    function frame(t) {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
      if (P.current.animate) s.phase += dt;
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
      <canvas ref={canvasRef} role="img" aria-label="Corte transversal de la esfera aislante con su carga, la superficie gaussiana de radio r y el campo eléctrico radial" style={{ touchAction: 'none' }} />
    </div>
  );
}
