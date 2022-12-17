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
        'r': { value: 5.0 },
        'brainIcon': { value: null },
        'level': { value: 0.5 },
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
    uniform sampler2D brainIcon;
    uniform vec2 resolution;
    uniform float r;
    uniform float time;
    uniform float level;
    varying vec2 vUv;
    float sdBox( in vec2 p, in vec2 c, in vec2 b )
{
    vec2 d = abs(p - c)-b;
    return length(max(d,vec2(0))) + min(max(d.x,d.y),0.0);
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
float fbm(vec3 x) {
	float v = 0.0;
	float a = 0.5;
	vec3 shift = vec3(100);
	for (int i = 0; i < 6; ++i) {
		v += a * snoise(x);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}
float timeMult = 0.01;
float getBackNoise(vec2 coord) {
  return fbm(vec3(coord * 0.01, -time * timeMult) + fbm(vec3(coord * 0.01, time * timeMult)));
}
    void main() {
        vec3 texel = texture2D(sceneDiffuse, vUv).rgb;
        float occlusion = texture2D(tDiffuse, vUv).r;
        gl_FragColor = vec4(texel * pow(occlusion, 3.0), 1.0);
        vec2 pixelCoord = gl_FragCoord.xy;
        pixelCoord.y = resolution.y - pixelCoord.y;
        vec4 healthBox = vec4(49.0, 15.0, 349.0, 45.0);
        if (pixelCoord.x > healthBox.x && pixelCoord.x < healthBox.z && pixelCoord.y > healthBox.y && pixelCoord.y < healthBox.w) {
          float insideDist = sdBox(pixelCoord, vec2((healthBox.x + healthBox.z) / 2.0, (healthBox.y + healthBox.w) / 2.0), vec2((healthBox.z - healthBox.x) / 2.0, (healthBox.w - healthBox.y) / 2.0));
          if (insideDist > -3.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          } else {
            float noise = fbm(vec3(pixelCoord * 0.02, time * timeMult * 10.0));
            float backNoise = getBackNoise(gl_FragCoord.xy);
            float liquidHeight = (0.5 + 0.5 * backNoise);
            vec3 liquidPos = vec3(pixelCoord.x, liquidHeight, pixelCoord.y);
            vec3 liquidNorm = normalize(vec3(
              10.0 * (getBackNoise(gl_FragCoord.xy + vec2(1.0, 0.0)) - getBackNoise(gl_FragCoord.xy - vec2(1.0, 0.0))),
              1.0,
              10.0 * (getBackNoise(gl_FragCoord.xy + vec2(0.0, 1.0)) - getBackNoise(gl_FragCoord.xy - vec2(0.0, 1.0)))
            ));
            vec3 spec = vec3(1.0, 1.0, 1.0) * pow(max(dot(vec3(0.0, 1.0, 0.0), reflect(vec3(0.0, -1.0, 0.0), liquidNorm)), 0.0), 16.0);
              vec3 diffuse = vec3(0.25 + 0.25 * dot(vec3(0.0, 1.0, 0.0), liquidNorm));
              float levNoise = fbm(vec3(0.0, 0.1 * time, pixelCoord.y * 0.05 + 0.5 * time));
              if ((pixelCoord.x - healthBox.x) / (healthBox.z - healthBox.x) < clamp(level + 0.05 * levNoise, 0.0, 1.0)) {
                gl_FragColor = vec4(diffuse * vec3(0.5, 0.0, 1.0) + exp(-1000.0 * noise * noise) * vec3(1.0) + spec, 1.0);
              }
          }
        }
        float start = 7.0;
        float size = 45.0;
        if (pixelCoord.x > start && pixelCoord.y > start && pixelCoord.x < 7.0 + size && pixelCoord.y < 7.0 + size) {
          vec2 brainUv = (pixelCoord - vec2(start, start)) / size;
          vec4 brainColor = texture2D(brainIcon, brainUv);
          /*if (brainColor.a > 0.5) {
            gl_FragColor = brainColor;
          }*/
          // Alpha blend
          gl_FragColor = vec4(brainColor.rgb * brainColor.a + gl_FragColor.rgb * (1.0 - brainColor.a), 1.0);
        }
    }
    `

}
export { EffectFinish };