// Modelo del circuito dibujado en la cuadrícula:
//  - componentes: cable (W), resistencia (R) y fuente (E, ε) sobre segmentos horizontales o verticales;
//  - grafo geométrico (para las mallas = caras del dibujo) y grafo eléctrico (los cables unen nodos);
//  - resistencia equivalente por pasos (serie / paralelo), mallas, ramas y solución por sustitución.
import * as F from './frac.js';

const key = (x, y) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
const igcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

/* ------------------------------------------------------------------ geometría ------------------------------------------------------------------ */

/**
 * Convierte los componentes (entre puntos de la cuadrícula, en cualquier dirección) en un grafo geométrico:
 * los cables se parten en los puntos de la cuadrícula por donde pasan (ahí se pueden conectar otros elementos)
 * y cada resistencia o fuente es un "cuerpo" de 1 celda centrado en su tramo, con cables a los lados.
 */
export function buildGeometry(comps) {
  const verts = new Map();           // key → {x, y}
  const V = (x, y) => { const k = key(x, y); if (!verts.has(k)) verts.set(k, { k, x, y }); return k; };
  const wireSet = new Map();         // "k1|k2" → {u, v}
  const bodies = [];                 // {u, v, comp}
  const addWire = (p, q, comp) => {
    const u = V(...p), v = V(...q);
    if (u === v) return;
    const id = u < v ? `${u}|${v}` : `${v}|${u}`;
    if (!wireSet.has(id)) wireSet.set(id, { u, v, comp });
  };
  for (const c of comps) {
    const [ax, ay] = c.a, [bx, by] = c.b;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    if (L < 0.5) continue;
    const g = igcd(Math.round(dx), Math.round(dy)), ux = dx / L, uy = dy / L;
    const at = t => [ax + ux * t, ay + uy * t];
    const lat = Array.from({ length: g + 1 }, (_, k) => (k * L) / g);   // puntos de la cuadrícula sobre el tramo
    if (c.type === 'W') { for (let k = 0; k < g; k++) addWire(at(lat[k]), at(lat[k + 1]), c); continue; }
    const ts = L / 2 - 0.5, te = L / 2 + 0.5;
    const before = [...lat.filter(t => t < ts - 1e-9), ts], after = [te, ...lat.filter(t => t > te + 1e-9)];
    for (let k = 0; k + 1 < before.length; k++) addWire(at(before[k]), at(before[k + 1]), c);
    bodies.push({ u: V(...at(ts)), v: V(...at(te)), comp: c });
    for (let k = 0; k + 1 < after.length; k++) addWire(at(after[k]), at(after[k + 1]), c);
  }
  return { verts, wires: [...wireSet.values()], bodies };
}

/** Cruces de cables o elementos en puntos que no son nodos (el dibujo deja de ser plano). */
export function crossings(geo) {
  const segs = [...geo.wires, ...geo.bodies].map(e => ({ a: geo.verts.get(e.u), b: geo.verts.get(e.v) }));
  const out = [];
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const A = segs[i], B = segs[j];
    if ([A.a.k, A.b.k].some(k => k === B.a.k || k === B.b.k)) continue;
    const d1 = o(A.a, A.b, B.a), d2 = o(A.a, A.b, B.b), d3 = o(B.a, B.b, A.a), d4 = o(B.a, B.b, A.b);
    if (d1 * d2 < -1e-12 && d3 * d4 < -1e-12) {
      const t = d1 / (d1 - d2);
      out.push({ x: B.a.x + (B.b.x - B.a.x) * t, y: B.a.y + (B.b.y - B.a.y) * t });
    }
  }
  return out;
}

/** Une los vértices conectados por cables: cada clase es un nodo eléctrico. */
export function electricalNodes(geo) {
  const parent = new Map([...geo.verts.keys()].map(k => [k, k]));
  const find = k => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (const w of geo.wires) { const a = find(w.u), b = find(w.v); if (a !== b) parent.set(a, b); }
  const ids = new Map(); const nodeOf = new Map();
  for (const k of geo.verts.keys()) {
    const r = find(k);
    if (!ids.has(r)) ids.set(r, ids.size);
    nodeOf.set(k, ids.get(r));
  }
  return { nodeOf, count: ids.size };
}

/**
 * Caras del dibujo (grafo plano). Cada cara interior es una malla. Se recorren en sentido horario
 * (en pantalla, con y hacia abajo), que es el sentido de las corrientes de malla.
 */
export function faces(geo) {
  const adj = new Map();
  const edges = [];
  const addE = (u, v, kind, ref) => {
    const e = { u, v, kind, ref };
    edges.push(e);
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push({ to: v, e });
    adj.get(v).push({ to: u, e });
  };
  geo.wires.forEach(w => addE(w.u, w.v, 'W', w));
  geo.bodies.forEach(b => addE(b.u, b.v, b.comp.type, b));
  const P = k => geo.verts.get(k);
  for (const [k, list] of adj) {
    const p = P(k);
    list.sort((A, B) => Math.atan2(P(A.to).y - p.y, P(A.to).x - p.x) - Math.atan2(P(B.to).y - p.y, P(B.to).x - p.x));
  }
  const used = new Set();
  const hk = (u, v) => `${u}>${v}`;
  const out = [];
  for (const e of edges) for (const [u0, v0] of [[e.u, e.v], [e.v, e.u]]) {
    if (used.has(hk(u0, v0))) continue;
    const cyc = [];
    let u = u0, v = v0, guard = 0;
    while (!used.has(hk(u, v)) && guard++ < 10000) {
      used.add(hk(u, v));
      const list = adj.get(v);
      const i = list.findIndex(n => n.to === u);
      const nx = list[(i - 1 + list.length) % list.length];
      cyc.push({ u, v, e: list[i].e });
      u = v; v = nx.to;
    }
    let area = 0;
    for (const h of cyc) { const a = P(h.u), b = P(h.v); area += a.x * b.y - b.x * a.y; }
    out.push({ cyc, area: area / 2 });
  }
  return out;
}

/** Lazos independientes por árbol generador: se usan cuando el dibujo tiene cruces y no hay "caras". */
export function fundamentalLoops(geo) {
  const adj = new Map();
  const edges = [];
  const addE = (u, v, kind, ref) => { const e = { u, v, kind, ref }; edges.push(e); for (const [p, q] of [[u, v], [v, u]]) { if (!adj.has(p)) adj.set(p, []); adj.get(p).push({ to: q, e }); } };
  geo.wires.forEach(w => addE(w.u, w.v, 'W', w));
  geo.bodies.forEach(b => addE(b.u, b.v, b.comp.type, b));
  const parent = new Map(), depth = new Map(), tree = new Set();
  for (const root of adj.keys()) {
    if (parent.has(root)) continue;
    parent.set(root, null); depth.set(root, 0);
    const q = [root];
    while (q.length) { const u = q.shift(); for (const { to, e } of adj.get(u)) if (!parent.has(to)) { parent.set(to, { v: u, e }); depth.set(to, depth.get(u) + 1); tree.add(e); q.push(to); } }
  }
  const P = k => geo.verts.get(k);
  const out = [];
  for (const e of edges) {
    if (tree.has(e)) continue;
    // camino v → ... → u por el árbol, cerrando con la arista u → v
    let a = e.v, b = e.u; const up = [], down = [];
    while (a !== b) {
      if (depth.get(a) >= depth.get(b)) { const p = parent.get(a); up.push({ u: a, v: p.v, e: p.e }); a = p.v; }
      else { const p = parent.get(b); down.push({ u: p.v, v: b, e: p.e }); b = p.v; }
    }
    let cyc = [{ u: e.u, v: e.v, e }, ...up, ...down.reverse()];
    let area = 0;
    for (const h of cyc) { const A = P(h.u), B = P(h.v); area += A.x * B.y - B.x * A.y; }
    if (area < 0) { cyc = cyc.slice().reverse().map(h => ({ u: h.v, v: h.u, e: h.e })); area = -area; }
    out.push({ cyc, area: area / 2 });
  }
  return out;
}

/* ------------------------------------------------------------------ análisis ------------------------------------------------------------------ */

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = n => String(n).split('').map(d => SUB[+d]).join('');

export function analyze(comps) {
  const geo = buildGeometry(comps);
  const { nodeOf, count } = electricalNodes(geo);
  const els = geo.bodies.map(b => ({ ...b, id: b.comp.id, type: b.comp.type, value: b.comp.value, name: b.comp.name, na: nodeOf.get(b.u), nb: nodeOf.get(b.v) }));
  const res = { geo, nodeOf, nodeCount: count, els, ok: true, msgs: [] };
  const src = els.filter(e => e.type === 'E');
  const Rs = els.filter(e => e.type === 'R');
  if (!src.length) { res.ok = false; res.msgs.push('Agrega una fuente ε para cerrar el circuito.'); return res; }
  const E = src[0];
  res.source = E;

  /* --- solución numérica (análisis nodal) para dibujar corrientes y verificar --- */
  const N = count, gnd = E.na, plus = E.nb;
  if (gnd === plus) { res.ok = false; res.msgs.push('La fuente está en cortocircuito (sus dos terminales están unidos por cables).'); return res; }
  const unk = [...Array(N).keys()].filter(k => k !== gnd && k !== plus);
  const idx = new Map(unk.map((k, i) => [k, i]));
  const A = unk.map(() => Array(unk.length).fill(0)), bvec = Array(unk.length).fill(0);
  const Vfix = new Map([[gnd, 0], [plus, E.value]]);
  for (const r of Rs) {
    const g = 1 / Math.max(r.value, 1e-9);
    for (const [p, q] of [[r.na, r.nb], [r.nb, r.na]]) {
      if (!idx.has(p)) continue;
      const i = idx.get(p);
      A[i][i] += g;
      if (idx.has(q)) A[i][idx.get(q)] -= g; else bvec[i] += g * Vfix.get(q);
    }
  }
  unk.forEach((_, i) => { A[i][i] += 1e-12; });
  const x = gauss(A, bvec);
  const Vn = Array(N).fill(0);
  Vn[plus] = E.value;
  unk.forEach((k, i) => { Vn[k] = x[i]; });
  res.V = Vn;
  for (const r of Rs) { r.I = (Vn[r.na] - Vn[r.nb]) / Math.max(r.value, 1e-9); r.dV = Vn[r.na] - Vn[r.nb]; }
  // corriente de la fuente: la que sale por el terminal + hacia el circuito (de − a + por dentro)
  E.I = Rs.reduce((t, r) => t + (r.na === plus ? r.I : 0) - (r.nb === plus ? r.I : 0), 0);
  E.dV = -E.value;
  res.Itotal = E.I;

  /* --- corrientes en los cables (para la animación) --- */
  res.wireI = wireCurrents(geo, nodeOf, els);

  /* --- mallas (caras interiores con algún elemento) --- */
  const cross = crossings(geo);
  res.crossings = cross;
  res.planar = cross.length === 0;
  const interior = res.planar ? faces(geo).filter(f => f.area > 1e-9) : fundamentalLoops(geo);
  const P = k => geo.verts.get(k);
  const usedPts = [];
  const meshes = interior
    .filter(f => f.cyc.some(h => h.e.kind !== 'W'))
    .map(f => {
      // punto para la etiqueta: el más alejado de los bordes dentro de la malla
      const poly = f.cyc.map(h => P(h.u));
      const xs = poly.map(q => q.x), ys = poly.map(q => q.y);
      const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
      const dEdge = (x, y) => Math.min(...poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; const ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey || 1; const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / L2)); return Math.hypot(x - a.x - t * ex, y - a.y - t * ey); }));
      let best = { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length, d: -1 };
      for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.25) for (let y = Math.min(...ys) + 0.25; y < Math.max(...ys); y += 0.25) {
        if (!inside(x, y)) continue;
        const d = Math.min(dEdge(x, y), ...usedPts.map(u => Math.hypot(x - u.x, y - u.y) / 2));
        if (d > best.d + 1e-9) best = { x, y, d };
      }
      usedPts.push(best);
      return { ...f, cx: best.x, cy: best.y };
    })
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  meshes.forEach((m, i) => { m.name = `I${sub(i + 1)}`; m.i = i; });
  // qué lazos pasan por cada elemento y en qué sentido (a favor de u→v o en contra)
  const loopsOf = new Map();
  meshes.forEach(m => m.cyc.forEach(h => {
    if (h.e.kind === 'W') return;
    const b = h.e.ref;
    if (!loopsOf.has(b)) loopsOf.set(b, []);
    loopsOf.get(b).push({ mesh: m, fwd: h.u === b.u });
  }));
  res.meshes = meshes;
  res.loopsOf = el => loopsOf.get(geo.bodies.find(b => b.u === el.u && b.v === el.v)) || [];

  /* --- resistencia equivalente por pasos --- */
  res.req = reduce(Rs, E);

  /* --- método de mallas --- */
  res.mesh = meshMethod(meshes, loopsOf, E);

  /* --- método de ramas --- */
  res.branch = branchMethod(els, E, meshes, N);

  return res;
}

function gauss(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-15) continue;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => (Math.abs(r[i]) < 1e-15 ? 0 : r[n] / r[i]));
}

/** Reparte la corriente de cada nodo entre sus cables (como si fueran resistencias iguales muy pequeñas). */
function wireCurrents(geo, nodeOf, els) {
  const inj = new Map();
  for (const e of els) {
    const I = e.type === 'R' ? e.I : e.I;     // corriente de u a v (de a hacia b)
    if (I === undefined) continue;
    inj.set(e.u, (inj.get(e.u) || 0) - I);
    inj.set(e.v, (inj.get(e.v) || 0) + I);
  }
  const byNode = new Map();
  for (const w of geo.wires) { const n = nodeOf.get(w.u); if (!byNode.has(n)) byNode.set(n, []); byNode.get(n).push(w); }
  const out = new Map();
  for (const [, ws] of byNode) {
    const vs = [...new Set(ws.flatMap(w => [w.u, w.v]))];
    const id = new Map(vs.map((v, i) => [v, i]));
    const n = vs.length;
    if (n < 2) continue;
    const L = vs.map(() => Array(n).fill(0)), b = vs.map(v => inj.get(v) || 0);
    for (const w of ws) { const i = id.get(w.u), j = id.get(w.v); L[i][i] += 1; L[j][j] += 1; L[i][j] -= 1; L[j][i] -= 1; }
    L[0][0] += 1e6;                                  // referencia
    const phi = gauss(L, b);
    for (const w of ws) out.set(w, phi[id.get(w.u)] - phi[id.get(w.v)]);
  }
  return out;
}

/* ------------------------------------------------------------------ resistencia equivalente ------------------------------------------------------------------ */

function reduce(Rs, E) {
  const t1 = E.na, t2 = E.nb;
  const lenOf = new Map(Rs.map(r => [r.id, Math.hypot(r.comp.b[0] - r.comp.a[0], r.comp.b[1] - r.comp.a[1])]));
  let list = Rs.map(r => ({ key: r.id, n1: r.na, n2: r.nb, R: r.value, name: r.name, members: new Set([r.id]), orig: true, host: r.id }));
  const steps = [];
  let ns = 0, np = 0, guard = 0;
  const deg = n => list.filter(r => r.n1 === n || r.n2 === n).length;
  while (guard++ < 200) {
    // resistencias con los dos extremos en el mismo nodo: no llevan corriente
    const sh = list.find(r => r.n1 === r.n2);
    if (sh) { steps.push({ type: 'short', parts: [sh], note: `${sh.name} tiene sus dos extremos unidos por cables: está en cortocircuito y no aporta.` }); list = list.filter(r => r !== sh); continue; }
    // ramas abiertas (un extremo suelto)
    const dang = list.find(r => [r.n1, r.n2].some(n => n !== t1 && n !== t2 && deg(n) === 1));
    if (dang) { steps.push({ type: 'open', parts: [dang], note: `${dang.name} tiene un extremo suelto: no circula corriente por ella.` }); list = list.filter(r => r !== dang); continue; }
    // serie: nodo intermedio con exactamente dos resistencias
    const nodes = [...new Set(list.flatMap(r => [r.n1, r.n2]))];
    const mid = nodes.find(n => n !== t1 && n !== t2 && deg(n) === 2);
    if (mid !== undefined) {
      const [a, b] = list.filter(r => r.n1 === mid || r.n2 === mid);
      const ea = a.n1 === mid ? a.n2 : a.n1, eb = b.n1 === mid ? b.n2 : b.n1;
      const host = lenOf.get(a.host) >= lenOf.get(b.host) ? a.host : b.host;
      const nr = { key: `s${++ns}`, n1: ea, n2: eb, R: a.R + b.R, name: `R_{s${ns}}`, members: new Set([...a.members, ...b.members]), host };
      steps.push({ type: 'series', parts: [a, b], result: nr, absorbed: [a.host, b.host].filter(h => h !== host) });
      list = list.filter(r => r !== a && r !== b).concat(nr);
      continue;
    }
    // paralelo: dos o más resistencias entre el mismo par de nodos
    const groups = new Map();
    for (const r of list) { const k = r.n1 < r.n2 ? `${r.n1}|${r.n2}` : `${r.n2}|${r.n1}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const par = [...groups.values()].find(g => g.length > 1);
    if (par) {
      const R = 1 / par.reduce((t, r) => t + 1 / r.R, 0);
      const nr = { key: `p${++np}`, n1: par[0].n1, n2: par[0].n2, R, name: `R_{p${np}}`, members: new Set(par.flatMap(r => [...r.members])), host: par[0].host };
      steps.push({ type: 'parallel', parts: par, result: nr, ghost: par.slice(1).flatMap(r => [...r.members]) });
      list = list.filter(r => !par.includes(r)).concat(nr);
      continue;
    }
    break;
  }
  const between = list.filter(r => (r.n1 === t1 && r.n2 === t2) || (r.n1 === t2 && r.n2 === t1));
  if (list.length === 1 && between.length === 1) return { ok: true, steps, Req: list[0].R, last: list[0] };
  if (!list.length) return { ok: false, steps, reason: 'No hay resistencias entre los terminales de la fuente: el circuito está abierto o en cortocircuito.' };
  return { ok: false, steps, rest: list, reason: 'El circuito no se puede reducir solo con combinaciones en serie y en paralelo (por ejemplo, un puente). La resistencia equivalente se obtiene con Kirchhoff: R_eq = ε / I.' };
}

/* ------------------------------------------------------------------ mallas ------------------------------------------------------------------ */

function meshMethod(meshes, loopsOf) {
  const eqs = meshes.map(m => {
    const terms = [];                 // {kind:'E'|'R', sign, value, name, others:[{mesh, sign}], el}
    // empezar en la fuente si está en la malla (como en clase)
    let start = m.cyc.findIndex(h => h.e.kind === 'E');
    if (start < 0) start = m.cyc.findIndex(h => h.e.kind === 'R');
    const cyc = m.cyc.slice(start).concat(m.cyc.slice(0, start));
    for (const h of cyc) {
      if (h.e.kind === 'W') continue;
      const b = h.e.ref, fwd = h.u === b.u;               // recorrido a favor de a→b del elemento
      if (h.e.kind === 'E') terms.push({ kind: 'E', sign: fwd ? 1 : -1, value: b.comp.value, name: 'ε', el: b });
      else {
        const others = (loopsOf.get(b) || []).filter(o => o.mesh !== m).map(o => ({ mesh: o.mesh, sign: o.fwd === fwd ? 1 : -1 }));
        terms.push({ kind: 'R', value: b.comp.value, name: b.comp.name, others, el: b });
      }
    }
    // forma ordenada: Σ coef·I = constante
    const coef = new Map(meshes.map(x => [x.i, F.ZERO]));
    let rhs = F.ZERO;
    for (const t of terms) {
      const v = F.fromNum(t.value);
      if (t.kind === 'E') rhs = F.sub(rhs, F.mul(F.Q(t.sign), v));          // ε pasa al otro lado
      else {
        coef.set(m.i, F.sub(coef.get(m.i), v));
        for (const o of t.others) coef.set(o.mesh.i, F.sub(coef.get(o.mesh.i), F.mul(F.Q(o.sign), v)));
      }
    }
    // dejar el coeficiente propio positivo: multiplicar por −1
    for (const [k, c] of coef) coef.set(k, F.neg(c));
    rhs = F.neg(rhs);
    return { mesh: m, terms, coef, rhs };
  });
  const vars = meshes.map(m => ({ i: m.i, name: m.name }));
  return { eqs, vars, solve: substitution(eqs.map((e, k) => ({ coef: e.coef, rhs: e.rhs, label: `(${k + 1})` })), vars) };
}

/* ------------------------------------------------------------------ ramas ------------------------------------------------------------------ */

function branchMethod(els, E, meshes, N) {
  const deg = Array(N).fill(0);
  els.forEach(e => { deg[e.na]++; deg[e.nb]++; });
  const principal = [...Array(N).keys()].filter(n => deg[n] >= 3);
  const used = new Set();
  const branches = [];
  const walk = (start, first) => {
    const chain = [];
    let node = start, e = first;
    while (e && !used.has(e)) {
      used.add(e);
      const fwd = e.na === node;
      chain.push({ el: e, fwd });
      node = fwd ? e.nb : e.na;
      if (deg[node] !== 2 || principal.includes(node)) break;
      e = els.find(x => !used.has(x) && (x.na === node || x.nb === node));
    }
    return { chain, from: start, to: node };
  };
  const starts = principal.length ? principal : [E.na];
  for (const p of starts) for (const e of els.filter(x => x.na === p || x.nb === p)) {
    if (used.has(e)) continue;
    const br = walk(p, e);
    if (br.chain.length) branches.push(br);
  }
  // elementos que no quedaron en ninguna rama (ramas sueltas)
  const deadEnds = branches.filter(b => deg[b.to] === 1 || deg[b.from] === 1);
  let live = branches.filter(b => !deadEnds.includes(b));
  // orientar: si la rama tiene la fuente, la corriente sale por el +
  for (const b of live) {
    const s = b.chain.find(c => c.el.type === 'E');
    if (s && !s.fwd) { b.chain = b.chain.slice().reverse().map(c => ({ el: c.el, fwd: !c.fwd })); [b.from, b.to] = [b.to, b.from]; }
  }
  live.sort((a, b) => (b.chain.some(c => c.el.type === 'E') ? 1 : 0) - (a.chain.some(c => c.el.type === 'E') ? 1 : 0));
  live.forEach((b, i) => { b.name = `I${sub(i + 1)}`; b.i = i; });
  // nombres de los nodos principales
  const pnames = new Map(principal.map((n, i) => [n, String.fromCharCode(97 + i)]));
  // dirección de cada elemento dentro de su rama
  const dirOf = new Map();
  for (const b of live) for (const c of b.chain) dirOf.set(c.el, { br: b, fwd: c.fwd });
  // corrientes de rama numéricas
  for (const b of live) { const c = b.chain[0]; b.I = c.el.type === 'R' ? (c.fwd ? c.el.I : -c.el.I) : (c.fwd ? c.el.I : -c.el.I); }

  const eqs = [];
  // ley de nodos en todos los nodos principales menos uno
  principal.slice(0, Math.max(0, principal.length - 1)).forEach(n => {
    const ins = live.filter(b => b.to === n), outs = live.filter(b => b.from === n);
    const coef = new Map(live.map(b => [b.i, F.ZERO]));
    ins.forEach(b => coef.set(b.i, F.add(coef.get(b.i), F.ONE)));
    outs.forEach(b => coef.set(b.i, F.sub(coef.get(b.i), F.ONE)));
    eqs.push({ kind: 'node', node: pnames.get(n), ins, outs, coef, rhs: F.ZERO });
  });
  // ley de mallas
  for (const m of meshes) {
    let start = m.cyc.findIndex(h => h.e.kind === 'E');
    if (start < 0) start = m.cyc.findIndex(h => h.e.kind === 'R');
    const cyc = m.cyc.slice(start).concat(m.cyc.slice(0, start));
    const terms = [];
    const coef = new Map(live.map(b => [b.i, F.ZERO]));
    let rhs = F.ZERO;
    for (const h of cyc) {
      if (h.e.kind === 'W') continue;
      const b = h.e.ref, el = els.find(x => x.u === b.u && x.v === b.v);
      const fwdEl = h.u === b.u;
      const d = dirOf.get(el);
      if (!d) continue;
      const v = F.fromNum(b.comp.value);
      if (h.e.kind === 'E') { terms.push({ kind: 'E', sign: fwdEl ? 1 : -1, value: b.comp.value }); rhs = F.sub(rhs, F.mul(F.Q(fwdEl ? 1 : -1), v)); }
      else {
        const along = fwdEl === d.fwd;                    // recorrido a favor de la corriente de rama
        terms.push({ kind: 'R', value: b.comp.value, name: b.comp.name, br: d.br, sign: along ? -1 : 1 });
        coef.set(d.br.i, F.add(coef.get(d.br.i), F.mul(F.Q(along ? -1 : 1), v)));
      }
    }
    // ordenar: Σ coef·I = constante, con la ε al lado derecho
    for (const [k, c] of coef) coef.set(k, F.neg(c));
    rhs = F.neg(rhs);
    eqs.push({ kind: 'loop', mesh: m, terms, coef, rhs });
  }
  const vars = live.map(b => ({ i: b.i, name: b.name }));
  return { branches: live, deadEnds, principal, pnames, eqs, vars, solve: substitution(eqs.map((e, k) => ({ coef: e.coef, rhs: e.rhs, label: `(${k + 1})` })), vars) };
}

/* ------------------------------------------------------------------ sustitución ------------------------------------------------------------------ */

/**
 * Resuelve Σ coef·x = rhs por sustitución: se despeja una incógnita de la ecuación más sencilla,
 * se sustituye en las demás y se repite; al final se devuelven los valores.
 */
export function substitution(eqs, vars) {
  let rem = eqs.map(e => ({ coef: new Map(e.coef), rhs: e.rhs, label: e.label }));
  const steps = [], isolated = [];
  let n = 0;
  while (rem.length) {
    rem.forEach(e => { for (const [k, c] of [...e.coef]) if (F.isZero(c)) e.coef.delete(k); });
    rem.sort((a, b) => a.coef.size - b.coef.size);
    const e = rem.find(x => x.coef.size > 0);
    if (!e) { steps.push({ type: 'singular' }); break; }
    let v = [...e.coef.keys()].find(k => { const c = e.coef.get(k); return c.d === 1n && (c.n === 1n || c.n === -1n); });
    if (v === undefined) v = [...e.coef.keys()][0];
    const cv = e.coef.get(v);
    const terms = new Map();
    for (const [k, c] of e.coef) if (k !== v) terms.set(k, F.neg(F.div(c, cv)));
    const cst = F.div(e.rhs, cv);
    isolated.push({ v, cst, terms, from: e.label });
    steps.push({ type: 'isolate', v, cst, terms, from: e.label, eq: { coef: new Map(e.coef), rhs: e.rhs } });
    rem = rem.filter(x => x !== e);
    const changed = [];
    for (const x of rem) {
      const c = x.coef.get(v);
      if (!c || F.isZero(c)) continue;
      x.coef.delete(v);
      for (const [k, t] of terms) x.coef.set(k, F.add(x.coef.get(k) || F.ZERO, F.mul(c, t)));
      x.rhs = F.sub(x.rhs, F.mul(c, cst));
      x.label = `(${eqs.length + ++n})`;
      changed.push({ coef: new Map(x.coef), rhs: x.rhs, label: x.label, before: { c, v } });
    }
    if (changed.length) steps.push({ type: 'subst', v, eqs: changed });
  }
  const values = new Map();
  const back = [];
  for (const iso of isolated.slice().reverse()) {
    let val = iso.cst;
    for (const [k, t] of iso.terms) val = F.add(val, F.mul(t, values.get(k) || F.ZERO));
    values.set(iso.v, val);
    back.push({ ...iso, value: val });
  }
  return { steps, back, values, vars };
}
