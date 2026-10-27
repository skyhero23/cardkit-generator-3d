/**
 * Motor de Generación Inteligente de Conectores (Sprues / Runners) para CardKits 3D
 * Conecta automáticamente islas de SVG y letras al marco o rieles internos.
 */

export class SprueEngine {
    constructor() {
        this.connectors = []; // Arreglo de conectores { id, start: [x,y], end: [x,y], width, height, notchDepth, islandId }
        this.config = {
            width: 2.0,            // Ancho del conector en mm
            heightRatio: 0.65,     // Altura respecto al grosor del marco (65%)
            cardThickness: 2.0,    // Grosor total en mm
            connectorsPerIsland: 2,// Cantidad por defecto
            hasNotch: true,        // Muesca de corte en V
            notchDepth: 0.8,       // Profundidad de la muesca en mm
            notchWidth: 0.8        // Ancho de la muesca a lo largo del conector
        };
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Genera automáticamente los conectores óptimos para una lista de islas y los límites del marco
     */
    generateAutoConnectors(islands, frameBounds, internalRunners = []) {
        this.connectors = [];
        if (!islands || islands.length === 0) return this.connectors;

        const { minX, minY, maxX, maxY } = frameBounds; // Límites interiores del marco
        let connectorId = 0;

        for (const island of islands) {
            const bbox = island.bbox;
            const points = island.outer;
            if (!points || points.length < 3) continue;

            const nConnectors = this.determineConnectorCount(island);
            const candidates = this.findCandidateConnectors(island, frameBounds, internalRunners);

            // Filtrar y ordenar los mejores candidatos (evitar colisiones y maximizar estabilidad)
            const chosen = this.selectBestConnectors(candidates, nConnectors);

            for (const cand of chosen) {
                this.connectors.push({
                    id: `sprue_${connectorId++}`,
                    islandId: island.id,
                    start: cand.start,   // Punto en el borde de la pieza
                    end: cand.end,       // Punto en el marco o runner
                    width: this.config.width,
                    height: this.config.cardThickness * this.config.heightRatio,
                    hasNotch: this.config.hasNotch,
                    notchDepth: this.config.notchDepth,
                    direction: cand.direction
                });
            }
        }

        return this.connectors;
    }

    /**
     * Determina la cantidad óptima de conectores según el tamaño de la isla
     */
    determineConnectorCount(island) {
        if (this.config.connectorsPerIsland !== 'auto') {
            return parseInt(this.config.connectorsPerIsland, 10) || 2;
        }

        const diag = Math.sqrt(island.bbox.width ** 2 + island.bbox.height ** 2);
        if (diag < 12) return 1;      // Letra pequeña o punto (ej. el punto de la 'i')
        if (diag < 35) return 2;      // Letra o pieza mediana estándar
        if (diag < 70) return 3;      // Pieza grande
        return 4;                     // Pieza muy grande o perímetro extenso
    }

    /**
     * Encuentra candidatos de conexión proyectando rayos en las 4 direcciones ortogonales
     */
    findCandidateConnectors(island, frameBounds, internalRunners) {
        const { minX, minY, maxX, maxY } = frameBounds;
        const candidates = [];
        const pts = island.outer;

        // Puntos extremos de la isla
        let pLeft = pts[0], pRight = pts[0], pBottom = pts[0], pTop = pts[0];
        for (const p of pts) {
            if (p[0] < pLeft[0]) pLeft = p;
            if (p[0] > pRight[0]) pRight = p;
            if (p[1] < pBottom[1]) pBottom = p;
            if (p[1] > pTop[1]) pTop = p;
        }

        // Rayo hacia la izquierda (Frame minX)
        candidates.push({
            direction: 'left',
            start: [pLeft[0], pLeft[1]],
            end: [minX, pLeft[1]],
            length: pLeft[0] - minX,
            opposingScore: 1
        });

        // Rayo hacia la derecha (Frame maxX)
        candidates.push({
            direction: 'right',
            start: [pRight[0], pRight[1]],
            end: [maxX, pRight[1]],
            length: maxX - pRight[0],
            opposingScore: 1
        });

        // Rayo hacia abajo (Frame minY)
        candidates.push({
            direction: 'bottom',
            start: [pBottom[0], pBottom[1]],
            end: [pBottom[0], minY],
            length: pBottom[1] - minY,
            opposingScore: 2
        });

        // Rayo hacia arriba (Frame maxY)
        candidates.push({
            direction: 'top',
            start: [pTop[0], pTop[1]],
            end: [pTop[0], maxY],
            length: maxY - pTop[1],
            opposingScore: 2
        });

        // Revisar conexiones hacia rieles / runners internos si existen
        if (internalRunners && internalRunners.length > 0) {
            for (const runner of internalRunners) {
                // Runner horizontal (y = runner.y)
                if (runner.type === 'horizontal') {
                    if (island.centroid[1] > runner.y) {
                        candidates.push({
                            direction: 'runner_down',
                            start: [pBottom[0], pBottom[1]],
                            end: [pBottom[0], runner.y],
                            length: Math.abs(pBottom[1] - runner.y),
                            opposingScore: 2
                        });
                    } else {
                        candidates.push({
                            direction: 'runner_up',
                            start: [pTop[0], pTop[1]],
                            end: [pTop[0], runner.y],
                            length: Math.abs(runner.y - pTop[1]),
                            opposingScore: 2
                        });
                    }
                }
            }
        }

        // Descartar candidatos con longitud negativa o nula
        return candidates.filter(c => c.length > 0.5);
    }

    /**
     * Selecciona el conjunto de conectores más equilibrado y corto
     */
    selectBestConnectors(candidates, count) {
        if (candidates.length <= count) return candidates;

        // Ordenar por menor longitud
        candidates.sort((a, b) => a.length - b.length);

        if (count === 1) {
            return [candidates[0]];
        }

        if (count === 2) {
            // Intentar elegir un par de soporte opuesto (ej: Izquierda + Derecha o Arriba + Abajo)
            const first = candidates[0];
            const oppositeDir = this.getOppositeDirection(first.direction);

            const second = candidates.find(c => c.direction === oppositeDir) || candidates[1];
            return [first, second];
        }

        // Si son 3 o 4, seleccionar los más cortos cubriendo distintas direcciones
        const selected = [];
        const usedDirs = new Set();

        for (const c of candidates) {
            if (!usedDirs.has(c.direction)) {
                selected.push(c);
                usedDirs.add(c.direction);
                if (selected.length === count) break;
            }
        }

        // Si aún faltan, rellenar con los restantes
        for (const c of candidates) {
            if (selected.length >= count) break;
            if (!selected.includes(c)) selected.push(c);
        }

        return selected;
    }

    getOppositeDirection(dir) {
        switch (dir) {
            case 'left': return 'right';
            case 'right': return 'left';
            case 'top': return 'bottom';
            case 'bottom': return 'top';
            case 'runner_down': return 'top';
            case 'runner_up': return 'bottom';
            default: return 'right';
        }
    }

    /**
     * Añade un conector manual definido por el usuario
     */
    addManualConnector(startX, startY, endX, endY) {
        const id = `sprue_manual_${Date.now()}`;
        this.connectors.push({
            id: id,
            start: [startX, startY],
            end: [endX, endY],
            width: this.config.width,
            height: this.config.cardThickness * this.config.heightRatio,
            hasNotch: this.config.hasNotch,
            notchDepth: this.config.notchDepth,
            direction: 'custom'
        });
        return id;
    }

    /**
     * Elimina un conector por su ID
     */
    removeConnector(id) {
        this.connectors = this.connectors.filter(c => c.id !== id);
    }
}
