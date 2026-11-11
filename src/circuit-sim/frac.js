// Fracciones exactas con BigInt para resolver los sistemas de Kirchhoff sin errores de redondeo.
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };

export function Q(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
/** Número decimal → fracción (hasta 6 decimales). */
export function fromNum(v) {
  const s = 1000000n;
  return Q(BigInt(Math.round(v * 1e6)), s);
}
export const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
export const div = (a, b) => Q(a.n * b.d, a.d * b.n);
export const neg = a => Q(-a.n, a.d);
export const isZero = a => a.n === 0n;
export const val = a => Number(a.n) / Number(a.d);
export const ZERO = Q(0), ONE = Q(1);
