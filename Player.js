import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { CapsuleEntity } from './CapsuleEntity.js';

class Player extends CapsuleEntity {
    constructor({
        position
    }) {
        super(position, 0.75, 5);
    }
    update(delta, bvh) {
        super.update(delta, bvh);
    }

}
export { Player }