import { useMemo, useReducer, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CircuitCanvas, { uName } from './CircuitCanvas.jsx';
import CircuitEquations from './CircuitEquations.jsx';
import NumField from '../shared/NumField.jsx';
import { C_PRESETS, withNames, renameAll, newCid } from './presets.js';
import { analyze } from './model.js';
import { useThemeTokens } from '../shared/useThemeTokens.js';
import { nf } from '../shared/format.js';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const TOOLS = [
  ['pick', 'Seleccionar', <path key="p" {...S} d="M6 4l12 7-5.5 1.5L10 18z" />, 'Toca un elemento para ver y cambiar su valor.'],
  ['erase', 'Eliminar', <path key="e" {...S} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, 'Toca un elemento para borrarlo.'],
  ['W', 'Cable', <path key="w" {...S} d="M3 12h18" />, 'Presiona en un punto de la cuadrícula y arrastra hasta otro punto: horizontal, vertical o inclinado.'],
  ['R', 'Resistencia', <path key="r" {...S} d="M2 12h4l2-4 3 8 3-8 3 8 2-4h3" />, 'Arrastra entre dos puntos: la resistencia queda en el centro del tramo (10 Ω; cámbiala al seleccionarla).'],
  ['E', 'Fuente ε', <g key="b"><path {...S} d="M2 12h8M14 12h8" /><path {...S} d="M10 6v12" /><path {...S} strokeWidth="3" d="M14 9v6" /></g>, 'Arrastra del terminal − al +: el + queda donde sueltas. Solo una fuente por circuito.'],
];

function fromPreset(key) {
  const p = C_PRESETS[key];
  return { presetKey: key, comps: withNames(p.comps), sel: null, tool: p.comps.length ? 'pick' : 'W', dirty: false };
}
function reducer(s, a) {
  const edit = patch => ({ ...s, ...patch, dirty: true });
  switch (a.type) {
    case 'preset': return fromPreset(a.key);
    case 'tool': return { ...s, tool: a.tool };
    case 'select': return { ...s, sel: a.id };
    case 'create': {
      if (a.c.type === 'E' && s.comps.some(c => c.type === 'E')) return s;
      const c = { ...a.c, id: newCid(), value: a.c.type === 'R' ? 10 : a.c.type === 'E' ? 12 : 0, name: a.c.type === 'E' ? 'ε' : '' };
      const comps = renameAll([...s.comps, c]);
      return edit({ comps, sel: c.type === 'W' ? s.sel : c.id });
    }
    case 'change': return edit({ comps: s.comps.map(c => (c.id === a.id ? { ...c, ...a.patch } : c)) });
    case 'flip': return edit({ comps: s.comps.map(c => (c.id === a.id ? { ...c, a: c.b, b: c.a } : c)) });
    case 'delete': return edit({ comps: renameAll(s.comps.filter(c => c.id !== a.id)), sel: s.sel === a.id ? null : s.sel });
    case 'clear': return edit({ comps: [], sel: null, tool: 'W' });
    default: return s;
  }
}

export default function CircuitApp() {
  const [st, dispatch] = useReducer(reducer, 'mixto', fromPreset);
  const [mode, setMode] = useState('req');
  const [kMethod, setKMethod] = useState('mesh');
  const [reqStep, setReqStep] = useState(0);
  const [showResults, setShowResults] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [animate, setAnimate] = useState(!reduceMotion);
  const tokens = useThemeTokens();
  const an = useMemo(() => analyze(st.comps), [st.comps]);
  useEffect(() => { setReqStep(0); }, [st.comps]);
  const preset = C_PRESETS[st.presetKey];
  const selC = st.comps.find(c => c.id === st.sel);
  const tool = TOOLS.find(t => t[0] === st.tool);
  const hasE = st.comps.some(c => c.type === 'E');
  const canvasMode = mode === 'req' ? 'req' : kMethod;

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Física II · Circuitos de corriente directa</div>
        <h1>Resistencia equivalente y leyes de Kirchhoff</h1>
        <p className="lead">Dibuja el circuito con cables, resistencias y una fuente ε. Mira cómo se reduce a la resistencia equivalente que ve la fuente, y resuélvelo con las leyes de Kirchhoff (por mallas o por ramas), con las ecuaciones paso a paso.</p>
      </header>

      <div className="lab">
        <div className="stage-card">
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Qué mostrar en el dibujo">
              <button type="button" aria-pressed={mode === 'req'} onClick={() => setMode('req')}>Resistencia equivalente</button>
              <button type="button" aria-pressed={mode === 'k'} onClick={() => setMode('k')}>Kirchhoff ({kMethod === 'mesh' ? 'mallas' : 'ramas'})</button>
            </div>
            <div className="layers">
              <label><input type="checkbox" checked={showResults} onChange={e => setShowResults(e.target.checked)} /> Valores de I y V</label>
              <label><input type="checkbox" checked={showFlow} onChange={e => setShowFlow(e.target.checked)} /> Flujo de corriente</label>
              <button type="button" className="btn small" onClick={() => setAnimate(a => !a)}>{animate ? '❚❚ Pausar' : '▶ Animar'}</button>
            </div>
          </div>
          <div className="draw-area">
            <div className="palette" role="toolbar" aria-label="Herramientas">
              <div className="pal-group">
                <span className="pal-title">Circuito</span>
                {TOOLS.map(([k, name, icon, help]) => (
                  <button key={k} type="button" className="pal-btn" aria-pressed={st.tool === k} title={help}
                    disabled={k === 'E' && hasE} onClick={() => dispatch({ type: 'tool', tool: k })}>
                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{icon}</svg>
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </div>
            <CircuitCanvas comps={st.comps} an={an} tool={st.tool} sel={st.sel} mode={canvasMode} reqStep={reqStep}
              showResults={showResults} showFlow={showFlow} animate={animate} tokens={tokens}
              onCreate={c => dispatch({ type: 'create', c })} onSelect={id => dispatch({ type: 'select', id })} onDelete={id => dispatch({ type: 'delete', id })} />
          </div>
          <div className="legend tool-hint-bar">
            <span className="tool-hint"><b>{tool[1]}:</b> {st.tool === 'E' && hasE ? 'ya hay una fuente; para cambiarla, elimínala primero.' : tool[3]}</span>
          </div>
        </div>

        <aside>
          <div className="panel">
            <label htmlFor="cPreset"><h3>Circuito</h3></label>
            <select id="cPreset" value={st.presetKey} onChange={e => dispatch({ type: 'preset', key: e.target.value })}>
              {Object.entries(C_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
            <p className="hint">{preset.note}{st.dirty ? ' (modificado)' : ''}</p>
            <button type="button" className="btn small" onClick={() => dispatch({ type: 'clear' })}>Borrar todo</button>
          </div>

          <div className="panel">
            <h3>Elemento seleccionado</h3>
            <AnimatePresence mode="wait" initial={false}>
              {selC && selC.type !== 'W' ? (
                <motion.div key={selC.id} className="editor" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="row"><span>{selC.type === 'R' ? `Resistencia ${uName(selC.name)}` : 'Fuente ε'}</span></div>
                  <div className="coords">
                    <NumField id={`cv${selC.id}`} label={selC.type === 'R' ? 'R' : 'ε'} unit={selC.type === 'R' ? 'Ω' : 'V'} value={selC.value} min={selC.type === 'R' ? 0.1 : 0.1} max={10000} d={2}
                      onCommit={v => dispatch({ type: 'change', id: selC.id, patch: { value: v } })} />
                  </div>
                  <div className="btn-row">
                    {selC.type === 'E' && <button type="button" className="btn" onClick={() => dispatch({ type: 'flip', id: selC.id })}>⇄ Invertir polaridad</button>}
                    <button type="button" className="btn danger" onClick={() => dispatch({ type: 'delete', id: selC.id })}>Eliminar</button>
                  </div>
                </motion.div>
              ) : <motion.p key="none" className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Usa “Seleccionar” y toca una resistencia o la fuente para cambiar su valor.</motion.p>}
            </AnimatePresence>
          </div>

          <div className="panel">
            <h3>Resumen</h3>
            {an.ok ? <>
              <div className="row"><span>R<sub>eq</sub> vista por ε</span><b className="num">{nf(an.source.value / an.Itotal, 3)} Ω</b></div>
              <div className="row"><span>Corriente de la fuente</span><b className="num">{nf(an.Itotal, 4)} A</b></div>
              <div className="row"><span>Potencia entregada</span><b className="num">{nf(an.source.value * an.Itotal, 3)} W</b></div>
              <div className="row"><span>Mallas · ramas</span><b className="num">{an.meshes.length} · {an.branch.branches.length}</b></div>
              {!an.req.ok && <p className="hint">No se reduce solo con serie/paralelo: R_eq sale de ε/I con Kirchhoff.</p>}
            </> : an.msgs.map((m, i) => <p key={i} className="hint">{m}</p>)}
          </div>
        </aside>
      </div>

      <div className="results stack">
        <CircuitEquations an={an} kMethod={kMethod} setKMethod={m => { setKMethod(m); setMode('k'); }} reqStep={reqStep} setReqStep={v => { setReqStep(v); setMode('req'); }} />
      </div>
    </div>
  );
}
