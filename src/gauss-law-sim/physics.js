// Esfera aislante con carga distribuida en TODO su volumen (no es un conductor).
// Unidades SI en este archivo: carga en C, longitudes en m, campo en N/C.

export const EPS0 = 8.8541878128e-12;          // C²/(N·m²)
export const K = 1 / (4 * Math.PI * EPS0);     // N·m²/C² ≈ 8,99×10⁹

export const DISTS = {
  uniform: { name: 'Uniforme', formula: 'ρ = constante' },
  linear: { name: 'Creciente con r', formula: 'ρ = ρ₀ r / R' },
};

/** Carga encerrada por una superficie gaussiana esférica de radio r, concéntrica con la esfera (radio R, carga total Q).
 *  Uniforme: q = Q (r/R)³ para r < R.  ρ = ρ₀ r/R: q = Q (r/R)⁴ para r < R.  Para r ≥ R: q = Q. */
export function qEnc(Q, R, r, dist) {
  const x = Math.max(0, Math.min(r, R)) / R;
  return Q * (dist === 'linear' ? x ** 4 : x ** 3);
}

/** Flujo eléctrico a través de la superficie gaussiana (N·m²/C): Φ = q_enc / ε₀. */
export const flux = (Q, R, r, dist) => qEnc(Q, R, r, dist) / EPS0;

/** Componente radial del campo (N/C), positiva hacia afuera: E_r = q_enc / (4π ε₀ r²). */
export function Er(Q, R, r, dist) {
  return r > 0 ? qEnc(Q, R, r, dist) / (4 * Math.PI * EPS0 * r * r) : 0;
}

/** Densidad volumétrica de carga ρ(r) en C/m³ (cero fuera de la esfera). */
export function rho(Q, R, r, dist) {
  if (r > R) return 0;
  return dist === 'linear' ? (Q / (Math.PI * R ** 3)) * (r / R) : (3 * Q) / (4 * Math.PI * R ** 3);
}

/** Región de la superficie gaussiana (r y R en cm): 'in' dentro, 'out' fuera, 'surface' sobre la superficie. */
export const region = (r, R) => (Math.abs(r - R) < 0.05 ? 'surface' : r < R ? 'in' : 'out');
