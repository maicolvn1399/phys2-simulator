// Escenarios predeterminados. Posiciones en metros, corrientes en amperes.
// `expected` guarda el resultado del folleto para comprobar la simulación.

export const PRESETS = {
  cuadrado: {
    name: 'Ejercicio 1: cuatro conductores en un cuadrado',
    note: 'Lado 0,2 m, I = 5 A. A y B entran (⊗), C y D salen (⊙). P en el centro del cuadrado.',
    wires: [
      { x: -0.1, y: 0.1, I: 5, s: -1, name: 'A' },
      { x: 0.1, y: 0.1, I: 5, s: 1, name: 'C' },
      { x: -0.1, y: -0.1, I: 5, s: -1, name: 'B' },
      { x: 0.1, y: -0.1, I: 5, s: 1, name: 'D' },
    ],
    probe: { x: 0, y: 0 },
    expected: { bx: 0, by: -2e-5, text: 'B = −2,00 × 10⁻⁵ ĵ T' },
  },
  tres: {
    name: 'Ejercicio 3: tres alambres (I₁, I₂, I₃)',
    note: 'El enunciado deja a e I en general; aquí a = 10 cm e I = 5 A. I₁ e I₂ entran, I₃ sale. P en el origen. Cambia a moviendo los alambres.',
    wires: [
      { x: 0, y: 0.1, I: 5, s: -1, name: '1' },
      { x: -0.1, y: 0, I: 5, s: -1, name: '2' },
      { x: 0.1, y: 0, I: 5, s: 1, name: '3' },
    ],
    probe: { x: 0, y: 0 },
    expected: { bx: -1e-5, by: -2e-5, text: 'B = −(μ₀I/2πa)(î + 2ĵ) = (−1,00 î − 2,00 ĵ) × 10⁻⁵ T' },
  },
  cuatro: {
    name: 'Ejercicio 4: cuatro alambres con corrientes distintas',
    note: 'I₁ = 1 A sale en (0; 6) cm, I₂ = 2 A entra en (−4; 0) cm, I₃ = 3 A entra en (5; 0) cm, I₄ = 4 A sale en (0; −3) cm. P en el origen.',
    wires: [
      { x: 0, y: 0.06, I: 1, s: 1, name: '1' },
      { x: -0.04, y: 0, I: 2, s: -1, name: '2' },
      { x: 0.05, y: 0, I: 3, s: -1, name: '3' },
      { x: 0, y: -0.03, I: 4, s: 1, name: '4' },
    ],
    probe: { x: 0, y: 0 },
    view: 0.1,
    expected: { bx: -7e-5 / 3, by: 2e-6, text: 'B = (−2,33 × 10⁻⁵ î + 2,00 × 10⁻⁶ ĵ) T' },
  },
  uno: {
    name: 'Un alambre',
    note: 'El círculo de Ampère pasa por P: B tiene el mismo tamaño en todo el círculo y cae como 1/r.',
    wires: [{ x: 0, y: 0, I: 6, s: 1, name: 'A' }],
    probe: { x: 0.08, y: 0 },
  },
  mismo: {
    name: 'Dos paralelos, mismo sentido',
    note: 'Entre los alambres sus campos se oponen. En el punto medio B = 0.',
    wires: [
      { x: -0.06, y: 0, I: 6, s: 1, name: 'A' },
      { x: 0.06, y: 0, I: 6, s: 1, name: 'B' },
    ],
    probe: { x: 0, y: 0.05 },
  },
  opuestos: {
    name: 'Dos paralelos, sentidos opuestos',
    note: 'Entre los alambres sus campos apuntan igual y se suman.',
    wires: [
      { x: -0.06, y: 0, I: 6, s: 1, name: 'A' },
      { x: 0.06, y: 0, I: 6, s: -1, name: 'B' },
    ],
    probe: { x: 0, y: 0 },
  },
};

export const clone = v => JSON.parse(JSON.stringify(v));
