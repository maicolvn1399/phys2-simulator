import { useEffect, useRef } from 'react';
import { nf } from '../shared/format.js';

export const COLS = 14, ROWS = 8;
const TAU = Math.PI * 2;
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export const uName = n => (n || '').replace(/_\{?(\w+)\}?/, (_, d) => d.split('').map(c => (/\d/.test(c) ? SUBS[+c] : c)).join(''));
const GROUP_COLORS = ['#c2410c', '#0f766e', '#7c3aed', '#b45309', '#be185d', '#1d4ed8', '#15803d'];

/**
 * Lienzo del circuito: cuadrícula de nodos, herramientas tipo Paint (cable, resistencia, fuente ε),
 * y capas según el modo: pasos de R_eq, corrientes de malla o corrientes de rama.
 */
export default function CircuitCanvas(props) {
  const wrapRef = useRef(null), cvRef = useRef(null);
  const P = useRef(props);
  P.current = props;
  const st = useRef({ W: 0, H: 0, cell: 40, ox: 20, oy: 20, flow: 0, drag: null, hover: null, av: new Map(), rq: null, center: [7, 4] });

  useEffect(() => {
    const cv = cvRef.current, ctx = cv.getContext('2d'), s = st.current;
    const toS = (x, y) => [s.ox + x * s.cell, s.oy + y * s.cell];
    const toG = (px, py) => [(px - s.ox) / s.cell, (py - s.oy) / s.cell];
    function resize() {
      const r = { width: wrapRef.current.offsetWidth, height: wrapRef.current.offsetHeight }, dpr = Math.min(devicePixelRatio || 1, 2);
      s.W = r.width; s.H = r.height;
      cv.width = Math.round(s.W * dpr); cv.height = Math.round(s.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.cell = Math.min((s.W - 40) / COLS, (s.H - 40) / ROWS);
      s.ox = (s.W - COLS * s.cell) / 2; s.oy = (s.H - ROWS * s.cell) / 2;
    }
    const ro = new ResizeObserver(resize); ro.observe(wrapRef.current); resize();

    function tag(text, x, y, T, color, align = 'left', bold = false) {
      if (!text) return;
      ctx.font = `${bold ? '600 ' : ''}12px "JetBrains Mono", monospace`;
      const w = ctx.measureText(text).width + 10;
      let x0 = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
      x0 = Math.max(2, Math.min(s.W - w - 2, x0));
      ctx.fillStyle = T.surface; ctx.globalAlpha = 0.92; ctx.fillRect(x0, y - 12, w, 17); ctx.globalAlpha = 1;
      ctx.fillStyle = color; ctx.fillText(text, x0 + 5, y);
    }
    function arrowHead(x, y, dx, dy, size, color) {
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(x + dx * size, y + dy * size);
      ctx.lineTo(x - dx * size * 0.6 - dy * size * 0.7, y - dy * size * 0.6 + dx * size * 0.7);
      ctx.lineTo(x - dx * size * 0.6 + dy * size * 0.7, y - dy * size * 0.6 - dx * size * 0.7);
      ctx.closePath(); ctx.fill();
    }
    const segDist = (px, py, a, b) => {
      const [ax, ay] = toS(...a), [bx, by] = toS(...b);
      const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / L2));
      return Math.hypot(px - ax - t * ex, py - ay - t * ey);
    };
    const pickComp = (px, py) => {
      let best = null, bd = 12;
      for (const c of P.current.comps) { const d = segDist(px, py, c.a, c.b); if (d < bd) { bd = d; best = c; } }
      return best;
    };

    /** Cuerpo de una resistencia o fuente (1 celda centrada en el tramo). amp: 1 = zigzag completo, 0 = cable. */
    function drawBody(c, T, color, lw = 2.6, amp = 1) {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const [ax, ay] = toS(...c.a), [bx, by] = toS(...c.b);
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
      const cx = (ax + bx) / 2, cy = (ay + by) / 2, h = s.cell / 2;
      const p0 = [cx - ux * h, cy - uy * h], p1 = [cx + ux * h, cy + uy * h];
      if (c.type === 'R') {
        const a = s.cell * 0.16 * amp, n = 6;
        ctx.beginPath(); ctx.moveTo(...p0);
        for (let k = 1; k < n * 2; k++) {
          const t = k / (n * 2), sgn = k % 2 ? 1 : -1;
          ctx.lineTo(p0[0] + ux * t * 2 * h + nx * a * sgn, p0[1] + uy * t * 2 * h + ny * a * sgn);
        }
        ctx.lineTo(...p1); ctx.stroke();
      } else {
        // fuente: placa corta (−) hacia a, placa larga (+) hacia b
        const g = s.cell * 0.09, Ll = s.cell * 0.34, Ls = s.cell * 0.18;
        const m = [cx - ux * g, cy - uy * g], pl = [cx + ux * g, cy + uy * g];
        ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...m); ctx.moveTo(...pl); ctx.lineTo(...p1); ctx.stroke();
        ctx.lineWidth = lw + 1.2;
        ctx.beginPath(); ctx.moveTo(m[0] + nx * Ls, m[1] + ny * Ls); ctx.lineTo(m[0] - nx * Ls, m[1] - ny * Ls); ctx.stroke();
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(pl[0] + nx * Ll, pl[1] + ny * Ll); ctx.lineTo(pl[0] - nx * Ll, pl[1] - ny * Ll); ctx.stroke();
        ctx.font = '600 14px "IBM Plex Sans Condensed", sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
        ctx.fillText('+', pl[0] + ux * 12 + nx * (Ll + 4), pl[1] + uy * 12 + ny * (Ll + 4) + 5);
        ctx.fillText('−', m[0] - ux * 12 + nx * (Ls + 8), m[1] - uy * 12 + ny * (Ls + 8) + 5);
        ctx.textAlign = 'left';
      }
    }
    function drawComp(c, T, color, lw = 2.6) {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
      const [ax, ay] = toS(...c.a), [bx, by] = toS(...c.b);
      if (c.type === 'W') { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); return; }
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
      const cx = (ax + bx) / 2, cy = (ay + by) / 2, h = s.cell / 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx - ux * h, cy - uy * h); ctx.moveTo(cx + ux * h, cy + uy * h); ctx.lineTo(bx, by); ctx.stroke();
      drawBody(c, T, color, lw, 1);
    }
    /**
     * Estado del dibujo en el paso k de la reducción: qué resistencias siguen, cuáles se volvieron cable (serie),
     * cuáles desaparecen (paralelo) y qué cables quedan sueltos y también se van.
     */
    function reqState(an, k) {
      if (s.rq && s.rq.an === an && s.rq.k === k) return s.rq.v;
      const role = new Map(), group = new Map();
      let ci = 0;
      an.req.steps.slice(0, k).forEach((stp, j) => {
        if (!stp.result) { stp.parts.forEach(p => p.members.forEach(id => role.set(id, 'gone'))); return; }
        const g = { ...stp.result, color: GROUP_COLORS[ci++ % GROUP_COLORS.length], current: j === k - 1 };
        (stp.absorbed || []).forEach(id => role.set(id, 'wire'));
        (stp.ghost || []).forEach(id => role.set(id, 'gone'));
        role.set(g.host, 'host'); group.set(g.host, g);
      });
      if (an.req.ok && k >= an.req.steps.length && an.req.last) {
        const g = group.get(an.req.last.host);
        if (g) g.name = 'R_{eq}'; else { role.set(an.req.last.host, 'host'); group.set(an.req.last.host, { ...an.req.last, name: 'R_{eq}', color: GROUP_COLORS[0], current: true }); }
      }
      // cables que quedan sueltos al quitar las ramas en paralelo
      const dead = new Set();
      const edges = [...an.geo.wires.map(w => ({ u: w.u, v: w.v, w })), ...an.geo.bodies.filter(b => role.get(b.comp.id) !== 'gone').map(b => ({ u: b.u, v: b.v }))];
      let live = edges, changed = true;
      while (changed) {
        changed = false;
        const deg = new Map();
        live.forEach(e => { deg.set(e.u, (deg.get(e.u) || 0) + 1); deg.set(e.v, (deg.get(e.v) || 0) + 1); });
        const next = live.filter(e => deg.get(e.u) > 1 && deg.get(e.v) > 1);
        if (next.length !== live.length) { changed = true; live.filter(e => !next.includes(e) && e.w).forEach(e => dead.add(e.w)); live = next; }
      }
      const v = { role, group, dead };
      s.rq = { an, k, v };
      return v;
    }
    const compLabelPos = (c, lines = 1) => {
      const [ax, ay] = toS(...c.a), [bx, by] = toS(...c.b);
      const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      if (Math.abs(uy) < 0.2) return { x: mx, y: my - s.cell * 0.32, align: 'center', horiz: true };
      if (Math.abs(ux) < 0.2) return { x: mx + 16, y: my + 4, align: 'left', horiz: false };
      // inclinado: la etiqueta va por fuera del circuito (lado contrario al centro del dibujo)
      let nx = -uy, ny = ux;
      const [gx, gy] = toS(...s.center);
      if ((mx - gx) * nx + (my - gy) * ny < 0) { nx = -nx; ny = -ny; }
      return { x: mx + nx * s.cell * 0.34, y: my + ny * s.cell * 0.34 + (ny > 0 ? 12 : -4 - (lines - 1) * 16), align: nx > 0 ? 'left' : 'right', horiz: false };
    };

    let last = performance.now(), raf = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const props = P.current, T = props.tokens, an = props.an;
      if (props.animate) s.flow += dt;
      const { W, H } = s;
      { let cx = 0, cy = 0, n = 0; for (const c of props.comps) { cx += c.a[0] + c.b[0]; cy += c.a[1] + c.b[1]; n += 2; } s.center = n ? [cx / n, cy / n] : [COLS / 2, ROWS / 2]; }
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
      // cuadrícula de nodos
      ctx.fillStyle = T.line;
      for (let i = 0; i <= COLS; i++) for (let j = 0; j <= ROWS; j++) { const [x, y] = toS(i, j); ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }

      // estado de la reducción a R_eq (se anima hacia el paso actual, hacia adelante o hacia atrás)
      const reducing = props.mode === 'req' && an && an.req && an.geo && props.reqStep > 0;
      const rq = reducing ? reqState(an, props.reqStep) : null;
      const ease = 1 - Math.exp(-dt * 6);
      const anim = (key, target) => {
        const cur = s.av.has(key) ? s.av.get(key) : target;
        const v = Math.abs(target - cur) < 0.004 ? target : cur + (target - cur) * ease;
        s.av.set(key, v); return v;
      };

      // corrientes (animación de cargas); durante la reducción se ocultan: ya no son las del circuito original
      if (an && an.ok && props.showFlow && !reducing) {
        const spacing = s.cell * 0.42;
        const drawFlow = (p, q, I) => {
          if (!Number.isFinite(I) || Math.abs(I) < 1e-9) return;
          const [ax, ay] = toS(p.x, p.y), [bx, by] = toS(q.x, q.y);
          const L = Math.hypot(bx - ax, by - ay); if (L < 1) return;
          const dir = I > 0 ? 1 : -1, speed = Math.min(160, 20 + 60 * Math.sqrt(Math.abs(I) / Math.max(1e-9, Math.abs(an.Itotal || 1))));
          const ph = ((s.flow * speed * dir) % spacing + spacing) % spacing;
          ctx.fillStyle = T.probe;
          for (let d = ph; d < L; d += spacing) { const t = d / L; ctx.beginPath(); ctx.arc(ax + (bx - ax) * t, ay + (by - ay) * t, 2.6, 0, TAU); ctx.fill(); }
        };
        const V = k => an.geo.verts.get(k);
        for (const [w, I] of an.wireI) drawFlow(V(w.u), V(w.v), I);
        for (const e of an.els) if (e.I !== undefined) drawFlow(V(e.u), V(e.v), e.I);
      }

      // componentes: cables (por tramo) y cuerpos, con su opacidad y amplitud animadas
      const shown = new Map();       // id → {alpha, amp, g}
      if (an && an.geo) {
        const V = k => an.geo.verts.get(k);
        for (const w of an.geo.wires) {
          const al = anim(`w${w.u}|${w.v}`, rq && rq.dead.has(w) ? 0 : 1);
          if (al < 0.01) continue;
          const [ax, ay] = toS(V(w.u).x, V(w.u).y), [bx, by] = toS(V(w.v).x, V(w.v).y);
          const seld = w.comp.id === props.sel;
          ctx.globalAlpha = al; ctx.strokeStyle = seld ? T.loop : T.fg; ctx.lineWidth = seld ? 3.2 : 2.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
        for (const b of an.geo.bodies) {
          const c = b.comp, r = rq ? rq.role.get(c.id) : null, g = rq ? rq.group.get(c.id) : null;
          const al = anim(`a${c.id}`, r === 'gone' ? 0 : 1), amp = anim(`z${c.id}`, r === 'wire' ? 0 : r === 'host' ? 1.25 : 1);
          shown.set(c.id, { alpha: al, amp, g, role: r });
          if (al < 0.01) continue;
          if (g && r === 'host') {
            const [ax, ay] = toS(V(b.u).x, V(b.u).y), [bx, by] = toS(V(b.v).x, V(b.v).y);
            ctx.globalAlpha = al * (g.current ? 0.3 : 0.14) * Math.min(1, Math.max(0, (amp - 1) * 4)); ctx.strokeStyle = g.color; ctx.lineWidth = s.cell * 0.62; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
          ctx.globalAlpha = al;
          const color = c.id === props.sel ? T.loop : g && r === 'host' ? g.color : T.fg;
          drawBody(c, T, color, c.id === props.sel ? 3.2 : 2.6, amp);
        }
        ctx.globalAlpha = 1;
        // nodos con tres o más conexiones (solo con lo que sigue visible)
        const degree = new Map();
        const inc = k => degree.set(k, (degree.get(k) || 0) + 1);
        an.geo.wires.forEach(w => { if (!(rq && rq.dead.has(w))) { inc(w.u); inc(w.v); } });
        an.geo.bodies.forEach(b => { if (!(rq && rq.role.get(b.comp.id) === 'gone')) { inc(b.u); inc(b.v); } });
        ctx.fillStyle = T.fg;
        for (const [k, d] of degree) if (d >= 3) { const v = an.geo.verts.get(k); const [x, y] = toS(v.x, v.y); ctx.beginPath(); ctx.arc(x, y, 4.2, 0, TAU); ctx.fill(); }
        // cruces sin conexión: un pequeño puente para que se note que no se tocan
        for (const x of an.crossings || []) { const [px, py] = toS(x.x, x.y); ctx.strokeStyle = T.muted; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.stroke(); }
      } else for (const c of props.comps) drawComp(c, T, c.id === props.sel ? T.loop : T.fg, c.id === props.sel ? 3.2 : 2.6);

      // etiquetas de los elementos
      for (const c of props.comps) {
        if (c.type === 'W') continue;
        const sh = shown.get(c.id);
        const el = an && an.els ? an.els.find(e => e.id === c.id) : null;
        const withVals = props.showResults && !reducing && el && an.ok && el.I !== undefined;
        const lp = compLabelPos(c, withVals ? (c.type === 'R' ? 3 : 2) : 1);
        if (sh && (sh.alpha < 0.5 || sh.amp < 0.5 || sh.role === 'gone' || sh.role === 'wire')) continue;
        const v0 = x => nf(x, x % 1 ? 2 : 0);
        if (sh && sh.g && sh.role === 'host') { tag(`${uName(sh.g.name.replace(/[{}]/g, ''))} = ${nf(sh.g.R, 2)} Ω`, lp.x, lp.y, T, sh.g.color, lp.align, true); continue; }
        const head = c.type === 'R' ? `${uName(c.name)} = ${v0(c.value)} Ω` : `ε = ${v0(c.value)} V`;
        tag(head, lp.x, lp.y, T, c.id === props.sel ? T.loop : T.fg, lp.align, true);
        if (withVals) {
          const y0 = lp.y + (lp.horiz ? s.cell * 0.64 + 17 : 18);
          tag(`${nf(Math.abs(el.I), 4)} A`, lp.x, y0, T, T.probe, lp.align);
          if (c.type === 'R') tag(`${nf(Math.abs(el.dV), 3)} V`, lp.x, y0 + 16, T, T.muted, lp.align);
        }
      }

      // corrientes de malla
      if (props.mode === 'mesh' && an && an.ok) {
        for (const m of an.meshes) {
          const [cx, cy] = toS(m.cx, m.cy), r = s.cell * 0.42;
          ctx.strokeStyle = T.field; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.85, Math.PI * 0.55); ctx.stroke();
          const a = Math.PI * 0.55, ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
          arrowHead(ex, ey, -Math.sin(a), Math.cos(a), 7, T.field);
          const val = an.mesh.solve.values.get(m.i);
          ctx.font = '600 13px "JetBrains Mono", monospace'; ctx.fillStyle = T.field; ctx.textAlign = 'center';
          ctx.fillText(m.name, cx, cy + 5); ctx.textAlign = 'left';
          if (props.showResults && val) tag(`${m.name} = ${nf(Number(val.n) / Number(val.d), 4)} A`, cx, cy + r + 16, T, T.field, 'center');
        }
      }
      // corrientes de rama
      if (props.mode === 'branch' && an && an.ok) {
        const V = k => an.geo.verts.get(k);
        for (const b of an.branch.branches) {
          const c0 = b.chain.find(c => c.el.type === 'R') || b.chain[0];
          const e = c0.el, p = V(c0.fwd ? e.u : e.v), q = V(c0.fwd ? e.v : e.u);
          const [ax, ay] = toS(p.x, p.y), [bx, by] = toS(q.x, q.y);
          const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
          const off = s.cell * 0.36;
          const mx = (ax + bx) / 2 - nx * off, my = (ay + by) / 2 - ny * off;
          ctx.strokeStyle = T.field; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(mx - ux * 16, my - uy * 16); ctx.lineTo(mx + ux * 12, my + uy * 12); ctx.stroke();
          arrowHead(mx + ux * 12, my + uy * 12, ux, uy, 7, T.field);
          const val = an.branch.solve.values.get(b.i);
          tag(props.showResults && val ? `${b.name} = ${nf(Number(val.n) / Number(val.d), 3)} A` : b.name, mx - nx * 4 + (Math.abs(ux) > 0.5 ? 0 : -14), my - ny * 14 + (Math.abs(ux) > 0.5 ? -4 : 4), T, T.field, Math.abs(ux) > 0.5 ? 'center' : 'right', true);
        }
        // nombres de los nodos principales
        const degree = new Map();
        const inc = k => degree.set(k, (degree.get(k) || 0) + 1);
        an.geo.wires.forEach(w => { inc(w.u); inc(w.v); });
        an.geo.bodies.forEach(b => { inc(b.u); inc(b.v); });
        const done = new Set();
        for (const [k, d] of degree) {
          const n = an.nodeOf.get(k);
          if (d < 3 || done.has(n) || !an.branch.pnames.has(n)) continue;
          done.add(n);
          const v = an.geo.verts.get(k), [x, y] = toS(v.x, v.y);
          ctx.fillStyle = T.loop; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
          ctx.fillStyle = T.surface; ctx.font = '600 12px "IBM Plex Sans Condensed", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(an.branch.pnames.get(n), x, y + 4); ctx.textAlign = 'left';
        }
      }

      // vista previa del dibujo
      if (s.drag && s.drag.kind === 'draw') {
        const d = s.drag, c = { type: props.tool, a: d.a, b: d.b, value: 0 };
        if (d.a[0] !== d.b[0] || d.a[1] !== d.b[1]) drawComp(c, T, T.loop, 3);
        const [x, y] = toS(...d.a); ctx.fillStyle = T.loop; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        if (props.tool === 'E') { const [bx, by] = toS(...d.b); tag('+ aquí', bx + 10, by - 10, T, T.loop); }
      }
      // resaltado al pasar el puntero (seleccionar / eliminar)
      if (s.hover && (props.tool === 'pick' || props.tool === 'erase') && !s.drag) {
        const c = pickComp(...s.hover);
        if (c) {
          drawComp(c, T, props.tool === 'erase' ? T.out : T.loop, 4);
          if (props.tool === 'erase') tag('clic para eliminar', s.hover[0] + 12, s.hover[1] + 22, T, T.out);
          cv.style.cursor = 'pointer';
        } else cv.style.cursor = 'default';
      } else if (s.hover && ['W', 'R', 'E'].includes(props.tool)) {
        cv.style.cursor = 'crosshair';
        const [gx, gy] = toG(...s.hover), [x, y] = toS(Math.round(gx), Math.round(gy));
        ctx.strokeStyle = T.loop; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke();
        if (!s.drag) tag(props.tool === 'E' && props.comps.some(c => c.type === 'E') ? 'solo se permite una fuente ε' : 'presiona y arrastra', s.hover[0] + 12, s.hover[1] + 22, T, T.loop);
      }
      raf = requestAnimationFrame(frame);
    }

    const pos = ev => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const clampG = ([x, y]) => [Math.max(0, Math.min(COLS, x)), Math.max(0, Math.min(ROWS, y))];
    function onDown(ev) {
      const props = P.current, [px, py] = pos(ev);
      if (props.tool === 'pick' || props.tool === 'erase') {
        const c = pickComp(px, py);
        if (c) (props.tool === 'erase' ? props.onDelete(c.id) : props.onSelect(c.id));
        else if (props.tool === 'pick') props.onSelect(null);
        return;
      }
      if (props.tool === 'E' && props.comps.some(c => c.type === 'E')) return;
      cv.setPointerCapture(ev.pointerId);
      const g = clampG(toG(px, py).map(Math.round));
      s.drag = { kind: 'draw', a: g, b: g };
    }
    function onMove(ev) {
      const [px, py] = pos(ev); s.hover = [px, py];
      if (!s.drag) return;
      const [gx, gy] = toG(px, py), a = s.drag.a;
      const dx = gx - a[0], dy = gy - a[1];
      // cualquier punto de la cuadrícula: horizontal, vertical o inclinado
      void dx; void dy;
      s.drag.b = clampG([Math.round(gx), Math.round(gy)]);
    }
    function onUp() {
      const d = s.drag; s.drag = null;
      if (!d) return;
      if (d.a[0] === d.b[0] && d.a[1] === d.b[1]) return;
      P.current.onCreate({ type: P.current.tool, a: d.a, b: d.b });
    }
    const onLeave = () => { s.hover = null; };
    const onKey = ev => {
      const tn = (ev.target && ev.target.tagName) || '';
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && !/INPUT|SELECT|TEXTAREA/.test(tn) && P.current.sel != null) P.current.onDelete(P.current.sel);
      if (ev.key === 'Escape') s.drag = null;
    };
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); cv.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="stage circuit-stage" ref={wrapRef}>
      <canvas ref={cvRef} role="img" aria-label="Circuito dibujado en la cuadrícula" style={{ touchAction: 'none' }} />
    </div>
  );
}
