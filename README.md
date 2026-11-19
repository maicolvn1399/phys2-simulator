# physics2-simulator

Simulaciones interactivas de Física 

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
├── gauss-law-sim/        # Ley de Gauss: esfera aislante, superficie gaussiana, E(r) y q_enc(r)
│   ├── GaussApp.jsx, GaussCanvas.jsx, GaussEquations.jsx, GaussCharts.jsx
│   ├── physics.js        # q_enc, Φ, E_r, ρ (uniforme y ρ = ρ₀ r/R)
│   ├── presets.js, gauss.css
├── induction-sim/        # Inducción: Faraday y Lenz (B variable, barra móvil, espira giratoria)
│   ├── InductionApp.jsx, InductionCanvas.jsx, InductionEquations.jsx, InductionCharts.jsx
│   ├── physics.js        # Φ(t), ε(t), sentido de la corriente (Lenz)
│   ├── presets.js, induction.css
└── shared/               # format.js, useThemeTokens.js, Tex.jsx, NumField.jsx,
                          # Slider.jsx, LineChart.jsx (+ chart.css), units.js
```

Rutas: `#ampere`, `#biot-savart`, `#circuitos`, `#gauss`, `#induccion` (sin hash: página principal).
