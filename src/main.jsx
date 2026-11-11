import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Shell from './Shell.jsx';
import './styles.css';

// aplicar el tema guardado antes de dibujar (claro / oscuro)
try {
  const t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch { /* sin almacenamiento */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
