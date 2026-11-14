// Escenarios de ejemplo del simulador (no son enunciados de tareas ni exámenes).
// Unidades de la interfaz: N (vueltas), r, L, a, b en cm, B en T, β en T/s, f en Hz, v en cm/s, ω en rad/s, Rc en Ω.
export const BASE = {
  shape: 'lineal', N: 50, r: 10, B0: 0.8, beta: -0.2, Bm: 0.5, f: 0.5,
  Bu: 0.5, dirB: 1, L: 30, v: 15, a: 10, b: 10, w: 6, Rc: 5,
};

export const I_PRESETS = {
  decrece: {
    name: 'Espira con B que decrece linealmente', mode: 'field',
    note: 'Ejemplo del simulador. Φ disminuye, así que la corriente inducida crea un campo que refuerza al original (antihoraria si B sale).',
    p: { shape: 'lineal', N: 50, r: 10, B0: 0.8, beta: -0.2, Rc: 5 },
  },
  seno: {
    name: 'Espira con B senoidal', mode: 'field',
    note: 'Ejemplo del simulador. Con B(t) = B_m sen(2πft), ε(t) va desfasada 90° respecto de Φ(t) (es proporcional a −cos).',
    p: { shape: 'seno', N: 50, r: 10, Bm: 0.5, f: 0.5, Rc: 5 },
  },
  barra: {
    name: 'Barra deslizante sobre rieles', mode: 'bar',
    note: 'Ejemplo del simulador. Fem de movimiento ε = B L v: la barra al moverse aumenta el área y por tanto el flujo.',
    p: { Bu: 0.6, dirB: 1, L: 30, v: 15, Rc: 3 },
  },
  generador: {
    name: 'Espira giratoria (generador de CA)', mode: 'rot',
    note: 'Ejemplo del simulador. Φ = N B A cos ωt y ε = N B A ω sen ωt: una fem alterna que se anula cuando el flujo es máximo.',
    p: { N: 100, Bu: 0.4, a: 10, b: 10, w: 6, Rc: 20 },
  },
};

export const MODE_DEFAULT = { field: 'decrece', bar: 'barra', rot: 'generador' };
export const fullP = key => ({ ...BASE, ...I_PRESETS[key].p });
