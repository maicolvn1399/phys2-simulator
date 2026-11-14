import Tex from '../shared/Tex.jsx';
import { texNum, texSci, nf } from '../shared/format.js';
import { eng } from '../shared/units.js';
import { lenz, BAR_X0 } from './physics.js';

const U = { Wb: '\\text{Wb}', V: '\\text{V}' };

/** Ley de Faraday paso a paso con los valores del instante t; Lenz decide el sentido de la corriente. */
export default function InductionEquations({ m, p, t }) {
  const mode = m.mode, emf = m.emf(t), phi = m.phi(t), I = emf / p.Rc, ln = lenz(m, t);
  const dPhi = -emf;                                    // dΦ/dt
  const sci = v => texSci(v, 2);
  const N = m.N;
  let s1, s2, check = null;

  if (mode === 'field') {
    const A = m.A(), B = m.B(t);
    const Atex = `A = \\pi r^2 = \\pi\\,(${texNum(p.r / 100, 3)}\\ \\text{m})^2 = ${sci(A)}\\ \\text{m}^2`;
    if (p.shape === 'seno') {
      const w = 2 * Math.PI * p.f;
      s1 = [
        `\\Phi_B = N\\,B_z\\,A\\,\\cos 0^\\circ = N\\,A\\,B_m \\sin(2\\pi f t)`,
        Atex,
        `B_z(t) = B_m\\sin(2\\pi f t) = ${texNum(p.Bm, 2)}\\,\\sin(2\\pi\\cdot ${texNum(p.f, 2)}\\cdot ${texNum(t, 2)}) = ${texNum(B, 3)}\\ \\text{T}`,
        `\\Phi_B = (${N})(${sci(A)})(${texNum(B, 3)}) = ${sci(phi)}\\ ${U.Wb}`,
      ];
      s2 = [
        `\\varepsilon = -\\dfrac{d\\Phi_B}{dt} = -N\\,A\\,B_m\\,(2\\pi f)\\cos(2\\pi f t)`,
        `\\varepsilon = -(${N})(${sci(A)})(${texNum(p.Bm, 2)})(${texNum(w, 3)}\\ \\text{s}^{-1})\\cos(${texNum(w * t, 3)}) = ${sci(emf)}\\ ${U.V}`,
      ];
    } else {
      s1 = [
        `\\Phi_B = N\\,B_z\\,A\\,\\cos 0^\\circ = N\\,A\\,(B_0 + \\beta t)`,
        Atex,
        `B_z(t) = B_0 + \\beta t = ${texNum(p.B0, 2)} + (${texNum(p.beta, 2)})(${texNum(t, 2)}) = ${texNum(B, 3)}\\ \\text{T}`,
        `\\Phi_B = (${N})(${sci(A)})(${texNum(B, 3)}) = ${sci(phi)}\\ ${U.Wb}`,
      ];
      s2 = [
        `\\varepsilon = -\\dfrac{d\\Phi_B}{dt} = -N\\,A\\,\\dfrac{dB_z}{dt} = -N\\,A\\,\\beta`,
        `\\varepsilon = -(${N})(${sci(A)})(${texNum(p.beta, 2)}\\ \\text{T/s}) = ${sci(emf)}\\ ${U.V}`,
      ];
    }
  } else if (mode === 'bar') {
    const Bz = m.B(t), x = m.x(t), A = m.A(t);
    s1 = [
      `\\Phi_B = B_z\\,A = B_z\\,L\\,x(t), \\qquad x(t) = x_0 + v\\,t`,
      `x = ${texNum(BAR_X0, 2)} + (${texNum(m.v, 3)}\\ \\text{m/s})(${texNum(t, 2)}\\ \\text{s}) = ${texNum(x, 3)}\\ \\text{m}, \\qquad A = L\\,x = (${texNum(m.L, 2)})(${texNum(x, 3)}) = ${sci(A)}\\ \\text{m}^2`,
      `\\Phi_B = (${texNum(Bz, 2)}\\ \\text{T})(${sci(A)}\\ \\text{m}^2) = ${sci(phi)}\\ ${U.Wb}`,
    ];
    s2 = [
      `\\varepsilon = -\\dfrac{d\\Phi_B}{dt} = -B_z\\,L\\,\\dfrac{dx}{dt} = -B_z\\,L\\,v`,
      `\\varepsilon = -(${texNum(Bz, 2)}\\ \\text{T})(${texNum(m.L, 2)}\\ \\text{m})(${texNum(m.v, 3)}\\ \\text{m/s}) = ${sci(emf)}\\ ${U.V}`,
    ];
    if (m.v > 0) {
      const F = Math.abs(I) * m.L * p.Bu, Pj = emf * emf / p.Rc, Pm = F * m.v;
      check = (
        <div className="check good">
          ✓ Energía: la fuerza externa que mantiene v constante es F = I L B = {eng(F, 'N')}; la potencia mecánica F·v = {eng(Pm, 'W')} es igual a la que se disipa en R, ε²/R = {eng(Pj, 'W')}.
        </div>
      );
    }
  } else {
    const th = m.theta(t);
    s1 = [
      `\\Phi_B = N\\,B\\,A\\cos\\theta, \\qquad \\theta = \\omega t, \\quad A = a\\,b = ${sci(m.A())}\\ \\text{m}^2`,
      `\\theta = (${texNum(p.w, 2)}\\ \\text{rad/s})(${texNum(t, 2)}\\ \\text{s}) = ${texNum(th, 3)}\\ \\text{rad} = ${texNum((th * 180) / Math.PI, 1)}^\\circ`,
      `\\Phi_B = (${N})(${texNum(p.Bu, 2)}\\ \\text{T})(${sci(m.A())})\\cos(${texNum(th, 3)}) = ${sci(phi)}\\ ${U.Wb}`,
    ];
    s2 = [
      `\\varepsilon = -\\dfrac{d\\Phi_B}{dt} = N\\,B\\,A\\,\\omega\\,\\sin\\omega t, \\qquad \\varepsilon_{m\\acute{a}x} = N\\,B\\,A\\,\\omega = ${sci(m.stats.emfAbs)}\\ ${U.V}`,
      `\\varepsilon = (${N})(${texNum(p.Bu, 2)})(${sci(m.A())})(${texNum(p.w, 2)})\\sin(${texNum(th, 3)}) = ${sci(emf)}\\ ${U.V}`,
    ];
  }

  // 3 · Lenz
  const rel = mode === 'rot' ? ' (respecto de n̂, regla de la mano derecha)' : '';
  const trendTxt = ln.trend === 'up' ? 'Φ está aumentando (dΦ/dt > 0)' : ln.trend === 'down' ? 'Φ está disminuyendo (dΦ/dt < 0)' : 'Φ no cambia en este instante (dΦ/dt = 0)';
  let lenzTxt;
  if (ln.dir === 'none') lenzTxt = 'No hay fem ni corriente inducida.';
  else if (mode === 'rot') lenzTxt = `La corriente inducida se opone al cambio: circula en sentido ${ln.dir === 'ccw' ? 'positivo (antihorario visto desde la punta de n̂)' : 'negativo (horario visto desde la punta de n̂)'}.`;
  else lenzTxt = `El campo inducido se opone al cambio de Φ: apunta ${ln.dir === 'ccw' ? 'hacia afuera (⊙)' : 'hacia adentro (⊗)'}, así que la corriente es ${ln.dir === 'ccw' ? 'antihoraria' : 'horaria'}.`;

  return (
    <section className="sheet equations" aria-labelledby="iEqTitle">
      <div className="sheet-head">
        <h2 id="iEqTitle">Ley de Faraday paso a paso</h2>
        <span className="pill">t = {nf(t, 2)} s</span>
      </div>

      <div className="eq-step">
        <span className="step-label">1 · Flujo magnético a través de la espira{mode === 'bar' ? ' (el circuito formado por los rieles y la barra)' : ''}</span>
        <div className="eq-lines">{s1.map((x, i) => <Tex key={i} block tex={x} />)}</div>
        <p className="hint">Se toma n̂ = +z (hacia afuera de la página): Φ y ε son positivos o negativos respecto de ese sentido.</p>
      </div>

      <div className="eq-step">
        <span className="step-label">2 · Ley de Faraday: ε = −dΦ/dt</span>
        <div className="eq-lines">{s2.map((x, i) => <Tex key={i} block tex={x} />)}</div>
      </div>

      <div className="eq-step">
        <span className="step-label">3 · Ley de Lenz: sentido de la corriente inducida{rel}</span>
        <p>{trendTxt}.</p>
        <p>{lenzTxt}</p>
        <p className="hint">Con esta convención ε &gt; 0 es antihoraria y ε &lt; 0 es horaria: el signo menos de Faraday ya contiene a Lenz.</p>
      </div>

      <div className="eq-step">
        <span className="step-label">4 · Corriente y potencia en el circuito (resistencia R = {nf(p.Rc, 1)} Ω)</span>
        <div className="eq-lines">
          <Tex block tex={`I = \\dfrac{\\varepsilon}{R} = \\dfrac{${sci(emf)}\\ ${U.V}}{${texNum(p.Rc, 1)}\\ \\Omega} = ${sci(I)}\\ \\text{A}`} />
          <Tex block tex={`P = \\dfrac{\\varepsilon^2}{R} = I^2 R = ${sci(emf * emf / p.Rc)}\\ \\text{W}`} />
        </div>
      </div>

      <div className="eq-step result">
        <span className="step-label">Resultado en t = {nf(t, 2)} s</span>
        <Tex block tex={`\\varepsilon = ${sci(emf)}\\ ${U.V} \\quad (\\text{${ln.dir === 'none' ? 'sin corriente' : ln.dir === 'ccw' ? 'antihoraria' : 'horaria'}${mode === 'rot' && ln.dir !== 'none' ? ' respecto de } \\hat{n}\\text{' : ''}})`} />
      </div>
      {check}
    </section>
  );
}
