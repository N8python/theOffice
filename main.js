import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { EffectComposer } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/SMAAPass.js';
import { GammaCorrectionShader } from 'https://unpkg.com/three@0.142.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { EffectShader } from "./EffectShader.js";
import { EffectCompositer } from './EffectCompositer.js';
import { EffectFinish } from "./EffectFinish.js";
import { OrbitControls } from 'https://unpkg.com/three@0.142.0/examples/jsm/controls/OrbitControls.js';
import { AssetManager } from './AssetManager.js';
import { Stats } from "./stats.js";
import Delaunator from 'https://cdn.skypack.dev/delaunator@5.0.0';
import {
    MeshBVH,
    MeshBVHVisualizer,
    MeshBVHUniformStruct,
    FloatVertexAttributeTexture,
    shaderStructs,
    shaderIntersectFunction,
    SAH
} from 'https://unpkg.com/three-mesh-bvh@0.5.10/build/index.module.js';
import * as BufferGeometryUtils from "https://unpkg.com/three@0.142.0/examples/jsm/utils/BufferGeometryUtils.js";
import jsgraphs from "./jsgraphs.js";
import { World } from "./World.js";
import { GUI } from 'https://unpkg.com/three@0.142.0/examples/jsm/libs/lil-gui.module.min.js';
import { HorizontalBlurShader } from "./HorizontalBlurShader.js";
import { VerticalBlurShader } from "./VerticalBlurShader.js";
import {
    GLTFLoader
} from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/GLTFLoader.js';
import { UnrealBloomPass } from "https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { PointerLockControls } from 'https://unpkg.com/three@0.142.0/examples/jsm/controls/PointerLockControls.js';
async function main() {
    // Setup basic renderer, controls, and profiler
    const clientWidth = window.innerWidth * 0.99;
    const clientHeight = window.innerHeight * 0.98;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    //camera.position.set(50, 75, 50);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(clientWidth, clientHeight);
    document.body.appendChild(renderer.domElement);
    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    // Setup scene
    // Skybox
    const environment = await new THREE.TextureLoader().loadAsync("textures/office.png");
    environment.encoding = THREE.sRGBEncoding;
    environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = environment;
    const keys = {};
    document.addEventListener('keydown', (e) => {
        world.registerKey(e.key);
        keys[e.key] = true;
    });
    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    const world = new World(renderer, scene, new THREE.Vector2(clientWidth, clientHeight), camera, {
        controls,
        keys
    });
    await world.generateWorld();

    const effectController = {
        radius: 15.0
    }
    const defaultTexture = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.FloatType,
    });
    defaultTexture.depthTexture = new THREE.DepthTexture(clientWidth, clientHeight, THREE.FloatType);
    // Post Effects
    const composer = new EffectComposer(renderer);
    const smaaPass = new SMAAPass(clientWidth, clientHeight);
    const effectPass = new ShaderPass(EffectShader);
    /* const compositers = [];
     for (let i = 0; i < 4; i++) {
         const effectCompositer = new ShaderPass(EffectCompositer);
         effectCompositer.uniforms.radius.value = (1.75 ** (3 - i));
         effectCompositer.uniforms.index.value = i;
         compositers.push(effectCompositer);
     }*/
    const blurs = [];
    for (let i = 0; i < 4; i++) {
        const hblur = new ShaderPass(HorizontalBlurShader);
        const vblur = new ShaderPass(VerticalBlurShader);
        const blurSize = 1.0;
        hblur.uniforms.h.value = blurSize;
        vblur.uniforms.v.value = blurSize;
        blurs.push([hblur, vblur]);
    }


    const effectFinish = new ShaderPass(EffectFinish);
    composer.addPass(effectPass);
    for (const [hblur, vblur] of blurs) {
        composer.addPass(hblur);
        composer.addPass(vblur)
    }
    composer.addPass(effectFinish);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(clientWidth, clientHeight), 0.5, 0.4, 0.9));
    composer.addPass(smaaPass);
    const blueNoise = await new THREE.TextureLoader().loadAsync("textures/bluenoise.png");
    blueNoise.wrapS = THREE.RepeatWrapping;
    blueNoise.wrapT = THREE.RepeatWrapping;
    blueNoise.repeat.set(1, 1);
    blueNoise.minFilter = THREE.NearestFilter;
    blueNoise.magFilter = THREE.NearestFilter;
    const clock = new THREE.Clock();
    document.addEventListener("click", () => {
        controls.lock();
        if (controls.isLocked) {
            world.registerClick();
        }
    });

    function animate() {
        const delta = Math.min(clock.getDelta(), 1 / 30);
        try {
            world.update(delta);
        } catch (e) {}
        renderer.setRenderTarget(defaultTexture);
        renderer.clear();
        renderer.render(scene, camera);
        effectPass.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        effectPass.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
        effectPass.uniforms["projMat"].value = camera.projectionMatrix;
        effectPass.uniforms["viewMat"].value = camera.matrixWorldInverse;
        effectPass.uniforms["projViewMat"].value = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse.clone());
        effectPass.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
        effectPass.uniforms["viewMatrixInv"].value = camera.matrixWorld;
        effectPass.uniforms["cameraPos"].value = camera.position;
        effectPass.uniforms['resolution'].value = new THREE.Vector2(clientWidth, clientHeight);
        effectPass.uniforms['time'].value = performance.now() / 1000;
        effectPass.uniforms['r'].value = effectController.radius;
        blurs.forEach(([hblur, vblur], i) => {
            const blurSize = 2.0 ** i;
            hblur.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
            hblur.uniforms["resolution"].value = new THREE.Vector2(clientWidth, clientHeight);
            //  hblur.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
            //  hblur.uniforms["viewMatrixInv"].value = camera.matrixWorld;
            vblur.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
            vblur.uniforms["resolution"].value = new THREE.Vector2(clientWidth, clientHeight);
            //  vblur.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
            //  vblur.uniforms["viewMatrixInv"].value = camera.matrixWorld;
            hblur.uniforms.h.value = blurSize;
            vblur.uniforms.v.value = blurSize;
        });
        effectFinish.uniforms['sceneDiffuse'].value = defaultTexture.texture;
        effectFinish.uniforms['sceneDepth'].value = defaultTexture.depthTexture;
        effectFinish.uniforms['projMat'].value = camera.projectionMatrix;
        effectFinish.uniforms['viewMat'].value = camera.matrixWorldInverse;
        effectFinish.uniforms['projectionMatrixInv'].value = camera.projectionMatrixInverse;
        effectFinish.uniforms['viewMatrixInv'].value = camera.matrixWorld;
        effectFinish.uniforms['cameraPos'].value = camera.position;
        effectFinish.uniforms['resolution'].value = new THREE.Vector2(clientWidth, clientHeight);
        effectFinish.uniforms['time'].value = performance.now() / 1000;
        effectFinish.uniforms['r'].value = effectController.radius;
        composer.render();
        stats.update();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
main();