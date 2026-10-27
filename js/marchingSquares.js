/**
 * Marching Squares y Vectorizador de Contornos 2D
 * Convierte texto renderizado en Canvas o imágenes rasterizadas en polígonos vectoriales con agujeros (holes).
 */

export function traceCanvasText(text, fontName, fontSizePx = 140, fontWeight = 'bold') {
    // Crear canvas temporal de alta resolución
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Medir texto
    ctx.font = `${fontWeight} ${fontSizePx}px "${fontName}", sans-serif`;
    const metrics = ctx.measureText(text);
    
    const padding = 20;
    const width = Math.ceil(metrics.width) + padding * 2;
    const height = Math.ceil(fontSizePx * 1.5) + padding * 2;

    canvas.width = Math.max(width, 10);
    canvas.height = Math.max(height, 10);

    // Fondo blanco, texto negro
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000000';
    ctx.font = `${fontWeight} ${fontSizePx}px "${fontName}", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return traceBinaryImage(ctx, canvas.width, canvas.height);
}

/**
 * Traza los contornos de una imagen binaria (negro = sólido, blanco = fondo).
 * Retorna un arreglo de islas: cada isla tiene `outer` (polígono exterior) y `holes` (orificios interiores).
 */
export function traceBinaryImage(ctx, width, height, threshold = 128) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Matriz booleana de píxeles sólidos
    const grid = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Si el pixel es oscuro (texto), es sólido
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            if (brightness < threshold && data[idx + 3] > 64) {
                grid[y * width + x] = 1;
            } else {
                grid[y * width + x] = 0;
            }
        }
    }

    // Moore-Neighbor tracing para extraer bucles de contorno
    const visitedOuters = new Uint8Array(width * height);
    const visitedHoles = new Uint8Array(width * height);
    const rawContours = [];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const current = grid[idx];
            const above = grid[(y - 1) * width + x];

            // Detección de borde exterior: entra en sólido viniendo de vacío arriba
            if (current === 1 && above === 0 && !visitedOuters[idx]) {
                const contour = traceBorder(grid, width, height, x, y, false, visitedOuters);
                if (contour && contour.length >= 4) {
                    rawContours.push({ points: contour, isHole: false });
                }
            }

            // Detección de orificio interior (hole): entra en vacío viniendo de sólido
            if (current === 0 && above === 1 && !visitedHoles[idx]) {
                const hole = traceBorder(grid, width, height, x, y - 1, true, visitedHoles);
                if (hole && hole.length >= 4) {
                    rawContours.push({ points: hole, isHole: true });
                }
            }
        }
    }

    // Simplificar contornos con Douglas-Peucker para reducir vértices innecesarios
    const simplifiedContours = rawContours.map(c => ({
        points: simplifyPolygon(c.points, 1.2),
        isHole: c.isHole,
        bbox: getBoundingBox(c.points)
    })).filter(c => c.points.length >= 3);

    // Agrupar contornos exteriores con sus respectivos orificios (islas)
    const islands = [];
    const outers = simplifiedContours.filter(c => !c.isHole);
    const holes = simplifiedContours.filter(c => c.isHole);

    for (const outer of outers) {
        const island = {
            outer: outer.points,
            holes: [],
            bbox: outer.bbox
        };

        for (const hole of holes) {
            // Comprobar si el orificio está dentro de este contorno exterior
            if (isPointInsidePolygon(hole.points[0], outer.points)) {
                island.holes.push(hole.points);
            }
        }

        islands.push(island);
    }

    return islands;
}

/**
 * Algoritmo Moore-Neighbor Tracing para bordes de píxeles
 */
function traceBorder(grid, width, height, startX, startY, isHoleSearch, visited) {
    const points = [];
    let curX = startX;
    let curY = startY;

    // 8 direcciones: N, NE, E, SE, S, SW, W, NW
    const dx = [0, 1, 1, 1, 0, -1, -1, -1];
    const dy = [-1, -1, 0, 1, 1, 1, 0, -1];

    let backtrackDir = isHoleSearch ? 0 : 4;
    let startDir = 0;

    let steps = 0;
    const maxSteps = width * height;

    while (steps++ < maxSteps) {
        visited[curY * width + curX] = 1;
        points.push([curX, curY]);

        // Buscar siguiente pixel sólido en sentido de las agujas del reloj
        let found = false;
        let nextDir = (backtrackDir + 1) % 8;

        for (let i = 0; i < 8; i++) {
            const checkDir = (nextDir + i) % 8;
            const nx = curX + dx[checkDir];
            const ny = curY + dy[checkDir];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (grid[ny * width + nx] === 1) {
                    curX = nx;
                    curY = ny;
                    backtrackDir = (checkDir + 4) % 8;
                    found = true;
                    break;
                }
            }
        }

        if (!found) break;
        if (curX === startX && curY === startY) break;
    }

    return points;
}

/**
 * Simplificación de polígonos Douglas-Peucker
 */
export function simplifyPolygon(points, tolerance = 1.0) {
    if (points.length <= 4) return points;

    function getSqDist(p1, p2) {
        const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
        return dx * dx + dy * dy;
    }

    function getSqSegDist(p, p1, p2) {
        let x = p1[0], y = p1[1], dx = p2[0] - x, dy = p2[1] - y;
        if (dx !== 0 || dy !== 0) {
            const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) {
                x = p2[0];
                y = p2[1];
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }
        dx = p[0] - x;
        dy = p[1] - y;
        return dx * dx + dy * dy;
    }

    function simplifyDPStep(pts, first, last, sqTol, simplified) {
        let maxSqDist = sqTol, index;
        for (let i = first + 1; i < last; i++) {
            const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }
        if (maxSqDist > sqTol) {
            if (index - first > 1) simplifyDPStep(pts, first, index, sqTol, simplified);
            simplified.push(pts[index]);
            if (last - index > 1) simplifyDPStep(pts, index, last, sqTol, simplified);
        }
    }

    const sqTol = tolerance * tolerance;
    const simplified = [points[0]];
    simplifyDPStep(points, 0, points.length - 1, sqTol, simplified);
    simplified.push(points[points.length - 1]);

    return simplified;
}

export function getBoundingBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function isPointInsidePolygon(point, polygon) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
