// Formato numérico con coma decimal (es-CR), para la interfaz y para KaTeX.

const clean = (v, d) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v);

export function nf(v, d = 2) {
  return clean(v, d)
    .toLocaleString('es-CR', { minimumFractionDigits: d, maximumFractionDigits: d })
    .replace('-', '−');
}

function splitSci(v, d) {
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = Number((v / 10 ** e).toFixed(d));
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  return [m, e];
}

/** Número para TeX: la coma va entre llaves para que KaTeX no agregue espacio. */
export function texNum(v, d = 2) {
  v = clean(v, d);
  const s = Math.abs(v).toFixed(d).replace('.', '{,}');
  return (v < 0 ? '-' : '') + s;
}

export function texSci(v, d = 2) {
  if (Math.abs(v) < 1e-14) return '0';
  const [m, e] = splitSci(v, d);
  return `${texNum(m, d)}\\times 10^{${e}}`;
}

export function sciText(v, d = 2) {
  if (Math.abs(v) < 1e-14) return '0';
  const [m, e] = splitSci(v, d);
  const sup = String(e).replace(/[-0-9]/g, c => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  return `${nf(m, d)} × 10${sup}`;
}

/** Etiqueta visible de un alambre: los numerados se muestran como I₁, I₂… (igual que en los enunciados). */
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const wlabel = n => (/^\d+$/.test(n) ? 'I' + [...n].map(d => SUB[+d]).join('') : n);

/** Vector en texto: (a î − b ĵ + c k̂), con los signos bien escritos. */
export function vecText(comps, units = ['î', 'ĵ', 'k̂']) {
  const out = [];
  comps.forEach((v, i) => {
    if (Math.abs(v) < 1e-14) return;
    const t = sciText(Math.abs(v));
    out.push(out.length ? `${v < 0 ? '− ' : '+ '}${t} ${units[i]}` : `${v < 0 ? '−' : ''}${t} ${units[i]}`);
  });
  return out.length ? `(${out.join(' ')})` : '0';
}
