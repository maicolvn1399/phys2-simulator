import { useEffect, useState } from 'react';

const NAMES = ['bg', 'surface', 'surface-2', 'line', 'fg', 'muted', 'field', 'out', 'in', 'probe', 'loop', 'grid'];

function read() {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(NAMES.map(n => [n.replace('-', ''), cs.getPropertyValue(`--${n}`).trim()]));
}

/** Lee los colores del tema (claro / oscuro) para dibujar en el canvas. */
export function useThemeTokens() {
  const [tokens, setTokens] = useState(read);
  useEffect(() => {
    const update = () => setTokens(read());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', update); mo.disconnect(); };
  }, []);
  return tokens;
}
