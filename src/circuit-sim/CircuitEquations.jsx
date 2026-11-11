import Tex from '../shared/Tex.jsx';
import { val } from './frac.js';

const T = String.raw;
/** Decimal con coma, sin ceros de sobra. */
export function dec(v, d = 4) {
  if (!Number.isFinite(v)) return '\\infty';
  let s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s.replace('.', '{,}');
}
const rTex = n => (n || '').replace(/_\{?(\w+)\}?/, '_{$1}');
const iTex = i => `I_{${i + 1}}`;

/** Σ coef·I = rhs con coeficientes en decimal. */
function linTex(coef, rhs) {
  const ks = [...coef.keys()].filter(k => coef.get(k).n !== 0n).sort((a, b) => a - b);
  if (!ks.length) return `0 = ${dec(val(rhs))}`;
  const parts = ks.map((k, j) => {
    const c = val(coef.get(k)), a = Math.abs(c);
    const num = Math.abs(a - 1) < 1e-12 ? '' : dec(a);
    return `${c < 0 ? '-' : j ? '+' : ''} ${num}${iTex(k)}`;
  });
  return `${parts.join(' ')} = ${dec(val(rhs))}`;
}
/** c + Σ t·I */
function exprTex(cst, terms, values) {
  const parts = [];
  const c = val(cst);
  if (Math.abs(c) > 1e-12 || !terms.size) parts.push(dec(c));
  for (const [k, t] of terms) {
    const tv = val(t);
    if (Math.abs(tv) < 1e-12) continue;
    const a = Math.abs(tv), num = Math.abs(a - 1) < 1e-12 ? '' : dec(a);
    const v = values ? `(${dec(val(values.get(k)))})` : iTex(k);
    parts.push(`${tv < 0 ? '-' : parts.length ? '+' : ''} ${num}${values && !num ? '' : ''}${v}`);
  }
  return parts.join(' ') || '0';
}

function solveLines(sol) {
  const L = [];
  for (const s of sol.steps) {
    if (s.type === 'isolate') {
      if (!s.terms.size) {
        const c = s.eq.coef.get(s.v);
        L.push(T`\text{De } ${s.from}:\quad ${iTex(s.v)} = \frac{${dec(val(s.eq.rhs))}}{${dec(val(c))}} = \boxed{${dec(val(s.cst))}\ \text{A}}`);
      } else L.push(T`\text{De } ${s.from}:\quad ${iTex(s.v)} = ${exprTex(s.cst, s.terms)}`);
    }
    else if (s.type === 'subst') s.eqs.forEach(e => L.push(T`\text{Sustituyendo } ${iTex(s.v)}:\quad ${e.label}\ \ ${linTex(e.coef, e.rhs)}`));
    else if (s.type === 'singular') L.push(T`\text{El sistema no tiene solución única (revisa que no haya lazos de solo cables o fuentes en cortocircuito).}`);
  }
  for (const b of sol.back) {
    if (!b.terms.size) continue;
    const withVals = b.terms.size ? T` = ${exprTex(b.cst, b.terms, sol.values)}` : '';
    L.push(T`${iTex(b.v)}${b.terms.size ? T` = ${exprTex(b.cst, b.terms)}` : ''}${withVals} = \boxed{${dec(val(b.value))}\ \text{A}}`);
  }
  return L;
}

/* ---------------------------------------------------------------- R_eq ---------------------------------------------------------------- */
function ReqSection({ an, reqStep, setReqStep }) {
  const req = an.req, N = req.steps.length;
  const lines = req.steps.slice(0, reqStep).map((s, j) => {
    if (s.type === 'series') return { tex: T`\text{Serie: }\ ${rTex(s.result.name)} = ${s.parts.map(p => rTex(p.name)).join(' + ')} = ${s.parts.map(p => dec(p.R, 3)).join(' + ')} = ${dec(s.result.R, 3)}\ \Omega`, cur: j === reqStep - 1 };
    if (s.type === 'parallel') return { tex: T`\text{Paralelo: }\ ${rTex(s.result.name)} = \left(${s.parts.map(p => `\\frac{1}{${rTex(p.name)}}`).join(' + ')}\right)^{-1} = \left(${s.parts.map(p => `\\frac{1}{${dec(p.R, 3)}}`).join(' + ')}\right)^{-1} = ${dec(s.result.R, 3)}\ \Omega`, cur: j === reqStep - 1 };
    return { text: s.note, cur: j === reqStep - 1 };
  });
  const done = reqStep >= N;
  return (
    <div className="eq-step">
      <div className="step-head">
        <span className="step-label">1 · Resistencia equivalente que ve la fuente ε</span>
        <div className="mini-seg" role="group" aria-label="Pasos de la reducción">
          <button type="button" onClick={() => setReqStep(Math.max(0, reqStep - 1))} disabled={reqStep <= 0}>◀</button>
          <button type="button" aria-pressed="false" disabled>Paso {reqStep}/{N}</button>
          <button type="button" onClick={() => setReqStep(Math.min(N, reqStep + 1))} disabled={reqStep >= N}>▶</button>
          <button type="button" onClick={() => setReqStep(N)}>Todo</button>
        </div>
      </div>
      <div className="eq-lines">
        {reqStep === 0 && <p className="hint">Avanza con ▶: en cada paso se combinan resistencias en serie (misma corriente, un nodo intermedio sin más conexiones) o en paralelo (mismos dos nodos). En el dibujo el circuito se contrae: las resistencias en serie se funden en una y las ramas en paralelo se pliegan en una sola; con ◀ se vuelve a expandir.</p>}
        {lines.map((l, i) => (l.tex ? <div key={i} className={l.cur ? 'cur-step' : ''}><Tex block tex={l.tex} /></div> : <p key={i} className="hint">{l.text}</p>))}
        {done && req.ok && <>
          <Tex block tex={T`R_{eq} = ${dec(req.Req, 3)}\ \Omega`} />
          <Tex block tex={T`I = \frac{\varepsilon}{R_{eq}} = \frac{${dec(an.source.value)}}{${dec(req.Req, 3)}} = \boxed{${dec(an.source.value / req.Req, 4)}\ \text{A}}\qquad \text{(corriente que entrega la fuente)}`} />
        </>}
        {done && !req.ok && <>
          <p className="callout">{req.reason}</p>
          {an.ok && <Tex block tex={T`R_{eq} = \frac{\varepsilon}{I} = \frac{${dec(an.source.value)}}{${dec(an.Itotal, 4)}} = ${dec(an.source.value / an.Itotal, 3)}\ \Omega\qquad (I \text{ de Kirchhoff})`} />}
        </>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- mallas ---------------------------------------------------------------- */
function meshLines(an) {
  const M = an.mesh, L = [];
  if (an.planar) L.push(T`\text{Corrientes de malla en sentido horario: } ${an.meshes.map(m => iTex(m.i)).join(',\\ ')}.\ \ \text{En una resistencia compartida circula la diferencia de las dos.}`);
  else L.push(T`\text{Hay cables que se cruzan sin conectarse, así que no hay mallas como tales: se usan lazos cerrados independientes (horarios): } ${an.meshes.map(m => iTex(m.i)).join(',\\ ')}.`);
  M.eqs.forEach((e, k) => {
    const sym = [], num = [];
    e.terms.forEach((t, j) => {
      const first = j === 0;
      if (t.kind === 'E') { sym.push(`${t.sign > 0 ? (first ? '' : '+') : '-'}\\varepsilon`); num.push(`${t.sign > 0 ? (first ? '' : '+') : '-'}${dec(t.value)}`); }
      else {
        const cur = t.others.length ? `(${iTex(e.mesh.i)}${t.others.map(o => ` ${o.sign > 0 ? '+' : '-'} ${iTex(o.mesh.i)}`).join('')})` : iTex(e.mesh.i);
        sym.push(`- ${rTex(t.name)}${cur}`); num.push(`- ${dec(t.value)}${cur}`);
      }
    });
    L.push(T`\text{${an.planar ? 'Malla' : 'Lazo'} } ${k + 1}:\quad ${sym.join(' ')} = 0`);
    L.push(T`${num.join(' ')} = 0\quad\Rightarrow\quad (${k + 1})\ \ ${linTex(e.coef, e.rhs)}`);
  });
  L.push(T`\textbf{Resolviendo por sustitución}`);
  L.push(...solveLines(M.solve));
  // corriente en cada resistencia
  const vals = M.solve.values;
  const rs = an.els.filter(e => e.type === 'R').map(e => {
    const ls = an.loopsOf(e);
    const tot = ls.reduce((t, o) => t + (o.fwd ? 1 : -1) * val(vals.get(o.mesh.i)), 0);
    const ex = ls.map((o, j) => `${o.fwd ? (j ? '+ ' : '') : '- '}${iTex(o.mesh.i)}`).join(' ') || '0';
    return T`I_{${rTex(e.name)}} = ${ex} = ${dec(tot, 4)}\ \text{A}`;
  });
  L.push(T`\text{Corriente en cada resistencia (positiva en el sentido en que se dibujó el elemento):}`);
  L.push(...rs);
  return L;
}

/* ---------------------------------------------------------------- ramas ---------------------------------------------------------------- */
function branchLines(an) {
  const B = an.branch, L = [];
  const nm = n => B.pnames.get(n) || '·';
  L.push(T`\text{Una corriente por rama (sentido supuesto; si sale negativa, va al revés): } ${B.branches.map(b => `${iTex(b.i)}:\\ ${nm(b.from)}\\to ${nm(b.to)}`).join(',\\quad ')}`);
  if (!B.principal.length) L.push(T`\text{No hay nodos con 3 o más conexiones: es un solo lazo y una sola corriente.}`);
  let k = 0;
  for (const e of B.eqs) {
    k++;
    if (e.kind === 'node') {
      const lhs = e.ins.map(b => iTex(b.i)).join(' + ') || '0', rhs = e.outs.map(b => iTex(b.i)).join(' + ') || '0';
      L.push(T`\text{Ley de nodos en } ${e.node}\ (\text{entra} = \text{sale}):\quad ${lhs} = ${rhs}\quad\Rightarrow\quad (${k})\ \ ${linTex(e.coef, e.rhs)}`);
    } else {
      const sym = [], num = [];
      e.terms.forEach((t, j) => {
        const first = j === 0;
        if (t.kind === 'E') { sym.push(`${t.sign > 0 ? (first ? '' : '+') : '-'}\\varepsilon`); num.push(`${t.sign > 0 ? (first ? '' : '+') : '-'}${dec(t.value)}`); }
        else { const sg = t.sign < 0 ? '-' : first ? '' : '+'; sym.push(`${sg} ${rTex(t.name)}${iTex(t.br.i)}`); num.push(`${sg} ${dec(t.value)}${iTex(t.br.i)}`); }
      });
      L.push(T`\text{Ley de mallas (malla } ${e.mesh.i + 1}\text{, sentido horario)}:\quad ${sym.join(' ')} = 0`);
      L.push(T`${num.join(' ')} = 0\quad\Rightarrow\quad (${k})\ \ ${linTex(e.coef, e.rhs)}`);
    }
  }
  L.push(T`\textbf{Resolviendo por sustitución}`);
  L.push(...solveLines(B.solve));
  if (B.deadEnds.length) L.push(T`\text{Las ramas con un extremo suelto no llevan corriente.}`);
  return L;
}

export default function CircuitEquations({ an, kMethod, setKMethod, reqStep, setReqStep }) {
  if (!an) return null;
  if (!an.ok) return (
    <section className="sheet equations"><div className="sheet-head"><h2>Solución</h2></div>
      {an.msgs.map((m, i) => <p key={i} className="callout">{m}</p>)}
    </section>
  );
  const lines = kMethod === 'mesh' ? meshLines(an) : branchLines(an);
  const Rs = an.els.filter(e => e.type === 'R');
  const Pin = an.source.value * an.Itotal, Psum = Rs.reduce((t, r) => t + r.I * r.I * r.value, 0);
  return (
    <section className="sheet equations" aria-labelledby="cEqTitle">
      <div className="sheet-head">
        <h2 id="cEqTitle">Solución del circuito</h2>
        <span className="pill">ε = {an.source.value} V</span>
      </div>
      <ReqSection an={an} reqStep={reqStep} setReqStep={setReqStep} />
      <div className="eq-step">
        <div className="step-head">
          <span className="step-label">2 · Leyes de Kirchhoff</span>
          <div className="mini-seg" role="group" aria-label="Método">
            <button type="button" aria-pressed={kMethod === 'mesh'} onClick={() => setKMethod('mesh')}>Mallas</button>
            <button type="button" aria-pressed={kMethod === 'branch'} onClick={() => setKMethod('branch')}>Ramas</button>
          </div>
        </div>
        <div className="eq-lines">{lines.map((t, i) => <Tex key={kMethod + i} block tex={t} />)}</div>
      </div>
      <div className="eq-step">
        <span className="step-label">3 · Corrientes, voltajes y potencias</span>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Elemento</th><th>I (A)</th><th>V = I·R (V)</th><th>P = I²·R (W)</th></tr></thead>
            <tbody>
              {Rs.map(r => <tr key={r.id}><td><Tex tex={`${rTex(r.name)} = ${dec(r.value, 2)}\\ \\Omega`} /></td><td>{dec(Math.abs(r.I), 4).replace('{,}', ',')}</td><td>{dec(Math.abs(r.dV), 3).replace('{,}', ',')}</td><td>{dec(r.I * r.I * r.value, 4).replace('{,}', ',')}</td></tr>)}
            </tbody>
            <tfoot><tr><td>Fuente ε</td><td>{dec(an.Itotal, 4).replace('{,}', ',')}</td><td>{an.source.value}</td><td>{dec(Pin, 4).replace('{,}', ',')} (entrega)</td></tr></tfoot>
          </table>
        </div>
        <Tex block tex={T`P_{\varepsilon} = \varepsilon I = ${dec(an.source.value)}(${dec(an.Itotal, 4)}) = ${dec(Pin, 4)}\ \text{W}\qquad \sum I^{2}R = ${dec(Psum, 4)}\ \text{W}\qquad (\text{la energía se conserva})`} />
      </div>
    </section>
  );
}
