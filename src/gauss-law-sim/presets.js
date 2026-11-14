// Escenarios de ejemplo del simulador (no son enunciados de tareas ni exámenes).
// Q en nC, R y r en cm.
export const G_PRESETS = {
  dentro: {
    name: 'Esfera uniforme · superficie dentro (r < R)',
    note: 'Ejemplo del simulador. Con r < R la superficie gaussiana solo encierra una parte de la carga: q_enc = Q (r/R)³.',
    Q: 8, R: 10, r: 5, dist: 'uniform',
  },
  fuera: {
    name: 'Esfera uniforme · superficie fuera (r > R)',
    note: 'Ejemplo del simulador. Con r > R se encierra toda la carga y el campo es el de una carga puntual Q en el centro.',
    Q: 8, R: 10, r: 18, dist: 'uniform',
  },
  negativa: {
    name: 'Esfera uniforme con carga negativa',
    note: 'Ejemplo del simulador. Con Q < 0 el campo apunta hacia el centro: la componente radial E_r es negativa.',
    Q: -6, R: 8, r: 5, dist: 'uniform',
  },
  creciente: {
    name: 'Densidad creciente ρ = ρ₀ r/R',
    note: 'Ejemplo del simulador. La carga se concentra hacia la superficie: q_enc = Q (r/R)⁴ y E crece como r² dentro de la esfera.',
    Q: 8, R: 10, r: 7, dist: 'linear',
  },
};
