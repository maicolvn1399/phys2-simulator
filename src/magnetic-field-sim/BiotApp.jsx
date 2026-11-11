import { useCallback, useMemo, useReducer, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BiotCanvas from './BiotCanvas.jsx';
import BiotEquations from './BiotEquations.jsx';
import NumField from '../shared/NumField.jsx';
import Palette, { TOOL_INFO } from './Palette.jsx';
import { ICON } from './BiotEquations.jsx';
import { BS_PRESETS, withIds, newId } from './presets.js';
import { totalField, segCourse } from './physics.js';
import { useThemeTokens } from '../shared/useThemeTokens.js';
import { nf, vecText } from '../shared/format.js';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEG = Math.PI / 180;

function fromPreset(key) {
  const p = BS_PRESETS[key];
  const elements = withIds(p.elements);
  return { presetKey: key, dirty: false, elements, probe: { ...p.probe }, I: p.I, view: p.view, aLen: p.a || 0.05, sel: elements.length ? elements[Math.min(p.focus || 0, elements.length - 1)].id : null, tool: elements.length ? 'pick' : 'seg' };
}

function reducer(s, a) {
  const edit = patch => ({ ...s, ...patch, dirty: true });
  const map = (id, f) => s.elements.map(e => (e.id === id ? f(e) : e));
  switch (a.type) {
    case 'preset': return fromPreset(a.key);
    case 'select': return { ...s, sel: a.id };
    case 'tool': return { ...s, tool: a.tool };
    case 'view': return { ...s, view: a.v };
    case 'I': return edit({ I: a.I });
    case 'aLen': return { ...s, aLen: a.v };
    case 'probe': return edit({ probe: { ...s.probe, ...a.patch } });
    case 'create': { const e = { ...a.e, id: newId() }; return edit({ elements: [...s.elements, e], sel: e.id }); }
    case 'change': return edit({ elements: map(a.id, e => ({ ...e, ...a.patch })) });
    case 'reverse': return edit({ elements: map(a.id, e => (e.type === 'seg'
      ? { ...e, ax: e.bx, ay: e.by, bx: e.ax, by: e.ay, infA: e.infB, infB: e.infA }
      : e.type === 'poly' ? { ...e, pts: [...e.pts].reverse() }
      : { ...e, p1: e.p2, p2: e.p1 })) });
    case 'delete': {
      const els = s.elements.filter(e => e.id !== a.id);
      return edit({ elements: els, sel: els.length ? els[els.length - 1].id : null });
    }
    case 'clear': return edit({ elements: [], sel: null, tool: 'seg' });
    default: return s;
  }
}

const KIND = { seg: 'recto', arc: 'arco', poly: 'curva' };

export default function BiotApp() {
  const [st, dispatch] = useReducer(reducer, 'cuarto', fromPreset);
  const [animate, setAnimate] = useState(!reduceMotion);
  const [snap, setSnap] = useState(true);
  const [layers, setLayers] = useState({ map: true, geo: true, sweep: true });
  const [labelMode, setLabelMode] = useState('sym');
  const tokens = useThemeTokens();
  const { elements, probe, I, sel } = st;

  const { parts, B } = useMemo(() => totalField(elements, probe, I), [elements, probe, I]);
  // a = largo del primer tramo finito dibujado (o el radio, si es un arco)
  const aLen = useMemo(() => {
    for (const el of elements) {
      if (el.type === 'arc') return el.R;
      if (el.type === 'seg' && !el.infA && !el.infB) return Math.hypot(el.bx - el.ax, el.by - el.ay);
    }
    return 0.05;
  }, [elements]);
  const aSrc = elements.findIndex(el => el.type === 'arc' || (el.type === 'seg' && !el.infA && !el.infB));
  const [sumMode, setSumMode] = useState('sum');
  const preset = BS_PRESETS[st.presetKey];
  const selIdx = elements.findIndex(e => e.id === sel);
  const e = elements[selIdx];

  let check = null;
  if (preset.expected) {
    if (st.dirty) check = { kind: 'neutral', text: 'Configuración modificada: ya no se compara con el enunciado. Elige el escenario otra vez para restablecerla.' };
    else {
      const ex = preset.expected.B, err = Math.hypot(B[0] - ex[0], B[1] - ex[1], B[2] - ex[2]) / Math.hypot(...ex);
      check = { kind: err < 0.002 ? 'good' : 'warn', text: `${err < 0.002 ? '✓ Coincide con la respuesta' : '⚠ No coincide con la respuesta'}: ${preset.expected.text} (diferencia ${nf(err * 100, 2)} %)` };
    }
  }

  const cb = {
    onSelect: useCallback(id => dispatch({ type: 'select', id }), []),
    onChange: useCallback((id, patch) => dispatch({ type: 'change', id, patch }), []),
    onCreate: useCallback(el => dispatch({ type: 'create', e: el }), []),
    onProbe: useCallback(patch => dispatch({ type: 'probe', patch }), []),
    onDelete: useCallback(id => dispatch({ type: 'delete', id }), []),
  };
  const setLayer = k => ev => setLayers(l => ({ ...l, [k]: ev.target.checked }));
  const tool = TOOL_INFO[st.tool];
  const maxAbs = Math.max(1e-12, ...parts.map(p => Math.abs(p.B[2])), Math.abs(B[2]));

  const cmField = (id, label, value, onCommit, min = -60, max = 60) => (
    <NumField id={id} label={label} unit="cm" value={value * 100} min={min} max={max} onCommit={v => onCommit(v / 100)} />
  );

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Física II · Ley de Biot–Savart</div>
        <h1>Campo magnético de alambres con forma</h1>
        <p className="lead">Dibuja tramos rectos y arcos, elige el sentido de la corriente y coloca P. Cada tramo se integra con Biot–Savart; las integrales, sus límites, el producto cruz y los ángulos se actualizan con cada cambio.</p>
      </header>

      <div className="lab">
        <div className="stage-card">
          <div className="toolbar">
            <div className="layers">
              <div className="mini-seg" role="group" aria-label="Zoom">
                {[[0.1, '±10'], [0.2, '±20'], [0.5, '±50 cm']].map(([v, t]) => (
                  <button key={v} type="button" aria-pressed={st.view === v} onClick={() => dispatch({ type: 'view', v })}>{t}</button>
                ))}
              </div>
              <label><input type="checkbox" checked={snap} onChange={ev => setSnap(ev.target.checked)} /> Ajustar (0,5 cm · 15°)</label>
              <button type="button" className="btn small" onClick={() => setAnimate(a => !a)}>{animate ? '❚❚ Pausar' : '▶ Animar'}</button>
            </div>
          </div>
          <div className="toolbar sub">
            <div className="layers">
              <label><input type="checkbox" checked={layers.map} onChange={setLayer('map')} /> Mapa de B en el plano</label>
              <label><input type="checkbox" checked={layers.geo} onChange={setLayer('geo')} /> Geometría (triángulo, θ, Δφ)</label>
              <label><input type="checkbox" checked={layers.sweep} onChange={setLayer('sweep')} /> Recorrido de dl</label>
            </div>
            <div className="layers">
              <span>Etiquetas:</span>
              <div className="mini-seg" role="group" aria-label="Tipo de etiquetas en el plano">
                <button type="button" aria-pressed={labelMode === 'num'} onClick={() => setLabelMode('num')}>Números</button>
                <button type="button" aria-pressed={labelMode === 'sym'} onClick={() => setLabelMode('sym')}>Variables</button>
              </div>
            </div>
          </div>

          <div className="draw-area">
            <Palette tool={st.tool} onTool={t => dispatch({ type: 'tool', tool: t })} />
            <BiotCanvas elements={elements} probe={probe} I={I} sel={sel} tool={st.tool} snap={snap} animate={animate}
              view={st.view} tokens={tokens} layers={layers} labelMode={labelMode} aLen={aLen} {...cb} />
          </div>

          <div className="legend tool-hint-bar">
            <span className="tool-hint"><b>{tool[0]}:</b> {tool[1]}</span>
          </div>
          <div className="legend">
            <span><span className="sym out">⊙</span> B sale (+k̂)</span>
            <span><span className="sym in">⊗</span> B entra (−k̂)</span>
            <span><i className="dot-key" /> cargas: sentido de I</span>
            <span><i className="key key-field" /> dl</span>
            <span><i className="key key-loop" /> r̂ y r (de dl hacia P)</span>
            <span><i className="key key-probe" /> triángulo y ángulos</span>
          </div>
        </div>

        <aside>
          <div className="panel">
            <label htmlFor="bsPreset"><h3>Escenario</h3></label>
            <select id="bsPreset" value={st.presetKey} onChange={ev => dispatch({ type: 'preset', key: ev.target.value })}>
              {Object.entries(BS_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
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
            <div className="coords three">
              {cmField('bpx', 'x', probe.x, x => dispatch({ type: 'probe', patch: { x } }))}
              {cmField('bpy', 'y', probe.y, y => dispatch({ type: 'probe', patch: { y } }))}
              {cmField('bpz', 'z', probe.z, z => dispatch({ type: 'probe', patch: { z } }), -30, 30)}
            </div>
            <label className="row" htmlFor="bpzr"><span>Altura z (fuera del plano)</span><output className="num">{nf(probe.z * 100, 1)} cm</output></label>
            <input id="bpzr" type="range" min="-20" max="20" step="0.5" value={probe.z * 100} onChange={ev => dispatch({ type: 'probe', patch: { z: Number(ev.target.value) / 100 } })} />
            <div className="row"><span>|B| en P</span><b className="num">{nf(Math.hypot(...B) * 1e6)} µT</b></div>
          </div>

          <div className="panel">
            <div className="row"><h3>Longitud a</h3><b className="num">a = {nf(aLen * 100, 1)} cm</b></div>
            <p className="hint">{aSrc >= 0 ? `Se toma del tramo ${aSrc + 1}: ${elements[aSrc].type === 'arc' ? 'su radio R' : 'su largo'}. Las posiciones se escriben como múltiplos de a (por ejemplo P = (a; a/2)) y los resultados salen en términos de a, como en los exámenes.` : 'Se tomará del primer tramo que dibujes (su largo, o el radio si es un arco).'}</p>
          </div>

          <div className="panel">
            <label className="row" htmlFor="bsI"><h3>Corriente</h3><output className="num">I = {nf(I, 1)} A</output></label>
            <input id="bsI" type="range" min="0.5" max="20" step="0.5" value={I} onChange={ev => dispatch({ type: 'I', I: Number(ev.target.value) })} />
            <p className="hint">La misma corriente recorre todos los tramos (un solo circuito).</p>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Tramos</h3>
              <button type="button" className="btn small" onClick={() => dispatch({ type: 'clear' })} disabled={!elements.length}>Borrar todo</button>
            </div>
            <motion.div className="chips" layout>
              <AnimatePresence initial={false}>
                {elements.map((el, i) => (
                  <motion.button layout key={el.id} type="button" className="chip" aria-pressed={el.id === sel}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => dispatch({ type: 'select', id: el.id })}>
                    <span className="tool-ico">{ICON[el.type]}</span> {i + 1} · {KIND[el.type]}
                  </motion.button>
                ))}
              </AnimatePresence>
            </motion.div>
            {!elements.length && <p className="hint">Usa las herramientas Recto o Arco para dibujar.</p>}
            <AnimatePresence mode="wait" initial={false}>
              {e && (
                <motion.div key={`ed-${e.id}`} className="editor" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <div className="row"><span>Tramo <b>{selIdx + 1}</b> · {KIND[e.type]}</span></div>
                  {e.type === 'poly' ? (
                    <p className="hint">Curva dibujada a mano con {e.pts.length - 1} tramos rectos, de ({nf(e.pts[0][0] * 100, 1)}; {nf(e.pts[0][1] * 100, 1)}) cm a ({nf(e.pts[e.pts.length - 1][0] * 100, 1)}; {nf(e.pts[e.pts.length - 1][1] * 100, 1)}) cm. Arrástrala para moverla o mueve sus extremos.</p>
                  ) : e.type === 'seg' ? (
                    <>
                      <span className="field-label">Inicio Q₁</span>
                      <div className="coords">
                        {cmField(`ax${e.id}`, 'x', e.ax, v => cb.onChange(e.id, { ax: v }))}
                        {cmField(`ay${e.id}`, 'y', e.ay, v => cb.onChange(e.id, { ay: v }))}
                      </div>
                      <span className="field-label">Final Q₂</span>
                      <div className="coords">
                        {cmField(`bx${e.id}`, 'x', e.bx, v => cb.onChange(e.id, { bx: v }))}
                        {cmField(`by${e.id}`, 'y', e.by, v => cb.onChange(e.id, { by: v }))}
                      </div>
                      <label className="check-row"><input type="checkbox" checked={e.infA} onChange={ev => cb.onChange(e.id, { infA: ev.target.checked })} /> Viene desde el infinito (antes de Q₁)</label>
                      <label className="check-row"><input type="checkbox" checked={e.infB} onChange={ev => cb.onChange(e.id, { infB: ev.target.checked })} /> Sigue hasta el infinito (después de Q₂)</label>
                    </>
                  ) : (
                    <>
                      <span className="field-label">Centro C y radio</span>
                      <div className="coords three">
                        {cmField(`cx${e.id}`, 'x', e.cx, v => cb.onChange(e.id, { cx: v }))}
                        {cmField(`cy${e.id}`, 'y', e.cy, v => cb.onChange(e.id, { cy: v }))}
                        {cmField(`r${e.id}`, 'R', e.R, v => cb.onChange(e.id, { R: v }), 0.2, 60)}
                      </div>
                      <span className="field-label">Ángulos (desde +x, antihorario positivo)</span>
                      <div className="coords">
                        <NumField id={`p1${e.id}`} label="φ₁" unit="°" value={e.p1 / DEG} min={-720} max={720} onCommit={v => cb.onChange(e.id, { p1: v * DEG })} />
                        <NumField id={`p2${e.id}`} label="φ₂" unit="°" value={e.p2 / DEG} min={-720} max={720} onCommit={v => cb.onChange(e.id, { p2: v * DEG })} />
                      </div>
                      <p className="hint">Δφ = {nf((e.p2 - e.p1) / DEG, 1)}° = {nf(e.p2 - e.p1, 3)} rad · {e.p2 > e.p1 ? 'antihorario' : 'horario'}</p>
                    </>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn" onClick={() => dispatch({ type: 'reverse', id: e.id })}>⇄ Invertir corriente</button>
                    <button type="button" className="btn danger" onClick={() => dispatch({ type: 'delete', id: e.id })}>Eliminar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      <div className="results stack">
        <BiotEquations elements={elements} probe={probe} I={I} parts={parts} B={B} focus={sel} onFocus={cb.onSelect} aLen={aLen} sumMode={sumMode} onSumMode={setSumMode} />
        <section className="sheet" aria-labelledby="bsSumTitle">
          <div className="sheet-head"><h2 id="bsSumTitle">Aporte de cada tramo</h2></div>
          <div className="contrib">
          <div className="bars" role="list">
            {parts.map((p, i) => {
              const v = p.B[2], w = (Math.abs(v) / maxAbs) * 50;
              return (
                <button key={elements[i].id} type="button" role="listitem" className={`bar-row ${elements[i].id === sel ? 'sel' : ''}`} onClick={() => dispatch({ type: 'select', id: elements[i].id })}>
                  <span className="bar-name">{i + 1} {ICON[elements[i].type]}</span>
                  <span className="bar-track">
                    <span className="bar-axis" />
                    <motion.span className={`bar ${v >= 0 ? 'pos' : 'neg'}`} initial={false}
                      animate={{ width: `${w}%`, left: v >= 0 ? '50%' : `${50 - w}%` }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
                  </span>
                  <span className="bar-val num">{p.singular ? '—' : `${nf(v * 1e6)} µT`}</span>
                </button>
              );
            })}
            <div className="bar-row total">
              <span className="bar-name">Total</span>
              <span className="bar-track">
                <span className="bar-axis" />
                <motion.span className={`bar ${B[2] >= 0 ? 'pos' : 'neg'} strong`} initial={false}
                  animate={{ width: `${(Math.abs(B[2]) / maxAbs) * 50}%`, left: B[2] >= 0 ? '50%' : `${50 - (Math.abs(B[2]) / maxAbs) * 50}%` }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
              </span>
              <span className="bar-val num">{nf(B[2] * 1e6)} µT</span>
            </div>
            <p className="bars-caption">Componente B<sub>z</sub> de cada tramo en P (a la derecha sale ⊙, a la izquierda entra ⊗).</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tramo</th><th>Límites</th><th>B<sub>x</sub> (µT)</th><th>B<sub>y</sub> (µT)</th><th>B<sub>z</sub> (µT)</th></tr></thead>
              <tbody>
                {parts.map((p, i) => {
                  const el = elements[i];
                  const limits = el.type === 'poly' ? `${p.N} piezas rectas` : el.type === 'seg'
                    ? (p.onLine ? 'P en la recta' : (() => { const c = segCourse(el, p, probe), f = v => (Number.isFinite(v) ? nf(v * 100, 1) : v > 0 ? '∞' : '−∞'); return `${c.axis}: ${f(c.qlo)} → ${f(c.qhi)} cm`; })())
                    : `|Δφ| = ${nf(Math.abs(el.p2 - el.p1) / DEG, 0)}°`;
                  return (
                    <tr key={el.id} className={el.id === sel ? 'sel' : ''} onClick={() => dispatch({ type: 'select', id: el.id })}>
                      <td>{i + 1} · {KIND[el.type]}</td>
                      <td>{limits}</td>
                      <td>{nf(p.B[0] * 1e6)}</td><td>{nf(p.B[1] * 1e6)}</td><td>{nf(p.B[2] * 1e6)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td>Total en P</td><td /><td>{nf(B[0] * 1e6)}</td><td>{nf(B[1] * 1e6)}</td><td>{nf(B[2] * 1e6)}</td></tr></tfoot>
            </table>
          </div>
          </div>
          <p className="result-line">B<sub>P</sub> = {vecText(B)} T</p>
          <p className="foot">Modelo: alambres delgados en el plano z = 0, en el vacío, μ₀ = 4π × 10⁻⁷ T·m/A. Tramos rectos: desde dl se arma el triángulo con P; sen θ = cateto opuesto / hipotenusa, con θ el ángulo entre dl y r̂ (sen(π − θ) = sen θ), y se integra en x o y. Arcos con P en el centro: θ = 90° y B = μ₀I|Δφ|/(4πR), con Δφ en radianes. En otros puntos el arco se integra numéricamente.</p>
        </section>
      </div>
    </div>
  );
}
