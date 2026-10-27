/**
 * Controlador Principal de la Aplicación CardKit 3D Studio
 * Conecta los motores de Texto, SVG, Marco, Conectores, Visor 3D y Exportador STL.
 */

import { Viewer3D } from './viewer.js';
import { FrameEngine } from './frameEngine.js';
import { TextEngine, FONT_CATALOGUE } from './textEngine.js';
import { SVGEngine } from './svgEngine.js';
import { SprueEngine } from './sprueEngine.js';
import { STLExporter } from './stlExporter.js';
import { SVG_SAMPLES, TEXT_PRESETS } from './samples.js';

class CardKitApp {
    constructor() {
        this.activeMode = 'letters'; // 'letters' o 'svg'
        this.viewer = null;
        this.frameEngine = new FrameEngine();
        this.textEngine = new TextEngine();
        this.svgEngine = new SVGEngine();
        this.sprueEngine = new SprueEngine();

        this.currentIslands = [];
        this.currentConnectors = [];
        this.currentFrameTextIslands = [];
        this.frameData = null;

        this.init();
    }

    async init() {
        // Inicializar Visor 3D
        const viewerContainer = document.getElementById('viewer-3d-canvas');
        this.viewer = new Viewer3D(viewerContainer);

        // Poblar catálogo de fuentes en el selector
        this.populateFontSelector();

        // Poblar muestras de SVG
        this.populateSvgSamples();

        // Registrar Eventos del DOM
        this.bindEvents();

        // Cargar estado inicial por defecto
        await this.regenerateKit();

        // Actualizar iconos Lucide
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    populateFontSelector() {
        const select = document.getElementById('font-family-select');
        if (!select) return;

        select.innerHTML = '';
        const groups = {};

        FONT_CATALOGUE.forEach(f => {
            if (!groups[f.category]) groups[f.category] = [];
            groups[f.category].push(f);
        });

        for (const [category, fonts] of Object.entries(groups)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `── ${category} ──`;
            fonts.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.family;
                opt.textContent = f.name;
                opt.style.fontFamily = f.family;
                if (f.family === 'Inter') opt.selected = true;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        }
    }

    populateSvgSamples() {
        const container = document.getElementById('svg-samples-grid');
        if (!container) return;

        container.innerHTML = '';
        SVG_SAMPLES.forEach((sample, idx) => {
            const btn = document.createElement('button');
            btn.className = 'sample-chip flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/60 text-xs text-slate-200 transition-all text-left';
            btn.innerHTML = `
                <span class="text-base">${sample.name.split(' ')[0]}</span>
                <span class="font-medium truncate">${sample.name.substring(2)}</span>
            `;
            btn.onclick = () => {
                this.loadSvgContent(sample.svg, sample.name);
            };
            container.appendChild(btn);
        });
    }

    bindEvents() {
        // 1. Selector de Modo (Letras / SVG)
        const btnModeLetters = document.getElementById('mode-btn-letters');
        const btnModeSvg = document.getElementById('mode-btn-svg');
        const sectionLetters = document.getElementById('section-letters-config');
        const sectionSvg = document.getElementById('section-svg-config');

        btnModeLetters.addEventListener('click', () => {
            this.activeMode = 'letters';
            btnModeLetters.classList.add('bg-indigo-600', 'text-white', 'shadow-lg');
            btnModeLetters.classList.remove('text-slate-400', 'hover:bg-slate-800');
            btnModeSvg.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg');
            btnModeSvg.classList.add('text-slate-400', 'hover:bg-slate-800');
            sectionLetters.classList.remove('hidden');
            sectionSvg.classList.add('hidden');
            this.regenerateKit();
        });

        btnModeSvg.addEventListener('click', () => {
            this.activeMode = 'svg';
            btnModeSvg.classList.add('bg-indigo-600', 'text-white', 'shadow-lg');
            btnModeSvg.classList.remove('text-slate-400', 'hover:bg-slate-800');
            btnModeLetters.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg');
            btnModeLetters.classList.add('text-slate-400', 'hover:bg-slate-800');
            sectionSvg.classList.remove('hidden');
            sectionLetters.classList.add('hidden');

            if (!this.svgEngine.rawSvgText) {
                // Si no hay SVG cargado, cargar la primera muestra automáticamente
                this.loadSvgContent(SVG_SAMPLES[0].svg, SVG_SAMPLES[0].name);
            } else {
                this.regenerateKit();
            }
        });

        // 2. Presets de Texto
        document.querySelectorAll('.preset-text-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.currentTarget.dataset.text;
                const mode = e.currentTarget.dataset.layout || 'individual';
                document.getElementById('input-text-content').value = text;
                document.getElementById('select-layout-mode').value = mode;
                this.regenerateKit();
            });
        });

        // 3. Inputs de Letras
        const bindInput = (id, callback) => {
            const el = document.getElementById(id);
            if (el) {
                const eventName = el.type === 'range' || el.type === 'text' || el.tagName === 'TEXTAREA' ? 'input' : 'change';
                el.addEventListener(eventName, (e) => {
                    callback(e.target.value);
                    this.regenerateKit();
                });
            }
        };

        bindInput('input-text-content', val => this.textEngine.setConfig({ text: val }));
        bindInput('font-family-select', val => this.textEngine.setConfig({ fontFamily: val }));
        bindInput('select-layout-mode', val => this.textEngine.setConfig({ layoutMode: val }));
        bindInput('slider-font-size', val => {
            document.getElementById('val-font-size').textContent = `${val} mm`;
            this.textEngine.setConfig({ fontSize: parseFloat(val) });
        });
        bindInput('slider-letter-spacing', val => {
            document.getElementById('val-letter-spacing').textContent = `${val} mm`;
            this.textEngine.setConfig({ letterSpacing: parseFloat(val) });
        });
        bindInput('slider-row-spacing', val => {
            document.getElementById('val-row-spacing').textContent = `${val} mm`;
            this.textEngine.setConfig({ rowSpacing: parseFloat(val) });
        });
        bindInput('slider-letter-thickness', val => {
            document.getElementById('val-letter-thickness').textContent = `${val} mm`;
            this.textEngine.setConfig({ letterThickness: parseFloat(val) });
        });

        // Cargar fuente personalizada
        const fontFileInput = document.getElementById('custom-font-file');
        if (fontFileInput) {
            fontFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const fontName = await this.textEngine.loadCustomFont(file);
                        this.populateFontSelector();
                        document.getElementById('font-family-select').value = fontName;
                        this.showToast(`Fuente "${file.name}" cargada con éxito!`);
                        this.regenerateKit();
                    } catch (err) {
                        alert('Error al cargar archivo de fuente: ' + err.message);
                    }
                }
            });
        }

        // 4. Presets de Tamaño de Marco
        document.querySelectorAll('.preset-frame-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const w = parseFloat(e.currentTarget.dataset.w);
                const h = parseFloat(e.currentTarget.dataset.h);
                document.getElementById('slider-frame-width').value = w;
                document.getElementById('val-frame-width').textContent = `${w} mm`;
                document.getElementById('slider-frame-height').value = h;
                document.getElementById('val-frame-height').textContent = `${h} mm`;
                this.frameEngine.setConfig({ width: w, height: h });
                this.regenerateKit();
            });
        });

        // Sliders del Marco
        bindInput('slider-frame-width', val => {
            document.getElementById('val-frame-width').textContent = `${val} mm`;
            this.frameEngine.setConfig({ width: parseFloat(val) });
        });
        bindInput('slider-frame-height', val => {
            document.getElementById('val-frame-height').textContent = `${val} mm`;
            this.frameEngine.setConfig({ height: parseFloat(val) });
        });
        bindInput('slider-frame-thickness', val => {
            document.getElementById('val-frame-thickness').textContent = `${val} mm`;
            this.frameEngine.setConfig({ thickness: parseFloat(val) });
        });
        bindInput('slider-border-width', val => {
            document.getElementById('val-border-width').textContent = `${val} mm`;
            this.frameEngine.setConfig({ borderWidth: parseFloat(val) });
        });
        bindInput('slider-corner-radius', val => {
            document.getElementById('val-corner-radius').textContent = `${val} mm`;
            this.frameEngine.setConfig({ cornerRadius: parseFloat(val) });
        });

        // Personalización de texto en el marco
        bindInput('input-frame-top-text', val => this.frameEngine.setConfig({ topText: val }));
        bindInput('input-frame-bottom-text', val => this.frameEngine.setConfig({ bottomText: val }));
        bindInput('select-frame-text-style', val => this.frameEngine.setConfig({ textStyle: val }));

        // Orificio de llavero
        const chkHanger = document.getElementById('chk-hanger-hole');
        if (chkHanger) {
            chkHanger.addEventListener('change', (e) => {
                this.frameEngine.setConfig({ hasHangerHole: e.target.checked });
                this.regenerateKit();
            });
        }
        bindInput('select-hanger-corner', val => this.frameEngine.setConfig({ hangerCorner: val }));

        // 5. Carga de archivo SVG (Drag & drop y file picker)
        const svgDropZone = document.getElementById('svg-drop-zone');
        const svgFileInput = document.getElementById('svg-file-input');

        if (svgDropZone && svgFileInput) {
            svgDropZone.addEventListener('click', () => svgFileInput.click());

            svgDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                svgDropZone.classList.add('border-indigo-500', 'bg-indigo-950/20');
            });

            svgDropZone.addEventListener('dragleave', () => {
                svgDropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
            });

            svgDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                svgDropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.handleSvgFile(e.dataTransfer.files[0]);
                }
            });

            svgFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleSvgFile(e.target.files[0]);
                }
            });
        }

        // Sliders de transformación SVG
        bindInput('slider-svg-margin', val => {
            document.getElementById('val-svg-margin').textContent = `${val} mm`;
        });
        bindInput('slider-svg-rotation', val => {
            document.getElementById('val-svg-rotation').textContent = `${val}°`;
        });
        const chkFlipX = document.getElementById('chk-svg-flip-x');
        const chkFlipY = document.getElementById('chk-svg-flip-y');
        if (chkFlipX) chkFlipX.addEventListener('change', () => this.regenerateKit());
        if (chkFlipY) chkFlipY.addEventListener('change', () => this.regenerateKit());

        // 6. Conectores / Sprues
        bindInput('select-sprue-strategy', val => this.sprueEngine.setConfig({ strategy: val }));
        bindInput('slider-frame-connectors', val => {
            document.getElementById('val-frame-connectors').textContent = val;
            this.sprueEngine.setConfig({ frameConnectorsCount: parseInt(val, 10) });
        });
        bindInput('slider-bridge-dist', val => {
            document.getElementById('val-bridge-dist').textContent = `${val} mm`;
            this.sprueEngine.setConfig({ maxBridgeDist: parseFloat(val) });
        });
        bindInput('slider-connector-width', val => {
            document.getElementById('val-connector-width').textContent = `${val} mm`;
            this.sprueEngine.setConfig({ width: parseFloat(val) });
        });
        bindInput('slider-notch-depth', val => {
            document.getElementById('val-notch-depth').textContent = `${val} mm`;
            this.sprueEngine.setConfig({ notchDepth: parseFloat(val) });
        });
        const chkNotch = document.getElementById('chk-connector-notch');
        if (chkNotch) {
            chkNotch.addEventListener('change', (e) => {
                this.sprueEngine.setConfig({ hasNotch: e.target.checked });
                this.regenerateKit();
            });
        }

        const btnRegenSprues = document.getElementById('btn-regenerate-sprues');
        if (btnRegenSprues) {
            btnRegenSprues.addEventListener('click', () => {
                this.regenerateKit();
                this.showToast('¡Conectores recalculados automáticamente!');
            });
        }

        // 7. Visor 3D Toolbar y Materiales
        document.getElementById('btn-view-top').addEventListener('click', () => this.viewer.setViewTop());
        document.getElementById('btn-view-iso').addEventListener('click', () => this.viewer.setViewIsometric());
        document.getElementById('btn-view-front').addEventListener('click', () => this.viewer.setViewFront());
        document.getElementById('btn-view-reset').addEventListener('click', () => this.viewer.resetCamera());

        const chkWireframe = document.getElementById('chk-wireframe');
        if (chkWireframe) {
            chkWireframe.addEventListener('change', (e) => this.viewer.setWireframe(e.target.checked));
        }

        const chkHighlightSprues = document.getElementById('chk-highlight-sprues');
        if (chkHighlightSprues) {
            chkHighlightSprues.addEventListener('change', (e) => this.viewer.setHighlightConnectors(e.target.checked));
        }

        // Selector de color de filamento
        document.querySelectorAll('.filament-color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const colorKey = e.currentTarget.dataset.color;
                this.viewer.setFilamentColor(colorKey);

                document.querySelectorAll('.filament-color-btn').forEach(b => b.classList.remove('ring-2', 'ring-white', 'scale-110'));
                e.currentTarget.classList.add('ring-2', 'ring-white', 'scale-110');
            });
        });

        // 8. Botones de Descarga
        document.getElementById('btn-download-stl').addEventListener('click', () => this.downloadSTL());
        document.getElementById('btn-download-stl-header').addEventListener('click', () => this.downloadSTL());
        document.getElementById('btn-export-svg-2d').addEventListener('click', () => this.download2DSVG());

        // 9. Modales (Guía GitHub / Ayuda)
        const modalDeploy = document.getElementById('modal-deploy-guide');
        document.getElementById('btn-open-deploy-guide').addEventListener('click', () => {
            modalDeploy.classList.remove('hidden');
        });
        document.getElementById('btn-close-deploy-guide').addEventListener('click', () => {
            modalDeploy.classList.add('hidden');
        });
        modalDeploy.addEventListener('click', (e) => {
            if (e.target === modalDeploy) modalDeploy.classList.add('hidden');
        });
    }

    handleSvgFile(file) {
        if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
            alert('Por favor selecciona un archivo con extensión .svg');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.loadSvgContent(e.target.result, file.name);
        };
        reader.readAsText(file);
    }

    loadSvgContent(svgString, fileName = 'Archivo SVG') {
        try {
            const summary = this.svgEngine.parseSVG(svgString);
            document.getElementById('svg-filename-display').textContent = fileName;
            document.getElementById('svg-stat-islands').textContent = `${summary.totalIslands} piezas`;
            document.getElementById('svg-stat-holes').textContent = `${summary.totalHoles} orificios`;

            this.showToast(`SVG analizado: ${summary.totalIslands} piezas detectadas`);
            this.regenerateKit();
        } catch (err) {
            alert('Error al analizar SVG: ' + err.message);
        }
    }

    /**
     * Ciclo maestro de regeneración del CardKit
     */
    async regenerateKit() {
        const innerBounds = this.frameEngine.getInnerBounds();

        // 1. Obtener Islas según el modo activo
        if (this.activeMode === 'letters') {
            this.currentIslands = this.textEngine.generateLetters(innerBounds);
        } else {
            const margin = parseFloat(document.getElementById('slider-svg-margin')?.value || 5);
            const rot = parseFloat(document.getElementById('slider-svg-rotation')?.value || 0);
            const flipX = document.getElementById('chk-svg-flip-x')?.checked || false;
            const flipY = document.getElementById('chk-svg-flip-y')?.checked || false;

            this.currentIslands = this.svgEngine.normalizeAndFit(
                this.frameEngine.config.width,
                this.frameEngine.config.height,
                margin + this.frameEngine.config.borderWidth,
                rot, flipX, flipY
            );
        }

        // 2. Generar Conectores Automáticos (Sprues)
        this.sprueEngine.setConfig({
            cardThickness: this.frameEngine.config.thickness
        });
        this.currentConnectors = this.sprueEngine.generateAutoConnectors(this.currentIslands, innerBounds);

        // 3. Generar Texto de Personalización del Marco
        this.currentFrameTextIslands = this.frameEngine.generateFrameTextIslands();

        // 4. Preparar datos completos del marco
        this.frameData = {
            width: this.frameEngine.config.width,
            height: this.frameEngine.config.height,
            thickness: this.frameEngine.config.thickness,
            borderWidth: this.frameEngine.config.borderWidth,
            pieceThickness: this.activeMode === 'letters' 
                ? this.textEngine.config.letterThickness 
                : this.frameEngine.config.thickness,
            outerPolygon: this.frameEngine.getOuterPolygon(),
            innerHole: this.frameEngine.getInnerHolePolygon(),
            hangerHole: this.frameEngine.getHangerHolePolygon(),
            embossHeight: this.frameEngine.config.embossHeight
        };

        // 5. Actualizar Visor 3D
        this.viewer.updateCardKitGeometry(
            this.frameData,
            this.currentIslands,
            this.currentConnectors,
            this.currentFrameTextIslands
        );

        // 6. Actualizar Estadísticas de Impresión 3D
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const stats = STLExporter.calculateMeshStats([]);
        // Estimación directa basada en dimensiones
        const w = this.frameData.width;
        const h = this.frameData.height;
        const t = this.frameData.thickness;
        const areaRatio = 0.45; // Porcentaje promedio de llenado del cardkit
        const volumeCm3 = Math.round(((w * h * t * areaRatio) / 1000) * 10) / 10;
        const weightGrams = Math.round(volumeCm3 * 1.24 * 10) / 10;
        const printMinutes = Math.max(12, Math.round(weightGrams * 3.5 + 6));

        document.getElementById('stat-dims').textContent = `${w} × ${h} × ${t} mm`;
        document.getElementById('stat-volume').textContent = `${volumeCm3} cm³`;
        document.getElementById('stat-weight').textContent = `${weightGrams} g (PLA)`;
        document.getElementById('stat-time').textContent = `~${printMinutes} min`;
        document.getElementById('stat-parts').textContent = `${this.currentIslands.length} piezas`;
        document.getElementById('stat-sprues').textContent = `${this.currentConnectors.length} conectores`;
    }

    /**
     * Descarga directa del archivo STL Binario
     */
    downloadSTL() {
        if (!this.frameData || this.currentIslands.length === 0) {
            alert('No hay piezas para exportar.');
            return;
        }

        const exportResult = STLExporter.exportCardKitBinarySTL(
            this.frameData,
            this.currentIslands,
            this.currentConnectors,
            this.currentFrameTextIslands
        );

        const filename = this.activeMode === 'letters'
            ? `cardkit-letras-${this.textEngine.config.text.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '_')}.stl`
            : `cardkit-svg-${Date.now()}.stl`;

        const url = URL.createObjectURL(exportResult.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`¡STL descargado! (${(exportResult.blob.size / 1024).toFixed(1)} KB, ${exportResult.triangleCount} triángulos)`);
    }

    /**
     * Exporta el diseño en SVG 2D plano (para corte láser o documentación)
     */
    download2DSVG() {
        const W = this.frameData.width;
        const H = this.frameData.height;

        let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">\n`;
        svg += `  <!-- Marco Exterior -->\n`;
        svg += `  <path d="${this.polygonToPath(this.frameData.outerPolygon)}" fill="none" stroke="#2563eb" stroke-width="0.3"/>\n`;
        svg += `  <!-- Recorte Interior -->\n`;
        svg += `  <path d="${this.polygonToPath(this.frameData.innerHole)}" fill="none" stroke="#2563eb" stroke-width="0.3"/>\n`;

        if (this.frameData.hangerHole) {
            svg += `  <!-- Orificio Llavero -->\n`;
            svg += `  <path d="${this.polygonToPath(this.frameData.hangerHole)}" fill="none" stroke="#ef4444" stroke-width="0.3"/>\n`;
        }

        svg += `  <!-- Piezas e Islas -->\n`;
        for (const isl of this.currentIslands) {
            svg += `  <path d="${this.polygonToPath(isl.outer)}" fill="#38bdf8" stroke="#0284c7" stroke-width="0.2"/>\n`;
            for (const h of isl.holes || []) {
                svg += `  <path d="${this.polygonToPath(h)}" fill="#ffffff" stroke="#0284c7" stroke-width="0.2"/>\n`;
            }
        }

        svg += `  <!-- Conectores (Sprues) -->\n`;
        for (const conn of this.currentConnectors) {
            svg += `  <line x1="${conn.start[0]}" y1="${conn.start[1]}" x2="${conn.end[0]}" y2="${conn.end[1]}" stroke="#f59e0b" stroke-width="${conn.width}" stroke-linecap="round"/>\n`;
        }

        svg += `</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cardkit-plano-2d.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('¡Plano SVG 2D exportado con éxito!');
    }

    polygonToPath(poly) {
        if (!poly || poly.length === 0) return '';
        // Invertir Y para que SVG (Y hacia abajo) coincida con la orientación visual estándar
        const H = this.frameData.height;
        let d = `M ${poly[0][0].toFixed(2)} ${(H - poly[0][1]).toFixed(2)}`;
        for (let i = 1; i < poly.length; i++) {
            d += ` L ${poly[i][0].toFixed(2)} ${(H - poly[i][1]).toFixed(2)}`;
        }
        d += ' Z';
        return d;
    }

    showToast(message) {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message;
        toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
        }, 3200);
    }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
    window.cardKitApp = new CardKitApp();
});
