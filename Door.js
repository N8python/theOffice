import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { Entity } from './Entity.js';
const openCloseEasing = (t) => {
    return 1 - 4 * (t - 0.5) * (t - 0.5);
}
class Door extends Entity {
    constructor({
        position,
        bounds,
        model
    }) {
        super({
            position
        });
        this.bounds = bounds;
        this.model = model;
        this.open = false;
        this.openTicks = 0;
        this.openDir = 1;
        this.facingDir = new THREE.Vector3(1, 0, 0);
        if (this.bounds.getSize(new THREE.Vector3()).x > this.bounds.getSize(new THREE.Vector3()).z) {
            this.facingDir.set(0, 0, 1);
        }
    }
    update(delta) {
        // this.model.children[0].rotation.y += delta;
        this.openTicks -= delta * 0.5;
        if (this.open) {
            // Open from 0 to 90 degrees then close
            this.model.children[0].rotation.y = Math.PI / 2 * openCloseEasing(this.openTicks) * this.openDir;
        }
        if (this.openTicks < 0) {
            this.open = false;
            this.model.children[0].rotation.y = 0;
        }
    }
    openUp(origin) {
        this.open = true;
        this.openTicks = 1;
        this.openDir = origin.clone().sub(this.position).normalize().dot(this.facingDir) > 0 ? 1 : -1;
    }
}
export { Door }