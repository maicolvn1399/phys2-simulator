// Álgebra exacta mínima para escribir los resultados de Biot–Savart "como en el examen":
// posiciones como múltiplos racionales de una longitud a, y resultados del tipo −μ0 I / (2π a √5).
//
//  - Frac: racional p/q
//  - Surd: suma de términos c·√n (c racional, n entero libre de cuadrados)

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

export function frac(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const F = {
  add: (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
  sub: (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
  mul: (a, b) => frac(a.n * b.n, a.d * b.d),
  div: (a, b) => frac(a.n * b.d, a.d * b.n),
  neg: a => frac(-a.n, a.d),
  val: a => a.n / a.d,
  isZero: a => a.n === 0,
};

/** Aproxima v por p/q con q ≤ maxDen; null si no hay fracción simple. */
export function toFrac(v, maxDen = 120, tol = 1e-7) {
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(v * q);
    if (Math.abs(v - p / q) < tol) return frac(p, q);
  }
  return null;
}

/** k² · m con m libre de cuadrados. */
function squareFree(n) {
  let k = 1, m = n;
  for (let f = 2; f * f <= m; f++) while (m % (f * f) === 0) { m /= f * f; k *= f; }
  return { k, m };
}

/** √(p/q) = (k/q)·√m */
export function sqrtFrac(r) {
  if (r.n < 0) throw new Error('raíz negativa');
  if (r.n === 0) return surd();
  const { k, m } = squareFree(r.n * r.d);
  return surd([[m, frac(k, r.d)]]);
}

export function surd(terms = []) {
  const map = new Map();
  for (const [n, c] of terms) {
    const prev = map.get(n) || frac(0);
    const s = F.add(prev, c);
    if (F.isZero(s)) map.delete(n); else map.set(n, s);
  }
  return map;
}
export const S = {
  add: (a, b) => surd([...a.entries(), ...b.entries()]),
  sub: (a, b) => surd([...a.entries(), ...[...b.entries()].map(([n, c]) => [n, F.neg(c)])]),
  scale: (a, r) => surd([...a.entries()].map(([n, c]) => [n, F.mul(c, r)])),
  rat: r => surd([[1, r]]),
  val: a => [...a.entries()].reduce((t, [n, c]) => t + F.val(c) * Math.sqrt(n), 0),
  isZero: a => a.size === 0,
};

/* ---------- formato TeX ---------- */

const fracTex = (r, body = '') => {
  // r·body con r racional positivo
  if (r.d === 1) return r.n === 1 && body ? body : `${r.n}${body}`;
  return `\\frac{${r.n === 1 && body ? body : `${r.n}${body}`}}{${r.d}}`;
};

/** Coordenada en unidades de a: 0, a, −a, a/2, 3a/4… */
export function aTex(r) {
  if (F.isZero(r)) return '0';
  const s = r.n < 0 ? '-' : '', p = Math.abs(r.n);
  if (r.d === 1) return `${s}${p === 1 ? '' : p}a`;
  return `${s}\\tfrac{${p === 1 ? '' : p}a}{${r.d}}`;
}
/** (c − w) con c en unidades de a, p. ej. (a/2 − y); si c = 0 queda −y. */
export function diffTex(c, w) {
  return F.isZero(c) ? `(-${w})` : `\\left(${aTex(c)} - ${w}\\right)`;
}
/** c² en unidades de a: a², a²/4, 9a²/4… */
export function aSqTex(c) {
  const q = F.mul(c, c);
  if (q.d === 1) return `${q.n === 1 ? '' : q.n}a^{2}`;
  return `\\tfrac{${q.n === 1 ? '' : q.n}a^{2}}{${q.d}}`;
}
/** Racional sin a. */
export function ratTex(r) {
  if (r.d === 1) return `${r.n}`;
  return `${r.n < 0 ? '-' : ''}\\tfrac{${Math.abs(r.n)}}{${r.d}}`;
}

/**
 * Término c·√n escrito con el radical en el denominador cuando conviene (1/√5 en lugar de √5/5),
 * multiplicando a `body` (p. ej. "\mu_0 I") y dividido entre `den` (p. ej. "\pi a").
 * Devuelve { sign, tex } con tex positivo.
 */
function termTex(c, n, body, den) {
  const sign = c.n < 0 ? '-' : '+';
  const a = frac(Math.abs(c.n), c.d);
  if (n === 1) {
    const num = a.n === 1 ? (body || '1') : `${a.n}${body}`;
    const dd = a.d === 1 ? den : `${a.d}${den}`;
    return { sign, tex: dd ? `\\frac{${num}}{${dd}}` : num };
  }
  // c√n = (c·n)/√n
  const cn = frac(a.n * n, a.d);
  const num = cn.n === 1 ? body : `${cn.n}${body}`;
  return { sign, tex: `\\frac{${num || '1'}}{${cn.d === 1 ? '' : cn.d}${den}\\sqrt{${n}}}` };
}

/** Suma de surds multiplicada por body/den, p. ej. −μ0 I/(2π a √5). */
export function surdTex(s, body = '', den = '') {
  const items = [...s.entries()].sort((x, y) => x[0] - y[0]).map(([n, c]) => termTex(c, n, body, den));
  if (!items.length) return '0';
  return items.map((t, i) => (i === 0 ? (t.sign === '-' ? '-' : '') : ` ${t.sign} `) + t.tex).join('');
}