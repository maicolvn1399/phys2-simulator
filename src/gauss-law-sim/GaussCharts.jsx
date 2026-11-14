import { useMemo } from 'react';
import LineChart from '../shared/LineChart.jsx';
import { Er, qEnc } from './physics.js';
import { pickUnit } from '../shared/units.js';
import { nf } from '../shared/format.js';

const N = 160;

/** E_r(r) y q_enc(r) para r de 0 a 2R, con la posición actual de la superficie gaussiana. */
export default function GaussCharts({ Q, R, r, dist }) {
  const Qc = Q * 1e-9, Rm = R / 100;
  const { eS, qS, unit } = useMemo(() => {
    const unit = pickUnit(Math.abs(Er(Qc, Rm, Rm, dist)));
    const pts = Array.from({ length: N + 1 }, (_, i) => (i / N) * 2 * R);
    return {
      unit,
      eS: pts.map(x => [x, Er(Qc, Rm, x / 100, dist) / unit.f]),
      qS: pts.map(x => [x, qEnc(Qc, Rm, x / 100, dist) * 1e9]),
    };
  }, [Qc, Rm, R, dist]);
  const e = Er(Qc, Rm, r / 100, dist) / unit.f, q = qEnc(Qc, Rm, r / 100, dist) * 1e9;
  const eMax = Math.abs(Er(Qc, Rm, Rm, dist)) / unit.f;

  return (
    <div className="charts">
      <LineChart title="Campo E_r(r)" sub={`en r = ${nf(r, 1)} cm: ${nf(e, 2)} ${unit.p}N/C`}
        series={[{ pts: eS, cls: 'c2' }]} xDomain={[0, 2 * R]} yDomain={Q === 0 ? [-1, 1] : [Math.min(0, Q < 0 ? -eMax * 1.12 : 0), Math.max(0, Q > 0 ? eMax * 1.12 : 0)]}
        xLabel="r (cm)" yLabel={`E_r (${unit.p}N/C) · + hacia afuera`} cursor={r} dots={[{ x: r, y: e, cls: 'c2' }]} vlines={[{ x: R, label: 'R' }]} />
      <LineChart title="Carga encerrada q_enc(r)" sub={`en r = ${nf(r, 1)} cm: ${nf(q, 3)} nC`}
        series={[{ pts: qS, cls: 'c1' }]} xDomain={[0, 2 * R]} yDomain={Q === 0 ? [-1, 1] : [Math.min(0, Q * 1.12), Math.max(0, Q * 1.12)]}
        xLabel="r (cm)" yLabel="q_enc (nC)" cursor={r} dots={[{ x: r, y: q, cls: 'c1' }]} vlines={[{ x: R, label: 'R' }]} hlines={[{ y: Q, label: 'Q' }]} />
    </div>
  );
}
