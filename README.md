# physics2-simulator

Simulaciones interactivas de Física II (FI-1102, TEC) en React + Vite: Ley de Ampère, Biot–Savart y circuitos con resistencias.

## Correr en local

Requiere Node.js 18 o superior.

```bash
cd physics2-simulator
npm install
npm run dev            # abre http://localhost:5173
```

Otros comandos:

```bash
npm run build          # build para desplegar (carpeta dist/, sirve para Vercel / GitHub Pages)
npm run preview        # sirve dist/ en local para probar el build
npm run build:single   # un solo HTML autocontenido en dist-single/index.html
```

## Estructura

```
src/
├── main.jsx, Shell.jsx, styles.css   # entrada, navegación por #hash y estilos
├── home/                 # página principal con las tarjetas y vistas previas
├── ampere-law-sim/       # Ley de Ampère: alambres, punto P y superposición
│   ├── AmpereApp.jsx
│   ├── components/       # FieldCanvas, EquationPanel, VectorSum, CoordInput
│   ├── physics/field.js
│   └── presets.js
├── magnetic-field-sim/   # Biot–Savart: dibujo de alambres/arcos e integrales paso a paso
│   ├── BiotApp.jsx, BiotCanvas.jsx, BiotEquations.jsx, Palette.jsx
│   ├── physics.js, segExam.js, exact.js
│   └── presets.js
├── circuit-sim/          # Circuitos: R_eq animada y Kirchhoff (mallas y ramas)
│   ├── CircuitApp.jsx, CircuitCanvas.jsx, CircuitEquations.jsx
│   ├── model.js, frac.js
│   └── presets.js
└── shared/               # format.js, useThemeTokens.js, Tex.jsx, NumField.jsx
```

Rutas: `#ampere`, `#biot-savart`, `#circuitos` (sin hash: página principal).
