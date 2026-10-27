# 🎴 CardKit 3D Studio

> **Generador de Tarjetas Model Kit (Sprue Cards) de Letras y Archivos SVG para Impresión 3D.**  
> Aplicación web 100% en español, sin dependencias de backend, lista para desplegar en **GitHub Pages** con un solo clic.

![CardKit 3D Studio Preview](https://img.shields.io/badge/Versi%C3%B3n-2.0.0-indigo.svg)
![Despliegue GitHub](https://img.shields.io/badge/GitHub%20Pages-Listo-emerald.svg)
![3D Format](https://img.shields.io/badge/Exportaci%C3%B3n-STL%20Binario%20%7C%20SVG%202D-amber.svg)

---

## ✨ Características Principales

### 1. 🔤 Apartado de Letras y Tipografías
- **Más de 20 fuentes tipográficas de alta calidad**:
  - *Modernas Sans-Serif*: Inter, Roboto, Montserrat, Poppins, Anton.
  - *Display y Títulos*: Righteous, Bangers, Bungee, Alfa Slab One.
  - *Cursivas y Manuscritas*: Pacifico, Lobster, Dancing Script, Caveat.
  - *Futuristas y Gamer*: Orbitron, Russo One, Press Start 2P, Silkscreen.
  - *Clásicas Serif*: Cinzel, Playfair Display.
- **Soporte para subir fuentes personalizadas**: Arrastra o sube tus propios archivos `.ttf`, `.otf` o `.woff`.
- **Escalado de letras**: Slider de tamaño en milímetros (10 mm a 60 mm).
- **Separación entre letras (Kerning)**: Ajusta el espaciado horizontal preciso entre cada letra para que nunca se encimen.
- **Espaciado entre filas**: Distribución en rejilla multilínea inteligente.
- **Modos de organización**:
  - *Piezas individuales*: Cada letra es una pieza independiente sostenida por conectores al marco.
  - *Texto continuo*: Letras entrelazadas formando una sola placa o llavero de una sola pieza.

### 2. 📐 Apartado de Archivos SVG
- **Análisis inteligente de vectores**:
  - Detección automática de islas y contornos exteriores.
  - Identificación de orificios internos (por ejemplo, el centro de las letras O, A, B, o huecos de un logotipo).
  - Cálculo de área, centroides y bounding box.
- **Ajuste y centrado automático**: Escala el SVG para aprovechar al máximo el área libre del marco respetando márgenes de seguridad.
- **Controles de transformación**: Rotación libre en grados, e inversión en espejo horizontal y vertical.
- **Biblioteca de muestras precargadas**: Incluye modelos de prueba listos para usar con un clic (Tiranosaurio Rex fósil, Cohete espacial retro, Murciélago héroe, Engranaje mecánico, Corazón alado y Flor geométrica).

### 3. 🔗 Generación Automática de Conectores (Sprues / Runners)
- **Algoritmo inteligente de proximidad**: Proyecta puentes de unión desde los bordes de cada pieza hacia el marco en las direcciones más estables (puntos opuestos).
- **Muesca de desprendimiento en V (Breakaway Notches)**:
  - Crea un rebaje fino en la unión con la pieza (0.4 - 0.8 mm de altura) para que puedas **desprender las letras o piezas con los dedos** limpiamente tras la impresión sin necesidad de alicates ni dejar rebabas feas.
- **Configuración personalizada**:
  - Cantidad de conectores por pieza: *Automático (adaptativo según tamaño)*, 1, 2, 3 o 4 conectores.
  - Ancho de conectores (1.0 mm a 4.0 mm).
  - Profundidad de la muesca de corte.
- **Recálculo instantáneo**: Botón para regenerar o afinar conectores en tiempo real.

### 4. 🖼️ Marco Personalizable y Personalización de Texto
- **Dimensiones ajustables**: Ancho (X), Alto (Y), Grosor de tarjeta (Z), Ancho del borde y Radio de esquinas redondeadas.
- **Formatos estándar predefinidos**:
  - Formato Tarjeta de Crédito (85 × 54 mm) — *¡Ideal para regalar en una cartera o billetera!*
  - Formato Mediano (100 × 70 mm).
  - Formato Postal A6 (148 × 105 mm).
- **Personalización de texto en el propio marco**:
  - Texto en el borde superior (ej: `★ EDICIÓN ESPECIAL ★`, `KIT DE LETRAS 2026`).
  - Texto en el borde inferior (ej: `DISEÑADO POR TI`, `HECHO CON AMOR`).
  - Estilos de texto en el marco:
    - **En Relieve**: Letras elevadas +0.6 mm sobre la superficie del marco.
    - **Grabado / Bajo Relieve**: Letras hendidas hacia adentro.
- **Orificio para Llavero / Colgante**: Ubicable en cualquiera de las cuatro esquinas con diámetro configurable.

### 5. 🖨️ Exportación 3D e Inspección en Tiempo Real
- **Visor 3D WebGL (Three.js)**:
  - Órbita, zoom, paneo con ratón o gestos táctiles en móvil.
  - Vistas rápidas: Superior (Top 2D), Isométrica (3D Iso), Frontal (Front), y Centrar cámara.
  - Cama de impresión graduada en milímetros.
  - Simulación de color de filamento (PLA Seda Oro, Negro Mate, Blanco, Rojo, Azul, Verde Neón, etc.).
  - Modo Rayos X / Alambre (Wireframe) y Resaltado de Conectores en Naranja Neón.
- **Cálculo de métricas en vivo**:
  - Dimensiones exactas en mm ($X \times Y \times Z$).
  - Volumen en $\text{cm}^3$.
  - Peso estimado de filamento en gramos de PLA.
  - Tiempo aproximado de impresión.
- **Exportación a STL Binario**:
  - Formato estándar compatible con **Cura, Bambu Studio, PrusaSlicer, OrcaSlicer, Creality Print, Lychee**, etc.
  - Malla sólida y estanca (manifold).
- **Exportación a SVG 2D**:
  - Para corte láser o documentación vectorial de planos.

---

## 🚀 Despliegue en GitHub Pages (Guía Paso a Paso)

Este proyecto está construido con tecnología web nativa (HTML5, Vanilla JavaScript ES Modules, Three.js y Tailwind CSS), por lo que **no requiere ningún paso de compilación (npm / node)** y se despliega directamente en GitHub Pages en menos de 2 minutos:

### Método 1: Despliegue Directo desde Rama (El más fácil)
1. Crea un nuevo repositorio en tu cuenta de GitHub (por ejemplo: `cardkit-generator-3d`).
2. Sube todos los archivos de esta carpeta al repositorio:
   ```bash
   git init
   git add .
   git commit -m "Publicar CardKit 3D Studio"
   git branch -M main
   git remote add origin https://github.com/skyhero23/cardkit-generator-3d.git
   git push -u origin main
   ```
3. En GitHub, abre tu repositorio y ve a **Settings** (Configuración) → **Pages** (en el menú lateral izquierdo).
4. En la sección **Build and deployment**:
   - **Source**: *Deploy from a branch*.
   - **Branch**: Selecciona `main` y la carpeta `/ (root)`.
   - Haz clic en **Save** (Guardar).
5. ¡Listo! Espera unos segundos y tu web estará accesible en:
   `https://skyhero23.github.io/cardkit-generator-3d/`

### Método 2: Despliegue Automatizado con GitHub Actions
El repositorio ya incluye el archivo `.github/workflows/deploy.yml`. Solo ve a **Settings** → **Pages** y selecciona como Source: **GitHub Actions**. La web se actualizará automáticamente con cada `git push`.

---

## 🛠️ Cómo Probar Localmente

Puedes abrir directamente el archivo `index.html` en cualquier navegador web moderno (Google Chrome, Firefox, Safari, Edge), o utilizar un servidor local rápido con Python:

```bash
cd cardkit-generator-3d
python3 -m http.server 8000
```
Luego abre en tu navegador: `http://localhost:8000`

---

## 💡 Consejos de Laminación para Impresión 3D (Slicing)

Para que el CardKit se imprima perfecto y las piezas se desprendan con total suavidad:
1. **Altura de capa**: Se recomienda `0.20 mm` o `0.16 mm` para que la muesca de corte en V tenga una definición precisa de 2 a 3 capas.
2. **Relleno (Infill)**: Con un grosor de tarjeta de 2.0 mm, el modelo quedará casi 100% sólido con 4 o 5 capas superiores e inferiores. Se recomienda relleno `100%` o `40% rejilla`.
3. **Primera capa**: Asegúrate de tener una buena calibración de cama (Z-offset) para que el fondo plano de la tarjeta quede uniforme y sin patas de elefante.
4. **Desprendimiento**: Deja enfriar la placa magnética antes de retirarla. Luego, empuja suavemente cada letra con el pulgar: la pestaña romperá por la muesca en V sin dejar rebabas.

---

## 📂 Estructura del Proyecto

```
cardkit-generator-3d/
├── index.html                   # Página web principal interactiva
├── css/
│   └── styles.css               # Estilos personalizados, sliders y temas
├── js/
│   ├── app.js                   # Controlador maestro y gestión de eventos
│   ├── viewer.js                # Visor 3D Three.js, cámara, luces y materiales
│   ├── frameEngine.js           # Generador del marco y personalización de texto
│   ├── textEngine.js            # Motor tipográfico, fuentes, kerning y rejilla
│   ├── svgEngine.js             # Motor de análisis, normalización e islas SVG
│   ├── sprueEngine.js           # Algoritmo de conectores automáticos y muescas en V
│   ├── stlExporter.js           # Exportador STL binario y cálculo de métricas
│   ├── marchingSquares.js       # Vectorizador de contornos y orificios 2D
│   ├── earcut.js                # Triangulación de polígonos complejos con agujeros
│   └── samples.js               # Muestras SVG y plantillas de texto precargadas
├── .github/
│   └── workflows/
│       └── deploy.yml           # Flujo de trabajo GitHub Actions
└── README.md                    # Documentación completa en español
```

---

*Desarrollado con pasión para la comunidad Maker y de Impresión 3D.*
