// Tramo recto resuelto como en el examen: coordenadas del plano (origen en los ejes), dl = dx î, dy ĵ
// o dx(î + m ĵ) si está inclinado, r en componentes, producto cruz con determinante e integral
// ∫ dw / D(w)^{3/2} con D(w) = |r|² = A w² + B w + C.
//   ∫ dw / D^{3/2} = 2(2A w + B) / (Δ √D),  Δ = 4AC − B²;   en w → ±∞ tiende a ±4√A / Δ.
import { frac, F, toFrac, sqrtFrac, S } from './exact.js';

export function segExam(e, P, a) {
  const z = P.z || 0;
  const dx = e.bx - e.ax, dy = e.by - e.ay;
  const kind = Math.abs(dy) < 1e-12 ? 'h' : Math.abs(dx) < 1e-12 ? 'v' : 'i';
  const w = kind === 'v' ? 'y' : 'x';
  const sigma = kind === 'v' ? Math.sign(dy) : Math.sign(dx);          // corriente hacia +w (1) o −w (−1)
  const wA = kind === 'v' ? e.ay : e.ax, wB = kind === 'v' ? e.by : e.bx;
  const lo0 = e.infA ? -sigma * Infinity : wA, hi0 = e.infB ? sigma * Infinity : wB;
  const [wlo, whi] = lo0 < hi0 ? [lo0, hi0] : [hi0, lo0];
  const m = kind === 'i' ? dy / dx : 0;
  const b = kind === 'h' ? e.ay : kind === 'i' ? e.ay - m * e.ax : 0;

  // ---------- versión numérica (siempre) ----------
  let A, B, C, K;   // K = (dl × r)/dw, constante
  if (kind === 'v') {
    const x0 = e.ax;
    A = 1; B = -2 * P.y; C = P.y * P.y + (P.x - x0) ** 2 + z * z;
    K = [sigma * z, 0, -sigma * (P.x - x0)];
  } else {
    A = 1 + m * m; B = -2 * P.x - 2 * m * (P.y - b); C = P.x * P.x + (P.y - b) ** 2 + z * z;
    K = [sigma * m * z, -sigma * z, sigma * (P.y - b - m * P.x)];
  }
  const D = A * C * 4 - B * B;
  const Fw = v => (!Number.isFinite(v) ? Math.sign(v) * 4 * Math.sqrt(A) / D : (2 * (2 * A * v + B)) / (D * Math.sqrt(A * v * v + B * v + C)));
  const J = Fw(whi) - Fw(wlo);
  const onLine = D < 1e-14;
  const out = { kind, w, sigma, wlo, whi, m, b, A, B, C, K, J, onLine, Dl: D, Fhi: Fw(whi), Flo: Fw(wlo), x0: e.ax, y0: e.ay, Bvec: K.map(k => 1e-7 * k * J) };

  // ---------- versión exacta en unidades de a (solo en el plano y con fracciones simples) ----------
  if (Math.abs(z) > 1e-12 || !(a > 0) || onLine) return out;
  const fr = v => (Number.isFinite(v) ? toFrac(v / a) : null);
  const xP = fr(P.x), yP = fr(P.y);
  const ends = [e.ax, e.ay, e.bx, e.by].map(fr);
  if (!xP || !yP || ends.some(v => !v)) return out;
  const [ax, ay, bx, by] = ends;
  let Ae, Be, Ce, Ke, me = frac(0), be = frac(0);
  const sg = frac(sigma);
  if (kind === 'v') {
    const dxp = F.sub(xP, ax);
    Ae = frac(1); Be = F.mul(frac(-2), yP); Ce = F.add(F.mul(yP, yP), F.mul(dxp, dxp));
    Ke = F.mul(F.neg(sg), dxp);
  } else {
    me = kind === 'h' ? frac(0) : F.div(F.sub(by, ay), F.sub(bx, ax));
    be = F.sub(ay, F.mul(me, ax));
    const yb = F.sub(yP, be);
    Ae = F.add(frac(1), F.mul(me, me));
    Be = F.sub(F.mul(frac(-2), xP), F.mul(F.mul(frac(2), me), yb));
    Ce = F.add(F.mul(xP, xP), F.mul(yb, yb));
    Ke = F.mul(sg, F.sub(yb, F.mul(me, xP)));
  }
  if (Math.abs(Ae.d) > 1e6 || Math.abs(Ce.d) > 1e6) return out;
  const De = F.sub(F.mul(frac(4), F.mul(Ae, Ce)), F.mul(Be, Be));
  const Fe = v => {
    if (!Number.isFinite(v)) return S.scale(sqrtFrac(Ae), F.div(frac(Math.sign(v) * 4), De));
    const wv = fr(v);
    const Dv = F.add(F.add(F.mul(Ae, F.mul(wv, wv)), F.mul(Be, wv)), Ce);       // D(w) / a²
    const R = F.div(F.mul(frac(2), F.add(F.mul(F.mul(frac(2), Ae), wv), Be)), De);
    return S.scale(sqrtFrac(Dv), F.div(R, Dv));                                  // R / √Dv
  };
  const Fhi = Fe(whi), Flo = Fe(wlo);
  const Je = S.sub(Fhi, Flo);                   // integral × a²
  const T = S.scale(Je, F.div(Ke, frac(4)));    // B_z = μ0 I/(π a) · T
  return { ...out, exact: { xP, yP, ax, ay, bx, by, m: me, b: be, K: Ke, A: Ae, B: Be, C: Ce, D: De, J: Je, T, Fhi, Flo } };
}
