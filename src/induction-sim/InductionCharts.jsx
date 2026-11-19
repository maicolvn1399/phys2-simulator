import { useMemo } from 'react';
import LineChart from '../shared/LineChart.jsx';
import { sample } from './physics.js';
import { pickUnit, eng } from '../shared/units.js';
import { nf } from '../shared/format.js';

/** Φ(t) y ε(t) sobre toda la ventana de tiempo, con el instante actual marcado. */
export default function InductionCharts({ m, t }) {
  const { phiS, emfS, uP, uE } = useMemo(() => {
    const uP = pickUnit(m.stats.phiAbs), uE = pickUnit(m.stats.emfAbs);
    return {
      uP, uE,
      phiS: sample(m, tt => m.phi(tt) / uP.f).map(([x, y]) => [x, y]),
      emfS: sample(m, tt => m.emf(tt) / uE.f),
    };
  }, [m]);
  const phi = m.phi(t), emf = m.emf(t);
  return (
    <div className="charts">
      <LineChart title="Flujo magnético Φ(t)" sub={`en t = ${nf(t, 2)} s: ${eng(phi, 'Wb', 2, m.stats.phiAbs)}`}
        series={[{ pts: phiS, cls: 'c2' }]} xDomain={[0, m.T]} xLabel="t (s)" yLabel={`Φ (${uP.p}Wb)`}
        cursor={t} dots={[{ x: t, y: phi / uP.f, cls: 'c2' }]} />
      <LineChart title="Fem inducida ε(t) = −dΦ/dt" sub={`en t = ${nf(t, 2)} s: ${eng(emf, 'V', 2, m.stats.emfAbs)}`}
        series={[{ pts: emfS, cls: 'c1' }]} xDomain={[0, m.T]} xLabel="t (s)" yLabel={`ε (${uE.p}V) · + antihoraria`}
        cursor={t} dots={[{ x: t, y: emf / uE.f, cls: 'c1' }]} />
    </div>
  );
}
