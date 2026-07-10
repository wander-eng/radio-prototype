export class InputManager {
    public keys: { [key: string]: boolean } = {};
    
    // NOVO: Rastreia a posição 2D normalizada do mouse na tela (-1 a +1)
    public mousePosition: { x: number, y: number } = { x: 0, y: 0 };

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
        
        // NOVO: Atualiza a coordenada sempre que o mouse se move
        window.addEventListener('mousemove', (e) => {
            this.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
        
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault(); 
        });
    }

    public isPressed(code: string): boolean {
        return !!this.keys[code];
    }
}