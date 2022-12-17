import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { Entity } from './Entity.js';
import { Hallway } from './Hallway.js';
import { Room } from './Room.js';
import { Player } from './Player.js';
import { Door } from './Door.js';

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
import Delaunator from 'https://cdn.skypack.dev/delaunator@5.0.0';
import jsgraphs from "./jsgraphs.js";
import {
    GLTFLoader
} from 'https://unpkg.com/three@0.142.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from "https://unpkg.com/three@0.142.0/examples/jsm/math/MeshSurfaceSampler.js";
import { FullScreenQuad } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/Pass.js';
class World {
    constructor(renderer, scene, resolution, camera, {
        controls,
        keys
    }) {
        this.entities = [];
        this.renderer = renderer;
        this.SIZE = 2048;
        this.resolution = resolution;
        this.roomData = new Uint8Array(this.SIZE * this.SIZE);
        this.metaData = new Uint8Array(this.SIZE * this.SIZE);
        this.scene = scene;
        this.loader = new THREE.TextureLoader();
        this.player = new Player({
            position: new THREE.Vector3(0, 0, 0)
        });
        this.add(this.player);
        this.camera = camera;
        this.controls = controls;
        this.keys = keys;
        this.DEBUG = false;
        this.playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 6), new THREE.MeshStandardMaterial({ envMap: this.scene.background }));
        this.scene.add(this.playerMesh);
        const lineGeo = new THREE.BufferGeometry(); //.setFromPoints([line.start, line.end]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        this.lineMesh = lineMesh;
        this.scene.add(this.lineMesh);
        this.queryTarget = new THREE.WebGLRenderTarget(8192, 1, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        });
        this.visibleBox = new THREE.Box3();
        const helper = new THREE.Box3Helper(this.visibleBox, 0xffffff);
        this.boxHelper = helper;
        this.scene.add(helper);

    }
    async initMaterials() {
        const carpetTex = await this.loader.loadAsync("textures/carpet.png");
        carpetTex.wrapS = THREE.RepeatWrapping;
        carpetTex.wrapT = THREE.RepeatWrapping;
        carpetTex.repeat.set(1, 1);
        carpetTex.anisotropy = 16;
        carpetTex.encoding = THREE.sRGBEncoding;
        const carpetHeight = await this.loader.loadAsync("textures/carpetDisplacement.png");
        carpetHeight.wrapS = THREE.RepeatWrapping;
        carpetHeight.wrapT = THREE.RepeatWrapping;
        carpetHeight.repeat.set(1, 1);
        carpetHeight.anisotropy = 16;
        const blueNoise = await this.loader.loadAsync("textures/bluenoise.png");
        blueNoise.wrapS = THREE.RepeatWrapping;
        blueNoise.wrapT = THREE.RepeatWrapping;
        blueNoise.repeat.set(1, 1);
        blueNoise.minFilter = THREE.NearestFilter;
        blueNoise.magFilter = THREE.NearestFilter;
        const whitenoise = await this.loader.loadAsync("textures/whitenoise.png");
        whitenoise.wrapS = THREE.RepeatWrapping;
        whitenoise.wrapT = THREE.RepeatWrapping;
        whitenoise.repeat.set(1, 1);
        whitenoise.anisotropy = 16;
        this.floorMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, map: carpetTex, envMap: this.scene.background });
        this.floorMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.heightMap = { value: carpetHeight };
            shader.uniforms.bluenoise = { value: blueNoise };
            shader.uniforms.resolution = { value: this.resolution };
            shader.uniforms.noise = { value: whitenoise };
            // Apply the "map" texture to the floor, based off the world position of the fragment
            shader.vertexShader = shader.vertexShader.replace("#ifdef USE_TRANSMISSION", "").replace("#ifdef USE_TRANSMISSION", "");
            shader.vertexShader = shader.vertexShader.replace("#endif", "").replace("#endif", "");
            shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `
            vec4 worldPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
                worldPosition = instanceMatrix * worldPosition;
            #endif
            worldPosition = modelMatrix * worldPosition;    
            `);
            shader.fragmentShader = `varying vec3 vWorldPosition;\nuniform sampler2D heightMap;\nuniform sampler2D bluenoise;\nuniform vec2 resolution;\nuniform sampler2D noise;\n` + /*glsl*/ `
            float sum( vec3 v ) { return v.x+v.y+v.z; }
            vec4 textureNoTile( sampler2D tex, in vec2 x, in vec2 gradX, in vec2 gradY)
            {
                float k = texture( noise, 0.005*x ).x; // cheap (cache friendly) lookup
                
                vec2 duvdx = dFdx( x );
                vec2 duvdy = dFdy( x );
                
                float l = k*8.0;
                float f = fract(l);
                
            #if 1
                float ia = floor(l); // my method
                float ib = ia + 1.0;
            #else
                float ia = floor(l+0.5); // suslik's method (see comments)
                float ib = floor(l);
                f = min(f, 1.0-f)*2.0;
            #endif    
                
                vec2 offa = sin(vec2(3.0,7.0)*ia); // can replace with any other hash
                vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

                vec3 cola = textureGrad( tex, x + offa, gradX, gradY ).xyz;
                vec3 colb = textureGrad( tex, x + offb, gradX, gradY ).xyz;
                
                return vec4(mix( cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) ), 1.0);
            }
            ` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", /*glsl*/ `
            vec4 jitter = texture2D(bluenoise, gl_FragCoord.xy / resolution * (resolution / 1024.0));
            vec3 startPos = vWorldPosition;
            vec3 rd = normalize(vWorldPosition - cameraPosition);
            vec3 endPos = startPos + rd * (-0.025 / rd.y);
            float steps = 14.0 + 4.0 * jitter.x;
            vec2 finalUv;
            float scale = 0.5;
            vec2 gradX = dFdx(vWorldPosition.xz * scale);
            vec2 gradY = dFdy(vWorldPosition.xz * scale);
            float i = 0.0;
            for(i = 0.0; i < 1.0; i += 1.0 / steps) {
                vec3 stepPos = mix(startPos, endPos, i);
                vec2 worldUv = stepPos.xz * scale;
                vec4 heightTexel = textureNoTile( heightMap, worldUv, gradX, gradY);
                finalUv = worldUv;
                if ((1.0 - i) < heightTexel.r) {
                    break;
                }
            }
              /*  float refinementSteps = 8.0;
                float dir = 1.0 / steps;
                for(float j = 0.0; j < refinementSteps; j++) {
                    vec3 stepPos = mix(startPos, endPos, i);
                    vec2 worldUv = stepPos.xz * scale;
                    vec4 heightTexel = textureNoTile( heightMap, worldUv, gradX, gradY);
                    finalUv = worldUv;
                    dir *= 0.5;
                    if ((1.0 - i) < heightTexel.r) {
                        i -= dir;
                    } else {
                        i += dir;
                    }
                }*/
                vec2 texelSize = vec2(1.0 / 450.0);
                vec3 texelNormal = normalize(vec3(
                    textureNoTile(heightMap, finalUv + vec2(texelSize.x, 0.0), gradX, gradY).r - textureNoTile(heightMap, finalUv - vec2(texelSize.x, 0.0), gradX, gradY).r,
                    1.0,
                    textureNoTile(heightMap, finalUv + vec2(0.0, texelSize.y), gradX, gradY).r - textureNoTile(heightMap, finalUv - vec2(0.0, texelSize.y), gradX, gradY).r
                ));
            vec4 mapTexel = textureNoTile( map, finalUv, gradX, gradY);
            float ao = pow(dot(vec3(0.0, 1.0, 0.0), texelNormal), 2.0) * (0.5 + 0.5 * (1.0 - i));
            diffuseColor *= mapTexel;
            diffuseColor.rgb *= ao;
            `).replace(`#include <normal_fragment_begin>`, /*glsl*/ `
               vec3 normal = normalize((viewMatrix * vec4(texelNormal, 0.0)).xyz);
               vec3 geometryNormal = normal;
            `);
        }
        const plaster = await this.loader.loadAsync("textures/plaster.jpeg");
        plaster.wrapS = THREE.RepeatWrapping;
        plaster.wrapT = THREE.RepeatWrapping;
        plaster.repeat.set(1, 1);
        plaster.anisotropy = 16;
        plaster.encoding = THREE.sRGBEncoding;
        const plasterNormal = await this.loader.loadAsync("textures/plasternormal.png");
        plasterNormal.wrapS = THREE.RepeatWrapping;
        plasterNormal.wrapT = THREE.RepeatWrapping;
        plasterNormal.repeat.set(1, 1);
        plasterNormal.anisotropy = 16;
        this.wallMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: new THREE.Color(0.8, 0.8, 0.8), alphaTest: 0.5, envMap: this.scene.background });
        this.wallMaterial.onBeforeCompile = (shader) => {
                shader.uniforms.plaster = { value: plaster };
                shader.uniforms.plasterNormal = { value: plasterNormal };
                shader.uniforms.noise = { value: whitenoise };
                shader.vertexShader = shader.vertexShader.replace("#ifdef USE_TRANSMISSION", "").replace("#ifdef USE_TRANSMISSION", "");
                shader.vertexShader = shader.vertexShader.replace("#endif", "").replace("#endif", "");
                shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `
            vec4 worldPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
                worldPosition = instanceMatrix * worldPosition;
            #endif
            worldPosition = modelMatrix * worldPosition;    
            `);
                shader.fragmentShader = "varying vec3 vWorldPosition;\nuniform sampler2D plaster;\nuniform sampler2D noise;\nuniform sampler2D plasterNormal;\n" + /*glsl*/ `
            float sum( vec3 v ) { return v.x+v.y+v.z; }
            vec3 textureNoTile( sampler2D tex, in vec2 x)
            {
                float k = texture( noise, 0.005*x ).x; // cheap (cache friendly) lookup
                
                vec2 duvdx = dFdx( x );
                vec2 duvdy = dFdy( x );
                
                float l = k*8.0;
                float f = fract(l);
                
            #if 1
                float ia = floor(l); // my method
                float ib = ia + 1.0;
            #else
                float ia = floor(l+0.5); // suslik's method (see comments)
                float ib = floor(l);
                f = min(f, 1.0-f)*2.0;
            #endif    
                
                vec2 offa = sin(vec2(3.0,7.0)*ia); // can replace with any other hash
                vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

                vec3 cola = textureGrad( tex, x + offa, duvdx, duvdy ).xyz;
                vec3 colb = textureGrad( tex, x + offb, duvdx, duvdy ).xyz;
                
                return mix( cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
            }
            vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection, vec2 vUv ) {
                vec3 q0 = dFdx( eye_pos.xyz );
                vec3 q1 = dFdy( eye_pos.xyz );
                vec2 st0 = dFdx( vUv.st );
                vec2 st1 = dFdy( vUv.st );
                vec3 N = surf_norm; // normalized
                vec3 q1perp = cross( q1, N );
                vec3 q0perp = cross( N, q0 );
                vec3 T = q1perp * st0.x + q0perp * st1.x;
                vec3 B = q1perp * st0.y + q0perp * st1.y;
                float det = max( dot( T, T ), dot( B, B ) );
                float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );
                return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );
            }
            ` + shader.fragmentShader.replace("#include <map_fragment>", /*glsl*/ `
            mat4 viewMatrixInv = inverse(viewMatrix);
            vec3 norm = (viewMatrixInv * vec4(vNormal, 0.0)).xyz * ( gl_FrontFacing ? 1.0 : - 1.0);
            vec2 worldUv;
            if (abs(norm.y) > 0.9) {
                worldUv = vWorldPosition.xz;
            } else if (abs(norm.x) > 0.9) {
                worldUv = vWorldPosition.zy;
            } else {
                worldUv = vWorldPosition.xy;
            }
            vec4 mapTexel = vec4(textureNoTile(plaster, worldUv), 1.0);
            bool molding = false;
            vec3 rayDir = normalize(vWorldPosition - cameraPosition);
            // Divide raydir by the dot product of it and the camera's world direction
            //rayDir /= dot(rayDir, -viewMatrixInv[2].xyz);
            if (vWorldPosition.y < 0.75) {
                diffuseColor.rgb *= 1.5;
                if (vWorldPosition.y > 0.5 + 0.25 * (1.0 + rayDir.y)) {
                    diffuseColor.rgb *= 1.25;
                    norm = vec3(0.0, 1.0, 0.0);
                }
                molding = true;
            }
            
            if (!molding) {
                diffuseColor *= mapTexel;
            }
            `).replace(`#include <normal_fragment_begin>`, /*glsl*/ `
            vec3 normal = normalize((viewMatrix * vec4(norm, 0.0)).xyz);
            vec3 geometryNormal = normal;
         `).replace("#include <normal_fragment_maps>", /*glsl*/ `
            vec3 mapN = textureNoTile(plasterNormal, worldUv) * 2.0 - 1.0;
	        mapN.xy *= gl_FrontFacing ? 1.0 : - 1.0;
            mapN.xy *= 0.5;
            if (molding) {
                mapN.xy *= 0.0;
            }
            #ifdef USE_TANGENT
            normal = normalize( vTBN * mapN );
            #else
                normal = perturbNormal2Arb( - vViewPosition, normal, mapN, gl_FrontFacing ? 1.0 : - 1.0, worldUv );
            #endif
            `);

            }
            /* this.ceilingMaterial = this.wallMaterial.clone();
             this.ceilingMaterial.onBeforeCompile = this.wallMaterial.onBeforeCompile;*/
        const ceilingTex = await this.loader.loadAsync("textures/tile.png");
        ceilingTex.wrapS = THREE.RepeatWrapping;
        ceilingTex.wrapT = THREE.RepeatWrapping;
        ceilingTex.repeat.set(1, 1);
        ceilingTex.anisotropy = 16;
        ceilingTex.encoding = THREE.sRGBEncoding;
        this.ceilingMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, map: carpetTex, envMap: this.scene.background });
        this.ceilingShader = null;
        this.ceilingMaterial.onBeforeCompile = (shader) => {
            this.ceilingShader = shader;
            shader.uniforms.plaster = { value: ceilingTex };
            shader.uniforms.time = { value: performance.now() / 1000 };
            shader.vertexShader = shader.vertexShader.replace("#ifdef USE_TRANSMISSION", "").replace("#ifdef USE_TRANSMISSION", "");
            shader.vertexShader = shader.vertexShader.replace("#endif", "").replace("#endif", "");
            shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `
            vec4 worldPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
                worldPosition = instanceMatrix * worldPosition;
            #endif
            worldPosition = modelMatrix * worldPosition;    
            `);
            shader.fragmentShader = "varying vec3 vWorldPosition;\nuniform sampler2D plaster;\nuniform float time;\n" + /*glsl*/ `
                vec2 posToUv(vec2 pos) {
                    vec2 size = vec2(${this.SIZE}.0);
                    vec2 uv = pos + size / 2.0;
                    uv /= size;
                    uv.y = 1.0 - uv.y;
                    return uv;
                }
                vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
float lightFunc(float x) {
    if (x > 0.01 || x < -0.01) {
        return 1.0;
    }
    return 0.5 + 0.5 * cos(x * 800.0 * 6.283185307179586);
}
            ` + shader.fragmentShader.replace("#include <map_fragment>", /*glsl*/ `
                vec4 mapTexel = vec4(texture2D(plaster, vWorldPosition.xz * 0.5).rgb, 1.0);
                diffuseColor *= mapTexel;
                vec2 nearestCell = floor(vWorldPosition.xz * 0.5);
                if (mod(nearestCell.x, 3.0) == 1.0) {
                    nearestCell.x -= 1.0;
                }
                if (mod(nearestCell.y, 3.0) == 1.0) {
                    nearestCell.y -= 1.0;
                }
                if (mod(nearestCell.x, 3.0) == 2.0) {
                    nearestCell.x += 1.0;
                }
                if (mod(nearestCell.y, 3.0) == 2.0) {
                    nearestCell.y += 1.0;
                }
                float illum = lightFunc(snoise(vec3(nearestCell, time * 0.025)));
               vec2 cell = floor(vWorldPosition.xz * 0.5);
               if (mod(cell.x, 3.0) == 0.0 && mod(cell.y, 3.0) == 0.0) {
                vec2 cellWorld = cell * 2.0;
                vec2 corner1 = posToUv(cellWorld);
                vec2 corner2 = posToUv(cellWorld + vec2(2.01, 2.01));
                vec2 corner3 = posToUv(cellWorld + vec2(2.01, 0.0));
                vec2 corner4 = posToUv(cellWorld + vec2(0.0, 2.01));
                vec2 corner5 = posToUv(cellWorld + vec2(1.01, 1.01));
                if (textureLod(alphaMap, corner1, 0.0).a == 1.0 && textureLod(alphaMap, corner2, 0.0).a == 1.0 && textureLod(alphaMap, corner3, 0.0).a == 1.0 && textureLod(alphaMap, corner4, 0.0).a == 1.0 && textureLod(alphaMap, corner5, 0.0).a == 1.0) {
                    totalEmissiveRadiance += vec3(illum);
                    diffuseColor = vec4(vec3(1.0), 1.0);
                }
            } {
                    vec2 cellWorld = nearestCell * 2.0;
                    vec2 corner1 = posToUv(cellWorld);
                    vec2 corner2 = posToUv(cellWorld + vec2(2.01, 2.01));
                    vec2 corner3 = posToUv(cellWorld + vec2(2.01, 0.0));
                    vec2 corner4 = posToUv(cellWorld + vec2(0.0, 2.01));
                    vec2 corner5 = posToUv(cellWorld + vec2(1.01, 1.01));
                    if (textureLod(alphaMap, corner1, 0.0).a == 1.0 && textureLod(alphaMap, corner2, 0.0).a == 1.0 && textureLod(alphaMap, corner3, 0.0).a == 1.0 && textureLod(alphaMap, corner4, 0.0).a == 1.0 && textureLod(alphaMap, corner5, 0.0).a == 1.0) {
                        totalEmissiveRadiance += 0.1 * illum * sqrt(pow(mod(vWorldPosition.x * 0.5 - 0.5, 3.0) - 1.5, 2.0) * pow(mod(vWorldPosition.z * 0.5 - 0.5, 3.0) - 1.5, 2.0));
                    }
                }            
            `);


        };
        this.door = await new GLTFLoader().loadAsync("models/door.glb");
        this.door.scene.scale.set(0.5 * (8 / 9), 0.5, 0.5 * (8 / 9));
        this.door.scene.traverse(e => {
            if (e.isMesh) {
                e.material.envMap = this.scene.background;
                if (e.material instanceof THREE.MeshPhysicalMaterial) {
                    e.material.roughness = 0.0;
                    e.material.thickness = 0.1;
                    e.material.ior = 1.5;
                }
                if (e.material.map) {
                    e.material.map.encoding = THREE.sRGBEncoding;
                    e.material.needsUpdate = true;
                    e.material.map.needsUpdate = true;
                }
            }
        });
        this.door = this.door.scene;
        this.frames = (await new GLTFLoader().loadAsync("models/frames.glb")).scene;
        this.frames.traverse(e => {
            if (e.isMesh) {
                e.material.envMap = this.scene.background;
                if (e.material.map) {
                    e.material.map.encoding = THREE.sRGBEncoding;
                    e.material.needsUpdate = true;
                    e.material.map.needsUpdate = true;
                }
            }
        });
        this.frameMaterial = this.frames.children[0].material;
        // There is a textures/paintings folder, that contains 64 pngs of unique pantings.
        // The paintings are named art1.png, art2.png, art3.png, etc.
        // The first 16 paintings have a resolution of 842 x 842 pixels.
        // The next 16 paintings have a resolution of 561 x 841 pixels.
        // The remaining 32 paintings have a resolution of 1264 x 843 pixels.
        // Use Promise.All and this.loader to load all the paintings.
        // The paintings should be placed in 3 arrays - one for the 1:1 paintings, one for the 2:3 paintings, and one for the 3:2 paintings.

        this.paintings = [];
        // const inspirobot = await this.loader.loadAsync(await (await fetch("https://inspirobot.me/api?generate=true")).text());
        let paintingGened = [];
        while (paintingGened.length < 64) {
            const needed = 64 - paintingGened.length;
            const urlProto = await Promise.all(Array(needed).fill(0).map(() => fetch("https://inspirobot.me/api?generate=true")));
            const urls = await Promise.all(urlProto.map(url => url.text()));
            const paintingTest = await Promise.allSettled(urls.map(url => this.loader.loadAsync(url)));
            paintingGened.push(...paintingTest.filter(p => p.status === "fulfilled").map(p => p.value));
        }
        const paintings = paintingGened; // await Promise.all(Array(64).fill().map((_, i) => this.loader.loadAsync(`textures/paintings/art${i + 1}.png`)));
        paintings.forEach((painting, i) => {
            painting.encoding = THREE.sRGBEncoding;
            painting.needsUpdate = true;
            this.paintings.push(painting);
        });
        // Convert each paintings array into a DataArrayTexture
        // The first texture should be 842x842x16
        // The second texture should be 561x841x16
        // The third texture should be 1264x843x32
        // The DataArrayTexture should be stored in this.paintings1Texture, this.paintings2Texture, and this.paintings3Texture
        this.paintingsTexture = new THREE.DataArrayTexture(this.texArrToArray(this.paintings, 1024, 1024, 64), 1024, 1024, 64);
        this.paintingsTexture.encoding = THREE.sRGBEncoding;

        this.paintingsTexture.needsUpdate = true;
        // Make all the textures have mipmaps
        this.paintingsTexture.generateMipmaps = true;
        this.paintingsTexture.magFilter = THREE.LinearFilter;
        this.paintingsTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.paintingsTexture.anisotropy = 16;
        this.paintingMaterial = new THREE.MeshStandardMaterial({ envMap: this.scene.background, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, map: new THREE.Texture(), dithering: true });
        this.paintingMaterial.onBeforeCompile = (shader) => {
            // Pass each painting texture as a uniform
            shader.uniforms.paintings = { value: this.paintingsTexture };
            // Add the attribute 'id' to the vertex shader and pass it as a varying
            shader.vertexShader = "attribute float id;\nvarying float vId;\n" + shader.vertexShader.replace("#include <begin_vertex>", /*glsl*/ `
            #include <begin_vertex>
            vId = id;`);
            shader.fragmentShader = "precision highp sampler2DArray;\nuniform sampler2DArray paintings;\nvarying float vId;\n" + shader.fragmentShader.replace("#include <map_fragment>", /*glsl*/ `
            vec4 mapTexel = vec4(0.0);
            float bias = -0.5;
            vec2 dx = dFdx(vUv) * 0.25;
            vec2 dy = dFdy(vUv) * 0.25;
            mapTexel += textureLod(paintings, vec3(vUv + dx + dy, vId), -0.5);
            mapTexel += textureLod(paintings, vec3(vUv - dx + dy, vId), -0.5);
            mapTexel += textureLod(paintings, vec3(vUv + dx - dy, vId), -0.5);
            mapTexel += textureLod(paintings, vec3(vUv - dx - dy, vId), -0.5);
            mapTexel *= 0.25;
              // mapTexel = vec4(textureLod(paintings, vec3(vUv, vId), -0.5).rgb, 1.0);
            diffuseColor *= mapTexel;`);
        }
    }
    texArrToArray(arr, width, height, depth) {
        // Arr consists of 16 or 32 textures of the same size. Each texture needs to have its data copied to the CPU via canvas.
        // The data from each texture needs to be copied into a single array, which will be used to create a DataArrayTexture.
        // The array should be returned.
        const size = width * height * 4;
        const data = new Uint8Array(size * depth);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;
        ctx.translate(width / 2, height / 2);
        ctx.scale(1, -1);
        arr.forEach((tex, i) => {
            ctx.drawImage(tex.image, -width / 2, -height / 2, width, height);
            data.set(ctx.getImageData(0, 0, width, height).data, size * i);
        });
        return data;
    }
    async generateWorld() {
        await this.initMaterials();
        const roomAmt = 1500;
        let rooms = this.makeRoomList(roomAmt);
        const finalEdges = this.findEdges(rooms, roomAmt);
        const lineBoxes = this.makeLineBoxes(finalEdges, rooms);
        rooms = rooms.filter(x => x.main || x.side);
        this.addBoxesAsEntities(rooms, Room);
        this.addBoxesAsEntities(lineBoxes, Hallway);
        let segments = this.calcSegments(lineBoxes, rooms);
        const SIZE = this.SIZE;
        this.splatRooms(rooms);
        this.splatHalls(lineBoxes);
        let geometry = new THREE.BufferGeometry();
        const verts = this.calcVerts();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const geoClone = geometry.clone();
        const { doors, holes: doorHoleFills } = this.computeDoorsAndHoles(geoClone, segments);
        const doorBoxes = doors.map(door => new THREE.Box3().setFromObject(door, true));
        doors.forEach((door, i) => {
            // Don't add the door to the scene if it intersects other doors
            for (let j = i + 1; j < doors.length; j++) {
                if (doorBoxes[i].intersectsBox(doorBoxes[j])) {
                    return;
                }
            }
            this.scene.add(door);
            // Door(position, bounds)
            const box = new THREE.Box3().setFromObject(door, true);
            const d = new Door({
                position: box.getCenter(new THREE.Vector3()),
                bounds: box,
                model: door
            });
            this.add(d);
        });
        geometry = this.finalizeGeometry(geometry, doorHoleFills);
        const material = this.wallMaterial; //new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.5, 0.5), side: THREE.DoubleSide });
        const wallMesh = new THREE.Mesh(geometry, material);
        this.scene.add(wallMesh);
        const roomAlphaMap = this.makeRoomAlphaMap();
        this.floorMaterial.alphaMap = roomAlphaMap;
        this.ceilingMaterial.alphaMap = roomAlphaMap;
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), this.floorMaterial);
        floor.position.set(-0.5, 0, -0.5);
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), this.ceilingMaterial);
        ceiling.position.set(-0.5, 12, -0.5);
        this.scene.add(floor);
        this.scene.add(ceiling);
        this.floor = floor;
        this.ceiling = ceiling;
        floor.updateMatrix();
        ceiling.updateMatrix();
        floor.updateMatrixWorld();
        ceiling.updateMatrixWorld();
        // Make a BVH of the wallMesh, floor, and ceiling combined
        const mergedGeo = BufferGeometryUtils.mergeBufferGeometries([wallMesh.geometry.clone().applyMatrix4(wallMesh.matrixWorld), floor.geometry.toNonIndexed().applyMatrix4(floor.matrixWorld), ceiling.geometry.toNonIndexed().applyMatrix4(ceiling.matrixWorld)].map(x => {
            // delete all attributes that aren't position or normals
            for (const key of Object.keys(x.attributes)) {
                if (key !== "position" && key !== "normal") {
                    delete x.attributes[key];
                }
            }
            return x;
        }), true);
        this.mergedGeo = mergedGeo;
        const bvh = new MeshBVH(mergedGeo, { lazyGeneration: false, strategy: SAH, maxLeafTris: 2 });
        this.bvh = bvh;
        const occlusionBVH = new MeshBVH(BufferGeometryUtils.mergeBufferGeometries([wallMesh.geometry.clone().applyMatrix4(wallMesh.matrixWorld)].map(x => {
            // delete all attributes that aren't position or normals
            for (const key of Object.keys(x.attributes)) {
                if (key !== "position" && key !== "normal") {
                    delete x.attributes[key];
                }
            }
            return x;
        }), true), { lazyGeneration: false, strategy: SAH, maxLeafTris: 2 });
        this.occlusionBVH = occlusionBVH;
        const queryQuad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: {
                bvh: { value: new MeshBVHUniformStruct() },
                origin: { value: this.player.position }
            },
            vertexShader: /*glsl*/ `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /*glsl*/ `
            precision highp isampler2D;
            precision highp usampler2D;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            uniform samplerCube envMap;
            uniform float bounces;
            ${ shaderStructs }
            ${ shaderIntersectFunction }
            uniform BVH bvh;
            uniform vec3 origin;
            void main() {
               vec3 rayOrigin = origin;
               vec3 rayDirection = vec3(sin(vUv.x * 6.283185307179586), 0.0, cos(vUv.x * 6.283185307179586));
               uvec4 faceIndices = uvec4( 0u );
               vec3 faceNormal = vec3( 0.0, 0.0, 1.0 );
               vec3 barycoord = vec3( 0.0 );
               float side = 1.0;
               float dist = 0.0;
               bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist );
               vec3 hitPos = rayOrigin + rayDirection * dist;
               gl_FragColor = vec4(hitPos, 1.0);
            }
            `
        }));
        queryQuad.material.uniforms.bvh.value.updateFrom(occlusionBVH);
        this.queryQuad = queryQuad;
        const bvhMesh = new THREE.Mesh(mergedGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
        bvhMesh.geometry.boundsTree = bvh;
        this.bvhMeshViz = bvhMesh;
        const viz = new MeshBVHVisualizer(bvhMesh, 20);
        viz.visible = true;
        viz.color.set(0xffff00);
        viz.update();
        this.bvhMeshVizDepth = viz;
        this.scene.add(bvhMesh);
        this.scene.add(viz);

        // Generate line segments that represent paintings from rooms and lineBoxes
        this.generatePaintings(rooms);
        const center = rooms[0].getCenter(new THREE.Vector2());
        this.player.position.set(center.x, 6, center.y);
    }
    add(entity) {
        entity.world = this;
        this.entities.push(entity);
    }
    update(delta) {
        for (const entity of this.entities) {
            if (entity !== this.player) {
                entity.update(delta);
            }
            // Occlusion culling
            if (entity.model && entity.box) {
                entity.model.visible = this.visibleBox.intersectsBox(entity.box);
            }
        }
        this.ceilingShader.uniforms.time.value = performance.now() / 1000;
        for (let i = 0; i < 5; i++) {
            for (const entity of this.entities) {
                if (entity instanceof Door && !entity.open) {
                    // Handle collision logic
                    this.player.collideDoor(entity);
                }
            }
            this.player.update(delta / 5, this.bvh);
            for (const entity of this.entities) {
                if (entity instanceof Door && !entity.open) {
                    // Handle collision logic
                    this.player.collideDoor(entity);
                }
            }
        }
        this.player.move(delta);
        this.camera.position.copy(this.player.position);
        this.playerMesh.position.copy(this.player.position);
        // Make the players head bob
        const slowOffset = 0.25 * Math.sin(performance.now() / 1000);
        const fastOffset = 0.25 * Math.sin(performance.now() / 75);
        if (this.DEBUG) {
            this.camera.position.y += 50;
            this.camera.lookAt(this.player.position);
        } else {
            this.camera.position.y += slowOffset + (fastOffset - slowOffset) * Math.min(10 * this.player.horizontalVelocity.length(), 1);
        }
        this.computeOcclusionVolume();
        this.playerMesh.visible = this.DEBUG;
        this.ceiling.visible = !this.DEBUG;
        this.bvhMeshViz.visible = this.DEBUG;
        this.bvhMeshVizDepth.visible = this.DEBUG;
        this.boxHelper.visible = this.DEBUG;
        this.lineMesh.visible = this.DEBUG;
    }
    computeOcclusionVolume() {
        // Cast 360 rays from the players position in a circle along the xz plane against this.bvh
        const points = [];
        const ray = new THREE.Ray(this.player.position, new THREE.Vector3());
        for (let i = 0; i < 2 * Math.PI; i += Math.PI / 360) {
            ray.direction.set(Math.cos(i), 0, Math.sin(i));
            const intersection = this.occlusionBVH.raycastFirst(ray, THREE.DoubleSide);
            if (intersection) {
                points.push(ray.origin, intersection.point);
            }
        }
        this.visibleBox.setFromPoints(points);
        if (this.DEBUG) {
            this.lineMesh.geometry.setFromPoints(points);
            this.lineMesh.geometry.needsUpdate = true;
            this.lineMesh.geometry.attributes.position.needsUpdate = true;
            this.lineMesh.geometry.computeBoundingBox();
            this.lineMesh.geometry.computeBoundingSphere();
        }
        /* console.time();
         this.renderer.setRenderTarget(this.queryTarget);
         this.queryQuad.render(this.renderer);
         this.renderer.setRenderTarget(null);
         const pixels = new Float32Array(4 * this.queryTarget.width * this.queryTarget.height);
         this.renderer.readRenderTargetPixels(this.queryTarget, 0, 0, this.queryTarget.width, this.queryTarget.height, pixels);
         const points = [];
         for (let i = 0; i < pixels.length; i += 4) {
             points.push(this.player.position, new THREE.Vector3(pixels[i], pixels[i + 1], pixels[i + 2]));
         }
         this.lineMesh.geometry.setFromPoints(points);
         this.lineMesh.geometry.needsUpdate = true;
         this.lineMesh.geometry.attributes.position.needsUpdate = true;
         this.lineMesh.geometry.computeBoundingBox();
         this.lineMesh.geometry.computeBoundingSphere();
         console.timeEnd();*/
    }
    registerClick() {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const doors = this.entities.filter(x => x instanceof Door);
        const ray = raycaster.ray;
        const intersections = doors.filter(door => {
            return ray.intersectsBox(door.bounds) && !door.open;
        }).map(door => {
            return [door, ray.intersectBox(door.bounds, new THREE.Vector3())];
        });
        // Now intersect ray with bvh
        const geoIntersection = this.bvh.raycastFirst(ray, THREE.DoubleSide);
        intersections.sort((a, b) => {
            return a[1].distanceTo(ray.origin) - b[1].distanceTo(ray.origin);
        })
        if (intersections.length > 0) {
            const iDist = intersections[0][1].distanceTo(ray.origin);
            if (iDist < geoIntersection.distance && iDist < 7.5) {
                intersections[0][0].openUp(ray.origin);
            }
        }
    }
    registerKey(key) {
        if (key === "i") {
            this.DEBUG = !this.DEBUG;
        }
    }
    generatePaintings(rooms) {
        const paintings = [];
        // For each box, get a random line segment along the edge of said box
        rooms.forEach(room => {
            for (let i = 0; i < 1 + Math.floor(Math.random() * Math.random() * 3); i++) {
                const center = room.getCenter(new THREE.Vector2());
                const size = room.getSize(new THREE.Vector2());
                const dir = Math.floor(Math.random() * 4);
                let paintingWidth;
                let paintingHeight;
                let seed = Math.random();
                let id = Math.floor(seed * 64);
                if (seed < 0.25) {
                    paintingWidth = 5;
                    paintingHeight = 5;
                } else if (seed < 0.5) {
                    paintingWidth = 5;
                    paintingHeight = 7.5;
                } else {
                    paintingWidth = 7.5;
                    paintingHeight = 5;
                }
                let painting;
                if (dir === 0) {
                    // Randomly move the center by half the room's size 
                    center.z += (Math.random() - 0.5) * (size.z) * 0.5;
                    // Fire 4 rays along dir 0 (x-axis positive), offset by in 5x5 box
                    const ray1 = new THREE.Ray(new THREE.Vector3(center.x, 6 - paintingWidth / 2, center.y - paintingHeight / 2), new THREE.Vector3(1, 0, 0));
                    const ray2 = new THREE.Ray(new THREE.Vector3(center.x, 6 - paintingWidth / 2, center.y + paintingHeight / 2), new THREE.Vector3(1, 0, 0));
                    const ray3 = new THREE.Ray(new THREE.Vector3(center.x, 6 + paintingWidth / 2, center.y - paintingHeight / 2), new THREE.Vector3(1, 0, 0));
                    const ray4 = new THREE.Ray(new THREE.Vector3(center.x, 6 + paintingWidth / 2, center.y + paintingHeight / 2), new THREE.Vector3(1, 0, 0));
                    const ray5 = new THREE.Ray(new THREE.Vector3(center.x, 6, center.y), new THREE.Vector3(1, 0, 0));
                    const hits = [];
                    const hit1 = this.bvh.raycastFirst(ray1, THREE.DoubleSide);
                    const hit2 = this.bvh.raycastFirst(ray2, THREE.DoubleSide);
                    const hit3 = this.bvh.raycastFirst(ray3, THREE.DoubleSide);
                    const hit4 = this.bvh.raycastFirst(ray4, THREE.DoubleSide);
                    const hit5 = this.bvh.raycastFirst(ray5, THREE.DoubleSide);
                    if (hit1 && hit2 && hit3 && hit4 && hit5) {
                        hits.push(hit1, hit2, hit3, hit4, hit5);
                        if (hits.every(hit => hit.distance === hits[0].distance)) {
                            // All hits are the same distance, so we can make a painting
                            painting = new THREE.Mesh(new THREE.PlaneGeometry(paintingWidth, paintingHeight), this.paintingMaterial);
                            painting.rotateY(Math.PI / 2);
                            //Set position to the center of the 4 hits
                            let a = hits[0].point;
                            let b = hits[1].point;
                            let c = hits[2].point;
                            let d = hits[3].point;
                            painting.position.set((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4, (a.z + b.z + c.z + d.z) / 4);
                        }
                    }
                } else if (dir === 1) {
                    center.z += (Math.random() - 0.5) * (size.z) * 0.5;
                    const ray1 = new THREE.Ray(new THREE.Vector3(center.x, 6 - paintingWidth / 2, center.y - paintingHeight / 2), new THREE.Vector3(-1, 0, 0));
                    const ray2 = new THREE.Ray(new THREE.Vector3(center.x, 6 - paintingWidth / 2, center.y + paintingHeight / 2), new THREE.Vector3(-1, 0, 0));
                    const ray3 = new THREE.Ray(new THREE.Vector3(center.x, 6 + paintingWidth / 2, center.y - paintingHeight / 2), new THREE.Vector3(-1, 0, 0));
                    const ray4 = new THREE.Ray(new THREE.Vector3(center.x, 6 + paintingWidth / 2, center.y + paintingHeight / 2), new THREE.Vector3(-1, 0, 0));
                    const ray5 = new THREE.Ray(new THREE.Vector3(center.x, 6, center.y), new THREE.Vector3(-1, 0, 0));
                    const hits = [];
                    const hit1 = this.bvh.raycastFirst(ray1, THREE.DoubleSide);
                    const hit2 = this.bvh.raycastFirst(ray2, THREE.DoubleSide);
                    const hit3 = this.bvh.raycastFirst(ray3, THREE.DoubleSide);
                    const hit4 = this.bvh.raycastFirst(ray4, THREE.DoubleSide);
                    const hit5 = this.bvh.raycastFirst(ray5, THREE.DoubleSide);
                    if (hit1 && hit2 && hit3 && hit4 && hit5) {
                        hits.push(hit1, hit2, hit3, hit4, hit5);
                        if (hits.every(hit => hit.distance === hits[0].distance)) {
                            painting = new THREE.Mesh(new THREE.PlaneGeometry(paintingWidth, paintingHeight), this.paintingMaterial);
                            painting.rotateY(-Math.PI / 2);
                            //Set position to the center of the 4 hits
                            let a = hit1.point;
                            let b = hit2.point;
                            let c = hit3.point;
                            let d = hit4.point;
                            painting.position.set((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4, (a.z + b.z + c.z + d.z) / 4);
                        }
                    }
                } else if (dir === 2) {
                    center.x += (Math.random() - 0.5) * (size.x) * 0.5;
                    const ray1 = new THREE.Ray(new THREE.Vector3(center.x - paintingWidth / 2, 6 - paintingHeight / 2, center.y), new THREE.Vector3(0, 0, 1));
                    const ray2 = new THREE.Ray(new THREE.Vector3(center.x + paintingWidth / 2, 6 - paintingHeight / 2, center.y), new THREE.Vector3(0, 0, 1));
                    const ray3 = new THREE.Ray(new THREE.Vector3(center.x - paintingWidth / 2, 6 + paintingHeight / 2, center.y), new THREE.Vector3(0, 0, 1));
                    const ray4 = new THREE.Ray(new THREE.Vector3(center.x + paintingWidth / 2, 6 + paintingHeight / 2, center.y), new THREE.Vector3(0, 0, 1));
                    const ray5 = new THREE.Ray(new THREE.Vector3(center.x, 6, center.y), new THREE.Vector3(0, 0, 1));
                    const hits = [];
                    const hit1 = this.bvh.raycastFirst(ray1, THREE.DoubleSide);
                    const hit2 = this.bvh.raycastFirst(ray2, THREE.DoubleSide);
                    const hit3 = this.bvh.raycastFirst(ray3, THREE.DoubleSide);
                    const hit4 = this.bvh.raycastFirst(ray4, THREE.DoubleSide);
                    const hit5 = this.bvh.raycastFirst(ray5, THREE.DoubleSide);
                    if (hit1 && hit2 && hit3 && hit4 && hit5) {
                        hits.push(hit1, hit2, hit3, hit4, hit5);
                        if (hits.every(hit => hit.distance === hits[0].distance)) {
                            painting = new THREE.Mesh(new THREE.PlaneGeometry(paintingWidth, paintingHeight), this.paintingMaterial);
                            //Set position to the center of the 4 hits
                            let a = hit1.point;
                            let b = hit2.point;
                            let c = hit3.point;
                            let d = hit4.point;
                            painting.position.set((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4, (a.z + b.z + c.z + d.z) / 4);
                        }
                    }
                } else if (dir === 3) {
                    center.x += (Math.random() - 0.5) * (size.x) * 0.5;
                    // negative z axis
                    const ray1 = new THREE.Ray(new THREE.Vector3(center.x - paintingWidth / 2, 6 - paintingHeight / 2, center.y), new THREE.Vector3(0, 0, -1));
                    const ray2 = new THREE.Ray(new THREE.Vector3(center.x + paintingWidth / 2, 6 - paintingHeight / 2, center.y), new THREE.Vector3(0, 0, -1));
                    const ray3 = new THREE.Ray(new THREE.Vector3(center.x - paintingWidth / 2, 6 + paintingHeight / 2, center.y), new THREE.Vector3(0, 0, -1));
                    const ray4 = new THREE.Ray(new THREE.Vector3(center.x + paintingWidth / 2, 6 + paintingHeight / 2, center.y), new THREE.Vector3(0, 0, -1));
                    const ray5 = new THREE.Ray(new THREE.Vector3(center.x, 6, center.y), new THREE.Vector3(0, 0, -1));
                    const hits = [];
                    const hit1 = this.bvh.raycastFirst(ray1, THREE.DoubleSide);
                    const hit2 = this.bvh.raycastFirst(ray2, THREE.DoubleSide);
                    const hit3 = this.bvh.raycastFirst(ray3, THREE.DoubleSide);
                    const hit4 = this.bvh.raycastFirst(ray4, THREE.DoubleSide);
                    const hit5 = this.bvh.raycastFirst(ray5, THREE.DoubleSide);
                    if (hit1 && hit2 && hit3 && hit4 && hit5) {
                        hits.push(hit1, hit2, hit3, hit4, hit5);
                        if (hits.every(hit => hit.distance === hits[0].distance)) {
                            painting = new THREE.Mesh(new THREE.PlaneGeometry(paintingWidth, paintingHeight), this.paintingMaterial);
                            painting.rotateY(Math.PI);
                            //Set position to the center of the 4 hits
                            let a = hit1.point;
                            let b = hit2.point;
                            let c = hit3.point;
                            let d = hit4.point;
                            painting.position.set((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4, (a.z + b.z + c.z + d.z) / 4);
                        }
                    }
                }
                if (painting) {
                    // Check to see if the painting's bounding box intersects any other paintings
                    const box = new THREE.Box3().setFromObject(painting, true).expandByScalar(0.25);
                    if (paintings.some(p => p.box.intersectsBox(box))) {
                        painting.geometry.dispose();
                        return;
                    }
                    painting.geometry.setAttribute("id", new THREE.BufferAttribute((new Float32Array(painting.geometry.attributes.position.count)).fill(id), 1));
                    paintings.push(painting);
                    //Add frame from this.frames.children
                    const frame = this.frames.children[(id < 16 ? 0 : (id < 32 ? 2 : 1))].clone();
                    //frame.scale.set(0.5, 0.5, 0.5);
                    frame.position.set(painting.position.x, painting.position.y, painting.position.z);
                    frame.rotation.y = painting.rotation.y + Math.PI / 2;
                    painting.frame = frame;
                    painting.box = box;

                }
            }
        });
        // Combine the paintings and the frame geos into two final meshes
        paintings.forEach(painting => {
            painting.rotation.y += Math.PI;
            painting.updateMatrix();
            painting.updateMatrixWorld();
            painting.frame.updateMatrix();
            painting.frame.updateMatrixWorld();
        });
        const paintingGeometryAll = BufferGeometryUtils.mergeBufferGeometries(paintings.map(painting => painting.geometry.clone().applyMatrix4(painting.matrixWorld)), true);
        const frameGeometryAll = BufferGeometryUtils.mergeBufferGeometries(paintings.map(painting => painting.frame.geometry.clone().applyMatrix4(painting.frame.matrixWorld)), true);
        const paintingMesh = new THREE.Mesh(paintingGeometryAll, this.paintingMaterial);
        const frameMesh = new THREE.Mesh(frameGeometryAll, this.frameMaterial);
        this.scene.add(paintingMesh);
        this.scene.add(frameMesh);
    }
    makeRoomList(amt) {
        let rooms = [];
        for (let i = 0; i < amt; i++) {
            const room = new THREE.Box2();
            room.setFromCenterAndSize(new THREE.Vector2(Math.random() * 100 - 50, Math.random() * 100 - 50), new THREE.Vector2(15 + 25 * (Math.random() ** 2), 15 + 25 * (Math.random() ** 2)));
            rooms.push(room);
        }
        const v1 = new THREE.Vector2();
        const v2 = new THREE.Vector2();
        const v3 = new THREE.Vector2();
        while (true) {
            let total = 0;
            rooms.forEach(room => {
                const velocity = new THREE.Vector2();
                let added = 0;
                rooms.forEach(room2 => {
                    if (room.intersectsBox(room2)) {
                        const center = room.getCenter(v1);
                        const center2 = room2.getCenter(v2);
                        velocity.add(center2.sub(center));
                        added += 1;
                    }
                });
                total += added;
                velocity.multiplyScalar(1 / added);
                velocity.multiplyScalar(-1);
                const center = room.getCenter(v3);
                center.add(velocity);
                room.setFromCenterAndSize(center, room.max.sub(room.min));
            });
            if (total === rooms.length) {
                break;
            }
        }
        rooms.sort((a, b) => {
            return b.getSize(new THREE.Vector2()).length() - a.getSize(new THREE.Vector2()).length();
        });
        rooms.map(room => {
            room.min.x = Math.floor(room.min.x);
            room.min.y = Math.floor(room.min.y);
            room.max.x = Math.ceil(room.max.x);
            room.max.y = Math.ceil(room.max.y);
        });
        for (let i = 0; i < Math.floor(amt / 3); i++) {
            rooms[i].main = true;
        }
        return rooms;
    }
    calcSegments(lineBoxes, rooms) {
        let segments = [];
        lineBoxes.forEach(lineBox => {
            rooms.forEach(room => {
                if (room.intersectsBox(lineBox)) {
                    const intersection = lineBox.clone().intersect(room);
                    const seg1 = [new THREE.Vector2(intersection.min.x, intersection.min.y), new THREE.Vector2(intersection.max.x, intersection.min.y)];
                    const seg2 = [new THREE.Vector2(intersection.max.x, intersection.min.y), new THREE.Vector2(intersection.max.x, intersection.max.y)];
                    const seg3 = [new THREE.Vector2(intersection.max.x, intersection.max.y), new THREE.Vector2(intersection.min.x, intersection.max.y)];
                    const seg4 = [new THREE.Vector2(intersection.min.x, intersection.max.y), new THREE.Vector2(intersection.min.x, intersection.min.y)];
                    seg1.normal = seg1[0].clone().add(seg1[1]).multiplyScalar(0.5).sub(room.getCenter(new THREE.Vector3())).normalize();
                    seg2.normal = seg2[0].clone().add(seg2[1]).multiplyScalar(0.5).sub(room.getCenter(new THREE.Vector3())).normalize();
                    seg3.normal = seg3[0].clone().add(seg3[1]).multiplyScalar(0.5).sub(room.getCenter(new THREE.Vector3())).normalize();
                    seg4.normal = seg4[0].clone().add(seg4[1]).multiplyScalar(0.5).sub(room.getCenter(new THREE.Vector3())).normalize();
                    const roomBounds = room.clone().expandByScalar(-0.1);
                    const smallerRoom = room.clone();
                    const roomSize = room.getSize(new THREE.Vector2());
                    if ((room.max.x - room.min.x) > (room.max.y - room.min.y)) {
                        smallerRoom.min.x += roomSize.x / 8;
                        smallerRoom.max.x -= roomSize.x / 8;
                    } else {
                        smallerRoom.min.y += roomSize.y / 8;
                        smallerRoom.max.y -= roomSize.y / 8;
                    }
                    if (Math.abs(intersection.max.x - intersection.min.x) > Math.abs(intersection.max.y - intersection.min.y)) {
                        if (room.main) {
                            if (!roomBounds.containsPoint(seg2[0]) && !roomBounds.containsPoint(seg2[1])) {
                                segments.push(seg2);
                            }
                            if (!roomBounds.containsPoint(seg4[0]) && !roomBounds.containsPoint(seg4[1])) {
                                segments.push(seg4);
                            }
                        }
                    } else {
                        if (room.main) {
                            if (!roomBounds.containsPoint(seg1[0]) && !roomBounds.containsPoint(seg1[1])) {
                                segments.push(seg1);
                            }
                            if (!roomBounds.containsPoint(seg3[0]) && !roomBounds.containsPoint(seg3[1])) {
                                segments.push(seg3);
                            }
                        }

                    }
                }
            })
        });
        segments = segments.filter(segment => segment[0].distanceTo(segment[1]) === 4);
        return segments;
    }
    calcVerts() {
        const SIZE = this.SIZE;
        const verts = [];
        const xOffset = -SIZE / 2;
        const yOffset = -SIZE / 2;
        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < SIZE; y++) {
                const index = x + y * SIZE;
                if (this.roomData[index] === 0) {
                    // Check if any of the 4 neighbors are above 0 - if so add a square wall
                    if (this.roomData[index - 1] > 0) {
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset - 0.5);
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset + 0.5);
                        verts.push(x + xOffset - 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset - 0.5, 8.0, y + yOffset - 0.5);
                        verts.push(x + xOffset - 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset - 0.5);
                    }
                    if (this.roomData[index + 1] > 0) {
                        verts.push(x + xOffset + 0.5, 0.0, y + yOffset - 0.5);
                        verts.push(x + xOffset + 0.5, 0.0, y + yOffset + 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset - 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset + 0.5, 0.0, y + yOffset - 0.5);
                    }
                    if (this.roomData[index - SIZE] > 0) {
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset - 0.5);
                        verts.push(x + xOffset + 0.5, 0.0, y + yOffset - 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset - 0.5);
                        verts.push(x + xOffset - 0.5, 8.0, y + yOffset - 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset - 0.5);
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset - 0.5);
                    }
                    if (this.roomData[index + SIZE] > 0) {
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset + 0.5);
                        verts.push(x + xOffset + 0.5, 0.0, y + yOffset + 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset - 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset + 0.5, 8.0, y + yOffset + 0.5);
                        verts.push(x + xOffset - 0.5, 0.0, y + yOffset + 0.5);
                    }
                }
            }
        }
        return verts;
    }
    splatRooms(rooms) {
        const SIZE = this.SIZE;
        rooms.forEach(room => {
            const roomBounds = room;
            for (let x = roomBounds.min.x + SIZE / 2; x < roomBounds.max.x + SIZE / 2; x++) {
                for (let y = roomBounds.min.y + SIZE / 2; y < roomBounds.max.y + SIZE / 2; y++) {
                    const index = x + y * SIZE;
                    this.roomData[index] = 1;
                    this.metaData[index] = room.main ? 2 : 1;
                }
            }
        });
    }
    splatHalls(lineBoxes) {
        const SIZE = this.SIZE;
        lineBoxes.forEach(lineBox => {
            const lineBounds = lineBox;
            for (let x = lineBounds.min.x + SIZE / 2; x < lineBounds.max.x + SIZE / 2; x++) {
                for (let y = lineBounds.min.y + SIZE / 2; y < lineBounds.max.y + SIZE / 2; y++) {
                    const index = x + y * SIZE;
                    this.roomData[index] = 1;
                    this.metaData[index] = 3;
                }
            }
        });
    }
    findEdges(rooms, roomAmt) {
        const coords = rooms.filter(room => room.main).map(x => [x.getCenter(new THREE.Vector2()).x, x.getCenter(new THREE.Vector2()).y]).flat();
        const coordLookup = rooms.filter(room => room.main).map(x => x.getCenter(new THREE.Vector2()));
        const delaunay = new Delaunator(coords);
        const graph = new jsgraphs.WeightedGraph(Math.floor(roomAmt / 3));
        for (let i = 0; i < Math.floor(delaunay.triangles.length / 3); i++) {
            graph.addEdge(new jsgraphs.Edge(delaunay.triangles[i * 3], delaunay.triangles[i * 3 + 1], 0.0));
            graph.addEdge(new jsgraphs.Edge(delaunay.triangles[i * 3 + 1], delaunay.triangles[i * 3 + 2], 0.0));
            graph.addEdge(new jsgraphs.Edge(delaunay.triangles[i * 3 + 2], delaunay.triangles[i * 3], 0.0));
        }

        const vertices = Array.from(delaunay.triangles).map(v => coordLookup[v]);
        const triangles = [];
        for (let i = 0; i < vertices.length; i++) {
            if (triangles[Math.floor(i / 3)] === undefined) {
                triangles[Math.floor(i / 3)] = [];
            }
            triangles[Math.floor(i / 3)].push(vertices[i]);
        }
        const kruskal = new jsgraphs.KruskalMST(graph);
        var mst = kruskal.mst;
        let finalEdges = [];
        const mspv = [];
        for (var i = 0; i < mst.length; ++i) {
            var e = mst[i];
            var v = e.either();
            var w = e.other(v);
            finalEdges.push([coordLookup[v], coordLookup[w]]);
            mspv.push([v, w])
        }
        const otherEdges = [];
        for (let i = 0; i < Math.floor(delaunay.triangles.length / 3); i++) {
            otherEdges.push([delaunay.triangles[i * 3], delaunay.triangles[i * 3 + 1]]);
            otherEdges.push([delaunay.triangles[i * 3 + 1], delaunay.triangles[i * 3 + 2]]);
            otherEdges.push([delaunay.triangles[i * 3 + 2], delaunay.triangles[i * 3]]);
        }
        otherEdges.forEach(edge => {
            if (Math.random() < 0.15) {
                if (!mspv.some(([v, w]) => (v === edge[0] && w === edge[1]) || (v === edge[1] && w === edge[0]))) {
                    finalEdges.push([coordLookup[edge[0]], coordLookup[edge[1]]]);
                }
            }
        });
        finalEdges = finalEdges.map(line => {
            return [
                [new THREE.Vector2(line[0].x, line[0].y), new THREE.Vector2(line[1].x, line[0].y)],
                [new THREE.Vector2(line[1].x, line[0].y), new THREE.Vector2(line[1].x, line[1].y)]
            ]
        }).flat();
        return finalEdges;
    }
    makeRoomAlphaMap() {
        const roomData = this.roomData;
        const SIZE = this.SIZE;
        const roomTextureData = new Uint8Array(SIZE * SIZE * 4);
        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < SIZE; y++) {
                const i = x + y * SIZE;
                const index = x + (SIZE - 1 - y) * SIZE;
                roomTextureData[i * 4] = roomData[index] > 0 ? 255 : 0;
                roomTextureData[i * 4 + 1] = roomData[index] > 0 ? 255 : 0;
                roomTextureData[i * 4 + 2] = roomData[index] > 0 ? 255 : 0;
                roomTextureData[i * 4 + 3] = roomData[index] > 0 ? 255 : 0;
            }
        }
        const roomAlphaMap = new THREE.DataTexture(roomTextureData, SIZE, SIZE);
        roomAlphaMap.generateMipmaps = true;
        roomAlphaMap.magFilter = THREE.NearestFilter;
        roomAlphaMap.minFilter = THREE.LinearMipMapLinearFilter;
        roomAlphaMap.anisotropy = 16;
        roomAlphaMap.needsUpdate = true;
        return roomAlphaMap;
    }
    computeDoorsAndHoles(geometry, segments) {
        function computeSignNorm(v) {
            return Math.abs(v.x) > Math.abs(v.y) ? Math.sign(v.x) : Math.sign(v.y);
        }
        const doors = [];
        const holes = [];
        const bvh = new MeshBVH(geometry, { lazyGeneration: false, strategy: SAH });
        segments.forEach(segment => {
            const geometry = new THREE.BoxGeometry(4, 8, 0.25);
            geometry.translate(0, 0, 0.125 * computeSignNorm(segment.normal))
            const position = new THREE.Vector3((segment[0].x + segment[1].x) / 2, 4, (segment[0].y + segment[1].y) / 2);
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.5, 0.0) }));
            mesh.position.copy(position);
            mesh.position.x -= 0.5;
            mesh.position.z -= 0.5;
            if (Math.abs(segment[0].x - segment[1].x) < Math.abs(segment[0].y - segment[1].y)) {
                mesh.rotation.y = Math.PI / 2;
            }
            let holeFill = mesh.clone();
            holeFill.updateMatrix();
            holeFill.updateMatrixWorld();
            holeFill.geometry.deleteAttribute("uv");
            const door = this.door.clone();
            door.position.copy(mesh.position);
            door.position.y -= 4.01;
            door.rotation.y = mesh.rotation.y;
            if (mesh.rotation.y === 0) {
                door.position.z += 0.125 * computeSignNorm(segment.normal);
            } else if (mesh.rotation.y === Math.PI / 2) {
                door.position.x += 0.125 * computeSignNorm(segment.normal);
            }
            const midpoint = new THREE.Box3().setFromObject(mesh, true).getCenter(new THREE.Vector3());
            // Shoot rays from each end of the segment and intersect them with the bvh
            const ray1 = new THREE.Ray(midpoint.clone(), Math.abs(segment[0].x - segment[1].x) > Math.abs(segment[0].y - segment[1].y) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));
            const ray2 = new THREE.Ray(midpoint.clone(), Math.abs(segment[0].x - segment[1].x) > Math.abs(segment[0].y - segment[1].y) ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, -1));
            const intersection1 = bvh.raycastFirst(ray1, THREE.DoubleSide);
            const intersection2 = bvh.raycastFirst(ray2, THREE.DoubleSide);
            if (intersection1 && intersection2) {
                if (intersection1.point.distanceTo(intersection2.point) <= 4) {
                    doors.push(door);
                    holes.push(holeFill);
                }
            }
        });
        return {
            doors: doors,
            holes: holes
        }
    }
    addBoxesAsEntities(boxes, entityType) {
        boxes.forEach(box => {
            const entity = new entityType({
                position: box.getCenter(new THREE.Vector3()),
                bounds: box
            });
            entity.position.z = 6;
            this.add(entity);
        });
    }
    makeLineBoxes(finalEdges, rooms) {
        const lineBoxes = [];
        finalEdges.forEach(edge => {
            const lineBox = new THREE.Box2();
            lineBox.setFromPoints([new THREE.Vector2(edge[0].x, edge[0].y), new THREE.Vector2(edge[1].x, edge[1].y)]);
            lineBox.min.x -= 2;
            lineBox.min.y -= 2;
            lineBox.max.x += 2;
            lineBox.max.y += 2;
            lineBox.rooms = [];
            rooms.forEach(room => {
                if (room.intersectsBox(lineBox) && !room.main) {
                    room.side = true;
                }
            });
            lineBoxes.push(lineBox);
        });
        lineBoxes.map(lineBox => {
            lineBox.min.x = Math.floor(lineBox.min.x);
            lineBox.min.y = Math.floor(lineBox.min.y);
            lineBox.max.x = Math.ceil(lineBox.max.x);
            lineBox.max.y = Math.ceil(lineBox.max.y);
        });
        return lineBoxes;
    }
    finalizeGeometry(geometry, doorHoleFills) {
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
        const xTris = [];
        const yTris = [];
        const posAttr = geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i += 3) {
            const tri = new THREE.Triangle(
                new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)),
                new THREE.Vector3(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1)),
                new THREE.Vector3(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2))
            );
            const normal = tri.getNormal(new THREE.Vector3());
            if (Math.abs(normal.z) > Math.abs(normal.x)) {
                yTris.push(tri);
            } else {
                xTris.push(tri);
            }
        }
        const xArr = new Uint8Array(this.SIZE * this.SIZE);
        const yArr = new Uint8Array(this.SIZE * this.SIZE);
        xTris.forEach(tri => {
            const x = this.SIZE / 2 + Math.floor(tri.a.x);
            const y = this.SIZE / 2 + Math.floor((Math.min(tri.a.z, tri.b.z, tri.c.z) + Math.max(tri.a.z, tri.b.z, tri.c.z)) / 2);
            xArr[x + y * this.SIZE] = 1;
        });
        yTris.forEach(tri => {
            const x = this.SIZE / 2 + Math.floor((Math.min(tri.a.x, tri.b.x, tri.c.x) + Math.max(tri.a.x, tri.b.x, tri.c.x)) / 2);
            const y = this.SIZE / 2 + Math.floor(tri.a.z);
            yArr[x + y * this.SIZE] = 1;
        });
        const newTris = [];
        for (let y = 0; y < this.SIZE; y++) {
            let inside = false;
            let start = new THREE.Vector2();
            let end = new THREE.Vector2();
            for (let x = 0; x < this.SIZE; x++) {
                if (yArr[x + y * this.SIZE]) {
                    if (!inside) {
                        inside = true;
                        start = new THREE.Vector2(x - 0.5, y + 0.5);
                    }
                } else {
                    if (inside) {
                        inside = false;
                        end = new THREE.Vector2(x - 0.5, y + 0.5);
                        newTris.push(new THREE.Triangle(
                            new THREE.Vector3(start.x - this.SIZE / 2, 0, start.y - this.SIZE / 2),
                            new THREE.Vector3(end.x - this.SIZE / 2, 0, end.y - this.SIZE / 2),
                            new THREE.Vector3(start.x - this.SIZE / 2, 8, end.y - this.SIZE / 2)
                        ));
                        newTris.push(new THREE.Triangle(
                            new THREE.Vector3(end.x - this.SIZE / 2, 0, end.y - this.SIZE / 2),
                            new THREE.Vector3(end.x - this.SIZE / 2, 8, start.y - this.SIZE / 2),
                            new THREE.Vector3(start.x - this.SIZE / 2, 8, start.y - this.SIZE / 2),
                        ));
                    }
                }
            }
        }
        for (let x = 0; x < this.SIZE; x++) {
            let inside = false;
            let start = new THREE.Vector2();
            let end = new THREE.Vector2();
            for (let y = 0; y < this.SIZE; y++) {
                if (xArr[x + y * this.SIZE]) {
                    if (!inside) {
                        inside = true;
                        start = new THREE.Vector2(x + 0.5, y - 0.5);
                    }
                } else {
                    if (inside) {
                        inside = false;
                        end = new THREE.Vector2(x + 0.5, y - 0.5);
                        newTris.push(new THREE.Triangle(
                            new THREE.Vector3(start.x - this.SIZE / 2, 0, start.y - this.SIZE / 2),
                            new THREE.Vector3(end.x - this.SIZE / 2, 0, end.y - this.SIZE / 2),
                            new THREE.Vector3(start.x - this.SIZE / 2, 8, end.y - this.SIZE / 2)
                        ));
                        newTris.push(new THREE.Triangle(
                            new THREE.Vector3(start.x - this.SIZE / 2, 8, end.y - this.SIZE / 2),
                            new THREE.Vector3(end.x - this.SIZE / 2, 8, start.y - this.SIZE / 2),
                            new THREE.Vector3(start.x - this.SIZE / 2, 0, start.y - this.SIZE / 2),
                        ));
                    }
                }
            }
        }
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newTris.length * 3 * 3), 3));
        const posAttr2 = newGeometry.attributes.position;
        for (let i = 0; i < newTris.length; i++) {
            const tri = newTris[i];
            posAttr2.setXYZ(i * 3, tri.a.x, tri.a.y, tri.a.z);
            posAttr2.setXYZ(i * 3 + 1, tri.b.x, tri.b.y, tri.b.z);
            posAttr2.setXYZ(i * 3 + 2, tri.c.x, tri.c.y, tri.c.z);
        }
        newGeometry.computeVertexNormals();
        geometry = newGeometry;
        // const filledMesh = BufferGeometryUtils.mergeBufferGeometries([geometry.clone(), ...doorHoleFills.map(doorHoleFill => doorHoleFill.geometry.clone().applyMatrix4(doorHoleFill.matrixWorld).toNonIndexed())], true);
        /* filledMesh.scale(1, 0.5, 1);
         filledMesh.translate(0, 8, 0);*/
        geometry.scale(1, 1.5, 1);
        //geometry.translate(0, -4, 0);
        geometry = BufferGeometryUtils.mergeBufferGeometries([geometry, ...doorHoleFills.map(doorHoleFill => doorHoleFill.geometry.clone().applyMatrix4(doorHoleFill.matrixWorld).scale(1, 0.5, 1).translate(0, 8, 0).toNonIndexed())], true);
        geometry.computeVertexNormals();
        return geometry;
    }
}
export { World };