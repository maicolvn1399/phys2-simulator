import { useReducer, useState } from 'react';
import GaussCanvas from './GaussCanvas.jsx';
import GaussEquations from './GaussEquations.jsx';
import GaussCharts from './GaussCharts.jsx';
import Slider from '../shared/Slider.jsx';
import { G_PRESETS } from './presets.js';
import { DISTS, qEnc, Er, flux, region } from './physics.js';
import { useThemeTokens } from '../shared/useThemeTokens.js';
import { nf, sciText } from '../shared/format.js';
import './gauss.css';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function fromPreset(key) {
  const p = G_PRESETS[key];
  return { presetKey: key, dirty: false, Q: p.Q, R: p.R, r: p.r, dist: p.dist };
}
function reducer(s, a) {
  switch (a.type) {
    case 'preset': return fromPreset(a.key);
    case 'set': {
      const n = { ...s, ...a.patch, dirty: true };
      n.r = Math.max(0.1, Math.min(n.r, 2 * n.R));       // la superficie gaussiana llega hasta 2R
      return n;
    }
    default: return s;
  }
}

export default function GaussApp() {
  const [st, dispatch] = useReducer(reducer, 'dentro', fromPreset);
  const [animate, setAnimate] = useState(!reduceMotion);
  const [layers, setLayers] = useState({ vec: true, enc: true, dots: true });
  const tokens = useThemeTokens();
  const { Q, R, r, dist } = st;
  const preset = G_PRESETS[st.presetKey];
  const set = patch => dispatch({ type: 'set', patch });
  const setLayer = k => e => setLayers(l => ({ ...l, [k]: e.target.checked }));

  const Qc = Q * 1e-9, Rm = R / 100, rm = r / 100;
  const q = qEnc(Qc, Rm, rm, dist), E = Er(Qc, Rm, rm, dist), Phi = flux(Qc, Rm, rm, dist);
  const reg = region(r, R);

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Física II · Ley de Gauss</div>
        <h1>Esfera aislante con carga en su volumen</h1>
        <p className="lead">Elige el radio de una superficie gaussiana esférica (arrastrando en el lienzo o con el control) y mira cómo cambian la carga encerrada, el flujo y el campo E dentro y fuera de la esfera. Las ecuaciones de abajo se recalculan con cada cambio.</p>
      </header>

      <div className="lab">
        <div className="stage-card">
          <div className="toolbar">
            <div className="layers">
              <label><input type="checkbox" id="lyVec" checked={layers.vec} onChange={setLayer('vec')} /> Vectores E</label>
              <label><input type="checkbox" id="lyEnc" checked={layers.enc} onChange={setLayer('enc')} /> Carga encerrada</label>
              <label><input type="checkbox" id="lyDots" checked={layers.dots} onChange={setLayer('dots')} /> Cargas (+ / −)</label>
            </div>
            <div className="layers">
              <button type="button" className="btn small" aria-pressed={animate} onClick={() => setAnimate(a => !a)}>{animate ? '❚❚ Pausar' : '▶ Animar'}</button>
            </div>
          </div>

          <GaussCanvas Q={Q} R={R} r={r} dist={dist} tokens={tokens} layers={layers} animate={animate} onRadius={v => set({ r: v })} />

          <div className="legend">
            <span><i className="key key-loop" /> superficie gaussiana (radio r)</span>
            <span><i className="key key-out" /> E sobre la superficie (Q &gt; 0 sale, Q &lt; 0 entra)</span>
            <span><i className="key key-field" /> campo E en el espacio</span>
            <span className="muted">Toca o arrastra en el lienzo para cambiar r · puntos que cruzan la superficie: flujo Φ</span>
          </div>
        </div>

        <aside>
          <div className="panel">
            <label htmlFor="gPreset"><h3>Escenario</h3></label>
            <select id="gPreset" value={st.presetKey} onChange={e => dispatch({ type: 'preset', key: e.target.value })}>
              {Object.entries(G_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
            <p className="hint">{preset.note}{st.dirty ? ' (modificado)' : ''}</p>
          </div>

          <div className="panel">
            <h3>Esfera aislante</h3>
            <Slider id="gQ" label="Carga total Q" value={Q} min={-20} max={20} step={0.5} unit="nC" onChange={v => set({ Q: v })} />
            <Slider id="gR" label="Radio R" value={R} min={2} max={15} step={0.5} unit="cm" onChange={v => set({ R: v })} />
            <span className="field-label">Distribución de la carga</span>
            <div className="seg full" role="group" aria-label="Distribución de la carga">
              {Object.entries(DISTS).map(([k, d]) => (
                <button key={k} type="button" aria-pressed={dist === k} onClick={() => set({ dist: k })} title={d.formula}>{d.name}</button>
              ))}
            </div>
            <p className="hint">{dist === 'uniform' ? 'ρ = 3Q/(4πR³): la carga está repartida por igual en todo el volumen.' : 'ρ(r) = ρ₀ r/R, con ρ₀ = Q/(πR³): hay más carga cerca de la superficie que cerca del centro.'}</p>
          </div>

          <div className="panel">
            <h3>Superficie gaussiana</h3>
            <Slider id="gr" label="Radio r" value={r} min={0.1} max={2 * R} step={0.1} unit="cm" onChange={v => set({ r: v })} />
            <div className="row"><span>Región</span><b>{reg === 'in' ? 'dentro (r < R)' : reg === 'out' ? 'fuera (r > R)' : 'r = R'}</b></div>
            <div className="row"><span>q<sub>enc</sub></span><b className="num">{nf(q * 1e9, 3)} nC</b></div>
            <div className="row"><span>Φ = q<sub>enc</sub>/ε₀</span><b className="num">{sciText(Phi)} N·m²/C</b></div>
            <div className="row"><span>E<sub>r</sub></span><b className="num">{sciText(E)} N/C</b></div>
          </div>
        </aside>
      </div>

      <div className="results">
        <GaussEquations Q={Q} R={R} r={r} dist={dist} />
        <section className="sheet" aria-labelledby="gChTitle">
          <div className="sheet-head"><h2 id="gChTitle">Cómo cambian con r</h2></div>
          <GaussCharts Q={Q} R={R} r={r} dist={dist} />
          <p className="foot">Modelo: esfera aislante de radio R con carga total Q distribuida en todo su volumen, en el vacío (ε₀ = 8,85 × 10⁻¹² C²/N·m²). Por la simetría esférica, E es radial y depende solo de r. La componente radial E<sub>r</sub> es positiva si apunta hacia afuera (Q &gt; 0) y negativa si apunta hacia el centro (Q &lt; 0).</p>
        </section>
      </div>
    </div>
  );
}
