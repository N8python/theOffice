import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
const EffectFinish = {
    uniforms: {

        'sceneDiffuse': { value: null },
        'sceneDepth': { value: null },
        'tDiffuse': { value: null },
        'projMat': { value: new THREE.Matrix4() },
        'viewMat': { value: new THREE.Matrix4() },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'cameraPos': { value: new THREE.Vector3() },
        'resolution': { value: new THREE.Vector2() },
        'time': { value: 0.0 },
        'r': { value: 5.0 }
    },
    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
    fragmentShader: /* glsl */ `
		uniform sampler2D sceneDiffuse;
    uniform sampler2D sceneDepth;
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float r;
    varying vec2 vUv;
    void main() {
        vec3 texel = texture2D(sceneDiffuse, vUv).rgb;
        float occlusion = texture2D(tDiffuse, vUv).r;
        gl_FragColor = vec4(texel * pow(occlusion, 3.0), 1.0);
    }
    `

}
export { EffectFinish };