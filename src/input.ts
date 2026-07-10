export class InputManager {
    public keys: { [key: string]: boolean } = {};
    
    // NOVO: Inicializa nulo para proteger quem joga só no teclado
    public mousePosition: { x: number, y: number } | null = null;

    constructor() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.keys['MouseLeft'] = true;
            if (e.button === 2) this.keys['MouseRight'] = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.keys['MouseLeft'] = false;
            if (e.button === 2) this.keys['MouseRight'] = false;
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mousePosition = {
                x: (e.clientX / window.innerWidth) * 2 - 1,
                y: -(e.clientY / window.innerHeight) * 2 + 1
            };
        });
        
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault(); 
        });
    }

    public isPressed(code: string): boolean {
        return !!this.keys[code];
    }
}