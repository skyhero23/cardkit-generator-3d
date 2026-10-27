/**
 * Motor de Generación del Marco (Frame) y Personalización de Texto
 * Permite personalizar dimensiones, esquinas redondeadas, orificio para llavero,
 * y grabar/estampar texto en relieve, bajo relieve o calado en los bordes del marco.
 */

import { traceCanvasText } from './marchingSquares.js';

export class FrameEngine {
    constructor() {
        this.config = {
            width: 100,             // Ancho total en mm
            height: 70,             // Alto total en mm
            thickness: 2.0,         // Grosor/altura Z en mm
            borderWidth: 6.0,       // Ancho del borde exterior en mm
            cornerRadius: 4.0,      // Radio de esquinas redondeadas
            hasHangerHole: false,   // Orificio para llavero / colgante
            hangerHoleDiameter: 4.0,// Diámetro del orificio en mm
            hangerCorner: 'top_left',// Posición del orificio
            // Personalización de texto en el marco
            topText: '',            // Texto en el borde superior
            bottomText: '',         // Texto en el borde inferior
            textStyle: 'embossed',  // 'embossed' (relieve), 'engraved' (bajo relieve), 'cutout' (calado)
            fontFamily: 'Inter',
            fontWeight: 'bold',
            embossHeight: 0.6       // Altura del relieve en mm
        };
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Retorna los límites interiores del marco (área libre para piezas)
     */
    getInnerBounds() {
        const bw = this.config.borderWidth;
        return {
            minX: bw,
            minY: bw,
            maxX: this.config.width - bw,
            maxY: this.config.height - bw,
            width: Math.max(1, this.config.width - bw * 2),
            height: Math.max(1, this.config.height - bw * 2)
        };
    }

    /**
     * Genera el polígono del contorno exterior con esquinas redondeadas
     */
    getOuterPolygon() {
        const { width: W, height: H, cornerRadius: R } = this.config;
        const r = Math.min(R, W / 2, H / 2);
        if (r <= 0.1) {
            return [[0, 0], [W, 0], [W, H], [0, H]];
        }

        const points = [];
        const segs = 8;

        // Esquina inferior-izquierda (0, 0)
        for (let i = 0; i <= segs; i++) {
            const a = Math.PI + (i / segs) * (Math.PI / 2);
            points.push([r + Math.cos(a) * r, r + Math.sin(a) * r]);
        }
        // Esquina inferior-derecha (W, 0)
        for (let i = 0; i <= segs; i++) {
            const a = Math.PI * 1.5 + (i / segs) * (Math.PI / 2);
            points.push([W - r + Math.cos(a) * r, r + Math.sin(a) * r]);
        }
        // Esquina superior-derecha (W, H)
        for (let i = 0; i <= segs; i++) {
            const a = 0 + (i / segs) * (Math.PI / 2);
            points.push([W - r + Math.cos(a) * r, H - r + Math.sin(a) * r]);
        }
        // Esquina superior-izquierda (0, H)
        for (let i = 0; i <= segs; i++) {
            const a = Math.PI / 2 + (i / segs) * (Math.PI / 2);
            points.push([r + Math.cos(a) * r, H - r + Math.sin(a) * r]);
        }

        return points;
    }

    /**
     * Genera el polígono del recorte interior (hueco del marco)
     */
    getInnerHolePolygon() {
        const bounds = this.getInnerBounds();
        // Sentido horario para holes en earcut
        return [
            [bounds.minX, bounds.minY],
            [bounds.minX, bounds.maxY],
            [bounds.maxX, bounds.maxY],
            [bounds.maxX, bounds.minY]
        ];
    }

    /**
     * Genera el orificio para llavero si está habilitado
     */
    getHangerHolePolygon() {
        if (!this.config.hasHangerHole) return null;

        const bw = this.config.borderWidth;
        const r = this.config.hangerHoleDiameter / 2;
        let cx = bw / 2;
        let cy = this.config.height - bw / 2;

        if (this.config.hangerCorner === 'top_right') {
            cx = this.config.width - bw / 2;
        } else if (this.config.hangerCorner === 'bottom_left') {
            cy = bw / 2;
        } else if (this.config.hangerCorner === 'bottom_right') {
            cx = this.config.width - bw / 2;
            cy = bw / 2;
        }

        const pts = [];
        const segs = 16;
        for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return pts;
    }

    /**
     * Genera las islas de texto personalizadas sobre el marco
     */
    generateFrameTextIslands() {
        const textIslands = [];
        const bw = this.config.borderWidth;
        const fontName = this.config.fontFamily || 'Inter';

        // 1. Texto Superior
        if (this.config.topText && this.config.topText.trim().length > 0) {
            const rawIslands = traceCanvasText(this.config.topText.trim(), fontName, 80, this.config.fontWeight);
            const positioned = this.positionTextOnBorder(rawIslands, 'top');
            textIslands.push(...positioned);
        }

        // 2. Texto Inferior
        if (this.config.bottomText && this.config.bottomText.trim().length > 0) {
            const rawIslands = traceCanvasText(this.config.bottomText.trim(), fontName, 80, this.config.fontWeight);
            const positioned = this.positionTextOnBorder(rawIslands, 'bottom');
            textIslands.push(...positioned);
        }

        return textIslands;
    }

    /**
     * Ajusta la posición del texto centrado verticalmente en el borde superior o inferior
     */
    positionTextOnBorder(islands, position) {
        if (!islands || islands.length === 0) return [];

        // Bounding box global del texto generado
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const isl of islands) {
            for (const p of isl.outer) {
                if (p[0] < minX) minX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] > maxY) maxY = p[1];
            }
        }

        const rawW = maxX - minX || 1;
        const rawH = maxY - minY || 1;
        const bw = this.config.borderWidth;

        // El alto del texto no debe superar el 65% del ancho del borde
        const targetH = bw * 0.62;
        const maxAvailW = this.config.width - bw * 3;
        const scale = Math.min(targetH / rawH, maxAvailW / rawW);

        const cxRaw = (minX + maxX) / 2;
        const cyRaw = (minY + maxY) / 2;

        const targetCenterX = this.config.width / 2;
        const targetCenterY = position === 'top' 
            ? this.config.height - bw / 2 
            : bw / 2;

        return islands.map((isl, idx) => {
            const transform = (p) => {
                const sx = (p[0] - cxRaw) * scale;
                // Invertir Y porque el canvas tiene Y hacia abajo
                const sy = -(p[1] - cyRaw) * scale;
                return [targetCenterX + sx, targetCenterY + sy];
            };

            return {
                id: `frame_text_${position}_${idx}`,
                outer: isl.outer.map(transform),
                holes: isl.holes.map(h => h.map(transform)),
                isFrameText: true,
                position: position,
                style: this.config.textStyle
            };
        });
    }
}
