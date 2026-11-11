// Circuitos de ejemplo en la cuadrícula (coordenadas enteras, y hacia abajo).
// W = cable, R = resistencia (Ω), E = fuente ε (V); en la fuente, a es el terminal − y b el +.
const W = (a, b) => ({ type: 'W', a, b });
const R = (a, b, value) => ({ type: 'R', a, b, value });
const E = (a, b, value) => ({ type: 'E', a, b, value });

export const C_PRESETS = {
  serie: {
    name: 'Serie: dos resistencias',
    note: 'ε = 12 V, R₁ = 4 Ω y R₂ = 8 Ω en serie: R_eq = R₁ + R₂.',
    comps: [E([2, 6], [2, 2], 12), W([2, 2], [4, 2]), R([4, 2], [7, 2], 4), W([7, 2], [9, 2]), R([9, 2], [9, 6], 8), W([9, 6], [2, 6])],
  },
  mixto: {
    name: 'Serie y paralelo',
    note: 'ε = 12 V; R₁ = 2 Ω en serie con R₂ = 6 Ω ∥ R₃ = 3 Ω.',
    comps: [E([2, 6], [2, 2], 12), W([2, 2], [3, 2]), R([3, 2], [6, 2], 2), W([6, 2], [10, 2]), R([7, 2], [7, 6], 6), R([10, 2], [10, 6], 3), W([10, 6], [2, 6])],
  },
  escalera: {
    name: 'Dos mallas (escalera)',
    note: 'ε = 10 V; R₁ = 2 Ω, luego R₂ = 6 Ω en paralelo con la rama R₃ = 1 Ω + R₄ = 2 Ω.',
    comps: [E([2, 6], [2, 2], 10), W([2, 2], [3, 2]), R([3, 2], [5, 2], 2), W([5, 2], [6, 2]), R([6, 2], [6, 6], 6), W([6, 2], [7, 2]), R([7, 2], [10, 2], 1), W([10, 2], [11, 2]), R([11, 2], [11, 6], 2), W([11, 6], [2, 6])],
  },
  cuadrado: {
    name: 'Rombo de resistencias inclinadas (como en el examen)',
    note: 'ε = 12 V, 5 Ω en serie, el rombo (20 Ω + 10 Ω) ∥ (10 Ω + 20 Ω) y 12 Ω.',
    comps: [
      E([1, 7], [1, 3], 12), W([1, 3], [2, 3]), R([2, 3], [4, 3], 5), W([4, 3], [5, 3]),
      R([5, 3], [7, 1], 20), R([7, 1], [9, 3], 10), R([5, 3], [7, 5], 10), R([7, 5], [9, 3], 20),
      W([9, 3], [12, 3]), R([12, 3], [12, 7], 12), W([12, 7], [1, 7]),
    ],
  },
  diagonal: {
    name: 'Resistencia en diagonal (ejercicio 3)',
    note: 'ε = 220 V; R₁ = 14 Ω en serie con R₂ = 40 Ω ∥ R₃ = 60 Ω ∥ R₄ = 12 Ω. R_eq = 22 Ω, I = 10 A.',
    comps: [
      E([2, 6], [2, 2], 220), W([2, 2], [3, 2]), R([3, 2], [5, 2], 14), W([5, 2], [10, 2]),
      R([6, 2], [6, 6], 40), R([6, 6], [10, 2], 60), R([10, 2], [10, 6], 12), W([10, 6], [2, 6]),
    ],
  },
  cruzado: {
    name: 'Diagonales cruzadas (dibujo no plano)',
    note: 'ε = 12 V; los dos cables inclinados se cruzan sin tocarse (no hay punto de conexión en el cruce). Kirchhoff usa lazos independientes.',
    comps: [
      E([2, 6], [2, 2], 12), W([2, 2], [5, 2]), W([2, 6], [5, 6]), R([5, 2], [5, 6], 6),
      W([5, 2], [8, 6]), W([5, 6], [8, 2]), R([8, 6], [11, 6], 4), R([11, 6], [11, 2], 3), R([11, 2], [8, 2], 12),
    ],
  },
  puente: {
    name: 'Puente (no se reduce en serie/paralelo)',
    note: 'ε = 10 V; R₁ = 10, R₂ = 20, R₃ = 20, R₄ = 10 y el puente R₅ = 5 Ω. Se resuelve con Kirchhoff.',
    comps: [
      E([1, 7], [1, 3], 10), W([1, 3], [3, 3]), W([3, 1], [3, 5]), W([9, 1], [9, 7]), W([1, 7], [9, 7]),
      R([3, 1], [6, 1], 10), R([6, 1], [9, 1], 20), R([3, 5], [6, 5], 20), R([6, 5], [9, 5], 10), R([6, 1], [6, 5], 5),
    ],
  },
  libre: { name: 'Lienzo vacío (dibujar)', note: 'Dibuja cables, resistencias y una fuente ε con las herramientas.', comps: [] },
};

let uid = 0;
export const newCid = () => ++uid;
/** Asigna id y nombres R₁, R₂… en el orden en que aparecen. */
export function withNames(comps) {
  let k = 0;
  return comps.map(c => ({ ...c, id: ++uid, name: c.type === 'R' ? `R_${++k}` : c.type === 'E' ? 'ε' : '' }));
}
export function renameAll(comps) {
  let k = 0;
  return comps.map(c => (c.type === 'R' ? { ...c, name: `R_${++k}` } : c));
}
