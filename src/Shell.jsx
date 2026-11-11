import { useEffect, useState } from 'react';
import AmpereApp from './ampere-law-sim/AmpereApp.jsx';
import BiotApp from './magnetic-field-sim/BiotApp.jsx';
import CircuitApp from './circuit-sim/CircuitApp.jsx';
import Home from './home/Home.jsx';

const SIMS = [
  ['ampere', 'Ley de Ampère', AmpereApp],
  ['biot-savart', 'Biot–Savart', BiotApp],
  ['circuitos', 'Circuitos', CircuitApp],
];
const fromHash = () => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace('#', '');
  return SIMS.some(s => s[0] === h) ? h : 'inicio';
};

/** Navegación entre simulaciones (por #hash, para que funcione como un solo archivo o en un sitio). */
export default function Shell() {
  const [cur, setCur] = useState(fromHash);
  useEffect(() => {
    const on = () => setCur(fromHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const go = k => {
    setCur(k);
    try { history.replaceState(null, '', k === 'inicio' ? location.pathname + location.search : `#${k}`); } catch { /* vista previa sin historial */ }
    scrollTo({ top: 0 });
  };
  const found = SIMS.find(s => s[0] === cur);
  return (
    <>
      <nav className="sim-nav" aria-label="Simulaciones">
        <div className="sim-nav-in">
          <button type="button" className="brand brand-btn" onClick={() => go('inicio')} aria-current={cur === 'inicio' ? 'page' : undefined}>Física II · Simulaciones</button>
          <div className="seg">
            {SIMS.map(([k, name]) => (
              <button key={k} type="button" aria-pressed={cur === k} onClick={() => go(k)}>{name}</button>
            ))}
          </div>
        </div>
      </nav>
      {found ? (() => { const Sim = found[2]; return <Sim key={cur} />; })() : <Home onGo={go} />}
    </>
  );
}
