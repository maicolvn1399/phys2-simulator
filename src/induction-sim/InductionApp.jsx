import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import InductionCanvas from './InductionCanvas.jsx';
import InductionEquations from './InductionEquations.jsx';
import InductionCharts from './InductionCharts.jsx';
import Slider from '../shared/Slider.jsx';
import { I_PRESETS, MODE_DEFAULT, fullP } from './presets.js';
import { MODES, model, lenz } from './physics.js';
import { useThemeTokens } from '../shared/useThemeTokens.js';
import { nf } from '../shared/format.js';
import { eng } from '../shared/units.js';
import './induction.css';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function fromPreset(key) {
  return { presetKey: key, mode: I_PRESETS[key].mode, p: fullP(key), dirty: false };
}
function reducer(s, a) {
  switch (a.type) {
    case 'preset': return fromPreset(a.key);
    case 'mode': return fromPreset(MODE_DEFAULT[a.mode]);
    case 'set': return { ...s, p: { ...s.p, ...a.patch }, dirty: true };
    default: return s;
  }
}

export default function InductionApp() {
  const [st, dispatch] = useReducer(reducer, 'generador', fromPreset);
  const [t, setT] = useState(0.35);
  const [playing, setPlaying] = useState(!reduceMotion);
  const [speed, setSpeed] = useState(1);
  const tokens = useThemeTokens();
  const { mode, p } = st;
  const m = useMemo(() => model(mode, p), [mode, p]);
  const set = patch => dispatch({ type: 'set', patch });
  const preset = I_PRESETS[st.presetKey];

  // reloj de la reproducción: recorre [0, T] y vuelve a empezar
  const Tref = useRef(m.T);
  Tref.current = m.T;
  useEffect(() => {
    if (!playing) return undefined;
    let raf, last = 0;
    const frame = ts => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      setT(prev => { const n = prev + dt * speed; return n > Tref.current ? n % Tref.current : n; });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const tt = Math.min(t, m.T);
  // las ecuaciones y el panel "Ahora" usan el mismo instante, redondeado (menos redibujos por segundo al reproducir) y dentro de [0, T]
  const tEq = Math.min(m.T, playing ? Math.round(tt * 10) / 10 : Math.round(tt * 100) / 100);
  const phi = m.phi(tEq), emf = m.emf(tEq), I = emf / p.Rc, ln = lenz(m, tEq);
  const dirTxt = ln.dir === 'none' ? 'sin corriente' : ln.dir === 'ccw' ? (mode === 'rot' ? '↺ + (respecto de n̂)' : '↺ antihoraria') : (mode === 'rot' ? '↻ − (respecto de n̂)' : '↻ horaria');

  const LEGEND = {
    field: [['key key-field', 'campo B uniforme (⊙ sale, ⊗ entra)'], ['key key-loop', 'espira y corriente inducida']],
    bar: [['key key-field', 'campo B uniforme'], ['key key-loop', 'circuito y corriente inducida'], ['key key-out', 'fuerza magnética sobre la barra'], ['key key-in', 'fuerza externa']],
    rot: [['key key-field', 'líneas de B'], ['key key-loop', 'espira y corriente inducida'], ['key key-probe', 'normal n̂ y ángulo θ']],
  }[mode];

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Física II · Inducción electromagnética</div>
        <h1>Ley de Faraday y ley de Lenz</h1>
        <p className="lead">Cambia el flujo magnético a través de un circuito (variando B, moviendo una barra o girando una espira) y mira la fem y la corriente inducidas. Mueve el control de tiempo para ver cada instante y sus ecuaciones.</p>
      </header>

      <div className="lab">
        <div className="stage-card">
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Situación">
              {MODES.map(([k, name]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => dispatch({ type: 'mode', mode: k })}>{name}</button>)}
            </div>
            <div className="layers">
              <button type="button" className="btn small" aria-pressed={playing} onClick={() => setPlaying(a => !a)}>{playing ? '❚❚ Pausar' : '▶ Reproducir'}</button>
            </div>
          </div>

          <InductionCanvas mode={mode} p={p} t={tt} tokens={tokens} animate={playing} />

          <div className="timebar">
            <label className="speed" htmlFor="iTime"><span>t</span>
              <input id="iTime" type="range" min="0" max={m.T} step={m.T / 600} value={tt}
                onPointerDown={() => setPlaying(false)} onChange={e => { setPlaying(false); setT(Number(e.target.value)); }} />
              <output className="num">{nf(tt, 2)} / {nf(m.T, 2)} s</output>
            </label>
            <div className="mini-seg" role="group" aria-label="Velocidad de reproducción">
              {[0.25, 0.5, 1, 2].map(v => <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v}×</button>)}
            </div>
          </div>

          <div className="legend">
            {LEGEND.map(([c, txt]) => <span key={txt}><i className={c} /> {txt}</span>)}
          </div>
        </div>

        <aside>
          <div className="panel">
            <label htmlFor="iPreset"><h3>Escenario</h3></label>
            <select id="iPreset" value={st.presetKey} onChange={e => dispatch({ type: 'preset', key: e.target.value })}>
              {Object.entries(I_PRESETS).map(([k, x]) => <option key={k} value={k}>{x.name}</option>)}
            </select>
            <p className="hint">{preset.note}{st.dirty ? ' (modificado)' : ''}</p>
          </div>

          <div className="panel">
            <h3>Parámetros</h3>
            {mode === 'field' && <>
              <div className="seg full" role="group" aria-label="Cómo varía B">
                <button type="button" aria-pressed={p.shape === 'lineal'} onClick={() => set({ shape: 'lineal' })}>B lineal</button>
                <button type="button" aria-pressed={p.shape === 'seno'} onClick={() => set({ shape: 'seno' })}>B senoidal</button>
              </div>
              <Slider id="iN" label="Vueltas N" value={p.N} min={1} max={200} step={1} d={0} onChange={v => set({ N: v })} />
              <Slider id="ir" label="Radio r" value={p.r} min={2} max={15} step={0.5} unit="cm" onChange={v => set({ r: v })} />
              {p.shape === 'lineal' ? <>
                <Slider id="iB0" label="B inicial B₀" value={p.B0} min={-1} max={1} step={0.05} unit="T" d={2} onChange={v => set({ B0: v })} />
                <Slider id="ibeta" label="Razón dB/dt = β" value={p.beta} min={-0.5} max={0.5} step={0.05} unit="T/s" d={2} onChange={v => set({ beta: v })} />
                <p className="hint">B(t) = B₀ + β t. B &gt; 0 sale de la página (⊙).</p>
              </> : <>
                <Slider id="iBm" label="Amplitud B_m" value={p.Bm} min={0.1} max={1} step={0.05} unit="T" d={2} onChange={v => set({ Bm: v })} />
                <Slider id="if" label="Frecuencia f" value={p.f} min={0.25} max={2} step={0.05} unit="Hz" d={2} onChange={v => set({ f: v })} />
                <p className="hint">B(t) = B_m sen(2π f t). Se muestran dos periodos.</p>
              </>}
            </>}
            {mode === 'bar' && <>
              <Slider id="iBu" label="Campo B" value={p.Bu} min={0.1} max={2} step={0.1} unit="T" d={1} onChange={v => set({ Bu: v })} />
              <div className="seg full" role="group" aria-label="Dirección de B">
                <button type="button" aria-pressed={p.dirB > 0} onClick={() => set({ dirB: 1 })}>⊙ Sale</button>
                <button type="button" aria-pressed={p.dirB < 0} onClick={() => set({ dirB: -1 })}>⊗ Entra</button>
              </div>
              <Slider id="iL" label="Largo de la barra L" value={p.L} min={10} max={50} step={1} unit="cm" d={0} onChange={v => set({ L: v })} />
              <Slider id="iv" label="Rapidez v" value={p.v} min={0} max={25} step={1} unit="cm/s" d={0} onChange={v => set({ v })} />
              <p className="hint">La barra parte de x₀ = 20 cm y se mueve a v constante hacia la derecha durante 4 s.</p>
            </>}
            {mode === 'rot' && <>
              <Slider id="iN" label="Vueltas N" value={p.N} min={1} max={200} step={1} d={0} onChange={v => set({ N: v })} />
              <Slider id="iBu" label="Campo B" value={p.Bu} min={0.05} max={1} step={0.05} unit="T" d={2} onChange={v => set({ Bu: v })} />
              <Slider id="ia" label="Lado a (vertical)" value={p.a} min={2} max={20} step={1} unit="cm" d={0} onChange={v => set({ a: v })} />
              <Slider id="ib" label="Lado b (horizontal)" value={p.b} min={2} max={20} step={1} unit="cm" d={0} onChange={v => set({ b: v })} />
              <Slider id="iw" label="Velocidad angular ω" value={p.w} min={1} max={20} step={0.5} unit="rad/s" d={1} onChange={v => set({ w: v })} />
              <p className="hint">θ = ω t es el ángulo entre n̂ y B. Se muestran dos vueltas completas.</p>
            </>}
            <Slider id="iRc" label="Resistencia del circuito R" value={p.Rc} min={0.5} max={50} step={0.5} unit="Ω" d={1} onChange={v => set({ Rc: v })} />
          </div>

          <div className="panel">
            <h3>Ahora (t = {nf(tEq, 2)} s)</h3>
            <div className="row"><span>Φ</span><b className="num">{eng(phi, 'Wb', 3, m.stats.phiAbs)}</b></div>
            <div className="row"><span>ε = −dΦ/dt</span><b className="num">{eng(emf, 'V', 3, m.stats.emfAbs)}</b></div>
            <div className="row"><span>I = ε/R</span><b className="num">{eng(I, 'A', 3, m.stats.emfAbs / p.Rc)}</b></div>
            <div className="row"><span>Sentido</span><b>{dirTxt}</b></div>
          </div>
        </aside>
      </div>

      <div className="results">
        <InductionEquations m={m} p={p} t={tEq} />
        <section className="sheet" aria-labelledby="iChTitle">
          <div className="sheet-head"><h2 id="iChTitle">Φ y ε en el tiempo</h2></div>
          <InductionCharts m={m} t={tt} />
          <p className="foot">Modelo: campo magnético uniforme en el vacío, circuito plano, resistencia R concentrada (se desprecia la autoinductancia). Φ se mide con n̂ = +z; la fem ε = −dΦ/dt es positiva si la corriente inducida es antihoraria. La ventana de tiempo se repite al reproducir.</p>
        </section>
      </div>
    </div>
  );
}
