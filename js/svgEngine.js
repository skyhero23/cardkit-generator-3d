/**
 * Motor de Análisis y Procesamiento de SVG para CardKit 3D
 * Analiza etiquetas SVG, extrae formas e islas desconectadas, y normaliza geometrías.
 */

import { simplifyPolygon, getBoundingBox, isPointInsidePolygon } from './marchingSquares.js';

export class SVGEngine {
    constructor() {
        this.rawSvgText = '';
        this.parsedIslands = []; // Arreglo de islas con { outer: [[x,y],...], holes: [...], bbox, centroid, id }
        this.viewBox = { x: 0, y: 0, width: 100, height: 100 };
    }

    /**
     * Parsea una cadena de texto SVG completa
     */
    parseSVG(svgString) {
        this.rawSvgText = svgString;
        this.parsedIslands = [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');

        if (!svgEl) {
            throw new Error('El archivo no contiene una etiqueta <svg> válida');
        }

        // Obtener ViewBox o width/height
        const vbAttr = svgEl.getAttribute('viewBox');
        if (vbAttr) {
            const parts = vbAttr.split(/[\s,]+/).map(parseFloat);
            if (parts.length === 4) {
                this.viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }
        } else {
            const w = parseFloat(svgEl.getAttribute('width')) || 100;
            const h = parseFloat(svgEl.getAttribute('height')) || 100;
            this.viewBox = { x: 0, y: 0, width: w, height: h };
        }

        // Convertir formas primitivas (rect, circle, ellipse, polygon) a <path> estándar
        this.convertPrimitivesToPaths(svgEl);
        const normalizedSvgString = svgEl.outerHTML;

        // Si THREE y SVGLoader están presentes en el entorno global:
        if (window.THREE && window.THREE.SVGLoader) {
            this.parseWithThreeSVGLoader(normalizedSvgString);
        } else {
            // Parser de rutas SVG integrado nativo
            this.parseNative(doc);
        }

        return this.getAnalysisSummary();
    }

    /**
     * Convierte formas SVG primitivas (<rect>, <circle>, <ellipse>, <polygon>) a <path>
     */
    convertPrimitivesToPaths(svgEl) {
        // 1. Rectángulos
        svgEl.querySelectorAll('rect').forEach(rect => {
            const x = parseFloat(rect.getAttribute('x') || 0);
            const y = parseFloat(rect.getAttribute('y') || 0);
            const w = parseFloat(rect.getAttribute('width') || 0);
            const h = parseFloat(rect.getAttribute('height') || 0);
            if (w > 0 && h > 0) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`);
                if (rect.hasAttribute('fill')) path.setAttribute('fill', rect.getAttribute('fill'));
                rect.parentNode.replaceChild(path, rect);
            }
        });

        // 2. Círculos
        svgEl.querySelectorAll('circle').forEach(circle => {
            const cx = parseFloat(circle.getAttribute('cx') || 0);
            const cy = parseFloat(circle.getAttribute('cy') || 0);
            const r = parseFloat(circle.getAttribute('r') || 0);
            if (r > 0) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`);
                if (circle.hasAttribute('fill')) path.setAttribute('fill', circle.getAttribute('fill'));
                circle.parentNode.replaceChild(path, circle);
            }
        });

        // 3. Elipses
        svgEl.querySelectorAll('ellipse').forEach(el => {
            const cx = parseFloat(el.getAttribute('cx') || 0);
            const cy = parseFloat(el.getAttribute('cy') || 0);
            const rx = parseFloat(el.getAttribute('rx') || 0);
            const ry = parseFloat(el.getAttribute('ry') || 0);
            if (rx > 0 && ry > 0) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`);
                if (el.hasAttribute('fill')) path.setAttribute('fill', el.getAttribute('fill'));
                el.parentNode.replaceChild(path, el);
            }
        });

        // 4. Polígonos
        svgEl.querySelectorAll('polygon').forEach(poly => {
            const pts = (poly.getAttribute('points') || '').trim().split(/[\s,]+/);
            if (pts.length >= 4) {
                let d = `M ${pts[0]} ${pts[1]}`;
                for (let i = 2; i < pts.length - 1; i += 2) {
                    d += ` L ${pts[i]} ${pts[i + 1]}`;
                }
                d += ' Z';
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', d);
                if (poly.hasAttribute('fill')) path.setAttribute('fill', poly.getAttribute('fill'));
                poly.parentNode.replaceChild(path, poly);
            }
        });
    }

    /**
     * Parseo con THREE.SVGLoader (ultra preciso para curvas Bézier y arcos)
     */
    parseWithThreeSVGLoader(svgString) {
        const loader = new window.THREE.SVGLoader();
        const svgData = loader.parse(svgString);
        const paths = svgData.paths;
        const islands = [];
        let islandCounter = 0;

        for (const path of paths) {
            const shapes = loader.createShapes ? loader.createShapes(path) : window.THREE.SVGLoader.createShapes(path);

            for (const shape of shapes) {
                // Puntos del contorno exterior
                const outerPoints = shape.getPoints(24).map(p => [p.x, -p.y]); // Invertir Y para coordenadas estándar
                if (outerPoints.length < 3) continue;

                // Orificios (holes)
                const holes = [];
                if (shape.holes && shape.holes.length > 0) {
                    for (const holePath of shape.holes) {
                        const holePts = holePath.getPoints(24).map(p => [p.x, -p.y]);
                        if (holePts.length >= 3) {
                            holes.push(simplifyPolygon(holePts, 0.4));
                        }
                    }
                }

                const simplifiedOuter = simplifyPolygon(outerPoints, 0.4);
                const bbox = getBoundingBox(simplifiedOuter);
                const centroid = this.calculateCentroid(simplifiedOuter);

                islands.push({
                    id: `svg_island_${islandCounter++}`,
                    outer: simplifiedOuter,
                    holes: holes,
                    bbox: bbox,
                    centroid: centroid,
                    area: Math.abs(this.calculatePolygonArea(simplifiedOuter))
                });
            }
        }

        // Si no se encontraron formas con SVGLoader, intentar rasterizado de fallback
        if (islands.length === 0) {
            this.parseViaCanvasRender(svgString);
            return;
        }

        this.parsedIslands = islands;
    }

    /**
     * Fallback por canvas en caso de SVGs con estilos inline complejos o gradientes
     */
    parseViaCanvasRender(svgString) {
        // En caso de que no haya formas vectoriales directas, renderizamos a canvas 2D
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = Math.round(600 * (img.height / img.width || 1));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(blobURL);
        };
        img.src = blobURL;
    }

    /**
     * Parsea elementos nativos como <rect>, <circle>, <polygon>, <path>
     */
    parseNative(doc) {
        const elements = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        const islands = [];
        let idCounter = 0;

        elements.forEach(el => {
            let points = [];
            const tag = el.tagName.toLowerCase();

            if (tag === 'rect') {
                const x = parseFloat(el.getAttribute('x') || 0);
                const y = -parseFloat(el.getAttribute('y') || 0);
                const w = parseFloat(el.getAttribute('width') || 0);
                const h = parseFloat(el.getAttribute('height') || 0);
                points = [[x, y], [x + w, y], [x + w, y - h], [x, y - h]];
            } else if (tag === 'circle') {
                const cx = parseFloat(el.getAttribute('cx') || 0);
                const cy = -parseFloat(el.getAttribute('cy') || 0);
                const r = parseFloat(el.getAttribute('r') || 0);
                const segments = 32;
                for (let i = 0; i < segments; i++) {
                    const th = (i / segments) * Math.PI * 2;
                    points.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r]);
                }
            } else if (tag === 'polygon' || tag === 'polyline') {
                const rawPts = (el.getAttribute('points') || '').trim().split(/[\s,]+/);
                for (let i = 0; i < rawPts.length - 1; i += 2) {
                    points.push([parseFloat(rawPts[i]), -parseFloat(rawPts[i + 1])]);
                }
            }

            if (points.length >= 3) {
                const bbox = getBoundingBox(points);
                islands.push({
                    id: `island_native_${idCounter++}`,
                    outer: points,
                    holes: [],
                    bbox: bbox,
                    centroid: this.calculateCentroid(points),
                    area: Math.abs(this.calculatePolygonArea(points))
                });
            }
        });

        this.parsedIslands = islands;
    }

    /**
     * Escala y centra las islas para que encajen perfectamente en el área interior del marco
     */
    normalizeAndFit(targetWidth, targetHeight, margin = 4, rotationDeg = 0, flipX = false, flipY = false) {
        if (!this.parsedIslands || this.parsedIslands.length === 0) return [];

        // Calcular Bounding Box global de todas las islas
        let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
        for (const isl of this.parsedIslands) {
            if (isl.bbox.minX < gMinX) gMinX = isl.bbox.minX;
            if (isl.bbox.minY < gMinY) gMinY = isl.bbox.minY;
            if (isl.bbox.maxX > gMaxX) gMaxX = isl.bbox.maxX;
            if (isl.bbox.maxY > gMaxY) gMaxY = isl.bbox.maxY;
        }

        const rawW = gMaxX - gMinX || 1;
        const rawH = gMaxY - gMinY || 1;
        const cxRaw = (gMinX + gMaxX) / 2;
        const cyRaw = (gMinY + gMaxY) / 2;

        // Área disponible
        const availW = Math.max(10, targetWidth - margin * 2);
        const availH = Math.max(10, targetHeight - margin * 2);

        // Factor de escala uniforme
        const scale = Math.min(availW / rawW, availH / rawH);

        const rotRad = (rotationDeg * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        const transformPoint = (p) => {
            // 1. Centrar en origen
            let x = p[0] - cxRaw;
            let y = p[1] - cyRaw;

            // 2. Espejos
            if (flipX) x = -x;
            if (flipY) y = -y;

            // 3. Rotación
            const rx = x * cosR - y * sinR;
            const ry = x * sinR + y * cosR;

            // 4. Escala
            const sx = rx * scale;
            const sy = ry * scale;

            // 5. Centrar en el área del marco
            return [sx + targetWidth / 2, sy + targetHeight / 2];
        };

        const fittedIslands = this.parsedIslands.map((isl, idx) => {
            const newOuter = isl.outer.map(transformPoint);
            const newHoles = isl.holes.map(h => h.map(transformPoint));
            const newBbox = getBoundingBox(newOuter);
            const newCentroid = this.calculateCentroid(newOuter);

            return {
                id: isl.id || `island_${idx}`,
                outer: newOuter,
                holes: newHoles,
                bbox: newBbox,
                centroid: newCentroid,
                area: Math.abs(this.calculatePolygonArea(newOuter))
            };
        });

        return fittedIslands;
    }

    calculateCentroid(points) {
        let cx = 0, cy = 0;
        for (const p of points) {
            cx += p[0];
            cy += p[1];
        }
        return [cx / points.length, cy / points.length];
    }

    calculatePolygonArea(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i][0] * points[j][1];
            area -= points[j][0] * points[i][1];
        }
        return area / 2;
    }

    getAnalysisSummary() {
        return {
            totalIslands: this.parsedIslands.length,
            totalHoles: this.parsedIslands.reduce((acc, isl) => acc + isl.holes.length, 0),
            viewBox: this.viewBox,
            islands: this.parsedIslands
        };
    }
}
