import { useEffect, useMemo, useRef, useState } from 'react';
import FieldCanvas from '../ampere-law-sim/components/FieldCanvas.jsx';
import BiotCanvas from '../magnetic-field-sim/BiotCanvas.jsx';
import CircuitCanvas from '../circuit-sim/CircuitCanvas.jsx';
import { PRESETS, clone } from '../ampere-law-sim/presets.js';
import { BS_PRESETS, withIds } from '../magnetic-field-sim/presets.js';
import { C_PRESETS, withNames } from '../circuit-sim/presets.js';
import { analyze } from '../circuit-sim/model.js';
import { useThemeTokens } from '../shared/useThemeTokens.js';

const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// en pantallas táctiles no hay hover: las vistas previas se animan solas
const noHover = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;
const noop = () => {};
const BASE_W = 600, BASE_H = 400;   // tamaño "real" del lienzo; se escala para caber en la tarjeta

/* ---------- vistas previas: los mismos lienzos de cada simulación, con su ejemplo inicial ---------- */
function AmperePreview({ on, tokens }) {
  const p = PRESETS.cuadrado;
  const wires = useMemo(() => clone(p.wires), [p]);
  const probe = useMemo(() => clone(p.probe), [p]);
  return <FieldCanvas view={p.view || 0.2} wires={wires} probe={probe} sel={0} tokens={tokens} snap animate={on}
    layers={{ arrows: true, lines: true, ampere: true, parts: true }}
    onSelect={noop} onWireMove={noop} onWireToggle={noop} onProbeMove={noop} />;
}

function BiotPreview({ on, tokens }) {
  const p = BS_PRESETS.examen;
  const elements = useMemo(() => withIds(p.elements), [p]);
  const aLen = useMemo(() => {
    for (const el of elements) {
      if (el.type === 'arc') return el.R;
      if (el.type === 'seg' && !el.infA && !el.infB) return Math.hypot(el.bx - el.ax, el.by - el.ay);
    }
    return 0.05;
  }, [elements]);
  const sel = elements.length ? elements[Math.min(p.focus || 0, elements.length - 1)].id : null;
  return <BiotCanvas elements={elements} probe={p.probe} I={p.I} sel={sel} tool="pick" snap animate={on}
    view={p.view} tokens={tokens} layers={{ map: true, geo: true, sweep: true }} labelMode="sym" aLen={aLen}
    onSelect={noop} onChange={noop} onCreate={noop} onProbe={noop} onDelete={noop} />;
}

function CircuitPreview({ on, tokens }) {
  const comps = useMemo(() => withNames(C_PRESETS.mixto.comps), []);
  const an = useMemo(() => analyze(comps), [comps]);
  const N = an.req ? an.req.steps.length : 0;
  const [step, setStep] = useState(0);
  // al pasar el mouse: corriente circulando, luego la reducción a R_eq (se contrae) y de vuelta (se expande)
  useEffect(() => {
    if (!on) { setStep(0); return; }
    const seq = [0, 0, ...Array.from({ length: N }, (_, i) => i + 1), N, ...Array.from({ length: N }, (_, i) => N - 1 - i)];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % seq.length; setStep(seq[i]); }, 1300);
    return () => clearInterval(id);
  }, [on, N]);
  return <CircuitCanvas comps={comps} an={an} tool="pick" sel={null} mode="req" reqStep={step}
    showResults showFlow animate={on} tokens={tokens} onCreate={noop} onSelect={noop} onDelete={noop} />;
}

const CARDS = [
  ['ampere', 'Ley de Ampère', 'Coloca alambres con corriente y un punto P: cada alambre aporta su campo por la ley de Ampère y en P se suman como vectores.', AmperePreview],
  ['biot-savart', 'Biot–Savart', 'Dibuja alambres rectos, inclinados y arcos como en Paint, coloca P y obtén B con la integral paso a paso, simbólica y numérica.', BiotPreview],
  ['circuitos', 'Circuitos', 'Arma circuitos con resistencias y una fuente ε, mira cómo se reducen a R_eq y resuélvelos con Kirchhoff por mallas o por ramas.', CircuitPreview],
];

function Scaled({ children }) {
  const ref = useRef(null);
  const [k, setK] = useState(0.5);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setK(e.contentRect.width / BASE_W));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="home-preview" ref={ref} aria-hidden="true">
      <div className="home-preview-in" style={{ width: BASE_W, height: BASE_H, transform: `scale(${k})` }}>{children}</div>
    </div>
  );
}

function Card({ id, name, desc, Preview, onGo, tokens }) {
  const [hover, setHover] = useState(false);
  const on = (hover || noHover) && !reduceMotion;
  return (
    <a className="home-card" href={`#${id}`} onClick={e => { e.preventDefault(); onGo(id); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
      <Scaled><Preview on={on} tokens={tokens} /></Scaled>
      <div className="home-card-body">
        <h2>{name}</h2>
        <p>{desc}</p>
        <span className="home-go">Abrir simulación →</span>
      </div>
    </a>
  );
}

/** Página principal: tarjetas de las simulaciones; al pasar el mouse se anima su lienzo real. */
export default function Home({ onGo }) {
  const tokens = useThemeTokens();
  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Física II · FI-1102 · TEC</div>
        <h1>Simulaciones de electromagnetismo y circuitos</h1>
        <p className="lead">Herramientas interactivas para resolver los ejercicios del curso: se dibuja el problema y se ven las ecuaciones paso a paso. Pasa el mouse por una tarjeta para ver cada simulación en acción.</p>
      </header>
      <div className="home-grid">
        {CARDS.map(([id, name, desc, Preview]) => <Card key={id} id={id} name={name} desc={desc} Preview={Preview} onGo={onGo} tokens={tokens} />)}
      </div>
    </div>
  );
}
