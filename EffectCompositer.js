import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
const EffectCompositer = {
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
        'r': { value: 5.0 },
        'blueNoise': { value: null },
        'radius': { value: 3.0 },
        'index': { value: 0.0 }
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
    uniform sampler2D blueNoise;
    uniform vec2 resolution;
    uniform float r;
    uniform float radius;
    uniform float index;
    varying vec2 vUv;
    highp float linearize_depth(highp float d, highp float zNear,highp float zFar)
    {
        highp float z_n = 2.0 * d - 1.0;
        return 2.0 * zNear * zFar / (zFar + zNear - z_n * (zFar - zNear));
    }
    #include <common>
    #define NUM_SAMPLES 4
    #define NUM_RINGS 11
    vec2 poissonDisk[NUM_SAMPLES];

				void initPoissonSamples( ) {
					float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
					float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

					// jsfiddle that shows sample pattern: https://jsfiddle.net/a16ff1p7/
					//float angle = texture2D(blueNoise, vUv * (resolution / vec2(1024.0))).x * PI2;
                    float angle;
                    if (index == 0.0) {
                         angle = texture2D(blueNoise, vUv * (resolution / vec2(1024.0))).x * PI2;
                    } else if (index == 1.0) {
                         angle = texture2D(blueNoise, vUv * (resolution / vec2(1024.0))).y * PI2;
                    } else if (index == 2.0) {
                         angle = texture2D(blueNoise, vUv * (resolution / vec2(1024.0))).z * PI2;
                    } else {
                         angle = texture2D(blueNoise, vUv * (resolution / vec2(1024.0))).w * PI2;
                    }
					float radius = INV_NUM_SAMPLES;
					float radiusStep = radius;

					for( int i = 0; i < NUM_SAMPLES; i ++ ) {
						poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
						radius += radiusStep;
						angle += ANGLE_STEP;
					}
				}
    void main() {
        const float pi = 3.14159;
        //vec3 texel = texture2D(tDiffuse, vUv).rgb;
        initPoissonSamples();
        vec2 texelSize = vec2(1.0 / resolution.x, 1.0 / resolution.y);
        vec2 uv = vUv;
        float occlusion = texture2D(tDiffuse, vUv).r;
        float count = 1.0;
        float depth = linearize_depth(texture2D(sceneDepth, vUv).x, 0.1, 1000.0);
        float size = radius;
        for(int i = 0; i < NUM_SAMPLES; i++) {
            vec2 offset = poissonDisk[i] * texelSize * size;
            float occSample = texture2D(tDiffuse, uv + offset).r;
            float depthSample = linearize_depth(texture2D(sceneDepth, uv + offset).x, 0.1, 1000.0);
            float rangeCheck = smoothstep(0.0, 1.0, r / (r * abs(depthSample - depth)));
            occlusion += occSample * rangeCheck;
            count += rangeCheck;
        }
        occlusion /= count;
        gl_FragColor = vec4(vec3(occlusion), 1.0);
    }
    `

}
export { EffectCompositer };