import { useCallback, useMemo, useReducer, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import FieldCanvas from './components/FieldCanvas.jsx';
import EquationPanel from './components/EquationPanel.jsx';
import VectorSum from './components/VectorSum.jsx';
import CoordInput from './components/CoordInput.jsx';
import { PRESETS, clone } from './presets.js';
import { contrib, fieldAt } from './physics/field.js';
import { useThemeTokens } from '../shared/useThemeTokens.js';
import { nf, vecText, wlabel } from '../shared/format.js';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function fromPreset(key) {
  const p = PRESETS[key];
  return { presetKey: key, dirty: false, wires: clone(p.wires), probe: clone(p.probe), sel: 0, view: p.view || 0.2 };
}

function reducer(s, a) {
  const edit = patch => ({ ...s, ...patch, dirty: true });
  switch (a.type) {
    case 'preset': return fromPreset(a.key);
    case 'select': return { ...s, sel: a.i };
    case 'view': return { ...s, view: a.v };
    case 'setWire': return edit({ wires: s.wires.map((w, i) => (i === a.i ? { ...w, ...a.patch } : w)) });
    case 'toggleWire': return edit({ wires: s.wires.map((w, i) => (i === a.i ? { ...w, s: -w.s } : w)), sel: a.i });
    case 'probe': return edit({ probe: { ...s.probe, ...a.patch } });
    case 'addWire': {
      if (s.wires.length >= 8) return s;
      const used = new Set(s.wires.map(w => w.name));
      const numeric = s.wires.length > 0 && s.wires.every(w => /^\d+$/.test(w.name));
      const name = numeric ? String([1,2,3,4,5,6,7,8,9].find(k => !used.has(String(k)))) : [...'ABCDEFGHIJKL'].find(c => !used.has(c));
      let best = null;
      for (let k = 0; k < 60; k++) {
        const x = Math.round((Math.random() * 2 - 1) * 30) / 200, y = Math.round((Math.random() * 2 - 1) * 30) / 200;
        const d = Math.min(1, Math.hypot(s.probe.x - x, s.probe.y - y), ...s.wires.map(w => Math.hypot(w.x - x, w.y - y)));
        if (!best || d > best.d) best = { x, y, d };
      }
      return edit({ wires: [...s.wires, { x: best.x, y: best.y, I: 4, s: 1, name }], sel: s.wires.length });
    }
    case 'delWire': return edit({ wires: s.wires.filter((_, i) => i !== a.i), sel: Math.max(0, Math.min(s.sel, s.wires.length - 2)) });
    default: return s;
  }
}

export default function App() {
  const [st, dispatch] = useReducer(reducer, 'cuadrado', fromPreset);
  const [animate, setAnimate] = useState(!reduceMotion);
  const [snap, setSnap] = useState(true);
  const [layers, setLayers] = useState({ arrows: true, lines: true, ampere: true, parts: true });
  const tokens = useThemeTokens();

  const { wires, probe, sel } = st;
  const parts = useMemo(() => wires.map(w => ({ ...contrib(w, probe.x, probe.y), name: w.name, s: w.s })), [wires, probe]);
  const total = useMemo(() => fieldAt(wires, probe.x, probe.y), [wires, probe]);
  const preset = PRESETS[st.presetKey];
  const w = wires[sel];

  let check = null;
  if (preset.expected) {
    if (st.dirty) check = { kind: 'neutral', text: 'Configuración modificada: ya no se compara con el enunciado. Elige el escenario otra vez para restablecerla.' };
    else {
      const e = preset.expected, err = Math.hypot(total.bx - e.bx, total.by - e.by) / Math.hypot(e.bx, e.by);
      check = { kind: err < 0.005 ? 'good' : 'warn', text: `${err < 0.005 ? '✓ Coincide con el enunciado' : '⚠ No coincide con el enunciado'}: ${e.text} (diferencia ${nf(err * 100, 2)} %)` };
    }
  }

  const onSelect = useCallback(i => dispatch({ type: 'select', i }), []);
  const onWireMove = useCallback((i, x, y) => dispatch({ type: 'setWire', i, patch: { x, y } }), []);
  const onWireToggle = useCallback(i => dispatch({ type: 'toggleWire', i }), []);
  const onProbeMove = useCallback((x, y) => dispatch({ type: 'probe', patch: { x, y } }), []);
  const setLayer = k => e => setLayers(l => ({ ...l, [k]: e.target.checked }));

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Física II · Ley de Ampère y superposición</div>
        <h1>Laboratorio de campo magnético</h1>
        <p className="lead">Coloca alambres con corriente y un punto P. Cada alambre aporta un campo que se obtiene con la ley de Ampère; en P esos aportes se suman como vectores. Las ecuaciones de abajo cambian con cada movimiento.</p>
      </header>

      <div className="lab">
        <div className="stage-card">
          <div className="toolbar">
            <div className="layers">
              <label><input type="checkbox" id="lyArrows" checked={layers.arrows} onChange={setLayer('arrows')} /> Vectores B</label>
              <label><input type="checkbox" id="lyLines" checked={layers.lines} onChange={setLayer('lines')} /> Líneas de campo</label>
              <label><input type="checkbox" id="lyAmpere" checked={layers.ampere} onChange={setLayer('ampere')} /> Círculo de Ampère</label>
              <label><input type="checkbox" id="lyParts" checked={layers.parts} onChange={setLayer('parts')} /> Aportes en P</label>
            </div>
            <div className="layers">
              <div className="mini-seg" role="group" aria-label="Zoom">
                {[[0.2, '±20 cm'], [0.1, '±10 cm']].map(([v, t]) => (
                  <button key={v} type="button" aria-pressed={st.view === v} onClick={() => dispatch({ type: 'view', v })}>{t}</button>
                ))}
              </div>
              <label><input type="checkbox" id="snap" checked={snap} onChange={e => setSnap(e.target.checked)} /> Ajustar a 0,5 cm</label>
              <button type="button" className="btn small" aria-pressed={animate} onClick={() => setAnimate(a => !a)}>{animate ? '❚❚ Pausar' : '▶ Animar'}</button>
            </div>
          </div>

          <FieldCanvas view={st.view} wires={wires} probe={probe} sel={sel} tokens={tokens} layers={layers} snap={snap} animate={animate}
            onSelect={onSelect} onWireMove={onWireMove} onWireToggle={onWireToggle} onProbeMove={onProbeMove} />

          <div className="legend">
            <span><span className="sym out">⊙</span> corriente sale (+z)</span>
            <span><span className="sym in">⊗</span> corriente entra (−z)</span>
            <span><i className="key key-field" /> líneas de campo</span>
            <span><i className="key key-loop" /> círculo de Ampère del alambre elegido</span>
            <span><i className="key key-probe" /> B total en P</span>
            <span className="muted">Arrastra alambres y P · toca un alambre para invertir su corriente</span>
          </div>
        </div>

        <aside>
          <div className="panel">
            <label htmlFor="preset"><h3>Escenario</h3></label>
            <select id="preset" value={st.presetKey} onChange={e => dispatch({ type: 'preset', key: e.target.value })}>
              {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
            <p className="hint">{preset.note}{st.dirty ? ' (modificado)' : ''}</p>
            <AnimatePresence mode="wait">
              {check && (
                <motion.div key={check.text} className={`check ${check.kind}`} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {check.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="panel">
            <h3>Punto P</h3>
            <div className="coords">
              <CoordInput id="px" label="x" value={probe.x} onCommit={x => dispatch({ type: 'probe', patch: { x } })} />
              <CoordInput id="py" label="y" value={probe.y} onCommit={y => dispatch({ type: 'probe', patch: { y } })} />
            </div>
            <div className="row"><span>|B| en P</span><b className="num">{nf(Math.hypot(total.bx, total.by) * 1e6)} µT</b></div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Alambres</h3>
              <button type="button" className="btn small" onClick={() => dispatch({ type: 'addWire' })} disabled={wires.length >= 8}>+ Agregar</button>
            </div>
            <motion.div className="chips" layout>
              <AnimatePresence initial={false}>
                {wires.map((wi, i) => (
                  <motion.button layout key={wi.name} type="button" className="chip" aria-pressed={i === sel}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => dispatch({ type: 'select', i })}>
                    <span className={`sym ${wi.s > 0 ? 'out' : 'in'}`}>{wi.s > 0 ? '⊙' : '⊗'}</span>
                    {wlabel(wi.name)} · {nf(wi.I, 1)} A
                  </motion.button>
                ))}
              </AnimatePresence>
            </motion.div>
            <AnimatePresence mode="wait" initial={false}>
              {w && (
                <motion.div key={`ed-${w.name}`} className="editor" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <div className="row"><span>Alambre <b>{wlabel(w.name)}</b></span></div>
                  <div className="coords">
                    <CoordInput id={`wx-${w.name}`} label="x" value={w.x} onCommit={x => dispatch({ type: 'setWire', i: sel, patch: { x } })} />
                    <CoordInput id={`wy-${w.name}`} label="y" value={w.y} onCommit={y => dispatch({ type: 'setWire', i: sel, patch: { y } })} />
                  </div>
                  <div className="seg full" role="group" aria-label="Sentido de la corriente">
                    <button type="button" aria-pressed={w.s > 0} onClick={() => dispatch({ type: 'setWire', i: sel, patch: { s: 1 } })}><span className="sym out">⊙</span> Sale</button>
                    <button type="button" aria-pressed={w.s < 0} onClick={() => dispatch({ type: 'setWire', i: sel, patch: { s: -1 } })}><span className="sym in">⊗</span> Entra</button>
                  </div>
                  <label className="row" htmlFor="cur"><span>Corriente</span><output className="num">{nf(w.I, 1)} A</output></label>
                  <input id="cur" type="range" min="0.5" max="20" step="0.5" value={w.I} onChange={e => dispatch({ type: 'setWire', i: sel, patch: { I: Number(e.target.value) } })} />
                  <button type="button" className="btn danger" onClick={() => dispatch({ type: 'delWire', i: sel })}>Eliminar alambre</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <div className="results">
        <EquationPanel wires={wires} probe={probe} parts={parts} total={total} focus={Math.min(sel, wires.length - 1)} onFocus={onSelect} />
        <section className="sheet" aria-labelledby="sumTitle">
          <div className="sheet-head"><h2 id="sumTitle">Suma vectorial en P</h2></div>
          <VectorSum parts={parts.filter(p => !p.onWire)} total={total} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alambre</th><th>Posición (cm)</th><th>I (A)</th><th>r (cm)</th><th>|B<sub>i</sub>| (µT)</th><th>B<sub>x</sub> (µT)</th><th>B<sub>y</sub> (µT)</th></tr></thead>
              <tbody>
                {wires.map((wi, i) => {
                  const c = parts[i];
                  return (
                    <tr key={wi.name} className={i === sel ? 'sel' : ''} onClick={() => dispatch({ type: 'select', i })}>
                      <td><span className={`sym ${wi.s > 0 ? 'out' : 'in'}`}>{wi.s > 0 ? '⊙' : '⊗'}</span> {wlabel(wi.name)}</td>
                      <td>({nf(wi.x * 100, 1)}; {nf(wi.y * 100, 1)})</td>
                      <td>{nf(wi.I, 1)}</td>
                      <td>{c.onWire ? '—' : nf(c.r * 100, 2)}</td>
                      <td>{c.onWire ? '—' : nf(c.mag * 1e6)}</td>
                      <td>{nf(c.bx * 1e6)}</td>
                      <td>{nf(c.by * 1e6)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td>Total en P</td><td /><td /><td /><td>{nf(Math.hypot(total.bx, total.by) * 1e6)}</td><td>{nf(total.bx * 1e6)}</td><td>{nf(total.by * 1e6)}</td></tr></tfoot>
            </table>
          </div>
          <p className="result-line">B<sub>P</sub> = {vecText([total.bx, total.by])} T</p>
          <p className="foot">Modelo: alambres rectos e infinitamente largos, paralelos al eje z, en el vacío, con μ₀ = 4π × 10⁻⁷ T·m/A. Para cada alambre, la ley de Ampère sobre un círculo de radio r centrado en él da B = μ₀I ⁄ (2πr), tangente al círculo. En P se suman los aportes de todos los alambres.</p>
        </section>
      </div>
    </div>
  );
}
