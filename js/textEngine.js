/**
 * Motor de Generación y Disposición de Letras y Tipografías 3D para CardKit
 * Soporta decenas de fuentes de Google Fonts, fuentes de sistema y fuentes TTF/OTF personalizadas.
 * Permite escalar letras, ajustar espaciado (kerning), interlineado y modos de distribución.
 */

import { traceCanvasText } from './marchingSquares.js';

export const FONT_CATALOGUE = [
    { name: 'Inter', category: 'Sans-Serif', family: 'Inter', weight: 'bold' },
    { name: 'Roboto Black', category: 'Sans-Serif', family: 'Roboto', weight: '900' },
    { name: 'Montserrat Bold', category: 'Sans-Serif', family: 'Montserrat', weight: '900' },
    { name: 'Poppins ExtraBold', category: 'Sans-Serif', family: 'Poppins', weight: '800' },
    { name: 'Anton (Impactante)', category: 'Sans-Serif', family: 'Anton', weight: 'bold' },
    { name: 'Righteous (Moderna)', category: 'Display', family: 'Righteous', weight: 'bold' },
    { name: 'Bangers (Estilo Cómic)', category: 'Display', family: 'Bangers', weight: 'bold' },
    { name: 'Bungee (Bloque 3D)', category: 'Display', family: 'Bungee', weight: 'bold' },
    { name: 'Alfa Slab One (Gruesa)', category: 'Display', family: 'Alfa Slab One', weight: 'bold' },
    { name: 'Pacifico (Cursiva suave)', category: 'Script', family: 'Pacifico', weight: 'bold' },
    { name: 'Lobster (Cursiva vintage)', category: 'Script', family: 'Lobster', weight: 'bold' },
    { name: 'Dancing Script', category: 'Script', family: 'Dancing Script', weight: 'bold' },
    { name: 'Caveat (Manuscrita)', category: 'Script', family: 'Caveat', weight: 'bold' },
    { name: 'Orbitron (Futurista Sci-Fi)', category: 'Futurista', family: 'Orbitron', weight: '900' },
    { name: 'Russo One (Gamer)', category: 'Futurista', family: 'Russo One', weight: 'bold' },
    { name: 'Press Start 2P (Retro 8-Bit)', category: 'Pixel', family: 'Press Start 2P', weight: 'bold' },
    { name: 'Silkscreen (Pixel moderna)', category: 'Pixel', family: 'Silkscreen', weight: 'bold' },
    { name: 'Cinzel (Elegante Romana)', category: 'Serif', family: 'Cinzel', weight: 'bold' },
    { name: 'Playfair Display', category: 'Serif', family: 'Playfair Display', weight: 'bold' }
];

export class TextEngine {
    constructor() {
        this.config = {
            text: 'A B C D E',
            fontFamily: 'Inter',
            fontWeight: 'bold',
            fontSize: 22,             // Altura de letra en mm
            letterSpacing: 4.0,       // Separación horizontal entre letras en mm
            rowSpacing: 6.0,          // Separación vertical entre líneas en mm
            letterThickness: 2.0,     // Grosor/altura Z en mm
            layoutMode: 'individual', // 'individual' (piezas separadas en rejilla) o 'connected' (texto continuo)
            autoFit: true             // Ajusta automáticamente el tamaño si se desborda del marco
        };
        this.customFonts = [];
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Carga una fuente personalizada (.ttf, .otf, .woff) usando FontFace API
     */
    async loadCustomFont(file) {
        const fontName = `Custom_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const buffer = await file.arrayBuffer();
        const fontFace = new FontFace(fontName, buffer);
        await fontFace.load();
        document.fonts.add(fontFace);

        this.customFonts.push({
            name: `📁 ${file.name}`,
            category: 'Personalizada',
            family: fontName,
            weight: 'normal'
        });

        this.config.fontFamily = fontName;
        return fontName;
    }

    /**
     * Genera las letras 2D como islas vectoriales ubicadas dentro del área libre del marco
     */
    generateLetters(innerBounds) {
        const text = this.config.text || '';
        if (!text.trim()) return [];

        if (this.config.layoutMode === 'connected') {
            return this.generateConnectedText(innerBounds);
        } else {
            return this.generateIndividualLetterGrid(innerBounds);
        }
    }

    /**
     * Modo Rejilla / Letras Individuales
     * Cada letra es una pieza independiente con espacio para conectores
     */
    generateIndividualLetterGrid(innerBounds) {
        // Eliminar saltos dobles innecesarios pero permitir separación de palabras o letras
        const characters = this.config.text.split('').filter(c => c !== ' ' && c !== '\n');
        if (characters.length === 0) return [];

        const font = this.config.fontFamily;
        const weight = this.config.fontWeight;

        // Vectorizar cada caracter individualmente
        const charIslands = [];
        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            const rawIslands = traceCanvasText(char, font, 120, weight);
            if (rawIslands.length > 0) {
                // Una letra puede tener varias partes (ej. la 'i' tiene el cuerpo y el punto)
                charIslands.push({
                    char: char,
                    islands: rawIslands
                });
            }
        }

        if (charIslands.length === 0) return [];

        // Calcular distribución óptima en filas y columnas
        const count = charIslands.length;
        const availW = innerBounds.width;
        const availH = innerBounds.height;

        // Estimar columnas y filas ideales según la relación de aspecto del marco
        const aspect = availW / availH;
        let cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
        let rows = Math.ceil(count / cols);

        // Si hay muchas columnas que no caben, ajustar
        if (cols > count) cols = count;

        let letterH = this.config.fontSize;
        const spacingX = this.config.letterSpacing;
        const spacingY = this.config.rowSpacing;

        // Auto-Fit si el texto sobrepasa los límites del marco
        const totalEstimatedW = cols * (letterH * 0.8) + (cols - 1) * spacingX;
        const totalEstimatedH = rows * letterH + (rows - 1) * spacingY;

        if (this.config.autoFit) {
            const scaleX = availW / (totalEstimatedW || 1);
            const scaleY = availH / (totalEstimatedH || 1);
            const fitScale = Math.min(1.0, scaleX, scaleY);
            if (fitScale < 1.0) {
                letterH = Math.max(8, letterH * fitScale * 0.92);
            }
        }

        const cellW = availW / cols;
        const cellH = availH / rows;

        const resultIslands = [];
        let itemIndex = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (itemIndex >= count) break;

                const item = charIslands[itemIndex];
                // Centro de la celda en coordenadas del marco
                // Invertimos Y para que la fila 0 sea la de arriba
                const cellCenterX = innerBounds.minX + (c + 0.5) * cellW;
                const cellCenterY = innerBounds.maxY - (r + 0.5) * cellH;

                // Calcular bounding box combinado de las islas de este caracter
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const isl of item.islands) {
                    for (const p of isl.outer) {
                        if (p[0] < minX) minX = p[0];
                        if (p[1] < minY) minY = p[1];
                        if (p[0] > maxX) maxX = p[0];
                        if (p[1] > maxY) maxY = p[1];
                    }
                }

                const rawH = maxY - minY || 1;
                const rawW = maxX - minX || 1;
                const charScale = letterH / rawH;
                const cRawX = (minX + maxX) / 2;
                const cRawY = (minY + maxY) / 2;

                // Transformar puntos al centro de la celda
                for (let partIdx = 0; partIdx < item.islands.length; partIdx++) {
                    const isl = item.islands[partIdx];
                    const transform = (p) => {
                        const sx = (p[0] - cRawX) * charScale;
                        const sy = -(p[1] - cRawY) * charScale; // Invertir Y del canvas
                        return [cellCenterX + sx, cellCenterY + sy];
                    };

                    const transformedOuter = isl.outer.map(transform);
                    const transformedHoles = isl.holes.map(h => h.map(transform));
                    
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const p of transformedOuter) {
                        if (p[0] < minX) minX = p[0];
                        if (p[1] < minY) minY = p[1];
                        if (p[0] > maxX) maxX = p[0];
                        if (p[1] > maxY) maxY = p[1];
                    }

                    resultIslands.push({
                        id: `letter_${itemIndex}_part_${partIdx}`,
                        char: item.char,
                        outer: transformedOuter,
                        holes: transformedHoles,
                        bbox: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
                        centroid: [cellCenterX, cellCenterY]
                    });
                }

                itemIndex++;
            }
        }

        return resultIslands;
    }

    /**
     * Modo Texto Continuo / Frase Conectada
     */
    generateConnectedText(innerBounds) {
        const text = this.config.text.trim();
        const font = this.config.fontFamily;
        const weight = this.config.fontWeight;

        const rawIslands = traceCanvasText(text, font, 140, weight);
        if (rawIslands.length === 0) return [];

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const isl of rawIslands) {
            for (const p of isl.outer) {
                if (p[0] < minX) minX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] > maxY) maxY = p[1];
            }
        }

        const rawW = maxX - minX || 1;
        const rawH = maxY - minY || 1;

        const availW = innerBounds.width - 6;
        const availH = innerBounds.height - 6;

        let scale = Math.min(availW / rawW, availH / rawH);
        if (!this.config.autoFit) {
            scale = this.config.fontSize / rawH;
        }

        const cRawX = (minX + maxX) / 2;
        const cRawY = (minY + maxY) / 2;
        const targetCenterX = innerBounds.minX + innerBounds.width / 2;
        const targetCenterY = innerBounds.minY + innerBounds.height / 2;

        return rawIslands.map((isl, idx) => {
            const transform = (p) => {
                const sx = (p[0] - cRawX) * scale;
                const sy = -(p[1] - cRawY) * scale;
                return [targetCenterX + sx, targetCenterY + sy];
            };

            const transformedOuter = isl.outer.map(transform);
            const transformedHoles = isl.holes.map(h => h.map(transform));

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of transformedOuter) {
                if (p[0] < minX) minX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] > maxY) maxY = p[1];
            }

            return {
                id: `connected_letter_${idx}`,
                outer: transformedOuter,
                holes: transformedHoles,
                bbox: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
                centroid: [(minX + maxX) / 2, (minY + maxY) / 2]
            };
        });
    }
}
