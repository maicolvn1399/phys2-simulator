// Inducción electromagnética: ley de Faraday  ε = −dΦ/dt  y ley de Lenz.
// Convención: el vector normal de la espira es n̂ = +z (hacia el observador) y Φ = N·B_z·A.
// ε > 0 significa corriente antihoraria vista de frente (regla de la mano derecha respecto de n̂); ε < 0, horaria.
// Entradas en unidades de la interfaz (cm, T, Ω, s, rad/s); los resultados salen en SI.

export const MODES = [
  ['field', 'B variable'],
  ['bar', 'Barra móvil'],
  ['rot', 'Espira giratoria'],
];

export const RAIL_LEN = 1.2;    // m, largo de los rieles (modo barra)
export const BAR_X0 = 0.2;      // m, posición inicial de la barra
const TWO_PI = 2 * Math.PI;

/** Modelo analítico del modo elegido: Φ(t), ε(t) y las magnitudes que dibuja el lienzo. */
export function model(mode, p) {
  let m;
  if (mode === 'field') {
    // espira circular fija en un campo uniforme y perpendicular que cambia con el tiempo
    const N = p.N, A = Math.PI * (p.r / 100) ** 2;
    if (p.shape === 'seno') {
      const w = TWO_PI * p.f;
      m = { N, A: () => A, T: 2 / p.f, w,
        B: t => p.Bm * Math.sin(w * t), dBdt: t => p.Bm * w * Math.cos(w * t),
        phi: t => N * A * p.Bm * Math.sin(w * t), emf: t => -N * A * p.Bm * w * Math.cos(w * t) };
    } else {
      m = { N, A: () => A, T: 4,
        B: t => p.B0 + p.beta * t, dBdt: () => p.beta,
        phi: t => N * A * (p.B0 + p.beta * t), emf: () => -N * A * p.beta };
    }
  } else if (mode === 'bar') {
    // barra de longitud L que se desliza con rapidez v sobre rieles, con B uniforme (⊙ si dirB = +1, ⊗ si −1)
    const L = p.L / 100, v = p.v / 100, Bz = p.dirB * p.Bu;
    m = { N: 1, L, v, T: 4, x: t => BAR_X0 + v * t, A: t => L * (BAR_X0 + v * t), B: () => Bz,
      phi: t => Bz * L * (BAR_X0 + v * t), emf: () => -Bz * L * v };
  } else {
    // espira rectangular de a × b que gira con velocidad angular ω en un campo uniforme B (θ = ángulo entre n̂ y B)
    const a = p.a / 100, b = p.b / 100, A = a * b, w = p.w;
    m = { N: p.N, a, b, A: () => A, w, T: (2 * TWO_PI) / w, B: () => p.Bu, theta: t => w * t,
      phi: t => p.N * p.Bu * A * Math.cos(w * t), emf: t => p.N * p.Bu * A * w * Math.sin(w * t) };
  }
  m.mode = mode;
  m.R = p.Rc;
  m.cur = t => m.emf(t) / p.Rc;
  // valores extremos en la ventana de tiempo (para escalar dibujos y gráficas)
  let phiAbs = 0, emfAbs = 0, Bmax = 0;
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * m.T;
    phiAbs = Math.max(phiAbs, Math.abs(m.phi(t))); emfAbs = Math.max(emfAbs, Math.abs(m.emf(t))); Bmax = Math.max(Bmax, Math.abs(m.B(t)));
  }
  m.stats = { phiAbs, emfAbs, Bmax };
  return m;
}

/** Muestras (t, valor) de una función del modelo sobre toda la ventana de tiempo. */
export const sample = (m, fn, n = 240) => Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * m.T; return [t, fn(t)]; });

/** Ley de Lenz en el instante t: cómo cambia Φ y hacia dónde va la corriente inducida. */
export function lenz(m, t) {
  const e = m.emf(t), tol = 1e-6 * (m.stats.emfAbs || 1);
  if (Math.abs(e) < tol) return { trend: 'flat', dir: 'none' };
  return { trend: e < 0 ? 'up' : 'down', dir: e > 0 ? 'ccw' : 'cw' };   // dΦ/dt = −ε
}
