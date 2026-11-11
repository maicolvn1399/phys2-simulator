import { AnimatePresence, motion } from 'framer-motion';
import Tex from '../../shared/Tex.jsx';
import { texNum, texSci, nf, wlabel } from '../../shared/format.js';

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.2 } };
const cls = w => (w.s > 0 ? 'k-out' : 'k-in');
const tup = (a, b, d = 3) => `(${texNum(a, d)};\\ ${texNum(b, d)})`;
const uT = v => texNum(v * 1e6, 2);

/** Ecuaciones que se recalculan con cada cambio: Ampère para el alambre elegido y la superposición en P. */
export default function EquationPanel({ wires, probe, parts, total, focus, onFocus }) {
  const w = wires[focus], c = parts[focus];
  const n = w ? w.name : '';

  let ampere = null;
  if (w && !c.onWire) {
    ampere = [
      `\\oint \\mathbf{B}\\cdot d\\mathbf{l} = B_{${n}}\\,(2\\pi r_{${n}}) = \\mu_0 I_{${n}} \\;\\Longrightarrow\\; B_{${n}} = \\frac{\\mu_0 I_{${n}}}{2\\pi r_{${n}}}`,
      `r_{${n}} = \\sqrt{(x_P - x_{${n}})^2 + (y_P - y_{${n}})^2} = \\sqrt{(${texNum(c.dx * 100, 1)})^2 + (${texNum(c.dy * 100, 1)})^2}\\ \\text{cm} = ${texNum(c.r * 100, 2)}\\ \\text{cm}`,
      `B_{${n}} = \\frac{(4\\pi\\times 10^{-7}\\ \\text{T}\\cdot\\text{m/A})(\\htmlClass{${cls(w)}}{${texNum(w.I, 1)}\\ \\text{A}})}{2\\pi\\,(${texNum(c.r, 4)}\\ \\text{m})} = ${texSci(c.mag)}\\ \\text{T}`,
      `\\hat{\\mathbf{r}}_{${n}} = ${tup(c.ux, c.uy)} \\;\\Longrightarrow\\; \\hat{\\mathbf{B}}_{${n}} = ${w.s > 0 ? '+' : '-'}\\,\\hat{\\mathbf{z}}\\times\\hat{\\mathbf{r}}_{${n}} = ${tup(c.bxh, c.byh)}`,
      `\\mathbf{B}_{${n}} = B_{${n}}\\,\\hat{\\mathbf{B}}_{${n}} = (${uT(c.bx)}\\,\\hat{\\mathbf{i}} + (${uT(c.by)})\\,\\hat{\\mathbf{j}})\\ \\mu\\text{T}`,
    ];
  }

  const valid = parts.filter(p => !p.onWire);
  const termsX = wires.map((wi, i) => (parts[i].onWire ? null : `\\htmlClass{${cls(wi)}}{(${uT(parts[i].bx)})}`)).filter(Boolean);
  const termsY = wires.map((wi, i) => (parts[i].onWire ? null : `\\htmlClass{${cls(wi)}}{(${uT(parts[i].by)})}`)).filter(Boolean);
  const mag = Math.hypot(total.bx, total.by);
  const theta = ((Math.atan2(total.by, total.bx) * 180) / Math.PI + 360) % 360;
  const sumTex = [
    `B_x = \\sum_i B_{x,i} = ${termsX.join(' + ') || '0'} = ${uT(total.bx)}\\ \\mu\\text{T}`,
    `B_y = \\sum_i B_{y,i} = ${termsY.join(' + ') || '0'} = ${uT(total.by)}\\ \\mu\\text{T}`,
    `|\\mathbf{B}| = \\sqrt{B_x^2 + B_y^2} = \\sqrt{(${uT(total.bx)})^2 + (${uT(total.by)})^2} = ${uT(mag)}\\ \\mu\\text{T}`,
    mag > 1e-11 ? `\\theta = \\operatorname{atan2}(B_y,\\, B_x) = ${texNum(theta, 1)}^{\\circ}\\ \\text{desde } +x` : `\\mathbf{B} = 0:\\ \\text{los aportes se cancelan en } P`,
  ];
  const result = `\\mathbf{B}_P = (${texSci(total.bx)}\\,\\hat{\\mathbf{i}} + (${texSci(total.by)})\\,\\hat{\\mathbf{j}})\\ \\text{T}`;

  return (
    <section className="sheet equations" aria-labelledby="eqTitle">
      <div className="sheet-head">
        <h2 id="eqTitle">Cálculo en P</h2>
        <span className="pill">P = ({nf(probe.x * 100, 1)}; {nf(probe.y * 100, 1)}) cm</span>
      </div>

      <div className="eq-step">
        <div className="step-head">
          <span className="step-label">1 · Ley de Ampère para un alambre (círculo de radio r centrado en el alambre)</span>
          <div className="mini-seg" role="group" aria-label="Alambre a desarrollar">
            {wires.map((wi, i) => (
              <button key={wi.name} type="button" aria-pressed={i === focus} onClick={() => onFocus(i)} className={cls(wi)}>{wlabel(wi.name)}</button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {ampere ? (
            <motion.div key={`a-${n}`} {...fade} className="eq-lines">
              {ampere.map((t, i) => <Tex key={i} block tex={t} />)}
            </motion.div>
          ) : (
            <motion.p key="none" {...fade} className="hint">
              {w ? `P está sobre el alambre ${wlabel(n)}: ahí el modelo de alambre delgado no aplica. Mueve P.` : 'Agrega un alambre para ver el cálculo.'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="eq-step">
        <span className="step-label">2 · Superposición: se suman las componentes de los {valid.length} aportes</span>
        <div className="eq-lines">{sumTex.map((t, i) => <Tex key={i} block tex={t} />)}</div>
      </div>

      <div className="eq-step result">
        <span className="step-label">Resultado</span>
        <Tex block tex={result} />
      </div>
    </section>
  );
}
