import { motion } from 'framer-motion';
import { nf, wlabel } from '../../shared/format.js';

const SIZE = 300, PAD = 34;
const spring = { type: 'spring', stiffness: 260, damping: 30 };

/** Suma vectorial punta con cola de los aportes Bi en P; la resultante va del origen al final. */
export default function VectorSum({ parts, total }) {
  // recorrido punta con cola en µT
  const chain = [];
  let x = 0, y = 0;
  for (const p of parts) { chain.push({ ...p, x0: x, y0: y, x1: x + p.bx * 1e6, y1: y + p.by * 1e6 }); x += p.bx * 1e6; y += p.by * 1e6; }
  const xs = [0, ...chain.flatMap(c => [c.x0, c.x1])], ys = [0, ...chain.flatMap(c => [c.y0, c.y1])];
  const span = Math.max(1e-9, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const k = (SIZE - 2 * PAD) / span;
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const X = v => SIZE / 2 + (v - mx) * k, Y = v => SIZE / 2 - (v - my) * k;
  const tx = total.bx * 1e6, ty = total.by * 1e6, tm = Math.hypot(tx, ty);

  return (
    <figure className="vsum">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Suma vectorial de los aportes de cada alambre en P">
        <defs>
          {['out', 'in', 'probe'].map(c => (
            <marker key={c} id={`head-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`fill-${c}`} />
            </marker>
          ))}
        </defs>
        <line x1={X(0)} x2={X(0)} y1={8} y2={SIZE - 8} className="vs-axis" />
        <line x1={8} x2={SIZE - 8} y1={Y(0)} y2={Y(0)} className="vs-axis" />
        <text x={SIZE - 10} y={Y(0) - 6} textAnchor="end" className="vs-axis-label">Bx</text>
        <text x={X(0) + 6} y={16} className="vs-axis-label">By</text>
        {chain.map(c => (
          <g key={c.name}>
            <motion.line initial={false} animate={{ x1: X(c.x0), y1: Y(c.y0), x2: X(c.x1), y2: Y(c.y1) }} transition={spring}
              className={`vs-part stroke-${c.s > 0 ? 'out' : 'in'}`} markerEnd={`url(#head-${c.s > 0 ? 'out' : 'in'})`} />
            <motion.text initial={false} animate={{ x: (X(c.x0) + X(c.x1)) / 2 + 6, y: (Y(c.y0) + Y(c.y1)) / 2 - 6 }} transition={spring} className="vs-label">
              {wlabel(c.name)}
            </motion.text>
          </g>
        ))}
        {tm > 1e-6 && (
          <motion.line initial={false} animate={{ x1: X(0), y1: Y(0), x2: X(tx), y2: Y(ty) }} transition={spring}
            className="vs-total" markerEnd="url(#head-probe)" />
        )}
        <circle cx={X(0)} cy={Y(0)} r="4" className="fill-probe" />
      </svg>
      <figcaption>
        Cada flecha es el aporte <b>B</b><sub>i</sub> de un alambre, puesta a continuación de la anterior. La flecha dorada es la resultante en P: |<b>B</b>| = {nf(tm)} µT.
      </figcaption>
    </figure>
  );
}
