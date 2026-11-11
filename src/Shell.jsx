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
/** Tema actual: el guardado por el usuario o, si no hay, el del sistema. */
const currentTheme = () => {
  const a = document.documentElement.getAttribute('data-theme');
  if (a) return a;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
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
  const [theme, setTheme] = useState(currentTheme);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* sin almacenamiento */ }
    setTheme(next);
  };
  return (
    <>
      <nav className="sim-nav" aria-label="Simulaciones">
        <div className="sim-nav-in">
          <div className="nav-left">
          <button type="button" className="brand brand-btn" onClick={() => go('inicio')} aria-current={cur === 'inicio' ? 'page' : undefined}>physics2 <b>simulator</b></button>
          {found && <span className="crumb">/ {found[1]}</span>}
          </div>
          <div className="nav-right">
            <button type="button" className="theme-btn" onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              {theme === 'dark'
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>}
            </button>
          </div>
        </div>
      </nav>
      {found ? (() => { const Sim = found[2]; return <Sim key={cur} />; })() : <Home onGo={go} />}
    </>
  );
}
