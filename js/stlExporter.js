/**
 * Generador y Exportador de Archivos STL Binario de Alto Rendimiento
 * Produce modelos 3D sólidos y estancos (manifold) listos para impresión 3D (FDM / Resina).
 */

import { earcut } from './earcut.js';

export class STLExporter {
    /**
     * Construye la geometría 3D completa del CardKit (Marco + Islas + Conectores + Texto de Marco)
     * y genera un Blob binario STL.
     */
    static exportCardKitBinarySTL(frameData, islands, connectors, frameTextIslands = []) {
        const triangles = [];

        // 1. Triangular y extruir el Marco Principal (con recorte interior y orificio de llavero)
        this.extrudeFrame(triangles, frameData);

        // 2. Triangular y extruir las Islas (Letras o piezas SVG)
        for (const island of islands) {
            this.extrudePolygonWithHoles(
                triangles,
                island.outer,
                island.holes || [],
                0,
                frameData.pieceThickness || frameData.thickness
            );
        }

        // 3. Triangular y extruir los Conectores (Sprues / Runners)
        for (const conn of connectors) {
            this.extrudeConnector(triangles, conn, frameData.thickness);
        }

        // 4. Triangular y extruir el Texto de personalización del Marco
        for (const ft of frameTextIslands) {
            if (ft.style === 'embossed') {
                // Relieve: se extruye desde la superficie del marco (Z = thickness) hacia arriba
                this.extrudePolygonWithHoles(
                    triangles,
                    ft.outer,
                    ft.holes || [],
                    frameData.thickness,
                    frameData.thickness + (frameData.embossHeight || 0.6)
                );
            }
        }

        // Generar ArrayBuffer binario STL
        const buffer = this.buildBinarySTLBuffer(triangles);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });

        // Calcular estadísticas físicas
        const stats = this.calculateMeshStats(triangles);

        return {
            blob: blob,
            stats: stats,
            triangleCount: triangles.length
        };
    }

    /**
     * Extruye el marco exterior con su orificio interior y orificio de llavero
     */
    static extrudeFrame(triangles, frameData) {
        const outerPoly = frameData.outerPolygon;
        const innerHole = frameData.innerHole;
        const hangerHole = frameData.hangerHole;

        const holes = [innerHole];
        if (hangerHole) holes.push(hangerHole);

        this.extrudePolygonWithHoles(triangles, outerPoly, holes, 0, frameData.thickness);
    }

    /**
     * Extruye un polígono 2D con huecos a una altura Zmin -> Zmax
     */
    static extrudePolygonWithHoles(triangles, outer, holes = [], zMin, zMax) {
        if (!outer || outer.length < 3) return;

        // Aplanar coordenadas para earcut: [x0, y0, x1, y1, ...]
        const flatCoords = [];
        const holeIndices = [];

        for (const p of outer) {
            flatCoords.push(p[0], p[1]);
        }

        for (const h of holes) {
            if (h && h.length >= 3) {
                holeIndices.push(flatCoords.length / 2);
                for (const p of h) {
                    flatCoords.push(p[0], p[1]);
                }
            }
        }

        // Triangulación de la cara 2D
        const indices = earcut(flatCoords, holeIndices, 2);

        // Cara Inferior (Z = zMin) - Normal hacia abajo [0, 0, -1]
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i] * 2;
            const i1 = indices[i + 1] * 2;
            const i2 = indices[i + 2] * 2;

            triangles.push({
                n: [0, 0, -1],
                v1: [flatCoords[i0], flatCoords[i0 + 1], zMin],
                v2: [flatCoords[i2], flatCoords[i2 + 1], zMin], // orden invertido para normal hacia abajo
                v3: [flatCoords[i1], flatCoords[i1 + 1], zMin]
            });
        }

        // Cara Superior (Z = zMax) - Normal hacia arriba [0, 0, 1]
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i] * 2;
            const i1 = indices[i + 1] * 2;
            const i2 = indices[i + 2] * 2;

            triangles.push({
                n: [0, 0, 1],
                v1: [flatCoords[i0], flatCoords[i0 + 1], zMax],
                v2: [flatCoords[i1], flatCoords[i1 + 1], zMax],
                v3: [flatCoords[i2], flatCoords[i2 + 1], zMax]
            });
        }

        // Paredes laterales del contorno exterior
        this.buildWallTriangles(triangles, outer, zMin, zMax, false);

        // Paredes laterales de los huecos (orificios)
        for (const h of holes) {
            if (h && h.length >= 3) {
                this.buildWallTriangles(triangles, h, zMin, zMax, true);
            }
        }
    }

    /**
     * Construye las caras de pared entre Zmin y Zmax para un bucle de puntos
     */
    static buildWallTriangles(triangles, points, zMin, zMax, isHole) {
        const len = points.length;
        for (let i = 0; i < len; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % len];

            // Normal en el plano XY perpendicular al segmento
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const segLen = Math.sqrt(dx * dx + dy * dy) || 1;
            let nx = -dy / segLen;
            let ny = dx / segLen;

            if (isHole) {
                nx = -nx;
                ny = -ny;
            }

            const normal = [nx, ny, 0];

            if (!isHole) {
                // Triángulo 1
                triangles.push({
                    n: normal,
                    v1: [p1[0], p1[1], zMin],
                    v2: [p2[0], p2[1], zMin],
                    v3: [p2[0], p2[1], zMax]
                });
                // Triángulo 2
                triangles.push({
                    n: normal,
                    v1: [p1[0], p1[1], zMin],
                    v2: [p2[0], p2[1], zMax],
                    v3: [p1[0], p1[1], zMax]
                });
            } else {
                // Invertir orden de devanado para orificios
                triangles.push({
                    n: normal,
                    v1: [p1[0], p1[1], zMin],
                    v2: [p2[0], p2[1], zMax],
                    v3: [p2[0], p2[1], zMin]
                });
                triangles.push({
                    n: normal,
                    v1: [p1[0], p1[1], zMin],
                    v2: [p1[0], p1[1], zMax],
                    v3: [p2[0], p2[1], zMax]
                });
            }
        }
    }

    /**
     * Extruye un conector (sprue) con muesca en V opcional
     */
    static extrudeConnector(triangles, conn, cardThickness) {
        const [x1, y1] = conn.start;
        const [x2, y2] = conn.end;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) return;

        const ux = dx / len;
        const uy = dy / len;
        // Perpendicular
        const px = -uy;
        const py = ux;

        const halfW = conn.width / 2;
        const connHeight = conn.height || (cardThickness * 0.7);

        // Si tiene muesca de desprendimiento (V-notch)
        if (conn.hasNotch && len > 2.0) {
            const notchDist = Math.min(1.0, len * 0.3);
            const notchLen = 0.8;
            const notchZ = Math.max(0.4, connHeight - (conn.notchDepth || 0.8));

            // Segmento 1: desde pieza hasta muesca (altura reducida)
            this.extrudeBoxSegment(triangles, 
                [x1, y1], 
                [x1 + ux * notchDist, y1 + uy * notchDist], 
                px, py, halfW * 0.8, 0, notchZ);

            // Segmento 2: cuerpo principal del conector hasta el marco (altura completa)
            this.extrudeBoxSegment(triangles, 
                [x1 + ux * (notchDist + notchLen), y1 + uy * (notchDist + notchLen)], 
                [x2, y2], 
                px, py, halfW, 0, connHeight);
        } else {
            // Conector recto uniforme
            this.extrudeBoxSegment(triangles, [x1, y1], [x2, y2], px, py, halfW, 0, connHeight);
        }
    }

    static extrudeBoxSegment(triangles, pStart, pEnd, px, py, halfW, zMin, zMax) {
        const c1 = [pStart[0] + px * halfW, pStart[1] + py * halfW];
        const c2 = [pEnd[0] + px * halfW, pEnd[1] + py * halfW];
        const c3 = [pEnd[0] - px * halfW, pEnd[1] - py * halfW];
        const c4 = [pStart[0] - px * halfW, pStart[1] - py * halfW];

        const boxPoly = [c1, c2, c3, c4];
        this.extrudePolygonWithHoles(triangles, boxPoly, [], zMin, zMax);
    }

    /**
     * Construye el buffer binario según el estándar STL (80 bytes de cabecera + uint32 conteo + 50 bytes por cara)
     */
    static buildBinarySTLBuffer(triangles) {
        const totalTriangles = triangles.length;
        const bufferSize = 84 + totalTriangles * 50;
        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);

        // Cabecera ASCII (80 bytes)
        const headerText = 'CardKit 3D Studio - Generador de Model Kits y Sprue Cards para Impresion 3D';
        for (let i = 0; i < 80; i++) {
            view.setUint8(i, i < headerText.length ? headerText.charCodeAt(i) : 32);
        }

        // Conteo de triángulos (Offset 80)
        view.setUint32(80, totalTriangles, true);

        // Escribir triángulos
        let offset = 84;
        for (let i = 0; i < totalTriangles; i++) {
            const t = triangles[i];

            // Normal Vector (12 bytes)
            view.setFloat32(offset, t.n[0] || 0, true);
            view.setFloat32(offset + 4, t.n[1] || 0, true);
            view.setFloat32(offset + 8, t.n[2] || 0, true);

            // Vértice 1 (12 bytes)
            view.setFloat32(offset + 12, t.v1[0], true);
            view.setFloat32(offset + 16, t.v1[1], true);
            view.setFloat32(offset + 20, t.v1[2], true);

            // Vértice 2 (12 bytes)
            view.setFloat32(offset + 24, t.v2[0], true);
            view.setFloat32(offset + 28, t.v2[1], true);
            view.setFloat32(offset + 32, t.v2[2], true);

            // Vértice 3 (12 bytes)
            view.setFloat32(offset + 36, t.v3[0], true);
            view.setFloat32(offset + 40, t.v3[1], true);
            view.setFloat32(offset + 44, t.v3[2], true);

            // Attribute byte count (2 bytes) = 0
            view.setUint16(offset + 48, 0, true);

            offset += 50;
        }

        return buffer;
    }

    /**
     * Calcula métricas físicas para impresión 3D (dimensiones mm, volumen cm3, peso en gramos PLA)
     */
    static calculateMeshStats(triangles) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let totalVolume = 0;

        for (const t of triangles) {
            for (const v of [t.v1, t.v2, t.v3]) {
                if (v[0] < minX) minX = v[0];
                if (v[1] < minY) minY = v[1];
                if (v[2] < minZ) minZ = v[2];
                if (v[0] > maxX) maxX = v[0];
                if (v[1] > maxY) maxY = v[1];
                if (v[2] > maxZ) maxZ = v[2];
            }

            // Volumen con producto mixto (Divergence theorem para mallas cerradas)
            const v321 = t.v3[0] * t.v2[1] * t.v1[2];
            const v231 = t.v2[0] * t.v3[1] * t.v1[2];
            const v312 = t.v3[0] * t.v1[1] * t.v2[2];
            const v132 = t.v1[0] * t.v3[1] * t.v2[2];
            const v213 = t.v2[0] * t.v1[1] * t.v3[2];
            const v123 = t.v1[0] * t.v2[1] * t.v3[2];
            totalVolume += (-v321 + v231 + v312 - v132 - v213 + v123) / 6.0;
        }

        const volMm3 = Math.max(0, Math.abs(totalVolume));
        const volCm3 = volMm3 / 1000.0;
        const densityPLA = 1.24; // g/cm3
        const weightGrams = volCm3 * densityPLA;

        // Tiempo estimado de impresión (aproximado para boquilla 0.4mm, capa 0.20mm, 60mm/s)
        const estimatedMinutes = Math.max(8, Math.round(weightGrams * 3.8 + 4));

        return {
            bounds: {
                x: Math.round((maxX - minX) * 10) / 10,
                y: Math.round((maxY - minY) * 10) / 10,
                z: Math.round((maxZ - minZ) * 10) / 10
            },
            volumeCm3: Math.round(volCm3 * 100) / 100,
            weightGrams: Math.round(weightGrams * 10) / 10,
            estimatedTimeMin: estimatedMinutes
        };
    }
}
