/* Featherwood v2 - third-person forest flight. Three.js (vendored r160). */
import * as THREE from './vendor/three.module.min.js';

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
  { name:'Moonlit Redwoods', time:'Night', fog:0x1c2944, skyT:0x0a1228, hemiS:0x8aa0d8, hemiG:0x10141e, sun:0xb8c8ff, sunI:1.1, hemiI:0.9,
    leaves:[0x183a30,0x22493c,0x2f5c4a,0x3f7560], trunk:0x7a3a26, bush:0x1d3a2c, ground:0x252a28, shaft:0x9fb4ff, style:'redwood', night:true },
];
ZONES.forEach(z => { for (const k of ['fog','skyT','hemiS','hemiG','sun','shaft','trunk','bush','ground']) z['c_'+k] = new THREE.Color(z[k]); z.c_leaves = z.leaves.map(h => new THREE.Color(h)); });

const store = {
  get(k,d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let best = store.get('fw2_best', 0);
let soundOn = store.get('fw_sound', true);
const TUT = store.get('fw2_tut', {});

/* ---------- Renderer ---------- */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 230);
scene.add(camera);
scene.fog = new THREE.Fog(0xcbd8b4, 22, 135);
scene.background = new THREE.Color(0xcbd8b4);
const hemi = new THREE.HemisphereLight(0xffffff, 0x334422, 1.5); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xffffff, 2.4); sunL.position.set(-0.5, 1, 0.35); scene.add(sunL); scene.add(sunL.target);

/* ---------- Textures ---------- */
function canvasTex(c, rep){ const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 4; return t; }
function barkTexture(){
  const c = mk(128, 256), g = c.getContext('2d'), r = mulberry(11);
  g.fillStyle = '#d8d2c8'; g.fillRect(0,0,128,256);
  for (let i=0;i<46;i++){ const x = r()*128, w = 1 + r()*3; g.strokeStyle = 'rgba(40,30,20,' + (0.25 + r()*0.4) + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(x, -10);
    let y = -10, xx = x; while (y < 266){ y += 10 + r()*20; xx += (r()-0.5)*6; g.lineTo(xx, y); } g.stroke(); }
  for (let i=0;i<30;i++){ g.fillStyle = 'rgba(255,250,240,' + (0.08 + r()*0.12) + ')'; g.fillRect(r()*128, r()*256, 2 + r()*4, 8 + r()*30); }
  return canvasTex(c, [2, 6]);
}
function birchTexture(){
  const c = mk(128, 256), g = c.getContext('2d'), r = mulberry(5);
  g.fillStyle = '#f4f0e6'; g.fillRect(0,0,128,256);
  for (let i=0;i<60;i++){ g.fillStyle = 'rgba(200,190,170,' + (0.2 + r()*0.3) + ')'; g.fillRect(r()*128, r()*256, 10 + r()*30, 1); }
  for (let i=0;i<34;i++){ const x = r()*128, y = r()*256, w = 6 + r()*26, h = 1.5 + r()*4; g.fillStyle = 'rgba(25,22,18,' + (0.6 + r()*0.4) + ')';
    g.beginPath(); g.ellipse(x, y, w/2, h/2, 0, 0, TAU); g.fill(); if (x + w/2 > 128){ g.beginPath(); g.ellipse(x - 128, y, w/2, h/2, 0, 0, TAU); g.fill(); } }
  return canvasTex(c, [2, 5]);
}
function groundTexture(){
  const c = mk(256, 256), g = c.getContext('2d'), r = mulberry(3);
  g.fillStyle = '#b8b0a0'; g.fillRect(0,0,256,256);
  for (let i=0;i<900;i++){ const x = r()*256, y = r()*256, s = 2 + r()*6; const v = 150 + r()*90 | 0; g.fillStyle = 'rgba(' + v + ',' + (v*0.92|0) + ',' + (v*0.8|0) + ',0.4)';
    g.save(); g.translate(x,y); g.rotate(r()*TAU); g.beginPath(); g.ellipse(0,0,s,s*0.45,0,0,TAU); g.fill(); g.restore(); }
  for (let i=0;i<120;i++){ g.fillStyle = 'rgba(70,90,50,0.18)'; g.beginPath(); g.arc(r()*256, r()*256, 6 + r()*14, 0, TAU); g.fill(); }
  return canvasTex(c, [60, 60]);
}
function glowTexture(){
  const c = mk(128,128), g = c.getContext('2d'); const gr = g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.22,'rgba(255,255,255,0.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,128,128);
  const t = new THREE.CanvasTexture(c); return t;
}
function shaftTexture(){
  const c = mk(64, 256), g = c.getContext('2d');
  const gx = g.createLinearGradient(0,0,64,0); gx.addColorStop(0,'rgba(255,255,255,0)'); gx.addColorStop(0.5,'rgba(255,255,255,1)'); gx.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0,0,64,256); g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0,0,0,256); gy.addColorStop(0,'rgba(0,0,0,0.9)'); gy.addColorStop(0.6,'rgba(0,0,0,0.45)'); gy.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0,0,64,256); return new THREE.CanvasTexture(c);
}
function leafTexture(){
  const c = mk(64,64), g = c.getContext('2d'); g.translate(32,32); g.rotate(0.6); g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(-26,0); g.quadraticCurveTo(0,-15,26,0); g.quadraticCurveTo(0,15,-26,0); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-22,0); g.lineTo(22,0); g.stroke();
  return new THREE.CanvasTexture(c);
}
function draftTexture(){
  const c = mk(64, 256), g = c.getContext('2d'); g.clearRect(0,0,64,256);
  const r = mulberry(11); g.lineCap = 'round';
  for (let i=0;i<46;i++){ const x = r()*64, y = r()*256, l = 10 + r()*26; const gr = g.createLinearGradient(x, y, x + 3, y + l); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(0.5,'rgba(255,255,255,' + (0.35 + r()*0.5).toFixed(2) + ')'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = 1.5 + r()*2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); return t;
}
const TEX = { bark: barkTexture(), birch: birchTexture(), ground: groundTexture(), glow: glowTexture(), shaft: shaftTexture(), leaf: leafTexture(), draft: draftTexture() };

/* ---------- Geometry helpers ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0,1,0);
function mergeColored(parts){
  const pos = [], nor = [], col = [];
  for (const [geom, hex, mat] of parts){
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (mat) g.applyMatrix4(mat);
    g.computeVertexNormals();
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

/* ---------- Materials & instanced meshes ---------- */
const MAT = {
  bark: new THREE.MeshLambertMaterial({ map: TEX.bark }),
  birch: new THREE.MeshLambertMaterial({ map: TEX.birch }),
  branch: new THREE.MeshLambertMaterial({ map: TEX.bark }),
  leaf: new THREE.MeshLambertMaterial({ flatShading: true }),
  thorn: new THREE.MeshLambertMaterial({ color: 0xe3d6c0 }),
  berry: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x220000 }),
  ring: new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  dot: new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.9, depthWrite: false }),
  ground: new THREE.MeshLambertMaterial({ map: TEX.ground, color: 0x5a5236 }),
  shaft: new THREE.MeshBasicMaterial({ map: TEX.shaft, color: 0xfff0c4, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  up: new THREE.MeshBasicMaterial({ map: TEX.draft, color: 0xfff2c8, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  down: new THREE.MeshBasicMaterial({ map: TEX.draft.clone(), color: 0x8fa0b8, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
};
MAT.down.map.wrapS = MAT.down.map.wrapT = THREE.RepeatWrapping; MAT.down.map.repeat.set(6, 3); MAT.down.map.needsUpdate = true;
function inst(geo, mat, cap){ const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; }
const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 1, 9, 1, true); trunkGeo.translate(0, 0.5, 0);
const branchGeo = new THREE.CylinderGeometry(0.06, 0.2, 1, 6, 1); branchGeo.translate(0, 0.5, 0);
const blobGeo = jitterGeo(new THREE.IcosahedronGeometry(1, 1), 0.28, 7);
const coneGeo = jitterGeo(new THREE.ConeGeometry(1, 1.5, 8, 1), 0.12, 9);
const thornGeo = new THREE.ConeGeometry(0.04, 0.26, 4);
const berryGeo = mergeColored([
  [new THREE.SphereGeometry(0.1, 8, 6), 0xffffff, M(-0.07, 0, 0)], [new THREE.SphereGeometry(0.095, 8, 6), 0xffffff, M(0.07, -0.02, 0.02)],
  [new THREE.SphereGeometry(0.09, 8, 6), 0xffffff, M(0, -0.12, 0)], [new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), 0x4a6a30, M(0, 0.12, 0)],
  [new THREE.SphereGeometry(0.06, 5, 4), 0x5c8a38, M(0.05, 0.2, 0, 0, 0, 0.6, 1.4, 0.4, 0.8)] ]);
const IM = {
  bark: inst(trunkGeo, MAT.bark, 220), birch: inst(trunkGeo, MAT.birch, 220),
  branch: inst(branchGeo, MAT.branch, 360), blob: inst(blobGeo, MAT.leaf, 2200), cone: inst(coneGeo, MAT.leaf, 1400),
  thorn: inst(thornGeo, MAT.thorn, 500), berry: inst(berryGeo, MAT.berry, 260),
  ring: inst(new THREE.RingGeometry(0.42, 0.6, 28).rotateX(-Math.PI/2), MAT.ring, 20),
  dot: inst(new THREE.SphereGeometry(0.07, 6, 4), MAT.dot, 30),
};
IM.ring.renderOrder = 3; IM.dot.renderOrder = 3;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI/2), MAT.ground); scene.add(ground);
const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
targetRing.renderOrder = 4; targetRing.visible = false; scene.add(targetRing);

/* sky dome */
const skyGeo = new THREE.SphereGeometry(200, 16, 12);
skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -10; scene.add(sky);
function paintSky(top, horizon){
  const p = skyGeo.attributes.position, c = skyGeo.attributes.color;
  for (let i=0;i<p.count;i++){ const t = clamp(p.getY(i) / 200, 0, 1); const k = Math.pow(t, 0.6); _c.copy(horizon).lerp(top, k); c.setXYZ(i, _c.r, _c.g, _c.b); }
  c.needsUpdate = true;
}
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xfff0c8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.8 }));
sunSprite.scale.set(70, 70, 1); sunSprite.renderOrder = -9; scene.add(sunSprite);
const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false, transparent: true, opacity: 0 }));
moon.renderOrder = -8; scene.add(moon);

/* ---------- Bird ---------- */
function wingGeo(span, chord, inner, outer){
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
    const m = new THREE.Mesh(geo, mat); pivot.add(m); res.push(pivot);
  }
  return res;
}
const birdMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const wingMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, emissive: 0x1c140e });
const birdBodyMat = birdMat.clone();
const birdObj = new THREE.Group(); scene.add(birdObj);
const birdModel = new THREE.Group(); birdObj.add(birdModel); birdModel.rotation.order = 'YXZ';
const SPH = (w=10,h=8) => new THREE.SphereGeometry(1, w, h);
birdModel.add(new THREE.Mesh(mergeColored([
  [SPH(), 0x6b4a35, M(0, 0, 0, 0,0,0, 0.15, 0.15, 0.3)],
  [SPH(), 0x86644a, M(0, 0.05, -0.04, 0,0,0, 0.12, 0.1, 0.24)],
  [SPH(), 0xf0e3c6, M(0, -0.065, -0.01, 0,0,0, 0.115, 0.1, 0.21)],
  [SPH(), 0xd0602e, M(0, -0.02, 0.16, 0,0,0, 0.13, 0.13, 0.17)],
  [SPH(), 0x6b4a35, M(0, 0.11, 0.26, 0,0,0, 0.115, 0.115, 0.13)],
  [SPH(), 0xd8652f, M(0, 0.08, 0.32, 0,0,0, 0.095, 0.085, 0.09)],
  [new THREE.ConeGeometry(0.03, 0.12, 6), 0x2a201a, M(0, 0.1, 0.42, Math.PI/2)],
  [SPH(6,5), 0x120c08, M(0.07, 0.135, 0.34, 0,0,0, 0.026, 0.026, 0.026)], [SPH(6,5), 0x120c08, M(-0.07, 0.135, 0.34, 0,0,0, 0.026, 0.026, 0.026)],
  [SPH(5,4), 0xffffff, M(0.082, 0.146, 0.355, 0,0,0, 0.009, 0.009, 0.009)], [SPH(5,4), 0xffffff, M(-0.082, 0.146, 0.355, 0,0,0, 0.009, 0.009, 0.009)],
  [new THREE.BoxGeometry(0.12, 0.016, 0.26), 0x45301f, M(0, 0.02, -0.38, -0.15)],
  [new THREE.BoxGeometry(0.07, 0.014, 0.16), 0x5a3f2a, M(0, 0.032, -0.34, -0.15)],
]), birdBodyMat));
const legs = new THREE.Mesh(mergeColored([
  [new THREE.CylinderGeometry(0.012, 0.012, 0.13, 4), 0x3b2a20, M(0.05, -0.17, 0.03)], [new THREE.CylinderGeometry(0.012, 0.012, 0.13, 4), 0x3b2a20, M(-0.05, -0.17, 0.03)],
  [new THREE.BoxGeometry(0.025, 0.015, 0.12), 0x3b2a20, M(0.05, -0.23, 0.05)], [new THREE.BoxGeometry(0.025, 0.015, 0.12), 0x3b2a20, M(-0.05, -0.23, 0.05)],
]), birdMat); birdModel.add(legs);
const birdWings = makeWings(birdModel, wingGeo(0.8, 0.32, 0x947152, 0x3d2b1e), wingMat, 0.09, 0.06, 0.06);

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
let trees = [], decor = [], berries = [], feathers = [], owls = [], drafts = [];
let genZ = 0, treeId = 0, branchId = 0, lastMidY = 12, dirty = true;
function zoneAtZ(z){ return ((Math.floor(z / ZONE_M)) % 4 + 4) % 4; }
function trunkR(t, y){ return t.r * lerp(1, 0.8, clamp(y / t.h, 0, 1)); }
function makeTree(x, z, bg){
  const zi = zoneAtZ(z), st = ZONES[zi].style;
  const r = st === 'birch' ? rand(0.42, 0.58) : st === 'redwood' ? rand(1.05, 1.45) : st === 'maple' ? rand(0.62, 0.82) : rand(0.7, 0.95);
  const t = { id: treeId++, x, z, r, h: rand(46, 54), zi, st, bg, branches: [], blobs: [], cones: [], tint: rand(0.85, 1.1) };
  const L = ZONES[zi].leaves.length;
  if (st === 'redwood'){
    for (let k=0;k<6;k++){ const y = 24 + k*3.6; t.cones.push({ x, y, z, s: 5.2 - k*0.75, sy: 2.4, c: (k % 3) }); }
  } else {
    const n = bg ? 6 : 11, sc = st === 'birch' ? 0.75 : 1;
    for (let i=0;i<n;i++){ const a = rnd()*TAU, d = rand(0.5, 5.2)*sc; t.blobs.push({ x: x + Math.sin(a)*d, y: rand(30, 46), z: z + Math.cos(a)*d, s: rand(2.6, 4.6)*sc, c: (rnd()*L)|0 }); }
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
  genZ = z; dirty = true;
}
function addFeather(x, y, z){ feathers.push({ pos: new THREE.Vector3(x, y, z), taken: false, ph: rnd()*6, fade: 1, obj: getFeather() }); }
function cullWorld(minZ){
  let changed = false;
  if (trees.length && trees.some(t => t.z < minZ)){ trees = trees.filter(t => t.z >= minZ); changed = true; }
  decor = decor.filter(d => d.z >= minZ);
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
  _q.setFromUnitVectors(UP, dir); _s.set(1, L, 1); _m.compose(base, _q, _s); IM.branch.setMatrixAt(b.slot, _m);
}
function rebuild(){
  const cnt = { bark:0, birch:0, branch:0, blob:0, cone:0, thorn:0 };
  const put = (im, key, pos, q, s, col) => { const i = cnt[key]; if (i >= im.instanceMatrix.count) return -1; _m.compose(pos, q, s); im.setMatrixAt(i, _m); if (col) im.setColorAt(i, col); cnt[key]++; return i; };
  const qI = new THREE.Quaternion();
  for (const t of trees){
    const Z = ZONES[t.zi];
    _c.copy(Z.c_trunk).multiplyScalar(t.tint);
    put(t.st === 'birch' ? IM.birch : IM.bark, t.st === 'birch' ? 'birch' : 'bark', _v.set(t.x, 0, t.z), qI, _s.set(t.r, t.h, t.r), _c);
    for (const bl of t.blobs){ _q.setFromEuler(_e.set(bl.s, bl.x, bl.z)); _c.copy(Z.c_leaves[bl.c]); put(IM.blob, 'blob', _v.set(bl.x, bl.y, bl.z), _q, _s.set(bl.s, bl.s*0.72, bl.s), _c); }
    for (const cn of t.cones){ _q.setFromEuler(_e.set(0, cn.y, 0)); _c.copy(Z.c_leaves[cn.c]); put(IM.cone, 'cone', _v.set(cn.x, cn.y, cn.z), _q, _s.set(cn.s, cn.sy, cn.s), _c); }
    for (const b of t.branches){
      b.slot = cnt.branch;
      if (b.slot < IM.branch.instanceMatrix.count){ setBranchMatrix(b); _c.copy(Z.c_trunk).multiplyScalar(b.kind === 'thorn' ? 0.45 : (t.st === 'birch' ? 0.9 : 0.85)); if (b.kind === 'thorn') _c.r += 0.08; IM.branch.setColorAt(b.slot, _c); cnt.branch++; }
      if (b.leaf){ const lp = branchPoint(b, b.leaf.tt, new THREE.Vector3()); lp.y += b.leaf.up;
      if (t.st === 'redwood'){ _q.setFromEuler(_e.set(0, b.id, 0)); _c.copy(Z.c_leaves[b.leaf.c % 4]); put(IM.cone, 'cone', lp, _q, _s.set(b.leaf.s*1.1, b.leaf.s*0.9, b.leaf.s*1.1), _c); }
      else { _q.setFromEuler(_e.set(b.id, b.id*2, 0)); _c.copy(Z.c_leaves[b.leaf.c % 4]); put(IM.blob, 'blob', lp, _q, _s.set(b.leaf.s, b.leaf.s*0.75, b.leaf.s), _c);
        const sd = (b.id % 2 ? 1 : -1) * 0.55; const lp2 = branchPoint(b, 1.0, new THREE.Vector3()); lp2.x += b.dz*sd; lp2.z -= b.dx*sd; lp2.y += 0.55;
        _c.copy(Z.c_leaves[(b.leaf.c + 1) % 4]); put(IM.blob, 'blob', lp2, _q, _s.set(b.leaf.s*0.62, b.leaf.s*0.5, b.leaf.s*0.62), _c); } }
      if (b.kind === 'thorn'){
        for (let k=1;k<10;k++){ const tt = k/10; const p = branchPoint(b, tt, new THREE.Vector3()); const upv = k % 2 ? 1 : -1; p.y += upv * 0.14;
          _q.setFromEuler(_e.set(upv > 0 ? 0.3*(k%3-1) : Math.PI + 0.3*(k%3-1), b.ang, 0)); put(IM.thorn, 'thorn', p, _q, _s.set(1,1,1), null); }
      }
    }
  }
  for (const dcr of decor){ const Z = ZONES[dcr.zi]; _q.setFromEuler(_e.set(0, dcr.x, 0)); _c.copy(Z.c_bush).multiplyScalar(dcr.c ? 1.25 : 0.9); put(IM.blob, 'blob', _v.set(dcr.x, dcr.y, dcr.z), _q, _s.set(dcr.s*1.4, dcr.s*0.6, dcr.s*1.4), _c); }
  for (const k of Object.keys(cnt)){ const im = IM[k]; im.count = Math.min(cnt[k], im.instanceMatrix.count); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
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
const LEAVES_N = 110, leafPts = makePoints(LEAVES_N, 0.32, TEX.leaf, false, true);
const leafSim = []; for (let i=0;i<LEAVES_N;i++) leafSim.push({ x:0, y:-99, z:0, ph: fr(0,6), sp: fr(0.6, 1.3), c: (Math.random()*3)|0 });
const FLY_N = 70, flyPts = makePoints(FLY_N, 0.5, TEX.glow, true, true);
const flySim = []; for (let i=0;i<FLY_N;i++) flySim.push({ x:0, y:-99, z:0, ph: fr(0,6) });
const SPARK_N = 160, sparkPts = makePoints(SPARK_N, 0.32, TEX.glow, true, true);
const BIT_N = 120, bitPts = makePoints(BIT_N, 0.24, TEX.leaf, false, true);
const sparks = [], bits = [];
const MOTE_N = 80, motePts = makePoints(MOTE_N, 0.28, TEX.glow, true, true);
function spark(p, col, n, spd){ const c = new THREE.Color(col); for (let i=0;i<n;i++){ if (sparks.length >= SPARK_N) sparks.shift(); const a = fr(0,TAU), b = fr(-1,1), s = fr(0.5,1)*(spd||4);
  sparks.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a)*Math.sqrt(1-b*b)*s, vy: b*s, vz: Math.sin(a)*Math.sqrt(1-b*b)*s, life: fr(0.35, 0.7), age: 0, c }); } }
function burst(p, cols, n, spd, kind){ for (let i=0;i<n;i++){ if (bits.length >= BIT_N) bits.shift(); const a = fr(0,TAU), s = fr(0.4,1)*(spd||3);
  bits.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a)*s, vy: fr(0.2, 1.4)*s*0.6, vz: Math.sin(a)*s, life: fr(1.2, 2.4), age: 0, c: new THREE.Color(cols[i % cols.length]), kind, ph: fr(0,6) }); } }
const FEATHER_COLS = [0x6b4a35, 0xd0612f, 0x8b6748, 0xefe2c6];
function updateFx(dt){
  const Z = ZONES[PAL.zi];
  // ambient leaves around camera
  const lp = leafPts.geometry.attributes.position, lc = leafPts.geometry.attributes.color, cp = camera.position;
  for (let i=0;i<LEAVES_N;i++){ const s = leafSim[i];
    if (s.y < cp.y - 12 || s.y < 0.05 || Math.abs(s.x - cp.x) > 22 || s.z < cp.z - 4 || s.z > cp.z + 40){ s.x = cp.x + fr(-20, 20); s.y = cp.y + fr(0, 14); s.z = cp.z + fr(0, 38); s.c = (Math.random()*3)|0; }
    s.y -= s.sp * 1.1 * dt; s.x += Math.sin(time*1.3 + s.ph) * 0.9 * dt; s.z += Math.cos(time*0.9 + s.ph) * 0.5 * dt;
    lp.setXYZ(i, s.x, s.y, s.z); const c = Z.c_leaves[1 + s.c]; lc.setXYZ(i, c.r*1.15, c.g*1.15, c.b*1.15); }
  lp.needsUpdate = true; lc.needsUpdate = true;
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
    s.m.position.set(s.x, 30, s.z); s.m.scale.set(s.w, 75, 1); s.m.rotation.set(0, Math.atan2(camera.position.x - s.x, camera.position.z - s.z), 0.32);
  }
  MAT.shaft.opacity = (0.13 + 0.03*Math.sin(time*0.7)) * (1 - PAL.night*0.4);
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
  trees = []; decor = []; berries = []; feathers = []; owls = []; drafts = []; sparks.length = 0; bits.length = 0; prevRow = [];
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
  let any = false;
  for (const t of trees) for (const b of t.branches){
    if (b.sway === 0 && b.swayV === 0) continue;
    b.swayV += (-b.sway * 90 - b.swayV * 6) * dt; b.sway += b.swayV * dt;
    if (Math.abs(b.sway) < 0.002 && Math.abs(b.swayV) < 0.004){ b.sway = 0; b.swayV = 0; }
    if (b.slot >= 0 && b.slot < IM.branch.count){ setBranchMatrix(b); any = true; }
  }
  if (any) IM.branch.instanceMatrix.needsUpdate = true;
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
function updateBirdVisual(){
  const B = birdS;
  birdObj.visible = !B.hidden;
  birdObj.position.copy(B.pos);
  let pitch = B.pitch, bank = B.bank;
  if (!B.alive && deathCause === 'floor'){ pitch = -0.2; bank = 1.2; }
  birdModel.rotation.set(pitch, B.yaw, -bank);
  const sq = B.sq; birdModel.scale.set(1/Math.sqrt(Math.max(0.4, sq)), sq, 1/Math.sqrt(Math.max(0.4, sq)));
  birdModel.position.y = B.mode === 'perch' ? -(1 - sq) * 0.12 + Math.sin(time*2.2)*0.004 : 0;
  legs.visible = B.mode === 'perch' || !B.alive;
  let sweep, z, fold;
  if (B.mode === 'perch' || !B.alive){ sweep = 1.42; z = -0.42; fold = 0.5; if (B.aiming){ sweep = 1.0; z = -0.1 + 0.08*Math.sin(time*8); fold = 0.7; } }
  else if (B.flapAnim > 0){ sweep = 0.15; z = 0.12 + 1.0*Math.sin(B.wingT); fold = 1; }
  else if (B.holding){
    if (B.pitch > 0.75){ const k = clamp((B.pitch - 0.75)*2.4, 0, 1); sweep = lerp(0.3, 1.15, k); z = lerp(0.15, 0.4, k); fold = lerp(0.9, 0.58, k); }
    else if (B.stall > 0){ sweep = 0.2; z = 0.2 + 0.7*Math.sin(B.wingT*1.3); fold = 1; }
    else { sweep = 0.1; z = 0.3 + 0.03*Math.sin(time*5) + (B.pitch < -0.2 ? 0.25 : 0); fold = 1; }
  } else if (B.vel.y > 0){ sweep = 0.15; z = 0.12 + 0.9*Math.sin(B.wingT); fold = 1; }
  else { sweep = 0.3; z = 0.05 + 0.45*Math.sin(B.wingT*1.1); fold = 0.9; }
  for (const w of birdWings){ w.rotation.set(0, sweep, z); w.scale.set(fold, 1, 1); }
  birdBodyMat.emissive.setRGB(B.hurt > 0 ? B.hurt*0.6 : 0, 0, 0);
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
  scene.fog.color.copy(mix('fog')); scene.background.copy(scene.fog.color);
  const top = mix('skyT').clone(); paintSky(top, scene.fog.color);
  hemi.color.copy(mix('hemiS')); hemi.groundColor.copy(mix('hemiG')); hemi.intensity = lerp(A.hemiI, Bz.hemiI, t);
  sunL.color.copy(mix('sun')); sunL.intensity = lerp(A.sunI, Bz.sunI, t);
  MAT.ground.color.copy(mix('ground')); MAT.shaft.color.copy(mix('shaft')); sunSprite.material.color.copy(mix('sun'));
  PAL.night = (A.night ? 1 - t : 0) + (Bz.night ? t : 0);
  moon.material.opacity = PAL.night; sunSprite.material.opacity = 0.75 - PAL.night*0.45;
  scene.fog.near = lerp(22, 14, PAL.night); scene.fog.far = lerp(135, 95, PAL.night);
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
  sunSprite.position.set(camera.position.x - 55, camera.position.y + 70, camera.position.z + 150);
  moon.position.set(camera.position.x + 45, camera.position.y + 60, camera.position.z + 150); moon.lookAt(camera.position);
  sunL.position.set(camera.position.x - 30, camera.position.y + 60, camera.position.z + 25); sunL.target.position.copy(camera.position);
  ground.position.set(Math.round(camera.position.x / 7) * 7, 0, Math.round(camera.position.z / 7) * 7);
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
  time += dt;
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
function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize(); buildFlaps(); setSound(soundOn); toTitle();
requestAnimationFrame(t => { last = t; frame(t); });

window.__FW = { get state(){ return state; }, bird: birdS, get trees(){ return trees; }, get hawk(){ return hawk; }, get fps(){ return fps; }, get distM(){ return distM; },
  get perfects(){ return perfects; }, get combo(){ return combo; }, get owls(){ return owls; }, get berries(){ return berries; }, get berryCount(){ return berryCount; }, get info(){ return renderer.info.render; },
  camera, THREE, predict: (yaw, pow) => { const h = predictPath(yaw, pow, null); return h ? { id: h.b.id, kind: h.b.kind, z: h.pos.z, x: h.pos.x, y: h.pos.y, tz: h.b.tree.z, tt: h.tt } : null; },
  warp(m, hawkIn){ startRun(m); if (hawkIn !== undefined) nextHawkM = m + hawkIn; }, TUT, dbg: { birdWings, birdModel, birdObj }, screen(v){ _v.copy(v).project(camera); return [(_v.x*0.5+0.5)*innerWidth, (-_v.y*0.5+0.5)*innerHeight]; } };
