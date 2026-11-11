import { AnimatePresence, motion } from 'framer-motion';
import Tex from '../shared/Tex.jsx';
import { texNum, texSci } from '../shared/format.js';
import { segCourse, segLHS, polyPieces } from './physics.js';
import { segExam } from './segExam.js';
import { frac, F, toFrac, S, aTex, diffTex, aSqTex, ratTex, surdTex } from './exact.js';

export const ICON = { seg: '╱', arc: '◜', poly: '〰' };
export const NAME = { seg: 'recto', arc: 'arco de circunferencia', poly: 'curva a mano' };
const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.2 } };
const D = r => (r * 180) / Math.PI;
const cmT = v => texNum(v * 100, 2);
const uT = v => texNum(v * 1e6, 2);
const vecCm = (a, d = 2) => `(${a.map(v => texNum(v * 100, d)).join(';\\ ')})`;
const vec = (a, d = 3) => `(${a.map(v => texNum(v, d)).join(';\\ ')})`;
const lim = v => (v === Infinity ? '+\\infty' : v === -Infinity ? '-\\infty' : `${cmT(v)}\\ \\text{cm}`);
const sgnCls = v => (v > 1e-12 ? 'k-out' : v < -1e-12 ? 'k-in' : 'k-zero');
const zero = v => Math.abs(v) < 1e-13;

/** Ángulo en radianes como fracción de π cuando es múltiplo de π/12; si no, decimal. */
export function radTex(v) {
  const n = Math.round(v / (Math.PI / 12));
  if (Math.abs(v - (n * Math.PI) / 12) > 1e-6) return texNum(v, 3);
  if (n === 0) return '0';
  const g = gcd(Math.abs(n), 12), p = n / g, q = 12 / g;
  const sign = p < 0 ? '-' : '', ap = Math.abs(p);
  const num = `${ap === 1 ? '' : ap}\\pi`;
  return q === 1 ? `${sign}${num}` : `${sign}\\tfrac{${num}}{${q}}`;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const angTex = r => `${texNum(D(r), 1)}^{\\circ}\\ (${radTex(r)}\\ \\text{rad})`;

/** Vector B en µT: si solo tiene componente z se escribe ±|B| k̂ con el color del sentido. */
function bTex(B) {
  if (zero(B[0]) && zero(B[1])) {
    if (zero(B[2])) return '\\mathbf{0}';
    return `\\htmlClass{${sgnCls(B[2])}}{${B[2] > 0 ? '+' : ''}${uT(B[2])}\\ \\mu\\text{T}\\ \\hat{\\mathbf{k}}}`;
  }
  return `(${uT(B[0])}\\,\\hat{\\mathbf{i}} ${B[1] < 0 ? '' : '+'} ${uT(B[1])}\\,\\hat{\\mathbf{j}} ${B[2] < 0 ? '' : '+'} \\htmlClass{${sgnCls(B[2])}}{${uT(B[2])}}\\,\\hat{\\mathbf{k}})\\ \\mu\\text{T}`;
}
const dirWord = B => (zero(B[0]) && zero(B[1]) ? (B[2] > 1e-13 ? 'sale del plano (+k̂, ⊙)' : B[2] < -1e-13 ? 'entra al plano (−k̂, ⊗)' : 'se anula') : 'tiene componentes en el plano y en z');

const T = String.raw;
const ux = { x: T`\hat{\mathbf{i}}`, y: T`\hat{\mathbf{j}}`, l: T`\hat{\mathbf{l}}` };

/** Número en metros para sustituir. */
const mT = v => texNum(v, 4);
const box = t => T`\boxed{\,${t}\,}`;

/**
 * Tramo recto como en el examen: coordenadas del plano, dl = dx î (dy ĵ, o dx(î + m ĵ) si está inclinado),
 * r en componentes, producto cruz con determinante, resultado de la integral, resultado simbólico en
 * términos de a (si las posiciones son fracciones simples de a) y al final la sustitución numérica.
 */
function segLines(n, e, p, P, I, aLen) {
  const L = [];
  if (p.singular) return { lines: L, note: `P está sobre el tramo ${n}: r → 0 y la integral diverge (modelo de alambre delgado). Mueve P.` };
  if (p.onLine) {
    L.push(T`\text{La recta del alambre pasa por P:}\ \ d\mathbf{l} \parallel \mathbf{r} \;\Rightarrow\; d\mathbf{l}\times\mathbf{r} = \mathbf{0} \;\Rightarrow\; \mathbf{B}_{${n}} = \mathbf{0}`);
    return { lines: L };
  }
  const X = segExam(e, P, aLen), w = X.w, dw = `d${w}`, ex = X.exact, z = P.z || 0, hasZ = Math.abs(z) > 1e-9;
  const sg = X.sigma > 0 ? '' : '-';
  const kindTxt = X.kind === 'v' ? 'vertical' : X.kind === 'h' ? 'horizontal' : 'inclinado';
  const sq = t => `${t}^{2}`;
  const limA = v => (v === Infinity ? T`\infty` : v === -Infinity ? T`-\infty` : null);
  const k = T`\hat{\mathbf{k}}`;
  let lines;
  if (ex) {
    // ------------------ exacto, en unidades de a ------------------
    const lim = v => limA(v) || aTex(toFrac(v / aLen));
    const lo = lim(X.wlo), hi = lim(X.whi);
    let desc, dlT, rT, rSym, Dtex, row1, row2, coT, caT = '';
    const curr = T`\text{la corriente va hacia } ${X.sigma > 0 ? '+' : '-'}${w}`;
    if (X.kind === 'v') {
      const dxp = F.sub(ex.xP, ex.ax);
      desc = T`\text{Alambre vertical en } x_0 = ${aTex(ex.ax)},\ \text{de } y = ${lo} \text{ a } y = ${hi};\ ${curr}`;
      dlT = T`${sg}dy\,\hat{\mathbf{j}}`;
      rSym = T`(x_P - x_0)\,\hat{\mathbf{i}} + (y_P - y)\,\hat{\mathbf{j}}`;
      rT = T`${aTex(dxp)}\,\hat{\mathbf{i}} + ${diffTex(ex.yP, 'y')}\,\hat{\mathbf{j}}`;
      Dtex = T`${aSqTex(dxp)} + ${sq(diffTex(ex.yP, 'y'))}`;
      row1 = T`0 & ${sg}dy & 0`; row2 = T`${aTex(dxp)} & ${diffTex(ex.yP, 'y')} & 0`;
      coT = T`|x_P - x_0| = ${aTex(F.mul(dxp, frac(Math.sign(dxp.n) || 1)))}`;
      caT = T`|y_P - y| = \left|${diffTex(ex.yP, 'y').replace(/^\\left\(|\\right\)$/g, '').replace(/^\(|\)$/g, '')}\right|`;
    } else if (X.kind === 'h') {
      const dyp = F.sub(ex.yP, ex.ay);
      desc = T`\text{Alambre horizontal en } y_0 = ${aTex(ex.ay)},\ \text{de } x = ${lo} \text{ a } x = ${hi};\ ${curr}`;
      dlT = T`${sg}dx\,\hat{\mathbf{i}}`;
      rSym = T`(x_P - x)\,\hat{\mathbf{i}} + (y_P - y_0)\,\hat{\mathbf{j}}`;
      rT = T`${diffTex(ex.xP, 'x')}\,\hat{\mathbf{i}} + ${aTex(dyp)}\,\hat{\mathbf{j}}`;
      Dtex = T`${sq(diffTex(ex.xP, 'x'))} + ${aSqTex(dyp)}`;
      row1 = T`${sg}dx & 0 & 0`; row2 = T`${diffTex(ex.xP, 'x')} & ${aTex(dyp)} & 0`;
      coT = T`|y_P - y_0| = ${aTex(F.mul(dyp, frac(Math.sign(dyp.n) || 1)))}`;
      caT = T`|x_P - x| = \left|${diffTex(ex.xP, 'x').replace(/^\\left\(|\\right\)$/g, '').replace(/^\(|\)$/g, '')}\right|`;
    } else {
      const alpha = F.sub(ex.yP, ex.b);
      const mT2 = ratTex(ex.m);
      const lin = T`\left(${aTex(alpha)} ${ex.m.n < 0 ? '+' : '-'} ${Math.abs(F.val(ex.m)) === 1 ? '' : ratTex(frac(Math.abs(ex.m.n), ex.m.d))}x\right)`;
      desc = T`\text{Alambre inclinado sobre } y = m x + b,\ m = ${mT2},\ b = ${aTex(ex.b)},\ \text{de } x = ${lo} \text{ a } x = ${hi};\ ${curr}`;
      dlT = T`${sg}dx\,(\hat{\mathbf{i}} + m\,\hat{\mathbf{j}}) = ${sg}dx\,(\hat{\mathbf{i}} ${ex.m.n < 0 ? '-' : '+'} ${Math.abs(F.val(ex.m)) === 1 ? '' : ratTex(frac(Math.abs(ex.m.n), ex.m.d))}\,\hat{\mathbf{j}})`;
      rSym = T`(x_P - x)\,\hat{\mathbf{i}} + (y_P - m x - b)\,\hat{\mathbf{j}}`;
      rT = T`${diffTex(ex.xP, 'x')}\,\hat{\mathbf{i}} + ${lin}\,\hat{\mathbf{j}}`;
      Dtex = T`${sq(diffTex(ex.xP, 'x'))} + ${sq(lin)}`;
      row1 = T`${sg}dx & ${sg}${mT2}\,dx & 0`; row2 = T`${diffTex(ex.xP, 'x')} & ${lin} & 0`;
      coT = T`\frac{|y_P - b - m\,x_P|}{\sqrt{1 + m^{2}}}`;
    }
    const fT = v => (S.isZero(v) ? '0' : surdTex(v, '', T`a^{2}`));
    let antiT;
    if (X.kind === 'i') {
      const twoA = F.mul(frac(2), ex.A), bb = ex.B;   // B en unidades de a; Δ en unidades de a²
      const num = T`2\left(${twoA.d === 1 && twoA.n === 1 ? '' : ratTex(twoA)}x ${bb.n < 0 ? '-' : '+'} ${aTex(frac(Math.abs(bb.n), bb.d))}\right)`;
      const Dr = ex.D;
      antiT = T`\frac{${num}}{${Dr.d === 1 && Dr.n === 1 ? '' : ratTex(Dr)}a^{2}\sqrt{${Dtex}}}`;
    } else {
      const wP = X.kind === 'v' ? ex.yP : ex.xP, perp = X.kind === 'v' ? F.sub(ex.xP, ex.ax) : F.sub(ex.yP, ex.ay);
      const numw = F.isZero(wP) ? w : T`${w} ${wP.n < 0 ? '+' : '-'} ${aTex(frac(Math.abs(wP.n), wP.d))}`;
      antiT = T`\frac{${numw}}{${aSqTex(perp)}\sqrt{${Dtex}}}`;
    }
    const symB = ex.T.size > 1 ? T`\frac{\mu_0 I}{\pi a}\left(${surdTex(ex.T)}\right)` : surdTex(ex.T, T`\mu_0 I`, T`\pi a`);
    const Tval = S.val(ex.T);
    lines = [
      desc,
      T`P = (x_P;\ y_P) = (${aTex(ex.xP)};\ ${aTex(ex.yP)}),\qquad a = ${cmT(aLen)}\ \text{cm (longitud de referencia)}`,
      T`d\mathbf{l} = ${dlT},\qquad \mathbf{r} = ${rSym} = ${rT}`,
      T`\hat{\mathbf{r}} = \frac{\mathbf{r}}{|\mathbf{r}|},\qquad \text{Triángulo desde } d\mathbf{l}:\ \ \text{cateto opuesto} = ${coT}${caT ? T`,\ \ \text{cateto adyacente} = ${caT}` : ''},\ \ \text{hipotenusa} = |\mathbf{r}| = \sqrt{${Dtex}}`,
      T`\sin\theta = \frac{\text{cateto opuesto}}{\text{hipotenusa}}\qquad (\theta = \text{ángulo entre } d\mathbf{l} \text{ y } \hat{\mathbf{r}};\ \sin(\pi - \theta) = \sin\theta)`,
      T`d\mathbf{l}\times\mathbf{r} = \begin{vmatrix}\hat{\mathbf{i}} & \hat{\mathbf{j}} & \hat{\mathbf{k}}\\ ${row1}\\ ${row2}\end{vmatrix} = ${aTex(ex.K)}\,${dw}\,${k}`,
      T`\mathbf{B}_{${n}} = \frac{\mu_0 I}{4\pi}\int\frac{d\mathbf{l}\times\hat{\mathbf{r}}}{|\mathbf{r}|^{2}} = \frac{\mu_0 I}{4\pi}\int_{${lo}}^{${hi}}\frac{d\mathbf{l}\times\mathbf{r}}{|\mathbf{r}|^{3}} = \frac{\mu_0 I\,(${aTex(ex.K)})}{4\pi}\int_{${lo}}^{${hi}}\frac{${dw}}{\left[${Dtex}\right]^{3/2}}\,${k}`,
      T`\int_{${lo}}^{${hi}}\frac{${dw}}{\left[${Dtex}\right]^{3/2}} = \left[${antiT}\right]_{${lo}}^{${hi}}`,
      T`= ${fT(ex.Fhi)} - \left(${fT(ex.Flo)}\right) = ${fT(ex.J)}`,
      T`\text{Resultado simbólico:}\quad ${box(T`\mathbf{B}_{${n}} = ${symB}\,${k}`)}`,
      T`\text{Sustitución:}\quad I = ${texNum(I, 1)}\ \text{A},\ \ a = ${mT(aLen)}\ \text{m}`,
      T`\mathbf{B}_{${n}} = \frac{(4\pi\times 10^{-7})(${texNum(I, 1)})}{\pi\,(${mT(aLen)})}\,(${texNum(Tval, 4)})\,${k}`,
      T`\text{Resultado numérico:}\quad ${box(T`\mathbf{B}_{${n}} = ${bTex(p.B)}`)}`,
    ];
  } else {
    // ------------------ con números (posiciones que no son fracciones simples de a, o P fuera del plano) ------------------
    const lim = v => limA(v) || T`${mT(v)}`;
    const lo = lim(X.wlo), hi = lim(X.whi);
    const zT = hasZ ? T` + ${mT(z)}\,\hat{\mathbf{k}}` : '';
    const dif = (c, v) => T`(${mT(c)} - ${v})`;
    let desc, dlT, rT, Dtex, row1, row2;
    const curr = T`\text{la corriente va hacia } ${X.sigma > 0 ? '+' : '-'}${w}`;
    if (X.kind === 'v') {
      desc = T`\text{Alambre vertical en } x_0 = ${mT(e.ax)}\ \text{m},\ \text{de } y = ${lo} \text{ a } y = ${hi}\ \text{m};\ ${curr}`;
      dlT = T`${sg}dy\,\hat{\mathbf{j}}`;
      rT = T`${mT(P.x - e.ax)}\,\hat{\mathbf{i}} + ${dif(P.y, 'y')}\,\hat{\mathbf{j}}${zT}`;
      Dtex = T`${mT((P.x - e.ax) ** 2 + z * z)} + ${sq(dif(P.y, 'y'))}`;
      row1 = T`0 & ${sg}dy & 0`; row2 = T`${mT(P.x - e.ax)} & ${dif(P.y, 'y')} & ${mT(z)}`;
    } else if (X.kind === 'h') {
      desc = T`\text{Alambre horizontal en } y_0 = ${mT(e.ay)}\ \text{m},\ \text{de } x = ${lo} \text{ a } x = ${hi}\ \text{m};\ ${curr}`;
      dlT = T`${sg}dx\,\hat{\mathbf{i}}`;
      rT = T`${dif(P.x, 'x')}\,\hat{\mathbf{i}} + ${mT(P.y - e.ay)}\,\hat{\mathbf{j}}${zT}`;
      Dtex = T`${sq(dif(P.x, 'x'))} + ${mT((P.y - e.ay) ** 2 + z * z)}`;
      row1 = T`${sg}dx & 0 & 0`; row2 = T`${dif(P.x, 'x')} & ${mT(P.y - e.ay)} & ${mT(z)}`;
    } else {
      const al = P.y - X.b;
      const lin = T`(${mT(al)} ${X.m < 0 ? '+' : '-'} ${texNum(Math.abs(X.m), 4)}\,x)`;
      desc = T`\text{Alambre inclinado sobre } y = m x + b,\ m = ${texNum(X.m, 4)},\ b = ${mT(X.b)}\ \text{m},\ \text{de } x = ${lo} \text{ a } x = ${hi}\ \text{m};\ ${curr}`;
      dlT = T`${sg}dx\,(\hat{\mathbf{i}} + ${texNum(X.m, 4)}\,\hat{\mathbf{j}})`;
      rT = T`${dif(P.x, 'x')}\,\hat{\mathbf{i}} + ${lin}\,\hat{\mathbf{j}}${zT}`;
      Dtex = T`${sq(dif(P.x, 'x'))} + ${sq(lin)}${hasZ ? T` + ${mT(z * z)}` : ''}`;
      row1 = T`${sg}dx & ${sg}${texNum(X.m, 4)}\,dx & 0`; row2 = T`${dif(P.x, 'x')} & ${lin} & ${mT(z)}`;
    }
    let antiN;
    if (X.kind === 'i') antiN = T`\frac{2\,(${texNum(2 * X.A, 4)}\,x ${X.B < 0 ? '-' : '+'} ${mT(Math.abs(X.B))})}{${texNum(X.Dl, 6)}\,\sqrt{${Dtex}}}`;
    else {
      const wP = -X.B / 2, c2 = X.C - wP * wP;
      antiN = T`\frac{${w} ${wP < 0 ? '+' : '-'} ${mT(Math.abs(wP))}}{${texNum(c2, 6)}\,\sqrt{${Dtex}}}`;
    }
    const Kt = hasZ ? T`\left(${X.K.map(v => mT(v)).join(';\\ ')}\right)` : T`${mT(X.K[2])}\,${k}`;
    lines = [
      desc,
      T`P = (x_P;\ y_P${hasZ ? ';\\ z_P' : ''}) = (${mT(P.x)};\ ${mT(P.y)}${hasZ ? T`;\ ${mT(z)}` : ''})\ \text{m}${aLen > 0 ? T`\qquad (\text{las posiciones no son fracciones simples de } a${hasZ ? T`\text{ o P está fuera del plano}` : ''}\text{: se usan números})` : ''}`,
      T`d\mathbf{l} = ${dlT},\qquad \mathbf{r} = ${rT}`,
      T`|\mathbf{r}| = \sqrt{${Dtex}},\qquad \hat{\mathbf{r}} = \frac{\mathbf{r}}{|\mathbf{r}|}`,
      T`d\mathbf{l}\times\mathbf{r} = \begin{vmatrix}\hat{\mathbf{i}} & \hat{\mathbf{j}} & \hat{\mathbf{k}}\\ ${row1}\\ ${row2}\end{vmatrix} = ${Kt}\,${dw}`,
      T`\mathbf{B}_{${n}} = \frac{\mu_0 I}{4\pi}\int_{${lo}}^{${hi}}\frac{d\mathbf{l}\times\mathbf{r}}{|\mathbf{r}|^{3}} = \frac{\mu_0 I}{4\pi}\,${hasZ ? Kt : T`(${mT(X.K[2])})`}\int_{${lo}}^{${hi}}\frac{${dw}}{\left[${Dtex}\right]^{3/2}}${hasZ ? '' : T`\,${k}`}`,
      T`\int_{${lo}}^{${hi}}\frac{${dw}}{\left[${Dtex}\right]^{3/2}} = \left[${antiN}\right]_{${lo}}^{${hi}}`,
      T`= (${texNum(X.Fhi, 2)}) - (${texNum(X.Flo, 2)}) = ${texNum(X.J, 2)}\ \text{m}^{-2}`,
      T`\text{Resultado:}\quad ${box(T`\mathbf{B}_{${n}} = \frac{\mu_0 I}{4\pi}\,${hasZ ? T`\left(${X.K.map(v => texNum(v * X.J, 3)).join(';\\ ')}\right)` : T`(${texNum(X.K[2] * X.J, 3)})\,${k}`}\ \text{m}^{-1}`)}`,
      T`\text{Sustitución:}\quad I = ${texNum(I, 1)}\ \text{A}\quad\Rightarrow\quad ${box(T`\mathbf{B}_{${n}} = ${bTex(p.B)}`)}`,
    ];
  }
  return { lines };
}

/** μ0 I Δφ / (4πR) simplificado cuando Δφ es múltiplo de π/12 (p. ej. π/2 → μ0 I / (8R)). */
function arcSimple(ad) {
  const k = Math.round(ad / (Math.PI / 12));
  if (Math.abs(ad - (k * Math.PI) / 12) > 1e-6) return T`\frac{${texNum(ad, 4)}\,\mu_0 I}{4\pi R}`;
  const g = gcd(k, 48), num = k / g, den = 48 / g;
  const top = num === 1 ? T`\mu_0 I` : T`${num}\,\mu_0 I`;
  return den === 1 ? T`\frac{${top}}{R}` : T`\frac{${top}}{${den}R}`;
}

function arcLines(n, e, p, P, I, aLen) {
  const ccw = e.p2 > e.p1, s = ccw ? '' : '-';
  const lo = Math.min(e.p1, e.p2), hi = Math.max(e.p1, e.p2), ad = hi - lo;
  const L = [
    T`\text{Arco de radio } R \text{ con centro } C,\ \text{de } \phi_a \text{ a } \phi_b\ (\phi_a < \phi_b),\ \text{corriente en sentido ${ccw ? 'antihorario' : 'horario'}}`,
    T`R:\ \text{radio del arco} = ${cmT(e.R)}\ \text{cm};\qquad \phi:\ \text{ángulo de } d\mathbf{l} \text{ medido desde } +x;\qquad \phi_a,\ \phi_b:\ \text{ángulos de los extremos} = ${texNum(D(lo), 1)}^{\circ},\ ${texNum(D(hi), 1)}^{\circ}`,
    T`d\mathbf{l} = ${s}R\,d\phi\,(-\sin\phi\,\hat{\mathbf{i}} + \cos\phi\,\hat{\mathbf{j}}),\qquad |d\mathbf{l}| = R\,d\phi`,
  ];
  if (p.singular) return { lines: L, note: `P está sobre el arco ${n}: r → 0 y la integral diverge. Mueve P.` };
  const degs = v => T`${texNum(D(v), 1)}^{\circ} = ${radTex(v)}\ \text{rad}`;
  const subst = [T`I = ${texNum(I, 1)}\ \text{A}`, T`R = ${mT(e.R)}\ \text{m}`, T`\phi_a = ${degs(lo)}`, T`\phi_b = ${degs(hi)}`];
  const dphi = T`\phi_b - \phi_a = ${texNum(D(ad), 1)}^{\circ}\cdot\frac{\pi}{180^{\circ}} = ${radTex(ad)}${radTex(ad).includes('pi') ? T` = ${texNum(ad, 4)}` : ''}\ \text{rad}`;
  const rhoA = aLen > 0 ? toFrac(e.R / aLen) : null;
  const dirNum = T`\htmlClass{${ccw ? 'k-out' : 'k-in'}}{${ccw ? '+' : '-'}\hat{\mathbf{k}}}\ \text{(${ccw ? 'sale' : 'entra'})}`;
  if (p.centered && Math.abs(P.z) < 1e-9) {
    L.push(
      T`\mathbf{r} = -R\cos\phi\,\hat{\mathbf{i}} - R\sin\phi\,\hat{\mathbf{j}}\ \ \text{(del alambre al centro P)},\qquad r = R,\qquad \hat{\mathbf{r}} = -\cos\phi\,\hat{\mathbf{i}} - \sin\phi\,\hat{\mathbf{j}}`,
      T`\theta = \text{ángulo entre } d\mathbf{l} \text{ y } \hat{\mathbf{r}} = 90^{\circ}\ \ (d\mathbf{l} \text{ es tangente y } \hat{\mathbf{r}} \text{ es radial}) \;\Rightarrow\; \sin\theta = 1,\qquad |d\mathbf{l}\times\hat{\mathbf{r}}| = R\,d\phi`,
      T`d\mathbf{l}\times\hat{\mathbf{r}} = ${s}R\,d\phi\begin{vmatrix}\hat{\mathbf{i}} & \hat{\mathbf{j}} & \hat{\mathbf{k}}\\ -\sin\phi & \cos\phi & 0\\ -\cos\phi & -\sin\phi & 0\end{vmatrix} = ${s}R\,d\phi\,(\sin^{2}\phi + \cos^{2}\phi)\,\hat{\mathbf{k}} = ${s}R\,d\phi\,\hat{\mathbf{k}}`,
      T`B_{${n}} = \frac{\mu_0 I}{4\pi}\int_{\phi_a}^{\phi_b}\frac{R\,d\phi}{R^{2}} = \frac{\mu_0 I}{4\pi R}\int_{\phi_a}^{\phi_b} d\phi\qquad (\phi \text{ en radianes})`,
      T`\int_{\phi_a}^{\phi_b} d\phi = \Big[\,\phi\,\Big]_{\phi_a}^{\phi_b} = \Big[\,\phi\,\Big]_{${radTex(lo)}}^{${radTex(hi)}}`,
      T`= ${radTex(hi)} - \left(${radTex(lo)}\right) = ${radTex(ad)}\qquad \Rightarrow\qquad B_{${n}} = \frac{\mu_0 I\,(${radTex(ad)})}{4\pi R}`,
      T`\text{Resultado simbólico:}\quad ${box(T`B_{${n}} = ${arcSimple(ad)}${rhoA && !(rhoA.n === 1 && rhoA.d === 1) ? T` = ${symTex({ T: S.rat(frac(0)), U: F.div(frac(Math.round(ad / (Math.PI / 12))), F.mul(frac(48), rhoA)) })}\ \ (R = ${aTex(rhoA)})` : ''},\qquad \hat{\mathbf{B}}_{${n}} = ${ccw ? '+' : '-'}\hat{\mathbf{k}}`)}`,
      T`\text{Sustitución:}\quad ${subst.join(',\\ \\ ')}`,
      T`${dphi},\qquad B_{${n}} = \frac{(4\pi\times 10^{-7})(${texNum(I, 1)})(${texNum(ad, 4)})}{4\pi\,(${mT(e.R)})}`,
      T`\text{Resultado numérico:}\quad ${box(T`B_{${n}} = ${texSci(Math.abs(p.B[2]))}\ \text{T},\qquad \hat{\mathbf{B}}_{${n}} = ${dirNum}`)}`,
    );
  } else if (p.centered) {
    L.push(
      T`\text{P sobre el eje del arco, a una altura } z_P:\ \ \mathbf{r} = -R\cos\phi\,\hat{\mathbf{i}} - R\sin\phi\,\hat{\mathbf{j}} + z_P\,\hat{\mathbf{k}},\quad r = \sqrt{R^{2}+z_P^{2}}`,
      T`\theta = 90^{\circ}\ (d\mathbf{l} \perp \hat{\mathbf{r}}) \;\Rightarrow\; |d\mathbf{l}\times\hat{\mathbf{r}}| = R\,d\phi;\qquad d\mathbf{l}\times\hat{\mathbf{r}} = \frac{${s}R\,d\phi}{r}\begin{vmatrix}\hat{\mathbf{i}} & \hat{\mathbf{j}} & \hat{\mathbf{k}}\\ -\sin\phi & \cos\phi & 0\\ -R\cos\phi & -R\sin\phi & z_P\end{vmatrix} = \frac{${s}R\,d\phi}{r}\,(z_P\cos\phi;\ z_P\sin\phi;\ R)`,
      T`\int_{\phi_1}^{\phi_2}(z_P\cos\phi;\ z_P\sin\phi;\ R)\,d\phi = \Big[(z_P\sin\phi;\ -z_P\cos\phi;\ R\,\phi)\Big]_{\phi_1}^{\phi_2},\qquad \phi_1 = ${radTex(e.p1)},\ \phi_2 = ${radTex(e.p2)}`,
      T`= \big(z_P(\sin\phi_2-\sin\phi_1);\ -z_P(\cos\phi_2-\cos\phi_1);\ R(\phi_2-\phi_1)\big) = ${vec([P.z * (Math.sin(e.p2) - Math.sin(e.p1)), -P.z * (Math.cos(e.p2) - Math.cos(e.p1)), e.R * (e.p2 - e.p1)], 4)}\ \text{m}`,
      T`\text{Resultado simbólico:}\quad ${box(T`\mathbf{B}_{${n}} = \frac{${s}\mu_0 I R}{4\pi\,(R^{2}+z_P^{2})^{3/2}}\big(z_P(\sin\phi_2-\sin\phi_1);\ -z_P(\cos\phi_2-\cos\phi_1);\ R\,(\phi_2 - \phi_1)\big)`)}\quad (\phi_1 \text{ y } \phi_2 \text{ en el sentido de la corriente})`,
      T`\text{Sustitución:}\quad ${[...subst, T`z_P = ${mT(P.z)}\ \text{m}`].join(',\\ \\ ')}`,
      T`\text{Resultado numérico:}\quad ${box(T`\mathbf{B}_{${n}} = ${bTex(p.B)}`)}`,
    );
  } else {
    L.push(
      T`\mathbf{r} = \mathbf{P} - (\text{punto del arco});\ \ \text{como P no está en el centro, } r \text{ y } \theta \text{ cambian con } \phi`,
      T`\mathbf{B}_{${n}} = \frac{\mu_0 I}{4\pi}\int_{\phi_a}^{\phi_b}\frac{d\mathbf{l}\times\hat{\mathbf{r}}}{r^{2}}\qquad \text{(sin forma cerrada simple)}`,
      T`\text{Sustitución:}\quad ${[...subst, T`\mathbf{P} = ${vec([P.x, P.y, P.z], 4)}\ \text{m}`].join(',\\ \\ ')}`,
      T`\text{Resultado numérico (Simpson, } N = ${p.N}\text{):}\quad ${box(T`\mathbf{B}_{${n}} = ${bTex(p.B)}`)}`,
    );
  }
  return { lines: L };
}

function polyLines(n, e, p, P) {
  const L = [
    T`\text{Curva dibujada a mano: } N = ${p.N}\ \text{tramos rectos } \mathbf{Q}_k \to \mathbf{Q}_{k+1},\quad \text{longitud} = ${cmT(p.L)}\ \text{cm}`,
    T`\text{inicio } \mathbf{Q}_1 = ${vecCm(e.pts[0])}\ \text{cm},\qquad \text{final } \mathbf{Q}_{${p.N + 1}} = ${vecCm(e.pts[e.pts.length - 1])}\ \text{cm}`,
  ];
  if (p.singular) return { lines: L, note: `P está sobre la curva ${n}: r → 0 y la integral diverge. Mueve P.` };
  const terms = p.pieces.map((q, k) => T`\htmlClass{${sgnCls(q.B[2])}}{(${uT(q.B[2])})_{${k + 1}}}`);
  const shown = terms.length > 6 ? [...terms.slice(0, 3), T`\cdots`, ...terms.slice(-2)] : terms;
  const flat = p.pieces.every(q => zero(q.B[0]) && zero(q.B[1]));
  L.push(
    T`\mathbf{B}_{${n}} = \frac{\mu_0 I}{4\pi}\int_{C}\frac{d\mathbf{l}\times\hat{\mathbf{r}}}{r^{2}} = \sum_{k=1}^{${p.N}}\frac{\mu_0 I}{4\pi}\int_{\text{pieza } k}\frac{\sin\theta\;dl}{r^{2}}\,(\text{dirección de } d\mathbf{l}\times\hat{\mathbf{r}})`,
    T`\text{En cada pieza: triángulo desde } d\mathbf{l}:\ \ \sin\theta = \frac{\text{cateto opuesto}}{\text{hipotenusa}},\qquad B_k = \frac{\mu_0 I}{4\pi}\int\frac{(\text{cateto opuesto})\,dl}{(\text{hipotenusa})^{3}}`,
  );
  const k0 = p.pieces.findIndex(q => !q.onLine);
  if (k0 >= 0) {
    const q0 = p.pieces[k0], pieces = polyPieces(e), c = segCourse(pieces[k0], q0, P);
    L.push(T`\text{Ejemplo, pieza } ${k0 + 1}:\ \text{cateto opuesto} = ${cmT(q0.d)}\ \text{cm}\ \Rightarrow\ B = ${texSci(q0.mag)}\ \text{T}`);
  }
  if (flat) L.push(T`B_{z,${n}} = ${shown.join(' + ')} = ${uT(p.B[2])}\ \mu\text{T}`);
  L.push(T`\mathbf{B}_{${n}} = ${bTex(p.B)}`);
  return { lines: L, note: 'Cada pieza es recta, así que su integral es exacta; la curva dibujada se aproxima con esas piezas.' };
}

/**
 * Aporte de cada tramo en forma simbólica (en el plano): B_z = μ0 I/(π a)·T + μ0 I/a·U.
 * T: suma de radicales (tramos rectos); U: racional (arcos con P en el centro). null si no hay forma exacta.
 */
function exactOf(e, p, P, aLen) {
  if (Math.abs(P.z || 0) > 1e-9 || p.singular) return null;
  if (e.type === 'seg') {
    if (p.onLine) return { T: S.rat(frac(0)), U: frac(0) };
    const X = segExam(e, P, aLen);
    return X.exact ? { T: X.exact.T, U: frac(0) } : null;
  }
  if (e.type === 'arc' && p.centered) {
    const rho = toFrac(e.R / aLen), k = Math.round((e.p2 - e.p1) / (Math.PI / 12));
    if (!rho || Math.abs(e.p2 - e.p1 - (k * Math.PI) / 12) > 1e-6) return null;
    return { T: S.rat(frac(0)), U: F.div(frac(k), F.mul(frac(48), rho)) };   // μ0 I k/(48 ρ a)
  }
  return null;
}
/** TeX de μ0 I/(π a)·T + μ0 I/a·U. */
function symTex(x) {
  const parts = [];
  if (!S.isZero(x.T)) parts.push(x.T.size > 1 ? T`\frac{\mu_0 I}{\pi a}\left(${surdTex(x.T)}\right)` : surdTex(x.T, T`\mu_0 I`, T`\pi a`));
  if (!F.isZero(x.U)) {
    const u = x.U, num = Math.abs(u.n) === 1 ? T`\mu_0 I` : T`${Math.abs(u.n)}\,\mu_0 I`;
    const t = T`\frac{${num}}{${u.d === 1 ? '' : u.d}a}`;
    parts.push(`${u.n < 0 ? '-' : parts.length ? '+' : ''}${t}`);
  }
  if (!parts.length) return '0';
  return parts.map((t, i) => (i > 0 && !t.startsWith('-') && !t.startsWith('+') ? `+${t}` : t)).join(' ');
}

export default function BiotEquations({ elements, probe, I, parts, B, focus, onFocus, aLen, sumMode = 'sum', onSumMode }) {
  const idx = Math.max(0, elements.findIndex(e => e.id === focus));
  const e = elements[idx], p = parts[idx], n = idx + 1;
  const block = e ? (e.type === 'seg' ? segLines(n, e, p, probe, I, aLen) : e.type === 'poly' ? polyLines(n, e, p, probe) : arcLines(n, e, p, probe, I, aLen)) : null;
  const flat = parts.every(q => zero(q.B[0]) && zero(q.B[1]));
  const term = (v, i) => `\\htmlClass{${sgnCls(v)}}{(${uT(v)})_{${i + 1}}}`;
  const sums = flat
    ? [`B_{z} = \\sum_i B_{z,i} = ${parts.map((q, i) => term(q.B[2], i)).join(' + ') || '0'} = \\htmlClass{${sgnCls(B[2])}}{${uT(B[2])}}\\ \\mu\\text{T}`]
    : ['x', 'y', 'z'].map((c, k) => `B_{${c}} = ${parts.map((q, i) => term(q.B[k], i)).join(' + ') || '0'} = ${uT(B[k])}\\ \\mu\\text{T}`);
  const mag = Math.hypot(...B);
  // superposición simbólica en términos de a
  const ex = elements.map((el, i) => exactOf(el, parts[i], probe, aLen));
  const aSrc = elements.findIndex(el => el.type === 'arc' || (el.type === 'seg' && !el.infA && !el.infB));
  const allExact = flat && ex.length > 0 && ex.every(Boolean);
  const indLine = (i) => ex[i] ? T`\mathbf{B}_{${i + 1}} = ${symTex(ex[i]) === '0' ? T`\mathbf{0}` : T`${symTex(ex[i])}\,\hat{\mathbf{k}}`}` : T`\mathbf{B}_{${i + 1}} = ${bTex(parts[i].B)}`;
  const symSum = [];
  if (elements.length) {
    symSum.push(T`a = ${cmT(aLen)}\ \text{cm (${aSrc >= 0 ? `${elements[aSrc].type === 'arc' ? 'radio' : 'largo'} del tramo ${aSrc + 1}` : 'longitud de referencia'})}`);
    if (sumMode === 'ind') elements.forEach((_, i) => symSum.push(indLine(i)));
    else if (allExact) {
      const tot = ex.reduce((t, x) => ({ T: S.add(t.T, x.T), U: F.add(t.U, x.U) }), { T: S.rat(frac(0)), U: frac(0) });
      const termsT = ex.map((x, i) => { const t = symTex(x); return t === '0' ? null : `\\left(${t}\\right)`; }).filter(Boolean);
      symSum.push(T`\mathbf{B}_P = \sum_i \mathbf{B}_i = \left[${termsT.join(' + ') || '0'}\right]\hat{\mathbf{k}}`);
      symSum.push(T`\text{Resultado simbólico:}\quad ${box(T`\mathbf{B}_P = ${symTex(tot) === '0' ? T`\mathbf{0}` : T`${symTex(tot)}\,\hat{\mathbf{k}}`}`)}`);
    } else {
      symSum.push(T`\mathbf{B}_P = \sum_i \mathbf{B}_i = ${elements.map((_, i) => T`\mathbf{B}_{${i + 1}}`).join(' + ')}\qquad \text{(no todos los tramos tienen forma simbólica en } a\text{: se suman con números)}`);
    }
  }
  const singular = parts.some(q => q.singular);

  return (
    <section className="sheet equations" aria-labelledby="bsEqTitle">
      <div className="sheet-head">
        <h2 id="bsEqTitle">Biot–Savart en P</h2>
        <span className="pill">P = ({texPlain(probe.x)}; {texPlain(probe.y)}; {texPlain(probe.z)}) cm</span>
      </div>
      <div className="eq-step">
        <span className="step-label">Ley de Biot–Savart</span>
        <Tex block tex={`d\\mathbf{B} = \\frac{\\mu_0 I}{4\\pi}\\,\\frac{d\\mathbf{l}\\times\\hat{\\mathbf{r}}}{r^{2}} = \\frac{\\mu_0 I}{4\\pi}\\,\\frac{d\\mathbf{l}\\times\\mathbf{r}}{r^{3}},\\qquad \\mathbf{B}_P = \\sum_i \\int_{\\text{tramo } i} d\\mathbf{B}`} />
        <p className="hint">r va desde el elemento dl del alambre hasta P; dl apunta en el sentido de la corriente.</p>
      </div>
      <div className="eq-step">
        <div className="step-head">
          <span className="step-label">1 · Integral de cada tramo</span>
          <div className="mini-seg" role="group" aria-label="Tramo a desarrollar">
            {elements.map((el, i) => (
              <button key={el.id} type="button" aria-pressed={i === idx} onClick={() => onFocus(el.id)} className={sgnCls(parts[i].B[2])}>
                {i + 1} {ICON[el.type]}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div key={`b-${e.id}-${e.type}`} {...fade} className="eq-lines">
              <p className="hint">{`Tramo ${n}: ${NAME[e.type]}`}</p>
              {block.lines.map((t, i) => <Tex key={i} block tex={t} />)}
              {block.note && <p className="hint">{block.note}</p>}
            </motion.div>
          ) : (
            <motion.p key="none" {...fade} className="hint">Dibuja un tramo recto o un arco para ver su integral.</motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="eq-step">
        <div className="step-head">
          <span className="step-label">2 · Superposición de los {parts.length} tramos</span>
          <div className="mini-seg" role="group" aria-label="Forma de ver la superposición">
            <button type="button" aria-pressed={sumMode === 'ind'} onClick={() => onSumMode && onSumMode('ind')}>Individuales</button>
            <button type="button" aria-pressed={sumMode === 'sum'} onClick={() => onSumMode && onSumMode('sum')}>Sumados</button>
          </div>
        </div>
        <div className="eq-lines">
          {symSum.map((t, i) => <Tex key={'s' + i} block tex={t} />)}
          {sums.map((t, i) => <Tex key={i} block tex={t} />)}
          {!flat && <Tex block tex={`|\\mathbf{B}| = \\sqrt{B_x^{2}+B_y^{2}+B_z^{2}} = ${uT(mag)}\\ \\mu\\text{T}`} />}
        </div>
      </div>
      <div className="eq-step result">
        <span className="step-label">Resultado</span>
        {singular
          ? <p className="hint">P está sobre un alambre: el campo no está definido ahí.</p>
          : <>
              <Tex block tex={`\\mathbf{B}_P = ${flat ? (zero(B[2]) ? '\\mathbf{0}' : `${texSci(B[2])}\\ \\text{T}\\ \\hat{\\mathbf{k}}`) : `(${texSci(B[0])}\\,\\hat{\\mathbf{i}} + (${texSci(B[1])})\\,\\hat{\\mathbf{j}} + (${texSci(B[2])})\\,\\hat{\\mathbf{k}})\\ \\text{T}`}`} />
              <p className="hint">|B| = {(mag * 1e6).toLocaleString('es-CR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} µT; {dirWord(B)}.</p>
            </>}
      </div>
    </section>
  );
}

function texPlain(v) { return (Math.round(v * 1000) / 10).toLocaleString('es-CR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('-', '−'); }
