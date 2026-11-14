import { useEffect, useRef } from 'react';
import { model, RAIL_LEN } from './physics.js';
import { nf } from '../shared/format.js';
import { eng } from '../shared/units.js';

const rgba = (hex, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Escena de cada modo: espira en B(t), barra deslizante o espira giratoria.
 *  Props: mode, p (parámetros), t (s), tokens, animate (hace circular la corriente). */
export default function InductionCanvas(props) {
  const wrapRef = useRef(null), canvasRef = useRef(null);
  const P = useRef(props);
  P.current = props;
  const st = useRef({ W: 0, H: 0, drift: 0, cache: { p: null, mode: null, m: null } });

  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d'), s = st.current;

    function resize() {
      const w = wrapRef.current.offsetWidth, h = wrapRef.current.offsetHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      s.W = w; s.H = h;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();

    const getModel = () => {
      const { mode, p } = P.current, c = s.cache;
      if (c.p !== p || c.mode !== mode) { c.p = p; c.mode = mode; c.m = model(mode, p); }
      return c.m;
    };

    /* ---------- utilidades de dibujo ---------- */
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
    /** Campo que sale (⊙, dir = 1) o entra (⊗, dir = −1) de la página. */
    function bsym(x, y, rad, dir, color, alpha = 1) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
      if (dir > 0) { ctx.beginPath(); ctx.arc(x, y, rad * 0.32, 0, Math.PI * 2); ctx.fill(); }
      else { const k = rad * 0.62; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    function lattice(dir, color, alpha, sp = 36, rad = 6.5) {
      for (let y = sp / 2; y < s.H; y += sp) for (let x = sp / 2; x < s.W; x += sp) bsym(x, y, rad, dir, color, alpha);
    }
    /** Flechitas que circulan por un polígono cerrado: `dir` = +1 sigue el orden de los puntos, −1 al revés. */
    function flow(pts, dir, drift, color, size, alpha) {
      const n = pts.length, seg = [];
      let tot = 0;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); tot += l; }
      if (tot < 30) return;
      const k = Math.max(2, Math.round(tot / 46)), sp = tot / k, off = ((drift % sp) + sp) % sp;
      ctx.fillStyle = color; ctx.globalAlpha = alpha;
      for (let j = 0; j < k; j++) {
        let d = (off + j * sp) % tot, i = 0;
        while (i < n - 1 && d > seg[i]) { d -= seg[i]; i++; }
        const a = pts[i], b = pts[(i + 1) % n], l = seg[i] || 1, ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
        const x = a[0] + ux * d, y = a[1] + uy * d, dx = ux * dir, dy = uy * dir;
        ctx.beginPath(); ctx.moveTo(x + dx * size, y + dy * size);
        ctx.lineTo(x - dx * size * 0.7 - dy * size * 0.75, y - dy * size * 0.7 + dx * size * 0.75);
        ctx.lineTo(x - dx * size * 0.7 + dy * size * 0.75, y - dy * size * 0.7 - dx * size * 0.75);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const path = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    const circlePts = (cx, cy, R, n = 72) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; });

    /* ---------- modo 1: espira circular en un campo B(t) ---------- */
    function drawField(m, t, T, mag, dirI) {
      const { W, H } = s, p = P.current.p, S = Math.min(W, H) / 44, cx = W / 2, cy = H / 2 + 6, Rp = p.r * S;
      const B = m.B(t), a = m.stats.Bmax ? Math.abs(B) / m.stats.Bmax : 0;
      if (a > 0.02) lattice(B > 0 ? 1 : -1, T.field, 0.1 + 0.6 * a);
      ctx.fillStyle = rgba(T.loop, 0.07); ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.fill();
      const turns = Math.min(m.N, 4);
      for (let i = 0; i < turns; i++) { ctx.strokeStyle = T.loop; ctx.globalAlpha = 1 - i * 0.18; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, Rp - i * 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (mag > 0) flow(circlePts(cx, cy, Rp - (turns - 1) * 2), dirI, s.drift, T.loop, 7, 0.55 + 0.45 * mag);
      // campo inducido en el centro: se opone al cambio de Φ
      if (mag > 0) {
        const bi = dirI > 0 ? 1 : -1;
        ctx.fillStyle = T.surface; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
        bsym(cx, cy, 11, bi, T.loop, 1);
        tag('B inducido', cx, cy + 34, T, T.loop, 'center');
      }
      tag(`r = ${nf(p.r, 1)} cm · N = ${p.N}`, cx, cy - Rp - 12, T, T.fg, 'center');
      tag(`B = ${nf(B, 2)} T ${B > 0 ? '⊙ (sale)' : B < 0 ? '⊗ (entra)' : ''}`, 10, 22, T, T.field);
    }

    /* ---------- modo 2: barra que se desliza sobre rieles ---------- */
    function drawBar(m, t, T, mag, dirI) {
      const { W, H } = s, p = P.current.p;
      const sc = Math.min((W - 120) / RAIL_LEN, (H - 150) / 0.5), x0 = (W - RAIL_LEN * sc) / 2 + 14, cy = H / 2 + 8;
      const yt = cy - (m.L * sc) / 2, yb = cy + (m.L * sc) / 2, xb = x0 + m.x(t) * sc, xEnd = x0 + RAIL_LEN * sc;
      lattice(p.dirB, T.field, 0.18 + 0.4 * Math.min(1, p.Bu / 2));
      // área del circuito (donde cambia el flujo)
      ctx.fillStyle = rgba(T.loop, 0.1); ctx.fillRect(x0, yt, xb - x0, yb - yt);
      // rieles, extremos y resistencia R
      ctx.strokeStyle = T.fg; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(xEnd, yt); ctx.moveTo(x0, yb); ctx.lineTo(xEnd, yb); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xEnd, yt - 7); ctx.lineTo(xEnd, yt + 7); ctx.moveTo(xEnd, yb - 7); ctx.lineTo(xEnd, yb + 7); ctx.stroke();
      const zl = Math.min(70, (yb - yt) * 0.55), z0 = cy - zl / 2, zig = 6;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(x0, z0);
      for (let i = 0; i < 6; i++) ctx.lineTo(x0 + (i % 2 ? -zig : zig), z0 + ((i + 0.5) / 6) * zl);
      ctx.lineTo(x0, z0 + zl); ctx.lineTo(x0, yb); ctx.stroke();
      tag(`R = ${nf(p.Rc, 1)} Ω`, x0 + 12, cy + 4, T, T.fg);
      // barra móvil
      ctx.strokeStyle = T.fg; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(xb, yt - 4); ctx.lineTo(xb, yb + 4); ctx.stroke();
      ctx.strokeStyle = T.surface; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xb, yt - 2); ctx.lineTo(xb, yb + 2); ctx.stroke();
      // corriente inducida (antihoraria si ε > 0)
      if (mag > 0) flow([[x0, yb], [xb, yb], [xb, yt], [x0, yt]], dirI, s.drift, T.loop, 7, 0.55 + 0.45 * mag);
      // cotas
      ctx.strokeStyle = T.muted; ctx.lineWidth = 1;
      const yd = yt - 22;
      ctx.beginPath(); ctx.moveTo(x0, yd); ctx.lineTo(xb, yd); ctx.moveTo(x0, yd - 5); ctx.lineTo(x0, yd + 5); ctx.moveTo(xb, yd - 5); ctx.lineTo(xb, yd + 5); ctx.stroke();
      tag(`x = ${nf(m.x(t) * 100, 1)} cm`, (x0 + xb) / 2, yd - 6, T, T.fg, 'center');
      tag(`L = ${nf(p.L, 0)} cm`, xb + 10, yt - 6, T, T.fg);
      // velocidad y fuerzas (la fuerza magnética se opone al movimiento; la externa la compensa)
      if (m.v > 0) {
        arrow(xb, yb + 26, 1, 0, 44, T.fg, 2.2, 5.5);
        tag(`v = ${nf(p.v, 0)} cm/s`, xb + 52, yb + 30, T, T.fg);
      }
      if (mag > 0) {
        const I = Math.abs(m.emf(t)) / p.Rc, F = I * m.L * p.Bu;
        arrow(xb - 6, cy, -1, 0, 46, T.out, 3, 6.5);
        arrow(xb + 6, cy, 1, 0, 46, T.in, 3, 6.5);
        tag(`F magnética = ${eng(F, 'N')}`, xb - 56, cy - 10, T, T.out, 'right');
        tag(`F externa = ${eng(F, 'N')}`, xb + 58, cy - 10, T, T.in);
      }
      tag(`B = ${nf(p.Bu, 2)} T ${p.dirB > 0 ? '⊙ (sale)' : '⊗ (entra)'}`, 10, 22, T, T.field);
    }

    /* ---------- modo 3: espira giratoria (generador) ---------- */
    function drawRot(m, t, T, mag, dirI) {
      const { W, H } = s, p = P.current.p;
      const lw = W * 0.62, c3x = lw * 0.5, c3y = H * 0.54, sc = Math.min(H / 34, lw / 36);
      const th = m.theta(t), ct = Math.cos(th), sn = Math.sin(th), a = p.a, b = p.b;
      const proj = (x, y, z) => [c3x + (x - 0.42 * z) * sc, c3y - (y - 0.3 * z) * sc];   // proyección oblicua (x → derecha, y → arriba, z → hacia el observador)
      // líneas de B (+x)
      ctx.globalAlpha = 0.5;
      for (let k = -2; k <= 2; k++) { const y = c3y + k * H * 0.15; arrow(14, y, 1, 0, lw - 30, T.field, 1.5, 5); }
      ctx.globalAlpha = 1;
      tag('B', lw - 14, c3y - H * 0.3 - 4, T, T.field);
      // eje de rotación (vertical)
      ctx.setLineDash([5, 5]); ctx.strokeStyle = T.muted; ctx.lineWidth = 1.3;
      const [ax, ay] = proj(0, a / 2 + 4.5, 0), [bx, by] = proj(0, -a / 2 - 4.5, 0);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      tag('eje', ax + 6, ay + 4, T, T.muted);
      // espira: esquinas en el orden antihorario visto desde la punta de n̂ (e1 = ŷ, e2 = ŵ, e1 × e2 = n̂)
      const wv = [sn, 0, ct], nv = [ct, 0, -sn];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([si, ti]) => proj((b / 2) * ti * wv[0], (a / 2) * si, (b / 2) * ti * wv[2]));
      ctx.fillStyle = rgba(T.loop, 0.12); path(corners); ctx.fill();
      const turns = Math.min(m.N, 3);
      for (let i = 0; i < turns; i++) {
        ctx.strokeStyle = T.loop; ctx.globalAlpha = 1 - i * 0.25; ctx.lineWidth = 3.4;
        path(corners.map(([x, y]) => [x + i * 3, y - i * 3])); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (mag > 0) flow(corners, dirI, s.drift, T.loop, 6.5, 0.6 + 0.4 * mag);
      // normal n̂
      const [n0x, n0y] = proj(0, 0, 0), [n1x, n1y] = proj(nv[0] * 8, 0, nv[2] * 8), nl = Math.hypot(n1x - n0x, n1y - n0y) || 1;
      arrow(n0x, n0y, (n1x - n0x) / nl, (n1y - n0y) / nl, nl, T.probe, 2.4, 6);
      tag('n̂', n1x + 6, n1y - 4, T, T.probe);

      // vista superior: B horizontal, espira de canto y ángulo θ
      const ix = W * 0.8, iy = H * 0.5, Ri = Math.min(W * 0.17, H * 0.34), sc2 = (0.9 * Ri) / 10, hl = (b / 2) * sc2, gap = Ri / 5;
      ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.fillStyle = rgba(T.surface, 0.6);
      ctx.beginPath(); ctx.arc(ix, iy, Ri + 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const ext = hl * Math.abs(ct);
      for (let k = -4; k <= 4; k++) {
        const y = iy + k * gap, inside = Math.abs(k * gap) <= ext + 1e-6;
        const half = Math.sqrt(Math.max(0, (Ri + 8) ** 2 - (k * gap) ** 2)) - 4;
        ctx.globalAlpha = inside ? 1 : 0.4;
        arrow(ix - half, y, 1, 0, 2 * half, inside ? T.loop : T.field, inside ? 2.4 : 1.4, inside ? 5 : 4);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = T.fg; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ix + hl * sn, iy + hl * ct); ctx.lineTo(ix - hl * sn, iy - hl * ct); ctx.stroke();
      arrow(ix, iy, ct, -sn, 0.8 * Ri, T.probe, 2.4, 6);
      tag('n̂', ix + ct * 0.8 * Ri + 8, iy - sn * 0.8 * Ri - 2, T, T.probe);
      const thm = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (thm > 0.02) { ctx.strokeStyle = T.probe; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ix, iy, 0.3 * Ri, -thm, 0); ctx.stroke(); }
      tag(`θ = ${nf((thm * 180) / Math.PI, 0)}°`, ix, iy - Ri - 18, T, T.probe, 'center');
      tag('Vista superior', ix, iy + Ri + 28, T, T.muted, 'center');
      tag(`${Math.round(Math.abs(ct) * 100)} % de B cruza (cos θ)`, ix, iy + Ri + 48, T, T.loop, 'center');
      tag(`B = ${nf(p.Bu, 2)} T · N = ${p.N} · ω = ${nf(p.w, 1)} rad/s`, 10, 22, T, T.field);
    }

    function draw() {
      const { tokens: T, t: tp } = P.current;
      const m = getModel(), t = Math.max(0, Math.min(tp, m.T)), { W, H } = s;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
      const emf = m.emf(t), mag = m.stats.emfAbs ? Math.min(1, Math.abs(emf) / m.stats.emfAbs) : 0, tiny = Math.abs(emf) < 1e-6 * (m.stats.emfAbs || 1);
      const dirI = emf > 0 ? 1 : -1, show = tiny ? 0 : Math.max(mag, 0.15);
      if (m.mode === 'field') drawField(m, t, T, show, dirI);
      else if (m.mode === 'bar') drawBar(m, t, T, show, dirI);
      else drawRot(m, t, T, show, dirI);
      tag(`Φ = ${eng(m.phi(t), 'Wb', 2, m.stats.phiAbs)} · ε = ${eng(emf, 'V', 2, m.stats.emfAbs)}`, 10, H - 12, T, T.fg);
    }

    let raf, last = 0;
    function frame(ts) {
      const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
      if (s.W) {
        if (P.current.animate) {
          const m = getModel(), t = Math.max(0, Math.min(P.current.t, m.T)), e = m.emf(t), mag = m.stats.emfAbs ? Math.abs(e) / m.stats.emfAbs : 0;
          s.drift += (e >= 0 ? 1 : -1) * (24 + 60 * mag) * dt;
        }
        draw();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div className="stage" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label="Escena de inducción electromagnética: campo magnético, espira o barra, corriente inducida y valores de flujo y fem" />
    </div>
  );
}
