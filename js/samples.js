/**
 * Biblioteca de Muestras SVG y Presets de Texto para CardKit 3D Studio
 * Permite al usuario probar instantáneamente con 1 clic sin necesidad de buscar archivos externos.
 */

export const SVG_SAMPLES = [
    {
        name: '🦖 T-Rex Fósil / Llavero',
        category: 'Animales',
        description: 'Silueta detallada de tiranosaurio rex ideal para model kit.',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 20,40 Q 25,20 45,20 Q 75,20 80,35 Q 85,45 80,50 L 70,52 Q 72,58 65,60 L 58,58 Q 55,68 45,72 L 48,82 L 42,84 L 38,74 Q 30,75 25,68 L 22,82 L 16,82 L 18,65 Q 12,55 14,48 Z M 65,30 A 3,3 0 1,0 65,36 A 3,3 0 1,0 65,30 Z" fill="black"/>
        </svg>`
    },
    {
        name: '🚀 Cohete Espacial Retro',
        category: 'Ciencia Ficción',
        description: 'Nave espacial con alerones y ventana circular.',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 50,10 C 65,25 70,50 68,75 L 80,85 L 75,90 L 65,84 L 58,88 L 50,84 L 42,88 L 35,84 L 25,90 L 20,85 L 32,75 C 30,50 35,25 50,10 Z M 50,35 A 8,8 0 1,0 50,51 A 8,8 0 1,0 50,35 Z" fill="black"/>
        </svg>`
    },
    {
        name: '🦇 Murciélago / Emblema',
        category: 'Héroes',
        description: 'Emblema clásico con alas extendidas y simetría perfecta.',
        svg: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M 50,15 L 53,20 L 57,18 L 55,25 C 65,24 85,15 95,35 C 85,38 78,35 75,45 C 68,38 60,40 50,55 C 40,40 32,38 25,45 C 22,35 15,38 5,35 C 15,15 35,24 45,25 L 43,18 L 47,20 Z" fill="black"/>
        </svg>`
    },
    {
        name: '⚙️ Engranaje Mecánico',
        category: 'Ingeniería',
        description: 'Rueda dentada con 8 dientes y eje central hexagonal.',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 45,10 L 55,10 L 57,22 L 67,18 L 73,26 L 68,36 L 78,43 L 78,53 L 68,60 L 73,70 L 67,78 L 57,74 L 55,86 L 45,86 L 43,74 L 33,78 L 27,70 L 32,60 L 22,53 L 22,43 L 32,36 L 27,26 L 33,18 L 43,22 Z M 50,38 A 12,12 0 1,0 50,62 A 12,12 0 1,0 50,38 Z" fill="black"/>
        </svg>`
    },
    {
        name: '💖 Corazón Alado',
        category: 'Símbolos',
        description: 'Corazón estilizado con alas para regalo o llavero.',
        svg: `<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
            <path d="M 50,35 C 45,20 25,20 25,35 C 25,50 45,65 50,75 C 55,65 75,50 75,35 C 75,20 55,20 50,35 Z M 15,25 C 22,30 24,40 18,50 C 10,45 8,35 15,25 Z M 85,25 C 78,30 76,40 82,50 C 90,45 92,35 85,25 Z" fill="black"/>
        </svg>`
    },
    {
        name: '🌸 Flor de Loto Geométrica',
        category: 'Naturaleza',
        description: 'Pétalos simétricos para decoración o posavasos.',
        svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M 50,15 C 60,35 70,55 50,85 C 30,55 40,35 50,15 Z M 30,35 C 45,45 48,65 30,85 C 18,70 18,50 30,35 Z M 70,35 C 55,45 52,65 70,85 C 82,70 82,50 70,35 Z" fill="black"/>
        </svg>`
    }
];

export const TEXT_PRESETS = [
    { label: 'Abecedario A-Z', text: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z', mode: 'individual', fontSize: 18 },
    { label: 'Números 0-9', text: '0 1 2 3 4 5 6 7 8 9', mode: 'individual', fontSize: 24 },
    { label: 'Feliz Cumpleaños', text: 'FELIZ CUMPLEAÑOS', mode: 'individual', fontSize: 20 },
    { label: 'MAKER 3D', text: 'MAKER 3D', mode: 'connected', fontSize: 28 },
    { label: 'KIT DE LETRAS', text: 'K I T  D E  L E T R A S', mode: 'individual', fontSize: 20 },
    { label: 'LOVE', text: 'LOVE', mode: 'connected', fontSize: 32 }
];
