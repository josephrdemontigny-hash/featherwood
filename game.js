/* Featherwood v2 - third-person forest flight. Three.js (vendored r160). */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries, mergeVertices } from './vendor/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const lerp = (a,b,t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
let seed = 1;
function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const rand = (a,b) => a + (b - a) * rnd();
const fr = (a,b) => a + (b - a) * Math.random();
function hash(i){ const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function mk(w,h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Constants ---------- */
const ZONE_M = 650, CEIL = 33, FOOT = 0.2, BOUND_X = 27;
const G = 14, GLIDE_K = 0.34, GLIDE_BASE = 0.22, FLAP_VY = 7.5;
const ZONES = [
  { name:'Oak Hollow', time:'Morning', fog:0xcbd8b4, skyT:0x9cc4cf, hemiS:0xfff1d6, hemiG:0x3a4a2c, sun:0xffe2a8, sunI:2.4, hemiI:1.5,
    leaves:[0x2c5124,0x3f6d2b,0x5c8c35,0x86ad48], trunk:0x7a5a42, bush:0x34502a, ground:0x5a5236, shaft:0xfff0c4, style:'oak' },
  { name:'Birch Grove', time:'Midday', fog:0xdbe6d2, skyT:0x8fc3e0, hemiS:0xffffff, hemiG:0x56603e, sun:0xffffff, sunI:2.6, hemiI:1.7,
    leaves:[0x587a22,0x7c9d2e,0xa6bf45,0xcfd970], trunk:0xf2ede2, bush:0x587a2c, ground:0x6d6a45, shaft:0xffffff, style:'birch' },
  { name:'Ember Maples', time:'Golden hour', fog:0xe9b07c, skyT:0xd97a4c, hemiS:0xffd4a0, hemiG:0x4a2e22, sun:0xffb070, sunI:2.6, hemiI:1.3,
    leaves:[0x8a2414,0xb8431c,0xdc6f26,0xf0a640], trunk:0x5a4840, bush:0x6a3a1c, ground:0x5e3e2a, shaft:0xffc27a, style:'maple' },
  { name:'Moonlit Redwoods', time:'Night', fog:0x22324f, skyT:0x0a1228, hemiS:0x8aa0d8, hemiG:0x10141e, sun:0xb8c8ff, sunI:1.1, hemiI:0.9,
    leaves:[0x183a30,0x22493c,0x2f5c4a,0x3f7560], trunk:0x7a3a26, bush:0x1d3a2c, ground:0x252a28, shaft:0x9fb4ff, style:'redwood', night:true },
];
ZONES.forEach(z => { for (const k of ['fog','skyT','hemiS','hemiG','sun','shaft','trunk','bush','ground']) z['c_'+k] = new THREE.Color(z[k]); z.c_leaves = z.leaves.map(h => new THREE.Color(h)); });
const ZX = [
  { sunDir:[-0.45,0.62,0.64], fogD:0.0125, bark:0xf2efe8, groundT:0xd4d2c0, fern:0x6f9a45, grass:0x8aa850, fallLeaf:0xa0782e, shaftA:0.17, sunI:3.4, hemiI:1.15 },
  { sunDir:[-0.2,0.92,0.33], fogD:0.0105, bark:0xffffff, groundT:0xe2dec4, fern:0x86ad4a, grass:0xa0bd55, fallLeaf:0xd8c050, shaftA:0.1, sunI:3.8, hemiI:1.3 },
  { sunDir:[0.5,0.3,0.8], fogD:0.0125, bark:0xe8d8cc, groundT:0xdcb494, fern:0x9a7a3a, grass:0xb09048, fallLeaf:0xe07a28, shaftA:0.22, sunI:3.3, hemiI:0.95 },
  { sunDir:[0.3,0.75,0.6], fogD:0.014, bark:0xffeee6, groundT:0xc0bab0, fern:0x5d8a70, grass:0x6a8a70, fallLeaf:0x4a5a40, shaftA:0.13, sunI:2.4, hemiI:1.5 },
];
ZONES.forEach((z, i) => { Object.assign(z, ZX[i]); for (const k of ['bark','groundT','fern','grass','fallLeaf']) z['c_'+k] = new THREE.Color(z[k]); z.c_leafI = z.c_leaves.map(c => c.clone().multiplyScalar(2.3)); z.c_fern.multiplyScalar(1.7); z.c_grass.multiplyScalar(1.6); });

const store = {
  get(k,d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let best = store.get('fw2_best', 0);
let soundOn = store.get('fw_sound', true);
const TUT = store.get('fw2_tut', {});

/* ---------- Shader chunk patches: exponential height fog ---------- */
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogY;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogY = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[3].xyz ) ).y;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n\tuniform vec3 fogColor;\n\tvarying float vFogDepth;\n\tvarying float vFogY;\n\t#ifdef FOG_EXP2\n\t\tuniform float fogDensity;\n\t#else\n\t\tuniform float fogNear;\n\t\tuniform float fogFar;\n\t#endif\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogH = exp( - max( vFogY, 0.0 ) * 0.045 );
		float fogD = fogDensity * ( 0.62 + 0.7 * fogH );
		float fogFactor = 1.0 - exp( - fogD * fogD * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 fogC = fogColor * ( 0.94 + 0.12 * clamp( vFogY / 36.0, 0.0, 1.0 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );
#endif`;

/* ---------- Renderer ---------- */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = window.devicePixelRatio || 1;
const QUALITY = { level: 2, pr: [1.25, 1.6, 2], auto: true, frames: 0, t0: 0, settle: 1 };
renderer.setPixelRatio(Math.min(QUALITY.pr[2], DPR));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 240);
scene.add(camera);
scene.fog = new THREE.FogExp2(0xcbd8b4, 0.0125);
scene.background = new THREE.Color(0xcbd8b4);
const hemi = new THREE.HemisphereLight(0xffffff, 0x334422, 1.2); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xffffff, 3); scene.add(sunL); scene.add(sunL.target);
sunL.castShadow = true; sunL.shadow.mapSize.set(1024, 1024);
{ const c = sunL.shadow.camera; c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 220; c.updateProjectionMatrix(); }
sunL.shadow.bias = -0.0008; sunL.shadow.normalBias = 0.06;
const SUN_DIR = new THREE.Vector3(-0.4, 0.75, 0.55).normalize();
const WIND = { value: 0 };

/* ---------- Textures ---------- */
function canvasTex(c, rep, srgb = true){ const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = MAX_ANISO; return t; }
const texLoader = new THREE.TextureLoader();
function loadTex(url, srgb, rep){ const t = texLoader.load(url); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = MAX_ANISO; return t; }
// height canvas -> tangent-space normal map
function normalFromHeight(src, strength){
  const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = mk(w, h), g = c.getContext('2d'), out = g.createImageData(w, h), od = out.data;
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const dx = (H(x-1, y) - H(x+1, y)) * strength, dy = (H(x, y-1) - H(x, y+1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y*w + x)*4;
    od[i] = (dx/l*0.5 + 0.5)*255; od[i+1] = (-dy/l*0.5 + 0.5)*255; od[i+2] = (1/l*0.5 + 0.5)*255; od[i+3] = 255;
  }
  g.putImageData(out, 0, 0); return c;
}
function birchCanvases(){
  const w = 256, h = 512, c = mk(w, h), g = c.getContext('2d'), hc = mk(w, h), hg = hc.getContext('2d'), r = mulberry(5);
  g.fillStyle = '#ece8df'; g.fillRect(0,0,w,h); hg.fillStyle = '#b0b0b0'; hg.fillRect(0,0,w,h);
  for (let i=0;i<900;i++){ const x = r()*w, y = r()*h, v = 200 + r()*50|0; g.fillStyle = 'rgba(' + v + ',' + (v-4) + ',' + (v-14) + ',0.35)'; g.fillRect(x, y, 4 + r()*26, 1 + r()*2); }
  for (let i=0;i<70;i++){ // horizontal lenticels
    const x = r()*w, y = r()*h, lw = 6 + r()*34, lh = 1.2 + r()*2.6;
    g.fillStyle = 'rgba(60,52,44,' + (0.55 + r()*0.4) + ')'; hg.fillStyle = '#404040';
    for (const ox of [0, -w]){ g.beginPath(); g.ellipse(x + ox, y, lw/2, lh/2, 0, 0, TAU); g.fill(); hg.beginPath(); hg.ellipse(x + ox, y, lw/2, lh/2 + 0.6, 0, 0, TAU); hg.fill(); } }
  for (let i=0;i<16;i++){ // dark fissured patches
    const x = r()*w, y = r()*h, s = 8 + r()*26;
    for (let k=0;k<26;k++){ const a = r()*TAU, d = r()*s; g.fillStyle = 'rgba(30,26,22,' + (0.3 + r()*0.5) + ')'; const px = (x + Math.cos(a)*d*1.6 + w) % w, py = y + Math.sin(a)*d*0.6;
      g.fillRect(px, py, 2 + r()*8, 1 + r()*3); hg.fillStyle = 'rgba(30,30,30,0.6)'; hg.fillRect(px, py, 2 + r()*8, 1 + r()*3); } }
  for (let i=0;i<40;i++){ g.fillStyle = 'rgba(180,170,150,0.25)'; g.fillRect(0, r()*h, w, 1); } // peeling bands
  return { col: c, nrm: normalFromHeight(hc, 2.2) };
}
function featherScaleCanvas(){ // plumage height pattern (bump)
  const c = mk(256, 256), g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0,0,256,256);
  for (let row=0; row<18; row++) for (let col=0; col<14; col++){
    const x = col*19 + (row % 2 ? 9 : 0), y = row*15;
    const gr = g.createRadialGradient(x, y + 2, 1, x, y - 6, 15); gr.addColorStop(0,'#c8c8c8'); gr.addColorStop(0.7,'#909090'); gr.addColorStop(1,'#505050');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 11, 13, 0, 0, Math.PI); g.fill();
  }
  const t = canvasTex(c, [6, 4], false); return t;
}
function featherCanvas(){ // single feather card, white vane with alpha + rachis
  const c = mk(64, 256), g = c.getContext('2d');
  g.translate(32, 0);
  const path = () => { g.beginPath(); g.moveTo(0, 2); g.bezierCurveTo(14, 20, 22, 120, 18, 200); g.quadraticCurveTo(12, 246, 0, 254); g.quadraticCurveTo(-10, 246, -14, 200); g.bezierCurveTo(-16, 120, -12, 20, 0, 2); };
  path(); const gr = g.createLinearGradient(-20, 0, 20, 0); gr.addColorStop(0,'#cfcfcf'); gr.addColorStop(0.45,'#ffffff'); gr.addColorStop(1,'#bdbdbd'); g.fillStyle = gr; g.fill();
  g.save(); path(); g.clip(); g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1;
  for (let y=10; y<256; y+=3.2){ g.beginPath(); g.moveTo(0, y); g.lineTo(24, y + 9); g.moveTo(0, y); g.lineTo(-24, y + 9); g.stroke(); }
  const eg = g.createLinearGradient(0, 160, 0, 256); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = eg; g.fillRect(-32, 160, 64, 96);
  g.restore();
  g.strokeStyle = 'rgba(245,240,230,0.9)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 2); g.lineTo(-1, 250); g.stroke();
  return canvasTex(c);
}
// Leaf atlas, 2x2: oak, birch, maple, redwood sprays. Drawn near-white, tinted per instance.
function leafShape(g, kind, len){
  g.beginPath();
  if (kind === 'oak'){ const n = 5; g.moveTo(0, 0);
    for (let i=0;i<=n;i++){ const t = i/n, y = -len*(0.12 + t*0.88), w = len*0.34*Math.sin(Math.PI*Math.min(1, t*1.05 + 0.05)); g.quadraticCurveTo(w*1.25, y + len*0.08, w*0.55, y); }
    for (let i=n;i>=0;i--){ const t = i/n, y = -len*(0.12 + t*0.88), w = len*0.34*Math.sin(Math.PI*Math.min(1, t*1.05 + 0.05)); g.quadraticCurveTo(-w*1.25, y + len*0.08, -w*0.55, y); }
  } else if (kind === 'birch'){ g.moveTo(0, 0); g.bezierCurveTo(len*0.42, -len*0.25, len*0.3, -len*0.75, 0, -len); g.bezierCurveTo(-len*0.3, -len*0.75, -len*0.42, -len*0.25, 0, 0); }
  else if (kind === 'maple'){ const R = len*0.55, pts = []; for (let i=0;i<=40;i++){ const a = -Math.PI/2 + (i/40 - 0.5)*Math.PI*1.75; const lobe = Math.pow(Math.abs(Math.cos((i/40 - 0.5)*Math.PI*2.5)), 3);
      const rr = R*(0.42 + 0.58*lobe) * (1 + 0.06*Math.sin(i*2.7)); pts.push([Math.cos(a)*rr, -len*0.42 + Math.sin(a)*rr]); }
    g.moveTo(0, 0); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); }
  else { g.moveTo(-len*0.05, 0); g.lineTo(-len*0.06, -len*0.9); g.lineTo(0, -len); g.lineTo(len*0.06, -len*0.9); g.lineTo(len*0.05, 0); g.closePath(); }
}
function leafAtlasCanvas(){
  const S = 512, c = mk(S*2, S*2), g = c.getContext('2d'), r = mulberry(21);
  const kinds = ['oak', 'birch', 'maple', 'needle'];
  kinds.forEach((kind, ci) => {
    const ox = (ci % 2) * S, oy = Math.floor(ci / 2) * S;
    g.save(); g.beginPath(); g.rect(ox, oy, S, S); g.clip();
    const cx = ox + S/2, cy = oy + S/2;
    if (kind === 'needle'){
      for (let s=0;s<7;s++){ // flat redwood sprays
        const a = -Math.PI/2 + (s - 3) * 0.42 + (r()-0.5)*0.2, L = S*(0.36 + r()*0.12);
        const bx = cx + (r()-0.5)*S*0.2, by = oy + S*0.95; g.strokeStyle = '#8a7a62'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); const ex = bx + Math.cos(a)*L*1.4, ey = by + Math.sin(a)*L*1.4; g.lineTo(ex, ey); g.stroke();
        for (let k=0;k<44;k++){ const t = 0.1 + k/44*0.9, px = bx + (ex - bx)*t, py = by + (ey - by)*t, nl = S*0.055*(1 - t*0.5);
          for (const sd of [-1, 1]){ const na = a + sd*1.15; const v = 200 + r()*55|0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v-8) + ')';
            g.save(); g.translate(px, py); g.rotate(na + Math.PI/2); leafShape(g, 'needle', nl); g.fill(); g.restore(); } }
      }
    } else {
      const twigs = kind === 'birch' ? 5 : 4;
      for (let tw=0; tw<twigs; tw++){
        const a = -Math.PI/2 + (tw - (twigs-1)/2) * 0.55 + (r()-0.5)*0.3, L = S*(0.32 + r()*0.14);
        const bx = cx + (r()-0.5)*40, by = oy + S*0.97, ex = bx + Math.cos(a)*L, ey = by + Math.sin(a)*L;
        g.strokeStyle = '#7d6c58'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(a)*L*0.5 + 10, by + Math.sin(a)*L*0.5, ex, ey); g.stroke();
        const nLeaves = kind === 'birch' ? 9 : kind === 'oak' ? 6 : 4;
        for (let k=0;k<nLeaves;k++){
          const t = 0.35 + 0.65*(k/(nLeaves-1||1)), px = bx + (ex - bx)*t, py = by + (ey - by)*t;
          const side = k % 2 ? 1 : -1, la = a + side*(kind === 'birch' ? 0.9 : 0.7) + (r()-0.5)*0.5 + (k === nLeaves-1 ? -side*0.7 : 0);
          const len = S*(kind === 'maple' ? 0.2 : kind === 'oak' ? 0.19 : 0.1)*(0.75 + r()*0.4);
          g.save(); g.translate(px, py); g.rotate(la + Math.PI/2);
          const v = 190 + r()*60|0, w = (r()-0.5)*14;
          const grd = g.createLinearGradient(-len*0.4, 0, len*0.4, -len); grd.addColorStop(0, 'rgb(' + (v-30) + ',' + (v-22) + ',' + (v-36+w) + ')'); grd.addColorStop(1, 'rgb(' + Math.min(255, v+12) + ',' + Math.min(255, v+16) + ',' + (v+w) + ')');
          g.fillStyle = grd; leafShape(g, kind, len); g.fill();
          g.strokeStyle = 'rgba(70,60,40,0.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len*0.92);
          const nv = kind === 'maple' ? 0 : 5; for (let q=1;q<=nv;q++){ const yy = -len*q/(nv+1); g.moveTo(0, yy); g.lineTo(len*0.22, yy - len*0.1); g.moveTo(0, yy); g.lineTo(-len*0.22, yy - len*0.1); }
          if (kind === 'maple'){ for (const aa of [-1.1, -0.5, 0.5, 1.1]){ g.moveTo(0, -len*0.4); g.lineTo(Math.sin(aa)*len*0.45, -len*0.4 - Math.cos(aa)*len*0.45); } }
          g.stroke(); g.restore();
        }
      }
    }
    g.restore();
  });
  const t = canvasTex(c); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
function singleLeafCanvas(){ const c = mk(64, 64), g = c.getContext('2d'); g.translate(32, 60); g.fillStyle = '#e8e8e0'; leafShape(g, 'maple', 56); g.fill();
  g.strokeStyle = 'rgba(60,50,30,0.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -50); g.stroke(); return canvasTex(c); }
function fernCanvas(){ const c = mk(128, 512), g = c.getContext('2d'), r = mulberry(31);
  g.strokeStyle = '#a89a78'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 8); g.stroke();
  for (let y=500; y>12; y-=9){ const t = 1 - y/512, L = 58*Math.sin(Math.PI*Math.min(1, (1 - t)*1.1))*(0.85 + r()*0.2);
    for (const sd of [-1, 1]){ const v = 200 + r()*50|0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 20) + ')';
      g.save(); g.translate(64, y); g.rotate(sd*(1.25 - t*0.3)); g.beginPath(); g.moveTo(0, 0);
      for (let k=0;k<=6;k++){ const u = k/6; g.lineTo(L*0.13*(1 - u)*(k % 2 ? 1.2 : 0.8), -L*u); } for (let k=6;k>=0;k--){ const u = k/6; g.lineTo(-L*0.13*(1 - u)*(k % 2 ? 1.2 : 0.8), -L*u); }
      g.fill(); g.restore(); } }
  return canvasTex(c); }
function grassCanvas(){ const c = mk(256, 128), g = c.getContext('2d'), r = mulberry(41);
  for (let i=0;i<70;i++){ const x = r()*256, h = 50 + r()*76, bend = (r()-0.5)*40, w = 2 + r()*3, v = 170 + r()*80|0;
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 30) + ')'; g.beginPath(); g.moveTo(x - w, 128); g.quadraticCurveTo(x + bend*0.3, 128 - h*0.6, x + bend, 128 - h); g.quadraticCurveTo(x + bend*0.3 + w*0.5, 128 - h*0.6, x + w, 128); g.fill(); }
  return canvasTex(c); }
function rockCanvas(){ const c = mk(256, 256), g = c.getContext('2d'), r = mulberry(51);
  g.fillStyle = '#8a877f'; g.fillRect(0,0,256,256);
  for (let i=0;i<2500;i++){ const v = 90 + r()*90|0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v-6) + ',0.3)'; g.fillRect(r()*256, r()*256, 1 + r()*5, 1 + r()*5); }
  for (let i=0;i<60;i++){ g.fillStyle = 'rgba(' + (150 + r()*60|0) + ',' + (160 + r()*50|0) + ',110,0.35)'; g.beginPath(); g.arc(r()*256, r()*256, 2 + r()*9, 0, TAU); g.fill(); }
  return canvasTex(c, [1, 1]); }
function glowTexture(){
  const c = mk(128,128), g = c.getContext('2d'); const gr = g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.22,'rgba(255,255,255,0.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
function shaftTexture(){
  const c = mk(64, 256), g = c.getContext('2d');
  const gx = g.createLinearGradient(0,0,64,0); gx.addColorStop(0,'rgba(255,255,255,0)'); gx.addColorStop(0.3,'rgba(255,255,255,0.6)'); gx.addColorStop(0.5,'rgba(255,255,255,1)'); gx.addColorStop(0.7,'rgba(255,255,255,0.6)'); gx.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0,0,64,256); g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0,0,0,256); gy.addColorStop(0,'rgba(0,0,0,0.1)'); gy.addColorStop(0.25,'rgba(0,0,0,0.85)'); gy.addColorStop(0.7,'rgba(0,0,0,0.5)'); gy.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0,0,64,256); return new THREE.CanvasTexture(c);
}
function draftTexture(){
  const c = mk(64, 256), g = c.getContext('2d'); g.clearRect(0,0,64,256);
  const r = mulberry(11); g.lineCap = 'round';
  for (let i=0;i<46;i++){ const x = r()*64, y = r()*256, l = 10 + r()*26; const gr = g.createLinearGradient(x, y, x + 3, y + l); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(0.5,'rgba(255,255,255,' + (0.35 + r()*0.5).toFixed(2) + ')'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = 1.5 + r()*2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
}
const BIRCH = birchCanvases();
const TEX = {
  oak: loadTex('tex/oak_col.jpg', true), oakN: loadTex('tex/oak_nrm.jpg', false),
  maple: loadTex('tex/maple_col.jpg', true), mapleN: loadTex('tex/maple_nrm.jpg', false),
  redwood: loadTex('tex/redwood_col.jpg', true), redwoodN: loadTex('tex/redwood_nrm.jpg', false),
  birch: canvasTex(BIRCH.col, [1, 1]), birchN: canvasTex(BIRCH.nrm, [1, 1], false),
  ground: loadTex('tex/ground_col.jpg', true, [105, 105]), groundN: loadTex('tex/ground_nrm.jpg', false, [105, 105]),
  glow: glowTexture(), shaft: shaftTexture(), leafAtlas: leafAtlasCanvas(), leaf: singleLeafCanvas(), fern: fernCanvas(), grass: grassCanvas(), rock: rockCanvas(),
  draft: draftTexture(), feather: featherCanvas(), plumage: featherScaleCanvas(),
};

/* ---------- Geometry helpers ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0,1,0);
function mergeColored(parts){ // geometry + colour + matrix -> one vertex-coloured geometry (keeps smooth normals)
  const pos = [], nor = [], col = [];
  for (const [geom, hex, mat] of parts){
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (mat) g.applyMatrix4(mat);
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = new THREE.Color(hex), p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i=0;i<p.length;i++){ pos.push(p[i]); nor.push(n[i]); }
    for (let i=0;i<p.length/3;i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const M = (x=0,y=0,z=0, rx=0,ry=0,rz=0, sx=1,sy=1,sz=1) => new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)), new THREE.Vector3(sx,sy,sz));
function jitterGeo(g, amt, sd){
  g = g.index ? g.toNonIndexed() : g; const r = mulberry(sd), p = g.attributes.position; const map = new Map();
  for (let i=0;i<p.count;i++){ const k = p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3); let o = map.get(k); if (!o){ o = [ (r()-0.5)*amt, (r()-0.5)*amt, (r()-0.5)*amt ]; map.set(k,o); } p.setXYZ(i, p.getX(i)+o[0], p.getY(i)+o[1], p.getZ(i)+o[2]); }
  g.computeVertexNormals(); return g;
}
function smoothRock(sd){ let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, r = mulberry(sd), ph = [r()*6, r()*6, r()*6];
  for (let i=0;i<p.count;i++){ _v.fromBufferAttribute(p, i); const n = 1 + 0.16*Math.sin(_v.x*3.1 + ph[0])*Math.sin(_v.y*2.7 + ph[1]) + 0.08*Math.sin(_v.z*6.3 + ph[2]) + 0.04*Math.sin(_v.x*11 + _v.z*9);
    _v.multiplyScalar(n); _v.y = _v.y < 0 ? _v.y*0.3 : _v.y*0.72; p.setXYZ(i, _v.x, _v.y, _v.z); }
  g.computeVertexNormals();
  const uv = [], col = []; for (let i=0;i<p.count;i++){ _v.fromBufferAttribute(p, i); uv.push(_v.x*0.5 + _v.z*0.3, _v.y*0.5 + _v.z*0.4);
    const ny = g.attributes.normal.getY(i), moss = smooth(clamp((ny - 0.55)/0.35, 0, 1)); _c.setRGB(1, 1, 1).lerp(new THREE.Color(0.42, 0.55, 0.26), moss*0.85); col.push(_c.r, _c.g, _c.b); }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
// tapered trunk with root flare and buttress lobes; unit radius at base, height 1
function trunkGeometry(uRep, vRep, flare, lobes, seg = 14){
  const ys = [0, 0.006, 0.014, 0.026, 0.045, 0.075, 0.12, 0.19, 0.28, 0.4, 0.55, 0.72, 0.88, 1];
  const pos = [], uv = [], idx = [];
  for (let j=0;j<ys.length;j++){ const y = ys[j], f = Math.exp(-y*75);
    for (let i=0;i<=seg;i++){ const a = i/seg*TAU; const lobe = 0.6 + 0.4*Math.cos(lobes*a + 0.7) * Math.cos(a*2 + 1.3);
      const rr = lerp(1, 0.8, y) * (1 + flare*f*lobe) * (1 + 0.025*Math.sin(a*5 + y*30));
      pos.push(Math.sin(a)*rr, y, Math.cos(a)*rr); uv.push(i/seg*uRep, y*vRep); } }
  for (let j=0;j<ys.length-1;j++) for (let i=0;i<seg;i++){ const a = j*(seg+1) + i, b = a + seg + 1; idx.push(a, b, a+1, b, b+1, a+1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // weld seam normals
  const n = g.attributes.normal; for (let j=0;j<ys.length;j++){ const a = j*(seg+1), b = a + seg; _v.fromBufferAttribute(n, a).add(_v2.fromBufferAttribute(n, b)).normalize(); n.setXYZ(a, _v.x, _v.y, _v.z); n.setXYZ(b, _v.x, _v.y, _v.z); }
  return g;
}
// curved tapered tube along a polyline
function tube(pts, r0, r1, seg, uRep, vRep){
  const pos = [], uv = [], idx = []; const n = pts.length; let acc = 0;
  for (let j=0;j<n;j++){ const p = pts[j], q = pts[Math.min(n-1, j+1)], o = pts[Math.max(0, j-1)];
    const t = _v.set(q[0]-o[0], q[1]-o[1], q[2]-o[2]).normalize(); const ax = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const b1 = new THREE.Vector3().crossVectors(t, ax).normalize(), b2 = new THREE.Vector3().crossVectors(t, b1).normalize();
    if (j > 0) acc += Math.hypot(p[0]-o[0], p[1]-o[1], p[2]-o[2]);
    const r = lerp(r0, r1, j/(n-1));
    for (let i=0;i<=seg;i++){ const a = i/seg*TAU; pos.push(p[0] + (b1.x*Math.cos(a) + b2.x*Math.sin(a))*r, p[1] + (b1.y*Math.cos(a) + b2.y*Math.sin(a))*r, p[2] + (b1.z*Math.cos(a) + b2.z*Math.sin(a))*r); uv.push(i/seg*uRep, acc*vRep); } }
  for (let j=0;j<n-1;j++) for (let i=0;i<seg;i++){ const a = j*(seg+1) + i, b = a + seg + 1; idx.push(a, b, a+1, b, b+1, a+1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g.toNonIndexed();
}
// limb along +Y (0..1) with two forking twigs; radius in absolute metres (instance scales y only)
function limbGeometry(vRep){
  const main = tube([[0,0,0],[0.02,0.3,0],[0.01,0.62,0],[-0.03,1.0,0]], 0.2, 0.055, 7, 1, vRep);
  const tw1 = tube([[0.01,0.5,0],[0.12,0.68,0.05],[0.2,0.86,0.12]], 0.06, 0.015, 5, 1, vRep*2);
  const tw2 = tube([[0,0.74,0],[-0.1,0.88,-0.06],[-0.16,1.02,-0.12]], 0.045, 0.012, 5, 1, vRep*2);
  const tw3 = tube([[-0.02,0.9,0],[0.05,1.02,0.09],[0.08,1.12,0.14]], 0.035, 0.01, 4, 1, vRep*2);
  return mergeGeometries([main, tw1, tw2, tw3]);
}
// foliage cluster: alpha cards scattered in a unit ellipsoid with spherical normals, UV into atlas cell
function clusterGeometry(cell, cards, sd, cardSize, droop){
  const r = mulberry(sd), pos = [], nor = [], uv = [];
  const u0 = (cell % 2) * 0.5, v0 = 0.5 - Math.floor(cell / 2) * 0.5;
  for (let i=0;i<cards;i++){
    const th = r()*TAU, ph = Math.acos(r()*2 - 1), rad = 0.35 + 0.65*Math.sqrt(r());
    const c = new THREE.Vector3(Math.sin(ph)*Math.cos(th)*rad, Math.cos(ph)*rad*0.8, Math.sin(ph)*Math.sin(th)*rad);
    const out = c.clone().normalize(); const s = cardSize*(0.75 + r()*0.5);
    // card orientation: facing outward-ish, random spin
    const nrm = out.clone().multiplyScalar(0.7).add(new THREE.Vector3(r()-0.5, r()-0.5 + droop, r()-0.5)).normalize();
    const t1 = new THREE.Vector3().crossVectors(nrm, Math.abs(nrm.y) > 0.9 ? new THREE.Vector3(1,0,0) : UP).normalize();
    const t2 = new THREE.Vector3().crossVectors(nrm, t1).normalize(); const sp = r()*TAU; const a1 = t1.clone().multiplyScalar(Math.cos(sp)).addScaledVector(t2, Math.sin(sp)), a2 = new THREE.Vector3().crossVectors(nrm, a1);
    const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => c.clone().addScaledVector(a1, x*s*0.5).addScaledVector(a2, y*s*0.5));
    const flip = r() < 0.5; const uvs = [[0,0],[1,0],[1,1],[0,1]].map(([x,y]) => [u0 + (flip ? 1 - x : x)*0.5, v0 + y*0.5]);
    const sn = c.clone().normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.35, 0)).normalize();
    for (const k of [0,1,2, 0,2,3]){ const p = corners[k]; pos.push(p.x, p.y, p.z); nor.push(sn.x, sn.y, sn.z); uv.push(uvs[k][0], uvs[k][1]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
// redwood tier: drooping spray cards radiating from a vertical axis (unit radius)
function frondTierGeometry(sd){
  const r = mulberry(sd), pos = [], nor = [], uv = []; const u0 = 0.5, v0 = 0;
  for (let i=0;i<14;i++){ const a = i/14*TAU + r()*0.3, L = 0.8 + r()*0.3, w = 0.42, droop = 0.35 + r()*0.25;
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const base = new THREE.Vector3(0, 0.1*r(), 0), tip = dir.clone().multiplyScalar(L).add(new THREE.Vector3(0, -droop, 0));
    const corners = [base.clone().addScaledVector(side, -w*0.25), base.clone().addScaledVector(side, w*0.25), tip.clone().addScaledVector(side, w*0.6), tip.clone().addScaledVector(side, -w*0.6)];
    const uvs = [[u0 + 0.1, v0], [u0 + 0.4, v0], [u0 + 0.5, v0 + 0.5], [u0, v0 + 0.5]];
    const sn = dir.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.85, 0)).normalize();
    for (const k of [0,1,2, 0,2,3]){ const p = corners[k]; pos.push(p.x, p.y, p.z); nor.push(sn.x, sn.y, sn.z); uv.push(uvs[k][0], uvs[k][1]); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
function fernGeometry(){
  const pos = [], nor = [], uv = [];
  for (let f=0; f<7; f++){ const a = f/7*TAU + 0.3, L = 0.85 + (f%3)*0.12, rise = 0.5 + (f%2)*0.15; const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const P = k => { const t = k/6; return dir.clone().multiplyScalar(L*t).add(new THREE.Vector3(0, Math.sin(t*Math.PI*0.8)*rise - t*t*0.15, 0)); };
    for (let k=0;k<6;k++){ const p0 = P(k), p1 = P(k+1), w0 = 0.2*Math.sin(Math.PI*Math.min(1, k/6*1.05 + 0.08)), w1 = 0.2*Math.sin(Math.PI*Math.min(1, (k+1)/6*1.05 + 0.08));
      const c = [p0.clone().addScaledVector(side, -w0), p0.clone().addScaledVector(side, w0), p1.clone().addScaledVector(side, w1), p1.clone().addScaledVector(side, -w1)];
      const uvs = [[0, k/6], [1, k/6], [1, (k+1)/6], [0, (k+1)/6]];
      for (const q of [0,1,2, 0,2,3]){ pos.push(c[q].x, c[q].y, c[q].z); nor.push(0, 1, 0); uv.push(uvs[q][0], uvs[q][1]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
function grassGeometry(){ const parts = []; for (let i=0;i<3;i++){ const p = new THREE.PlaneGeometry(1.2, 0.55, 1, 1); p.translate(0, 0.27, 0); p.rotateY(i*Math.PI/3); parts.push(p); }
  const g = mergeGeometries(parts); const n = g.attributes.normal; for (let i=0;i<n.count;i++) n.setXYZ(i, 0, 1, 0); return g; }

/* ---------- Materials ---------- */
function windify(mat, amp, key){
  mat.onBeforeCompile = sh => { sh.uniforms.uTime = WIND;
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '').replace('normal = normal * faceDirection;', ''));
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ipos = vec3(0.0);
      #endif
      float wph = uTime * 1.7 + ipos.x * 0.23 + ipos.z * 0.19;
      float wv = sin(wph) * 0.6 + sin(wph * 2.7 + position.y * 3.0 + position.x * 2.0) * 0.4;
      float wk = ${amp.toFixed(3)} * (0.35 + max(position.y, 0.0) * 0.8);
      transformed.x += wv * wk; transformed.z += cos(wph * 0.8 + position.z * 2.0) * wk * 0.6; transformed.y += sin(wph * 1.9 + position.x * 4.0) * wk * 0.25;`); };
  mat.customProgramCacheKey = () => key;
  return mat;
}
function mossify(mat, key){ // moss + ambient darkening near the ground
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 mwp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mwp = instanceMatrix * mwp;
      #endif
      vWY = (modelMatrix * mwp).y;`);
    sh.fragmentShader = 'varying float vWY;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float mossK = (1.0 - smoothstep(0.2, 3.2, vWY)) * smoothstep(0.25, 0.55, diffuseColor.g - diffuseColor.b * 0.6 + 0.3);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.86, 0.42), mossK * 0.75);
      diffuseColor.rgb *= 0.55 + 0.45 * smoothstep(0.0, 1.6, vWY);`); };
  mat.customProgramCacheKey = () => key; return mat;
}
const barkMat = (map, nmap, ns, rough) => mossify(new THREE.MeshStandardMaterial({ map, normalMap: nmap, normalScale: new THREE.Vector2(ns, ns), roughness: rough, metalness: 0 }), 'moss');
const leafMat = (amp, key) => windify(new THREE.MeshLambertMaterial({ map: TEX.leafAtlas, alphaTest: 0.42, side: THREE.DoubleSide, alphaToCoverage: true }), amp, key);
const MAT = {
  oak: barkMat(TEX.oak, TEX.oakN, 1.3, 0.95), birch: barkMat(TEX.birch, TEX.birchN, 0.9, 0.8), maple: barkMat(TEX.maple, TEX.mapleN, 1.2, 0.92), redwood: barkMat(TEX.redwood, TEX.redwoodN, 1.4, 0.95),
  leafHi: leafMat(0.05, 'windHi'), leafLo: leafMat(0.09, 'windLo'), frond: leafMat(0.04, 'windFr'),
  fern: windify(new THREE.MeshLambertMaterial({ map: TEX.fern, alphaTest: 0.45, side: THREE.DoubleSide, alphaToCoverage: true }), 0.05, 'windFern'),
  grass: windify(new THREE.MeshLambertMaterial({ map: TEX.grass, alphaTest: 0.45, side: THREE.DoubleSide, alphaToCoverage: true }), 0.07, 'windGrass'),
  rock: new THREE.MeshStandardMaterial({ map: TEX.rock, vertexColors: true, roughness: 0.92, normalMap: TEX.groundN, normalScale: new THREE.Vector2(0.6, 0.6) }),
  bush: windify(new THREE.MeshLambertMaterial({ map: TEX.leafAtlas, alphaTest: 0.42, side: THREE.DoubleSide, alphaToCoverage: true }), 0.06, 'windBush'),
  thorn: new THREE.MeshStandardMaterial({ color: 0xd9ccb4, roughness: 0.6 }),
  berry: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0, emissive: 0x1a0000 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  dot: new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
  ground: new THREE.MeshStandardMaterial({ map: TEX.ground, normalMap: TEX.groundN, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0, color: 0xffffff }),
  shaft: new THREE.MeshBasicMaterial({ map: TEX.shaft, color: 0xfff0c4, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  up: new THREE.MeshBasicMaterial({ map: TEX.draft, color: 0xfff2c8, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  down: new THREE.MeshBasicMaterial({ map: TEX.draft.clone(), color: 0x8fa0b8, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
};
MAT.down.map.wrapS = MAT.down.map.wrapT = THREE.RepeatWrapping; MAT.down.map.repeat.set(6, 3); MAT.down.map.needsUpdate = true;
// ground: break up texture tiling with a large-scale variation sample
MAT.ground.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  vec3 macro = texture2D(map, vMapUv * 0.071 + vec2(0.37, 0.11)).rgb; vec3 macro2 = texture2D(map, vMapUv * 0.013 + vec2(0.7, 0.2)).rgb;
  diffuseColor.rgb *= (0.62 + 0.8 * dot(macro, vec3(0.33))) * (0.7 + 0.6 * dot(macro2, vec3(0.33)));`); };
MAT.ground.customProgramCacheKey = () => 'groundMacro';

function inst(geo, mat, cap, cast, recv){ const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = !!cast; m.receiveShadow = !!recv; scene.add(m); return m; }
const SPECIES = ['oak', 'birch', 'maple', 'redwood'];
const trunkGeos = { oak: trunkGeometry(2, 15, 0.75, 5), birch: trunkGeometry(1, 9, 0.35, 3), maple: trunkGeometry(2, 14, 0.6, 4), redwood: trunkGeometry(3, 11, 1.1, 6, 18) };
const limbGeo = limbGeometry(1.2);
const clusterGeos = [0,1,2].map(c => clusterGeometry(c, c === 1 ? 30 : 26, 101 + c, c === 1 ? 0.75 : 0.85, 0.1));
const bushGeo = clusterGeometry(0, 22, 77, 0.9, 0.3);
const frondGeo = frondTierGeometry(9);
const thornGeo = new THREE.ConeGeometry(0.035, 0.24, 5);
const SPH = (w=18,h=12) => new THREE.SphereGeometry(1, w, h);
const berryGeo = mergeColored([
  [new THREE.SphereGeometry(0.1, 12, 9), 0xffffff, M(-0.07, 0, 0)], [new THREE.SphereGeometry(0.095, 12, 9), 0xffffff, M(0.07, -0.02, 0.02)],
  [new THREE.SphereGeometry(0.09, 12, 9), 0xffffff, M(0, -0.12, 0)], [new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), 0x4a6a30, M(0, 0.12, 0)],
  [new THREE.SphereGeometry(0.06, 6, 4), 0x5c8a38, M(0.05, 0.2, 0, 0, 0, 0.6, 1.4, 0.4, 0.8)] ]);
const IM = { ring: inst(new THREE.RingGeometry(0.42, 0.6, 28).rotateX(-Math.PI/2), MAT.ring, 20), dot: inst(new THREE.SphereGeometry(0.07, 6, 4), MAT.dot, 30),
  thorn: inst(thornGeo, MAT.thorn, 500, true, false), berry: inst(berryGeo, MAT.berry, 260, true, false) };
for (const sp of SPECIES){ IM['trunk_' + sp] = inst(trunkGeos[sp], MAT[sp], sp === 'redwood' ? 160 : 200, true, true); IM['limb_' + sp] = inst(limbGeo, MAT[sp], 700, true, true); }
IM.leaf_oak = inst(clusterGeos[0], MAT.leafHi, 2600, true, true); IM.leaf_birch = inst(clusterGeos[1], MAT.leafHi, 2600, true, true); IM.leaf_maple = inst(clusterGeos[2], MAT.leafHi, 2600, true, true);
IM.frond = inst(frondGeo, MAT.frond, 2200, true, true);
IM.bush = inst(bushGeo, MAT.bush, 260, false, true);
IM.fern = inst(fernGeometry(), MAT.fern, 500, false, true);
IM.grass = inst(grassGeometry(), MAT.grass, 700, false, true);
IM.rock = inst(smoothRock(3), MAT.rock, 160, true, true);
IM.log = inst((() => { const g = tube([[-0.5,0,0],[-0.15,0.02,0],[0.2,0,0],[0.5,-0.01,0]], 1, 0.9, 12, 2, 1.2); return g; })(), MAT.oak, 40, true, true);
IM.ring.renderOrder = 3; IM.dot.renderOrder = 3;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI/2), MAT.ground); ground.receiveShadow = true; scene.add(ground);
const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
targetRing.renderOrder = 4; targetRing.visible = false; scene.add(targetRing);

/* sky dome: gradient + sun glow + stars, output directly in display space to match fog */
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uNight: { value: 0 }, uTime: WIND };
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 uTop, uHor, uSun, uSunDir; uniform float uNight; varying vec3 vDir;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 col = mix(uHor, uTop, pow(h, 0.5));
      float s = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSun * (pow(s, 6.0) * 0.28 + pow(s, 60.0) * 0.5 + smoothstep(0.9985, 0.9995, s) * (1.0 - uNight * 0.2));
      if (uNight > 0.01){ vec2 g = vec2(atan(d.z, d.x) * 120.0, d.y * 160.0); vec2 cell = floor(g); float st = h21(cell); float tw = step(0.985, st) * smoothstep(0.5, 0.0, length(fract(g) - 0.5)) * smoothstep(0.05, 0.3, d.y);
        col += vec3(0.85, 0.9, 1.0) * tw * uNight; }
      col = mix(uHor, col, smoothstep(-0.02, 0.22, d.y));
      gl_FragColor = vec4(col, 1.0); }` }));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xfff0c8, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false, transparent: true, opacity: 0.6, toneMapped: false }));
sunSprite.scale.set(60, 60, 1); sunSprite.renderOrder = -9; scene.add(sunSprite);
const moon = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false, transparent: true, opacity: 0, toneMapped: false }));
moon.renderOrder = -8; scene.add(moon);

/* ---------- Bird: American robin ---------- */
const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
const wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
function wingGeo(span, chord, inner, outer){ // simple membrane wing, used by owl and hawk
  const s = new THREE.Shape(); const S = span, C = chord;
  const pts = [[0,0.25],[0.32,0.42],[0.68,0.32],[1,0],[0.93,-0.32],[0.85,-0.18],[0.79,-0.58],[0.69,-0.42],[0.62,-0.78],[0.5,-0.6],[0.43,-0.92],[0.22,-0.98],[0,-0.82]];
  s.moveTo(pts[0][0]*S, pts[0][1]*C); for (let i=1;i<pts.length;i++) s.lineTo(pts[i][0]*S, pts[i][1]*C);
  const g = new THREE.ShapeGeometry(s); g.rotateX(Math.PI/2);
  const p = g.attributes.position, cols = []; const ci = new THREE.Color(inner), co = new THREE.Color(outer);
  for (let i=0;i<p.count;i++){ const t = clamp(p.getX(i)/S, 0, 1); _c.copy(ci).lerp(co, smooth(t)); cols.push(_c.r, _c.g, _c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
function makeWings(parent, geo, mat, sx, sy, sz){
  const res = [];
  for (const side of [1, -1]){
    const holder = new THREE.Group(); holder.position.set(sx*side, sy, sz); holder.scale.x = side; parent.add(holder);
    const pivot = new THREE.Group(); pivot.rotation.order = 'YZX'; holder.add(pivot);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; pivot.add(m); res.push(pivot);
  }
  return res;
}
const plumageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, bumpMap: TEX.plumage, bumpScale: 0.25 });
const featherMatB = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.feather, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.75, alphaToCoverage: true });
const eyeMatB = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.12, metalness: 0 });
const beakMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
const BIRD_MATS = [plumageMat, featherMatB, beakMat];
function vcolor(g, fn){ const p = g.attributes.position, n = g.attributes.normal, col = []; for (let i=0;i<p.count;i++){ fn(_v.fromBufferAttribute(p, i), _v2.fromBufferAttribute(n, i), _c); col.push(_c.r, _c.g, _c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; }
const C_BACK = new THREE.Color(0x6e6458), C_BREAST = new THREE.Color(0xcc5d28), C_BREAST2 = new THREE.Color(0xe27a36), C_BELLY = new THREE.Color(0xeee8dc), C_HEAD = new THREE.Color(0x302b27), C_RING = new THREE.Color(0xf2efe8);
function bodyGeometry(){
  const g = new THREE.SphereGeometry(1, 36, 24); const p = g.attributes.position;
  for (let i=0;i<p.count;i++){ let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = z < 0 ? 1 + 0.42*z : 1 + 0.08*z; x *= taper; y *= z < 0 ? (1 + 0.36*z) : 1;
    if (y < 0 && z > -0.2) y *= 1.12; // fuller breast
    p.setXYZ(i, x*0.105, y*0.11 + (z < 0 ? -z*0.025 : 0), z*0.2); }
  g.computeVertexNormals();
  const r = mulberry(61);
  return vcolor(g, (v, n, c) => { const ny = v.y/0.11, nz = v.z/0.2;
    const breast = smooth(clamp((0.25 - ny)/0.5, 0, 1)) * smooth(clamp((nz + 0.55)/0.4, 0, 1));
    const belly = smooth(clamp((-0.2 - ny)/0.35, 0, 1)) * smooth(clamp((-0.25 - nz)/0.35, 0, 1));
    c.copy(C_BACK).lerp(C_BREAST, breast).lerp(C_BREAST2, breast * clamp(nz, 0, 1) * 0.6).lerp(C_BELLY, belly);
    c.multiplyScalar(0.9 + r()*0.18); });
}
function headGeometry(){
  const g = new THREE.SphereGeometry(1, 28, 20); g.scale(0.074, 0.07, 0.082); g.computeVertexNormals();
  const eye = new THREE.Vector3(0.62, 0.22, 0.42).normalize();
  return vcolor(g, (v, n, c) => { const d = v.clone().normalize(); const ex = Math.abs(d.x), de = Math.acos(clamp(d.clone().set(ex, d.y, d.z).dot(eye), -1, 1));
    c.copy(C_HEAD); const ring = de > 0.17 && de < 0.3 && Math.abs(d.y - eye.y) > 0.03 ? 1 : 0; if (ring) c.copy(C_RING);
    if (d.y < -0.35 && d.z > 0.3){ c.lerp(C_RING, 0.55 * (Math.sin(d.x*70) > 0.2 ? 1 : 0.15)); }
    });
}
function featherCard(len, w, bend){ // root at origin, pointing -Z, flat in XZ, slight camber
  const g = new THREE.PlaneGeometry(w, len, 1, 4); g.rotateX(-Math.PI/2); g.translate(0, 0, -len/2);
  const p = g.attributes.position; for (let i=0;i<p.count;i++){ const t = -p.getZ(i)/len; p.setY(i, -bend*t*t*len); }
  g.computeVertexNormals(); return g;
}
function featherSet(list){ // [len, w, x, y, z, yaw, col, bend]
  const parts = list.map(([len, w, x, y, z, yaw, col, bend]) => { const g = featherCard(len, w, bend || 0.12); g.rotateY(yaw); g.translate(x, y, z);
    const cc = new THREE.Color(col); const cols = []; const p = g.attributes.position; for (let i=0;i<p.count;i++) cols.push(cc.r, cc.g, cc.b); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return g; });
  return mergeGeometries(parts);
}
const ARM = 0.12;
const armGeo = (() => { const L = []; // secondaries + two covert rows along +X
  for (let i=0;i<9;i++){ const x = 0.008 + i/8*(ARM - 0.012); L.push([0.13 - i*0.002, 0.05, x, -0.003, 0.004, -0.06 + i*0.012, i % 2 ? 0x4c443d : 0x564c44]); }
  for (let i=0;i<9;i++){ const x = 0.006 + i/8*(ARM - 0.01); L.push([0.08, 0.042, x, 0.004, 0.012, -0.02, i % 2 ? 0x62574c : 0x6a5e52, 0.08]); }
  for (let i=0;i<8;i++){ const x = 0.004 + i/7*(ARM - 0.012); L.push([0.05, 0.04, x, 0.008, 0.018, 0, 0x6e6256, 0.06]); }
  const g = featherSet(L);
  return g; })();
const handGeo = (() => { const L = [];
  for (let i=0;i<9;i++){ const t = i/8; const x = 0.004 + t*0.06; const yaw = lerp(-0.05, -1.25, t); L.push([lerp(0.135, 0.175, t) - (i === 8 ? 0.02 : 0), 0.042, x, -0.004 - t*0.002, 0.004, yaw, i % 2 ? 0x3a342f : 0x433c36, 0.1]); }
  for (let i=0;i<6;i++){ const t = i/5; L.push([0.065, 0.038, 0.004 + t*0.05, 0.004, 0.01, lerp(-0.1, -0.9, t), 0x5a5046, 0.06]); }
  return featherSet(L); })();
function makeRobinWing(parent, side){
  const holder = new THREE.Group(); holder.position.set(0.1*side, 0.05, 0.05); holder.scale.x = side; parent.add(holder);
  const shoulder = new THREE.Group(); shoulder.rotation.order = 'YZX'; holder.add(shoulder);
  const arm = new THREE.Mesh(armGeo, featherMatB); arm.castShadow = true; shoulder.add(arm);
  const wrist = new THREE.Group(); wrist.rotation.order = 'YZX'; wrist.position.x = ARM; shoulder.add(wrist);
  const hand = new THREE.Mesh(handGeo, featherMatB); hand.castShadow = true; wrist.add(hand);
  return { shoulder, arm, wrist, hand };
}
const birdObj = new THREE.Group(); scene.add(birdObj);
const birdModel = new THREE.Group(); birdObj.add(birdModel); birdModel.rotation.order = 'YXZ';
const birdBody = new THREE.Mesh(bodyGeometry(), plumageMat); birdBody.castShadow = true; birdBody.receiveShadow = true; birdModel.add(birdBody);
const birdHead = new THREE.Group(); birdHead.position.set(0, 0.085, 0.16); birdHead.rotation.order = 'YXZ'; birdModel.add(birdHead);
{ const hm = new THREE.Mesh(headGeometry(), plumageMat); hm.castShadow = true; birdHead.add(hm);
  const eg = new THREE.SphereGeometry(0.0135, 12, 10); for (const sd of [1, -1]){ const e = new THREE.Mesh(eg, eyeMatB); e.position.set(0.0545*sd, 0.0185, 0.041); birdHead.add(e); }
  const beak = mergeColored([[new THREE.ConeGeometry(0.017, 0.07, 10), 0xd9a21c, M(0, 0.004, 0.105, Math.PI/2, 0, 0, 1, 1, 0.7)], [new THREE.ConeGeometry(0.014, 0.055, 10), 0xc28a16, M(0, -0.008, 0.098, Math.PI/2 + 0.05, 0, 0, 1, 1, 0.6)],
    [new THREE.ConeGeometry(0.006, 0.016, 8), 0x3a2a14, M(0, 0.003, 0.138, Math.PI/2)]]);
  birdHead.add(new THREE.Mesh(beak, beakMat)); }
const birdTail = new THREE.Group(); birdTail.position.set(0, 0.025, -0.15); birdModel.add(birdTail);
const tailFeathers = new THREE.InstancedMesh((() => { const g = featherCard(0.19, 0.042, 0.06); const cols = []; const p = g.attributes.position; for (let i=0;i<p.count;i++){ const t = -p.getZ(i)/0.19; const cc = _c.setHex(0x1e1b19).lerp(C_BACK, 0.25*(1 - t)); cols.push(cc.r, cc.g, cc.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return g; })(), featherMatB, 12);
tailFeathers.castShadow = true; tailFeathers.frustumCulled = false; birdTail.add(tailFeathers);
for (let i=0;i<12;i++) tailFeathers.setColorAt(i, _c.setRGB(1, 1, 1));
tailFeathers.setColorAt(0, _c.setRGB(1.6, 1.6, 1.6)); tailFeathers.setColorAt(11, _c.setRGB(1.6, 1.6, 1.6));
const legs = new THREE.Mesh(mergeColored([
  [new THREE.CylinderGeometry(0.008, 0.007, 0.05, 6), 0x5a4636, M(0.035, -0.122, 0.03)], [new THREE.CylinderGeometry(0.008, 0.007, 0.05, 6), 0x5a4636, M(-0.035, -0.122, 0.03)],
  [new THREE.BoxGeometry(0.012, 0.008, 0.07), 0x4a3828, M(0.035, -0.146, 0.05)], [new THREE.BoxGeometry(0.012, 0.008, 0.07), 0x4a3828, M(-0.035, -0.146, 0.05)],
  [new THREE.BoxGeometry(0.01, 0.008, 0.04), 0x4a3828, M(0.035, -0.146, 0.0)], [new THREE.BoxGeometry(0.01, 0.008, 0.04), 0x4a3828, M(-0.035, -0.146, 0.0)],
]), birdMat); birdModel.add(legs);
const robinWings = [makeRobinWing(birdModel, 1), makeRobinWing(birdModel, -1)];
const birdBodyMat = plumageMat;

/* owl */
const owlBodyGeo = mergeColored([
  [SPH(), 0x6a5845, M(0, 0.45, 0, 0,0,0, 0.34, 0.45, 0.3)], [SPH(), 0xd7c6a6, M(0, 0.38, 0.17, 0,0,0, 0.22, 0.3, 0.14)],
  [SPH(), 0x6a5845, M(0, 0.98, 0.02, 0,0,0, 0.3, 0.26, 0.26)],
  [SPH(), 0xcdb894, M(0.12, 0.98, 0.2, 0,0,0, 0.12, 0.12, 0.06)], [SPH(), 0xcdb894, M(-0.12, 0.98, 0.2, 0,0,0, 0.12, 0.12, 0.06)],
  [new THREE.ConeGeometry(0.05, 0.16, 4), 0x6a5845, M(0.2, 1.24, 0, 0, 0, -0.3)], [new THREE.ConeGeometry(0.05, 0.16, 4), 0x6a5845, M(-0.2, 1.24, 0, 0, 0, 0.3)],
  [new THREE.ConeGeometry(0.035, 0.1, 4), 0x3a2c1e, M(0, 0.92, 0.27, Math.PI/2 + 0.4)],
  [SPH(), 0x56463a, M(0.3, 0.42, -0.02, 0,0,0, 0.08, 0.32, 0.22)], [SPH(), 0x56463a, M(-0.3, 0.42, -0.02, 0,0,0, 0.08, 0.32, 0.22)],
]);
const owlEyeGeo = mergeColored([[SPH(8,6), 0xffffff, M(0.12, 0.99, 0.25, 0,0,0, 0.07, 0.07, 0.04)], [SPH(8,6), 0xffffff, M(-0.12, 0.99, 0.25, 0,0,0, 0.07, 0.07, 0.04)]]);
const owlWingGeo = wingGeo(1.0, 0.42, 0x6a5845, 0x3e3226);
const owlPool = [];
function getOwl(){
  let o = owlPool.find(o => !o.used);
  if (!o){
    const g = new THREE.Group(); g.add(new THREE.Mesh(owlBodyGeo, birdMat));
    const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x2a2014 });
    const eyes = new THREE.Mesh(owlEyeGeo, eyeMat); g.add(eyes);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffaa30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.position.set(0, 0.99, 0.35); glow.scale.set(1.3, 0.8, 1); g.add(glow);
    const wings = makeWings(g, owlWingGeo, wingMat, 0.25, 0.6, 0); wings.forEach(w => w.visible = false);
    scene.add(g); o = { g, eyes, eyeMat, glow, wings, used: false }; owlPool.push(o);
  }
  o.used = true; o.g.visible = true; return o;
}
/* hawk */
const hawkObj = new THREE.Group(); hawkObj.visible = false; scene.add(hawkObj);
const hawkModel = new THREE.Group(); hawkModel.rotation.order = 'YXZ'; hawkObj.add(hawkModel);
hawkModel.add(new THREE.Mesh(mergeColored([
  [SPH(), 0x5c3b24, M(0, 0, 0, 0,0,0, 0.3, 0.26, 0.62)], [SPH(), 0xe8d6b4, M(0, -0.1, 0.12, 0,0,0, 0.22, 0.16, 0.4)],
  [SPH(), 0x5c3b24, M(0, 0.12, 0.62, 0,0,0, 0.2, 0.19, 0.22)], [SPH(), 0xe8d6b4, M(0, 0.07, 0.72, 0,0,0, 0.14, 0.1, 0.12)],
  [new THREE.ConeGeometry(0.06, 0.2, 5), 0xf1c232, M(0, 0.1, 0.88, Math.PI/2 + 0.5)],
  [SPH(6,5), 0xf5c518, M(0.11, 0.17, 0.74, 0,0,0, 0.04, 0.04, 0.04)], [SPH(6,5), 0xf5c518, M(-0.11, 0.17, 0.74, 0,0,0, 0.04, 0.04, 0.04)],
  [new THREE.BoxGeometry(0.36, 0.04, 0.6), 0x7a4e2e, M(0, 0.02, -0.82, -0.1)], [new THREE.BoxGeometry(0.37, 0.045, 0.06), 0x3a2414, M(0, 0.04, -0.72, -0.1)], [new THREE.BoxGeometry(0.37, 0.045, 0.06), 0x3a2414, M(0, 0.05, -0.95, -0.1)],
]), birdMat));
const hawkWings = makeWings(hawkModel, wingGeo(1.6, 0.6, 0x6e4a2c, 0x2c1c10), wingMat, 0.22, 0.08, 0.1);

/* golden feather */
const featherGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(0.2, -0.25, 0.22, 0.25, 0, 0.55); s.bezierCurveTo(-0.18, 0.25, -0.17, -0.25, 0, -0.5); const g = new THREE.ShapeGeometry(s); return g; })();
const featherMat = new THREE.MeshBasicMaterial({ color: 0xf2c04e, side: THREE.DoubleSide });
const featherPool = [];
function getFeather(){
  let f = featherPool.find(f => !f.used);
  if (!f){ const g = new THREE.Group(); const m = new THREE.Mesh(featherGeo, featherMat); g.add(m);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.0, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff4cc })); g.add(spine);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffd36a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 })); glow.scale.set(2.6, 2.6, 1); g.add(glow);
    scene.add(g); f = { g, used: false }; featherPool.push(f); }
  f.used = true; f.g.visible = true; return f;
}
/* drafts and shafts pools */
const draftGeo = new THREE.CylinderGeometry(3, 3, 44, 18, 1, true); draftGeo.translate(0, 22, 0);
const draftPool = [];
function getDraft(up){
  let d = draftPool.find(d => !d.used && d.up === up);
  if (!d){ const m = new THREE.Mesh(draftGeo, up ? MAT.up : MAT.down); m.renderOrder = 2; scene.add(m); d = { m, up, used: false }; draftPool.push(d); }
  d.used = true; d.m.visible = true; return d;
}
const shafts = [];
for (let i=0;i<7;i++){ const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT.shaft); m.renderOrder = 1; scene.add(m); shafts.push({ m, x: 0, z: -999, w: 6, h: 70 }); }

/* ---------- World ---------- */
let gdecor = [];
let trees = [], decor = [], berries = [], feathers = [], owls = [], drafts = [];
let genZ = 0, treeId = 0, branchId = 0, lastMidY = 12, dirty = true;
function zoneAtZ(z){ return ((Math.floor(z / ZONE_M)) % 4 + 4) % 4; }
function trunkR(t, y){ return t.r * lerp(1, 0.8, clamp(y / t.h, 0, 1)); }
function makeTree(x, z, bg){
  const zi = zoneAtZ(z), st = ZONES[zi].style;
  const r = st === 'birch' ? rand(0.42, 0.58) : st === 'redwood' ? rand(1.05, 1.45) : st === 'maple' ? rand(0.62, 0.82) : rand(0.7, 0.95);
  const t = { id: treeId++, x, z, r, h: rand(46, 54), zi, st, bg, branches: [], blobs: [], cones: [], limbs: [], tint: rand(0.85, 1.1) };
  const L = ZONES[zi].leaves.length;
  if (st === 'redwood'){
    for (let k=0;k<6;k++){ const y = 24 + k*3.6; t.cones.push({ x, y, z, s: 5.2 - k*0.75, sy: 2.4, c: (k % 3) }); }
  } else {
    const n = bg ? 6 : 11, sc = st === 'birch' ? 0.75 : 1;
    for (let i=0;i<n;i++){ const a = rnd()*TAU, d = rand(0.5, 5.2)*sc; t.blobs.push({ x: x + Math.sin(a)*d, y: rand(30, 46), z: z + Math.cos(a)*d, s: rand(2.6, 4.6)*sc, c: (rnd()*L)|0 }); }
  }
  // purely visual extras use their own generator so world layout stays identical to v2
  const vr = mulberry(t.id * 7919 + Math.floor(z * 13) * 31 + 7);
  if (st === 'redwood'){
    for (let k=0;k<6;k++){ const y = 25.8 + k*3.6; t.cones.push({ x, y, z, s: 4.6 - k*0.72, sy: 2.0, c: (k + 1) % 3, rot: vr()*TAU }); }
    for (let k=0;k<4;k++){ const y = 16 + k*2.2; t.cones.push({ x: x + (vr()-0.5), y, z: z + (vr()-0.5), s: 2.2 + vr()*1.2, sy: 1.4, c: k % 3, rot: vr()*TAU }); }
    const nl = bg ? 4 : 9;
    for (let i=0;i<nl;i++){ const a = vr()*TAU, y0 = 15 + vr()*26, len = 2.4 + vr()*2.2, e = -0.25 + vr()*0.3;
      t.limbs.push({ a, y0, len, e, th: 1.25 }); }
  } else {
    const nl = bg ? 3 : 5, sc = st === 'birch' ? 0.75 : 1;
    for (let i=0;i<nl;i++){ const a = vr()*TAU, y0 = (st === 'birch' ? 16 : 19) + vr()*11, len = (4 + vr()*4.5)*sc, e = 0.45 + vr()*0.55;
      t.limbs.push({ a, y0, len, e, th: st === 'birch' ? 1.3 : 2.1 });
      const tx = x + Math.sin(a)*(Math.cos(e)*len + r), ty = y0 + Math.sin(e)*len, tz = z + Math.cos(a)*(Math.cos(e)*len + r);
      t.blobs.push({ x: tx, y: ty + 1, z: tz, s: (2.2 + vr()*1.6)*sc, c: (vr()*L)|0 });
      if (!bg) t.blobs.push({ x: tx - Math.sin(a)*1.6, y: ty - 0.6, z: tz - Math.cos(a)*1.6, s: (1.6 + vr()*1.0)*sc, c: (vr()*L)|0 }); }
    const extra = bg ? 3 : 6;
    for (let i=0;i<extra;i++){ const a = vr()*TAU, d = (2 + vr()*5.5)*sc; t.blobs.push({ x: x + Math.sin(a)*d, y: 27 + vr()*15, z: z + Math.cos(a)*d, s: (2.4 + vr()*2.2)*sc, c: (vr()*L)|0 }); }
  }
  trees.push(t); return t;
}
function branchPoint(b, tt, out){ return out.set(b.x0 + b.dx*b.len*tt, b.y - b.sag*tt + b.sway*tt, b.z0 + b.dz*b.len*tt); }
function branchTop(b, tt){ return b.y - b.sag*tt + b.sway*tt + lerp(0.18, 0.06, tt); }
function addBranch(t, y, ang, len, kind){
  const dx = Math.sin(ang), dz = Math.cos(ang), rr = trunkR(t, y) * 0.8;
  const b = { id: branchId++, tree: t, y, ang, len, kind, sag: rand(0.2, 0.5), sway: 0, swayV: 0, dx, dz, x0: t.x + dx*rr, z0: t.z + dz*rr, slot: -1, owl: null };
  b.leaf = { tt: 1.25, up: 0.32, s: rand(0.75, 1.1), c: (rnd()*4)|0 };
  t.branches.push(b); return b;
}
function branchClear(t, ang, len, y){
  const dx = Math.sin(ang), dz = Math.cos(ang);
  for (const o of trees){ if (o === t || Math.abs(o.z - t.z) > 12) continue;
    for (const f of [0.5, 1.0, 1.35]){ const px = t.x + dx*len*f, pz = t.z + dz*len*f; if (Math.hypot(px - o.x, pz - o.z) < o.r + 1.0) return false; }
    for (const ob of o.branches){ if (Math.abs(ob.y - y) < 1.4){ const px = t.x + dx*len, pz = t.z + dz*len, qx = ob.x0 + ob.dx*ob.len, qz = ob.z0 + ob.dz*ob.len; if (Math.hypot(px-qx, pz-qz) < 1.6) return false; } } }
  for (const ob of t.branches){ if (Math.abs(ob.y - y) < 2.2 && Math.abs(Math.atan2(Math.sin(ob.ang - ang), Math.cos(ob.ang - ang))) < 0.9) return false; }
  return true;
}
let prevRow = [];
function genRow(){
  const d = clamp(genZ / 2600, 0, 1);
  const z = genZ + rand(7.5, 10.5) + d*2.5;
  const clearing = z > 130 && rnd() < 0.08 + 0.06*d;
  const row = [];
  if (clearing){
    if (rnd() < 0.85){ const dr = { x: rand(-12, 12), z, up: true, s: 27, r: 3, obj: getDraft(true) }; dr.obj.m.position.set(dr.x, 0, dr.z); drafts.push(dr); }
    if (rnd() < 0.5) addFeather(rand(-10, 10), rand(8, 18), z + rand(-3, 3));
  } else {
    const n = rnd() < 0.55 ? 2 : 3;
    for (let i=0;i<n;i++){
      for (let k=0;k<14;k++){
        const x = rand(-22, 22);
        if (trees.every(o => Math.abs(o.z - z) > 10 || Math.hypot(o.x - x, o.z - z) > 6.8)){ row.push(makeTree(x, z + rand(-1.5, 1.5), false)); break; }
      }
    }
    if (z > 650 && rnd() < 0.06 + 0.1*d){
      const x = rand(-16, 16); if (row.every(t => Math.abs(t.x - x) > 5)){ const dr = { x, z: z - 4, up: false, s: 16, r: 3, obj: getDraft(false) }; dr.obj.m.position.set(dr.x, 0, dr.z); drafts.push(dr); }
    }
  }
  for (const s of [-1, 1]){ const n = 1 + (rnd() < 0.6 ? 1 : 0); for (let i=0;i<n;i++) makeTree(s*rand(29, 72), z + rand(-4, 4), true); }
  if (rnd() < 0.5) makeTree(rand(-22, 22) < 0 ? -rand(24, 27) : rand(24, 27), z + rand(-3, 3), true);
  for (let i=0;i<4;i++) decor.push({ x: rand(-40, 40), y: 0.2, z: z + rand(-4, 4), s: rand(0.7, 1.6), zi: zoneAtZ(z), c: (rnd()*2)|0 });
  // branches
  const normals = [];
  for (const t of row){
    const nb = 2 + (rnd() < 0.65 ? 1 : 0) + (rnd() < 0.3 - 0.15*d ? 1 : 0);
    const ys = [clamp(lastMidY + rand(-5, 4.5), 5, 24)];
    let tries = 0; while (ys.length < nb && tries++ < 40){ const y = rand(4.5, 26); if (ys.every(v => Math.abs(v - y) > 3.2)) ys.push(y); }
    ys.forEach((y, i) => {
      let kind = 'normal'; if (i > 0 && z > 220 && rnd() < 0.05 + 0.2*d) kind = 'thorn';
      let len = rand(2.6, 4.4), ang = 0, ok = false;
      for (let k=0;k<10 && !ok;k++){ ang = rnd()*TAU; if (k < 5 && Math.cos(ang) > 0.85) continue; ok = branchClear(t, ang, len, y); }
      if (!ok){ len = 2.2; ang = rnd()*TAU; ok = branchClear(t, ang, len, y); }
      if (!ok) return;
      const b = addBranch(t, y, ang, len, kind); if (kind === 'normal') normals.push(b);
    });
  }
  if (normals.length) lastMidY = normals[(rnd()*normals.length)|0].y;
  // owls
  if (z > 330 && normals.length > 1){
    const night = zoneAtZ(z) === 3;
    if (rnd() < (night ? 0.3 : 0.1) + 0.12*d){ const b = normals[1 + ((rnd()*(normals.length-1))|0)]; const o = { b, tt: 0.32, state: 'sleep', timer: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), flap: rnd()*6, obj: getOwl() }; b.owl = o; owls.push(o); }
  }
  for (const b of normals) if (!b.owl && rnd() < 0.3) berries.push({ b, tt: rand(0.45, 0.85), pos: new THREE.Vector3(), red: rnd() < 0.7, taken: false, ph: rnd()*6, fade: 1 });
  if (prevRow.length && normals.length && rnd() < 0.45){
    const a = prevRow[(rnd()*prevRow.length)|0], bb = normals[(rnd()*normals.length)|0];
    const A = branchPoint(a, 1, new THREE.Vector3()), B = branchPoint(bb, 0.6, new THREE.Vector3()); A.y += 1.2; B.y += 1.0;
    if (B.z - A.z > 5){ const h = rand(1.5, 3); for (let i=0;i<5;i++){ const u = (i + 0.5)/5; berries.push({ pos: new THREE.Vector3(lerp(A.x, B.x, u), lerp(A.y, B.y, u) + Math.sin(u*Math.PI)*h, lerp(A.z, B.z, u)), red: true, taken: false, ph: i*0.7, fade: 1 }); } }
  }
  if (!clearing && z > 80 && rnd() < 0.07) addFeather(rand(-16, 16), rand(6, 20), z - rand(2, 4));
  prevRow = normals.length ? normals : prevRow;
  addGroundDecor(z);
  genZ = z; dirty = true;
}
function addFeather(x, y, z){ feathers.push({ pos: new THREE.Vector3(x, y, z), taken: false, ph: rnd()*6, fade: 1, obj: getFeather() }); }
function cullWorld(minZ){
  let changed = false;
  if (trees.length && trees.some(t => t.z < minZ)){ trees = trees.filter(t => t.z >= minZ); changed = true; }
  decor = decor.filter(d => d.z >= minZ);
  { const n = gdecor.length; gdecor = gdecor.filter(d => d.z >= minZ - 6); if (gdecor.length !== n) changed = true; }
  berries = berries.filter(b => (b.b ? b.b.tree.z : b.pos.z) >= minZ && !(b.taken && b.fade <= 0));
  feathers = feathers.filter(f => { const keep = f.pos.z >= minZ && !(f.taken && f.fade <= 0); if (!keep){ f.obj.used = false; f.obj.g.visible = false; } return keep; });
  drafts = drafts.filter(d => { const keep = d.z >= minZ - 6; if (!keep){ d.obj.used = false; d.obj.m.visible = false; } return keep; });
  owls = owls.filter(o => { const keep = o.state === 'sleep' || o.state === 'alert' ? o.b.tree.z >= minZ : (o.pos.z >= minZ && o.pos.y < 80); if (!keep){ o.obj.used = false; o.obj.g.visible = false; } return keep; });
  if (changed) dirty = true;
}
function setBranchMatrix(b){
  const tip = _v2.set(b.x0 + b.dx*b.len, b.y - b.sag + b.sway, b.z0 + b.dz*b.len);
  const base = _v.set(b.x0, b.y, b.z0);
  const dir = tip.sub(base); const L = dir.length(); dir.multiplyScalar(1/L);
  _q.setFromUnitVectors(UP, dir); _s.set(1, L, 1); _m.compose(base, _q, _s); IM[b.im].setMatrixAt(b.slot, _m);
}
const REBUILD_KEYS = ['thorn', 'bush', 'fern', 'grass', 'rock', 'log', 'leaf_oak', 'leaf_birch', 'leaf_maple', 'frond', ...SPECIES.map(s => 'trunk_' + s), ...SPECIES.map(s => 'limb_' + s)];
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function rebuild(){
  const cnt = {}; for (const k of REBUILD_KEYS) cnt[k] = 0;
  const put = (key, pos, q, s, col) => { const im = IM[key]; const i = cnt[key]; if (i >= im.instanceMatrix.count) return -1; _m.compose(pos, q, s); im.setMatrixAt(i, _m); if (col) im.setColorAt(i, col); cnt[key]++; return i; };
  const lp = new THREE.Vector3(), lp2 = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (const t of trees){
    const Z = ZONES[t.zi], sp = t.st, lk = sp === 'redwood' ? 'frond' : 'leaf_' + sp;
    const bark = _c.copy(Z.c_bark).multiplyScalar(0.92 + (t.tint - 0.85) * 0.5).clone();
    put('trunk_' + sp, _v.set(t.x, 0, t.z), _qa.setFromEuler(_e.set(0, t.id * 1.7, 0)), _s.set(t.r, t.h, t.r), bark);
    for (const l of t.limbs){
      const rr = trunkR(t, l.y0) * 0.75; lp.set(t.x + Math.sin(l.a)*rr, l.y0, t.z + Math.cos(l.a)*rr);
      tmp.set(Math.sin(l.a)*Math.cos(l.e), Math.sin(l.e), Math.cos(l.a)*Math.cos(l.e));
      put('limb_' + sp, lp, _qa.setFromUnitVectors(UP, tmp), _s.set(l.th, l.len, l.th), bark);
    }
    for (const bl of t.blobs){ _qa.setFromEuler(_e.set(bl.s * 0.3, bl.x * 3, bl.z * 0.2)); _c.copy(Z.c_leafI[bl.c]); put(lk, _v.set(bl.x, bl.y, bl.z), _qa, _s.set(bl.s, bl.s*0.75, bl.s), _c); }
    for (const cn of t.cones){ _qa.setFromEuler(_e.set(0, cn.rot !== undefined ? cn.rot : cn.y, 0)); _c.copy(Z.c_leafI[cn.c]); put('frond', _v.set(cn.x, cn.y, cn.z), _qa, _s.set(cn.s, cn.sy*0.9, cn.s), _c); }
    for (const b of t.branches){
      b.im = 'limb_' + sp; b.slot = cnt[b.im];
      if (b.slot < IM[b.im].instanceMatrix.count){ setBranchMatrix(b); _c.copy(bark).multiplyScalar(b.kind === 'thorn' ? 0.42 : 0.95); if (b.kind === 'thorn'){ _c.r += 0.06; } IM[b.im].setColorAt(b.slot, _c); cnt[b.im]++; }
      if (b.leaf){ branchPoint(b, b.leaf.tt, lp); lp.y += b.leaf.up;
        if (sp === 'redwood'){ _qa.setFromEuler(_e.set(0, b.id, 0)); _c.copy(Z.c_leafI[b.leaf.c % 4]); put('frond', lp, _qa, _s.set(b.leaf.s*1.7, b.leaf.s*1.2, b.leaf.s*1.7), _c); }
        else { _qa.setFromEuler(_e.set(b.id, b.id*2, 0)); _c.copy(Z.c_leafI[b.leaf.c % 4]); put(lk, lp, _qa, _s.set(b.leaf.s*1.1, b.leaf.s*0.85, b.leaf.s*1.1), _c);
          const sd = (b.id % 2 ? 1 : -1) * 0.55; branchPoint(b, 0.95, lp2); lp2.x += b.dz*sd; lp2.z -= b.dx*sd; lp2.y += 0.5;
          _c.copy(Z.c_leafI[(b.leaf.c + 1) % 4]); put(lk, lp2, _qa, _s.set(b.leaf.s*0.7, b.leaf.s*0.55, b.leaf.s*0.7), _c); } }
      if (b.kind === 'thorn'){
        for (let k=1;k<10;k++){ const tt = k/10; const p = branchPoint(b, tt, tmp); const upv = k % 2 ? 1 : -1; p.y += upv * 0.14;
          _qa.setFromEuler(_e.set(upv > 0 ? 0.3*(k%3-1) : Math.PI + 0.3*(k%3-1), b.ang, 0)); put('thorn', p, _qa, _s.set(1,1,1), null); }
      }
    }
  }
  for (const d of decor){ const Z = ZONES[d.zi]; _qa.setFromEuler(_e.set(0, d.x, 0)); _c.copy(Z.c_bush).multiplyScalar(d.c ? 2.4 : 1.9); put('bush', _v.set(d.x, d.s*0.42, d.z), _qa, _s.set(d.s*1.2, d.s*0.62, d.s*1.2), _c); }
  for (const g of gdecor){ const Z = ZONES[g.zi]; _qa.setFromEuler(_e.set(0, g.r, 0));
    if (g.k === 'fern'){ _c.copy(Z.c_fern).multiplyScalar(0.8 + g.c*0.4); put('fern', _v.set(g.x, 0, g.z), _qa, _s.set(g.s, g.s, g.s), _c); }
    else if (g.k === 'grass'){ _c.copy(Z.c_grass).multiplyScalar(0.8 + g.c*0.4); put('grass', _v.set(g.x, 0, g.z), _qa, _s.set(g.s*1.2, g.s, g.s*1.2), _c); }
    else if (g.k === 'rock'){ _qa.setFromEuler(_e.set(g.c*0.3, g.r, 0)); _c.setRGB(0.85 + g.c*0.2, 0.85 + g.c*0.2, 0.85 + g.c*0.18); put('rock', _v.set(g.x, -0.05*g.s, g.z), _qa, _s.set(g.s*1.3, g.s, g.s), _c); }
    else if (g.k === 'log'){ _c.copy(Z.c_bark).multiplyScalar(0.75); put('log', _v.set(g.x, g.s*0.75, g.z), _qa, _s.set(g.len, g.s, g.s), _c); } }
  for (const k of REBUILD_KEYS){ const im = IM[k]; im.count = Math.min(cnt[k], im.instanceMatrix.count); im.visible = im.count > 0 && !(k === 'grass' && QUALITY.level < 2); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  dirty = false;
}
function addGroundDecor(z){
  const vr = mulberry((Math.floor(z * 100) ^ 0x2f6b) >>> 0), zi = zoneAtZ(z);
  const free = (x, zz, pad) => trees.every(t => Math.abs(t.z - zz) > 4 || Math.hypot(t.x - x, t.z - zz) > t.r*1.7 + pad);
  const nF = zi === 3 ? 16 : 12, nG = zi === 3 ? 6 : 16;
  for (let i=0;i<nF;i++){ const x = (vr()-0.5)*96, zz = z + (vr()-0.5)*9; if (free(x, zz, 0.4)) gdecor.push({ k: 'fern', x, z: zz, s: 0.6 + vr()*0.9, r: vr()*TAU, zi, c: vr() }); }
  for (let i=0;i<nG;i++){ const x = (vr()-0.5)*90, zz = z + (vr()-0.5)*9; if (free(x, zz, 0.2)) gdecor.push({ k: 'grass', x, z: zz, s: 0.6 + vr()*0.7, r: vr()*TAU, zi, c: vr() }); }
  for (let i=0;i<3;i++){ const x = (vr()-0.5)*90, zz = z + (vr()-0.5)*9; if (free(x, zz, 1)) gdecor.push({ k: 'rock', x, z: zz, s: 0.25 + Math.pow(vr(), 2)*1.3, r: vr()*TAU, zi, c: vr() }); }
  if (vr() < 0.22){ const x = (vr()-0.5)*70, zz = z + (vr()-0.5)*6, len = 4 + vr()*6; if (free(x, zz, len*0.5)) gdecor.push({ k: 'log', x, z: zz, s: 0.28 + vr()*0.2, len, r: vr()*TAU, zi, c: vr() }); }
}

/* ---------- Effects ---------- */
function makePoints(n, size, map, additive, vcol){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n*3), 3));
  if (vcol) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n*3), 3));
  const m = new THREE.PointsMaterial({ size, map, vertexColors: !!vcol, transparent: true, depthWrite: false, alphaTest: additive ? 0 : 0.4, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
}
const LEAVES_N = 120;
const fallLeaves = inst(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshLambertMaterial({ map: TEX.leaf, alphaTest: 0.4, side: THREE.DoubleSide }), LEAVES_N, false, false);
fallLeaves.count = LEAVES_N;
const leafSim = []; for (let i=0;i<LEAVES_N;i++) leafSim.push({ x:0, y:-99, z:0, ph: fr(0,6), sp: fr(0.5, 1.1), c: (Math.random()*4)|0, rx: fr(0,6), ry: fr(0,6), rz: fr(0,6), wx: fr(-4,4), wy: fr(-3,3), wz: fr(-5,5) });
const FLY_N = 70, flyPts = makePoints(FLY_N, 0.45, TEX.glow, true, true);
const flySim = []; for (let i=0;i<FLY_N;i++) flySim.push({ x:0, y:-99, z:0, ph: fr(0,6) });
const SPARK_N = 160, sparkPts = makePoints(SPARK_N, 0.32, TEX.glow, true, true);
const BIT_N = 120, bitPts = makePoints(BIT_N, 0.24, TEX.leaf, false, true);
const sparks = [], bits = [];
const MOTE_N = 80, motePts = makePoints(MOTE_N, 0.28, TEX.glow, true, true);
const DUST_N = 220, dustPts = makePoints(DUST_N, 0.075, TEX.glow, true, true);
const dustSim = []; for (let i=0;i<DUST_N;i++) dustSim.push({ s: i % 7, u: fr(-0.5, 0.5), h: fr(0, 1), ph: fr(0, 6), sp: fr(0.02, 0.08) });
function spark(p, col, n, spd){ const c = new THREE.Color(col); for (let i=0;i<n;i++){ if (sparks.length >= SPARK_N) sparks.shift(); const a = fr(0,TAU), b = fr(-1,1), s = fr(0.5,1)*(spd||4);
  sparks.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a)*Math.sqrt(1-b*b)*s, vy: b*s, vz: Math.sin(a)*Math.sqrt(1-b*b)*s, life: fr(0.35, 0.7), age: 0, c }); } }
function burst(p, cols, n, spd, kind){ for (let i=0;i<n;i++){ if (bits.length >= BIT_N) bits.shift(); const a = fr(0,TAU), s = fr(0.4,1)*(spd||3);
  bits.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a)*s, vy: fr(0.2, 1.4)*s*0.6, vz: Math.sin(a)*s, life: fr(1.2, 2.4), age: 0, c: new THREE.Color(cols[i % cols.length]), kind, ph: fr(0,6) }); } }
const FEATHER_COLS = [0x6b4a35, 0xd0612f, 0x8b6748, 0xefe2c6];
function updateFx(dt){
  const Z = ZONES[PAL.zi];
  // tumbling leaves around camera
  const cp = camera.position;
  for (let i=0;i<LEAVES_N;i++){ const s = leafSim[i];
    if (s.y < cp.y - 12 || s.y < 0.05 || Math.abs(s.x - cp.x) > 22 || s.z < cp.z - 4 || s.z > cp.z + 40){ s.x = cp.x + fr(-20, 20); s.y = cp.y + fr(0, 14); s.z = cp.z + fr(0, 38); s.c = (Math.random()*4)|0; }
    const flutter = Math.sin(time*2.1 + s.ph);
    s.y -= s.sp * (0.8 + 0.5*Math.abs(flutter)) * dt; s.x += (Math.sin(time*1.3 + s.ph) * 0.9 + 0.4) * dt; s.z += Math.cos(time*0.9 + s.ph) * 0.5 * dt;
    s.rx += s.wx*dt; s.ry += s.wy*dt; s.rz += s.wz*dt*(0.5 + Math.abs(flutter));
    _qb.setFromEuler(_e.set(s.rx, s.ry, s.rz)); _m.compose(_v.set(s.x, s.y, s.z), _qb, _s.set(1, 1, 1)); fallLeaves.setMatrixAt(i, _m);
    const c = Z.c_leaves[s.c]; _c.copy(c).lerp(Z.c_fallLeaf, (i % 3) * 0.35); fallLeaves.setColorAt(i, _c); }
  fallLeaves.instanceMatrix.needsUpdate = true; if (fallLeaves.instanceColor) fallLeaves.instanceColor.needsUpdate = true;
  // dust motes drifting inside the light shafts
  const dp = dustPts.geometry.attributes.position, dc = dustPts.geometry.attributes.color; const da = (1 - PAL.night*0.85);
  for (let i=0;i<DUST_N;i++){ const d = dustSim[i], sh = shafts[d.s]; d.h += d.sp*dt*0.3; if (d.h > 1) d.h -= 1;
    const y = 1 + d.h*24, off = (30 - y) * Math.tan(sh.m.rotation.z), ang = sh.m.rotation.y;
    const lx = d.u*sh.w*0.8 + Math.sin(time*0.3 + d.ph)*0.3; dp.setXYZ(i, sh.x + Math.cos(ang)*(lx + off), y, sh.z - Math.sin(ang)*(lx + off));
    const tw = (0.35 + 0.65*Math.max(0, Math.sin(time*1.7 + d.ph*3))) * da * Math.sin(d.h*Math.PI); dc.setXYZ(i, Z.c_shaft.r*tw, Z.c_shaft.g*tw, Z.c_shaft.b*tw*0.9); }
  dp.needsUpdate = true; dc.needsUpdate = true;
  // fireflies
  flyPts.visible = PAL.night > 0.05;
  if (flyPts.visible){ const fp = flyPts.geometry.attributes.position, fc = flyPts.geometry.attributes.color;
    for (let i=0;i<FLY_N;i++){ const s = flySim[i]; if (Math.abs(s.x - cp.x) > 24 || s.z < cp.z - 4 || s.z > cp.z + 45 || s.y < 0){ s.x = cp.x + fr(-22, 22); s.y = fr(1, 16); s.z = cp.z + fr(0, 44); }
      const x = s.x + Math.sin(time*0.7 + s.ph)*0.8, y = s.y + Math.sin(time*0.9 + s.ph*2)*0.5; fp.setXYZ(i, x, y, s.z);
      const a = PAL.night * Math.max(0, Math.sin(time*1.6 + s.ph*3)) ; fc.setXYZ(i, 0.75*a, 1.0*a, 0.45*a); }
    fp.needsUpdate = true; fc.needsUpdate = true; }
  // sparks
  const sp = sparkPts.geometry.attributes.position, sc = sparkPts.geometry.attributes.color;
  for (let i=sparks.length-1;i>=0;i--){ const s = sparks[i]; s.age += dt; if (s.age > s.life){ sparks.splice(i,1); continue; } s.vx *= 1 - 3*dt; s.vy *= 1 - 3*dt; s.vz *= 1 - 3*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt; }
  for (let i=0;i<SPARK_N;i++){ const s = sparks[i]; if (s){ const a = 1 - s.age/s.life; sp.setXYZ(i, s.x, s.y, s.z); sc.setXYZ(i, s.c.r*a, s.c.g*a, s.c.b*a); } else sp.setXYZ(i, 0, -999, 0); }
  sp.needsUpdate = true; sc.needsUpdate = true;
  const bp = bitPts.geometry.attributes.position, bc = bitPts.geometry.attributes.color;
  for (let i=bits.length-1;i>=0;i--){ const s = bits[i]; s.age += dt; if (s.age > s.life || s.y < 0){ bits.splice(i,1); continue; } s.vy -= 3*dt; s.vy *= 1 - 1.5*dt; s.vx *= 1 - 1.5*dt; s.vz *= 1 - 1.5*dt; s.vx += Math.sin(time*3 + s.ph)*2*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt; }
  for (let i=0;i<BIT_N;i++){ const s = bits[i]; if (s){ bp.setXYZ(i, s.x, s.y, s.z); bc.setXYZ(i, s.c.r, s.c.g, s.c.b); } else bp.setXYZ(i, 0, -999, 0); }
  bp.needsUpdate = true; bc.needsUpdate = true;
  // draft motes
  const mp = motePts.geometry.attributes.position, mc = motePts.geometry.attributes.color; let mi = 0;
  for (const d of drafts){ if (Math.abs(d.z - birdS.pos.z) > 70) continue; for (let k=0;k<20 && mi < MOTE_N;k++, mi++){
    const y = d.up ? ((time*3 + k*2.2) % 40) : 40 - ((time*6 + k*2.2) % 40); const a = k*2.4 + time*(d.up ? 0.6 : 0.2);
    mp.setXYZ(mi, d.x + Math.cos(a)*d.r*0.8, y, d.z + Math.sin(a)*d.r*0.8); if (d.up){ mc.setXYZ(mi, 1, 0.92, 0.7); } else mc.setXYZ(mi, 0.4, 0.45, 0.55); } }
  for (; mi < MOTE_N; mi++) mp.setXYZ(mi, 0, -999, 0);
  mp.needsUpdate = true; mc.needsUpdate = true;
  TEX.draft.offset.y -= dt * 0.25; MAT.down.map.offset.y += dt * 0.5;
  // shafts
  for (const s of shafts){
    if (s.z < birdS.pos.z - 10){ s.z = birdS.pos.z + fr(40, 120); s.x = birdS.pos.x + fr(-30, 30); s.w = fr(4, 9); }
    s.m.position.set(s.x, 30, s.z); s.m.scale.set(s.w, 75, 1); const ang = Math.atan2(camera.position.x - s.x, camera.position.z - s.z), lat = SUN_DIR.x*Math.cos(ang) - SUN_DIR.z*Math.sin(ang); s.m.rotation.set(0, ang, clamp(-Math.atan2(lat, SUN_DIR.y), -1.0, 1.0));
  }
  MAT.shaft.opacity = (PAL.shaftA || 0.15) * (0.85 + 0.15*Math.sin(time*0.7));
}
/* speed lines (camera space) */
const SL_N = 36;
const slGeo = new THREE.BufferGeometry(); slGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SL_N*6), 3));
const slMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const speedLines = new THREE.LineSegments(slGeo, slMat); speedLines.frustumCulled = false; speedLines.renderOrder = 10; camera.add(speedLines);
const slSim = []; for (let i=0;i<SL_N;i++){ const a = fr(0,TAU), r = fr(0.7, 2.2); slSim.push({ x: Math.cos(a)*r, y: Math.sin(a)*r*1.6, z: -fr(2, 12) }); }
function updateSpeedLines(dt, spd){
  const k = clamp((spd - 13) / 12, 0, 1); slMat.opacity = k * 0.5; speedLines.visible = k > 0.01; if (!speedLines.visible) return;
  const p = slGeo.attributes.position; const v = 18 + spd * 1.4;
  for (let i=0;i<SL_N;i++){ const s = slSim[i]; s.z += v*dt; if (s.z > -1.2){ const a = fr(0,TAU), r = fr(0.8, 2.3); s.x = Math.cos(a)*r; s.y = Math.sin(a)*r*1.7; s.z = -fr(9, 13); }
    const L = 0.6 + k*1.6; p.setXYZ(i*2, s.x, s.y, s.z); p.setXYZ(i*2+1, s.x*1.06, s.y*1.06, s.z + L); }
  p.needsUpdate = true;
}
/* DOM popups */
const popEls = []; let popI = 0;
for (let i=0;i<6;i++){ const el = document.createElement('div'); el.className = 'pop'; el.innerHTML = '<b></b><span></span>'; $('pops').appendChild(el); popEls.push({ el, life: 0, pos: new THREE.Vector3() }); }
function popup(pos, text, sub, col){
  const p = popEls[popI++ % popEls.length]; p.life = 1.25; p.pos.copy(pos); p.pos.y += 0.6;
  p.el.firstChild.textContent = text || ''; p.el.lastChild.textContent = sub || ''; p.el.firstChild.style.color = col || '#fbf5e6';
  p.el.classList.remove('on'); void p.el.offsetWidth; p.el.classList.add('on');
}
function updatePopups(dt){
  for (const p of popEls){ if (p.life <= 0) continue; p.life -= dt; p.pos.y += 0.5*dt; _v.copy(p.pos).project(camera);
    if (p.life <= 0 || _v.z > 1){ p.el.style.opacity = 0; continue; }
    const x = (_v.x*0.5 + 0.5) * innerWidth, y = (-_v.y*0.5 + 0.5) * innerHeight;
    p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)'; p.el.style.opacity = Math.min(1, p.life*2.5); }
}

/* ---------- Game state ---------- */
let state = 'title', time = 0, hitStop = 0, shake = 0, slowmo = 1, flash = 0;
let score = 0, bonus = 0, distM = 0, combo = 0, bestCombo = 0, perfects = 0, berryCount = 0, lastZone = 0;
let nextHawkM = 520, hawk = { on: false }, dieT = 0, deathCause = '';
const birdS = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), prev: new THREE.Vector3() };
const PAL = { zi: 0, night: 0, key: '' };
const camS = { yaw: 0, fov: 62, roll: 0, look: new THREE.Vector3(), init: false };
let ptr = null;

function resetWorld(startM){
  startM = startM || 0;
  seed = (Date.now() % 1000003) + 17;
  for (const o of owls){ o.obj.used = false; o.obj.g.visible = false; }
  for (const f of feathers){ f.obj.used = false; f.obj.g.visible = false; }
  for (const d of drafts){ d.obj.used = false; d.obj.m.visible = false; }
  trees = []; decor = []; gdecor = []; berries = []; feathers = []; owls = []; drafts = []; sparks.length = 0; bits.length = 0; prevRow = [];
  treeId = 0; branchId = 0; lastMidY = 12;
  const z0 = startM;
  const t = makeTree(-1.6, z0, false);
  const start = addBranch(t, 12, Math.PI/2 * 0.0 + 1.35, 3.6, 'normal'); start.leaf = null;
  addBranch(t, 18.5, -2.2, 3.2, 'normal'); addBranch(t, 7, 2.6, 3, 'normal');
  prevRow = [start]; genZ = z0 + 2;
  for (let i=0;i<3;i++) makeTree((i%2 ? 1 : -1) * rand(8, 20), z0 - 4 - i*6, true);
  for (const s of [-1,1]) for (let i=0;i<3;i++) makeTree(s*rand(30, 70), z0 - 10 + i*8, true);
  while (genZ < z0 + 170) genRow();
  Object.assign(birdS, { mode: 'perch', branch: start, tt: 0.7, yaw: 0, pitch: 0, bank: 0, speed: 0, holding: false, dragDX: 0, dragDY: 0, stall: 0,
    flaps: 3, maxFlaps: 3, stun: 0, alive: true, airT: 0, glideT: 0, divedDeep: false, turnT: 0, wvy: 0, fromBranch: null, aimYaw: 0, aimPow: 0, aiming: false,
    perchYaw: 0, sq: 1, sqV: 0, wingT: 0, flapAnim: 0, launchY: 12, lastBranch: start.id, furthestZ: t.z, hurt: 0, hidden: false, blink: 0, rotX: 0 });
  birdS.vel.set(0,0,0);
  placeOnBranch();
  score = 0; bonus = 0; distM = startM; combo = 0; bestCombo = 0; perfects = 0; berryCount = 0; lastZone = Math.floor(startM / ZONE_M);
  nextHawkM = startM + 520; hawk = { on: false }; hawkObj.visible = false; hitStop = 0; shake = 0; slowmo = 1;
  camS.init = false; PAL.key = '';
  for (const s of shafts) s.z = -9999;
  rebuild();
}
function placeOnBranch(){ const b = birdS.branch; branchPoint(b, birdS.tt, birdS.pos); birdS.pos.y = branchTop(b, birdS.tt) + FOOT; }

/* landing / prediction */
function findLanding(prev, cur, skip, magnet){
  for (const t of trees){ if (t.bg || Math.abs(t.z - cur.z) > 7 || Math.abs(t.x - cur.x) > 7) continue;
    for (const b of t.branches){ if (b === skip) continue;
      const tt = ((cur.x - b.x0)*b.dx + (cur.z - b.z0)*b.dz) / b.len; if (tt < 0.08 || tt > 1.02) continue;
      const px = b.x0 + b.dx*b.len*tt, pz = b.z0 + b.dz*b.len*tt, hd = Math.hypot(cur.x - px, cur.z - pz);
      if (hd > 0.62) continue;
      const top = branchTop(b, tt), f0 = prev.y - FOOT, f1 = cur.y - FOOT;
      if (f0 >= top - 0.08 && f1 <= top + 0.02) return { b, tt };
      if (magnet && f1 >= top - 0.02 && f1 - top < 0.4 && hd < 0.5) return { b, tt };
    } }
  return null;
}
function draftAcc(p){ let a = 0; for (const d of drafts){ const dd = Math.hypot(p.x - d.x, p.z - d.z); if (dd < d.r){ const f = 1 - dd/d.r; a += (d.up ? 1 : -1) * d.s * (0.45 + 0.55*f); } } return a; }
function launchVel(aimYaw, pow, out){ const e = lerp(0.42, 1.0, pow), sp = lerp(7.5, 16.5, pow); return out.set(Math.sin(aimYaw)*Math.cos(e)*sp, Math.sin(e)*sp, Math.cos(aimYaw)*Math.cos(e)*sp); }
const _pp = new THREE.Vector3(), _pv = new THREE.Vector3(), _pq = new THREE.Vector3();
function predictPath(aimYaw, pow, dots){
  launchVel(aimYaw, pow, _pv); _pp.copy(birdS.pos); let hit = null; let n = 0; const h = 1/60;
  for (let i=0;i<180;i++){
    _pq.copy(_pp); _pv.y -= (G - draftAcc(_pp))*h; _pv.x *= 1 - 0.1*h; _pv.z *= 1 - 0.1*h; _pp.addScaledVector(_pv, h);
    if (i % 4 === 2 && dots && n < 30){ dots.push(_pp.x, _pp.y, _pp.z); n++; }
    if (_pv.y < 1){ hit = findLanding(_pq, _pp, i < 18 ? birdS.branch : null, false); if (hit){ hit.pos = branchPoint(hit.b, hit.tt, new THREE.Vector3()); hit.pos.y = branchTop(hit.b, hit.tt) + 0.02; break; } }
    if (_pp.y < 0) break;
    if (trunkHit(_pp)) break;
  }
  return hit;
}
function trunkHit(p){
  for (const t of trees){ if (Math.abs(t.z - p.z) > 3 || Math.abs(t.x - p.x) > 3 || p.y > t.h) continue;
    const r = trunkR(t, p.y) + 0.26, dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz); if (d < r) return { t, nx: dx/(d||1), nz: dz/(d||1), r }; }
  return null;
}

/* gameplay events */
function land(b, tt){
  const B = birdS, v = B.vel, speed = Math.hypot(v.x, v.y + B.wvy, v.z), vy = v.y + B.wvy;
  if (b.kind === 'thorn'){ thornHit(b); return; }
  if (b.owl && (b.owl.state === 'sleep' || b.owl.state === 'alert') && Math.abs(tt - b.owl.tt) * b.len < 1.4){ b.owl.state = 'swoop'; b.owl.timer = 0.5; caught('owl'); return; }
  B.mode = 'perch'; B.branch = b; B.tt = tt; B.holding = false; B.stall = 0; B.divedDeep = false; B.flaps = B.maxFlaps; B.wvy = 0;
  B.perchYaw = clamp(Math.atan2(v.x, v.z), -1.3, 1.3); B.aimYaw = B.perchYaw; B.yaw = B.perchYaw; v.set(0,0,0);
  if (ptr) ptr.consumed = true;
  let q = 'good'; if (speed < 10.5 && vy > -6) q = 'perfect'; else if (speed > 19 || vy < -15) q = 'hard';
  b.swayV -= clamp(-vy, 2, 20) * (q === 'hard' ? 0.06 : 0.03);
  B.sq = q === 'hard' ? 0.55 : 0.7; B.sqV = 0;
  placeOnBranch();
  const fresh = b.tree.z > B.furthestZ + 0.5;
  burst(branchPoint(b, 1.1, new THREE.Vector3()).setY(b.y + 0.6), ZONES[b.tree.zi].leaves, q === 'hard' ? 8 : 4, 2.5, 'leaf');
  if (fresh){
    B.furthestZ = b.tree.z;
    if (q === 'perfect'){ combo++; perfects++; bestCombo = Math.max(bestCombo, combo); const pts = 100*combo; bonus += pts;
      popup(B.pos, combo > 1 ? 'PERFECT  x' + combo : 'PERFECT', '+' + pts, '#ffd77a'); spark(B.pos, 0xffe39a, 16, 3.5); sfx.perfect(combo); comboBump(); tutDone('perfect'); }
    else { if (combo > 1) popup(_v.copy(B.pos).setY(B.pos.y + 0.7), 'Chain broken', '', '#f2c1a8'); combo = 0; const pts = q === 'hard' ? 20 : 40; bonus += pts;
      popup(B.pos, q === 'hard' ? 'Hard landing' : 'Nice', '+' + pts, q === 'hard' ? '#f2c1a8' : '#fbf5e6'); if (!TUT.perfect) hintFlash = 3.5; }
  }
  if (q === 'hard'){ shake = Math.max(shake, 0.35); hitStop = 0.07; B.stun = 0.25; burst(B.pos, FEATHER_COLS, 4, 2, 'feather'); sfx.hard(); }
  sfx.land(q); B.lastBranch = b.id;
}
function thornHit(b){
  const B = birdS; B.vel.y = 7; B.vel.x *= 0.3; B.vel.z = Math.max(2, B.vel.z * 0.3); B.holding = false; if (ptr) ptr.consumed = true;
  B.flaps = Math.max(0, B.flaps - 1); B.hurt = 0.6; if (combo > 1) popup(_v.copy(B.pos).setY(B.pos.y + 0.7), 'Chain broken', '', '#f2c1a8'); combo = 0;
  popup(B.pos, 'Thorns', '-1 flap', '#ff9b80'); burst(B.pos, FEATHER_COLS, 6, 3, 'feather'); shake = Math.max(shake, 0.25); hitStop = 0.05; b.swayV += 0.6; sfx.ouch();
}
function bonk(hit){
  const B = birdS, v = B.vel; const vn = v.x*hit.nx + v.z*hit.nz;
  B.pos.x = hit.t.x + hit.nx*(hit.r + 0.05); B.pos.z = hit.t.z + hit.nz*(hit.r + 0.05);
  if (vn < 0){ v.x -= 1.4*vn*hit.nx; v.z -= 1.4*vn*hit.nz; } v.x *= 0.45; v.z *= 0.45; v.y = Math.min(v.y, 1.5);
  B.holding = false; if (ptr) ptr.consumed = true; B.stun = 0.55; B.hurt = 0.6;
  B.flaps = Math.max(0, B.flaps - 1); if (combo > 1) popup(_v.copy(B.pos).setY(B.pos.y + 0.7), 'Chain broken', '', '#f2c1a8'); combo = 0;
  popup(B.pos, 'Bonk', '-1 flap', '#f2c1a8'); burst(B.pos, FEATHER_COLS, 6, 2.5, 'feather'); shake = 0.4; hitStop = 0.08; sfx.hard();
}
function caught(by){
  if (!birdS.alive) return; birdS.alive = false; birdS.hidden = true; state = 'dying'; dieT = 0; deathCause = by; slowmo = 0.35;
  burst(birdS.pos, FEATHER_COLS, 18, 4, 'feather'); shake = 0.6; hitStop = 0.09; if (by === 'hawk') sfx.screech(1); else if (by === 'owl') sfx.hoot(1); else sfx.hard(); sfx.gameover();
}
function crash(){ if (!birdS.alive) return; caught('trunk'); birdS.hidden = false; birdS.vel.multiplyScalar(-0.15); birdS.vel.y = 2; }
function hitFloor(){
  if (!birdS.alive) return; birdS.alive = false; state = 'dying'; dieT = 0; deathCause = 'floor';
  birdS.pos.y = FOOT * 0.7; birdS.vel.multiplyScalar(0.2); shake = 0.5; hitStop = 0.08;
  burst(birdS.pos, ZONES[PAL.zi].leaves, 10, 3, 'leaf'); burst(birdS.pos, FEATHER_COLS, 4, 2, 'feather'); sfx.hard(); sfx.gameover();
}
function flap(){
  const B = birdS; if (B.mode !== 'air' || !B.alive || B.stun > 0) return;
  if (B.flaps <= 0){ sfx.noflap(); popup(B.pos, 'No flaps left', '', '#f2c1a8'); return; }
  B.flaps--; const v = B.vel; v.y = Math.max(v.y * 0.3, 0) + FLAP_VY;
  const hs = Math.hypot(v.x, v.z), ns = Math.max(hs, 5) + 1.2; v.x = Math.sin(B.yaw)*ns; v.z = Math.cos(B.yaw)*ns;
  B.flapAnim = 1; B.sq = 1.2; burst(B.pos, [0x8b6748], 2, 1, 'feather'); sfx.flap(); tutDone('flap');
}
function launch(pow){
  const B = birdS; if (B.mode !== 'perch' || B.stun > 0) return;
  const b = B.branch; launchVel(B.aimYaw, pow, B.vel);
  B.mode = 'air'; B.fromBranch = b; B.branch = null; B.yaw = B.aimYaw; B.airT = 0; B.flapAnim = 1; B.launchY = B.pos.y; B.sq = 1.25; B.wvy = 0;
  b.swayV -= 0.5; burst(branchPoint(b, 1.1, new THREE.Vector3()).setY(b.y + 0.6), ZONES[b.tree.zi].leaves, 2, 2, 'leaf');
  sfx.launch(); tutDone('launch');
}

/* ---------- Simulation ---------- */
function updateBird(dt){
  const B = birdS, v = B.vel;
  B.sqV += ((1 - B.sq) * 260 - B.sqV * 14) * dt; B.sq += B.sqV * dt;
  if (B.hurt > 0) B.hurt -= dt; if (B.flapAnim > 0) B.flapAnim = Math.max(0, B.flapAnim - dt*2.2);
  B.blink -= dt; if (B.blink < -fr(2, 5)) B.blink = 0.12;
  if (!B.alive){
    if (deathCause === 'floor' || deathCause === 'trunk'){ v.y -= G*dt; B.pos.addScaledVector(v, dt); if (B.pos.y < FOOT*0.7){ B.pos.y = FOOT*0.7; v.multiplyScalar(0.8); v.y = 0; } }
    return;
  }
  if (B.mode === 'perch'){
    placeOnBranch(); B.stun -= dt; B.wingT += dt*4;
    B.yaw = damp(B.yaw, B.aiming ? B.aimYaw : B.perchYaw, 10, dt); B.pitch = damp(B.pitch, 0, 10, dt); B.bank = damp(B.bank, 0, 10, dt);
    return;
  }
  B.airT += dt; if (B.stun > 0){ B.stun -= dt; B.holding = false; }
  if (B.holding) B.glideT += dt; if (B.glideT > 0.5) tutDone('glide');
  const steps = Math.max(1, Math.ceil(dt / (1/120))), h = dt / steps;
  for (let s=0; s<steps; s++){
    B.prev.copy(B.pos);
    const dA = draftAcc(B.pos);
    if (B.holding){
      const tb = clamp(B.dragDX / 85, -1, 1) * 0.9; B.bank = damp(B.bank, tb, 6, h);
      B.yaw = clamp(B.yaw - B.bank * 1.75 * h, -1.4, 1.4);
      if (Math.abs(B.bank) > 0.45){ B.turnT += h; if (B.turnT > 0.5) tutDone('turn'); }
      let tp = clamp(GLIDE_BASE + B.dragDY * 0.0115, -0.85, 1.25);
      if (B.stall > 0){ tp = 1.0; B.stall -= h; }
      B.pitch = damp(B.pitch, tp, 6, h);
      B.speed += (G * Math.sin(B.pitch) - GLIDE_K * B.speed - Math.abs(B.bank) * 0.25 * B.speed * 0.3) * h;
      if (B.speed < 4.2 && B.pitch < 0.1 && B.stall <= 0){ B.stall = 0.45; sfx.stall(); }
      B.speed = clamp(B.speed, 1.5, 34);
      const cp = Math.cos(B.pitch); v.set(Math.sin(B.yaw)*cp*B.speed, -Math.sin(B.pitch)*B.speed, Math.cos(B.yaw)*cp*B.speed);
      B.wvy += dA * 0.55 * h; B.wvy *= 1 - 2.2*h;
      if (B.pitch > 0.95) B.divedDeep = true; if (B.divedDeep && B.pitch < -0.2) tutDone('dive');
    } else {
      v.y -= (G - dA) * h; v.x *= 1 - 0.1*h; v.z *= 1 - 0.1*h; if (v.y < -26) v.y = -26; B.wvy *= 1 - 3*h;
      const hs = Math.hypot(v.x, v.z); if (hs > 0.5) B.yaw = clamp(Math.atan2(v.x, v.z), -1.4, 1.4);
      B.bank = damp(B.bank, 0, 4, h);
      B.pitch = damp(B.pitch, clamp(Math.atan2(-v.y, Math.max(2, hs)), -0.9, 1.2), 10, h);
    }
    // lateral soft bound
    if (Math.abs(B.pos.x) > BOUND_X){ const push = (Math.abs(B.pos.x) - BOUND_X) * Math.sign(B.pos.x); v.x -= push * 4 * h; if (B.holding) B.yaw = clamp(B.yaw + Math.sign(B.pos.x) * 0.8 * h * Math.min(1, Math.abs(push)), -1.4, 1.4); }
    B.pos.x += v.x*h; B.pos.y += (v.y + B.wvy)*h; B.pos.z += v.z*h;
    if (B.pos.y > CEIL){ B.pos.y = CEIL; if (v.y > 0) v.y *= -0.2; if (B.holding) B.pitch = Math.max(B.pitch, 0.15); }
    const vyT = v.y + B.wvy;
    if (vyT < 1.5){ const hit = findLanding(B.prev, B.pos, B.airT < 0.3 ? B.fromBranch : null, B.holding && B.speed < 7); if (hit){ land(hit.b, hit.tt); return; } }
    const th = trunkHit(B.pos);
    if (th){ const sp = Math.hypot(v.x, vyT, v.z); if (sp > 18.5){ crash(); return; } bonk(th); }
    if (B.pos.y < FOOT * 0.7){ hitFloor(); return; }
  }
  B.wingT += dt * (B.flapAnim > 0 ? 26 : 15);
}
function updateBranches(dt){
  for (const t of trees) for (const b of t.branches){
    if (b.sway === 0 && b.swayV === 0) continue;
    b.swayV += (-b.sway * 90 - b.swayV * 6) * dt; b.sway += b.swayV * dt;
    if (Math.abs(b.sway) < 0.002 && Math.abs(b.swayV) < 0.004){ b.sway = 0; b.swayV = 0; }
    if (b.im && b.slot >= 0 && b.slot < IM[b.im].count){ setBranchMatrix(b); IM[b.im].instanceMatrix.needsUpdate = true; }
  }
}
function updateHazards(dt){
  const B = birdS, d = clamp(distM / 2600, 0, 1);
  for (const o of owls){
    o.flap += dt*9; const g = o.obj.g;
    if (o.state === 'sleep' || o.state === 'alert'){ branchPoint(o.b, o.tt, o.pos); o.pos.y = branchTop(o.b, o.tt); }
    if (o.state === 'sleep'){
      const dd = o.pos.distanceTo(B.pos);
      if (B.alive && dd < 13 && B.pos.z < o.pos.z + 2){ o.state = 'alert'; o.timer = 0.8; sfx.hoot(0); }
    } else if (o.state === 'alert'){
      o.timer -= dt;
      if (o.timer <= 0){ o.state = 'swoop'; o.timer = 1.4; const tgt = _v.copy(B.pos).addScaledVector(B.vel, 0.35); o.vel.copy(tgt).sub(o.pos).normalize().multiplyScalar(15 + 3*d); o.b.owl = null; sfx.swoosh(0.6); }
    } else if (o.state === 'swoop'){
      o.timer -= dt; o.pos.addScaledVector(o.vel, dt); _v.copy(o.pos); _v.y += 0.7;
      if (B.alive && _v.distanceTo(B.pos) < 1.0) caught('owl');
      if (o.timer <= 0) o.state = 'leave';
    } else { o.vel.y = damp(o.vel.y, 9, 2, dt); o.pos.addScaledVector(o.vel, dt); }
    g.position.copy(o.pos);
    const flying = o.state === 'swoop' || o.state === 'leave';
    if (flying){ g.rotation.set(0, Math.atan2(o.vel.x, o.vel.z), 0); } else { g.rotation.set(0, Math.PI + Math.atan2(B.pos.x - o.pos.x, -(B.pos.z - o.pos.z)) * 0.6, 0); }
    o.obj.wings.forEach(w => { w.visible = flying; w.rotation.set(0.1, 0, 0.2 + 0.9*Math.sin(o.flap)); });
    const awake = o.state !== 'sleep';
    o.obj.eyes.scale.y = awake ? 1 : 0.15; o.obj.eyeMat.color.setHex(awake ? 0xffb030 : 0x2a2014);
    o.obj.glow.material.opacity = o.state === 'alert' ? 0.6 + 0.4*Math.sin(time*30) : awake ? 0.5 : 0;
  }
  // hawk
  if (!hawk.on){
    if (state === 'play' && distM >= nextHawkM){ hawk = { on: true, phase: 'warn', t: 2.2, pos: new THREE.Vector3(), vel: new THREE.Vector3(), flap: 0, scr: 2.5, dur: 12 }; sfx.screech(0); }
  } else {
    hawk.flap += dt * (hawk.phase === 'chase' ? 9 : 7);
    const behind = _v.set(-Math.sin(B.yaw), 0, -Math.cos(B.yaw));
    if (hawk.phase === 'warn'){ hawk.t -= dt; hawk.pos.copy(B.pos).addScaledVector(behind, 34); hawk.pos.y += 4; if (hawk.t <= 0){ hawk.phase = 'chase'; hawk.t = hawk.dur; } }
    else if (hawk.phase === 'chase'){
      hawk.t -= dt; hawk.scr -= dt;
      const to = _v2.copy(B.pos).sub(hawk.pos); const dist = to.length();
      const sp = 10.2 + 2*d + (dist > 30 ? (dist - 30) * 0.8 : 0);
      hawk.vel.lerp(to.normalize().multiplyScalar(sp), Math.min(1, dt*3)); hawk.pos.addScaledVector(hawk.vel, dt);
      if (hawk.scr < 0){ hawk.scr = fr(2.5, 4); sfx.screech(0); }
      if (B.alive && hawk.pos.distanceTo(B.pos) < 1.15) caught('hawk');
      if (hawk.t <= 0 && B.alive){ hawk.phase = 'leave'; hawk.t = 3; bonus += 300; popup(B.pos, 'Escaped the hawk', '+300', '#ffd77a'); sfx.escape(); }
    } else { hawk.t -= dt; hawk.vel.y = damp(hawk.vel.y, 10, 2, dt); hawk.pos.addScaledVector(hawk.vel, dt); if (hawk.t <= 0){ hawk = { on: false }; nextHawkM = distM + rand(850, 1300); } }
    if (hawk.on && !B.alive && deathCause === 'hawk'){ hawk.vel.y = damp(hawk.vel.y, 6, 2, dt); }
  }
  hawkObj.visible = !!hawk.on && hawk.phase !== 'warn';
  if (hawkObj.visible){ hawkObj.position.copy(hawk.pos); hawkModel.rotation.set(clamp(-Math.atan2(hawk.vel.y, Math.hypot(hawk.vel.x, hawk.vel.z)), -0.6, 0.6), Math.atan2(hawk.vel.x, hawk.vel.z), 0);
    const f = Math.sin(hawk.flap); hawkWings.forEach(w => w.rotation.set(0, 0.15, 0.15 + 0.75*f)); }
  // collectibles
  for (const b of berries){
    if (b.b){ branchPoint(b.b, b.tt, b.pos); b.pos.y = b.b.y - b.b.sag*b.tt + b.b.sway*b.tt - 0.22; }
    if (!b.taken && B.alive && b.pos.distanceTo(B.pos) < 1.15){ b.taken = true; b.fade = 0.3; berryCount++; const pts = 25 * Math.max(1, combo); bonus += pts;
      popup(b.pos, '+' + pts, '', '#ffb3a6'); spark(b.pos, b.red ? 0xff8a7a : 0xa7b6ff, 9, 3); sfx.berry(); }
    if (b.taken) b.fade -= dt;
  }
  for (const f of feathers){
    if (!f.taken && B.alive && f.pos.distanceTo(B.pos) < 1.4){ f.taken = true; f.fade = 0.4; if (B.maxFlaps < 5) B.maxFlaps++; B.flaps = Math.min(B.maxFlaps, B.flaps + 1); bonus += 150;
      popup(f.pos, 'Golden feather', '+1 flap  +150', '#ffe39a'); spark(f.pos, 0xffe39a, 18, 4); sfx.feather(); }
    if (f.taken) f.fade -= dt;
    f.obj.g.position.set(f.pos.x, f.pos.y + Math.sin(time*2 + f.ph)*0.2, f.pos.z); f.obj.g.rotation.set(0.3, time*1.6 + f.ph, 0.3); const s = f.taken ? Math.max(0, f.fade/0.4) * 1.6 : 1; f.obj.g.scale.setScalar(Math.max(0.001, s));
  }
  let bi = 0; const qq = new THREE.Quaternion();
  for (const b of berries){
    if (bi >= IM.berry.instanceMatrix.count) break; if (Math.abs(b.pos.z - B.pos.z) > 120) continue;
    const s = b.taken ? Math.max(0, b.fade/0.3) * 1.5 : 1; if (s <= 0) continue;
    qq.setFromEuler(_e.set(0, time*0.8 + b.ph, 0)); _v.copy(b.pos); if (!b.b) _v.y += Math.sin(time*2.2 + b.ph)*0.15;
    _m.compose(_v, qq, _s.set(s*1.3, s*1.3, s*1.3)); IM.berry.setMatrixAt(bi, _m); IM.berry.setColorAt(bi, _c.setHex(b.red ? 0xb3242a : 0x3b4a8e)); bi++;
  }
  IM.berry.count = bi; IM.berry.instanceMatrix.needsUpdate = true; if (IM.berry.instanceColor) IM.berry.instanceColor.needsUpdate = true;
}

/* ---------- Visual updates ---------- */
const BSCALE = 1.35;
const WPv = [0, 0.1, -1.08, 0.3, 1.48, -0.12];
let tailFan = 0.15, tailPitch = -0.2, fanKick = 0, prevMode = 'perch', headYaw = 0, headYawT = 0, headTimer = 1, lastVisT = 0;
function updateBirdVisual(){
  const B = birdS; const dt = clamp(time - lastVisT, 0, 0.05); lastVisT = time;
  birdObj.visible = !B.hidden;
  birdObj.position.copy(B.pos);
  let pitch = B.pitch, bank = B.bank;
  if (!B.alive && deathCause === 'floor'){ pitch = -0.2; bank = 1.2; }
  birdModel.rotation.set(pitch, B.yaw, -bank);
  const sq = B.sq, k = BSCALE; birdModel.scale.set(k/Math.sqrt(Math.max(0.4, sq)), k*sq, k/Math.sqrt(Math.max(0.4, sq)));
  if (B.mode !== prevMode){ if (B.mode === 'perch') fanKick = 1; prevMode = B.mode; }
  fanKick = Math.max(0, fanKick - dt*1.5);
  const perch = B.mode === 'perch' || !B.alive;
  let p, fan, tp, bob = 0, flapping = false;
  if (perch){
    p = B.aiming ? [0, 0.3, -0.75 + 0.08*Math.sin(time*9), 0.45, 1.2, 0.05] : [0, 0.1, -1.08, 0.3, 1.48, -0.12];
    if (fanKick > 0.4){ const ph = (1 - fanKick) * 22; p = [0, 0.15, 0.4 + 0.4*Math.sin(ph), 0.9, 0.3, 0.05]; }
    fan = 0.1 + fanKick*0.95; tp = -0.22 + fanKick*0.55 + Math.sin(fanKick*9)*0.15*fanKick;
  } else {
    flapping = B.flapAnim > 0 || (B.holding && B.stall > 0) || (!B.holding && B.vel.y > 0);
    if (flapping){ const ph = B.wingT, s = Math.sin(ph), c = Math.cos(ph), up = Math.max(0, c);
      p = [-0.3*c, 0.06 + 0.3*up, 0.08 + 1.0*s, 1 - 0.45*up, 0.12 + 1.0*up, 0.3*Math.sin(ph - 0.8) - 0.12*up]; bob = -0.018*s; fan = 0.45; tp = 0.05;
    } else if (B.holding){
      if (B.pitch > 0.75){ const kk = clamp((B.pitch - 0.75)*2.4, 0, 1); p = [0, lerp(0.1, 0.6, kk), lerp(0.2, 0.08, kk), lerp(1, 0.5, kk), lerp(0.2, 1.1, kk), lerp(0.04, 0.12, kk)]; fan = lerp(0.35, 0.03, kk); tp = 0.1; }
      else { const brake = B.pitch < -0.2 ? 1 : 0; p = [0.08*brake, 0.04, 0.3 + 0.025*Math.sin(time*5) + 0.12*brake, 1, 0.1 + 0.05*Math.sin(time*3.1), 0.04]; fan = 0.4 + 0.55*brake; tp = 0.05 + 0.3*brake; }
    } else { const ph = B.wingT*1.1; p = [0, 0.3, 0.05 + 0.45*Math.sin(ph), 0.9, 0.35 + 0.3*Math.max(0, Math.cos(ph)), 0.05]; fan = 0.3; tp = 0.0; }
  }
  const rate = flapping ? 1 : 1 - Math.exp(-dt * 12);
  for (let i=0;i<6;i++) WPv[i] += (p[i] - WPv[i]) * rate;
  for (const w of robinWings){ w.shoulder.rotation.set(WPv[0], WPv[1], WPv[2]); w.arm.scale.x = WPv[3]; w.wrist.position.x = ARM*WPv[3]; w.wrist.rotation.set(0, WPv[4], WPv[5]); }
  tailFan = damp(tailFan, fan, 9, dt); tailPitch = damp(tailPitch, tp, 9, dt);
  for (let i=0;i<12;i++){ const u = i/11 - 0.5; _qa.setFromEuler(_e.set(0, u*2*tailFan, 0)); _m.compose(_v.set(u*0.035, 0.0015*Math.abs(6 - i), 0), _qa, _s.set(1, 1, 1)); tailFeathers.setMatrixAt(i, _m); }
  tailFeathers.instanceMatrix.needsUpdate = true; birdTail.rotation.x = tailPitch;
  // head: stabilised against body pitch/roll, glances around while perched
  if (perch && B.alive){ headTimer -= dt; if (headTimer <= 0){ headTimer = 0.6 + Math.random()*1.8; headYawT = B.aiming ? 0 : (Math.random() - 0.5)*1.3; } } else headYawT = 0;
  headYaw = damp(headYaw, headYawT, 14, dt);
  birdHead.rotation.set(clamp(-pitch*0.8, -0.9, 0.9) + (perch ? 0.05*Math.sin(time*1.3) : 0), headYaw, clamp(bank*0.65, -0.8, 0.8));
  birdModel.position.y = perch ? -(1 - sq) * 0.12 + Math.sin(time*2.2)*0.004 : bob;
  legs.visible = perch;
  const hr = B.hurt > 0 ? B.hurt*0.6 : 0; for (const m of BIRD_MATS) m.emissive.setRGB(hr, 0, 0);
}
const _aimDots = [];
let aimHit = null;
function updateMarkers(){
  const B = birdS; let ri = 0;
  const perched = state === 'play' && B.mode === 'perch';
  const gliding = state === 'play' && B.mode === 'air';
  if (perched || gliding){
    const fy = B.mode === 'perch' ? B.aimYaw : B.yaw, fx = Math.sin(fy), fz = Math.cos(fy);
    for (const t of trees){ if (t.bg || t.z < B.pos.z - 2 || t.z > B.pos.z + 34) continue;
      for (const b of t.branches){ if (b.kind !== 'normal' || b === B.branch || ri >= 16) continue;
        const p = branchPoint(b, 0.62, _v); const dx = p.x - B.pos.x, dz = p.z - B.pos.z, dist = Math.hypot(dx, dz); if (dist < 2.5) continue;
        if ((dx*fx + dz*fz) / dist < 0.35) continue; const dy = p.y - B.pos.y; if (dy > 6.5 + B.flaps*1.5 || dy < -16) continue;
        p.y = branchTop(b, 0.62) + 0.03; const pul = 1 + 0.08*Math.sin(time*4 + b.id); _m.compose(p, _q.identity(), _s.set(pul, 1, pul)); IM.ring.setMatrixAt(ri++, _m); } }
  }
  IM.ring.count = ri; IM.ring.instanceMatrix.needsUpdate = true;
  MAT.ring.opacity = perched ? 0.75 : 0.4;
  let di = 0; targetRing.visible = false;
  if (perched && B.aiming && B.aimPow > 0.05){
    _aimDots.length = 0; aimHit = predictPath(B.aimYaw, B.aimPow, _aimDots);
    for (let i=0;i<_aimDots.length/3 && di < 30;i++){ const k = i / (_aimDots.length/3); _m.compose(_v.set(_aimDots[i*3], _aimDots[i*3+1], _aimDots[i*3+2]), _q.identity(), _s.setScalar(1.25 - k*0.6)); IM.dot.setMatrixAt(di++, _m); }
    if (aimHit){ targetRing.visible = true; targetRing.position.copy(aimHit.pos); targetRing.scale.setScalar(1 + 0.1*Math.sin(time*8)); targetRing.material.color.setHex(aimHit.b.kind === 'thorn' ? 0xff7860 : 0xffe9a8); }
  }
  IM.dot.count = di; IM.dot.instanceMatrix.needsUpdate = true;
}
function applyPalette(){
  const z = Math.max(0, camera.position.z);
  const f = z / ZONE_M, zi = Math.floor(f) % 4, loc = f - Math.floor(f);
  const t = loc > 0.86 ? smooth((loc - 0.86) / 0.14) : 0;
  const key = zi + ':' + t.toFixed(2);
  PAL.zi = t > 0.5 ? (zi + 1) % 4 : zi;
  if (key === PAL.key) return; PAL.key = key;
  const A = ZONES[zi], Bz = ZONES[(zi+1)%4];
  const mix = k => _c.copy(A['c_'+k]).lerp(Bz['c_'+k], t);
  PAL.night = (A.night ? 1 - t : 0) + (Bz.night ? t : 0);
  scene.fog.color.copy(mix('fog')); scene.background.copy(scene.fog.color);
  scene.fog.density = lerp(A.fogD, Bz.fogD, t);
  skyU.uHor.value.copy(scene.fog.color).convertLinearToSRGB();
  skyU.uTop.value.copy(mix('skyT')).convertLinearToSRGB();
  skyU.uSun.value.copy(mix('sun')).convertLinearToSRGB().multiplyScalar(1 - PAL.night*0.55);
  SUN_DIR.set(A.sunDir[0], A.sunDir[1], A.sunDir[2]).normalize().lerp(_v.set(Bz.sunDir[0], Bz.sunDir[1], Bz.sunDir[2]).normalize(), t).normalize(); skyU.uSunDir.value.copy(SUN_DIR);
  skyU.uNight.value = PAL.night;
  hemi.color.copy(mix('hemiS')); hemi.groundColor.copy(mix('hemiG')); hemi.intensity = lerp(A.hemiI, Bz.hemiI, t);
  sunL.color.copy(mix('sun')); sunL.intensity = lerp(A.sunI, Bz.sunI, t);
  MAT.ground.color.copy(mix('groundT')); MAT.shaft.color.copy(mix('shaft')); sunSprite.material.color.copy(mix('sun'));
  PAL.shaftA = lerp(A.shaftA, Bz.shaftA, t);
  moon.material.opacity = PAL.night; sunSprite.material.opacity = 0.5 * (1 - PAL.night);
}
function updateCamera(dt, snap){
  const B = birdS; const k = snap || !camS.init ? 1 : 0;
  const spd = B.mode === 'air' ? B.vel.length() : 0;
  let desired, look;
  if (state === 'title'){
    const a = B.yaw + 1.65 + Math.sin(time*0.25)*0.3;
    desired = _v.set(B.pos.x + Math.sin(a)*3.0, B.pos.y + 0.75, B.pos.z + Math.cos(a)*3.0);
    look = _v2.set(B.pos.x, B.pos.y + 0.45, B.pos.z);
    camS.fov = 50;
  } else {
    const perch = B.mode === 'perch';
    const yawT = perch ? (B.aiming ? B.aimYaw : B.perchYaw) : B.yaw;
    camS.yaw = k ? yawT : damp(camS.yaw, yawT, perch ? 5 : 3.2, dt);
    let back = perch ? 3.9 : 4.4, up = perch ? 1.35 : 1.25;
    if (!perch){ up += clamp(B.pitch, -0.5, 1.2) * 0.85; back += clamp((spd - 10)/20, 0, 1) * 1.2; }
    if (hawk.on && hawk.phase === 'chase'){ back += 2; up += 0.8; }
    if (!B.alive){ back = 6; up = 2.5; }
    desired = _v.set(B.pos.x - Math.sin(camS.yaw)*back, B.pos.y + up, B.pos.z - Math.cos(camS.yaw)*back);
    desired.y = Math.max(desired.y, 0.8);
    const ahead = perch ? 11 : 7;
    look = _v2.set(B.pos.x + Math.sin(camS.yaw)*ahead, B.pos.y + (perch ? 0.4 : -clamp(B.pitch, -0.6, 1.2)*1.7 + 0.2), B.pos.z + Math.cos(camS.yaw)*ahead);
    camS.fov = 62 + clamp((spd - 11) / 15, 0, 1) * 20;
  }
  if (k){ camera.position.copy(desired); camS.look.copy(look); camS.init = true; }
  else { const kp = state === 'title' ? 3 : 5.5; camera.position.x = damp(camera.position.x, desired.x, kp, dt); camera.position.y = damp(camera.position.y, desired.y, kp, dt); camera.position.z = damp(camera.position.z, desired.z, kp, dt); camS.look.lerp(look, 1 - Math.exp(-8*dt)); }
  camera.lookAt(camS.look);
  camS.roll = damp(camS.roll, B.mode === 'air' ? -B.bank * 0.35 : 0, 4, dt);
  camera.rotateZ(camS.roll);
  if (shake > 0){ camera.position.x += fr(-1,1)*shake*0.3; camera.position.y += fr(-1,1)*shake*0.3; }
  if (Math.abs(camera.fov - camS.fov) > 0.05){ camera.fov = damp(camera.fov, camS.fov, 4, dt) ; if (k) camera.fov = camS.fov; camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
  sunSprite.position.copy(camera.position).addScaledVector(SUN_DIR, 150);
  moon.position.copy(camera.position).addScaledVector(SUN_DIR, 150); moon.lookAt(camera.position);
  { const fx = Math.sin(camS.yaw || 0), fz = Math.cos(camS.yaw || 0), cx = Math.round((B.pos.x + fx*11) * 2) / 2, cz = Math.round((B.pos.z + fz*11) * 2) / 2;
    sunL.target.position.set(cx, 12, cz); sunL.position.set(cx, 12, cz).addScaledVector(SUN_DIR, 110); }
  ground.position.set(Math.round(camera.position.x / 8) * 8, 0, Math.round(camera.position.z / 8) * 8);
}
/* ---------- Audio ---------- */
const AU = { c:null, m:null, noise:null, windG:null, windF:null, amb:null, nextChirp:2 };
function audioInit(){
  if (AU.c){ if (AU.c.state !== 'running') AU.c.resume().catch(()=>{}); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  try {
    const c = new C(); AU.c = c;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    AU.m = c.createGain(); AU.m.gain.value = soundOn ? 0.85 : 0; AU.m.connect(comp);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i=0;i<len;i++){ const w = Math.random()*2 - 1; d[i] = w; }
    AU.noise = buf;
    // brown-ish noise for rustle
    const bbuf = c.createBuffer(1, len, c.sampleRate), bd = bbuf.getChannelData(0);
    for (let i=0;i<len;i++){ last = (last + 0.02*(Math.random()*2-1)) / 1.02; bd[i] = last * 3.5; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    AU.windF = c.createBiquadFilter(); AU.windF.type = 'bandpass'; AU.windF.frequency.value = 400; AU.windF.Q.value = 0.8;
    AU.windG = c.createGain(); AU.windG.gain.value = 0;
    src.connect(AU.windF); AU.windF.connect(AU.windG); AU.windG.connect(AU.m); src.start();
    const src2 = c.createBufferSource(); src2.buffer = bbuf; src2.loop = true;
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 900;
    AU.amb = c.createGain(); AU.amb.gain.value = 0.22;
    src2.connect(f2); f2.connect(AU.amb); AU.amb.connect(AU.m); src2.start();
    const o = c.createBufferSource(); o.buffer = c.createBuffer(1, 1, 22050); o.connect(c.destination); o.start(0);
  } catch(e){ AU.c = null; }
}
function env(g, t, a, peak, d){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function out(node, pan){
  if (pan && AU.c.createStereoPanner){ const p = AU.c.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(AU.m); }
  else node.connect(AU.m);
}
function tone(type, f0, f1, dur, vol, delay, pan){
  if (!AU.c || !soundOn) return; const c = AU.c, t = c.currentTime + (delay || 0);
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); env(g, t, Math.min(0.012, dur*0.2), vol, dur); o.connect(g); out(g, pan); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, type, f0, f1, q, delay, pan){
  if (!AU.c || !soundOn) return; const c = AU.c, t = c.currentTime + (delay || 0);
  const s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8;
  f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); env(g, t, Math.min(0.01, dur*0.2), vol, dur); s.connect(f); f.connect(g); out(g, pan);
  s.start(t, Math.random()*1.5); s.stop(t + dur + 0.05);
}
const PENTA = [0,2,4,7,9,12,14,16,19,21,24,26,28];
const sfx = {
  flap(){ noise(0.11, 0.5, 'lowpass', 1600, 260, 0.9); noise(0.09, 0.3, 'lowpass', 1200, 240, 0.9, 0.06); tone('sine', 150, 80, 0.08, 0.12); },
  launch(){ noise(0.12, 0.5, 'lowpass', 1800, 300, 0.9); noise(0.1, 0.32, 'lowpass', 1300, 260, 0.9, 0.07); tone('triangle', 260, 120, 0.1, 0.1); noise(0.05, 0.25, 'highpass', 3500, 2500, 0.7); },
  land(q){ noise(0.045, 0.35, 'highpass', 3200, 2600, 0.7); tone('triangle', q === 'hard' ? 160 : 240, 110, 0.09, 0.22); noise(0.18, 0.18, 'bandpass', 2400, 900, 1.2, 0.02); },
  perfect(n){ const base = 659.25; const i = Math.min(n - 1, PENTA.length - 2); const f = base * Math.pow(2, PENTA[i]/12), f2 = base * Math.pow(2, PENTA[i+1]/12) * 2;
    tone('triangle', f, 0, 0.35, 0.2); tone('sine', f*2, 0, 0.4, 0.09, 0.06); tone('sine', f2, 0, 0.3, 0.05, 0.12); },
  hard(){ tone('sine', 130, 48, 0.28, 0.5); noise(0.2, 0.35, 'lowpass', 900, 180, 0.8); },
  berry(){ tone('sine', 880, 1560, 0.07, 0.2); tone('triangle', 1760, 0, 0.09, 0.07, 0.05); },
  feather(){ [1318, 1661, 1975, 2637].forEach((f,i) => tone('sine', f, 0, 0.22, 0.09, i*0.06)); },
  ouch(){ tone('sawtooth', 520, 170, 0.18, 0.1); noise(0.12, 0.3, 'bandpass', 1500, 600, 2); },
  noflap(){ tone('square', 210, 150, 0.07, 0.05); },
  stall(){ tone('sine', 520, 300, 0.2, 0.06); },
  swoosh(v){ noise(0.38, 0.32*(v||1), 'bandpass', 500, 2200, 1.6); },
  hoot(loud){ const v = loud ? 0.3 : 0.18; tone('sine', 392, 360, 0.3, v, 0, -0.2); tone('sine', 370, 330, 0.42, v, 0.42, -0.2); tone('sine', 784, 0, 0.25, v*0.12, 0, -0.2); },
  screech(loud){ if (!AU.c || !soundOn) return; const c = AU.c, t = c.currentTime;
    for (const det of [0, 9]){ const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(2700 + det*20, t); o.frequency.exponentialRampToValueAtTime(1500 + det*10, t + 0.75);
      const lfo = c.createOscillator(); lfo.frequency.value = 38; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2.5;
      const g = c.createGain(); env(g, t, 0.04, loud ? 0.2 : 0.11, 0.72); o.connect(f); f.connect(g); out(g, -0.4); o.start(t); lfo.start(t); o.stop(t + 0.85); lfo.stop(t + 0.85); } },
  gameover(){ [523, 440, 349, 294].forEach((f,i) => tone('triangle', f, 0, 0.32, 0.13, 0.25 + i*0.17)); },
  escape(){ [523, 659, 784, 1046].forEach((f,i) => tone('triangle', f, 0, 0.25, 0.12, i*0.08)); },
  chime(){ tone('sine', 1046, 0, 0.6, 0.06); tone('sine', 1568, 0, 0.6, 0.04, 0.12); },
  ui(){ tone('triangle', 900, 1200, 0.05, 0.07); },
};
function chirp(){
  if (!AU.c || !soundOn) return;
  const pan = fr(-0.8, 0.8), v = fr(0.025, 0.06), kind = (Math.random()*4)|0;
  let t = 0;
  if (kind === 0){ const n = 3 + (Math.random()*4|0); const f = fr(3200, 4600); for (let i=0;i<n;i++){ tone('sine', f*(1 - i*0.04), f*0.82, 0.07, v, t, pan); t += 0.11; } }
  else if (kind === 1){ const f = fr(2600, 3400); for (let i=0;i<10;i++){ tone('sine', f, f*1.15, 0.035, v*0.8, t, pan); t += 0.045; } }
  else if (kind === 2){ tone('sine', fr(2000,2400), fr(3200,3600), 0.18, v, 0, pan); tone('sine', fr(3000,3400), fr(2200,2500), 0.22, v, 0.26, pan); }
  else { const f = fr(4200,5200); tone('sine', f, f*0.6, 0.12, v*0.8, 0, pan); tone('sine', f*0.9, f*0.55, 0.12, v*0.8, 0.16, pan); tone('sine', f*1.05, f*0.7, 0.2, v*0.8, 0.32, pan); }
}
function updateAudio(dt){
  if (!AU.c) return;
  const now = AU.c.currentTime;
  const sp = (state === 'play' && birdS.mode === 'air') ? birdS.vel.length() * 32 : 0;
  const wv = soundOn ? clamp((sp - 220) / 800, 0, 1) * 0.55 : 0;
  AU.windG.gain.setTargetAtTime(wv, now, 0.12);
  AU.windF.frequency.setTargetAtTime(300 + sp*1.5, now, 0.1);
  AU.nextChirp -= dt;
  if (AU.nextChirp < 0 && state !== 'paused'){
    AU.nextChirp = fr(2.2, 5.5);
    if (PAL.night > 0.5){ if (Math.random() < 0.3) sfx.hoot(0); else if (Math.random() < 0.5){ for (let i=0;i<6;i++) tone('sine', 4400, 4300, 0.03, 0.02, i*0.06, 0.6); } }
    else chirp();
  }
}
function setSound(on){
  soundOn = on; store.set('fw_sound', on);
  if (AU.m) AU.m.gain.setTargetAtTime(on ? 0.85 : 0, AU.c.currentTime, 0.05);
  $('soundBtn').innerHTML = (on ? ICON.soundOn : ICON.soundOff) + '<span>' + (on ? 'Sound on' : 'Sound off') + '</span>'; $('soundBtn2').textContent = on ? 'Sound on' : 'Sound off';
}

/* ---------- UI ---------- */
const ICON = {
  soundOn: '<svg viewBox="0 0 20 20"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="#f4ecd8"/><path d="M13 7c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3M15 4.8c1.7 1.4 2.6 3.2 2.6 5.2s-.9 3.8-2.6 5.2" fill="none" stroke="#f4ecd8" stroke-width="1.5" stroke-linecap="round"/></svg>',
  soundOff:'<svg viewBox="0 0 20 20"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="#f4ecd8"/><path d="M13.5 7.5l5 5m0-5l-5 5" stroke="#f4ecd8" stroke-width="1.5" stroke-linecap="round"/></svg>',
  feather: '<svg viewBox="0 0 20 26"><defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".55" stop-color="#e2b04a"/><stop offset="1" stop-color="#9c6418"/></linearGradient></defs><g transform="rotate(18 10 13)"><path d="M10 25C14 19 15.5 9 10 1 4.8 9 6 19 10 25z" fill="url(#fg)" stroke="#5b3a10" stroke-width=".7"/><path d="M10 24V3" stroke="#fff6dc" stroke-width=".9"/><path d="M10 9l3.2-2.6M10 13l3.8-3M10 17l3.4-2.6M10 11l-3-2.4M10 15l-3.4-2.6M10 19l-3-2.2" stroke="#8a5a14" stroke-width=".55" opacity=".7"/></g></svg>',
};
const CAUSE = {
  floor: { text:'Fell to the forest floor', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2f4a35"/><path d="M8 46c8-3 14-2 24-2s17-1 24 2v8H8z" fill="#5b4a32"/><path d="M14 46c2-6 5-9 8-10M22 46c0-5 2-8 4-9M44 46c-1-5-4-8-7-9" stroke="#8fbf5a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M32 12v18m0 0l-6-6m6 6l6-6" stroke="#f4ecd8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  owl:   { text:'Snatched by an owl', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2b3550"/><ellipse cx="32" cy="38" rx="14" ry="16" fill="#6a5845"/><ellipse cx="32" cy="42" rx="9" ry="10" fill="#d7c6a6"/><ellipse cx="32" cy="24" rx="13" ry="10" fill="#6a5845"/><path d="M20 20l-2-10 8 7M44 20l2-10-8 7" fill="#6a5845"/><circle cx="26.5" cy="24" r="5" fill="#cdb894"/><circle cx="37.5" cy="24" r="5" fill="#cdb894"/><circle cx="26.5" cy="24" r="3.4" fill="#f2a51c"/><circle cx="37.5" cy="24" r="3.4" fill="#f2a51c"/><circle cx="26.5" cy="24" r="1.7" fill="#120a04"/><circle cx="37.5" cy="24" r="1.7" fill="#120a04"/><path d="M30.5 28h3L32 32z" fill="#3a2c1e"/></svg>' },
  trunk: { text:'Crashed into a trunk', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#5a3f2a"/><rect x="24" y="6" width="16" height="52" rx="3" fill="#8a6a4c"/><path d="M28 10v44M35 8v46" stroke="#5a4030" stroke-width="1.6"/><path d="M10 26l8 4-8 4M54 24l-7 5 7 5" stroke="#f4ecd8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 18l4 5M49 16l-4 5M15 42l4-4M49 44l-4-4" stroke="#e2b04a" stroke-width="2.4" stroke-linecap="round"/></svg>' },
  hawk:  { text:'Caught by the hawk', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#7a2a18"/><path d="M32 34c-5-7-13-11-26-11 6 3 9 6 12 10 5 0 8 2 10 5l-3 9 7-4 7 4-3-9c2-3 5-5 10-5 3-4 6-7 12-10-13 0-21 4-26 11z" fill="#f4ecd8"/><circle cx="32" cy="29" r="3.6" fill="#f4ecd8"/><path d="M32 28.5l4 1.8-4 1.3z" fill="#e2b04a"/></svg>' },
};
const HINT_ICO = {
  drag: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="12" cy="22" r="5" fill="#f4ecd8"/><path d="M14 20l9-9" stroke="#f4ecd8" stroke-width="2" stroke-dasharray="2 2.5"/><path d="M19 9.5h5v5" fill="none" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/>',
  hold: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="19" r="5.5" fill="#f4ecd8"/><circle cx="17" cy="19" r="9.5" fill="none" stroke="#e2b04a" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M6 11c4-3 7-3 11 0 4-3 7-3 11 0" fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linecap="round"/>',
  dive: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><path d="M9 8c2 8 5 13 9 15s7 0 9-4" fill="none" stroke="#f4ecd8" stroke-width="2.2" stroke-linecap="round"/><path d="M24 15l3.5 4-5 1" fill="none" stroke="#e2b04a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  tap:  '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="20" r="4.5" fill="#f4ecd8"/><path d="M17 4v6M9 8l3 4M25 8l-3 4" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/>',
  turn: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="19" r="4.5" fill="#f4ecd8"/><path d="M8 19h-3m3 0l2.5-2.5M8 19l2.5 2.5M26 19h3m-3 0l-2.5-2.5M26 19l-2.5 2.5" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/><path d="M9 10c5-4 11-4 16 0" fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linecap="round"/>',
  star: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><path d="M17 7l2.6 5.6 6 .7-4.5 4.1 1.2 6L17 20.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="#e2b04a"/>',
};
let hintKey = '', hintFlash = 0;
function showHint(key, ico, text){
  if (hintKey === key) return; hintKey = key;
  $('ghost').classList.toggle('hidden', key !== 'launch');
  if (!key){ $('hint').classList.add('hidden'); return; }
  $('hintIco').innerHTML = HINT_ICO[ico]; $('hintText').textContent = text;
  const el = $('hint'); el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden');
}
function tutDone(k){ if (!TUT[k]){ TUT[k] = 1; store.set('fw2_tut', TUT); } }
function updateHints(dt){
  if (hintFlash > 0) hintFlash -= dt;
  const B = birdS;
  if (state !== 'play') return showHint('', '', '');
  if (B.mode === 'perch'){
    if (!TUT.launch) return showHint('launch', 'drag', 'Drag down to aim, slide sideways to turn, release to leap');
    if (hintFlash > 0 && !TUT.perfect) return showHint('perfect', 'star', 'Glide slowly onto a glowing perch for a Perfect');
    return showHint('', '', '');
  }
  if (!TUT.glide && B.airT > 0.25 && !B.holding) return showHint('glide', 'hold', 'Hold anywhere to glide');
  if (TUT.glide && !TUT.turn && B.holding) return showHint('turn', 'turn', 'Keep holding and slide left or right to steer');
  if (TUT.turn && !TUT.dive && B.holding) return showHint('dive', 'dive', 'Slide down to dive, then up to swoop');
  if (!TUT.flap && TUT.glide && !B.holding && B.flaps > 0 && B.pos.y < B.launchY - 2 && B.vel.y < 0) return showHint('flap', 'tap', 'Tap to flap. You get ' + B.maxFlaps + ' per flight');
  showHint('', '', '');
}
const hud = { score: -1, dist: -1, flaps: -1, max: -1, combo: -1 };
function buildFlaps(){ let s = ''; for (let i=0;i<5;i++) s += ICON.feather.replace('id="fg"', 'id="fg'+i+'"').replace('url(#fg)', 'url(#fg'+i+')'); $('flaps').innerHTML = s; }
function comboBump(){ const el = $('combo'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function updateHUD(){
  const B = birdS;
  score = Math.floor(distM) + bonus;
  if (hud.score !== score){ hud.score = score; $('score').textContent = score.toLocaleString('en-US'); }
  const dm = Math.floor(distM); if (hud.dist !== dm){ hud.dist = dm; $('distv').textContent = dm.toLocaleString('en-US'); }
  if (hud.flaps !== B.flaps || hud.max !== B.maxFlaps){
    const kids = $('flaps').children;
    for (let i=0;i<5;i++){ const k = kids[i]; k.style.display = i < B.maxFlaps ? '' : 'none'; k.classList.toggle('off', i >= B.flaps);
      if (i < B.flaps && hud.flaps >= 0 && i >= hud.flaps){ k.classList.remove('pop'); void k.getBoundingClientRect(); k.classList.add('pop'); } }
    hud.flaps = B.flaps; hud.max = B.maxFlaps;
  }
  if (hud.combo !== combo){ hud.combo = combo; $('combo').classList.toggle('hidden', combo < 2); $('combov').textContent = combo; }
  let showHawk = false;
  if (hawk.on && (hawk.phase === 'warn' || hawk.phase === 'chase')){ _v.copy(hawk.pos).project(camera); showHawk = hawk.phase === 'warn' || _v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1; }
  $('hawkWarn').classList.toggle('hidden', !showHawk || state !== 'play');
  if (showHawk) $('hawkBar').style.width = (hawk.phase === 'chase' ? hawk.t / hawk.dur * 100 : 100) + '%';
  const danger = state === 'play' && B.mode === 'air' && B.pos.y < 5 && B.vel.y < 0 ? clamp((5 - B.pos.y) / 4, 0, 1) : 0;
  const hk = hawk.on && hawk.phase === 'chase' ? clamp(1 - (hawk.pos.distanceTo(B.pos) - 2) / 14, 0, 1) : 0;
  $('danger').style.opacity = (Math.max(danger, hk) * (0.75 + 0.25*Math.sin(time*10))).toFixed(3);
}
let bannerT = 0;
function showBanner(zi, m){ $('bannerZ').textContent = ZONES[zi].name; $('bannerS').textContent = ZONES[zi].time + '  /  ' + m.toLocaleString('en-US') + ' m'; $('banner').classList.add('show'); bannerT = 3.2; sfx.chime(); }
function setScreen(name){
  $('title').classList.toggle('hidden', name !== 'title'); $('pause').classList.toggle('hidden', name !== 'pause'); $('over').classList.toggle('hidden', name !== 'over');
  $('hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
  if (name !== 'play'){ $('combo').classList.add('hidden'); $('hawkWarn').classList.add('hidden'); $('danger').style.opacity = 0; } else hud.combo = -1;
}
function startRun(m){ resetWorld(m || 0); state = 'play'; flash = 0.25; hud.score = hud.dist = hud.flaps = hud.max = hud.combo = -1; setScreen('play'); updateCamera(0, true); showBanner(zoneAtZ(m || 0), m || 0); }
function toTitle(){ resetWorld(0); state = 'title'; setScreen('title'); $('titleBest').innerHTML = 'Best<b>' + best.toLocaleString('en-US') + '</b>'; camS.init = false; }
function pauseGame(){ if (state !== 'play') return; state = 'paused'; setScreen('pause'); ptr = null; birdS.aiming = false; birdS.holding = false; }
function resumeGame(){ if (state !== 'paused') return; state = 'play'; setScreen('play'); last = performance.now(); }
function showOver(){
  state = 'over'; score = Math.floor(distM) + bonus;
  const nb = score > best; if (nb){ best = score; store.set('fw2_best', best); }
  const C = CAUSE[deathCause] || CAUSE.floor;
  $('causeIco').innerHTML = C.ico.replace(/^<svg[^>]*>|<\/svg>$/g, ''); $('causeText').textContent = C.text;
  $('overScore').textContent = score.toLocaleString('en-US'); $('overBest').textContent = best.toLocaleString('en-US'); $('newBest').classList.toggle('hidden', !nb);
  $('stDist').textContent = Math.floor(distM).toLocaleString('en-US'); $('stPerf').textContent = perfects; $('stBerry').textContent = berryCount; $('stCombo').textContent = bestCombo;
  setScreen('over');
}

/* ---------- Input ---------- */
function onDown(e){
  e.preventDefault(); audioInit(); if (ptr) return;
  ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, consumed: false, dived: false };
  const B = birdS;
  if (state !== 'play'){ ptr.consumed = true; return; }
  if (B.mode === 'perch'){ if (B.stun > 0.15){ ptr.consumed = true; return; } B.aiming = true; B.aimPow = 0; B.aimBase = B.perchYaw; }
  else if (B.alive && B.stun <= 0){
    B.holding = true; B.dragDX = 0; B.dragDY = 0;
    const v = B.vel, hs = Math.hypot(v.x, v.z); B.speed = Math.max(4.5, v.length());
    B.pitch = clamp(Math.atan2(-v.y, Math.max(1.5, hs)), -0.85, 1.25); if (hs > 0.5) B.yaw = clamp(Math.atan2(v.x, v.z), -1.4, 1.4); B.wvy = 0;
  }
}
function onMove(e){
  if (!ptr || e.pointerId !== ptr.id) return; e.preventDefault();
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = Math.max(ptr.moved, Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy));
  const B = birdS; if (state !== 'play' || ptr.consumed) return;
  if (B.mode === 'perch' && B.aiming){
    const down = ptr.y - ptr.sy, side = ptr.x - ptr.sx;
    B.aimPow = clamp((down - 10) / 150, 0, 1);
    B.aimYaw = clamp(B.aimBase - side * 0.0065, -1.3, 1.3);
  } else if (B.mode === 'air' && B.holding){
    B.dragDX = ptr.x - ptr.sx; B.dragDY = ptr.y - ptr.sy;
    if (!ptr.dived && B.dragDY > 45){ ptr.dived = true; sfx.swoosh(1); } if (ptr.dived && B.dragDY < 12) ptr.dived = false;
  }
}
function onUp(e){
  if (!ptr || e.pointerId !== ptr.id) return; e.preventDefault();
  const p = ptr; ptr = null; const B = birdS;
  if (state !== 'play' || p.consumed){ B.aiming = false; B.holding = false; return; }
  if (B.mode === 'perch' && B.aiming){
    B.aiming = false;
    const quick = performance.now() - p.t0 < 260 && p.moved < 14;
    if (quick) launch(0.42); else if (B.aimPow > 0.02) launch(Math.max(0.12, B.aimPow)); else B.aimYaw = B.perchYaw;
  } else if (B.mode === 'air'){
    B.holding = false;
    if (performance.now() - p.t0 < 230 && p.moved < 18) flap();
  }
}
canvas.addEventListener('pointerdown', onDown, { passive: false });
window.addEventListener('pointermove', onMove, { passive: false });
window.addEventListener('pointerup', onUp, { passive: false });
window.addEventListener('pointercancel', onUp, { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
window.addEventListener('keydown', e => { if (e.code === 'Space' && state === 'play' && birdS.mode === 'air') flap(); if (e.code === 'Escape' || e.code === 'KeyP'){ state === 'play' ? pauseGame() : resumeGame(); } });
function btn(id, fn){ $(id).addEventListener('click', e => { e.preventDefault(); audioInit(); sfx.ui(); fn(); }); }
btn('playBtn', () => startRun(0)); btn('soundBtn', () => setSound(!soundOn)); btn('soundBtn2', () => setSound(!soundOn));
btn('pauseBtn', pauseGame); btn('resumeBtn', resumeGame); btn('restartBtn', () => startRun(0)); btn('quitBtn', toTitle); btn('againBtn', () => startRun(0)); btn('titleBtn', toTitle);
document.addEventListener('visibilitychange', () => { if (document.hidden){ pauseGame(); if (AU.c) AU.c.suspend().catch(()=>{}); } else if (AU.c && soundOn) AU.c.resume().catch(()=>{}); });

/* ---------- Loop ---------- */
let last = performance.now(), fps = 60, fpsN = 0, fpsT = 0;
function frame(now){
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsN++; fpsT += dt; if (fpsT >= 1){ fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  if (state === 'paused'){ renderer.render(scene, camera); return; }
  time += dt; WIND.value = time;
  updateQuality();
  if (hitStop > 0){ hitStop -= dt; dt *= 0.08; }
  if (slowmo < 1) slowmo = Math.min(1, slowmo + dt*0.9);
  const gdt = dt * slowmo;
  if (state === 'play' || state === 'dying'){
    updateBird(gdt); updateHazards(gdt);
    distM = Math.max(distM, birdS.pos.z);
    const zn = Math.floor(distM / ZONE_M); if (zn > lastZone && state === 'play'){ lastZone = zn; showBanner(zn % 4, zn * ZONE_M); }
    if (state === 'dying'){ dieT += dt; if (dieT > 1.4) showOver(); }
  } else { updateBird(gdt); updateHazards(gdt * 0); }
  while (genZ < birdS.pos.z + 170) genRow();
  cullWorld(birdS.pos.z - 30);
  if (dirty) rebuild();
  updateBranches(gdt);
  if (shake > 0) shake = Math.max(0, shake - dt*1.6);
  updateBirdVisual();
  updateCamera(dt);
  applyPalette();
  updateMarkers();
  updateFx(gdt);
  updateSpeedLines(dt, state === 'play' && birdS.mode === 'air' ? birdS.vel.length() : 0);
  updatePopups(dt);
  if (bannerT > 0){ bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  if (flash > 0){ flash = Math.max(0, flash - dt*1.5); }
  $('flash').style.opacity = flash.toFixed(3);
  if (state === 'play' || state === 'dying') updateHUD();
  updateHints(dt); updateAudio(dt);
  renderer.render(scene, camera);
}
function setQuality(l){
  l = clamp(l, 0, 2); QUALITY.level = l;
  renderer.setPixelRatio(Math.min(QUALITY.pr[l], DPR)); resize();
  const sh = l >= 1; if (sh !== renderer.shadowMap.enabled){ renderer.shadowMap.enabled = sh; sunL.castShadow = sh; scene.traverse(o => { if (o.material){ (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } }); }
  IM.grass.visible = l >= 2 && IM.grass.count > 0;
}
function updateQuality(){
  const now = performance.now();
  if (!QUALITY.auto || state !== 'play' || document.hidden){ QUALITY.t0 = 0; QUALITY.frames = 0; return; }
  if (!QUALITY.t0){ QUALITY.t0 = now; QUALITY.frames = 0; return; }
  QUALITY.frames++; const el = (now - QUALITY.t0) / 1000;
  if (el >= 2){ const f = QUALITY.frames / el; QUALITY.t0 = now; QUALITY.frames = 0; QUALITY.lastFps = f;
    if (QUALITY.settle > 0){ QUALITY.settle--; return; }
    if (f < 45 && QUALITY.level > 0){ setQuality(QUALITY.level - 1); QUALITY.settle = 1; } }
}
{ const qp = new URLSearchParams(location.search).get('q'); if (qp !== null){ QUALITY.auto = false; QUALITY.forced = +qp; } }
function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize(); if (QUALITY.forced !== undefined) setQuality(QUALITY.forced); buildFlaps(); setSound(soundOn); toTitle();
requestAnimationFrame(t => { last = t; frame(t); });

window.__FW = { get state(){ return state; }, bird: birdS, get trees(){ return trees; }, get hawk(){ return hawk; }, get fps(){ return fps; }, get distM(){ return distM; },
  get perfects(){ return perfects; }, get combo(){ return combo; }, get owls(){ return owls; }, get berries(){ return berries; }, get berryCount(){ return berryCount; }, get info(){ return renderer.info.render; },
  camera, THREE, predict: (yaw, pow) => { const h = predictPath(yaw, pow, null); return h ? { id: h.b.id, kind: h.b.kind, z: h.pos.z, x: h.pos.x, y: h.pos.y, tz: h.b.tree.z, tt: h.tt } : null; },
  warp(m, hawkIn){ startRun(m); if (hawkIn !== undefined) nextHawkM = m + hawkIn; }, TUT, dbg: { robinWings, birdModel, birdObj, tailFeathers }, get quality(){ return QUALITY; }, setQuality, screen(v){ _v.copy(v).project(camera); return [(_v.x*0.5+0.5)*innerWidth, (-_v.y*0.5+0.5)*innerHeight]; } };
