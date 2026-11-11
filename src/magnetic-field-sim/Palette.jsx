/** Paleta de herramientas tipo "Paint": se elige una figura y se dibuja sobre el plano con el mouse. */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICONS = {
  pick: <g><path {...S} d="M5 19c4-6 10-10 14-14" /><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></g>,
  select: <g><path {...S} d="M12 3v18M3 12h18" /><path {...S} d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></g>,
  erase: <g><path {...S} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path {...S} strokeWidth="1.6" d="M10 11v6M14 11v6" /></g>,
  probe: <g><circle cx="12" cy="12" r="4" fill="currentColor" /><path {...S} strokeWidth="1.4" d="M12 3v3M12 18v3M3 12h3M18 12h3" /></g>,
  seg: <g><path {...S} d="M5 19L19 5" /><circle cx="5" cy="19" r="2" fill="currentColor" /><circle cx="19" cy="5" r="2" fill="currentColor" /></g>,
  semi: <g><path {...S} d="M4 19l9-9" /><path {...S} strokeDasharray="2.5 3" d="M13 10l7-7" /><circle cx="4" cy="19" r="2" fill="currentColor" /></g>,
  inf: <g><path {...S} d="M8 16l8-8" /><path {...S} strokeDasharray="2.5 3" d="M3 21l5-5M16 8l5-5" /></g>,
  arc: <g><path {...S} d="M5 19A14 14 0 0 1 19 5" /><circle cx="19" cy="19" r="1.6" fill="currentColor" /></g>,
  half: <g><path {...S} d="M3 16a9 9 0 0 1 18 0" /><path {...S} strokeWidth="1.2" strokeDasharray="2 2.5" d="M3 16h18" /></g>,
  circle: <circle {...S} cx="12" cy="12" r="8" />,
  free: <path {...S} d="M3 17c3-8 6-8 8-3s5 5 10-6" />,
};

export const TOOL_INFO = {
  pick: ['Seleccionar', 'Toca un cable para elegir ese tramo: se resalta, aparece su triángulo y sus ecuaciones abajo. No mueve nada.'],
  select: ['Mover', 'Arrastra un tramo para moverlo o sus manijas (círculos) para estirarlo, girarlo o cambiar el radio. También puedes arrastrar P. Supr borra el tramo elegido.'],
  erase: ['Eliminar', 'Toca un cable para borrar ese tramo.'],
  probe: ['Punto P', 'Clic donde quieres calcular el campo magnético.'],
  seg: ['Recto', 'Presiona en un punto y arrastra hasta otro: sale un alambre recto con cualquier inclinación (Shift: ángulos de 15°). Si apuntas cerca de P, se alinea solo para pasar por P. La corriente va del inicio al final.'],
  semi: ['Semi-infinito', 'Presiona en el extremo y arrastra hacia donde sigue el alambre: continúa hasta el infinito en esa dirección.'],
  inf: ['Infinito', 'Presiona y arrastra para dar la dirección: es una recta infinita que pasa por esos puntos.'],
  arc: ['Arco', 'Presiona en el centro y arrastra hasta donde empieza el arco; suelta, gira el puntero alrededor del centro para barrer el ángulo y haz clic para terminar. Esc cancela.'],
  half: ['Semicírculo', 'Presiona en el centro y arrastra: la distancia es el radio y la dirección marca dónde empieza el semicírculo (gira antihorario).'],
  circle: ['Espira', 'Presiona en el centro y arrastra hasta el radio: espira circular completa, antihoraria.'],
  free: ['A mano', 'Presiona y dibuja la forma que quieras, como un lápiz: la curva se convierte en pequeños tramos rectos y cada uno se integra con Biot–Savart.'],
};

const GROUPS = [
  ['Editar', ['pick', 'select', 'erase', 'probe']],
  ['Alambres', ['seg', 'semi', 'inf', 'arc', 'half', 'circle']],
];

export default function Palette({ tool, onTool }) {
  return (
    <div className="palette" role="toolbar" aria-label="Herramientas de dibujo">
      {GROUPS.map(([title, keys]) => (
        <div className="pal-group" key={title}>
          <span className="pal-title">{title}</span>
          {keys.map(k => (
            <button key={k} type="button" className="pal-btn" aria-pressed={tool === k} title={TOOL_INFO[k][1]} onClick={() => onTool(k)}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{ICONS[k]}</svg>
              <span>{TOOL_INFO[k][0]}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
