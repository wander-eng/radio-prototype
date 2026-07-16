import * as THREE from 'three';

export class GameScene {
    public scene: THREE.Scene;
    public renderer: THREE.WebGLRenderer;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupEnvironment();

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
    }

    private setupEnvironment() {
        // Chão simples e visível
        const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.scene.add(gridHelper);
    }

    private onWindowResize(): void {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public setEnvironmentColor(colorHex: number, density: number) {
        // O FogExp2 cria o efeito de névoa baseado em densidade
        this.scene.fog = new THREE.FogExp2(colorHex, density);
        
        // Ajustar a cor do background para a mesma cor do fog é essencial
        // no Three.js para criar a ilusão de um ambiente infinito
        this.scene.background = new THREE.Color(colorHex);
    }

    public setNeutralEnvironment() {
        const neutralColor = 0x1a1a1a;
        this.scene.fog = new THREE.FogExp2(neutralColor, 0.02);
        this.scene.background = new THREE.Color(neutralColor);
    }
}
