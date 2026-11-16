/* Featherwood v4 - free-flight forest exploration. Three.js (vendored r160). */
import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries, mergeVertices } from './vendor/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const lerp = (a,b,t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
let seed = 1;
function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const rand = (a,b) => a + (b - a) * rnd();
const fr = (a,b) => a + (b - a) * Math.random();
function hash(i){ const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function hash32(a, b, c){ let h = (a | 0) ^ 0x9e3779b9; h = Math.imul(h ^ (b | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h ^ (c | 0), 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x27d4eb2f); return (h ^ (h >>> 15)) >>> 0; }
function mk(w,h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Constants ---------- */
const CEIL = 22, FOOT = 0.2;
const G = 14, DRAG_K = 0.34, FLAP_V = 11, FLAP_LIFT = 2.4, MAX_HEARTS = 5;
const R_EDGE = 520, CELL = 16, VIEW_R = 92, GAP_M = 42;
// palettes: one per biome type. Safe biomes are warm and open, danger biomes dark and murky.
const PALS = {
  grove:   { name:'Quiet Grove', sub:'Calm woods', fog:0xc9d6b0, skyT:0x9cc4cf, hemiS:0xfff1d6, hemiG:0x3a4a2c, sun:0xffe2a8, sunI:3.4, hemiI:1.15, fogD:0.0115,
             leaves:[0x2c5124,0x3f6d2b,0x5c8c35,0x86ad48], bush:0x34502a, bark:0xf2efe8, fern:0x6f9a45, grass:0x8aa850, fallLeaf:0xa0782e, shaft:0xfff0c4, shaftA:0.17, night:0 },
  birch:   { name:'Silver Birches', sub:'Calm woods', fog:0xd6e2cc, skyT:0x8fc3e0, hemiS:0xffffff, hemiG:0x56603e, sun:0xfff8ec, sunI:3.6, hemiI:1.25, fogD:0.0105,
             leaves:[0x587a22,0x7c9d2e,0xa6bf45,0xcfd970], bush:0x587a2c, bark:0xffffff, fern:0x86ad4a, grass:0xa0bd55, fallLeaf:0xd8c050, shaft:0xffffff, shaftA:0.12, night:0 },
  maple:   { name:'Ember Maples', sub:'Calm woods', fog:0xe2b486, skyT:0xd98a5c, hemiS:0xffd8a8, hemiG:0x4a2e22, sun:0xffbc80, sunI:3.3, hemiI:1.0, fogD:0.0115,
             leaves:[0x8a2414,0xb8431c,0xdc6f26,0xf0a640], bush:0x6a3a1c, bark:0xe8d8cc, fern:0x9a7a3a, grass:0xb09048, fallLeaf:0xe07a28, shaft:0xffc27a, shaftA:0.2, night:0 },
  clearing:{ name:'The Clearing', sub:'Standing stones', fog:0xd2dcb8, skyT:0x94c6e0, hemiS:0xfff6e0, hemiG:0x4a5a34, sun:0xfff0c0, sunI:3.8, hemiI:1.3, fogD:0.009,
             leaves:[0x2c5124,0x3f6d2b,0x5c8c35,0x86ad48], bush:0x3a5a2c, bark:0xf2efe8, fern:0x7aa24a, grass:0x9ab858, fallLeaf:0xa0782e, shaft:0xfff4d0, shaftA:0.14, night:0 },
  stream:  { name:'The Stream', sub:'Cool water', fog:0xc4d8c8, skyT:0x94c4d8, hemiS:0xf4f8ff, hemiG:0x3a5040, sun:0xfff0d0, sunI:3.4, hemiI:1.2, fogD:0.011,
             leaves:[0x2c5124,0x3f6d2b,0x5c8c35,0x86ad48], bush:0x34502a, bark:0xf2efe8, fern:0x6f9a45, grass:0x8aa850, fallLeaf:0xa0782e, shaft:0xf0f4ff, shaftA:0.15, night:0 },
  dark:    { name:'Deep Dark Woods', sub:'Something is watching', fog:0x161e30, skyT:0x070b16, hemiS:0x7486b8, hemiG:0x0c0e14, sun:0xa8b8e8, sunI:1.5, hemiI:0.95, fogD:0.021,
             leaves:[0x183a30,0x22493c,0x2f5c4a,0x3f7560], bush:0x1d3a2c, bark:0xd8c8c0, fern:0x4d7a64, grass:0x5a7a64, fallLeaf:0x4a5a40, shaft:0x8fa4e0, shaftA:0.08, night:1, danger:1 },
  bog:     { name:'The Bog', sub:'Keep off the water', fog:0x4a5a3a, skyT:0x2a3626, hemiS:0xb0c098, hemiG:0x1a2214, sun:0xccd4a0, sunI:1.8, hemiI:1.0, fogD:0.024,
             leaves:[0x2a3a1c,0x3a4a24,0x4a5a2a,0x5a6a34], bush:0x2e3a20, bark:0xa8a898, fern:0x5a6a3a, grass:0x6a7a40, fallLeaf:0x5a5a30, shaft:0xc0d090, shaftA:0.06, night:0.6, danger:1 },
  thorn:   { name:'Thornwood', sub:'Hawk country', fog:0x5e5054, skyT:0x3a2e38, hemiS:0xc8b0b0, hemiG:0x221818, sun:0xe8b8a8, sunI:2.2, hemiI:0.95, fogD:0.019,
             leaves:[0x3a2a22,0x4a3226,0x5a3a2a,0x6a4a30], bush:0x3a2a20, bark:0x9a8a84, fern:0x6a5a40, grass:0x8a7a58, fallLeaf:0x6a4a30, shaft:0xe8b8a8, shaftA:0.07, night:0.15, danger:1 },
  meadow:  { name:'The Meadow', sub:'The way out', fog:0xcfe2d6, skyT:0x6cb4ea, hemiS:0xffffff, hemiG:0x5a7a38, sun:0xfff0d0, sunI:3.5, hemiI:1.25, fogD:0.005,
             leaves:[0x4a7a2a,0x6a9a34,0x8aba44,0xaad060], bush:0x5a8a30, bark:0xffffff, fern:0x8aba50, grass:0xa8d060, fallLeaf:0xd8c050, shaft:0xffffff, shaftA:0.1, night:0 },
};
PALS.edge = Object.assign({}, PALS.thorn, { name:'The Bramble Wall', sub:'Too thick to pass', danger:0 });
for (const k in PALS){ const P = PALS[k]; P.key = k;
  for (const c of ['fog','skyT','hemiS','hemiG','sun','shaft','bark','bush','fern','grass','fallLeaf']) P['c_'+c] = new THREE.Color(P[c]);
  P.c_leaves = P.leaves.map(h => new THREE.Color(h)); P.c_leafI = P.c_leaves.map(c => c.clone().multiplyScalar(2.3)); P.c_fern.multiplyScalar(1.7); P.c_grass.multiplyScalar(1.6); }

const store = {
  get(k,d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let bestTime = store.get('fw4_best', 0);
let soundOn = store.get('fw_sound', true);
const TUT = store.get('fw4_tut', {});

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


/* ---------- v4 extra render assets: water, creatures, exit glow ---------- */
const MA = (p, r, s) => M(p[0], p[1], p[2], r[0], r[1], r[2], s[0], s[1], s[2]);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function rippleTex(){
  const c = mk(256, 256), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  const r = mulberry(77);
  for (let i=0;i<160;i++){ const px = r()*256, py = r()*256, rr = 6 + r()*26; const g = x.createRadialGradient(px, py, 0, px, py, rr);
    const v = r() < 0.5 ? 255 : 0; g.addColorStop(0, `rgba(${v},${v},${v},0.16)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]){ x.save(); x.translate(ox, oy); x.fillStyle = g; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill(); x.restore(); } }
  return canvasTex(normalFromHeight(c, 2.2), [1, 1], false);
}
TEX.ripple = rippleTex(); TEX.ripple.wrapS = TEX.ripple.wrapT = THREE.RepeatWrapping;
MAT.water = new THREE.MeshStandardMaterial({ color: 0x35585c, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.86, normalMap: TEX.ripple, normalScale: new THREE.Vector2(0.5, 0.5), depthWrite: false });
MAT.bogWater = new THREE.MeshStandardMaterial({ color: 0x27301c, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92, normalMap: TEX.ripple, normalScale: new THREE.Vector2(0.25, 0.25), depthWrite: false });
MAT.creature = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
MAT.wingC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
MAT.snake = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 });
MAT.eyeGlow = new THREE.MeshBasicMaterial({ color: 0xffd040, toneMapped: false });
const waterMesh = new THREE.Mesh(new THREE.BufferGeometry(), MAT.water); waterMesh.receiveShadow = true; waterMesh.renderOrder = 1; scene.add(waterMesh);
const bogIM = inst(new THREE.CircleGeometry(1, 22).rotateX(-Math.PI/2), MAT.bogWater, 160, false, true); bogIM.renderOrder = 1;
// ground: biome tint map + world-space macro variation (replaces v3 version)
const BIO_N = 256, BIO_SPAN = 1280;
const bioData = new Uint8Array(BIO_N * BIO_N * 4);
const bioTex = new THREE.DataTexture(bioData, BIO_N, BIO_N, THREE.RGBAFormat); bioTex.magFilter = THREE.LinearFilter; bioTex.minFilter = THREE.LinearFilter; bioTex.needsUpdate = true;
MAT.ground.onBeforeCompile = sh => {
  sh.uniforms.uBio = { value: bioTex };
  sh.vertexShader = 'varying vec2 vWXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
  sh.fragmentShader = 'uniform sampler2D uBio; varying vec2 vWXZ;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  vec2 wuv = vWXZ * 0.25;
  vec3 macro = texture2D(map, wuv * 0.071 + vec2(0.37, 0.11)).rgb; vec3 macro2 = texture2D(map, wuv * 0.013 + vec2(0.7, 0.2)).rgb;
  diffuseColor.rgb *= (0.62 + 0.8 * dot(macro, vec3(0.33))) * (0.7 + 0.6 * dot(macro2, vec3(0.33)));
  vec4 bio = texture2D(uBio, vWXZ / ${BIO_SPAN.toFixed(1)} + 0.5);
  diffuseColor.rgb *= bio.rgb * 2.0;`);
};
MAT.ground.customProgramCacheKey = () => 'groundBiome4';
// creatures geometry (merged, vertex-coloured)
function crWingGeo(span, chord, col, bat){
  // V-shaped wing pair (tips raised) so scaling Y flips them -> cheap flapping
  const pos = [], cols = [], c = new THREE.Color(col);
  const tri = (a, b, d) => { pos.push(...a, ...b, ...d); for (let i=0;i<3;i++) cols.push(c.r, c.g, c.b); };
  for (const s of [-1, 1]){
    const P = bat ? [[0.04,0,0.06],[0.2*span,0.3*span,0.05],[0.5*span,0.55*span,0],[0.38*span,0.36*span,-chord],[0.22*span,0.18*span,-chord*0.7],[0.08*span,0,-chord*0.9],[0.04,0,-0.05]]
                  : [[0.04,0,0.07],[0.35*span,0.3*span,0.06],[0.55*span,0.48*span,-0.02],[0.5*span,0.45*span,-chord],[0.3*span,0.25*span,-chord*1.1],[0.04,0,-chord*0.7]];
    const q = P.map(p => [p[0]*s, p[1], p[2]]);
    for (let i=1;i<q.length-1;i++) tri(q[0], q[i], q[i+1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
const batBodyGeo = mergeColored([
  [SPH(10,8), 0x2a201c, MA([0,0,0],[0,0,0],[0.07,0.07,0.12])],
  [SPH(8,6), 0x2e2420, MA([0,0.03,0.1],[0,0,0],[0.055,0.05,0.055])],
  [new THREE.ConeGeometry(0.022, 0.06, 5), 0x2a201c, MA([0.025,0.08,0.1],[0,0,-0.3],[1,1,1])],
  [new THREE.ConeGeometry(0.022, 0.06, 5), 0x2a201c, MA([-0.025,0.08,0.1],[0,0,0.3],[1,1,1])],
]);
const batWingGeo = crWingGeo(0.62, 0.2, 0x3a2a28, true);
const crowBodyGeo = mergeColored([
  [SPH(12,8), 0x121216, MA([0,0,0],[0,0,0],[0.1,0.1,0.21])],
  [SPH(10,8), 0x141418, MA([0,0.05,0.2],[0,0,0],[0.075,0.075,0.08])],
  [new THREE.ConeGeometry(0.03, 0.12, 6), 0x2a2a2a, MA([0,0.04,0.31],[Math.PI/2,0,0],[1,1,1])],
  [new THREE.BoxGeometry(0.14, 0.015, 0.2), 0x101014, MA([0,0.01,-0.27],[0.1,0,0],[1,1,1])],
]);
const crowWingGeo = crWingGeo(0.8, 0.2, 0x18181e, false);
function snakeGeometry(){
  const pts = []; for (let i=0;i<=40;i++){ const u = i/40, a = u*TAU*1.6, r = 0.2 - u*0.04; pts.push([Math.cos(a)*r, 0.06 + u*0.12, Math.sin(a)*r]); }
  for (let i=1;i<=10;i++){ const u = i/10; pts.push([0.16 - u*0.05, 0.18 + u*0.32, -u*0.05 + u*u*0.2]); }
  const g = tube(pts, 0.06, 0.035, 8, 1, 6); const n = g.attributes.position.count, cols = new Float32Array(n*3);
  const uv = g.attributes.uv; for (let i=0;i<n;i++){ const v = uv.getY(i); const band = Math.sin(v*2.2) > 0.2; const c = band ? [0.32, 0.38, 0.1] : [0.12, 0.16, 0.05]; cols.set(c, i*3); }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const head = mergeColored([[SPH(10,8), 0x2a3410, MA([0.11, 0.52, 0.17],[0,0,0],[0.06,0.045,0.085])], [SPH(6,4), 0xffd040, MA([0.15,0.545,0.21],[0,0,0],[0.014,0.014,0.014])], [SPH(6,4), 0xffd040, MA([0.07,0.545,0.21],[0,0,0],[0.014,0.014,0.014])]]);
  const a = g.index ? g.toNonIndexed() : g; const b = head.index ? head.toNonIndexed() : head;
  for (const x of [a, b]) for (const k of Object.keys(x.attributes)) if (!['position','normal','color'].includes(k)) x.deleteAttribute(k);
  return mergeGeometries([a, b]);
}
const CR = {
  batB: inst(batBodyGeo, MAT.creature, 40, false, false), batW: inst(batWingGeo, MAT.wingC, 40, false, false),
  crowB: inst(crowBodyGeo, MAT.creature, 32, true, false), crowW: inst(crowWingGeo, MAT.wingC, 32, true, false),
  snake: inst(snakeGeometry(), MAT.snake, 40, true, false),
  eyes: inst(mergeColored([[SPH(6,4), 0xffffff, MA([0.03,0.035,0.135],[0,0,0],[0.014,0.014,0.014])], [SPH(6,4), 0xffffff, MA([-0.03,0.035,0.135],[0,0,0],[0.014,0.014,0.014])]]),
    new THREE.MeshBasicMaterial({ color: 0xff5a2a, toneMapped: false, fog: false }), 72, false, false),
};
// exit glow: unfogged light that shines through the trees toward the way out
const exitGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false, transparent: true, opacity: 0.6, toneMapped: false }));
exitGlow.renderOrder = -1; scene.add(exitGlow);
const exitCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false, transparent: true, opacity: 0.6, toneMapped: false }));
exitCore.renderOrder = -1; scene.add(exitCore);
IM.ring.visible = false; IM.dot.visible = false; targetRing.visible = false;

/* ---------- World: one big seeded round forest ---------- */
let W = null;
const cells = new Map();
let nearCells = [], visTrees = [], dirty = true;
let treeId = 0, branchId = 0;
function angD(a, b){ return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function vnoise(x, z){ const xi = Math.floor(x), zi = Math.floor(z), xf = smooth(x - xi), zf = smooth(z - zi);
  const h = (i, j) => hash32(W.nseed, i, j) / 4294967296;
  return lerp(lerp(h(xi, zi), h(xi+1, zi), xf), lerp(h(xi, zi+1), h(xi+1, zi+1), xf), zf); }
function riverR(a){ return W.riverR + 26*Math.sin(a*3 + W.ph) + 12*Math.sin(a*7 + W.ph*2); }
function riverDist(x, z){ return Math.abs(Math.hypot(x, z) - riverR(Math.atan2(x, z))); }
function inGap(x, z){ return Math.abs(angD(Math.atan2(x, z), W.exitA)) * R_EDGE < GAP_M; }
function dangerAt(x, z){ // signed margin in metres (>0 inside a danger area) and which kind
  const r = Math.hypot(x, z), a = Math.atan2(x, z), da = Math.abs(angD(a, W.exitA));
  const wh = W.wedge + 0.07*Math.sin(r*0.031 + W.ph) + 0.05*Math.sin(r*0.083 + W.ph*3);
  let m = Math.min((wh - da) * r, r - 110, (R_EDGE - 48) - r), type = r < 245 ? 'dark' : r < 365 ? 'bog' : 'thorn';
  for (const p of W.pockets){ const pm = p.r - Math.hypot(x - p.x, z - p.z); if (pm > m){ m = pm; type = p.type; } }
  return { m, type };
}
function biomeAt(x, z){
  const r = Math.hypot(x, z);
  if (r > R_EDGE - 3) return inGap(x, z) ? 'meadow' : (r > R_EDGE + 40 ? 'meadow' : 'edge');
  const d = dangerAt(x, z); if (d.m > 0) return d.type;
  if (riverDist(x, z) < 10) return 'stream';
  if (r < 26) return 'clearing';
  for (const c of W.clearings) if (Math.hypot(x - c.x, z - c.z) < c.r) return 'clearing';
  if (r > R_EDGE - 45 && inGap(x, z)) return 'meadow';
  const n = vnoise(x / 150 + 3.1, z / 150 - 1.7);
  return n < 0.38 ? 'birch' : n < 0.64 ? 'grove' : 'maple';
}
function dangerLevel(x, z){ const d = dangerAt(x, z); return { k: sstep(-22, 14, d.m), type: d.type, m: d.m }; }
const BIO_TINT = { grove:[1,1,0.95], birch:[1.05,1.04,0.9], maple:[1.08,0.86,0.72], clearing:[1.08,1.1,0.86], stream:[0.86,0.92,0.86], dark:[0.42,0.44,0.5], bog:[0.5,0.62,0.4], thorn:[0.72,0.6,0.56], meadow:[0.85,1.3,0.55], edge:[0.62,0.54,0.5] };
function buildBioTex(){
  for (let j=0;j<BIO_N;j++) for (let i=0;i<BIO_N;i++){
    const x = (i + 0.5) / BIO_N * BIO_SPAN - BIO_SPAN/2, z = (j + 0.5) / BIO_N * BIO_SPAN - BIO_SPAN/2;
    const b = biomeAt(x, z); let t = BIO_TINT[b]; const rd = riverDist(x, z); let k = 1;
    if (rd < 6) k = 0.55 + rd*0.06;
    const o = (j*BIO_N + i)*4; bioData[o] = clamp(t[0]*k*127, 0, 255); bioData[o+1] = clamp(t[1]*k*127, 0, 255); bioData[o+2] = clamp(t[2]*k*127, 0, 255); bioData[o+3] = 255; }
  bioTex.needsUpdate = true;
}
function buildWater(){
  const N = 900, pos = [], uv = [], idx = [];
  for (let i=0;i<=N;i++){ const a = i / N * TAU, rr = riverR(a), w = 4.2 + 1.2*Math.sin(a*11 + W.ph);
    for (const s of [-1, 1]){ const r = rr + s*w; pos.push(Math.sin(a)*r, 0.07, Math.cos(a)*r); uv.push(s*0.5 + 0.5, i * 0.35); } }
  for (let i=0;i<N;i++){ const a = i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  for (let i=0;i<g.attributes.normal.count;i++) g.attributes.normal.setXYZ(i, 0, 1, 0);
  waterMesh.geometry.dispose(); waterMesh.geometry = g;
}
function newWorld(sd){
  const r = mulberry(sd);
  W = { seed: sd, exitA: r()*TAU, wedge: 0.56 + r()*0.08, ph: r()*TAU, riverR: 175 + r()*35, nseed: (r()*1e9)|0, pockets: [], clearings: [] };
  for (let i=0;i<4;i++) for (let k=0;k<30;k++){ const a = r()*TAU, d = 150 + r()*290; if (Math.abs(angD(a, W.exitA)) < W.wedge + 0.45) continue;
    const p = { x: Math.sin(a)*d, z: Math.cos(a)*d, r: 30 + r()*16, type: ['dark','bog','thorn','dark'][i] };
    if (W.pockets.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 150)) continue; W.pockets.push(p); break; }
  for (let i=0;i<5;i++){ const a = r()*TAU, d = 90 + r()*350; W.clearings.push({ x: Math.sin(a)*d, z: Math.cos(a)*d, r: 14 + r()*8 }); }
  W.exit = new THREE.Vector3(Math.sin(W.exitA)*R_EDGE, 0, Math.cos(W.exitA)*R_EDGE);
  W.startYaw = W.exitA + 1.25;
  for (const c of cells.values()) dropCell(c);
  cells.clear(); treeId = 0; branchId = 0;
  buildBioTex(); buildWater();
  dirty = true; W.cellKey = null;
}
function trunkR(t, y){ return t.r * lerp(1, 0.8, clamp(y / t.h, 0, 1)); }
const BIO_TREE = { grove:['oak', 0.46, 3], birch:['birch', 0.52, 3], maple:['maple', 0.46, 3], clearing:['oak', 0.04, 2], stream:['birch', 0.25, 3], dark:['redwood', 0.45, 3], bog:['oak', 0.3, 3], thorn:['maple', 0.42, 3], meadow:['oak', 0.0, 2], edge:['maple', 0.8, 4] };
function makeTree(x, z, bio, big){
  const P = PALS[bio === 'meadow' ? 'grove' : bio], st = BIO_TREE[bio][0];
  const dead = bio === 'bog' || bio === 'thorn' || bio === 'edge';
  let r = st === 'birch' ? rand(0.42, 0.58) : st === 'redwood' ? rand(1.05, 1.5) : st === 'maple' ? rand(0.62, 0.82) : rand(0.7, 0.95);
  if (dead) r *= 0.75;
  const t = { id: treeId++, x, z, r, h: rand(44, 54), st, pal: P, bio, dead, thorny: bio === 'thorn' || bio === 'edge', branches: [], blobs: [], cones: [], limbs: [], tint: rand(0.85, 1.1) };
  if (big){ t.r = 2.4; t.h = 58; }
  const vr = mulberry(t.id * 7919 + ((x * 13) | 0) * 31 + ((z * 7) | 0));
  const L = 4;
  if (dead){
    const nl = 7 + ((vr()*4)|0);
    for (let i=0;i<nl;i++){ const a = vr()*TAU, y0 = 6 + vr()*30, len = 2.5 + vr()*4.5, e = 0.15 + vr()*0.8; t.limbs.push({ a, y0, len, e, th: 1.1 + vr()*0.6 }); }
    if (bio === 'bog' && vr() < 0.6){ for (let i=0;i<3;i++){ const a = vr()*TAU, d = vr()*3; t.blobs.push({ x: x + Math.sin(a)*d, y: 28 + vr()*10, z: z + Math.cos(a)*d, s: 1.6 + vr()*1.4, c: (vr()*L)|0 }); } }
  } else if (st === 'redwood'){
    for (let k=0;k<6;k++){ const y = 24 + k*3.6; t.cones.push({ x, y, z, s: 5.2 - k*0.75, sy: 2.4, c: (k % 3), rot: vr()*TAU }); }
    for (let k=0;k<6;k++){ const y = 25.8 + k*3.6; t.cones.push({ x, y, z, s: 4.6 - k*0.72, sy: 2.0, c: (k + 1) % 3, rot: vr()*TAU }); }
    for (let k=0;k<4;k++){ const y = 16 + k*2.2; t.cones.push({ x: x + (vr()-0.5), y, z: z + (vr()-0.5), s: 2.2 + vr()*1.2, sy: 1.4, c: k % 3, rot: vr()*TAU }); }
    for (let i=0;i<8;i++){ const a = vr()*TAU, y0 = 15 + vr()*26, len = 2.4 + vr()*2.2, e = -0.25 + vr()*0.3; t.limbs.push({ a, y0, len, e, th: 1.25 }); }
  } else {
    const sc = (st === 'birch' ? 0.75 : 1) * (big ? 1.8 : 1);
    for (let i=0;i<10;i++){ const a = vr()*TAU, d = (0.5 + vr()*4.7)*sc; t.blobs.push({ x: x + Math.sin(a)*d, y: 30 + vr()*16, z: z + Math.cos(a)*d, s: (2.6 + vr()*2)*(st === 'birch' ? 0.75 : 1)*(big ? 1.3 : 1), c: (vr()*L)|0 }); }
    for (let i=0;i<5;i++){ const a = vr()*TAU, y0 = (st === 'birch' ? 16 : 19) + vr()*11, len = (4 + vr()*4.5)*sc, e = 0.45 + vr()*0.55;
      t.limbs.push({ a, y0, len, e, th: (st === 'birch' ? 1.3 : 2.1) * (big ? 1.8 : 1) });
      const tx = x + Math.sin(a)*(Math.cos(e)*len + t.r), ty = y0 + Math.sin(e)*len, tz = z + Math.cos(a)*(Math.cos(e)*len + t.r);
      t.blobs.push({ x: tx, y: ty + 1, z: tz, s: (2.2 + vr()*1.6)*sc*0.8, c: (vr()*L)|0 });
      t.blobs.push({ x: tx - Math.sin(a)*1.6, y: ty - 0.6, z: tz - Math.cos(a)*1.6, s: (1.6 + vr())*sc*0.8, c: (vr()*L)|0 }); }
  }
  return t;
}
function branchPoint(b, tt, out){ return out.set(b.x0 + b.dx*b.len*tt, b.y - b.sag*tt, b.z0 + b.dz*b.len*tt); }
function branchTop(b, tt){ return b.y - b.sag*tt + lerp(0.18, 0.06, tt); }
function addBranch(t, y, ang, len, kind){
  const dx = Math.sin(ang), dz = Math.cos(ang), rr = trunkR(t, y) * 0.8;
  const b = { id: branchId++, tree: t, y, ang, len, kind, sag: rand(0.2, 0.5), dx, dz, x0: t.x + dx*rr, z0: t.z + dz*rr, slot: -1 };
  if (!t.dead) b.leaf = { tt: 1.25, up: 0.32, s: rand(0.75, 1.1), c: (rnd()*4)|0 };
  t.branches.push(b); return b;
}
function addTreeBranches(t){
  const nb = 2 + ((rnd()*3)|0), ys = [];
  for (let k=0;k<30 && ys.length < nb;k++){ const y = rand(4.5, 24); if (ys.every(v => Math.abs(v - y) > 3)) ys.push(y); }
  let a0 = rnd()*TAU;
  ys.forEach((y, i) => { const ang = a0 + i*2.2 + rand(-0.4, 0.4); addBranch(t, y, ang, rand(2.4, 4.2) * (t.r > 2 ? 1.5 : 1), t.thorny && rnd() < 0.6 ? 'thorn' : 'normal'); });
}
function cellOf(x){ return Math.floor(x / CELL); }
function cellKey(i, j){ return (i + 500) * 1000 + (j + 500); }
function getCell(i, j){ const k = cellKey(i, j); let c = cells.get(k); if (!c){ c = genCell(i, j); cells.set(k, c); } return c; }
function dropCell(c){ for (const o of c.owls) if (o.obj){ o.obj.used = false; o.obj.g.visible = false; o.obj = null; } }
function genCell(ci, cj){
  seed = hash32(W.seed, ci, cj) || 1;
  const c = { i: ci, j: cj, trees: [], decor: [], berries: [], owls: [], flocks: [], snakes: [], bog: [] };
  const x0 = ci*CELL, z0 = cj*CELL, cb = biomeAt(x0 + CELL/2, z0 + CELL/2);
  const g = BIO_TREE[cb][2], sub = CELL / g;
  const R0 = Math.hypot(x0 + CELL/2, z0 + CELL/2);
  for (let a=0;a<g;a++) for (let b=0;b<g;b++){
    const x = x0 + (a + 0.2 + rnd()*0.6)*sub, z = z0 + (b + 0.2 + rnd()*0.6)*sub;
    let bio = biomeAt(x, z); const rr = Math.hypot(x, z); if (bio === 'meadow' && rr < R_EDGE - 3) bio = 'grove'; let p = BIO_TREE[bio][1];
    if (bio === 'edge' && rr > R_EDGE + 30) p = 0;
    if (rr < 24 || riverDist(x, z) < 7.5) p = 0;
    if (rr > R_EDGE - 70 && inGap(x, z)) p *= clamp((R_EDGE - 10 - rr) / 60, 0, 1) * 0.6;
    if (rnd() >= p) continue;
    const t = makeTree(x, z, bio, false); addTreeBranches(t); c.trees.push(t);
  }
  if (ci === cellOf(0) && cj === cellOf(0)){ // the Great Oak landmark in the starting clearing
    seed = 4242 + W.seed % 1000;
    const t = makeTree(0, 0, 'grove', true); t.great = true;
    const sb = addBranch(t, 10, W.startYaw + Math.PI/2, 5.5, 'normal'); sb.sag = 0.15; t.start = sb;
    addBranch(t, 16, W.startYaw - 1.2, 6, 'normal'); addBranch(t, 21, W.startYaw + 2.4, 6, 'normal');
    c.trees.push(t);
  }
  // ground decor (visual only)
  const vr = mulberry(hash32(W.seed ^ 0x51ed, ci, cj));
  const free = (x, z, pad) => c.trees.every(t => Math.hypot(t.x - x, t.z - z) > t.r*1.7 + pad) && riverDist(x, z) > 5.2;
  const D = { grove:[5,5,0.8,0.2], birch:[2,9,0.5,0.1], maple:[3,4,0.7,0.25], clearing:[1,12,0.6,0.05], stream:[2,7,1.8,0.1], dark:[6,0,0.5,0.3], bog:[1,8,0.3,0.4], thorn:[0,3,1.5,0.3], meadow:[0,30,0.3,0], edge:[0,2,1,0.3] }[cb];
  const nF = Math.floor(D[0] + vr()), nG = Math.floor(D[1] + vr()), nR = Math.floor(D[2] + vr());
  for (let i=0;i<nF;i++){ const x = x0 + vr()*CELL, z = z0 + vr()*CELL; if (free(x, z, 0.4)) c.decor.push({ k:'fern', x, z, s: 0.6 + vr()*0.9, r: vr()*TAU, P: PALS[cb], c: vr() }); }
  for (let i=0;i<nG;i++){ const x = x0 + vr()*CELL, z = z0 + vr()*CELL; if (free(x, z, 0.2)) c.decor.push({ k:'grass', x, z, s: (cb === 'meadow' ? 0.9 : 0.6) + vr()*0.7, r: vr()*TAU, P: PALS[cb], c: vr() }); }
  for (let i=0;i<nR;i++){ const x = x0 + vr()*CELL, z = z0 + vr()*CELL; if (free(x, z, 1)) c.decor.push({ k:'rock', x, z, s: 0.25 + Math.pow(vr(), 2)*1.3, r: vr()*TAU, P: PALS[cb], c: vr() }); }
  if (vr() < D[3]){ const x = x0 + vr()*CELL, z = z0 + vr()*CELL, len = 4 + vr()*6; if (free(x, z, len*0.5)) c.decor.push({ k:'log', x, z, s: 0.28 + vr()*0.2, len, r: vr()*TAU, P: PALS[cb], c: vr() }); }
  if (cb !== 'edge' && cb !== 'meadow') for (let i=0;i<2;i++){ if (vr() < (cb === 'dark' ? 0.5 : 0.25)){ const x = x0 + vr()*CELL, z = z0 + vr()*CELL; if (free(x, z, 1)) c.decor.push({ k:'bush', x, z, s: 0.8 + vr()*0.9, r: vr()*TAU, P: PALS[cb], c: (vr()*2)|0 }); } }
  // standing stones ring around clearings (landmarks)
  for (const cl of [{ x: 0, z: 0, r: 20, n: 9 }, ...W.clearings.map(q => ({ x: q.x, z: q.z, r: q.r * 0.7, n: 7 }))]){
    for (let k=0;k<cl.n;k++){ const a = k / cl.n * TAU + cl.x, x = cl.x + Math.sin(a)*cl.r, z = cl.z + Math.cos(a)*cl.r;
      if (cellOf(x) === ci && cellOf(z) === cj) c.decor.push({ k:'stone', x, z, s: 1.1 + hash(k + cl.x)*0.6, r: a, P: PALS.clearing, c: 0.5 }); } }
  // bog pools
  if (cb === 'bog'){ const n = 1 + ((vr()*2.2)|0); for (let i=0;i<n;i++) c.bog.push({ x: x0 + vr()*CELL, z: z0 + vr()*CELL, r: 2.5 + vr()*5 }); }
  // berry bushes (healing)
  const safe = !PALS[cb].danger && cb !== 'edge';
  if (vr() < (safe ? 0.12 : 0.05)){ for (let k=0;k<10;k++){ const x = x0 + 2 + vr()*(CELL-4), z = z0 + 2 + vr()*(CELL-4); if (!free(x, z, 1.2)) continue;
      c.decor.push({ k:'bush', x, z, s: 1.4, r: vr()*TAU, P: PALS[cb], c: 1, berry: true });
      for (let m=0;m<3;m++){ const a = m*2.1 + vr(); c.berries.push({ pos: new THREE.Vector3(x + Math.sin(a)*0.75, 1.05 + vr()*0.4, z + Math.cos(a)*0.75), taken: false, fade: 1, ph: vr()*6, respawn: 0 }); }
      break; } }
  // creatures
  const branches = []; for (const t of c.trees) for (const b of t.branches) if (b.kind === 'normal') branches.push(b);
  const dl = dangerAt(x0 + CELL/2, z0 + CELL/2);
  if (dl.m > 6){
    if (dl.type === 'dark'){
      if (branches.length && vr() < 0.32){ const b = branches[(vr()*branches.length)|0]; c.owls.push({ b, tt: 0.32, state: 'sleep', timer: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), flap: vr()*6, obj: null, home: true }); }
      if (vr() < 0.16) c.flocks.push(makeFlock('bat', x0 + CELL/2, 8 + vr()*10, z0 + CELL/2, 5));
    } else if (dl.type === 'bog'){
      for (const b of branches) if (vr() < 0.35 && c.snakes.length < 2) c.snakes.push({ b, tt: 0.5, cd: 0, strike: 0, ph: vr()*6 });
      if (vr() < 0.12) c.flocks.push(makeFlock('bat', x0 + CELL/2, 6 + vr()*8, z0 + CELL/2, 4));
    } else {
      if (vr() < 0.2) c.flocks.push(makeFlock('crow', x0 + CELL/2, 18 + vr()*8, z0 + CELL/2, 4));
      for (const b of branches) if (vr() < 0.12 && c.snakes.length < 1) c.snakes.push({ b, tt: 0.5, cd: 0, strike: 0, ph: vr()*6 });
    }
  }
  return c;
}
function makeFlock(kind, x, y, z, n){
  const f = { kind, home: new THREE.Vector3(x, y, z), state: 'idle', t: 0, cd: 0, members: [] };
  for (let i=0;i<n;i++) f.members.push({ pos: new THREE.Vector3(x + fr(-3, 3), y + fr(-1, 1), z + fr(-3, 3)), vel: new THREE.Vector3(), ph: fr(0, TAU), a: fr(0, TAU), rr: fr(2, 4.5) });
  return f;
}
// active set: generate cells around the bird, drop far ones, pick visible ones for instancing
function updateCells(force){
  const B = birdS, ci = cellOf(B.pos.x), cj = cellOf(B.pos.z), key = cellKey(ci, cj);
  const yaw = camS.yaw || B.yaw;
  if (!force && key === W.cellKey && Math.abs(angD(yaw, W.visYaw)) < 0.3) return;
  W.cellKey = key; W.visYaw = yaw;
  const RC = Math.ceil(VIEW_R / CELL);
  nearCells = [];
  for (let di=-RC; di<=RC; di++) for (let dj=-RC; dj<=RC; dj++){
    const cx = (ci + di + 0.5)*CELL, cz = (cj + dj + 0.5)*CELL, dx = cx - B.pos.x, dz = cz - B.pos.z, d = Math.hypot(dx, dz);
    if (d > VIEW_R + 12) continue;
    const c = getCell(ci + di, cj + dj); c.d = d;
    const fwd = (dx*Math.sin(yaw) + dz*Math.cos(yaw)) / Math.max(1, d);
    c.vis = d < 26 || (fwd > 0.5 && d < VIEW_R); nearCells.push(c);
  }
  for (const [k, c] of cells){ if (Math.abs(c.i - ci) > RC + 4 || Math.abs(c.j - cj) > RC + 4){ dropCell(c); cells.delete(k); } }
  dirty = true;
}
function nearTreesAt(x, z, out){ out.length = 0; const ci = cellOf(x), cj = cellOf(z);
  for (let a=-1;a<=1;a++) for (let b=-1;b<=1;b++){ const c = cells.get(cellKey(ci + a, cj + b)); if (c) for (const t of c.trees) out.push(t); } return out; }
function setBranchMatrix(b){
  const tip = _v2.set(b.x0 + b.dx*b.len, b.y - b.sag, b.z0 + b.dz*b.len);
  const base = _v.set(b.x0, b.y, b.z0);
  const dir = tip.sub(base); const L = dir.length(); dir.multiplyScalar(1/L);
  _q.setFromUnitVectors(UP, dir); _s.set(1, L, 1); _m.compose(base, _q, _s); IM[b.im].setMatrixAt(b.slot, _m);
}
const REBUILD_KEYS = ['thorn', 'bush', 'fern', 'grass', 'rock', 'log', 'leaf_oak', 'leaf_birch', 'leaf_maple', 'frond', ...SPECIES.map(s => 'trunk_' + s), ...SPECIES.map(s => 'limb_' + s)];
const DEAD_BARK = { bog: new THREE.Color(0x8a8a80), thorn: new THREE.Color(0x6a5c58), edge: new THREE.Color(0x5a4e4a) };
function rebuild(){
  const cnt = {}; for (const k of REBUILD_KEYS) cnt[k] = 0;
  const put = (key, pos, q, s, col) => { const im = IM[key]; const i = cnt[key]; if (i >= im.instanceMatrix.count) return -1; _m.compose(pos, q, s); im.setMatrixAt(i, _m); if (col) im.setColorAt(i, col); cnt[key]++; return i; };
  const lp = new THREE.Vector3(), lp2 = new THREE.Vector3(), tmp = new THREE.Vector3(), bark = new THREE.Color();
  visTrees = [];
  const vc = nearCells.filter(c => c.vis).sort((a, b) => a.d - b.d);
  for (const c of vc) for (const t of c.trees){
    visTrees.push(t); const far = c.d > 58;
    const P = t.pal, sp = t.st, lk = sp === 'redwood' ? 'frond' : 'leaf_' + sp;
    if (t.dead) bark.copy(DEAD_BARK[t.bio]).multiplyScalar(1.6 * t.tint); else bark.copy(P.c_bark).multiplyScalar(0.92 + (t.tint - 0.85) * 0.5);
    put('trunk_' + sp, _v.set(t.x, 0, t.z), _qa.setFromEuler(_e.set(0, t.id * 1.7, 0)), _s.set(t.r, t.h * (t.dead ? 0.82 : 1), t.r), bark);
    for (let li=0; li<t.limbs.length; li++){ const l = t.limbs[li]; if (far && li % 2) continue;
      const rr = trunkR(t, l.y0) * 0.75; lp.set(t.x + Math.sin(l.a)*rr, l.y0, t.z + Math.cos(l.a)*rr);
      tmp.set(Math.sin(l.a)*Math.cos(l.e), Math.sin(l.e), Math.cos(l.a)*Math.cos(l.e));
      put('limb_' + sp, lp, _qa.setFromUnitVectors(UP, tmp), _s.set(l.th, l.len, l.th), bark);
      if (t.thorny){ for (let k=1;k<5;k++){ const u = k/5; const p = tmp.clone().multiplyScalar(l.len*u).add(lp); _qa.setFromEuler(_e.set(k % 2 ? 0.4 : Math.PI - 0.4, l.a + k, 0)); put('thorn', p, _qa, _s.set(1.3, 1.3, 1.3), null); } }
    }
    for (let k=0; k<t.blobs.length; k++){ const bl = t.blobs[k]; if (far && k % 3 === 1) continue; _qa.setFromEuler(_e.set(bl.s * 0.3, bl.x * 3, bl.z * 0.2)); _c.copy(P.c_leafI[bl.c]); put(lk, _v.set(bl.x, bl.y, bl.z), _qa, _s.set(bl.s, bl.s*0.75, bl.s), _c); }
    for (const cn of t.cones){ _qa.setFromEuler(_e.set(0, cn.rot, 0)); _c.copy(P.c_leafI[cn.c]); put('frond', _v.set(cn.x, cn.y, cn.z), _qa, _s.set(cn.s, cn.sy*0.9, cn.s), _c); }
    if (!far) for (const b of t.branches){
      b.im = 'limb_' + sp; b.slot = cnt[b.im];
      if (b.slot < IM[b.im].instanceMatrix.count){ setBranchMatrix(b); _c.copy(bark).multiplyScalar(b.kind === 'thorn' ? 0.5 : 0.95); if (b.kind === 'thorn'){ _c.r += 0.06; } IM[b.im].setColorAt(b.slot, _c); cnt[b.im]++; }
      if (b.leaf){ branchPoint(b, b.leaf.tt, lp); lp.y += b.leaf.up;
        if (sp === 'redwood'){ _qa.setFromEuler(_e.set(0, b.id, 0)); _c.copy(P.c_leafI[b.leaf.c % 4]); put('frond', lp, _qa, _s.set(b.leaf.s*1.7, b.leaf.s*1.2, b.leaf.s*1.7), _c); }
        else { _qa.setFromEuler(_e.set(b.id, b.id*2, 0)); _c.copy(P.c_leafI[b.leaf.c % 4]); put(lk, lp, _qa, _s.set(b.leaf.s*1.1, b.leaf.s*0.85, b.leaf.s*1.1), _c);
          const sd = (b.id % 2 ? 1 : -1) * 0.55; branchPoint(b, 0.95, lp2); lp2.x += b.dz*sd; lp2.z -= b.dx*sd; lp2.y += 0.5;
          _c.copy(P.c_leafI[(b.leaf.c + 1) % 4]); put(lk, lp2, _qa, _s.set(b.leaf.s*0.7, b.leaf.s*0.55, b.leaf.s*0.7), _c); } }
      if (b.kind === 'thorn'){
        for (let k=1;k<10;k++){ const tt = k/10; const p = branchPoint(b, tt, tmp); const upv = k % 2 ? 1 : -1; p.y += upv * 0.14;
          _qa.setFromEuler(_e.set(upv > 0 ? 0.3*(k%3-1) : Math.PI + 0.3*(k%3-1), b.ang, 0)); put('thorn', p, _qa, _s.set(1,1,1), null); }
      }
    }
  }
  let bi = 0;
  for (const c of vc){
    for (const g of c.decor){ const P = g.P; _qa.setFromEuler(_e.set(0, g.r, 0));
      if (g.k === 'fern'){ _c.copy(P.c_fern).multiplyScalar(0.8 + g.c*0.4); put('fern', _v.set(g.x, 0, g.z), _qa, _s.set(g.s, g.s, g.s), _c); }
      else if (g.k === 'grass'){ if (c.d < 70){ _c.copy(P.c_grass).multiplyScalar(0.8 + g.c*0.4); put('grass', _v.set(g.x, 0, g.z), _qa, _s.set(g.s*1.2, g.s, g.s*1.2), _c); } }
      else if (g.k === 'rock'){ _qa.setFromEuler(_e.set(g.c*0.3, g.r, 0)); _c.setRGB(0.85 + g.c*0.2, 0.85 + g.c*0.2, 0.85 + g.c*0.18); put('rock', _v.set(g.x, -0.05*g.s, g.z), _qa, _s.set(g.s*1.3, g.s, g.s), _c); }
      else if (g.k === 'stone'){ _qa.setFromEuler(_e.set(0.05, g.r, 0.04)); _c.setRGB(1.05, 1.05, 1.0); put('rock', _v.set(g.x, 0, g.z), _qa, _s.set(g.s*0.9, g.s*3.4, g.s*0.6), _c); }
      else if (g.k === 'log'){ _c.copy(P.c_bark).multiplyScalar(0.75); put('log', _v.set(g.x, g.s*0.75, g.z), _qa, _s.set(g.len, g.s, g.s), _c); }
      else if (g.k === 'bush'){ _c.copy(P.c_bush).multiplyScalar(g.berry ? 2.6 : g.c ? 2.4 : 1.9); put('bush', _v.set(g.x, g.s*0.42, g.z), _qa, _s.set(g.s*1.2, g.s*0.62, g.s*1.2), _c); }
    }
    for (const p of c.bog){ if (bi >= bogIM.instanceMatrix.count) break; _m.compose(_v.set(p.x, 0.06, p.z), _q.identity(), _s.set(p.r, 1, p.r*0.8)); bogIM.setMatrixAt(bi++, _m); }
  }
  bogIM.count = bi; bogIM.visible = bi > 0; bogIM.instanceMatrix.needsUpdate = true;
  for (const k of REBUILD_KEYS){ const im = IM[k]; im.count = Math.min(cnt[k], im.instanceMatrix.count); im.visible = im.count > 0 && !(k === 'grass' && QUALITY.level < 2); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  dirty = false;
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
motePts.visible = false;
function updateFx(dt){
  const P = PAL.P || PALS.grove;
  const cp = camera.position, fx = Math.sin(camS.yaw || 0), fz = Math.cos(camS.yaw || 0);
  const ccx = cp.x + fx*18, ccz = cp.z + fz*18;
  // tumbling leaves in a box ahead of the camera
  for (let i=0;i<LEAVES_N;i++){ const s = leafSim[i];
    if (s.y < cp.y - 12 || s.y < 0.05 || Math.abs(s.x - ccx) > 24 || Math.abs(s.z - ccz) > 24){ s.x = ccx + fr(-20, 20); s.y = cp.y + fr(0, 14); s.z = ccz + fr(-20, 20); s.c = (Math.random()*4)|0; }
    const flutter = Math.sin(time*2.1 + s.ph);
    s.y -= s.sp * (0.8 + 0.5*Math.abs(flutter)) * dt; s.x += (Math.sin(time*1.3 + s.ph) * 0.9 + 0.4) * dt; s.z += Math.cos(time*0.9 + s.ph) * 0.5 * dt;
    s.rx += s.wx*dt; s.ry += s.wy*dt; s.rz += s.wz*dt*(0.5 + Math.abs(flutter));
    _qb.setFromEuler(_e.set(s.rx, s.ry, s.rz)); _m.compose(_v.set(s.x, s.y, s.z), _qb, _s.set(1, 1, 1)); fallLeaves.setMatrixAt(i, _m);
    _c.copy(P.c_leaves[s.c]).lerp(P.c_fallLeaf, (i % 3) * 0.35); fallLeaves.setColorAt(i, _c); }
  fallLeaves.instanceMatrix.needsUpdate = true; if (fallLeaves.instanceColor) fallLeaves.instanceColor.needsUpdate = true;
  // dust motes drifting inside the light shafts
  const dp = dustPts.geometry.attributes.position, dc = dustPts.geometry.attributes.color; const da = (1 - PAL.night*0.85), sc = MAT.shaft.color;
  for (let i=0;i<DUST_N;i++){ const d = dustSim[i], sh = shafts[d.s]; d.h += d.sp*dt*0.3; if (d.h > 1) d.h -= 1;
    const y = 1 + d.h*24, off = (30 - y) * Math.tan(sh.m.rotation.z), ang = sh.m.rotation.y;
    const lx = d.u*sh.w*0.8 + Math.sin(time*0.3 + d.ph)*0.3; dp.setXYZ(i, sh.x + Math.cos(ang)*(lx + off), y, sh.z - Math.sin(ang)*(lx + off));
    const tw = (0.35 + 0.65*Math.max(0, Math.sin(time*1.7 + d.ph*3))) * da * Math.sin(d.h*Math.PI); dc.setXYZ(i, sc.r*tw, sc.g*tw, sc.b*tw*0.9); }
  dp.needsUpdate = true; dc.needsUpdate = true;
  // fireflies (dark woods and bog) - greenish wisps in the bog
  const flyK = Math.max(PAL.night, PAL.bog || 0);
  flyPts.visible = flyK > 0.05;
  if (flyPts.visible){ const fp = flyPts.geometry.attributes.position, fc = flyPts.geometry.attributes.color, bg = PAL.bog || 0;
    for (let i=0;i<FLY_N;i++){ const s = flySim[i]; if (Math.abs(s.x - ccx) > 26 || Math.abs(s.z - ccz) > 26 || s.y < 0){ s.x = ccx + fr(-24, 24); s.y = fr(0.6, 14); s.z = ccz + fr(-24, 24); }
      const x = s.x + Math.sin(time*0.7 + s.ph)*0.8, y = s.y + Math.sin(time*0.9 + s.ph*2)*0.5; fp.setXYZ(i, x, y, s.z);
      const a = flyK * Math.max(0, Math.sin(time*1.6 + s.ph*3)); fc.setXYZ(i, lerp(0.75, 0.5, bg)*a, 1.0*a, lerp(0.45, 0.6, bg)*a); }
    fp.needsUpdate = true; fc.needsUpdate = true; }
  // sparks
  const sp = sparkPts.geometry.attributes.position, sc2 = sparkPts.geometry.attributes.color;
  for (let i=sparks.length-1;i>=0;i--){ const s = sparks[i]; s.age += dt; if (s.age > s.life){ sparks.splice(i,1); continue; } s.vx *= 1 - 3*dt; s.vy *= 1 - 3*dt; s.vz *= 1 - 3*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt; }
  for (let i=0;i<SPARK_N;i++){ const s = sparks[i]; if (s){ const a = 1 - s.age/s.life; sp.setXYZ(i, s.x, s.y, s.z); sc2.setXYZ(i, s.c.r*a, s.c.g*a, s.c.b*a); } else sp.setXYZ(i, 0, -999, 0); }
  sp.needsUpdate = true; sc2.needsUpdate = true;
  const bp = bitPts.geometry.attributes.position, bc = bitPts.geometry.attributes.color;
  for (let i=bits.length-1;i>=0;i--){ const s = bits[i]; s.age += dt; if (s.age > s.life || s.y < 0){ bits.splice(i,1); continue; } s.vy -= 3*dt; s.vy *= 1 - 1.5*dt; s.vx *= 1 - 1.5*dt; s.vz *= 1 - 1.5*dt; s.vx += Math.sin(time*3 + s.ph)*2*dt; s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt; }
  for (let i=0;i<BIT_N;i++){ const s = bits[i]; if (s){ bp.setXYZ(i, s.x, s.y, s.z); bc.setXYZ(i, s.c.r, s.c.g, s.c.b); } else bp.setXYZ(i, 0, -999, 0); }
  bp.needsUpdate = true; bc.needsUpdate = true;
  // water ripples
  TEX.ripple.offset.y -= dt * 0.08; TEX.ripple.offset.x += dt * 0.02;
  // shafts: re-seed ahead of the bird in whatever direction it flies
  const B = birdS;
  for (const s of shafts){
    const dx = s.x - B.pos.x, dz = s.z - B.pos.z, d = Math.hypot(dx, dz), ahead = (dx*fx + dz*fz);
    if (d > 130 || ahead < -10){ const f = fr(35, 110), l = fr(-35, 35); s.x = B.pos.x + fx*f + fz*l; s.z = B.pos.z + fz*f - fx*l; s.w = fr(4, 9);
      if (riverDist(s.x, s.z) < 25 && Math.random() < 0.5){ /* sun over the water */ } }
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
const birdS = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), prev: new THREE.Vector3(), kick: new THREE.Vector3() };
const PAL = { night: 0, bog: 0, shaftA: 0.15, P: null, init: false };
const camS = { yaw: 0, fov: 62, roll: 0, look: new THREE.Vector3(), init: false };
const input = { down: false, id: null, sx: 0, sy: 0, x: 0, y: 0, t0: 0, moved: 0, dx: 0, dy: 0 };
let hawk = { on: false }, hawkCd = 0, thornT = 0;
let runT = 0, flownM = 0, dangerT = 0, berryCount = 0, hurtCount = 0, deathCause = '', dieT = 0, winT = 0, lastWin = null;
let curBio = 'clearing', curDanger = { k: 0, type: 'dark', m: -99 }, lastBanner = '', compassT = 0, compassCd = 0, edgeHintT = 0;
const _near = [], HURTLOG = [], DBG = { god: false };

function newSeed(){ return ((Date.now() ^ (Math.random()*1e9)) >>> 0) % 900000 + 1000; }
function resetWorld(sd){
  newWorld(sd);
  hawk = { on: false }; hawkObj.visible = false; hawkCd = 0; thornT = 0;
  sparks.length = 0; bits.length = 0; hitStop = 0; shake = 0; slowmo = 1;
  runT = 0; flownM = 0; dangerT = 0; berryCount = 0; hurtCount = 0; dieT = 0; winT = 0; lastBanner = ''; compassT = 0; compassCd = 0; edgeHintT = 0;
  const B = birdS;
  const c0 = getCell(cellOf(0), cellOf(0)), t = c0.trees.find(t => t.great);
  Object.assign(B, { mode: 'perch', branch: t.start, tt: 0.82, alive: true, yaw: W.startYaw, pitch: 0, bank: 0, speed: 0, stun: 0, flapT: 0, wingT: 0, flapAnim: 0,
    holding: false, stall: 0, sq: 1, hurt: 0, hidden: false, hearts: MAX_HEARTS, inv: 0, sinceHurt: 99, regen: 0, perchT: 0, lastBeat: 0, holdT: 0, turnT: 0, pitchT: 0, airT: 0 });
  B.vel.set(0, 0, 0); B.kick.set(0, 0, 0); placeOnBranch();
  curBio = biomeAt(0, 0); curDanger = dangerLevel(0, 0);
  camS.init = false; PAL.init = false; camS.yaw = B.yaw;
  for (const s of shafts) s.x = 1e5;
  updateCells(true); rebuild();
}
function placeOnBranch(){ const b = birdS.branch; branchPoint(b, birdS.tt, birdS.pos); birdS.pos.y = branchTop(b, birdS.tt) + FOOT; }
function exitInfo(){ const B = birdS, dx = W.exit.x - B.pos.x, dz = W.exit.z - B.pos.z; return { d: Math.hypot(dx, dz), yaw: Math.atan2(dx, dz), x: W.exit.x, z: W.exit.z, a: W.exitA }; }

/* ---------- Flight ---------- */
function takeOff(){
  const B = birdS; if (B.mode === 'air' || !B.alive) return;
  const wasGround = B.mode === 'ground';
  B.mode = 'air'; B.branch = null; B.speed = 6; B.pitch = -0.55; B.flapT = 0.5; B.sq = 1.25; B.airT = 0;
  B.pos.y += 0.1; B.kick.set(0, wasGround ? 3 : 1.5, 0);
  sfx.launch(); burst(B.pos, PALS[curBio].leaves, 2, 2, 'leaf'); tutDone('takeoff');
}
function tapFlap(){ const B = birdS; if (B.mode !== 'air' || !B.alive) return; B.flapT = Math.max(B.flapT, 0.45); B.speed = Math.min(27, B.speed + 1.2); B.kick.y += 2.2; B.sq = 1.15; }
function settleGround(){ const B = birdS; B.mode = 'ground'; B.pos.y = FOOT; B.speed = 0; B.vel.set(0, 0, 0); B.sq = 0.75; B.perchT = 0; sfx.land('good'); burst(B.pos, PALS[curBio].leaves, 3, 1.5, 'leaf'); }
function land(b, tt){
  const B = birdS;
  if (b.kind === 'thorn'){ hurt(1, 'thorn', branchPoint(b, tt, new THREE.Vector3()).setY(b.y - 1)); B.kick.y += 5; return; }
  B.mode = 'perch'; B.branch = b; B.tt = tt; B.vel.set(0, 0, 0); B.speed = 0; B.sq = 0.7; B.perchT = 0; B.kick.set(0, 0, 0);
  placeOnBranch(); sfx.land('good');
  burst(branchPoint(b, 1.1, new THREE.Vector3()).setY(b.y + 0.6), b.tree.pal.leaves, 3, 2.5, 'leaf');
}
function bump(nx, nz){
  const B = birdS, hx = Math.sin(B.yaw), hz = Math.cos(B.yaw), dot = hx*nx + hz*nz, fast = B.speed;
  if (dot < 0){ const rx = hx - 1.6*dot*nx, rz = hz - 1.6*dot*nz; B.yaw += angD(Math.atan2(rx, rz), B.yaw); }
  B.speed = Math.max(3, B.speed * 0.45); B.stun = 0.45; B.kick.set(nx*3, 1, nz*3); B.sq = 0.8;
  shake = Math.max(shake, 0.25 + clamp(fast / 40, 0, 0.3)); burst(B.pos, FEATHER_COLS, 4, 2, 'feather'); burst(B.pos, [0x6a5040, 0x8a6a4c], 3, 2, 'leaf');
  if (fast > 17) hurt(1, 'trunk', null); else { sfx.hard(); popup(B.pos, 'Bonk', '', '#f2c1a8'); }
}
function stepAir(dt){
  const B = birdS;
  const hold = input.down && B.stun <= 0;
  if (B.flapT > 0) B.flapT -= dt;
  const flapping = hold || B.flapT > 0;
  const dx = hold ? clamp(input.dx, -110, 110) : 0, dy = hold ? clamp(input.dy, -110, 110) : 0;
  B.bank = damp(B.bank, clamp(dx / 80, -1, 1) * 0.9, 5, dt);
  B.yaw -= B.bank * 1.9 * dt;
  let pT = (flapping ? -0.06 : 0.2) + dy * 0.0105;
  if (B.speed < 5.5) pT = Math.max(pT, lerp(0.55, -0.1, clamp((B.speed - 2.5) / 3, 0, 1)));
  pT = clamp(pT, -0.95, 1.3);
  B.pitch = damp(B.pitch, pT, flapping ? 4.5 : 3, dt);
  if (flapping){ const vT = FLAP_V + G*Math.sin(B.pitch)*1.6; B.speed += (vT - B.speed) * (1 - Math.exp(-1.5*dt)); }
  else B.speed += (G*Math.sin(B.pitch) - DRAG_K*B.speed) * dt;
  if (B.stun > 0) B.speed *= 1 - 1.2*dt;
  B.speed = clamp(B.speed, 2.5, 27);
  const cp = Math.cos(B.pitch), sink = B.speed < 5.5 ? (5.5 - B.speed) * 0.9 : 0;
  B.vel.set(Math.sin(B.yaw)*cp*B.speed + B.kick.x, -Math.sin(B.pitch)*B.speed - sink + (flapping ? FLAP_LIFT * clamp((CEIL - B.pos.y) / 5, 0, 1) : 0) + B.kick.y, Math.cos(B.yaw)*cp*B.speed + B.kick.z);
  B.kick.multiplyScalar(Math.exp(-3*dt));
  B.prev.copy(B.pos); B.pos.addScaledVector(B.vel, dt);
  flownM += B.speed * dt; B.airT += dt;
  if (flapping){ B.wingT += dt * 15; B.flapAnim = 0.12; const beat = Math.floor(B.wingT / TAU); if (beat !== B.lastBeat){ B.lastBeat = beat; B.flaps = (B.flaps || 0) + 1; sfx.flap(); } }
  else { B.flapAnim = 0; B.wingT += dt * 2; }
  B.holding = !flapping; B.stall = 0;
  if (hold){ B.holdT += dt; if (Math.abs(dx) > 40) B.turnT += dt; if (Math.abs(dy) > 40) B.pitchT += dt; }
  // canopy ceiling
  if (B.pos.y > CEIL){ B.pos.y = CEIL; if (B.kick.y > 0) B.kick.y = 0; if (B.pitch < 0.05) B.pitch = damp(B.pitch, 0.05, 6, dt); }
  // forest floor: soft unless diving hard
  if (B.pos.y < FOOT){
    const vy = B.vel.y; B.pos.y = FOOT; if (B.kick.y < 0) B.kick.y = 0;
    if (vy < -13){ hurt(1, 'ground', null); B.speed *= 0.4; B.pitch = -0.3; burst(B.pos, PALS[curBio].leaves, 8, 3, 'leaf'); }
    else if (!flapping && B.speed < 8.5){ settleGround(); return; }
    else if (B.pitch > 0) B.pitch = Math.min(B.pitch, 0.02);
  }
  // trunks: bump, don't die
  nearTreesAt(B.pos.x, B.pos.z, _near);
  for (const t of _near){ if (B.pos.y > t.h * (t.dead ? 0.8 : 0.95)) continue;
    const ddx = B.pos.x - t.x, ddz = B.pos.z - t.z, d = Math.hypot(ddx, ddz) || 0.01, rr = trunkR(t, B.pos.y) + 0.28;
    if (d < rr){ const nx = ddx/d, nz = ddz/d; B.pos.x = t.x + nx*(rr + 0.05); B.pos.z = t.z + nz*(rr + 0.05); bump(nx, nz); break; } }
  // optional perching: glide slowly down onto a branch
  if (!flapping && B.vel.y < 0 && B.speed < 10.5){
    for (const t of _near) for (const b of t.branches){
      const px = B.pos.x - b.x0, pz = B.pos.z - b.z0, tt = (px*b.dx + pz*b.dz) / b.len; if (tt < 0.12 || tt > 0.98) continue;
      if (Math.abs(px*b.dz - pz*b.dx) > 0.8) continue;
      const top = branchTop(b, tt), f0 = B.prev.y - FOOT, f1 = B.pos.y - FOOT;
      if ((f0 >= top - 0.08 && f1 <= top + 0.05) || (f1 >= top - 0.05 && f1 - top < 0.45 && B.speed < 8)){ land(b, tt); return; } }
  }
  // the bramble wall around the forest (except the gap)
  const r = Math.hypot(B.pos.x, B.pos.z);
  if (r > R_EDGE - 6 && !inGap(B.pos.x, B.pos.z)){
    const nx = -B.pos.x / r, nz = -B.pos.z / r; const k = (R_EDGE - 6) / r; B.pos.x *= k; B.pos.z *= k;
    const hx = Math.sin(B.yaw), hz = Math.cos(B.yaw), dot = hx*nx + hz*nz;
    if (dot < 0.2){ const rx = hx - 1.4*(dot - 0.2)*nx, rz = hz - 1.4*(dot - 0.2)*nz; B.yaw += angD(Math.atan2(rx, rz), B.yaw) * Math.min(1, dt*6); }
    B.speed *= 1 - 0.8*dt;
    if (edgeHintT <= 0){ edgeHintT = 5; tempHint('edge', 'star', 'Too thick to pass. Look for the light', 3.5); sfx.hard(); burst(B.pos, [0x5a4e4a, 0x3a2e2a], 4, 2, 'leaf'); }
  }
  if (r > R_EDGE + 22 && inGap(B.pos.x, B.pos.z)) winRun();
}
function updateBird(dt){
  const B = birdS;
  if (state === 'title'){ placeOnBranch(); return; }
  B.hurt = Math.max(0, B.hurt - dt*1.6); B.inv = Math.max(0, B.inv - dt); B.sinceHurt += dt; B.stun = Math.max(0, B.stun - dt);
  B.sq = damp(B.sq, 1, 10, dt);
  if (!B.alive){
    B.vel.y -= G*dt; B.vel.x *= 1 - 0.8*dt; B.vel.z *= 1 - 0.8*dt; B.pos.addScaledVector(B.vel, dt);
    if (B.pos.y < FOOT){ B.pos.y = FOOT; B.vel.set(0, 0, 0); } B.bank = damp(B.bank, 1.2, 3, dt); B.pitch = damp(B.pitch, -0.2, 3, dt); B.wingT += dt*20; B.flapAnim = 0; B.holding = false; return;
  }
  if (state === 'won'){
    B.flapAnim = 0.12; B.wingT += dt*13; B.holding = false; B.pitch = damp(B.pitch, -0.3, 2, dt); B.bank = damp(B.bank, 0, 3, dt);
    const ex = exitInfo(); B.yaw += angD(Math.atan2(B.pos.x, B.pos.z), B.yaw) * Math.min(1, dt*1.5);
    const s = 10; B.vel.set(Math.sin(B.yaw)*s*Math.cos(B.pitch), -Math.sin(B.pitch)*s, Math.cos(B.yaw)*s*Math.cos(B.pitch)); B.pos.addScaledVector(B.vel, dt); B.pos.y = Math.min(B.pos.y, 40); return;
  }
  if (B.mode === 'perch' || B.mode === 'ground'){
    if (B.mode === 'perch') placeOnBranch(); else B.pos.y = FOOT;
    B.perchT += dt; B.vel.set(0, 0, 0); B.pitch = damp(B.pitch, 0, 8, dt); B.bank = damp(B.bank, 0, 8, dt); B.flapAnim = 0;
    if (input.down && B.stun <= 0) takeOff();
    return;
  }
  const n = Math.ceil(dt / 0.017), h = dt / n;
  for (let i=0;i<n && B.mode === 'air' && B.alive && state === 'play';i++) stepAir(h);
}

/* ---------- Health ---------- */
const CAUSE_TXT = { owl: 'Owl!', bat: 'Bats!', crow: 'Crows!', snake: 'Snake bite', hawk: 'Hawk!', trunk: 'Slammed a trunk', ground: 'Hit the ground', thorn: 'Thorns' };
function hurt(n, cause, from){
  const B = birdS; if (B.inv > 0 || !B.alive || state !== 'play' || DBG.god) return false;
  B.hearts = Math.max(0, B.hearts - n); B.inv = 1.6; HURTLOG.push({ cause, t: +runT.toFixed(1), bio: curBio, x: +B.pos.x.toFixed(0), z: +B.pos.z.toFixed(0), y: +B.pos.y.toFixed(1), sp: +(B.speed||0).toFixed(1) }); if (HURTLOG.length > 50) HURTLOG.shift(); B.hurt = 1; B.sinceHurt = 0; B.regen = 0; hurtCount++;
  if (from){ _v.copy(B.pos).sub(from); _v.y = Math.max(0.3, _v.y); _v.normalize(); B.kick.addScaledVector(_v, 6); }
  flash = 0.45; $('flash').classList.add('red'); shake = Math.max(shake, 0.45); hitStop = 0.06;
  burst(B.pos, FEATHER_COLS, 7, 3, 'feather'); sfx.ouch(); if (cause === 'hawk') sfx.screech(1); else if (cause === 'owl') sfx.hoot(1);
  popup(B.pos, CAUSE_TXT[cause] || 'Ouch', '-1 heart', '#ff9b80');
  hud.hearts = -1;
  if (B.hearts <= 0){
    B.alive = false; state = 'dying'; dieT = 0; deathCause = cause; slowmo = 0.4; B.mode = 'air';
    B.vel.set(B.vel.x*0.3, 2, B.vel.z*0.3); burst(B.pos, FEATHER_COLS, 16, 4, 'feather'); sfx.gameover();
  } else if (!TUT.heal){ tempHint('heal', 'star', 'Hearts heal slowly in calm places. Berries heal faster', 4.5); tutDone('heal'); }
  return true;
}
function updateHealth(dt){
  const B = birdS; if (state !== 'play' || !B.alive) return;
  const safe = curDanger.k < 0.05;
  if (safe && B.sinceHurt > 5 && B.hearts < MAX_HEARTS){
    B.regen += dt / (B.mode === 'air' ? 12 : 5);
    if (B.regen >= 1){ B.regen = 0; B.hearts++; hud.hearts = -1; sfx.berry(); popup(B.pos, '+1 heart', '', '#ffb3a6'); }
  }
}

/* ---------- Creatures ---------- */
function updateOwl(o, dt, inDanger){
  if (!o.obj) o.obj = getOwl();
  const B = birdS; o.flap += dt*9; const g = o.obj.g;
  const perched = o.state === 'sleep' || o.state === 'alert' || o.state === 'rest';
  if (perched){ branchPoint(o.b, o.tt, o.pos); o.pos.y = branchTop(o.b, o.tt); }
  const dd = o.pos.distanceTo(B.pos);
  if (o.state === 'sleep'){ if (inDanger && dd < 17 && B.alive){ o.state = 'alert'; o.timer = 0.9; sfx.hoot(0); } }
  else if (o.state === 'alert'){ o.timer -= dt; if (o.timer <= 0){ if (!inDanger || dd > 26) o.state = 'sleep';
      else { o.state = 'swoop'; o.timer = 1.7; _v.copy(B.pos).addScaledVector(B.vel, 0.45); o.vel.copy(_v).sub(o.pos).normalize().multiplyScalar(14); sfx.swoosh(0.6); } } }
  else if (o.state === 'swoop'){
    o.timer -= dt; _v.copy(B.pos).sub(o.pos).normalize().multiplyScalar(14); o.vel.lerp(_v, Math.min(1, dt*1.3)); o.pos.addScaledVector(o.vel, dt);
    if (B.alive && _v2.copy(o.pos).setY(o.pos.y + 0.6).distanceTo(B.pos) < 1.15){ hurt(1, 'owl', o.pos); o.timer = 0; }
    if (o.timer <= 0){ o.state = 'leave'; o.timer = 2.2; } }
  else if (o.state === 'leave'){ o.timer -= dt; o.vel.y = damp(o.vel.y, 6, 2, dt); o.pos.addScaledVector(o.vel, dt); if (o.timer <= 0) o.state = 'return'; }
  else if (o.state === 'return'){ branchPoint(o.b, o.tt, _v); _v.y = branchTop(o.b, o.tt); _v.sub(o.pos); const d = _v.length();
    if (d < 0.5){ o.state = 'rest'; o.timer = 7; } else { o.vel.copy(_v).multiplyScalar(Math.min(10, d*2) / d); o.pos.addScaledVector(o.vel, dt); } }
  else if (o.state === 'rest'){ o.timer -= dt; if (o.timer <= 0) o.state = 'sleep'; }
  g.visible = true; g.position.copy(o.pos);
  const flying = !perched;
  if (flying) g.rotation.set(0, Math.atan2(o.vel.x, o.vel.z), 0); else g.rotation.set(0, Math.atan2(B.pos.x - o.pos.x, B.pos.z - o.pos.z) * (o.state === 'sleep' ? 0.3 : 1), 0);
  o.obj.wings.forEach(w => { w.visible = flying; w.rotation.set(0.1, 0, 0.2 + 0.9*Math.sin(o.flap)); });
  const awake = o.state !== 'sleep' && o.state !== 'rest';
  o.obj.eyes.scale.y = awake ? 1 : 0.15; o.obj.eyeMat.color.setHex(awake ? 0xffb030 : 0x2a2014);
  o.obj.glow.material.opacity = o.state === 'alert' ? 0.6 + 0.4*Math.sin(time*30) : awake ? 0.5 : 0;
}
function updateFlock(f, dt, inDanger){
  const B = birdS, bat = f.kind === 'bat';
  const SP = bat ? 9.4 : 11, RR = bat ? 20 : 27, DUR = bat ? 7 : 6.5;
  f.cd = Math.max(0, f.cd - dt);
  const dHome = f.home.distanceTo(B.pos);
  if (f.state === 'idle'){ if (inDanger && B.alive && state === 'play' && dHome < RR && f.cd <= 0){ f.state = 'chase'; f.t = DUR; if (bat) sfx.bats(); else sfx.caw(); } }
  else { f.t -= dt; if (f.t <= 0 || (!inDanger && f.t < DUR - 1.2) || !B.alive || state !== 'play'){ f.state = 'idle'; f.cd = 6; } else if (!bat && Math.random() < dt*0.8) sfx.caw(); }
  for (const m of f.members){
    m.ph += dt * (bat ? 24 : f.state === 'chase' ? 14 : 7);
    let tx, ty, tz, sp;
    if (f.state === 'chase'){ tx = B.pos.x + Math.sin(time*3 + m.a)*1.3; ty = B.pos.y + Math.cos(time*2.3 + m.a)*0.7; tz = B.pos.z + Math.cos(time*3 + m.a)*1.3; sp = SP + (m.rr - 3)*0.35; }
    else { m.a += dt * (bat ? 1.7 : 0.6); const w = bat ? 1 : 2.6; tx = f.home.x + Math.sin(m.a)*m.rr*w; ty = f.home.y + Math.sin(m.a*1.7)*0.8; tz = f.home.z + Math.cos(m.a)*m.rr*w; sp = bat ? 6 : 7; }
    _v.set(tx - m.pos.x, ty - m.pos.y, tz - m.pos.z); const d = _v.length() || 0.001; _v.multiplyScalar(Math.min(sp, d*2) / d);
    m.vel.lerp(_v, Math.min(1, dt*(bat ? 4 : 2.6))); m.pos.addScaledVector(m.vel, dt);
    if (f.state === 'chase' && m.pos.distanceTo(B.pos) < 0.9){ if (hurt(1, f.kind, m.pos)){ f.state = 'idle'; f.cd = 4; } }
  }
}
function updateSnake(s, dt){
  const B = birdS; if (!s.pos) s.pos = new THREE.Vector3();
  branchPoint(s.b, s.tt, s.pos); s.pos.y = branchTop(s.b, s.tt) - 0.06;
  s.cd -= dt; s.strike = Math.max(0, s.strike - dt*2.5);
  const d = s.pos.distanceTo(B.pos);
  if (d < 2.8 && s.cd <= 0 && B.alive && state === 'play'){ s.cd = 2.2; s.strike = 1; sfx.hiss(); if (d < 2.1) hurt(1, 'snake', s.pos); }
  else if (d < 9 && s.cd <= 0 && Math.random() < dt*0.6) sfx.hiss(0.4);
  s.face = d < 12 ? Math.atan2(B.pos.x - s.pos.x, B.pos.z - s.pos.z) : s.b.ang + Math.sin(time*0.7 + s.ph)*0.6;
}
let creatureN = 0;
function updateCreatures(dt){
  const B = birdS, inDanger = curDanger.k > 0.35 && B.alive && !DBG.peace;
  let nb = 0, nc = 0, ns = 0, nbr = 0;
  for (const c of nearCells){
    if (c.d > 100){ for (const o of c.owls) if (o.obj){ o.obj.used = false; o.obj.g.visible = false; o.obj = null; } continue; }
    for (const o of c.owls) updateOwl(o, dt, inDanger);
    for (const f of c.flocks){ updateFlock(f, dt, inDanger);
      const bat = f.kind === 'bat', IB = bat ? CR.batB : CR.crowB, IW = bat ? CR.batW : CR.crowW;
      for (const m of f.members){ const i = bat ? nb : nc; if (i >= IB.instanceMatrix.count) break;
        const hs = Math.hypot(m.vel.x, m.vel.z); _qa.setFromEuler(_e.set(clamp(-Math.atan2(m.vel.y, hs), -0.6, 0.6), Math.atan2(m.vel.x, m.vel.z), Math.sin(m.ph*0.13)*0.3, 'YXZ'));
        const sc = bat ? 1.35 : 1.15; _m.compose(m.pos, _qa, _s.set(sc, sc, sc)); IB.setMatrixAt(i, _m);
        const fl = bat ? Math.sin(m.ph) : (f.state === 'chase' || Math.sin(m.ph*0.2) > 0 ? Math.sin(m.ph) : 0.35);
        _m.compose(m.pos, _qa, _s.set(sc, sc*fl*1.2, sc)); IW.setMatrixAt(i, _m);
        const ei = nb + nc; if (ei < CR.eyes.instanceMatrix.count){ if (bat) _m.compose(m.pos, _qa, _s.set(sc, sc, sc)); else { _v.set(0, 0.02, 0.09).applyQuaternion(_qa).add(m.pos); _m.compose(_v, _qa, _s.set(sc*0.9, sc*0.9, sc*0.9)); } CR.eyes.setMatrixAt(ei, _m); }
        if (bat) nb++; else nc++; } }
    for (const s of c.snakes){ updateSnake(s, dt); if (ns >= CR.snake.instanceMatrix.count) continue;
      _qa.setFromEuler(_e.set(0, s.face - 0.5, 0)); _v.copy(s.pos); if (s.strike > 0){ _v2.copy(B.pos).sub(s.pos).normalize().multiplyScalar(Math.sin(s.strike*Math.PI)*0.7); _v.add(_v2); }
      _m.compose(_v, _qa, _s.set(1.5, 1.5 + s.strike*0.5, 1.5)); CR.snake.setMatrixAt(ns++, _m); }
    if (c.d < 75) for (const b of c.berries){
      if (b.taken){ b.fade -= dt; b.respawn -= dt; if (b.respawn <= 0){ b.taken = false; b.fade = 1; } }
      else if (B.alive && state === 'play' && b.pos.distanceTo(B.pos) < 1.4){ b.taken = true; b.fade = 0.3; b.respawn = 45; berryCount++;
        if (B.hearts < MAX_HEARTS){ B.hearts++; hud.hearts = -1; popup(b.pos, '+1 heart', '', '#ffb3a6'); } else popup(b.pos, 'Yum', '', '#ffb3a6');
        spark(b.pos, 0xff8a7a, 9, 3); sfx.berry(); }
      const s = b.taken ? Math.max(0, b.fade/0.3) * 1.5 : 1; if (s <= 0 || nbr >= IM.berry.instanceMatrix.count) continue;
      _qa.setFromEuler(_e.set(0, time*0.8 + b.ph, 0)); _v.copy(b.pos); _v.y += Math.sin(time*2.2 + b.ph)*0.06;
      _m.compose(_v, _qa, _s.set(s*1.4, s*1.4, s*1.4)); IM.berry.setMatrixAt(nbr, _m); IM.berry.setColorAt(nbr, _c.setHex(0xb3242a)); nbr++; }
  }
  for (const [im, n] of [[CR.batB, nb], [CR.batW, nb], [CR.crowB, nc], [CR.crowW, nc], [CR.snake, ns], [IM.berry, nbr], [CR.eyes, Math.min(nb + nc, CR.eyes.instanceMatrix.count)]]){ im.count = n; im.visible = n > 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  creatureN = nb + nc + ns;
  // hawk patrols Thornwood
  if (curDanger.type === 'thorn' && curDanger.k > 0.5 && state === 'play') thornT += dt; else thornT = Math.max(0, thornT - dt*0.5);
  hawkCd = Math.max(0, hawkCd - dt);
  if (!hawk.on){
    if (state === 'play' && B.alive && thornT > 2.5 && hawkCd <= 0){ hawk = { on: true, phase: 'warn', t: 1.8, pos: new THREE.Vector3(), vel: new THREE.Vector3(), flap: 0, scr: 2.5, dur: 10 }; sfx.screech(0); }
  } else {
    hawk.flap += dt * (hawk.phase === 'chase' ? 9 : 7);
    const behind = _v.set(-Math.sin(B.yaw), 0, -Math.cos(B.yaw));
    if (hawk.phase === 'warn'){ hawk.t -= dt; hawk.pos.copy(B.pos).addScaledVector(behind, 34); hawk.pos.y += 5; if (hawk.t <= 0){ hawk.phase = 'chase'; hawk.t = hawk.dur; } }
    else if (hawk.phase === 'chase'){
      hawk.t -= dt; hawk.scr -= dt;
      if (curDanger.k < 0.2) hawk.t = Math.min(hawk.t, 1.2);
      const to = _v2.copy(B.pos).sub(hawk.pos); const dist = to.length();
      const sp = 11 + (dist > 30 ? (dist - 30) * 0.8 : 0);
      hawk.vel.lerp(to.normalize().multiplyScalar(sp), Math.min(1, dt*3)); hawk.pos.addScaledVector(hawk.vel, dt);
      if (hawk.scr < 0){ hawk.scr = fr(2.5, 4); sfx.screech(0); }
      if (B.alive && hawk.pos.distanceTo(B.pos) < 1.2){ hurt(1, 'hawk', hawk.pos); hawk.phase = 'leave'; hawk.t = 3; }
      if (hawk.t <= 0 && hawk.phase === 'chase'){ hawk.phase = 'leave'; hawk.t = 3; if (B.alive){ popup(B.pos, 'Lost the hawk', '', '#ffd77a'); sfx.escape(); } }
    } else { hawk.t -= dt; hawk.vel.y = damp(hawk.vel.y, 10, 2, dt); hawk.pos.addScaledVector(hawk.vel, dt); if (hawk.t <= 0){ hawk = { on: false }; hawkCd = 22; thornT = 0; } }
  }
  hawkObj.visible = !!hawk.on && hawk.phase !== 'warn';
  if (hawkObj.visible){ hawkObj.position.copy(hawk.pos); hawkModel.rotation.set(clamp(-Math.atan2(hawk.vel.y, Math.hypot(hawk.vel.x, hawk.vel.z)), -0.6, 0.6), Math.atan2(hawk.vel.x, hawk.vel.z), 0);
    const f = Math.sin(hawk.flap); hawkWings.forEach(w => w.rotation.set(0, 0.15, 0.15 + 0.75*f)); }
}
function chasing(){ if (hawk.on && hawk.phase === 'chase') return true; for (const c of nearCells){ if (c.d > 60) continue; for (const f of c.flocks) if (f.state === 'chase') return true; for (const o of c.owls) if (o.state === 'swoop' || o.state === 'alert') return true; } return false; }
/* ---------- Visual updates ---------- */
const BSCALE = 1.35;
const WPv = [0, 0.1, -1.08, 0.3, 1.48, -0.12];
let tailFan = 0.15, tailPitch = -0.2, fanKick = 0, prevMode = 'perch', headYaw = 0, headYawT = 0, headTimer = 1, lastVisT = 0;
function updateBirdVisual(){
  const B = birdS; const dt = clamp(time - lastVisT, 0, 0.05); lastVisT = time;
  birdObj.visible = !B.hidden;
  birdObj.position.copy(B.pos);
  let pitch = B.pitch, bank = B.bank;
  
  birdModel.rotation.set(pitch, B.yaw, -bank);
  const sq = B.sq, k = BSCALE; birdModel.scale.set(k/Math.sqrt(Math.max(0.4, sq)), k*sq, k/Math.sqrt(Math.max(0.4, sq)));
  if (B.mode !== prevMode){ if (B.mode === 'perch' || B.mode === 'ground') fanKick = 1; prevMode = B.mode; }
  fanKick = Math.max(0, fanKick - dt*1.5);
  const perch = (B.mode === 'perch' || B.mode === 'ground') && B.alive && state !== 'won';
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
  const hr = (B.hurt > 0 ? B.hurt*0.45 : 0) + (B.inv > 0 && B.alive ? 0.12*(0.5 + 0.5*Math.sin(time*30)) : 0); for (const m of BIRD_MATS) m.emissive.setRGB(hr, 0, 0);
}

/* ---------- Palette, guidance and camera ---------- */
const PCK = ['fog','skyT','hemiS','hemiG','sun','shaft'], PNK = ['fogD','sunI','hemiI','shaftA','night'];
const PCUR = {}, PTGT = {}; for (const k of PCK){ PCUR[k] = new THREE.Color(); PTGT[k] = new THREE.Color(); }
function applyPalette(dt){
  const B = birdS, bx = B.pos.x, bz = B.pos.z;
  const P = PALS[curBio]; PAL.P = P;
  // near a danger border the calm palette darkens toward the danger one (edge warning)
  const kd = P.danger ? 1 : curDanger.k * 0.75, D = PALS[curDanger.type];
  const r = Math.hypot(bx, bz), aw = Math.abs(angD(Math.atan2(bx, bz), W.exitA)) * r;
  const km = state === 'won' ? 1 : sstep(R_EDGE - 150, R_EDGE + 10, r) * sstep(130, 40, aw);
  const base = P.danger ? P : (curBio === 'edge' ? PALS.edge : P);
  for (const k of PCK){ PTGT[k].copy(base['c_' + k]).lerp(D['c_' + k], P.danger ? 0 : kd).lerp(PALS.meadow['c_' + k], km); }
  const nums = {}; for (const k of PNK){ nums[k] = lerp(lerp(base[k], D[k], P.danger ? 0 : kd), PALS.meadow[k], km); }
  const a = PAL.init ? 1 - Math.exp(-dt * 1.1) : 1; PAL.init = true;
  for (const k of PCK) PCUR[k].lerp(PTGT[k], a);
  for (const k of PNK) PAL[k] = lerp(PAL[k] === undefined ? nums[k] : PAL[k], nums[k], a);
  PAL.bog = lerp(PAL.bog, curDanger.type === 'bog' ? curDanger.k : 0, a);
  PAL.night = clamp(PAL.night, 0, 1);
  scene.fog.color.copy(PCUR.fog); scene.background.copy(PCUR.fog); scene.fog.density = PAL.fogD;
  // the sun hangs low over the way out, so sky glow, light shafts and shadows all lean toward the exit
  const ex = W.exit.x - bx, ez = W.exit.z - bz, ed = Math.hypot(ex, ez) || 1;
  SUN_DIR.set(ex/ed*0.8, 0.52, ez/ed*0.8).normalize(); skyU.uSunDir.value.copy(SUN_DIR);
  skyU.uHor.value.copy(PCUR.fog).convertLinearToSRGB();
  skyU.uTop.value.copy(PCUR.skyT).convertLinearToSRGB();
  skyU.uSun.value.copy(PCUR.sun).convertLinearToSRGB().multiplyScalar(1 - PAL.night*0.55);
  skyU.uNight.value = PAL.night;
  hemi.color.copy(PCUR.hemiS); hemi.groundColor.copy(PCUR.hemiG); hemi.intensity = PAL.hemiI;
  sunL.color.copy(PCUR.sun); sunL.intensity = PAL.sunI;
  MAT.ground.color.setRGB(1, 1, 1); MAT.shaft.color.copy(PCUR.shaft); sunSprite.material.color.copy(PCUR.sun);
  PAL.shaftA = PAL.shaftA;
  moon.material.opacity = PAL.night; sunSprite.material.opacity = 0.5 * (1 - PAL.night);
  // exit glow beacon, unfogged so it reads through the trees
  // beacon sits out in the meadow beyond the gap (or 150 m toward it when far away)
  const mx = Math.sin(W.exitA)*(R_EDGE + 90) - bx, mz = Math.cos(W.exitA)*(R_EDGE + 90) - bz, md = Math.hypot(mx, mz) || 1;
  const gd = Math.min(md, 150), gx = bx + mx/md*gd, gz = bz + mz/md*gd;
  const near = sstep(420, 60, ed), fadeOut = sstep(10, 70, md);
  exitGlow.position.set(gx, 12 + 8*(1 - near), gz); exitGlow.scale.setScalar(80 + 40*near);
  exitGlow.material.opacity = (0.28 + 0.3*near) * fadeOut * (0.9 + 0.1*Math.sin(time*1.3)) * (state === 'title' ? 0.6 : 1);
  exitCore.position.copy(exitGlow.position); exitCore.scale.setScalar(24 + 14*near); exitCore.material.opacity = (0.25 + 0.3*near) * fadeOut;
}
function updateCamera(dt, snap){
  const B = birdS; const k = snap || !camS.init ? 1 : 0;
  const spd = B.mode === 'air' ? B.speed || 0 : 0;
  let desired, look;
  if (state === 'title'){
    const a = B.yaw + 1.65 + Math.sin(time*0.25)*0.3;
    desired = _v.set(B.pos.x + Math.sin(a)*3.0, B.pos.y + 0.75, B.pos.z + Math.cos(a)*3.0);
    look = _v2.set(B.pos.x, B.pos.y + 0.45, B.pos.z);
    camS.fov = 50; camS.yaw = B.yaw;
  } else {
    const perch = B.mode !== 'air' && B.alive;
    camS.yaw = k ? B.yaw : damp(camS.yaw, B.yaw, perch ? 4 : 3.4, dt);
    let back = perch ? 3.9 : 4.4, up = perch ? 1.35 : 1.25;
    if (!perch){ up += clamp(B.pitch, -0.5, 1.2) * 0.85; back += clamp((spd - 10)/16, 0, 1) * 1.2; }
    if (hawk.on && hawk.phase === 'chase'){ back += 1.5; up += 0.6; }
    if (!B.alive){ back = 6; up = 2.5; }
    if (state === 'won'){ back = 6 + winT*3; up = 1.5 + winT*1.2; }
    desired = _v.set(B.pos.x - Math.sin(camS.yaw)*back, B.pos.y + up, B.pos.z - Math.cos(camS.yaw)*back);
    desired.y = Math.max(desired.y, 0.8);
    // keep the camera out of trunks
    nearTreesAt(desired.x, desired.z, _near);
    for (const t of _near){ const dx = desired.x - t.x, dz = desired.z - t.z, d = Math.hypot(dx, dz) || 0.01, rr = trunkR(t, desired.y) + 0.35; if (d < rr){ desired.x = t.x + dx/d*rr; desired.z = t.z + dz/d*rr; } }
    const ahead = perch ? 11 : 7;
    look = _v2.set(B.pos.x + Math.sin(camS.yaw)*ahead, B.pos.y + (perch ? 0.4 : -clamp(B.pitch, -0.6, 1.2)*1.7 + 0.2), B.pos.z + Math.cos(camS.yaw)*ahead);
    camS.fov = 62 + clamp((spd - 11) / 14, 0, 1) * 18;
  }
  if (k){ camera.position.copy(desired); camS.look.copy(look); camS.init = true; }
  else { const kp = state === 'title' ? 3 : 5.5; camera.position.x = damp(camera.position.x, desired.x, kp, dt); camera.position.y = damp(camera.position.y, desired.y, kp, dt); camera.position.z = damp(camera.position.z, desired.z, kp, dt); camS.look.lerp(look, 1 - Math.exp(-8*dt)); }
  camera.lookAt(camS.look);
  camS.roll = damp(camS.roll, B.mode === 'air' ? -B.bank * 0.35 : 0, 4, dt);
  camera.rotateZ(camS.roll);
  if (shake > 0){ camera.position.x += fr(-1,1)*shake*0.3; camera.position.y += fr(-1,1)*shake*0.3; }
  if (Math.abs(camera.fov - camS.fov) > 0.05){ camera.fov = damp(camera.fov, camS.fov, 4, dt); if (k) camera.fov = camS.fov; camera.updateProjectionMatrix(); }
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
sfx.bats = () => { for (let i=0;i<7;i++) tone('sine', fr(5200, 7400), fr(3800, 5200), 0.03, 0.035, i*0.07 + fr(0, 0.03), fr(-0.7, 0.7)); noise(0.5, 0.12, 'bandpass', 900, 1400, 1.5); };
sfx.caw = () => { const p = fr(-0.6, 0.6), f = fr(380, 460); for (let k=0;k<2;k++){ tone('sawtooth', f, f*0.7, 0.16, 0.06, k*0.22, p); noise(0.16, 0.12, 'bandpass', 1400, 900, 3, k*0.22, p); } };
sfx.hiss = (v) => { noise(0.45, 0.22*(v || 1), 'highpass', 4200, 5200, 0.7); };
sfx.win = () => { [523, 659, 784, 1046, 1318].forEach((f,i) => { tone('triangle', f, 0, 0.5, 0.12, i*0.12); tone('sine', f*2, 0, 0.4, 0.04, i*0.12 + 0.05); }); };
sfx.heart = () => { tone('sine', 660, 990, 0.12, 0.08); };
function updateAudio(dt){
  if (!AU.c) return;
  const now = AU.c.currentTime;
  if (!AU.drone){ try { const c = AU.c, g = c.createGain(); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 2;
      for (const fq of [55, 55.8, 82.4]){ const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.connect(f); o.start(); }
      f.connect(g); g.connect(AU.m); AU.drone = g; AU.droneF = f; } catch(e){ AU.drone = { gain: { setTargetAtTime(){} } }; } }
  const B = birdS, play = state === 'play';
  const sp = (play && B.mode === 'air') ? (B.speed || 0) * 32 : 0;
  const wv = soundOn ? clamp((sp - 220) / 800, 0, 1) * 0.55 : 0;
  AU.windG.gain.setTargetAtTime(wv, now, 0.12);
  AU.windF.frequency.setTargetAtTime(300 + sp*1.5, now, 0.1);
  const dk = play ? curDanger.k : 0, ch = play && chasing() ? 1 : 0;
  AU.drone.gain.setTargetAtTime(soundOn ? dk*0.09 + ch*0.06 : 0, now, 0.6);
  if (AU.droneF && AU.droneF.frequency) AU.droneF.frequency.setTargetAtTime(200 + ch*260, now, 0.4);
  AU.amb.gain.setTargetAtTime(0.22 * (1 - dk*0.5), now, 0.5);
  AU.nextChirp -= dt;
  if (AU.nextChirp < 0 && state !== 'paused'){
    AU.nextChirp = fr(2.2, 5.5);
    if (dk > 0.5){ if (curDanger.type === 'bog'){ tone('sine', 180, 120, 0.25, 0.05, 0, fr(-0.6,0.6)); tone('sine', 160, 110, 0.25, 0.04, 0.3, fr(-0.6,0.6)); } else if (PAL.night > 0.5 && Math.random() < 0.4) sfx.hoot(0); else if (Math.random() < 0.3) sfx.caw(); }
    else if (dk < 0.1) chirp();
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
  heart: '<svg viewBox="0 0 24 22"><path d="M12 20.5C5 15.6 1.5 12 1.5 7.4 1.5 4.1 4 1.6 7 1.6c2.1 0 3.8 1.1 5 2.9 1.2-1.8 2.9-2.9 5-2.9 3 0 5.5 2.5 5.5 5.8 0 4.6-3.5 8.2-10.5 13.1z" fill="#d2372e" stroke="#5a1210" stroke-width="1.1"/><path d="M6.2 5.2c-1.3.4-2 1.5-2 2.8" stroke="#ffb8a8" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
};
const CAUSE = {
  owl:   { text:'Snatched by an owl', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2b3550"/><ellipse cx="32" cy="38" rx="14" ry="16" fill="#6a5845"/><ellipse cx="32" cy="42" rx="9" ry="10" fill="#d7c6a6"/><ellipse cx="32" cy="24" rx="13" ry="10" fill="#6a5845"/><path d="M20 20l-2-10 8 7M44 20l2-10-8 7" fill="#6a5845"/><circle cx="26.5" cy="24" r="5" fill="#cdb894"/><circle cx="37.5" cy="24" r="5" fill="#cdb894"/><circle cx="26.5" cy="24" r="3.4" fill="#f2a51c"/><circle cx="37.5" cy="24" r="3.4" fill="#f2a51c"/><circle cx="26.5" cy="24" r="1.7" fill="#120a04"/><circle cx="37.5" cy="24" r="1.7" fill="#120a04"/><path d="M30.5 28h3L32 32z" fill="#3a2c1e"/></svg>' },
  hawk:  { text:'Caught by the hawk', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#7a2a18"/><path d="M32 34c-5-7-13-11-26-11 6 3 9 6 12 10 5 0 8 2 10 5l-3 9 7-4 7 4-3-9c2-3 5-5 10-5 3-4 6-7 12-10-13 0-21 4-26 11z" fill="#f4ecd8"/><circle cx="32" cy="29" r="3.6" fill="#f4ecd8"/><path d="M32 28.5l4 1.8-4 1.3z" fill="#e2b04a"/></svg>' },
  bat:   { text:'Swarmed by bats', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1e2236"/><path d="M32 26c-2-3-2-6-2-8l2 3 2-3c0 2 0 5-2 8zM32 27c-6-6-14-8-24-6 4 2 6 5 6 9 3-2 6-1 8 1 2-2 4-2 6 0 1 2 3 3 4 3s3-1 4-3c2-2 4-2 6 0 2-2 5-3 8-1 0-4 2-7 6-9-10-2-18 0-24 6z" fill="#cdbfe6"/><circle cx="30" cy="29" r="1" fill="#ff5a40"/><circle cx="34" cy="29" r="1" fill="#ff5a40"/></svg>' },
  crow:  { text:'Mobbed by crows', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#3a2e38"/><path d="M14 36c6-2 10-6 14-12 4-5 10-6 14-3l8 1-6 3c0 6-4 12-12 14l-4 8-2-7c-5 0-9-1-12-4z" fill="#f4ecd8"/><circle cx="40" cy="24" r="1.6" fill="#3a2e38"/></svg>' },
  snake: { text:'Bitten by a bog snake', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2f3a22"/><path d="M14 44c6 6 16 6 18-2s-10-8-8-16 14-8 18-4" fill="none" stroke="#c8d890" stroke-width="5" stroke-linecap="round"/><ellipse cx="45" cy="22" rx="6" ry="4" fill="#c8d890"/><path d="M50 22l6-2m-6 2l6 2" stroke="#d2372e" stroke-width="1.5"/></svg>' },
  trunk: { text:'Too many hard knocks', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#5a3f2a"/><rect x="24" y="6" width="16" height="52" rx="3" fill="#8a6a4c"/><path d="M28 10v44M35 8v46" stroke="#5a4030" stroke-width="1.6"/><path d="M10 26l8 4-8 4M54 24l-7 5 7 5" stroke="#f4ecd8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  ground:{ text:'Dived into the forest floor', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2f4a35"/><path d="M8 46c8-3 14-2 24-2s17-1 24 2v8H8z" fill="#5b4a32"/><path d="M32 12v18m0 0l-6-6m6 6l6-6" stroke="#f4ecd8" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  thorn: { text:'Tangled in thorns', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#4a2a26"/><path d="M10 40c14-6 30-10 44-22" stroke="#c8a8a0" stroke-width="3" fill="none"/><path d="M18 37l-3-6M26 34l1-7M34 30l-4-5M42 25l3-6M48 21l-4-3" stroke="#c8a8a0" stroke-width="2.4" stroke-linecap="round"/></svg>' },
};
const HINT_ICO = {
  drag: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="12" cy="22" r="5" fill="#f4ecd8"/><path d="M14 20l9-9" stroke="#f4ecd8" stroke-width="2" stroke-dasharray="2 2.5"/><path d="M19 9.5h5v5" fill="none" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/>',
  hold: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="19" r="5.5" fill="#f4ecd8"/><circle cx="17" cy="19" r="9.5" fill="none" stroke="#e2b04a" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M6 11c4-3 7-3 11 0 4-3 7-3 11 0" fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linecap="round"/>',
  dive: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><path d="M9 8c2 8 5 13 9 15s7 0 9-4" fill="none" stroke="#f4ecd8" stroke-width="2.2" stroke-linecap="round"/><path d="M24 15l3.5 4-5 1" fill="none" stroke="#e2b04a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  tap:  '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="20" r="4.5" fill="#f4ecd8"/><path d="M17 4v6M9 8l3 4M25 8l-3 4" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/>',
  turn: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="19" r="4.5" fill="#f4ecd8"/><path d="M8 19h-3m3 0l2.5-2.5M8 19l2.5 2.5M26 19h3m-3 0l-2.5-2.5M26 19l-2.5 2.5" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/><path d="M9 10c5-4 11-4 16 0" fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linecap="round"/>',
  star: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><path d="M17 7l2.6 5.6 6 .7-4.5 4.1 1.2 6L17 20.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="#e2b04a"/>',
  warn: '<circle cx="17" cy="17" r="16" fill="#6a2018"/><path d="M17 8v11" stroke="#f4ecd8" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="24.5" r="1.9" fill="#f4ecd8"/>',
};
let hintKey = '', tempH = null;
function showHint(key, ico, text){
  if (hintKey === key) return; hintKey = key;
  if (!key){ $('hint').classList.add('hidden'); return; }
  $('hintIco').innerHTML = HINT_ICO[ico]; $('hintText').textContent = text;
  const el = $('hint'); el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden');
}
function tempHint(key, ico, text, dur){ tempH = { key, ico, text, t: dur }; }
function tutDone(k){ if (!TUT[k]){ TUT[k] = 1; store.set('fw4_tut', TUT); } }
function updateHints(dt){
  if (state !== 'play') return showHint('', '', '');
  if (tempH){ tempH.t -= dt; if (tempH.t > 0) return showHint(tempH.key, tempH.ico, tempH.text); tempH = null; }
  const B = birdS;
  if (B.mode !== 'air'){
    if (!B.flown) return showHint('takeoff', 'tap', 'Tap or hold anywhere to take off');
    if (B.perchT > 1.2 && B.hearts < MAX_HEARTS) return showHint('rest', 'hold', 'Resting heals faster. Tap to fly on');
    return showHint('', '', '');
  }
  if (!TUT.hold){ if (B.holdT > 1.5) tutDone('hold'); else return showHint('hold', 'hold', 'Hold to keep flapping. Let go to glide'); }
  if (!TUT.turn){ if (B.turnT > 0.6) tutDone('turn'); else return showHint('turn', 'turn', 'While holding, drag left or right to turn'); }
  if (!TUT.pitch){ if (B.pitchT > 0.5) tutDone('pitch'); else return showHint('pitch', 'dive', 'Drag down to dive, drag up to climb'); }
  if (!TUT.light && B.airT > 2){ tutDone('light'); tempHint('light', 'star', 'Find the way out. Follow the warm light', 5); return; }
  if (curDanger.k > 0.05 && !TUT.danger){ tutDone('danger'); tempHint('danger', 'warn', 'Dark places hide hungry creatures. Go around, or fly fast', 5); return; }
  if (runT > 100 && !TUT.compass && compassCd <= 0){ tutDone('compass'); tempHint('compass', 'star', 'Lost? Tap the compass for a hint', 4); return; }
  showHint('', '', '');
}
const hud = { hearts: -1, t: -1, area: '' };
function fmtTime(s){ s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }
function buildHearts(){ let s = ''; for (let i=0;i<MAX_HEARTS;i++) s += ICON.heart; $('hearts').innerHTML = s; }
function updateHUD(){
  const B = birdS;
  const ts = Math.floor(runT); if (hud.t !== ts){ hud.t = ts; $('score').textContent = fmtTime(runT); }
  if (hud.hearts !== B.hearts){ const kids = $('hearts').children;
    for (let i=0;i<MAX_HEARTS;i++){ const k = kids[i], on = i < B.hearts; if (k.classList.contains('off') === on){ k.classList.toggle('off', !on); k.classList.remove('pop'); void k.getBoundingClientRect(); k.classList.add('pop'); } }
    $('hearts').classList.toggle('low', B.hearts <= 1); hud.hearts = B.hearts; }
  const P = PALS[curBio]; if (hud.area !== P.name){ hud.area = P.name; $('distv').textContent = P.name; $('dist').classList.toggle('bad', !!P.danger); }
  let showHawk = false;
  if (hawk.on && (hawk.phase === 'warn' || hawk.phase === 'chase')){ _v.copy(hawk.pos).project(camera); showHawk = hawk.phase === 'warn' || _v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1; }
  $('hawkWarn').classList.toggle('hidden', !showHawk || state !== 'play');
  if (showHawk) $('hawkBar').style.width = (hawk.phase === 'chase' ? hawk.t / hawk.dur * 100 : 100) + '%';
  const ch = chasing() ? 1 : 0, low = B.hearts <= 1 && B.alive ? 0.25 : 0;
  const dv = Math.max(curDanger.k * 0.32, ch * (0.55 + 0.25*Math.sin(time*9)), low * (0.7 + 0.3*Math.sin(time*5)));
  $('danger').style.opacity = (state === 'play' ? dv : 0).toFixed(3);
  // compass
  const cOn = compassT > 0 && state === 'play'; $('compass').classList.toggle('show', cOn);
  if (cOn){ const ex = exitInfo(), rel = angD(ex.yaw, camS.yaw); $('needle').style.transform = 'rotate(' + (-rel * 180 / Math.PI).toFixed(1) + 'deg)'; $('compassDist').textContent = Math.round(Math.max(0, ex.d - 15) / 10) * 10 + ' m'; }
  const cb = $('compassBtn'); cb.classList.toggle('cool', compassCd > 0); cb.style.setProperty('--cd', (compassCd > 0 ? compassCd / 20 : 0).toFixed(3));
}
let bannerT = 0, bioStable = 0, bioPending = '';
function showBanner(P){ $('bannerZ').textContent = P.name; $('bannerS').textContent = P.sub; $('banner').classList.toggle('bad', !!P.danger); $('banner').classList.add('show'); bannerT = 3; if (P.danger) tone('sine', 110, 80, 0.9, 0.08); else sfx.chime(); }
function updateBiome(dt){
  const B = birdS; const b = biomeAt(B.pos.x, B.pos.z); curDanger = dangerLevel(B.pos.x, B.pos.z);
  if (b !== bioPending){ bioPending = b; bioStable = 0; } else bioStable += dt;
  if (bioStable > 0.4 && curBio !== b){ curBio = b; dirty = true; }
  if (state === 'play' && curBio !== lastBanner && bioStable > 0.8){ const P = PALS[curBio]; if (!lastBanner || P.name !== PALS[lastBanner].name) showBanner(P); lastBanner = curBio; }
  if (state === 'play' && curDanger.k > 0.5) dangerT += dt;
}
function setScreen(name){
  for (const s of ['title', 'pause', 'over', 'win']) $(s).classList.toggle('hidden', name !== s);
  $('hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
  if (name !== 'play'){ $('hawkWarn').classList.add('hidden'); $('danger').style.opacity = 0; $('compass').classList.remove('show'); }
}
function startRun(sd){
  resetWorld(sd === undefined ? W.seed : sd); state = 'play'; flash = 0.25; $('flash').classList.remove('red');
  hud.hearts = -1; hud.t = -1; hud.area = ''; birdS.flown = false; tempH = null;
  setScreen('play'); updateCamera(0, true);
}
function titleBestText(){ return bestTime ? 'Best escape<b>' + fmtTime(bestTime) + '</b>' : 'Find the way out<b>&nbsp;</b>'; }
function toTitle(){ resetWorld(newSeed()); state = 'title'; setScreen('title'); $('titleBest').innerHTML = titleBestText(); camS.init = false; }
function pauseGame(){ if (state !== 'play') return; state = 'paused'; setScreen('pause'); input.down = false; input.id = null; }
function resumeGame(){ if (state !== 'paused') return; state = 'play'; setScreen('play'); last = performance.now(); }
function showOver(){
  state = 'over';
  const C = CAUSE[deathCause] || CAUSE.owl;
  $('causeIco').innerHTML = C.ico.replace(/^<svg[^>]*>|<\/svg>$/g, ''); $('causeText').textContent = C.text;
  $('overScore').textContent = fmtTime(runT);
  const ex = exitInfo(); $('overLeft').textContent = Math.max(0, Math.round((ex.d - 15) / 10) * 10) + ' m';
  $('stDist').textContent = Math.round(flownM).toLocaleString('en-US'); $('stBerry').textContent = berryCount; $('stDanger').textContent = fmtTime(dangerT);
  setScreen('over');
}
function winRun(){
  if (state !== 'play') return; state = 'won'; winT = 0; flash = 0.7; $('flash').classList.remove('red'); input.down = false;
  const t = runT, nb = !bestTime || t < bestTime; if (nb){ bestTime = t; store.set('fw4_best', t); }
  lastWin = { t, nb, hearts: birdS.hearts, route: dangerT > 12 ? 'Straight through the dark' : dangerT > 3 ? 'Skirted the shadows' : 'The long, safe way round' };
  sfx.win(); spark(birdS.pos, 0xfff0b0, 30, 5);
}
function showWin(){
  const w = lastWin; state = 'winscreen';
  $('winTime').textContent = fmtTime(w.t); $('winBest').textContent = fmtTime(bestTime); $('winNew').classList.toggle('hidden', !w.nb);
  $('winDist').textContent = Math.round(flownM).toLocaleString('en-US'); $('winHearts').textContent = w.hearts + '/' + MAX_HEARTS; $('winBerry').textContent = berryCount;
  $('winRoute').textContent = w.route; $('winSeed').textContent = 'Forest #' + W.seed;
  setScreen('win');
}

/* ---------- Input ---------- */
function onDown(e){
  e.preventDefault(); audioInit(); if (input.id !== null) return;
  Object.assign(input, { id: e.pointerId, down: true, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, dx: 0, dy: 0 });
  if (state !== 'play') return;
  const B = birdS; if (B.mode !== 'air' && B.alive){ takeOff(); B.flown = true; }
}
function onMove(e){
  if (input.id === null || e.pointerId !== input.id) return; e.preventDefault();
  input.x = e.clientX; input.y = e.clientY; input.moved = Math.max(input.moved, Math.hypot(input.x - input.sx, input.y - input.sy));
  // virtual stick: offset from where the finger landed; the anchor follows if you push past the rim
  let dx = input.x - input.sx, dy = input.y - input.sy; const L = Math.hypot(dx, dy), RIM = 110;
  if (L > RIM){ input.sx += dx * (1 - RIM / L); input.sy += dy * (1 - RIM / L); dx = input.x - input.sx; dy = input.y - input.sy; }
  input.dx = dx; input.dy = dy;
}
function onUp(e){
  if (input.id === null || e.pointerId !== input.id) return; e.preventDefault();
  const quick = performance.now() - input.t0 < 230 && input.moved < 18;
  input.id = null; input.down = false; input.dx = 0; input.dy = 0;
  if (state === 'play' && quick) tapFlap();
}
canvas.addEventListener('pointerdown', onDown, { passive: false });
window.addEventListener('pointermove', onMove, { passive: false });
window.addEventListener('pointerup', onUp, { passive: false });
window.addEventListener('pointercancel', onUp, { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
// keyboard (desktop): Space/W = flap, arrows/A/D steer, S/down dive
const keys = {};
function keyInput(){ if (input.id !== null && input.id !== 'kb') return;
  const any = keys.Space || keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown || keys.KeyA || keys.KeyD || keys.KeyW || keys.KeyS;
  input.id = any ? 'kb' : null; input.down = !!any;
  input.dx = ((keys.ArrowRight || keys.KeyD) ? 70 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 70 : 0);
  input.dy = ((keys.ArrowDown || keys.KeyS) ? 70 : 0) - ((keys.ArrowUp || keys.KeyW) ? 45 : 0);
  if (any && state === 'play' && birdS.mode !== 'air' && birdS.alive){ takeOff(); birdS.flown = true; } }
window.addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP'){ state === 'play' ? pauseGame() : resumeGame(); return; } if (e.code === 'KeyC') useCompass();
  if (!keys[e.code]){ keys[e.code] = true; audioInit(); keyInput(); } if (e.code === 'Space') e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; keyInput(); });
function useCompass(){ if (state !== 'play' || compassCd > 0) return; compassT = 6; compassCd = 20; sfx.chime(); tutDone('compass'); }
function btn(id, fn){ $(id).addEventListener('click', e => { e.preventDefault(); audioInit(); sfx.ui(); fn(); }); }
btn('playBtn', () => startRun()); btn('soundBtn', () => setSound(!soundOn)); btn('soundBtn2', () => setSound(!soundOn));
btn('pauseBtn', pauseGame); btn('resumeBtn', resumeGame); btn('restartBtn', () => startRun()); btn('quitBtn', toTitle);
btn('againBtn', () => startRun()); btn('newForestBtn', () => startRun(newSeed())); btn('titleBtn', toTitle);
btn('winAgainBtn', () => startRun(newSeed())); btn('winTitleBtn', toTitle);
$('compassBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); useCompass(); });
document.addEventListener('visibilitychange', () => { if (document.hidden){ pauseGame(); if (AU.c) AU.c.suspend().catch(()=>{}); } else if (AU.c && soundOn) AU.c.resume().catch(()=>{}); });

/* ---------- Loop ---------- */
let last = performance.now(), fps = 60, fpsN = 0, fpsT = 0;
function frame(now){
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsN++; fpsT += dt; if (fpsT >= 1){ fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  if (state === 'paused'){ renderer.render(scene, camera); return; }
  updateQuality();
  simStep(dt);
  renderer.render(scene, camera);
}
function simStep(dt){
  time += dt; WIND.value = time;
  if (hitStop > 0){ hitStop -= dt; dt *= 0.08; }
  if (slowmo < 1) slowmo = Math.min(1, slowmo + dt*0.9);
  const gdt = dt * slowmo;
  if (state === 'play') runT += gdt;
  updateBird(gdt);
  updateBiome(gdt);
  updateCells(false);
  if (dirty) rebuild();
  if (state === 'play' || state === 'dying' || state === 'won') updateCreatures(gdt);
  updateHealth(gdt);
  if (state === 'dying'){ dieT += dt; if (dieT > 1.6) showOver(); }
  if (state === 'won'){ winT += dt; if (winT > 2.2) showWin(); }
  compassT = Math.max(0, compassT - dt); compassCd = Math.max(0, compassCd - dt); edgeHintT = Math.max(0, edgeHintT - dt);
  if (shake > 0) shake = Math.max(0, shake - dt*1.6);
  updateBirdVisual();
  updateCamera(dt);
  applyPalette(dt);
  updateFx(gdt);
  updateSpeedLines(dt, state === 'play' && birdS.mode === 'air' ? birdS.speed : 0);
  updatePopups(dt);
  if (bannerT > 0){ bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  if (flash > 0){ flash = Math.max(0, flash - dt*1.5); if (flash === 0) $('flash').classList.remove('red'); }
  $('flash').style.opacity = flash.toFixed(3);
  if (state === 'play' || state === 'dying') updateHUD();
  updateHints(dt); updateAudio(dt);
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
resize(); if (QUALITY.forced !== undefined) setQuality(QUALITY.forced); buildHearts(); setSound(soundOn); toTitle();
requestAnimationFrame(t => { last = t; frame(t); });

// debug / test hook
window.__FW = { get state(){ return state; }, bird: birdS, get fps(){ return fps; }, get info(){ return renderer.info.render; }, get W(){ return W; },
  get biome(){ return curBio; }, get danger(){ return curDanger; }, get runT(){ return runT; }, get flown(){ return flownM; }, get hearts(){ return birdS.hearts; },
  get hurts(){ return HURTLOG; }, get creatures(){ return creatureN; }, get hawk(){ return hawk; }, get cells(){ return cells.size; }, get visTrees(){ return visTrees.length; }, exit: exitInfo, biomeAt, dangerLevel, input,
  camera, THREE, TUT, dbg: { robinWings, birdModel, birdObj, tailFeathers, exitGlow, exitCore, PAL }, get quality(){ return QUALITY; }, setQuality, startRun, newSeed,
  teleport(x, z, y, yaw){ const B = birdS; B.mode = 'air'; B.branch = null; B.pos.set(x, y || 12, z); B.yaw = yaw === undefined ? B.yaw : yaw; B.speed = 9; B.pitch = 0; B.flown = true; PAL.init = false; hawk = { on: false }; hawkObj.visible = false; thornT = 0; camS.init = false; updateCells(true); rebuild(); },
  counts(){ const o = {}; for (const k of REBUILD_KEYS) o[k] = [IM[k].count, IM[k].geometry.index ? IM[k].geometry.index.count/3 : IM[k].geometry.attributes.position.count/3]; return o; },
  sim(sec, h){ h = h || 1/30; const n = Math.round(sec / h); for (let i=0;i<n;i++) simStep(h); },
  near(){ const o = []; for (const c of nearCells){ for (const f of c.flocks) o.push({ k: f.kind, x: f.home.x, y: f.home.y, z: f.home.z, st: f.state }); for (const w of c.owls) o.push({ k: 'owl', x: w.pos.x, y: w.pos.y, z: w.pos.z, st: w.state }); for (const s of c.snakes) o.push({ k: 'snake', x: s.b.x0, y: s.b.y, z: s.b.z0 }); } return o; },
  DBG, calm(){ hawk = { on: false }; hawkObj.visible = false; hawkCd = 9999; },
  batNear(){ const B = birdS; let best = null; for (const c of nearCells) for (const f of c.flocks) for (const m of f.members){ const dx = m.pos.x - B.pos.x, dz = m.pos.z - B.pos.z, d = m.pos.distanceTo(B.pos); const fw = (dx*Math.sin(B.yaw) + dz*Math.cos(B.yaw)) / Math.max(0.1, d); if (f.state === 'chase' && (!best || d < best.d)) best = { d, fw, k: f.kind }; } return best; },
  branchNear(){ const B = birdS; let best = null; for (const t of visTrees) for (const b of t.branches){ if (b.kind !== 'normal') continue; const p = branchPoint(b, 0.6, new THREE.Vector3()); const d = p.distanceTo(B.pos); if (!best || d < best.d) best = { d, x: p.x, y: branchTop(b, 0.6), z: p.z, ang: b.ang, snake: false }; } return best; },
  heal(){ birdS.hearts = MAX_HEARTS; hud.hearts = -1; },
  screen(v){ _v.copy(v).project(camera); return [(_v.x*0.5+0.5)*innerWidth, (-_v.y*0.5+0.5)*innerHeight]; } };
