import { useEffect, useState } from 'react';

/** Campo numérico genérico (acepta coma o punto). `value` y `onCommit` en las unidades que se muestran. */
export default function NumField({ id, label, value, unit, onCommit, min = -1e9, max = 1e9, d = 1 }) {
  const fmt = v => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmt(value)); }, [value, focused]);
  const commit = () => {
    const v = parseFloat(text.replace(',', '.').replace('−', '-'));
    if (Number.isFinite(v)) onCommit(Math.max(min, Math.min(max, v)));
    else setText(fmt(value));
  };
  return (
    <label className="coord" htmlFor={id}>
      <span>{label}</span>
      <input id={id} inputMode="decimal" value={text}
        onFocus={() => setFocused(true)}
        onChange={e => setText(e.target.value)}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }} />
      <span className="unit">{unit}</span>
    </label>
  );
}
