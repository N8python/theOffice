import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';

class Entity extends THREE.Object3D {
    constructor({
        position
    }) {
        super();
        this.position.copy(position);
        this.world = null;
    }
    update() {

    }
}
export { Entity }