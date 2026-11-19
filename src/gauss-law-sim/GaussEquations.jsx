import Tex from '../shared/Tex.jsx';
import { texNum, texSci, nf } from '../shared/format.js';
import { EPS0, K, qEnc, Er, rho, region } from './physics.js';

const EPS_TEX = texSci(EPS0, 2);

/** Ecuaciones de la ley de Gauss con los valores actuales: simetría → Gauss → q_enc → E → resultado. */
export default function GaussEquations({ Q, R, r, dist }) {
  const Qc = Q * 1e-9, Rm = R / 100, rm = r / 100;
  const reg = region(r, R);
  const q = qEnc(Qc, Rm, rm, dist), E = Er(Qc, Rm, rm, dist), Phi = q / EPS0;
  const ER = Er(Qc, Rm, Rm, dist);
  const lin = dist === 'linear';
  const qn = texNum(q * 1e9, 3);
  const ratio = `\\left(\\dfrac{${texNum(r, 1)}\\ \\text{cm}}{${texNum(R, 1)}\\ \\text{cm}}\\right)`;
  const inside = reg === 'in';

  // 3 · carga encerrada
  let qLines;
  if (inside) {
    qLines = lin ? [
      `\\rho(r') = \\rho_0\\,\\dfrac{r'}{R}, \\qquad Q = \\int_0^R \\rho_0\\,\\dfrac{r'}{R}\\,(4\\pi r'^2)\\,dr' = \\pi\\rho_0 R^3 \\;\\Longrightarrow\\; \\rho_0 = \\dfrac{Q}{\\pi R^3} = ${texSci(rho(Qc, Rm, Rm, dist))}\\ \\text{C/m}^3`,
      `q_{enc} = \\int_0^r \\rho_0\\,\\dfrac{r'}{R}\\,(4\\pi r'^2)\\,dr' = \\dfrac{\\pi\\rho_0\\, r^4}{R} = Q\\left(\\dfrac{r}{R}\\right)^4`,
      `q_{enc} = (${texNum(Q, 2)}\\ \\text{nC})${ratio}^4 = ${qn}\\ \\text{nC}`,
    ] : [
      `\\rho = \\dfrac{Q}{\\tfrac{4}{3}\\pi R^3} = \\dfrac{3Q}{4\\pi R^3} = ${texSci(rho(Qc, Rm, 0, dist))}\\ \\text{C/m}^3`,
      `q_{enc} = \\rho\\,\\tfrac{4}{3}\\pi r^3 = Q\\left(\\dfrac{r}{R}\\right)^3`,
      `q_{enc} = (${texNum(Q, 2)}\\ \\text{nC})${ratio}^3 = ${qn}\\ \\text{nC}`,
    ];
  } else {
    qLines = [
      `r \\ge R \\;\\Longrightarrow\\; \\text{la superficie gaussiana encierra toda la esfera (y no hay carga fuera de ella)}`,
      `q_{enc} = Q = ${qn}\\ \\text{nC}`,
    ];
  }

  // 4 · campo
  const closed = inside
    ? (lin ? `E_r = \\dfrac{q_{enc}}{4\\pi\\varepsilon_0 r^2} = \\dfrac{Q\\,r^2}{4\\pi\\varepsilon_0 R^4} = \\dfrac{kQ\\,r^2}{R^4}` : `E_r = \\dfrac{q_{enc}}{4\\pi\\varepsilon_0 r^2} = \\dfrac{Q\\,r}{4\\pi\\varepsilon_0 R^3} = \\dfrac{kQ\\,r}{R^3}`)
    : `E_r = \\dfrac{q_{enc}}{4\\pi\\varepsilon_0 r^2} = \\dfrac{Q}{4\\pi\\varepsilon_0 r^2} = \\dfrac{kQ}{r^2}`;
  const numeric = `E_r = \\dfrac{${qn}\\times 10^{-9}\\ \\text{C}}{4\\pi\\,(${EPS_TEX}\\ \\text{C}^2/\\text{N}\\!\\cdot\\!\\text{m}^2)\\,(${texNum(rm, 4)}\\ \\text{m})^2} = ${texSci(E)}\\ \\text{N/C}`;

  const dirText = E === 0 ? 'E = 0' : E > 0 ? 'hacia afuera (+r̂)' : 'hacia adentro (−r̂)';

  return (
    <section className="sheet equations" aria-labelledby="gEqTitle">
      <div className="sheet-head">
        <h2 id="gEqTitle">Ley de Gauss paso a paso</h2>
        <span className="pill">r = {nf(r, 1)} cm · {reg === 'in' ? 'dentro (r < R)' : reg === 'out' ? 'fuera (r > R)' : 'sobre la superficie (r = R)'}</span>
      </div>

      <div className="eq-step">
        <span className="step-label">1 · Simetría esférica: se elige una superficie gaussiana esférica de radio r</span>
        <div className="eq-lines">
          <Tex block tex={`\\mathbf{E} = E_r(r)\\,\\hat{\\mathbf{r}}, \\quad d\\mathbf{A} = dA\\,\\hat{\\mathbf{r}} \\;\\Longrightarrow\\; \\mathbf{E}\\cdot d\\mathbf{A} = E_r\\,dA`} />
          <Tex block tex={`\\Phi_E = \\oint \\mathbf{E}\\cdot d\\mathbf{A} = E_r \\oint dA = E_r\\,(4\\pi r^2)`} />
        </div>
        <p className="hint">E_r tiene el mismo valor en todos los puntos de la superficie y es perpendicular a ella, por eso sale de la integral.</p>
      </div>

      <div className="eq-step">
        <span className="step-label">2 · Ley de Gauss</span>
        <Tex block tex={`\\Phi_E = \\dfrac{q_{enc}}{\\varepsilon_0} \\;\\Longrightarrow\\; E_r\\,(4\\pi r^2) = \\dfrac{q_{enc}}{\\varepsilon_0} \\;\\Longrightarrow\\; E_r = \\dfrac{q_{enc}}{4\\pi\\varepsilon_0\\, r^2}`} />
      </div>

      <div className="eq-step">
        <span className="step-label">3 · Carga encerrada q<sub>enc</sub> ({inside ? 'solo la parte de la esfera que cabe dentro de r' : 'toda la carga de la esfera'})</span>
        <div className="eq-lines">{qLines.map((t, i) => <Tex key={i} block tex={t} />)}</div>
      </div>

      <div className="eq-step">
        <span className="step-label">4 · Campo eléctrico a la distancia r</span>
        <div className="eq-lines">
          <Tex block tex={closed} />
          <Tex block tex={numeric} />
        </div>
      </div>

      <div className="eq-step result">
        <span className="step-label">Resultado</span>
        <Tex block tex={`E_r = ${texSci(E)}\\ \\text{N/C} \\quad (\\text{${dirText}})`} />
        <Tex block tex={`\\Phi_E = \\dfrac{q_{enc}}{\\varepsilon_0} = ${texSci(Phi)}\\ \\text{N}\\!\\cdot\\!\\text{m}^2/\\text{C}`} />
      </div>

      {reg === 'out' && (
        <div className="callout good-callout">
          <b>Fuera de la esfera</b>
          <span>El campo es el de una carga puntual Q en el centro: kQ/r² = ({nf(K / 1e9, 2)}×10⁹)({nf(Q, 2)}×10⁻⁹)/({nf(rm, 4)})² = <b className="num">{nf(K * Qc / (rm * rm), 1)} N/C</b>. Para una distribución con simetría esférica, la forma de la distribución no importa afuera.</span>
        </div>
      )}
      {reg === 'in' && (
        <div className="callout">
          <b>Dentro de la esfera (aislante)</b>
          <span>Como la carga está repartida en todo el volumen, el campo dentro <b>no es cero</b> (en un conductor sí lo sería). Solo cuenta la carga encerrada; la que está a mayor radio no aporta campo neto.</span>
        </div>
      )}
      <div className="check good">
        ✓ En r = R el campo es continuo: E(R) = kQ/R² = {nf(ER, 1)} N/C. Es su valor máximo; no hay carga superficial, por eso no hay salto.
      </div>
    </section>
  );
}
