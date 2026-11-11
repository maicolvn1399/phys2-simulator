import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Ecuación con KaTeX. `trust` permite \htmlClass para colorear términos con los tokens del tema. */
export default function Tex({ tex, block = false, className = '' }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false, trust: true, strict: false }),
    [tex, block],
  );
  return <span className={`${block ? 'tex-block' : 'tex'} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
