// Campo magnético de alambres rectos, infinitos y paralelos al eje z (unidades SI).
// s = +1: la corriente sale de la página (+z) · s = −1: entra (−z).
// Por la ley de Ampère con un círculo de radio r centrado en el alambre:
//   B (2πr) = μ0 I   →   B = μ0 I / (2πr),   dirección  s · (ẑ × r̂).

export const MU0 = 4 * Math.PI * 1e-7;
export const ON_WIRE = 0.002; // a menos de 2 mm del eje el modelo de alambre delgado no aplica

/** Aporte de un alambre en el punto (x, y), con todos los pasos intermedios. */
export function contrib(w, x, y) {
  const dx = x - w.x, dy = y - w.y, r = Math.hypot(dx, dy);
  if (r < ON_WIRE) return { dx, dy, r, onWire: true, mag: 0, ux: 0, uy: 0, bxh: 0, byh: 0, bx: 0, by: 0 };
  const mag = (MU0 * w.I) / (2 * Math.PI * r);
  const ux = dx / r, uy = dy / r;          // r̂: del alambre hacia el punto
  const bxh = w.s * -uy, byh = w.s * ux;   // ±ẑ × r̂ = ±(−r̂y, r̂x)
  return { dx, dy, r, onWire: false, mag, ux, uy, bxh, byh, bx: mag * bxh, by: mag * byh };
}

/** Superposición: B = Σ Bi. */
export function fieldAt(wires, x, y) {
  let bx = 0, by = 0;
  for (const w of wires) {
    const dx = x - w.x, dy = y - w.y, r2 = dx * dx + dy * dy;
    if (r2 < ON_WIRE * ON_WIRE) continue;
    const k = (MU0 * w.I * w.s) / (2 * Math.PI * r2);
    bx += -dy * k;
    by += dx * k;
  }
  return { bx, by };
}
