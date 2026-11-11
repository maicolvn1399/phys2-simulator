// Ley de Biot–Savart para tramos rectos (finitos, semi-infinitos o infinitos) y arcos de circunferencia
// en el plano z = 0. El punto P puede estar fuera del plano (P.z ≠ 0).
//   dB = (μ0 I / 4π) · (dl × r̂) / r²,   r = P − (punto del alambre)
// Unidades SI: metros, amperes, teslas.

export const MU0 = 4 * Math.PI * 1e-7;
const K0 = MU0 / (4 * Math.PI); // 1e-7
const EPS = 1e-6;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** sin β = s / √(s² + d²), con s = ±∞ → ±1. */
const sinB = (s, d) => (s === Infinity ? 1 : s === -Infinity ? -1 : s / Math.hypot(s, d));

/**
 * Tramo recto de A a B (la corriente va de A hacia B). infA / infB: el alambre sigue hasta el infinito
 * más allá de A / de B. Se parametriza con s medido desde el pie F de la perpendicular trazada desde P:
 *   punto = F + s l̂,  dl = l̂ ds,  r = d − s l̂,  dl × r̂ = (d ds / r) û,  û = l̂ × d̂
 *   B = (μ0 I / 4π d) [s/√(s²+d²)] de s1 a s2 = (μ0 I / 4π d)(sin β2 − sin β1)
 */
export function segField(e, P, I) {
  const ex = e.bx - e.ax, ey = e.by - e.ay, L = Math.hypot(ex, ey) || 1e-9;
  const l = [ex / L, ey / L, 0];
  const wx = P.x - e.ax, wy = P.y - e.ay;
  const sP = wx * l[0] + wy * l[1];                       // posición de F respecto de A, medida sobre l̂
  const foot = [e.ax + sP * l[0], e.ay + sP * l[1]];
  const dv = [P.x - foot[0], P.y - foot[1], P.z || 0];     // vector d = P − F
  const d = Math.hypot(dv[0], dv[1], dv[2]);
  const s1 = e.infA ? -Infinity : -sP, s2 = e.infB ? Infinity : L - sP;
  const base = { kind: 'seg', L, l, foot, dv, d, s1, s2, sP };

  if (d < EPS) {
    const inside = s1 < 0 && s2 > 0;
    return { ...base, onLine: true, singular: inside, mag: 0, signed: 0, u: [0, 0, 0], B: [0, 0, 0], beta1: 0, beta2: 0 };
  }
  const sin1 = sinB(s1, d), sin2 = sinB(s2, d);
  const mag = (K0 * I / d) * (sin2 - sin1);              // ≥ 0 porque s2 > s1
  const u = cross(l, [dv[0] / d, dv[1] / d, dv[2] / d]);  // û = l̂ × d̂
  return {
    ...base, onLine: false, singular: false, sin1, sin2,
    beta1: Math.asin(sin1), beta2: Math.asin(sin2),
    mag, u, B: u.map(c => c * mag),
  };
}

/**
 * Arco de centro C, radio R, desde φ1 hasta φ2 (radianes). Si φ2 > φ1 la corriente gira antihorario.
 * dl = R dφ φ̂. Con P sobre el eje del arco (misma x, y que C) la integral es cerrada:
 *   r = −R r̂ + z k̂,  dl × r = R dφ (R k̂ + z r̂)
 *   Bz = μ0 I R² Δφ / (4π (R²+z²)^{3/2}),  B∥ = μ0 I R z / (4π (R²+z²)^{3/2}) · (sin φ2 − sin φ1, −(cos φ2 − cos φ1))
 * En otro punto se integra numéricamente (Simpson).
 */
export function arcField(e, P, I, N = 600) {
  const dphi = e.p2 - e.p1;
  const qx = P.x - e.cx, qy = P.y - e.cy, z = P.z || 0, rho = Math.hypot(qx, qy);
  if (rho < EPS) {
    const den = Math.pow(e.R * e.R + z * z, 1.5);
    const kz = K0 * I * e.R * e.R / den, kr = K0 * I * e.R * z / den;
    const B = [kr * (Math.sin(e.p2) - Math.sin(e.p1)), -kr * (Math.cos(e.p2) - Math.cos(e.p1)), kz * dphi];
    return { kind: 'arc', centered: true, dphi, z, r: Math.sqrt(e.R * e.R + z * z), B, mag: Math.hypot(...B), singular: false };
  }
  // ¿P sobre el propio arco?
  const ang = Math.atan2(qy, qx);
  const onCircle = Math.abs(rho - e.R) < 1e-4 && Math.abs(z) < 1e-4;
  if (onCircle && angleInSweep(ang, e.p1, e.p2)) return { kind: 'arc', centered: false, dphi, B: [0, 0, 0], mag: 0, singular: true };
  const B = simpsonArc(e, P, I, e.p1, e.p2, N);
  return { kind: 'arc', centered: false, dphi, B, mag: Math.hypot(...B), singular: false, N };
}

function arcIntegrand(e, P, phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  const Sx = e.cx + e.R * c, Sy = e.cy + e.R * s;
  const r = [P.x - Sx, P.y - Sy, P.z || 0];
  const rr = Math.hypot(r[0], r[1], r[2]);
  const dl = [-e.R * s, e.R * c, 0];
  const v = cross(dl, r), k = 1 / (rr * rr * rr);
  return [v[0] * k, v[1] * k, v[2] * k];
}

export function simpsonArc(e, P, I, a, b, N = 600) {
  if (N % 2) N++;
  const h = (b - a) / N, acc = [0, 0, 0];
  for (let i = 0; i <= N; i++) {
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    const f = arcIntegrand(e, P, a + i * h);
    acc[0] += w * f[0]; acc[1] += w * f[1]; acc[2] += w * f[2];
  }
  return acc.map(v => (K0 * I * v * h) / 3);
}

export function angleInSweep(a, p1, p2) {
  const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
  if (hi - lo >= 2 * Math.PI - 1e-9) return true;
  let t = a;
  while (t < lo) t += 2 * Math.PI;
  while (t > lo + 2 * Math.PI) t -= 2 * Math.PI;
  return t <= hi + 1e-9;
}

/** Piezas rectas de una curva libre (polilínea). */
export const polyPieces = e => e.pts.slice(1).map((q, k) => ({ type: 'seg', ax: e.pts[k][0], ay: e.pts[k][1], bx: q[0], by: q[1], infA: false, infB: false }));

/**
 * Curva libre dibujada a mano: se trata como N tramos rectos consecutivos. Cada pieza se integra
 * exactamente con la fórmula del tramo recto y se suman.
 */
export function polyField(e, P, I) {
  const pieces = polyPieces(e).map(q => segField(q, P, I));
  const B = pieces.reduce((t, p) => [t[0] + p.B[0], t[1] + p.B[1], t[2] + p.B[2]], [0, 0, 0]);
  const L = pieces.reduce((t, p) => t + p.L, 0);
  return { kind: 'poly', pieces, L, B, mag: Math.hypot(...B), singular: pieces.some(p => p.singular), N: pieces.length };
}

export function elementField(e, P, I) {
  return e.type === 'seg' ? segField(e, P, I) : e.type === 'poly' ? polyField(e, P, I) : arcField(e, P, I);
}

export function totalField(elements, P, I) {
  const parts = elements.map(e => elementField(e, P, I));
  const B = parts.reduce((t, p) => [t[0] + p.B[0], t[1] + p.B[1], t[2] + p.B[2]], [0, 0, 0]);
  return { parts, B, singular: parts.some(p => p.singular) };
}

/** Bz en el plano (z = 0) para el mapa de fondo; los arcos usan pocas muestras. */
export function bzPlane(elements, x, y, I) {
  let bz = 0;
  const P = { x, y, z: 0 };
  for (const e of elements) {
    if (e.type === 'seg') { const f = segField(e, P, I); if (f.singular) return NaN; bz += f.B[2]; }
    else if (e.type === 'poly') { for (const q of polyPieces(e)) { const f = segField(q, P, I); if (f.singular) return NaN; bz += f.B[2]; } }
    else {
      const qx = x - e.cx, qy = y - e.cy, rho = Math.hypot(qx, qy);
      if (Math.abs(rho - e.R) < 0.004 && angleInSweep(Math.atan2(qy, qx), e.p1, e.p2)) return NaN;
      bz += rho < EPS ? (K0 * I * (e.p2 - e.p1)) / e.R : simpsonArc(e, P, I, e.p1, e.p2, 48)[2];
    }
  }
  return bz;
}

/* ---------- geometría para dibujar ---------- */

export function arcPoint(e, phi) { return [e.cx + e.R * Math.cos(phi), e.cy + e.R * Math.sin(phi)]; }

/** Distancia (m) de un punto al elemento, para seleccionar con el puntero. */
export function distToElement(e, x, y, far = 5) {
  if (e.type === 'poly') return Math.min(...polyPieces(e).map(q => distToElement(q, x, y, far)));
  if (e.type === 'seg') {
    const ex = e.bx - e.ax, ey = e.by - e.ay, L2 = ex * ex + ey * ey || 1e-12;
    let t = ((x - e.ax) * ex + (y - e.ay) * ey) / L2;
    const lo = e.infA ? -far : 0, hi = e.infB ? far : 1;
    t = Math.max(lo, Math.min(hi, t));
    return Math.hypot(x - (e.ax + t * ex), y - (e.ay + t * ey));
  }
  const qx = x - e.cx, qy = y - e.cy, a = Math.atan2(qy, qx);
  if (angleInSweep(a, e.p1, e.p2)) return Math.abs(Math.hypot(qx, qy) - e.R);
  const [x1, y1] = arcPoint(e, e.p1), [x2, y2] = arcPoint(e, e.p2);
  return Math.min(Math.hypot(x - x1, y - y1), Math.hypot(x - x2, y - y2));
}

/** Fracción acumulada de la integral (0 → 1) cuando el elemento dl recorre el alambre; t ∈ [0,1]. */
export function sweepAt(e, P, I, part, t) {
  if (e.type === 'poly') {
    const pieces = polyPieces(e);
    let u = t * part.L, acc = [0, 0, 0];
    for (let k = 0; k < pieces.length; k++) {
      const q = pieces[k], pk = part.pieces[k];
      if (u <= pk.L || k === pieces.length - 1) {
        const f = Math.min(1, u / pk.L), x = q.ax + (q.bx - q.ax) * f, y = q.ay + (q.by - q.ay) * f;
        if (f > 1e-6) { const pp = segField({ ...q, bx: x, by: y }, P, I); acc = acc.map((v, i) => v + pp.B[i]); }
        const tot = part.B, m2 = tot[0] ** 2 + tot[1] ** 2 + tot[2] ** 2;
        return { pos: [x, y], dir: [pk.l[0], pk.l[1]], frac: m2 > 0 ? (acc[0] * tot[0] + acc[1] * tot[1] + acc[2] * tot[2]) / m2 : 0, piece: k + 1 };
      }
      u -= pk.L; acc = acc.map((v, i) => v + pk.B[i]);
    }
    return null;
  }
  if (e.type === 'seg') {
    if (part.onLine) return null;
    const b = part.beta1 + t * (part.beta2 - part.beta1);         // se recorre uniformemente en β (cubre ±∞)
    const s = part.d * Math.tan(b);
    const pos = [part.foot[0] + s * part.l[0], part.foot[1] + s * part.l[1]];
    const frac = (Math.sin(b) - part.sin1) / (part.sin2 - part.sin1 || 1);
    return { pos, dir: [part.l[0], part.l[1]], frac, s };
  }
  const phi = e.p1 + t * (e.p2 - e.p1);
  const pos = arcPoint(e, phi);
  const sg = Math.sign(e.p2 - e.p1) || 1;
  const dir = [-Math.sin(phi) * sg, Math.cos(phi) * sg];
  let frac = t;
  if (!part.centered && !part.singular) {
    const partial = simpsonArc(e, P, I, e.p1, phi, 40);
    const tot = part.B;
    const m2 = tot[0] * tot[0] + tot[1] * tot[1] + tot[2] * tot[2];
    frac = m2 > 0 ? (partial[0] * tot[0] + partial[1] * tot[1] + partial[2] * tot[2]) / m2 : 0;
  }
  return { pos, dir, frac, phi };
}

/**
 * Datos del tramo recto con la notación del curso:
 *  - coordenada de integración q = x (alambre horizontal), y (vertical) o l (inclinado, l = 0 en F);
 *  - θ = ángulo entre dl (sentido de la corriente) y r̂, siempre positivo (0° a 180°);
 *    θ1 en Q1 (donde empieza la corriente) y θ2 en Q2 (donde termina);
 *  - triángulo de cada extremo: cateto opuesto = d, cateto adyacente = |q − qP|, hipotenusa = r.
 *  B = μ0 I (cos θ1 − cos θ2) / (4π d).
 */
export function segCourse(e, part, P) {
  const [lx, ly] = part.l;
  const axis = Math.abs(ly) < 1e-9 ? 'x' : Math.abs(lx) < 1e-9 ? 'y' : 'l';
  const eq = axis === 'x' ? [1, 0] : axis === 'y' ? [0, 1] : [lx, ly];
  const cs = Math.sign(lx * eq[0] + ly * eq[1]) || 1;                 // corriente en +q (1) o −q (−1)
  const coord = (x, y) => (axis === 'x' ? x : axis === 'y' ? y : (x - part.foot[0]) * lx + (y - part.foot[1]) * ly);
  const qP = axis === 'x' ? P.x : axis === 'y' ? P.y : 0;
  const qA = e.infA ? -cs * Infinity : coord(e.ax, e.ay);
  const qB = e.infB ? cs * Infinity : coord(e.bx, e.by);
  const [qlo, qhi] = qA < qB ? [qA, qB] : [qB, qA];
  const d = part.d;
  const end = (q, isStart) => {
    if (!Number.isFinite(q)) return { q, inf: true, theta: isStart ? 0 : Math.PI, cos: isStart ? 1 : -1 };
    const CA = Math.abs(q - qP), r = Math.hypot(q - qP, d);
    const c = Math.max(-1, Math.min(1, (cs * (qP - q)) / r));   // cos θ = (dl̂ · r)/r
    const theta = Math.acos(c), alpha = Math.acos(Math.min(1, CA / r));
    return { q, inf: false, CA, r, theta, alpha, cos: c, front: CA < 1e-9, acute: c > 1e-12 };
  };
  return { axis, cs, qP, qlo, qhi, d, e1: end(qA, true), e2: end(qB, false), eq };
}

/**
 * Tramo recto descrito con L, h y s (como en los enunciados):
 *  - la posición de dl se mide sobre el alambre desde un origen O, en el sentido de la corriente
 *    (O = Q1; si el alambre viene desde el infinito, O = Q2; si es infinito en ambos sentidos, O = F);
 *  - L: largo del alambre; h: distancia perpendicular de P a la recta del alambre (cateto opuesto);
 *  - s: distancia sobre el alambre desde O hasta quedar frente a P (puede ser negativa o mayor que L).
 *  B = μ0 I / (4π h) [ (q − s) / √((q − s)² + h²) ] evaluado de q1 a q2.
 */
export function segLHS(e, part, P) {
  const [lx, ly] = part.l;
  const axis = Math.abs(ly) < 1e-9 ? 'x' : Math.abs(lx) < 1e-9 ? 'y' : 'l';
  const origin = !e.infA ? 'Q1' : !e.infB ? 'Q2' : 'F';
  const O = origin === 'Q1' ? [e.ax, e.ay] : origin === 'Q2' ? [e.bx, e.by] : part.foot;
  const s = origin === 'F' ? 0 : (P.x - O[0]) * lx + (P.y - O[1]) * ly;
  const L = !e.infA && !e.infB ? Math.hypot(e.bx - e.ax, e.by - e.ay) : Infinity;
  const q1 = origin === 'Q1' ? 0 : -Infinity;
  const q2 = origin === 'Q1' ? (e.infB ? Infinity : L) : origin === 'Q2' ? 0 : Infinity;
  const h = part.d, n = part.dv.map(v => v / h);
  const term = q => (!Number.isFinite(q) ? Math.sign(q) : (q - s) / Math.hypot(q - s, h));
  return { axis, origin, O, s, L, h, n, l: [lx, ly, 0], q1, q2, t1: term(q1), t2: term(q2), bracket: term(q2) - term(q1) };
}
