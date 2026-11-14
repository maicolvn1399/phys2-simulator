import './chart.css';
import { nf } from './format.js';

const W = 520, H = 214, M = { l: 62, r: 18, t: 14, b: 40 };

function niceStep(span, target) {
  const raw = span / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
function ticks(lo, hi, target = 5) {
  if (!(hi - lo > 1e-300)) return { vals: [lo], step: 1 };
  const step = niceStep(hi - lo, target), vals = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) vals.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { vals, step };
}
const decimals = step => Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));

/**
 * Gráfica de línea en SVG.
 * series: [{ pts: [[x, y], …], cls: 'c1' | 'c2' | 'c3' | 'c4' | 'ref' }]
 * cursor: x donde va la línea vertical; dots: [{ x, y, cls }]; vlines / hlines: [{ x | y, label }]
 */
export default function LineChart({ title, sub, series, xDomain, yDomain, xLabel, yLabel, cursor, dots = [], vlines = [], hlines = [] }) {
  const [x0, x1] = xDomain;
  let y0, y1;
  if (yDomain) [y0, y1] = yDomain;
  else {
    let lo = 0, hi = 0;
    for (const s of series) for (const [, y] of s.pts) { if (y < lo) lo = y; if (y > hi) hi = y; }
    if (hi - lo < 1e-300) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1;
    y0 = lo < 0 ? lo - pad : 0; y1 = hi > 0 ? hi + pad : 0;
    if (y0 === 0 && y1 === 0) { y0 = -1; y1 = 1; }
  }
  const X = x => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const Y = y => M.t + (1 - (y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const tx = ticks(x0, x1, 6), ty = ticks(y0, y1, 4);
  const dx = decimals(tx.step), dy = decimals(ty.step);
  const path = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');

  return (
    <figure>
      <figcaption><b>{title}</b>{sub && <span>{sub}</span>}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}${sub ? ': ' + sub : ''}`}>
        <g className="axis">
          {ty.vals.map(v => (
            <g key={`y${v}`}>
              <line className="gridline" x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} />
              <text x={M.l - 7} y={Y(v) + 4} textAnchor="end">{nf(v, dy)}</text>
            </g>
          ))}
          {tx.vals.map(v => (
            <text key={`x${v}`} x={X(v)} y={H - M.b + 16} textAnchor="middle">{nf(v, dx)}</text>
          ))}
        </g>
        {y0 < 0 && y1 > 0 && <line className="zero" x1={M.l} x2={W - M.r} y1={Y(0)} y2={Y(0)} />}
        <line className="zero" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />
        {hlines.map(h => (
          <g key={`h${h.y}`}>
            <line className="target" x1={M.l} x2={W - M.r} y1={Y(h.y)} y2={Y(h.y)} />
            {h.label && <text className="chart-label loop" x={W - M.r - 4} y={Y(h.y) - 5} textAnchor="end">{h.label}</text>}
          </g>
        ))}
        {vlines.map(v => (
          <g key={`v${v.x}`}>
            <line className="target" x1={X(v.x)} x2={X(v.x)} y1={M.t} y2={H - M.b} />
            {v.label && <text className="chart-label loop" x={X(v.x) + 5} y={M.t + 10}>{v.label}</text>}
          </g>
        ))}
        {series.map((s, i) => <path key={i} className={`series ${s.cls || 'c1'}`} d={path(s.pts)} />)}
        {cursor != null && <line className="cursor" x1={X(cursor)} x2={X(cursor)} y1={M.t} y2={H - M.b} />}
        {dots.map((d, i) => <circle key={i} className={`dot ${d.cls || 'c1'}`} cx={X(d.x)} cy={Y(d.y)} r="5" />)}
        <text className="chart-label" x={W - M.r} y={H - 4} textAnchor="end">{xLabel}</text>
        <text className="chart-label strong" x={M.l} y={M.t - 4}>{yLabel}</text>
      </svg>
    </figure>
  );
}
