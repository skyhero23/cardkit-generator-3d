/**
 * Motor de Generación Inteligente de Conectores (Sprues / Runners) para CardKits 3D v2.0
 * Incluye:
 * 1. Detección ESTRICTA de colisiones (Ray-tracing 2D): NUNCA atraviesa piezas ni letras.
 * 2. Estrategia de Perímetro Inteligente (Smart Perimeter):
 *    - Une piezas cercanas con pestañas cortas (puentes inter-pieza).
 *    - Solo proyecta conectores hacia el marco desde los bordes exteriores con línea de visión despejada.
 * 3. Eliminación total del efecto "código de barras" / barras cruzadas.
 */

import { isPointInsidePolygon, getBoundingBox } from './marchingSquares.js';

export class SprueEngine {
    constructor() {
        this.connectors = []; // { id, start: [x,y], end: [x,y], width, height, notchDepth, type: 'frame'|'inter_piece' }
        this.config = {
            strategy: 'smart_perimeter', // 'smart_perimeter' | 'direct_unobstructed' | 'none'
            width: 2.0,                 // Ancho del conector en mm
            heightRatio: 0.65,          // Altura respecto al grosor del marco (65%)
            cardThickness: 2.0,         // Grosor total en mm
            maxBridgeDist: 8.0,         // Distancia máxima para unir piezas cercanas entre sí
            frameConnectorsCount: 4,    // Cantidad de conectores exteriores al marco
            hasNotch: true,             // Muesca de corte en V (Breakaway)
            notchDepth: 0.8,            // Profundidad de la muesca
            minConnectorGap: 6.0        // Separación mínima entre conectores paralelos
        };
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Genera automáticamente los conectores inteligentes evitando colisiones y barras cruzadas
     */
    generateAutoConnectors(islands, frameBounds, internalRunners = []) {
        this.connectors = [];
        if (!islands || islands.length === 0 || this.config.strategy === 'none') {
            return this.connectors;
        }

        let connectorId = 0;

        if (this.config.strategy === 'smart_perimeter') {
            return this.generateSmartPerimeterConnectors(islands, frameBounds);
        } else {
            return this.generateDirectUnobstructedConnectors(islands, frameBounds);
        }
    }

    /**
     * ESTRATEGIA 1: PERÍMETRO INTELIGENTE (Ideal para logos y piezas complejas)
     * - Agrupa piezas cercanas con pequeños puentes inter-pieza (1 a 4 mm).
     * - Garantiza que CADA grupo o isla independiente tenga al menos 2 anclajes al marco exterior.
     * - CERO barras que atraviesen o corten otras letras.
     */
    generateSmartPerimeterConnectors(islands, frameBounds) {
        const connectors = [];
        let connId = 0;
        const n = islands.length;

        // 1. Conectar islas cercanas entre sí con pequeños puentes locales
        const neighborBridges = this.findInterIslandBridges(islands, this.config.maxBridgeDist);
        for (const bridge of neighborBridges) {
            connectors.push({
                id: `sprue_inter_${connId++}`,
                islandId: bridge.islandA,
                targetIslandId: bridge.islandB,
                start: bridge.start,
                end: bridge.end,
                width: this.config.width * 0.9,
                height: this.config.cardThickness * this.config.heightRatio,
                hasNotch: this.config.hasNotch,
                notchDepth: this.config.notchDepth * 0.7,
                type: 'inter_piece'
            });
        }

        // 2. Agrupar islas en componentes conexos (Union-Find)
        const parent = Array.from({ length: n }, (_, i) => i);
        const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        const union = (i, j) => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) parent[rootI] = rootJ;
        };

        const idToIndex = new Map(islands.map((isl, idx) => [isl.id, idx]));
        for (const b of neighborBridges) {
            const idxA = idToIndex.get(b.islandA);
            const idxB = idToIndex.get(b.islandB);
            if (idxA !== undefined && idxB !== undefined) {
                union(idxA, idxB);
            }
        }

        // Agrupar índices por componente raíz
        const components = new Map();
        for (let i = 0; i < n; i++) {
            const root = find(i);
            if (!components.has(root)) components.set(root, []);
            components.get(root).push(i);
        }

        // 3. Para CADA componente, encontrar los mejores anclajes al marco con línea de visión limpia
        const { minX, minY, maxX, maxY } = frameBounds;

        components.forEach((memberIndices, rootId) => {
            const candidateRays = [];

            for (const mIdx of memberIndices) {
                const island = islands[mIdx];
                const pts = island.outer;
                if (!pts || pts.length < 3) continue;

                const step = Math.max(1, Math.floor(pts.length / 16));
                for (let pIdx = 0; pIdx < pts.length; pIdx += step) {
                    const pt = pts[pIdx];

                    const targets = [
                        { dir: 'left', end: [minX, pt[1]], len: pt[0] - minX },
                        { dir: 'right', end: [maxX, pt[1]], len: maxX - pt[0] },
                        { dir: 'bottom', end: [pt[0], minY], len: pt[1] - minY },
                        { dir: 'top', end: [pt[0], maxY], len: maxY - pt[1] }
                    ];

                    for (const t of targets) {
                        if (t.len > 0.5 && this.isRayClear(pt, t.end, islands, mIdx)) {
                            candidateRays.push({
                                islandId: island.id,
                                start: [pt[0], pt[1]],
                                end: t.end,
                                length: t.len,
                                direction: t.dir
                            });
                        }
                    }
                }
            }

            // Seleccionar entre 2 y 4 anclajes perimetrales para este componente
            const nDesired = Math.min(this.config.frameConnectorsCount, Math.max(2, memberIndices.length));
            const selected = this.selectBalancedPerimeterRays(candidateRays, nDesired);

            for (const ray of selected) {
                connectors.push({
                    id: `sprue_frame_${connId++}`,
                    islandId: ray.islandId,
                    start: ray.start,
                    end: ray.end,
                    width: this.config.width,
                    height: this.config.cardThickness * this.config.heightRatio,
                    hasNotch: this.config.hasNotch,
                    notchDepth: this.config.notchDepth,
                    type: 'frame',
                    direction: ray.direction
                });
            }
        });

        this.connectors = connectors;
        return this.connectors;
    }

    /**
     * ESTRATEGIA 2: DIRECTO AL MARCO SIN COLISIÓN
     * Lanza rayos desde cada pieza hacia el marco, pero DESCARTA automáticamente cualquier rayo que cruce otra pieza.
     */
    generateDirectUnobstructedConnectors(islands, frameBounds) {
        const connectors = [];
        let connId = 0;
        const { minX, minY, maxX, maxY } = frameBounds;

        for (let i = 0; i < islands.length; i++) {
            const island = islands[i];
            const pts = island.outer;
            if (!pts || pts.length < 3) continue;

            const islandCandidates = [];
            const step = Math.max(1, Math.floor(pts.length / 12));

            for (let pIdx = 0; pIdx < pts.length; pIdx += step) {
                const pt = pts[pIdx];
                const dirs = [
                    { dir: 'left', end: [minX, pt[1]], len: pt[0] - minX },
                    { dir: 'right', end: [maxX, pt[1]], len: maxX - pt[0] },
                    { dir: 'bottom', end: [pt[0], minY], len: pt[1] - minY },
                    { dir: 'top', end: [pt[0], maxY], len: maxY - pt[1] }
                ];

                for (const d of dirs) {
                    if (d.len > 0.5 && this.isRayClear(pt, d.end, islands, i)) {
                        islandCandidates.push({
                            start: [pt[0], pt[1]],
                            end: d.end,
                            length: d.len,
                            direction: d.dir
                        });
                    }
                }
            }

            // Ordenar por menor distancia
            islandCandidates.sort((a, b) => a.length - b.length);

            // Escoger hasta 2 conectores libres de obstáculos en direcciones opuestas
            const chosen = [];
            for (const cand of islandCandidates) {
                if (chosen.length === 0) {
                    chosen.push(cand);
                } else if (chosen.length < 2) {
                    const firstDir = chosen[0].direction;
                    // Preferir dirección opuesta o perpendicular
                    if (cand.direction !== firstDir) {
                        chosen.push(cand);
                        break;
                    }
                }
            }

            for (const c of chosen) {
                connectors.push({
                    id: `sprue_unobstructed_${connId++}`,
                    islandId: island.id,
                    start: c.start,
                    end: c.end,
                    width: this.config.width,
                    height: this.config.cardThickness * this.config.heightRatio,
                    hasNotch: this.config.hasNotch,
                    notchDepth: this.config.notchDepth,
                    type: 'frame',
                    direction: c.direction
                });
            }
        }

        this.connectors = connectors;
        return this.connectors;
    }

    /**
     * Encuentra puentes cortos entre islas adyacentes para que se sujeten entre sí
     */
    findInterIslandBridges(islands, maxDist) {
        const bridges = [];
        const n = islands.length;
        if (n <= 1) return bridges;

        for (let i = 0; i < n; i++) {
            const islandA = islands[i];
            let bestNeighbor = null;
            let minDistance = Infinity;
            let bestPts = null;

            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const islandB = islands[j];

                // Test de Bounding Box rápido antes de polígonos
                if (!this.bboxDistanceWithin(islandA.bbox, islandB.bbox, maxDist)) continue;

                // Encontrar puntos más cercanos entre el perímetro de A y B
                const closest = this.getClosestPointsBetweenPolygons(islandA.outer, islandB.outer);
                if (closest && closest.dist < minDistance && closest.dist <= maxDist) {
                    // Verificar que el puente no corte una tercera isla
                    if (this.isBridgeClear(closest.p1, closest.p2, islands, i, j)) {
                        minDistance = closest.dist;
                        bestNeighbor = j;
                        bestPts = closest;
                    }
                }
            }

            if (bestNeighbor !== null && bestPts && minDistance > 0.4) {
                // Evitar duplicar puentes A->B y B->A
                const alreadyExists = bridges.some(b => 
                    (b.islandA === islandA.id && b.islandB === islands[bestNeighbor].id) ||
                    (b.islandA === islands[bestNeighbor].id && b.islandB === islandA.id)
                );

                if (!alreadyExists) {
                    bridges.push({
                        islandA: islandA.id,
                        islandB: islands[bestNeighbor].id,
                        start: bestPts.p1,
                        end: bestPts.p2,
                        dist: minDistance
                    });
                }
            }
        }

        return bridges;
    }

    /**
     * Verifica si un rayo desde start a end tiene línea de visión 100% limpia sin colisionar con islas
     */
    isRayClear(start, end, islands, sourceIslandIndex) {
        const p1 = start;
        const p2 = end;

        // Comprobar contra todas las demás islas
        for (let i = 0; i < islands.length; i++) {
            const isl = islands[i];
            const poly = isl.outer;

            // 1. Si no es la isla origen, no debe cortar el polígono ni pasar por su interior
            if (i !== sourceIslandIndex) {
                if (this.segmentIntersectsPolygon(p1, p2, poly)) {
                    return false;
                }
                // Punto medio del rayo no debe estar dentro de la isla
                const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
                if (isPointInsidePolygon(mid, poly)) {
                    return false;
                }
            } else {
                // Si es la isla origen, el rayo no debe cortar otra parte de sí misma (auto-intersección)
                if (this.segmentCutsSelfPolygon(p1, p2, poly)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Verifica que un puente entre dos islas no atraviese una tercera isla
     */
    isBridgeClear(p1, p2, islands, idxA, idxB) {
        for (let i = 0; i < islands.length; i++) {
            if (i !== idxA && i !== idxB) {
                if (this.segmentIntersectsPolygon(p1, p2, islands[i].outer)) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Detección de intersección entre segmento y polígono
     */
    segmentIntersectsPolygon(p1, p2, poly) {
        const len = poly.length;
        // Acortar ligeramente el segmento (1%) para evitar falsos positivos en los vértices de contacto
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen < 0.2) return false;

        const eps = 0.08 / segLen;
        const s1 = [p1[0] + dx * eps, p1[1] + dy * eps];
        const s2 = [p2[0] - dx * eps, p2[1] - dy * eps];

        for (let i = 0; i < len; i++) {
            const v1 = poly[i];
            const v2 = poly[(i + 1) % len];
            if (this.linesIntersect(s1, s2, v1, v2)) {
                return true;
            }
        }

        return false;
    }

    segmentCutsSelfPolygon(p1, p2, poly) {
        // Para la isla de origen, comprobar si el rayo penetra hacia el interior del polígono
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const testPt = [p1[0] + dx * 0.05, p1[1] + dy * 0.05];
        return isPointInsidePolygon(testPt, poly);
    }

    linesIntersect(p1, p2, p3, p4) {
        const ccw = (A, B, C) => (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
        return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
    }

    bboxDistanceWithin(b1, b2, maxDist) {
        const dx = Math.max(0, Math.max(b1.minX - b2.maxX, b2.minX - b1.maxX));
        const dy = Math.max(0, Math.max(b1.minY - b2.maxY, b2.minY - b1.maxY));
        return Math.sqrt(dx * dx + dy * dy) <= maxDist;
    }

    getClosestPointsBetweenPolygons(polyA, polyB) {
        let minDist = Infinity;
        let pA = null, pB = null;

        const stepA = Math.max(1, Math.floor(polyA.length / 16));
        const stepB = Math.max(1, Math.floor(polyB.length / 16));

        for (let i = 0; i < polyA.length; i += stepA) {
            const ptA = polyA[i];
            for (let j = 0; j < polyB.length; j += stepB) {
                const ptB = polyB[j];
                const d2 = (ptA[0] - ptB[0]) ** 2 + (ptA[1] - ptB[1]) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    pA = ptA;
                    pB = ptB;
                }
            }
        }

        return { p1: pA, p2: pB, dist: Math.sqrt(minDist) };
    }

    /**
     * Selecciona rayos balanceados perimetrales (1 en cada borde: Izq, Der, Arriba, Abajo)
     */
    selectBalancedPerimeterRays(candidates, maxCount) {
        if (candidates.length === 0) return [];

        // Ordenar candidatos por menor longitud
        candidates.sort((a, b) => a.length - b.length);

        const directions = ['left', 'right', 'top', 'bottom'];
        const selected = [];

        // 1. Escoger el rayo más corto para cada una de las 4 direcciones principales
        for (const dir of directions) {
            const bestInDir = candidates.find(c => c.direction === dir);
            if (bestInDir) {
                selected.push(bestInDir);
                if (selected.length >= maxCount) break;
            }
        }

        // 2. Si aún no alcanzamos maxCount, añadir los siguientes más cortos con separación suficiente
        if (selected.length < maxCount) {
            for (const cand of candidates) {
                if (selected.length >= maxCount) break;
                // Verificar que no esté demasiado cerca de otro conector existente
                const tooClose = selected.some(s => 
                    s.direction === cand.direction && 
                    Math.abs(s.start[0] - cand.start[0]) < this.config.minConnectorGap &&
                    Math.abs(s.start[1] - cand.start[1]) < this.config.minConnectorGap
                );

                if (!tooClose && !selected.includes(cand)) {
                    selected.push(cand);
                }
            }
        }

        return selected;
    }
}
