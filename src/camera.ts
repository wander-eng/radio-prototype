import * as THREE from 'three';

export class FollowCamera {
    public camera: THREE.PerspectiveCamera;
    
    // Parâmetros base da câmera
    public baseOffset: THREE.Vector3;
    public baseFov = 75;
    
    // Parâmetros manipuláveis temporariamente pelos Efeitos Visuais
    public lerpSpeed = 5;
    public positionalOffset = new THREE.Vector3();
    public angularOffset = 0;
    private readonly presentationOffset = new THREE.Vector3();

    constructor() {
        this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.baseOffset = new THREE.Vector3(0, 4, 8);
    }

    public update(targetPosition: THREE.Vector3, delta: number) {
        this.clearPresentationOffset();

        // 1. Aplica o Offset Orbital do Forró
        const currentOffset = this.baseOffset.clone();
        if (this.angularOffset !== 0) {
            currentOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angularOffset);
        }

        // 2. Aplica o Nudge (empurrão) lateral do Samba e calcula a posição ideal
        const idealPosition = targetPosition.clone().add(currentOffset).add(this.positionalOffset);
        
        // 3. Move a câmera com a velocidade dinâmica (que o Samba pode alterar temporariamente)
        this.camera.position.lerp(idealPosition, this.lerpSpeed * delta);
        
        const lookAtPosition = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
        this.camera.lookAt(lookAtPosition);
    }

    public applyPresentationOffset(offset: Readonly<{ x: number; y: number; z: number }>) {
        this.clearPresentationOffset();
        this.presentationOffset.set(offset.x, offset.y, offset.z);
        this.camera.position.add(this.presentationOffset);
    }

    public clearPresentationOffset() {
        this.camera.position.sub(this.presentationOffset);
        this.presentationOffset.set(0, 0, 0);
    }

    public get presentationOffsetSnapshot() {
        return Object.freeze({
            x: this.presentationOffset.x,
            y: this.presentationOffset.y,
            z: this.presentationOffset.z
        });
    }
}
