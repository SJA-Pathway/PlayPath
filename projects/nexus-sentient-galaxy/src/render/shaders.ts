import * as THREE from 'three';

/* Ashima Arts 3D simplex noise (MIT) + fbm helpers, shared by every procedural shader. */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*snoise(p);p=p*2.02+vec3(1.7,9.2,3.1);a*=.5;}return .5+.5*s;}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*snoise(p);p=p*2.03;a*=.5;}return .5+.5*s;}
float ridge(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*(1.-abs(snoise(p)));p*=2.1;a*=.5;}return s;}
`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main(){
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const BIOME_IDS = { lava: 0, ice: 1, ocean: 2, jungle: 3, desert: 4, gas: 5, toxic: 6 } as const;
export type Biome = keyof typeof BIOME_IDS;

export interface PlanetLook {
  biome: Biome;
  seed: number;
  colors: [number, number, number, number];
  sea: number;
  ice: number;
  city: number;
  glow: number;
  freq: number;
}

export function planetMaterial(look: PlanetLook): THREE.ShaderMaterial {
  const s = look.seed;
  return new THREE.ShaderMaterial({
    uniforms: {
      uSeed: { value: new THREE.Vector3((s % 97) * 1.31, (s % 53) * 2.17, (s % 31) * 3.07) },
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3() },
      uBiome: { value: BIOME_IDS[look.biome] },
      uC0: { value: new THREE.Color(look.colors[0]) },
      uC1: { value: new THREE.Color(look.colors[1]) },
      uC2: { value: new THREE.Color(look.colors[2]) },
      uC3: { value: new THREE.Color(look.colors[3]) },
      uGlow: { value: new THREE.Color(look.glow) },
      uSea: { value: look.sea },
      uIce: { value: look.ice },
      uCity: { value: look.city },
      uFreq: { value: look.freq },
    },
    vertexShader: SPHERE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uSeed, uSun, uC0, uC1, uC2, uC3, uGlow;
      uniform float uTime, uSea, uIce, uCity, uFreq;
      uniform int uBiome;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      ${NOISE}
      void main(){
        vec3 p = vObj * uFreq + uSeed;
        vec3 L = normalize(uSun - vW);
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        float ndl = dot(N, L);
        float day = smoothstep(-.12, .3, ndl);
        vec3 col; float water = 0.; vec3 emit = vec3(0.);
        if (uBiome == 5) {
          // gas giant: warped latitude bands that slowly flow
          float warp = fbm3(p * vec3(1., 5., 1.) + vec3(uTime * .015, 0., 0.));
          float band = vObj.y * 9. + warp * 3.5;
          col = mix(uC0, uC1, .5 + .5 * sin(band));
          col = mix(col, uC2, smoothstep(.55, .85, fbm3(p * 2.5 + warp)));
          float storm = smoothstep(.12, .0, length(vObj - normalize(vec3(.6, -.25, .7))));
          col = mix(col, uC3, storm * (.6 + .4 * sin(atan(vObj.z, vObj.x) * 12. + uTime * .6)));
        } else {
          float h = fbm(p);
          if (uBiome == 1) h = mix(h, ridge(p * 1.5) * .8, .5);
          if (h < uSea) {
            water = 1.;
            col = mix(uC0, uC1, smoothstep(uSea - .25, uSea, h));
          } else {
            float t = (h - uSea) / max(1. - uSea, .001);
            col = mix(uC2, uC3, smoothstep(.0, .9, t));
            col *= .75 + .5 * fbm3(p * 6.);
          }
          float lat = abs(vObj.y) + (h - .5) * .3;
          col = mix(col, vec3(.9, .94, 1.), smoothstep(uIce, uIce + .06, lat));
          if (uBiome == 0) {
            float c = abs(fbm(p * 1.8 + 11.) - .5);
            float crack = 1. - smoothstep(.0, .035, c);
            emit = uGlow * crack * (2.2 + .8 * sin(uTime * 1.5 + h * 20.));
          }
          if (uBiome == 6) emit = uGlow * smoothstep(.62, .8, fbm3(p * 3. + uTime * .02)) * .5;
          if (uCity > 0. && water < .5) {
            float lights = smoothstep(.72, .8, fbm3(vObj * 38. + uSeed)) * smoothstep(.45, .7, fbm3(vObj * 5. + uSeed.yzx));
            emit += vec3(1., .72, .38) * lights * (1. - day) * 1.6 * uCity;
          }
        }
        float spec = pow(max(dot(N, normalize(L + V)), 0.), 70.) * water * day;
        float rim = pow(1. - max(dot(N, V), 0.), 3.) * day;
        vec3 lit = col * (.035 + max(ndl, 0.) * 1.25) + spec * .9 + rim * col * .5 + emit;
        gl_FragColor = vec4(lit, 1.);
      }`,
  });
}

export function cloudMaterial(seed: number, cover: number, tint = 0xffffff): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSeed: { value: seed % 71 }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3() }, uCover: { value: cover }, uTint: { value: new THREE.Color(tint) } },
    vertexShader: SPHERE_VERT,
    fragmentShader: /* glsl */ `
      uniform float uSeed, uTime, uCover; uniform vec3 uSun, uTint;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      ${NOISE}
      void main(){
        vec3 p = vObj * 2.6 + uSeed + vec3(uTime * .006, 0., uTime * .004);
        float n = fbm(p + fbm3(p * 1.7) * .8);
        float a = smoothstep(1. - uCover, 1. - uCover + .25, n);
        float ndl = dot(normalize(vN), normalize(uSun - vW));
        vec3 c = uTint * (.04 + max(ndl, 0.) * 1.1);
        gl_FragColor = vec4(c, a * .9);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

export function atmosphereMaterial(color: number, strength = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSun: { value: new THREE.Vector3() }, uStrength: { value: strength } },
    vertexShader: SPHERE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uSun; uniform float uStrength;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        float f = pow(1. - abs(dot(N, V)), 2.4);
        float day = smoothstep(-.35, .45, dot(N, normalize(uSun - vW)));
        gl_FragColor = vec4(uColor * f * day * 1.6 * uStrength, f * day);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

export function starMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    vertexShader: SPHERE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      ${NOISE}
      void main(){
        vec3 p = vObj * 5.;
        float gran = fbm(p + vec3(0., uTime * .05, uTime * .03));
        float spots = smoothstep(.72, .8, fbm3(vObj * 2. + uTime * .01));
        vec3 V = normalize(cameraPosition - vW);
        float limb = pow(max(dot(normalize(vN), V), 0.), .45);
        vec3 c = uColor * (2.2 + gran * 2.6) * mix(.55, 1., limb) * (1. - spots * .6);
        gl_FragColor = vec4(c, 1.);
      }`,
  });
}

export function skyMaterial(seed: number, hueA: number, hueB: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSeed: { value: seed % 113 },
      uA: { value: new THREE.Color().setHSL(hueA, 0.7, 0.5) },
      uB: { value: new THREE.Color().setHSL(hueB, 0.6, 0.45) },
      uBand: { value: new THREE.Vector3(0.3, 1, 0.2).normalize() },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      uniform float uSeed; uniform vec3 uA, uB, uBand;
      varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float band = exp(-abs(dot(d, uBand)) * 5.);
        float n = fbm(d * 2.2 + uSeed);
        float m = fbm3(d * 4. + uSeed * 2.);
        float dust = smoothstep(.45, .7, fbm3(d * 7. - uSeed));
        vec3 neb = mix(uA, uB, m) * pow(n, 3.2) * 1.1;
        vec3 milky = vec3(.55, .6, .8) * band * .06 * (1. - dust * .8);
        gl_FragColor = vec4(neb * (.35 + band * .9) + milky, 1.);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/** Soft radial sprite texture (for coronas, engine glows, explosions). */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.22, mid);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
