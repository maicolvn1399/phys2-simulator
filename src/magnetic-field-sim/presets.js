// Escenarios de Biot–Savart basados en los ejercicios del curso. Posiciones en metros, ángulos en radianes.
// `expected.B` es la respuesta analítica (T) para comprobar la simulación.

const PI = Math.PI;
const MU = 4 * PI * 1e-7;

// Ejercicio 1: el alambre llega por el eje x, se dobla en un arco de radio a centrado en P que barre
// el ángulo θ (horario) y sigue en línea recta alejándose de P. Los tramos rectos apuntan a P (dl ∥ r).
const A1 = 0.05, TH = (45 * PI) / 180, U1 = [Math.cos(PI - TH), Math.sin(PI - TH)];

export const BS_PRESETS = {
  doblado: {
    name: 'Ejercicio 1: alambre doblado (arco de ángulo θ)',
    note: 'θ = 45° (π/4), a = 5 cm e I = 10 A. Los dos tramos rectos están sobre rectas que pasan por P, así que solo aporta el arco. Para el inciso b) sube P con el control z.',
    I: 10, view: 0.1, focus: 1, a: 0.05, probe: { x: 0, y: 0, z: 0 },
    elements: [
      { type: 'seg', ax: -A1 - 0.06, ay: 0, bx: -A1, by: 0, infA: true, infB: false },
      { type: 'arc', cx: 0, cy: 0, R: A1, p1: PI, p2: PI - TH },
      { type: 'seg', ax: A1 * U1[0], ay: A1 * U1[1], bx: 0.12 * U1[0], by: 0.12 * U1[1], infA: false, infB: true },
    ],
    expected: { B: [0, 0, -(MU * 10 * TH) / (4 * PI * A1)], text: 'B = −μ₀I/(16a) k̂ = 15,7 µT, entrando al plano' },
  },
  examen: {
    name: 'Examen II 2025 (I sem.), problema 2: alambre doblado a 90°',
    note: 'a = 10 cm, I = 5 A. Origen en la unión; el vertical va de 0 a a (corriente hacia +y) y el horizontal de a a 0 (corriente hacia −x). P = (a; a/2).',
    I: 5, view: 0.2, a: 0.1, focus: 0, probe: { x: 0.1, y: 0.05, z: 0 },
    elements: [
      { type: 'seg', ax: 0, ay: 0, bx: 0, by: 0.1, infA: false, infB: false },
      { type: 'seg', ax: 0.1, ay: 0, bx: 0, by: 0, infA: false, infB: false },
    ],
    expected: { B: [0, 0, -(1.5 * MU * 5) / (PI * 0.1 * Math.sqrt(5))], text: 'B = −(3/2) μ₀I/(π a √5) k̂ = 13,4 µT, entrando' },
  },
  ele: {
    name: 'Ejercicio 2: dos alambres finitos en L',
    note: 'Dos tramos de longitud a = 10 cm con I = 5 A, con el origen en la unión. P está en la esquina opuesta del cuadrado de lado a: P = (a; a).',
    I: 5, view: 0.2, a: 0.1, probe: { x: 0.1, y: 0.1, z: 0 },
    elements: [
      { type: 'seg', ax: 0, ay: 0.1, bx: 0, by: 0, infA: false, infB: false },
      { type: 'seg', ax: 0, ay: 0, bx: 0.1, by: 0, infA: false, infB: false },
    ],
    expected: { B: [0, 0, (Math.SQRT2 * MU * 5) / (4 * PI * 0.1)], text: 'B = √2 μ₀I/(4πa) = 7,07 µT, saliendo del plano (+k̂)' },
  },
  cuarto: {
    name: 'Ejercicio 3: cuarto de circunferencia', focus: 1, a: 0.03,
    note: 'I = 10 A y R = 3 cm. Los tramos rectos apuntan hacia O (dl ∥ r), así que solo aporta el arco.',
    I: 10, view: 0.1, probe: { x: 0, y: 0, z: 0 },
    elements: [
      { type: 'seg', ax: 0, ay: 0.06, bx: 0, by: 0.03, infA: false, infB: false },
      { type: 'arc', cx: 0, cy: 0, R: 0.03, p1: PI / 2, p2: 0 },
      { type: 'seg', ax: 0.03, ay: 0, bx: 0.06, by: 0, infA: false, infB: false },
    ],
    expected: { B: [0, 0, -(MU * 10) / (8 * 0.03)], text: 'B = μ₀I/(8R) = 52,4 µT, entrando al plano (−k̂)' },
  },
  espira60: {
    name: 'Ejercicio 4: espira de arcos y radios (60°)',
    note: 'I = 5 A, a = 20 cm, b = 40 cm. Los tramos radiales no aportan; los arcos aportan con signos opuestos.',
    I: 5, view: 0.5, a: 0.2, probe: { x: 0, y: 0, z: 0 },
    elements: [
      { type: 'arc', cx: 0, cy: 0, R: 0.4, p1: PI, p2: (2 * PI) / 3 },
      { type: 'seg', ax: 0.4 * Math.cos((2 * PI) / 3), ay: 0.4 * Math.sin((2 * PI) / 3), bx: 0.2 * Math.cos((2 * PI) / 3), by: 0.2 * Math.sin((2 * PI) / 3), infA: false, infB: false },
      { type: 'arc', cx: 0, cy: 0, R: 0.2, p1: (2 * PI) / 3, p2: PI },
      { type: 'seg', ax: -0.2, ay: 0, bx: -0.4, by: 0, infA: false, infB: false },
    ],
    expected: { B: [0, 0, ((MU * 5) / 12) * (1 / 0.2 - 1 / 0.4)], text: 'B = (μ₀I/12)(1/a − 1/b) = 1,31 µT, saliendo del plano (+k̂)' },
  },
  espira: {
    name: 'Espira circular completa',
    note: 'R = 5 cm, I = 5 A, antihoraria. En el centro B = μ₀I/(2R). Mueve P fuera del centro para ver la integral numérica.',
    I: 5, view: 0.1, a: 0.05, probe: { x: 0, y: 0, z: 0 },
    elements: [{ type: 'arc', cx: 0, cy: 0, R: 0.05, p1: 0, p2: 2 * PI }],
    expected: { B: [0, 0, (MU * 5) / (2 * 0.05)], text: 'B = μ₀I/(2R) = 62,8 µT, saliendo del plano (+k̂)' },
  },
  recto: {
    name: 'Tramo recto finito',
    note: 'Un solo tramo de 12 cm. Mueve P o los extremos y observa cómo cambian β₁ y β₂.',
    I: 8, view: 0.2, a: 0.02, probe: { x: 0.03, y: 0.05, z: 0 },
    elements: [{ type: 'seg', ax: -0.06, ay: -0.02, bx: 0.06, by: -0.02, infA: false, infB: false }],
  },
  libre: {
    name: 'Lienzo vacío (dibujar)',
    note: 'Dibuja tramos rectos y arcos con las herramientas de arriba y coloca P.',
    I: 5, view: 0.2, a: 0.05, probe: { x: 0, y: 0, z: 0 },
    elements: [],
  },
};

let uid = 0;
export const withIds = els => els.map(e => ({ ...e, id: ++uid }));
export const newId = () => ++uid;
