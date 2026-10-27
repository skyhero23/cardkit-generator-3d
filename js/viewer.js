/**
 * Visor 3D Interactivo con Three.js para CardKit 3D Studio
 * Renderiza la escena en tiempo real con iluminación PBR de filamento PLA,
 * cama de impresión graduada, controles de cámara y modos de inspección.
 */

import { earcut } from './earcut.js';

export const FILAMENT_COLORS = {
    'pla_black': { name: 'PLA Negro Mate', hex: 0x1e1e24, roughness: 0.7, metalness: 0.1 },
    'pla_white': { name: 'PLA Blanco Puro', hex: 0xf5f6fa, roughness: 0.6, metalness: 0.05 },
    'pla_red': { name: 'PLA Rojo Fuego', hex: 0xe84118, roughness: 0.5, metalness: 0.1 },
    'pla_blue': { name: 'PLA Azul Cobalto', hex: 0x00a8ff, roughness: 0.5, metalness: 0.15 },
    'pla_gold': { name: 'PLA Seda Oro', hex: 0xfbc531, roughness: 0.3, metalness: 0.6 },
    'pla_green': { name: 'PLA Verde Neón', hex: 0x4cd137, roughness: 0.5, metalness: 0.1 },
    'pla_orange': { name: 'PLA Naranja Intenso', hex: 0xe67e22, roughness: 0.5, metalness: 0.1 },
    'pla_purple': { name: 'PLA Morado Cyber', hex: 0x9c88ff, roughness: 0.4, metalness: 0.2 },
    'pla_silver': { name: 'PLA Plata Satinado', hex: 0xdcdde1, roughness: 0.35, metalness: 0.5 }
};

export class Viewer3D {
    constructor(containerElement) {
        this.container = containerElement;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentMeshGroup = null;
        this.connectorMeshGroup = null;
        this.bedGrid = null;
        this.currentColorKey = 'pla_gold';
        this.wireframeMode = false;
        this.highlightConnectors = true;

        this.init();
    }

    init() {
        if (!window.THREE) {
            console.error('Three.js no está disponible globalmente');
            return;
        }

        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;

        // 1. Escena
        this.scene = new window.THREE.Scene();
        this.scene.background = new window.THREE.Color(0x13151a); // Fondo oscuro estilo slicer moderno

        // 2. Cámara de perspectiva
        this.camera = new window.THREE.PerspectiveCamera(45, width / height, 1, 2000);
        this.camera.position.set(0, -140, 160);
        this.camera.up.set(0, 0, 1); // Eje Z hacia arriba (estándar de impresión 3D)

        // 3. Renderizador WebGL
        this.renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = window.THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 4. Controles de Órbita
        if (window.THREE.OrbitControls) {
            this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.maxPolarAngle = Math.PI / 2 + 0.1; // No bajar mucho más allá del suelo
            this.controls.minDistance = 30;
            this.controls.maxDistance = 600;
        }

        // 5. Iluminación tipo estudio de renderizado 3D
        this.setupLights();

        // 6. Cama de impresión 3D (Build Plate)
        this.setupBuildPlate();

        // Grupos de malla
        this.currentMeshGroup = new window.THREE.Group();
        this.scene.add(this.currentMeshGroup);

        // Responsive resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Bucle de animación
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLights() {
        // Luz ambiental suave
        const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambientLight);

        // Luz hemisférica (cielo cálido, suelo frío)
        const hemiLight = new window.THREE.HemisphereLight(0xffffff, 0x333b4d, 0.45);
        hemiLight.position.set(0, 0, 200);
        this.scene.add(hemiLight);

        // Luz direccional principal (Key Light con sombras)
        const dirLight = new window.THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(100, -120, 200);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 600;
        const d = 140;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);

        // Luz de contra (Rim Light) para resaltar contornos
        const rimLight = new window.THREE.DirectionalLight(0x70a1ff, 0.4);
        rimLight.position.set(-120, 140, 80);
        this.scene.add(rimLight);
    }

    setupBuildPlate() {
        // Cuadrícula de la cama de impresión estilo Bambu / Prusa (220x220 mm)
        const size = 220;
        const divisions = 22; // divisiones de 10mm
        this.bedGrid = new window.THREE.GridHelper(size, divisions, 0x4a5568, 0x2d3748);
        this.bedGrid.rotation.x = Math.PI / 2; // Colocar en plano XY (Z=0)
        this.bedGrid.position.z = -0.05;
        this.scene.add(this.bedGrid);

        // Base de la cama con sutil textura
        const bedGeo = new window.THREE.PlaneGeometry(size, size);
        const bedMat = new window.THREE.MeshStandardMaterial({
            color: 0x1a1d24,
            roughness: 0.95,
            metalness: 0.1
        });
        const bedMesh = new window.THREE.Mesh(bedGeo, bedMat);
        bedMesh.position.z = -0.1;
        bedMesh.receiveShadow = true;
        this.scene.add(bedMesh);
    }

    setFilamentColor(colorKey) {
        if (FILAMENT_COLORS[colorKey]) {
            this.currentColorKey = colorKey;
            this.updateMaterials();
        }
    }

    setWireframe(enabled) {
        this.wireframeMode = enabled;
        this.updateMaterials();
    }

    setHighlightConnectors(enabled) {
        this.highlightConnectors = enabled;
        this.updateMaterials();
    }

    updateMaterials() {
        if (!this.currentMeshGroup) return;

        const filInfo = FILAMENT_COLORS[this.currentColorKey] || FILAMENT_COLORS['pla_gold'];

        this.currentMeshGroup.traverse(child => {
            if (child.isMesh) {
                if (child.userData.isConnector && this.highlightConnectors) {
                    // Resaltado llamativo para los conectores (color ámbar/naranja de aviso)
                    child.material = new window.THREE.MeshStandardMaterial({
                        color: 0xff6b35,
                        roughness: 0.4,
                        metalness: 0.2,
                        wireframe: this.wireframeMode
                    });
                } else if (child.userData.isFrameText) {
                    // Texto en el marco: sutil contraste
                    child.material = new window.THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        roughness: 0.3,
                        metalness: 0.1,
                        wireframe: this.wireframeMode
                    });
                } else {
                    // Filamento seleccionado
                    child.material = new window.THREE.MeshStandardMaterial({
                        color: filInfo.hex,
                        roughness: filInfo.roughness,
                        metalness: filInfo.metalness,
                        wireframe: this.wireframeMode
                    });
                }
            }
        });
    }

    /**
     * Actualiza la escena 3D con la nueva geometría generada
     */
    updateCardKitGeometry(frameData, islands, connectors, frameTextIslands = []) {
        // Limpiar geometrías previas
        while (this.currentMeshGroup.children.length > 0) {
            const obj = this.currentMeshGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
            this.currentMeshGroup.remove(obj);
        }

        const filInfo = FILAMENT_COLORS[this.currentColorKey] || FILAMENT_COLORS['pla_gold'];
        const mainMaterial = new window.THREE.MeshStandardMaterial({
            color: filInfo.hex,
            roughness: filInfo.roughness,
            metalness: filInfo.metalness,
            wireframe: this.wireframeMode
        });

        const connectorMaterial = new window.THREE.MeshStandardMaterial({
            color: this.highlightConnectors ? 0xff6b35 : filInfo.hex,
            roughness: 0.4,
            metalness: 0.2,
            wireframe: this.wireframeMode
        });

        // Offset de centrado en la cama de impresión
        const offsetX = -frameData.width / 2;
        const offsetY = -frameData.height / 2;

        // 1. Marco Principal
        const frameMesh = this.buildExtrudedMesh(
            frameData.outerPolygon,
            [frameData.innerHole, frameData.hangerHole].filter(Boolean),
            0,
            frameData.thickness,
            offsetX, offsetY,
            mainMaterial
        );
        if (frameMesh) {
            frameMesh.castShadow = true;
            frameMesh.receiveShadow = true;
            frameMesh.userData = { type: 'frame' };
            this.currentMeshGroup.add(frameMesh);
        }

        // 2. Islas (Letras o piezas SVG)
        const pieceThickness = frameData.pieceThickness || frameData.thickness;
        for (const isl of islands) {
            const mesh = this.buildExtrudedMesh(
                isl.outer,
                isl.holes || [],
                0,
                pieceThickness,
                offsetX, offsetY,
                mainMaterial
            );
            if (mesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { type: 'island', id: isl.id };
                this.currentMeshGroup.add(mesh);
            }
        }

        // 3. Conectores (Sprues)
        for (const conn of connectors) {
            const connMesh = this.buildConnectorMesh(conn, frameData.thickness, offsetX, offsetY, connectorMaterial);
            if (connMesh) {
                connMesh.castShadow = true;
                connMesh.receiveShadow = true;
                connMesh.userData = { isConnector: true, id: conn.id };
                this.currentMeshGroup.add(connMesh);
            }
        }

        // 4. Texto en el Marco
        for (const ft of frameTextIslands) {
            if (ft.style === 'embossed') {
                const textMesh = this.buildExtrudedMesh(
                    ft.outer,
                    ft.holes || [],
                    frameData.thickness,
                    frameData.thickness + (frameData.embossHeight || 0.6),
                    offsetX, offsetY,
                    mainMaterial
                );
                if (textMesh) {
                    textMesh.castShadow = true;
                    textMesh.userData = { isFrameText: true };
                    this.currentMeshGroup.add(textMesh);
                }
            }
        }
    }

    /**
     * Construye un THREE.Mesh extruido a partir de polígono y agujeros
     */
    buildExtrudedMesh(outer, holes, zMin, zMax, offsetX, offsetY, material) {
        if (!outer || outer.length < 3) return null;

        const shape = new window.THREE.Shape();
        shape.moveTo(outer[0][0] + offsetX, outer[0][1] + offsetY);
        for (let i = 1; i < outer.length; i++) {
            shape.lineTo(outer[i][0] + offsetX, outer[i][1] + offsetY);
        }
        shape.closePath();

        for (const h of holes) {
            if (h && h.length >= 3) {
                const holePath = new window.THREE.Path();
                holePath.moveTo(h[0][0] + offsetX, h[0][1] + offsetY);
                for (let i = 1; i < h.length; i++) {
                    holePath.lineTo(h[i][0] + offsetX, h[i][1] + offsetY);
                }
                holePath.closePath();
                shape.holes.push(holePath);
            }
        }

        const depth = zMax - zMin;
        const geom = new window.THREE.ExtrudeGeometry(shape, {
            depth: depth,
            bevelEnabled: false,
            curveSegments: 16
        });

        // Alinear Z al rango [zMin, zMax]
        geom.translate(0, 0, zMin);
        geom.computeVertexNormals();

        return new window.THREE.Mesh(geom, material);
    }

    /**
     * Construye la malla del conector con muesca en V
     */
    buildConnectorMesh(conn, cardThickness, offsetX, offsetY, material) {
        const [x1, y1] = conn.start;
        const [x2, y2] = conn.end;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) return null;

        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;
        const halfW = conn.width / 2;
        const connH = conn.height || (cardThickness * 0.7);

        const group = new window.THREE.Group();

        if (conn.hasNotch && len > 2.0) {
            const notchDist = Math.min(1.0, len * 0.3);
            const notchLen = 0.8;
            const notchZ = Math.max(0.4, connH - (conn.notchDepth || 0.8));

            // Parte 1: Muesca (rebajada)
            const box1 = this.createQuadBox(
                [x1, y1], 
                [x1 + ux * notchDist, y1 + uy * notchDist], 
                px, py, halfW * 0.8, 0, notchZ, offsetX, offsetY, material
            );
            if (box1) group.add(box1);

            // Parte 2: Cuerpo principal
            const box2 = this.createQuadBox(
                [x1 + ux * (notchDist + notchLen), y1 + uy * (notchDist + notchLen)], 
                [x2, y2], 
                px, py, halfW, 0, connH, offsetX, offsetY, material
            );
            if (box2) group.add(box2);

            return group;
        } else {
            return this.createQuadBox([x1, y1], [x2, y2], px, py, halfW, 0, connH, offsetX, offsetY, material);
        }
    }

    createQuadBox(pStart, pEnd, px, py, halfW, zMin, zMax, offsetX, offsetY, material) {
        const poly = [
            [pStart[0] + px * halfW, pStart[1] + py * halfW],
            [pEnd[0] + px * halfW, pEnd[1] + py * halfW],
            [pEnd[0] - px * halfW, pEnd[1] - py * halfW],
            [pStart[0] - px * halfW, pStart[1] - py * halfW]
        ];
        return this.buildExtrudedMesh(poly, [], zMin, zMax, offsetX, offsetY, material);
    }

    // Presets de vistas de cámara
    setViewTop() {
        if (!this.controls) return;
        this.camera.position.set(0, 0, 180);
        this.controls.target.set(0, 0, 0);
        this.camera.up.set(0, 1, 0);
        this.controls.update();
    }

    setViewIsometric() {
        if (!this.controls) return;
        this.camera.position.set(0, -140, 160);
        this.controls.target.set(0, 0, 0);
        this.camera.up.set(0, 0, 1);
        this.controls.update();
    }

    setViewFront() {
        if (!this.controls) return;
        this.camera.position.set(0, -180, 15);
        this.controls.target.set(0, 0, 0);
        this.camera.up.set(0, 0, 1);
        this.controls.update();
    }

    resetCamera() {
        this.setViewIsometric();
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate);
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
