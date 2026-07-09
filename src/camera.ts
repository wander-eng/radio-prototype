import * as THREE from 'three';

export class FollowCamera {
    public camera: THREE.PerspectiveCamera;
    private offset: THREE.Vector3;

    constructor() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        // Posição: 4 unidades acima, 8 unidades para trás do alvo
        this.offset = new THREE.Vector3(0, 4, 8);
    }

    public update(targetPosition: THREE.Vector3, delta: number) {
        // Calcula a posição ideal da câmera
        const idealPosition = targetPosition.clone().add(this.offset);
        
        // Interpolação suave em direção à posição ideal (lerp)
        this.camera.position.lerp(idealPosition, 5 * delta);
        
        // Olha levemente acima do centro do jogador
        const lookAtPosition = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
        this.camera.lookAt(lookAtPosition);
    }
}