import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { Entity } from './Entity.js';
class Hallway extends Entity {
    constructor({
        position,
        bounds
    }) {
        super({
            position
        });
        this.bounds = bounds;
    }
}
export { Hallway };