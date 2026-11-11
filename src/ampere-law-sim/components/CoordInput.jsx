import { useEffect, useState } from 'react';

/** Campo numérico en centímetros. Acepta coma o punto decimal y aplica el valor al confirmar. */
export default function CoordInput({ id, label, value, onCommit, min = -28, max = 28 }) {
  const fmt = v => String(Math.round(v * 1000) / 10).replace('.', ',');
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmt(value)); }, [value, focused]);

  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(v)) onCommit(Math.max(min, Math.min(max, v)) / 100);
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
      <span className="unit">cm</span>
    </label>
  );
}
