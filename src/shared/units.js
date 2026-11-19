import { nf } from './format.js';

const PFX = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];

/** Prefijo SI que deja el valor máximo entre 1 y 1000: { f: factor, p: prefijo }. */
export function pickUnit(maxAbs) {
  if (!(maxAbs > 0) || !Number.isFinite(maxAbs)) return { f: 1, p: '' };
  for (const [f, p] of PFX) if (maxAbs >= f * 0.99995) return { f, p };
  return { f: 1e-9, p: 'n' };
}

/** Valor con prefijo SI y coma decimal: eng(0.0314, 'V') → "31,40 mV". `ref` fija el prefijo (por defecto, el del propio valor). */
export function eng(v, unit, d = 2, ref = Math.abs(v)) {
  const { f, p } = pickUnit(ref);
  return `${nf(v / f, d)} ${p}${unit}`;
}
