import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { CapsuleEntity } from './CapsuleEntity.js';

const playerDirection = new THREE.Vector3();
const getForwardVector = function(camera) {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}

const getSideVector = function(camera) {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);
    return playerDirection;
}

class Player extends CapsuleEntity {
    constructor({
        position
    }) {
        super(position, 0.75, 5);
        this.speedFactor = 0.25;
    }
    update(delta, bvh) {
        super.update(delta, bvh);
    }
    move(delta) {
        if (this.world.controls.isLocked) {
            if (this.world.keys["w"]) {
                this.horizontalVelocity.add(getForwardVector(this.world.camera).multiplyScalar(this.speedFactor * delta));
            }
            if (this.world.keys["s"]) {
                this.horizontalVelocity.add(getForwardVector(this.world.camera).multiplyScalar(-this.speedFactor * delta));
            }

            if (this.world.keys["a"]) {
                this.horizontalVelocity.add(getSideVector(this.world.camera).multiplyScalar(-this.speedFactor * delta));
            }

            if (this.world.keys["d"]) {
                this.horizontalVelocity.add(getSideVector(this.world.camera).multiplyScalar(this.speedFactor * delta));
            }
        }
    }
    collideDoor(entity) {
        if (entity.bounds.containsPoint(this.position)) {
            const doorCenter = entity.bounds.getCenter(new THREE.Vector3());
            const playerCenter = this.position;
            playerCenter.y = 6;
            doorCenter.y = 6;
            const dir = doorCenter.clone().sub(playerCenter).normalize();

            const size = entity.bounds.getSize(new THREE.Vector3());
            const d = new THREE.Vector2(Math.abs(playerCenter.x - doorCenter.x), Math.abs(playerCenter.z - doorCenter.z)).sub(new THREE.Vector2(size.x / 2, size.z / 2));
            if (size.x > size.z) {
                dir.x = 0;
            } else {
                dir.z = 0;
            }
            const dist = Math.min(Math.max(d.x, d.y), 0) + new THREE.Vector2(Math.max(d.x, 0), Math.max(d.y, 0)).length();
            this.position.add(dir.multiplyScalar(dist));
        }
    }

}
export { Player }