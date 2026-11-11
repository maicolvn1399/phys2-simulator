import { useEffect, useRef } from 'react';
import { totalField, bzPlane, distToElement, arcPoint, sweepAt, segCourse, segLHS } from './physics.js';
import { toFrac } from './exact.js';

const HINTS = {
  seg: 'presiona y arrastra (se pega a 0°/90°; Shift: de 15° en 15°)',
  semi: 'presiona en el inicio y arrastra hacia donde sigue',
  inf: 'presiona y arrastra para dar la dirección',
  arc: 'presiona en el centro y arrastra hasta el radio',
  half: 'presiona en el centro y arrastra hasta el radio',
  circle: 'presiona en el centro y arrastra hasta el radio',
  free: 'presiona y dibuja la curva',
  probe: 'clic para poner P',
};
import { nf } from '../shared/format.js';

const TAU = Math.PI * 2;
const deg = r => (r * 180) / Math.PI;

/**
 * Lienzo de dibujo para Biot–Savart.
 * Herramientas: 'select' (mover / editar), 'seg' (arrastrar de A a B), 'arc' (centro → radio → barrido), 'probe' (colocar P).
 */
export default function BiotCanvas(props) {
  const wrapRef = useRef(null), canvasRef = useRef(null);
  const P = useRef(props);
  P.current = props;
  const st = useRef({ W: 0, H: 0, S: 1, CX: 0, CY: 0, half: props.view, flow: 0, sweepT: 0, drag: null, draft: null, hover: null, map: null, mapKey: '' });

  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d'), s = st.current;
    const toS = (x, y) => [s.CX + x * s.S, s.CY - y * s.S];
    const toW = (px, py) => [(px - s.CX) / s.S, (s.CY - py) / s.S];
    const recalc = () => { s.S = Math.min(s.W, s.H) / (2 * s.half); s.CX = s.W / 2; s.CY = s.H / 2; };

    function resize() {
      const r = { width: wrapRef.current.offsetWidth, height: wrapRef.current.offsetHeight }, dpr = Math.min(devicePixelRatio || 1, 2);
      s.W = r.width; s.H = r.height;
      cv.width = Math.round(s.W * dpr); cv.height = Math.round(s.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recalc();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();

    /* ---------- utilidades de dibujo ---------- */
    function arrow(x, y, dx, dy, len, color, lw = 2, head = 5) {
      const ex = x + dx * len, ey = y + dy * len;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - dx * head * 1.7 - dy * head, ey - dy * head * 1.7 + dx * head);
      ctx.lineTo(ex - dx * head * 1.7 + dy * head, ey - dy * head * 1.7 - dx * head);
      ctx.closePath(); ctx.fill();
    }
    /** Texto con subíndices: "x_P", "y_0", "φ_{ab}" se dibujan con el subíndice más pequeño y abajo. */
    const MAIN = '11.5px "JetBrains Mono", monospace', SUBF = '8.5px "JetBrains Mono", monospace';
    function richParts(text) {
      const out = []; const re = /_(\{[^}]*\}|.)/g; let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) out.push([text.slice(last, m.index), false]);
        out.push([m[1].replace(/^\{|\}$/g, ''), true]); last = re.lastIndex;
      }
      if (last < text.length) out.push([text.slice(last), false]);
      return out;
    }
    function tag(text, x, y, T, color, align = 'left') {
      if (!text) return;
      const parts = richParts(text);
      let tw = 0;
      for (const [t, sub] of parts) { ctx.font = sub ? SUBF : MAIN; tw += ctx.measureText(t).width; }
      const w = tw + 10;
      let x0 = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
      x0 = Math.max(2, Math.min(s.W - w - 2, x0));
      const y0 = Math.max(14, Math.min(s.H - 6, y));
      ctx.fillStyle = T.surface; ctx.globalAlpha = 0.9; ctx.fillRect(x0, y0 - 12, w, 17); ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.textAlign = 'left';
      let cx = x0 + 5;
      for (const [t, sub] of parts) { ctx.font = sub ? SUBF : MAIN; ctx.fillText(t, cx, sub ? y0 + 3 : y0); cx += ctx.measureText(t).width; }
      ctx.font = MAIN;
    }
    const symMode = () => P.current.labelMode === 'sym';
    const part0 = el => (s.partsById ? s.partsById.get(el.id) : null);
    /** Nombres simbólicos del triángulo y de los extremos de un tramo recto (como en las ecuaciones). */
    /** Coordenada como múltiplo de a, en texto: 0, a, −a, a/2, 3a/4; null si no es fracción simple. */
    function aTxt(v) {
      const r = toFrac(v / (P.current.aLen || 1));
      if (!r) return null;
      if (r.n === 0) return '0';
      const sgn = r.n < 0 ? '−' : '', pn = Math.abs(r.n);
      return r.d === 1 ? `${sgn}${pn === 1 ? '' : pn}a` : `${sgn}${pn === 1 ? '' : pn}a/${r.d}`;
    }
    const ptTxt = (x, y) => { const X = aTxt(x), Y = aTxt(y); return X !== null && Y !== null ? `(${X}; ${Y})` : `(${cm(x)}; ${cm(y)}) cm`; };
    /** Nombres del triángulo en términos de a (como en el examen): c.o. = a, c.a. = |a/2 − y|, hip. = √(a² + (a/2 − y)²). */
    function segNames(e) {
      const pr = P.current.probe, A = P.current.aLen || 1;
      const dx = e.bx - e.ax, dy = e.by - e.ay;
      const kind = Math.abs(dy) < 1e-12 ? 'h' : Math.abs(dx) < 1e-12 ? 'v' : 'i';
      const out = { Q: (x, y) => ptTxt(x, y), CO: '', CA: '', H: '|r|' };
      if (Math.abs(pr.z || 0) > 1e-9) return out;
      if (kind === 'i') {
        // inclinado sobre y = mx + b (como en las ecuaciones)
        out.CO = '= |y_P − b − m·x_P| / √(1 + m²)';
        out.CA = '= |(x_P − x) + m(y_P − mx − b)| / √(1 + m²)';
        out.H = '= √((x_P − x)² + (y_P − mx − b)²)';
        return out;
      }
      const perp = kind === 'v' ? toFrac(Math.abs(pr.x - e.ax) / A) : toFrac(Math.abs(pr.y - e.ay) / A);
      const cP = kind === 'v' ? toFrac(pr.y / A) : toFrac(pr.x / A);
      if (!perp || !cP) {
        // posiciones que no son fracciones simples de a: forma general con x_P, y_P
        if (kind === 'v') { out.CO = '= |x_P − x₀|'; out.CA = '= |y_P − y|'; out.H = '= √((x_P − x₀)² + (y_P − y)²)'; }
        else { out.CO = '= |y_P − y₀|'; out.CA = '= |x_P − x|'; out.H = '= √((x_P − x)² + (y_P − y₀)²)'; }
        return out;
      }
      const v = kind === 'v' ? 'y' : 'x';
      const fr = r => (r.n === 0 ? '0' : r.d === 1 ? `${Math.abs(r.n) === 1 ? '' : Math.abs(r.n)}a` : `${Math.abs(r.n) === 1 ? '' : Math.abs(r.n)}a/${r.d}`);
      const cTxt = cP.n === 0 ? null : `${cP.n < 0 ? '−' : ''}${fr(cP)}`;
      const diff = cTxt ? `${cTxt} − ${v}` : `${v}`;
      const q = { n: perp.n * perp.n, d: perp.d * perp.d };
      const sq = q.d === 1 ? `${q.n === 1 ? '' : q.n}a²` : `${q.n === 1 ? '' : q.n}a²/${q.d}`;
      out.CO = `= ${fr(perp)}`;
      out.CA = `= |${diff}|`;
      out.H = `= √(${sq} + (${diff})²)`;
      return out;
    }
    function sym(x, y, r, out, color, lw = 1.6) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (out) { ctx.beginPath(); ctx.arc(x, y, Math.max(1.4, r * 0.32), 0, TAU); ctx.fill(); }
      else { const k = r * 0.62; ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke(); }
    }
    const cm = v => nf(v * 100, 1);
    const layers0 = () => P.current.layers;
    const far = () => s.half * 12;
    /** Ramer–Douglas–Peucker: reduce los puntos del trazo a mano conservando la forma. */
    function simplify(pts, eps) {
      if (pts.length < 3) return pts;
      const [a, b] = [pts[0], pts[pts.length - 1]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12;
      let idx = 0, dmax = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = L > 1e-9 ? Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
        if (d > dmax) { dmax = d; idx = i; }
      }
      if (dmax <= eps) return [a, b];
      return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
    }

    /** Puntos de un elemento en pantalla para recorrerlo (incluye las prolongaciones al infinito). */
    function segRange(e) {
      const L = Math.hypot(e.bx - e.ax, e.by - e.ay), lx = (e.bx - e.ax) / L, ly = (e.by - e.ay) / L;
      return { L, lx, ly, t0: e.infA ? -far() : 0, t1: e.infB ? L + far() : L };
    }
    function pathElement(e) {
      ctx.beginPath();
      if (e.type === 'poly') { e.pts.forEach((q, k) => (k ? ctx.lineTo(...toS(...q)) : ctx.moveTo(...toS(...q)))); }
      else if (e.type === 'seg') {
        const { lx, ly, t0, t1 } = segRange(e);
        ctx.moveTo(...toS(e.ax + t0 * lx, e.ay + t0 * ly)); ctx.lineTo(...toS(e.ax + t1 * lx, e.ay + t1 * ly));
      } else {
        const [cx, cy] = toS(e.cx, e.cy);
        ctx.arc(cx, cy, e.R * s.S, -e.p1, -e.p2, e.p2 > e.p1);
      }
    }
    /** Posición en pantalla y dirección de la corriente a una distancia `u` (m) a lo largo del elemento. */
    function along(e, u) {
      if (e.type === 'poly') {
        for (let k = 1; k < e.pts.length; k++) {
          const a = e.pts[k - 1], b = e.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
          if (u <= L || k === e.pts.length - 1) { const f = Math.min(1, u / L); return { p: toS(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), d: [(b[0] - a[0]) / L, -(b[1] - a[1]) / L] }; }
          u -= L;
        }
      }
      if (e.type === 'seg') {
        const { lx, ly, t0 } = segRange(e);
        const t = t0 + u;
        return { p: toS(e.ax + t * lx, e.ay + t * ly), d: [lx, -ly] };
      }
      const sg = Math.sign(e.p2 - e.p1) || 1, phi = e.p1 + (sg * u) / e.R;
      return { p: toS(...arcPoint(e, phi)), d: [-Math.sin(phi) * sg, -Math.cos(phi) * sg] };
    }
    const polyLen = e => e.pts.slice(1).reduce((t, q, k) => t + Math.hypot(q[0] - e.pts[k][0], q[1] - e.pts[k][1]), 0);
    const lengthOf = e => (e.type === 'poly' ? polyLen(e) : e.type === 'seg' ? segRange(e).t1 - segRange(e).t0 : Math.abs(e.p2 - e.p1) * e.R);

    /** Extremos (inicio, final) de un elemento; null si ese extremo está en el infinito. */
    function ends(e) {
      if (e.type === 'seg') return [e.infA ? null : [e.ax, e.ay], e.infB ? null : [e.bx, e.by]];
      if (e.type === 'poly') return [e.pts[0], e.pts[e.pts.length - 1]];
      return [arcPoint(e, e.p1), arcPoint(e, e.p2)];
    }
    /**
     * Encadena los tramos conectados (el final de uno es el inicio del siguiente) y da a cada uno el
     * desplazamiento acumulado a lo largo del circuito, para que las cargas fluyan sin saltos.
     * En un circuito cerrado se ajusta el espaciado para que la vuelta completa tenga un número entero de cargas.
     */
    function chainOffsets(elements) {
      const base = 26 / s.S, tol = 1e-4, out = new Map();
      const same = (a, b) => a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
      const E = elements.map(e => ({ e, ends: ends(e), L: lengthOf(e) }));
      const prev = new Map(), next = new Map();
      for (const a of E) for (const b of E) {
        if (a === b || next.has(a.e.id) || prev.has(b.e.id)) continue;
        if (same(a.ends[1], b.ends[0])) { next.set(a.e.id, b); prev.set(b.e.id, a); }
      }
      const done = new Set();
      for (const start of E) {
        if (done.has(start.e.id)) continue;
        // retroceder hasta la cabeza de la cadena (o detectar un lazo)
        let head = start, seen = new Set([start.e.id]), loop = false;
        while (prev.has(head.e.id)) { const p = prev.get(head.e.id); if (seen.has(p.e.id)) { loop = true; break; } seen.add(p.e.id); head = p; }
        const chain = []; let cur = head; const vis = new Set();
        while (cur && !vis.has(cur.e.id)) { vis.add(cur.e.id); chain.push(cur); cur = next.get(cur.e.id); }
        const total = chain.reduce((t, c) => t + c.L, 0);
        const spacing = loop ? total / Math.max(1, Math.round(total / base)) : base;
        let acc = 0;
        for (const c of chain) { out.set(c.e.id, { off: acc, spacing }); done.add(c.e.id); acc += c.L; }
      }
      return out;
    }

    /* ---------- ajuste a la cuadrícula y a puntos existentes ---------- */
    const gridStep = () => (s.half > 0.3 ? 0.01 : 0.005);
    function snapPt(x, y, skipId) {
      const { elements, probe } = P.current;
      const cands = [[probe.x, probe.y]];
      for (const e of elements) {
        if (e.id === skipId) continue;
        if (e.type === 'seg') { cands.push([e.ax, e.ay], [e.bx, e.by]); }
        else if (e.type === 'poly') { cands.push(e.pts[0], e.pts[e.pts.length - 1]); }
        else { cands.push([e.cx, e.cy], arcPoint(e, e.p1), arcPoint(e, e.p2)); }
      }
      let best = null, bd = 11 / s.S;
      for (const c of cands) { const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = c; } }
      if (best) return [best[0], best[1]];
      if (!P.current.snap) return [x, y];
      const g = gridStep();
      return [Math.round(x / g) * g, Math.round(y / g) * g];
    }
    const snapAng = a => (P.current.snap ? Math.round(a / (Math.PI / 12)) * (Math.PI / 12) : a);
    /**
     * Extremo de un tramo recto que sale de `a`: se pega a puntos existentes; si no, con el ajuste activo
     * la dirección va de 15° en 15° y el largo en pasos de la cuadrícula. Además, si la recta pasa a pocos
     * píxeles de P, se alinea para que pase exactamente por P (así un tramo radial da B = 0 exacto).
     */
    function snapSegEnd(a, wx, wy, skipId, shift) {
      // 1) puntos existentes (extremos, centros, P): imán de 11 px
      const pr = P.current.probe;
      const cands = [[pr.x, pr.y]];
      for (const e of P.current.elements) {
        if (e.id === skipId) continue;
        if (e.type === 'seg') cands.push([e.ax, e.ay], [e.bx, e.by]);
        else if (e.type === 'arc') cands.push([e.cx, e.cy], arcPoint(e, e.p1), arcPoint(e, e.p2));
      }
      for (const c of cands) if (Math.hypot(c[0] - wx, c[1] - wy) * s.S < 11) { s.alignP = false; return [c[0], c[1]]; }
      const L = Math.hypot(wx - a[0], wy - a[1]);
      if (L < 1e-9) return [wx, wy];
      let ux = (wx - a[0]) / L, uy = (wy - a[1]) / L;
      // 2) Shift: dirección de 15° en 15°. Sin Shift: imán suave hacia horizontal/vertical (±7°) y diagonales (±3°)
      let axisSnap = null;
      {
        const ang = Math.atan2(uy, ux), step = Math.PI / 12;
        const q90 = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2), q45 = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        let snapTo = null;
        if (shift) snapTo = Math.round(ang / step) * step;
        else if (Math.abs(ang - q90) < (7 * Math.PI) / 180) snapTo = q90;
        else if (Math.abs(ang - q45) < (3 * Math.PI) / 180) snapTo = q45;
        if (snapTo !== null) {
          ux = Math.cos(snapTo); uy = Math.sin(snapTo);
          const k = Math.round(snapTo / (Math.PI / 2));
          if (Math.abs(snapTo - k * (Math.PI / 2)) < 1e-9) { axisSnap = (((k % 4) + 4) % 4) % 2 === 0 ? 'h' : 'v'; ux = Math.round(ux); uy = Math.round(uy); }
        }
      }
      // 3) imán hacia la recta que pasa por P (14 px): así un tramo radial da B = 0 exacto
      const qx = pr.x - a[0], qy = pr.y - a[1], qd = Math.hypot(qx, qy);
      s.alignP = false;
      if (qd > 1e-9) {
        const distLine = Math.abs((wx - a[0]) * qy - (wy - a[1]) * qx) / qd;   // distancia del puntero a la recta a→P
        if (distLine * s.S < 14) {
          const sg = (wx - a[0]) * qx + (wy - a[1]) * qy >= 0 ? 1 : -1;
          ux = (sg * qx) / qd; uy = (sg * qy) / qd; s.alignP = true;
        }
      }
      // 4) con el ajuste activo, el extremo cae en la cuadrícula: así todas las coordenadas son múltiplos
      //    simples de a y las ecuaciones se pueden escribir con variables (a, a/2, 3a/4…)
      const g = gridStep(), on = P.current.snap, rg = v => Math.round(v / g) * g;
      if (s.alignP) {
        if (!on) return [a[0] + L * ux, a[1] + L * uy];
        // sobre la recta a→P, con la coordenada dominante en la cuadrícula
        const dom = Math.abs(qx) >= Math.abs(qy) ? 0 : 1, qd0 = dom === 0 ? qx : qy;
        const t = rg(L * (dom === 0 ? ux : uy)) / qd0;
        return t === 0 ? [a[0] + L * ux, a[1] + L * uy] : [a[0] + t * qx, a[1] + t * qy];
      }
      if (axisSnap === 'h') return [a[0] + (on ? rg(L * ux) : L * ux), a[1]];   // exactamente horizontal
      if (axisSnap === 'v') return [a[0], a[1] + (on ? rg(L * uy) : L * uy)];   // exactamente vertical
      if (!on) return [a[0] + L * ux, a[1] + L * uy];
      if (Math.abs(Math.abs(ux) - Math.abs(uy)) < 1e-9) { const d = rg(L * Math.abs(ux)); return [a[0] + Math.sign(ux) * d, a[1] + Math.sign(uy) * d]; } // 45° exacto
      return [a[0] + rg(L * ux), a[1] + rg(L * uy)];
    }
    const snapLen = r => (P.current.snap ? Math.max(gridStep(), Math.round(r / gridStep()) * gridStep()) : r);
    const unwrapNear = (a, ref) => a + TAU * Math.round((ref - a) / TAU);

    /* ---------- mapa de Bz en el plano ---------- */
    function fieldMap() {
      const { elements, I } = P.current;
      const key = JSON.stringify(elements) + I + s.W + 'x' + s.H + s.half.toFixed(5);
      if (key === s.mapKey) return s.map;
      const sp = Math.max(24, Math.min(34, s.W / 26)), pts = [];
      for (let py = sp / 2; py < s.H; py += sp) for (let px = sp / 2; px < s.W; px += sp) {
        const [x, y] = toW(px, py);
        pts.push([px, py, elements.length ? bzPlane(elements, x, y, I) : 0]);
      }
      s.map = pts; s.mapKey = key;
      return pts;
    }

    /* ---------- dibujo ---------- */
    let last = performance.now(), raf = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const props = P.current, T = props.tokens;
      const { elements, probe, I, sel, layers, animate } = props;
      // zoom suave
      if (Math.abs(s.half - props.view) > 1e-5) {
        s.half += (props.view - s.half) * 0.2; if (Math.abs(s.half - props.view) < 1e-4) s.half = props.view;
        recalc();
      }
      if (animate) { s.flow += dt; s.sweepT += dt; }
      const { W, H } = s;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);

      // cuadrícula
      const minor = s.S * 0.01 >= 7 ? 0.01 : 0.05, major = s.half > 0.3 ? 0.1 : 0.05;
      const lab = s.half <= 0.1 ? 0.02 : s.half <= 0.2 ? 0.05 : 0.1;
      const nMax = Math.ceil((W / s.S) / minor) + 2;
      for (let i = -nMax; i <= nMax; i++) {
        const v = i * minor, [px] = toS(v, 0), [, py] = toS(0, v);
        const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        ctx.strokeStyle = isMajor ? T.line : T.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      }
      ctx.strokeStyle = T.muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, s.CY); ctx.lineTo(W, s.CY); ctx.moveTo(s.CX, 0); ctx.lineTo(s.CX, H); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = T.muted; ctx.font = '10.5px "JetBrains Mono", monospace';
      for (let i = -60; i <= 60; i++) {
        const v = i * lab; if (!i) continue;
        const [px] = toS(v, 0), [, py] = toS(0, v), t = String(Math.round(v * 100));
        if (px > 14 && px < W - 14) { ctx.textAlign = 'center'; ctx.fillText(t, px, s.CY + 14); }
        if (py > 14 && py < H - 10) { ctx.textAlign = 'right'; ctx.fillText(t, s.CX - 5, py + 4); }
      }
      ctx.textAlign = 'left'; ctx.fillText('x (cm)', W - 48, s.CY - 6); ctx.fillText('y (cm)', s.CX + 6, 14);

      // mapa de B en el plano: ⊙ sale, ⊗ entra; opacidad según log|B|
      if (layers.map && elements.length) {
        for (const [px, py, bz] of fieldMap()) {
          if (!Number.isFinite(bz) || Math.abs(bz) < 1e-9) continue;
          const a = Math.max(0, Math.min(1, (Math.log10(Math.abs(bz)) + 6.6) / 2.4));
          if (a < 0.04) continue;
          ctx.globalAlpha = 0.12 + 0.6 * a;
          sym(px, py, 2.6 + 2.6 * a, bz > 0, bz > 0 ? T.out : T.in, 1.2);
        }
        ctx.globalAlpha = 1;
      }

      const { parts, B } = totalField(elements, { x: probe.x, y: probe.y, z: probe.z }, I);
      s.partsById = new Map(elements.map((el, k) => [el.id, parts[k]]));
      const selIdx = elements.findIndex(e => e.id === sel);
      const selEl = elements[selIdx], selPart = parts[selIdx];
      const [ppx, ppy] = toS(probe.x, probe.y);

      // geometría del elemento elegido (d, β, φ)
      if (layers.geo && selEl && !s.draft) drawGeometry(selEl, selPart, ppx, ppy, T);

      // alambres
      const chains = chainOffsets(elements);
      elements.forEach((e, i) => {
        const isSel = e.id === sel;
        ctx.lineCap = 'round';
        if (isSel) { pathElement(e); ctx.strokeStyle = T.loop; ctx.globalAlpha = 0.25; ctx.lineWidth = 11; ctx.stroke(); ctx.globalAlpha = 1; }
        pathElement(e); ctx.strokeStyle = T.fg; ctx.lineWidth = 3.4; ctx.stroke();
        // cargas en movimiento: el sentido de la corriente se ve como un flujo
        // los tramos conectados comparten la misma fase: el flujo se ve continuo en todo el circuito
        const Lm = lengthOf(e), ch = chains.get(e.id), spacing = ch.spacing, speed = (14 + I * 3) / s.S;
        const off = ((((s.flow * speed - ch.off) % spacing) + spacing) % spacing);
        ctx.fillStyle = T.probe;
        for (let u = off; u < Lm; u += spacing) {
          const { p } = along(e, u);
          if (p[0] < -10 || p[0] > W + 10 || p[1] < -10 || p[1] > H + 10) continue;
          ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, TAU); ctx.fill();
        }
        // flecha de la corriente y número
        let mid;
        if (e.type === 'seg') {
          const { lx, ly } = segRange(e);
          const L = Math.hypot(e.bx - e.ax, e.by - e.ay);
          const um = e.infA && !e.infB ? L - Math.min(L, 0.6 * s.half) / 2 : e.infB && !e.infA ? Math.min(L, 0.6 * s.half) / 2 : L / 2;
          mid = { p: toS(e.ax + um * lx, e.ay + um * ly), d: [lx, -ly] };
        } else mid = along(e, Lm / 2);
        arrow(mid.p[0] - mid.d[0] * 8, mid.p[1] - mid.d[1] * 8, mid.d[0], mid.d[1], 10, T.fg, 2.6, 5.5);
        ctx.font = '600 12px "IBM Plex Sans Condensed", sans-serif';
        const nx = -mid.d[1], ny = mid.d[0];
        const bx = mid.p[0] + nx * 16, by = mid.p[1] + ny * 16;
        ctx.fillStyle = isSel ? T.loop : T.surface; ctx.strokeStyle = isSel ? T.loop : T.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = isSel ? T.surface : T.fg; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), bx, by + 4); ctx.textAlign = 'left';
        // extremos finitos e infinitos
        if (e.type === 'seg') {
          const { lx, ly } = segRange(e);
          for (const [ex, ey, inf, sgn] of [[e.ax, e.ay, e.infA, -1], [e.bx, e.by, e.infB, 1]]) {
            const [px, py] = toS(ex, ey);
            if (!inf) { ctx.fillStyle = T.fg; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fill(); }
            else {
              // marca ∞ cerca del borde visible
              let tt = 0; const step = 4;
              let qx = px, qy = py;
              while (tt < 3000 && qx > 18 && qx < W - 18 && qy > 18 && qy < H - 18) { qx += sgn * lx * step; qy -= sgn * ly * step; tt += step; }
              ctx.font = '600 15px "IBM Plex Sans Condensed", sans-serif'; ctx.fillStyle = T.muted; ctx.textAlign = 'center';
              ctx.fillText('∞', qx - ly * 12 * sgn, qy - lx * 12 * sgn + 5); ctx.textAlign = 'left';
            }
          }
          if (isSel) {
            const away = (x, y) => { const vx = x - probe.x, vy = y - probe.y, m = Math.hypot(vx, vy) || 1; return [vx / m, -vy / m]; };
            const nm = symMode() ? segNames(e) : null;
            if (!e.infA) tagAt(nm ? `Q₁ ${nm.Q(e.ax, e.ay)}` : `Q₁ (${cm(e.ax)}; ${cm(e.ay)})`, toS(e.ax, e.ay), away(e.ax, e.ay), T, T.fg);
            if (!e.infB) tagAt(nm ? `Q₂ ${nm.Q(e.bx, e.by)}` : `Q₂ (${cm(e.bx)}; ${cm(e.by)})`, toS(e.bx, e.by), away(e.bx, e.by), T, T.fg);
          }
        } else if (e.type === 'poly') {
          for (const q of [e.pts[0], e.pts[e.pts.length - 1]]) { const [px, py] = toS(...q); ctx.fillStyle = T.fg; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fill(); }
        } else {
          for (const ph of [e.p1, e.p2]) { const [px, py] = toS(...arcPoint(e, ph)); ctx.fillStyle = T.fg; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fill(); }
          if (isSel && Math.hypot(e.cx - probe.x, e.cy - probe.y) > 0.004) tag(symMode() ? 'C' : `C (${cm(e.cx)}; ${cm(e.cy)})`, toS(e.cx, e.cy)[0] + 8, toS(e.cx, e.cy)[1] + 18, T, T.fg);
        }
      });

      // en modo Seleccionar, resaltar el cable bajo el puntero
      if ((props.tool === 'pick' || props.tool === 'erase') && s.hover) {
        const [hwx, hwy] = toW(...s.hover);
        let hb = null, hd = 12 / s.S;
        for (const e of elements) { const d = distToElement(e, hwx, hwy, far()); if (d < hd) { hd = d; hb = e; } }
        s.hoverEl = hb ? hb.id : null;
        if (hb && props.tool === 'erase') { pathElement(hb); ctx.strokeStyle = T.out; ctx.globalAlpha = 0.45; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1; tag('clic para eliminar', s.hover[0] + 12, s.hover[1] + 22, T, T.out); }
        else if (hb && hb.id !== sel) { pathElement(hb); ctx.strokeStyle = T.loop; ctx.globalAlpha = 0.18; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1; }
        cv.style.cursor = hb ? 'pointer' : 'default';
      } else if (props.tool !== 'pick' && props.tool !== 'erase') cv.style.cursor = '';
      // manijas del elemento elegido
      if (selEl && props.tool === 'select') for (const h of handles(selEl)) {
        const [hx, hy] = toS(h.x, h.y);
        ctx.fillStyle = T.surface; ctx.strokeStyle = T.loop; ctx.lineWidth = 2;
        ctx.beginPath(); h.k === 'C' ? ctx.rect(hx - 5, hy - 5, 10, 10) : ctx.arc(hx, hy, 6, 0, TAU); ctx.fill(); ctx.stroke();
      }

      // recorrido de la integral: dl avanza entre los límites y se dibuja r hacia P
      if (layers.sweep && selEl && selPart && !selPart.singular && !(selPart.onLine) && !s.draft) {
        const cycle = 3.4, t = Math.min(1, (s.sweepT % (cycle + 0.8)) / cycle);
        const sw = sweepAt(selEl, { x: probe.x, y: probe.y, z: probe.z }, I, selPart, t);
        if (sw) {
          const [qx, qy] = toS(...sw.pos);
          const rx = ppx - qx, ry = ppy - qy, rl = Math.hypot(rx, ry);
          if (rl > 4) {
            ctx.setLineDash([5, 4]); ctx.strokeStyle = T.loop; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.45;
            ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(ppx, ppy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
            arrow(ppx - (rx / rl) * 22, ppy - (ry / rl) * 22, rx / rl, ry / rl, 10, T.loop, 1.6, 4);
            if (!(selEl.type === 'seg' || selEl.type === 'poly')) tag('r', qx + rx * 0.5 + 6, qy + ry * 0.5 - 4, T, T.loop);
          }
          // triángulo desde dl: cateto adyacente (sobre el alambre), cateto opuesto (hasta P) e hipotenusa = r
          const foot = selEl.type === 'seg' ? selPart.foot : selEl.type === 'poly' ? selPart.pieces[sw.piece - 1].foot : null;
          if (foot && rl > 30) {
            const [fx2, fy2] = toS(...foot);
            ctx.fillStyle = T.probe; ctx.globalAlpha = 0.1;
            ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(fx2, fy2); ctx.lineTo(ppx, ppy); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
            ctx.strokeStyle = T.probe; ctx.lineWidth = 1.6; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(fx2, fy2); ctx.lineTo(ppx, ppy); ctx.stroke(); ctx.lineWidth = 1.3;
            const caL = Math.hypot(sw.pos[0] - foot[0], sw.pos[1] - foot[1]), coL = selEl.type === 'seg' ? selPart.d : selPart.pieces[sw.piece - 1].d;
            const nmT = symMode() && selEl.type === 'seg' ? segNames(selEl) : null;
            const symP = symMode();
            // en el dibujo solo etiquetas cortas; los valores van en un recuadro fijo arriba a la izquierda
            if (caL * s.S > 18) tag('c.a.', (qx + fx2) / 2 + 8, (qy + fy2) / 2 + 4, T, T.probe);
            tag('c.o.', (fx2 + ppx) / 2, (fy2 + ppy) / 2 - 8, T, T.probe, 'center');
            tag('hip.', qx + rx * 0.35 - 8, qy + ry * 0.35 - 8, T, T.loop, 'right');
            const thDeg = Math.acos(Math.max(-1, Math.min(1, (sw.dir[0] * rx - sw.dir[1] * ry) / rl))) * 180 / Math.PI;
            const box = symP && nmT && nmT.CO
              ? [[`cateto opuesto (c.o.) ${nmT.CO}`, T.probe], [`cateto adyacente (c.a.) ${nmT.CA}`, T.probe], [`hipotenusa (hip.) = |r| ${nmT.H.replace(/^= /, '= ')}`, T.loop]]
              : [[`cateto opuesto (c.o.) = ${cm(coL)} cm`, T.probe], [`cateto adyacente (c.a.) = ${cm(caL)} cm`, T.probe], [`hipotenusa (hip.) = |r| = ${cm(Math.hypot(caL, coL))} cm`, T.loop]];
            box.push([symP ? 'sen θ = c.o. / hip.' : `sen θ = c.o. / hip. = ${nf(coL / Math.hypot(caL, coL), 3)}`, T.fg]);
            if (thDeg > 90.05) box.push([symP ? 'θ > 90°: en el triángulo va π − θ, y sen(π − θ) = sen θ' : `θ = ${nf(thDeg, 1)}° > 90°: en el triángulo va 180° − θ = ${nf(180 - thDeg, 1)}°`, T.fg]);
            box.forEach(([t, c], k2) => tag(t, 10, 22 + k2 * 19, T, c));
          }
          if (selEl.type === 'arc') {
            // en el arco la variable de integración es φ: el radio barre desde el inicio hasta dl
            const [ccx, ccy] = toS(selEl.cx, selEl.cy), Rp = selEl.R * s.S, rw = Math.max(18, Math.min(46, Rp * 0.55));
            ctx.fillStyle = T.field; ctx.globalAlpha = 0.16;
            ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.arc(ccx, ccy, rw, -selEl.p1, -sw.phi, selEl.p2 > selEl.p1); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
            ctx.strokeStyle = T.field; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(qx, qy); ctx.stroke(); ctx.lineWidth = 1.3;
            const swept = Math.abs(sw.phi - selEl.p1), pm2 = (selEl.p1 + sw.phi) / 2;
            const phiTxt = symMode() ? 'φ (recorrido desde el inicio)' : `φ = ${nf(((deg(sw.phi) % 360) + 360) % 360, 1)}° · recorrido ${nf(deg(swept), 1)}°`;
            tag(phiTxt, ccx + Math.cos(pm2) * (rw + 12), ccy - Math.sin(pm2) * (rw + 12) + 4, T, T.field, Math.cos(pm2) < -0.3 ? 'right' : Math.cos(pm2) > 0.3 ? 'left' : 'center');
          }
          arrow(qx, qy, sw.dir[0], -sw.dir[1], 34, T.field, 3.4, 5.5);
          if (rl > 30) {
            // r̂: vector unitario desde dl hacia P, mismo largo y grosor que dl
            const urx = rx / rl, ury = ry / rl;
            arrow(qx, qy, urx, ury, 34, T.loop, 3.4, 5.5);
            tag('r̂', qx + urx * 42 - 4, qy + ury * 42 - 8, T, T.loop);
          }
          if (rl > 30) {
            // ángulo θ entre dl y r̂ en el elemento que se mueve
            const a0 = Math.atan2(-sw.dir[1], sw.dir[0]), a1 = Math.atan2(ry, rx);
            let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
            ctx.strokeStyle = T.probe; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(qx, qy, 16, a0, a0 + da, da < 0); ctx.stroke(); ctx.lineWidth = 1.3;
            const am = a0 + da / 2;
            const th = Math.abs(deg(da));
            if (selEl.type === 'arc' && selPart.centered) tag(symMode() ? 'θ = 90° siempre (dl ⟂ r̂)' : `θ = ${nf(th, 1)}° siempre (dl ⟂ r̂)`, ppx + 26, ppy + 42, T, T.probe);
            else tag(symMode() ? 'θ' : `θ = ${nf(th, 1)}°`, qx + Math.cos(am) * 30, qy + Math.sin(am) * 30 + 4, T, T.probe, Math.cos(am) < -0.3 ? 'right' : Math.cos(am) > 0.3 ? 'left' : 'center');
            if (th > 90.05) {
              // ángulo interior del triángulo (π − θ), entre −dl y r
              const b0 = a0 + Math.PI; let db = a1 - b0; while (db > Math.PI) db -= TAU; while (db < -Math.PI) db += TAU;
              ctx.strokeStyle = T.loop; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
              ctx.beginPath(); ctx.arc(qx, qy, 22, b0, b0 + db, db < 0); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1.3;
            }
          }
          ctx.fillStyle = T.field; ctx.beginPath(); ctx.arc(qx, qy, 4, 0, TAU); ctx.fill();
          tag('dl', qx + sw.dir[0] * 40 + 4, qy - sw.dir[1] * 40 + 4, T, T.field);
          // signo de dB en P (componente z de dl × r)
          const dBz = sw.dir[0] * (probe.y - sw.pos[1]) - sw.dir[1] * (probe.x - sw.pos[0]);
          if (Math.abs(probe.z) < 1e-6 && Math.abs(dBz) > 1e-9) sym(ppx - 22, ppy - 22, 6, dBz > 0, dBz > 0 ? T.out : T.in, 1.8);
          // barra de avance de la integral
          const bw = Math.min(230, W - 24), bx0 = 12, by0 = H - 16;
          ctx.fillStyle = T.surface; ctx.globalAlpha = 0.92; ctx.fillRect(bx0 - 6, by0 - 30, bw + 12, 40); ctx.globalAlpha = 1;
          ctx.font = '11.5px "JetBrains Mono", monospace'; ctx.fillStyle = T.fg;
          const lhs = selEl.type === 'seg' ? segLHS(selEl, selPart, probe) : null, segAx = lhs ? (lhs.axis === 'y' ? 'y' : 'x') : null;
          const qNow = lhs ? (sw.pos[0] - lhs.O[0]) * lhs.l[0] + (sw.pos[1] - lhs.O[1]) * lhs.l[1] : 0;
          const lim = selEl.type === 'seg' ? `${segAx} = ${symMode() ? (aTxt(segAx === 'x' ? sw.pos[0] : sw.pos[1]) ?? cm(segAx === 'x' ? sw.pos[0] : sw.pos[1])) : cm(segAx === 'x' ? sw.pos[0] : sw.pos[1]) + ' cm'}` : selEl.type === 'poly' ? `la pieza ${sw.piece}` : `φ = ${nf(((deg(sw.phi) % 360) + 360) % 360, 1)}°`;
          const limS = selEl.type === 'seg' ? `hasta ${segAx}` : selEl.type === 'poly' ? `hasta la pieza ${sw.piece}` : 'de φ_a hasta φ';
          tag(`∫ tramo ${selIdx + 1} ${symMode() ? limS : 'hasta ' + lim}: ${nf(Math.max(-999, Math.min(999, sw.frac * 100)), 0)} %`, bx0 - 5, by0 - 14, T, T.fg);
          ctx.fillStyle = T.surface2; ctx.fillRect(bx0, by0 - 6, bw, 7);
          ctx.fillStyle = T.loop; ctx.fillRect(bx0, by0 - 6, bw * Math.max(0, Math.min(1, sw.frac)), 7);
        }
      }

      // P y el campo total
      const bz = B[2], bxy = Math.hypot(B[0], B[1]), mag = Math.hypot(B[0], B[1], B[2]);
      if (mag > 1e-12) {
        const ringR = 13 + Math.min(10, Math.max(0, (Math.log10(Math.abs(bz) + 1e-15) + 7) * 3));
        if (Math.abs(bz) > 1e-12) sym(ppx, ppy, ringR, bz > 0, bz > 0 ? T.out : T.in, 2.2);
        if (bxy > 1e-12) {
          const len = 26 + Math.min(40, Math.max(0, (Math.log10(bxy) + 7) * 14));
          arrow(ppx, ppy, B[0] / bxy, -B[1] / bxy, len, T.probe, 2.6, 5);
        }
      }
      ctx.fillStyle = T.probe; ctx.strokeStyle = T.surface; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ppx, ppy, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.font = '600 13px "IBM Plex Sans Condensed", sans-serif'; ctx.fillStyle = T.fg; ctx.fillText('P', ppx + 8, ppy - 8);
      const zTxt = Math.abs(probe.z) > 1e-9 ? `; ${cm(probe.z)}` : '';
      tag(symMode() ? `P ${ptTxt(probe.x, probe.y)}` : `(${cm(probe.x)}; ${cm(probe.y)}${zTxt}) cm`, ppx + 26, ppy + 6, T, T.fg);
      const dirTxt = Math.abs(probe.z) < 1e-9 ? (bz > 1e-12 ? ' ⊙' : bz < -1e-12 ? ' ⊗' : '') : '';
      tag(parts.some(p => p.singular) ? 'P sobre un alambre' : `|B| = ${nf(mag * 1e6)} µT${dirTxt}`, ppx + 26, ppy + 24, T, T.probe);

      // vista previa del dibujo
      if (s.draft) drawDraft(T);

      // ayuda junto al puntero cuando hay una figura elegida
      if (s.hover && !s.draft && HINTS[props.tool]) {
        const [hx, hy] = s.hover;
        ctx.strokeStyle = T.loop; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hx - 8, hy); ctx.lineTo(hx + 8, hy); ctx.moveTo(hx, hy - 8); ctx.lineTo(hx, hy + 8); ctx.stroke();
        tag(HINTS[props.tool], hx + 12, hy + 22, T, T.loop);
      }
      // lectura bajo el puntero
      if (s.hover && !s.drag) {
        const [hx, hy] = s.hover, [wx, wy] = toW(hx, hy);
        const b = elements.length ? bzPlane(elements, wx, wy, I) : 0;
        const txt = `(${cm(wx)}; ${cm(wy)}) cm` + (Number.isFinite(b) && elements.length ? `  Bz = ${nf(b * 1e6)} µT` : '');
        tag(txt, W - 8, 22, T, T.muted, 'right');
      }
      raf = requestAnimationFrame(frame);
    }

    function tagAt(text, [x, y], [dx, dy], T, color) {
      tag(text, x + dx * 14, y + dy * 14 + 4, T, color, dx < -0.3 ? 'right' : dx > 0.3 ? 'left' : 'center');
    }

    function drawGeometry(e, part, ppx, ppy, T) {
      if (!part) return;
      if (e.type === 'poly') {
        // vértices de la polilínea: cada pieza es un tramo recto que se integra exacto
        ctx.fillStyle = T.loop; ctx.globalAlpha = 0.7;
        for (const q of e.pts) { const [x, y] = toS(...q); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        const [lx, ly] = toS(...e.pts[e.pts.length - 1]);
        tag(`${part.N} tramos rectos · L = ${cm(part.L)} cm`, lx + 10, ly + 18, T, T.loop);
        return;
      }
      ctx.lineWidth = 1.3;
      if (e.type === 'seg') {
        const { lx, ly } = segRange(e);
        // recta completa (punteada)
        ctx.setLineDash([3, 5]); ctx.strokeStyle = T.muted; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(...toS(e.ax - far() * lx, e.ay - far() * ly)); ctx.lineTo(...toS(e.ax + far() * lx, e.ay + far() * ly)); ctx.stroke();
        ctx.globalAlpha = 1; ctx.setLineDash([]);
        if (part.onLine) return;
        const [fx, fy] = toS(...part.foot);
        // perpendicular d
        ctx.strokeStyle = T.loop; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(fx, fy); ctx.stroke(); ctx.setLineDash([]);
        // marca de ángulo recto
        const nx = (fx - ppx), ny = (fy - ppy), nl = Math.hypot(nx, ny);
        if (nl > 14) {
          const ux = nx / nl, uy = ny / nl, k = 8;
          ctx.beginPath(); ctx.moveTo(fx - ux * k, fy - uy * k); ctx.lineTo(fx - ux * k + lx * k, fy - uy * k - ly * k); ctx.lineTo(fx + lx * k, fy - ly * k); ctx.stroke();
          if (!layers0().sweep) tag(symMode() ? `cateto opuesto ${segNames(e).CO}` : `cateto opuesto = ${cm(part.d)} cm`, (ppx + fx) / 2 + 8, (ppy + fy) / 2, T, T.loop);
          ctx.fillStyle = T.loop; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, TAU); ctx.fill();
        }
        // en cada extremo: r hacia P y el ángulo θ (positivo) entre dl (sentido de la corriente) y r̂
        const c = segCourse(e, part, P.current.probe);
        const ea = Math.atan2(-ly, lx);
        [[c.e1, '₁', e.ax, e.ay], [c.e2, '₂', e.bx, e.by]].forEach(([en, sub, wx, wy]) => {
          if (en.inf) return;
          const [ex, ey] = toS(wx, wy);
          ctx.strokeStyle = T.muted; ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ppx, ppy); ctx.stroke(); ctx.setLineDash([]);
        });
      } else {
        const [cx, cy] = toS(e.cx, e.cy), Rp = e.R * s.S;
        ctx.setLineDash([3, 5]); ctx.strokeStyle = T.muted; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        for (const ph of [e.p1, e.p2]) { const [x2, y2] = toS(...arcPoint(e, ph)); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke(); }
        ctx.setLineDash([]);
        const rr = Math.min(34, Rp * 0.45);
        ctx.strokeStyle = T.probe; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(cx, cy, rr, -e.p1, -e.p2, e.p2 > e.p1); ctx.stroke();
        const pm = (e.p1 + e.p2) / 2;
        { const sg = Math.sign(e.p2 - e.p1) || 1, tx = -Math.sin(e.p2) * sg, ty = -Math.cos(e.p2) * sg;
          const ex = cx + Math.cos(e.p2) * rr, ey = cy - Math.sin(e.p2) * rr;
          arrow(ex - tx * 7, ey - ty * 7, tx, ty, 6, T.probe, 1.6, 4); }
        tag(symMode() ? `|Δφ| = φ_b − φ_a (${e.p2 > e.p1 ? 'antihorario' : 'horario'})` : `|Δφ| = ${nf(Math.abs(deg(e.p2 - e.p1)), 1)}° = ${nf(Math.abs(e.p2 - e.p1), 3)} rad (${e.p2 > e.p1 ? 'antihorario' : 'horario'})`, cx + Math.cos(pm) * (Rp + 44), cy - Math.sin(pm) * (Rp + 44) + 4, T, T.probe, Math.cos(pm) < -0.3 ? 'right' : Math.cos(pm) > 0.3 ? 'left' : 'center');
        const [sx, sy] = toS(...arcPoint(e, e.p1));
        tag(symMode() ? 'R' : `R = ${cm(e.R)} cm`, (cx + sx) / 2 + 6, (cy + sy) / 2 - 6, T, T.muted);
        tag(symMode() ? `inicio: φ_${e.p1 < e.p2 ? 'a' : 'b'}` : `inicio ${nf(((deg(e.p1) % 360) + 360) % 360, 1)}°`, sx + Math.cos(e.p1) * 16, sy - Math.sin(e.p1) * 16 + 4, T, T.muted, Math.cos(e.p1) < -0.3 ? 'right' : Math.cos(e.p1) > 0.3 ? 'left' : 'center');
        const [ex2, ey2] = toS(...arcPoint(e, e.p2));
        tag(symMode() ? `final: φ_${e.p1 < e.p2 ? 'b' : 'a'}` : `final ${nf(((deg(e.p2) % 360) + 360) % 360, 1)}°`, ex2 + Math.cos(e.p2) * 16, ey2 - Math.sin(e.p2) * 16 + 4, T, T.muted, Math.cos(e.p2) < -0.3 ? 'right' : Math.cos(e.p2) > 0.3 ? 'left' : 'center');
      }
    }

    function drawDraft(T) {
      const d = s.draft;
      ctx.strokeStyle = T.loop; ctx.lineWidth = 3; ctx.lineCap = 'round';
      if (d.kind === 'free') {
        ctx.beginPath(); d.pts.forEach((q, k) => (k ? ctx.lineTo(...toS(...q)) : ctx.moveTo(...toS(...q)))); ctx.stroke();
        const lq = toS(...d.pts[d.pts.length - 1]);
        tag('suelta para terminar', lq[0] + 10, lq[1] - 10, T, T.loop);
        return;
      }
      if (d.kind === 'seg') {
        const [ax, ay] = toS(...d.a), [bx, by] = toS(...d.b);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        const Lp = Math.hypot(bx - ax, by - ay);
        if (Lp > 2 && (d.infA || d.infB)) {
          const ux = (bx - ax) / Lp, uy = (by - ay) / Lp;
          ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
          ctx.beginPath();
          if (d.infB) { ctx.moveTo(bx, by); ctx.lineTo(bx + ux * 3000, by + uy * 3000); }
          if (d.infA) { ctx.moveTo(ax, ay); ctx.lineTo(ax - ux * 3000, ay - uy * 3000); }
          ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 3;
        }
        const L = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]);
        if (L > 1e-6) arrow((ax + bx) / 2, (ay + by) / 2, (bx - ax) / Math.hypot(bx - ax, by - ay), (by - ay) / Math.hypot(bx - ax, by - ay), 10, T.loop, 2.4, 5);
        tag(`L = ${cm(L)} cm · ${nf(deg(Math.atan2(d.b[1] - d.a[1], d.b[0] - d.a[0])), 1)}°`, bx + 10, by - 10, T, T.loop);
        if (s.alignP) {
          const [px2, py2] = toS(P.current.probe.x, P.current.probe.y);
          ctx.setLineDash([4, 4]); ctx.strokeStyle = T.probe; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(px2, py2); ctx.stroke(); ctx.setLineDash([]);
          tag('pasa por P → B = 0', bx + 10, by + 10, T, T.probe);
        }
      } else {
        const [cx, cy] = toS(...d.c), Rp = d.R * s.S;
        ctx.fillStyle = T.loop; ctx.fillRect(cx - 4, cy - 4, 8, 8);
        ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        const [sx, sy] = toS(d.c[0] + d.R * Math.cos(d.p1), d.c[1] + d.R * Math.sin(d.p1));
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();
        if (d.sweep) {
          ctx.lineWidth = 3.4;
          ctx.beginPath(); ctx.arc(cx, cy, Rp, -d.p1, -(d.p1 + d.sweep), true); ctx.stroke();
          tag(`R = ${cm(d.R)} cm · ${d.sweep > 6 ? 'espira completa' : 'semicírculo desde ' + nf(deg(d.p1), 0) + '°'}`, sx + 10, sy - 10, T, T.loop);
        } else if (d.stage === 2) {
          ctx.lineWidth = 3.4;
          ctx.beginPath(); ctx.arc(cx, cy, Rp, -d.p1, -d.p2, d.p2 > d.p1); ctx.stroke();
          tag(`|Δφ| = ${nf(Math.abs(deg(d.p2 - d.p1)), 1)}° ${d.p2 >= d.p1 ? 'antihorario' : 'horario'}  (clic para terminar)`, sx + 10, sy - 10, T, T.loop);
        } else tag(`R = ${cm(d.R)} cm · inicio ${nf(((deg(d.p1) % 360) + 360) % 360, 1)}°`, sx + 10, sy - 10, T, T.loop);
      }
    }

    function handles(e) {
      if (e.type === 'poly') { const n = e.pts.length - 1; return [{ k: 'P0', x: e.pts[0][0], y: e.pts[0][1] }, { k: 'PN', x: e.pts[n][0], y: e.pts[n][1] }]; }
      if (e.type === 'seg') {
        return [{ k: 'A', x: e.ax, y: e.ay }, { k: 'B', x: e.bx, y: e.by }];
      }
      const [sx, sy] = arcPoint(e, e.p1), [ex, ey] = arcPoint(e, e.p2);
      return [{ k: 'C', x: e.cx, y: e.cy }, { k: 'S', x: sx, y: sy }, { k: 'E', x: ex, y: ey }];
    }

    /* ---------- puntero ---------- */
    const pos = ev => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    function onDown(ev) {
      const props = P.current, [px, py] = pos(ev), [wx, wy] = toW(px, py);
      cv.setPointerCapture(ev.pointerId);
      if (props.tool === 'pick' || props.tool === 'erase') {
        let best = null, bd = 12 / s.S;
        for (const e of props.elements) { const d = distToElement(e, wx, wy, far()); if (d < bd) { bd = d; best = e; } }
        if (best) (props.tool === 'erase' ? props.onDelete(best.id) : props.onSelect(best.id));
        return;
      }
      if (props.tool === 'probe') { const [x, y] = snapPt(wx, wy); props.onProbe({ x, y }); s.drag = { kind: 'probe' }; return; }
      if (props.tool === 'seg' || props.tool === 'semi' || props.tool === 'inf') {
        const a = snapPt(wx, wy);
        s.draft = { kind: 'seg', a, b: a, infA: props.tool === 'inf', infB: props.tool !== 'seg' }; s.drag = { kind: 'drawSeg' }; return;
      }
      if (props.tool === 'half' || props.tool === 'circle') {
        const c = snapPt(wx, wy); s.draft = { kind: 'arc', stage: 1, c, R: 0, p1: 0, p2: 0, sweep: props.tool === 'half' ? Math.PI : TAU }; s.drag = { kind: 'drawArc' }; return;
      }
      if (props.tool === 'free') { const a = snapPt(wx, wy); s.draft = { kind: 'free', pts: [a], lastPx: [px, py] }; s.drag = { kind: 'drawFree' }; return; }
      if (props.tool === 'arc') {
        if (s.draft && s.draft.kind === 'arc' && s.draft.stage === 2) {
          const d = s.draft;
          if (Math.abs(d.p2 - d.p1) > 0.02) props.onCreate({ type: 'arc', cx: d.c[0], cy: d.c[1], R: d.R, p1: d.p1, p2: d.p2 });
          s.draft = null; s.drag = null; return;
        }
        const c = snapPt(wx, wy); s.draft = { kind: 'arc', stage: 1, c, R: 0, p1: 0, p2: 0 }; s.drag = { kind: 'drawArc' }; return;
      }
      // seleccionar
      const sel = props.elements.find(e => e.id === props.sel);
      if (sel) for (const h of handles(sel)) {
        const [hx, hy] = toS(h.x, h.y);
        if (Math.hypot(hx - px, hy - py) < 11) { s.drag = { kind: 'handle', id: sel.id, k: h.k, orig: { ...sel } }; return; }
      }
      if (Math.hypot(toS(props.probe.x, props.probe.y)[0] - px, toS(props.probe.x, props.probe.y)[1] - py) < 13) { s.drag = { kind: 'probe' }; return; }
      let best = null, bd = 10 / s.S;
      for (const e of props.elements) { const d = distToElement(e, wx, wy, far()); if (d < bd) { bd = d; best = e; } }
      if (best) { props.onSelect(best.id); s.drag = { kind: 'move', id: best.id, start: [wx, wy], orig: { ...best } }; }
    }
    function onMove(ev) {
      const props = P.current, [px, py] = pos(ev), [wx, wy] = toW(px, py);
      s.hover = [px, py];
      const d = s.drag;
      if (s.draft && s.draft.kind === 'arc' && s.draft.stage === 2) {
        const a = Math.atan2(wy - s.draft.c[1], wx - s.draft.c[0]);
        let raw = s.draft.lastA + (((a - s.draft.lastA + Math.PI) % TAU + TAU) % TAU) - Math.PI;
        s.draft.lastA = raw;
        raw = Math.max(s.draft.p1 - TAU, Math.min(s.draft.p1 + TAU, raw));
        s.draft.p2 = s.draft.p1 + snapAng(raw - s.draft.p1);
        return;
      }
      if (!d) return;
      if (d.kind === 'probe') { const [x, y] = snapPt(wx, wy); props.onProbe({ x, y }); return; }
      if (d.kind === 'drawSeg') { s.draft.b = snapSegEnd(s.draft.a, wx, wy, null, ev.shiftKey); return; }
      if (d.kind === 'drawFree') {
        if (Math.hypot(px - s.draft.lastPx[0], py - s.draft.lastPx[1]) >= 4) { s.draft.pts.push([wx, wy]); s.draft.lastPx = [px, py]; }
        return;
      }
      if (d.kind === 'drawArc') {
        const c = s.draft.c; s.draft.R = snapLen(Math.hypot(wx - c[0], wy - c[1])); s.draft.p1 = snapAng(Math.atan2(wy - c[1], wx - c[0])); return;
      }
      if (d.kind === 'move') {
        let dx = wx - d.start[0], dy = wy - d.start[1];
        if (props.snap) { const g = gridStep(); dx = Math.round(dx / g) * g; dy = Math.round(dy / g) * g; }
        const o = d.orig;
        props.onChange(d.id, o.type === 'seg' ? { ax: o.ax + dx, ay: o.ay + dy, bx: o.bx + dx, by: o.by + dy }
          : o.type === 'poly' ? { pts: o.pts.map(q => [q[0] + dx, q[1] + dy]) } : { cx: o.cx + dx, cy: o.cy + dy });
        return;
      }
      if (d.kind === 'handle') {
        const o = d.orig;
        if (o.type === 'seg') { const [x, y] = snapSegEnd(d.k === 'A' ? [o.bx, o.by] : [o.ax, o.ay], wx, wy, o.id, ev.shiftKey); props.onChange(d.id, d.k === 'A' ? { ax: x, ay: y } : { bx: x, by: y }); return; }
        if (o.type === 'poly') {
          const [x, y] = snapPt(wx, wy, o.id), pts = o.pts.map(q => [...q]);
          pts[d.k === 'P0' ? 0 : pts.length - 1] = [x, y];
          props.onChange(d.id, { pts }); return;
        }
        if (d.k === 'C') { const [x, y] = snapPt(wx, wy, o.id); props.onChange(d.id, { cx: x, cy: y }); return; }
        const R = snapLen(Math.hypot(wx - o.cx, wy - o.cy));
        let a = snapAng(Math.atan2(wy - o.cy, wx - o.cx));
        if (d.k === 'S') { a = unwrapNear(a, o.p1); props.onChange(d.id, { R, p1: a }); }
        else { a = unwrapNear(a, o.p2); props.onChange(d.id, { R, p2: a }); }
      }
    }
    function onUp() {
      s.alignP = false;
      const props = P.current, d = s.drag;
      if (d && d.kind === 'drawSeg') {
        const { a, b } = s.draft;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.004) props.onCreate({ type: 'seg', ax: a[0], ay: a[1], bx: b[0], by: b[1], infA: !!s.draft.infA, infB: !!s.draft.infB });
        s.draft = null;
      }
      if (d && d.kind === 'drawArc') {
        const dr = s.draft;
        if (dr.R > 0.003 && dr.sweep) { props.onCreate({ type: 'arc', cx: dr.c[0], cy: dr.c[1], R: dr.R, p1: dr.p1, p2: dr.p1 + dr.sweep }); s.draft = null; }
        else if (dr.R > 0.003) { dr.stage = 2; dr.p2 = dr.p1; dr.lastA = dr.p1; }
        else s.draft = null;
      }
      if (d && d.kind === 'drawFree') {
        let pts = simplify(s.draft.pts, 1.5 / s.S);
        if (pts.length >= 2) { pts[pts.length - 1] = snapPt(...pts[pts.length - 1]); }
        const L = pts.slice(1).reduce((t, q, k) => t + Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]), 0);
        if (pts.length >= 2 && L > 0.005) props.onCreate(pts.length === 2
          ? { type: 'seg', ax: pts[0][0], ay: pts[0][1], bx: pts[1][0], by: pts[1][1], infA: false, infB: false }
          : { type: 'poly', pts });
        s.draft = null;
      }
      s.drag = null;
    }
    const onLeave = () => { s.hover = null; };
    const onKey = ev => {
      if (ev.key === 'Escape') { s.draft = null; s.drag = null; }
      const tagName = (ev.target && ev.target.tagName) || '';
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && !/INPUT|SELECT|TEXTAREA/.test(tagName) && P.current.sel != null) P.current.onDelete(P.current.sel);
    };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); cv.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // al cambiar de herramienta se cancela cualquier dibujo a medias
  useEffect(() => { st.current.draft = null; st.current.drag = null; }, [props.tool]);

  const cursor = props.tool === 'select' ? 'move' : props.tool === 'pick' || props.tool === 'erase' ? 'default' : 'crosshair';
  return (
    <div className="stage" ref={wrapRef} style={{ cursor }}>
      <canvas ref={canvasRef} role="img" aria-label="Plano xy con los alambres dibujados, el punto P y el campo magnético" style={{ touchAction: 'none' }} />
    </div>
  );
}
