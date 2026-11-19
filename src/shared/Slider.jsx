import { nf } from './format.js';

/** Control deslizante con etiqueta y valor (mismo formato que el de corriente en la simulación de Ampère). */
export default function Slider({ id, label, value, min, max, step, unit = '', d = 1, onChange }) {
  return (
    <>
      <label className="row" htmlFor={id}><span>{label}</span><output className="num">{nf(value, d)}{unit ? ` ${unit}` : ''}</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </>
  );
}
