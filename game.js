/* Featherwood - a forest flight. Canvas 2D, no dependencies. */
'use strict';
(function(){
const $ = id => document.getElementById(id);
const cvs = $('game');
const ctx = cvs.getContext('2d', { alpha:false });
let W = 390, H = 844, DPR = 1;
const TAU = Math.PI * 2;
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const lerp = (a,b,t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
let seed = 1;
function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const rand = (a,b) => a + (b - a) * rnd();
const fr = (a,b) => a + (b - a) * Math.random();
function hash(i){ const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(h){ const n = parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; }
function mixC(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function rgb(c,a){ return a === undefined ? 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')' : 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+a+')'; }
function mk(w,h){ const c = document.createElement('canvas'); c.width = Math.max(1,Math.ceil(w)); c.height = Math.max(1,Math.ceil(h)); return c; }

/* ---------- World constants ---------- */
const GROUND = 1000, CEIL = -230, MPX = 40, ZONE_M = 650;
const BS = 1.5;            // bird scale
const FOOT = 12.5 * BS;     // centre to feet
const G_FALL = 1500, FLAP_VY = -540;
const GLIDE_G = 800, GLIDE_DRAG = 0.55, GLIDE_BASE = 0.2;

const ZONES = [
  { name:'Oak Hollow', time:'Morning', skyT:'#eccf98', skyB:'#d3e4c3', fog:'#cbd9b8', shaft:'#fff0c4', grade:'#fff9ef', sun:'#fff3cf',
    leaves:['#24451f','#3c6a2a','#5e8f38','#93b84f'], trunk:['#2f2119','#5e4433','#86684d'], style:'oak' },
  { name:'Birch Grove', time:'Midday', skyT:'#b5d9e6', skyB:'#eef1d6', fog:'#dce6d0', shaft:'#ffffff', grade:'#ffffff', sun:'#ffffff',
    leaves:['#40601d','#6c8f2b','#a3bd47','#d2dc74'], trunk:['#8f877b','#ddd6c8','#f6f2e8'], style:'birch' },
  { name:'Ember Maples', time:'Golden hour', skyT:'#de7d4f', skyB:'#f6cd8a', fog:'#eebb86', shaft:'#ffcd86', grade:'#ffe6cc', sun:'#ffd9a0',
    leaves:['#6e1f14','#a83d1d','#d86f2a','#f0aa48'], trunk:['#271e1a','#463630','#665247'], style:'maple' },
  { name:'Moonlit Redwoods', time:'Night', skyT:'#0b1430', skyB:'#2a3b5d', fog:'#2a3958', shaft:'#a9bfff', grade:'#aab5dc', sun:'#dfe6ff',
    leaves:['#10251f','#1b3a31','#2a5444','#40735c'], trunk:['#33170f','#62301f','#8a4a32'], style:'redwood', night:true },
];
ZONES.forEach(z => { for (const k of ['skyT','skyB','fog','shaft','grade','sun']) z['_'+k] = hex(z[k]); });

/* ---------- Persistent ---------- */
const store = {
  get(k,d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
let best = store.get('fw_best', 0);
let soundOn = store.get('fw_sound', true);
const TUT = store.get('fw_tut', {});

/* ---------- Sprites ---------- */
const SPR = { leaf:[], fern:[], berry:{}, glow:null, feather:null, shaft:null, front:[] };

function leafShape(g, x, y, s, a, col, style, r){
  g.save(); g.translate(x,y); g.rotate(a); g.fillStyle = col;
  if (style === 'redwood'){
    g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath();
    g.moveTo(-s,0); g.lineTo(s,0);
    for (let i=-s+2; i<s; i+=2.6){ g.moveTo(i,0); g.lineTo(i+2.2, -3.2); g.moveTo(i,0); g.lineTo(i+2.2, 3.2); }
    g.stroke();
  } else if (style === 'maple'){
    g.beginPath();
    for (let k=0;k<5;k++){ const an = -Math.PI/2 + (k-2)*0.62; const L = k===2 ? s : s*0.78;
      g.moveTo(0,0); g.quadraticCurveTo(Math.cos(an-0.3)*L*0.6, Math.sin(an-0.3)*L*0.6, Math.cos(an)*L, Math.sin(an)*L);
      g.quadraticCurveTo(Math.cos(an+0.3)*L*0.6, Math.sin(an+0.3)*L*0.6, 0, 0); }
    g.fill();
  } else {
    const wd = style === 'birch' ? 0.75 : 0.5;
    g.beginPath(); g.moveTo(-s,0); g.quadraticCurveTo(0,-s*wd,s,0); g.quadraticCurveTo(0,s*wd,-s,0); g.fill();
    if (s > 7){ g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-s*0.8,0); g.lineTo(s*0.8,0); g.stroke(); }
  }
  g.restore();
}
function makeLeafSprite(Z, v){
  const w = 200, h = 140, S = 2, c = mk(w*S, h*S), g = c.getContext('2d'); g.scale(S,S);
  const r = mulberry(v*977 + Z.style.length*31 + 5);
  const L = Z.leaves;
  const sz = Z.style === 'birch' ? [5,8] : Z.style === 'redwood' ? [8,13] : Z.style === 'maple' ? [7,11] : [7,11];
  // soft dark base
  g.fillStyle = L[0];
  for (let i=0;i<7;i++){ g.beginPath(); g.ellipse(100+(r()-0.5)*90, 76+(r()-0.5)*40, 30+r()*24, 20+r()*14, 0, 0, TAU); g.globalAlpha = 0.9; g.fill(); }
  g.globalAlpha = 1;
  const N = Z.style === 'birch' ? 210 : 150;
  for (let pass=0; pass<2; pass++){
    for (let i=0;i<N;i++){
      const a = r()*TAU, rr = Math.sqrt(r());
      const x = 100 + Math.cos(a)*rr*88, y = 72 + Math.sin(a)*rr*58;
      if (pass === 1 && y > 80) continue;
      const lit = (1 - (y-14)/116) + (x-100)/400 + (pass ? 0.35 : 0) + (r()-0.5)*0.5;
      const idx = clamp(Math.floor(lit*3.2), 0, 3);
      leafShape(g, x, y, sz[0] + r()*(sz[1]-sz[0]), r()*TAU, L[idx], Z.style, r);
    }
  }
  return { c, w, h };
}
function makeFern(v, cols){
  const w = 110, h = 70, S = 2, c = mk(w*S,h*S), g = c.getContext('2d'); g.scale(S,S);
  const r = mulberry(v*131+7);
  const fronds = 7 + (r()*4|0);
  for (let f=0; f<fronds; f++){
    const ang = -Math.PI/2 + (f/(fronds-1) - 0.5)*2.4 + (r()-0.5)*0.2;
    const len = 34 + r()*28;
    g.strokeStyle = cols[f%2 ? 1 : 2]; g.fillStyle = cols[f%2 ? 1 : 2]; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(55,70);
    const ex = 55 + Math.cos(ang)*len, ey = 70 + Math.sin(ang)*len*0.95;
    const cx = 55 + Math.cos(ang)*len*0.5, cy = 70 + Math.sin(ang)*len*0.5 - 6;
    g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    for (let k=1;k<12;k++){
      const t = k/12, px = (1-t)*(1-t)*55 + 2*(1-t)*t*cx + t*t*ex, py = (1-t)*(1-t)*70 + 2*(1-t)*t*cy + t*t*ey;
      const l = (1-t)*8 + 1.5;
      for (const sd of [-1,1]){ g.beginPath(); g.ellipse(px + Math.cos(ang+sd*1.2)*l*0.5, py + Math.sin(ang+sd*1.2)*l*0.5, l*0.55, 1.4, ang+sd*1.1, 0, TAU); g.fill(); }
    }
  }
  return { c, w, h };
}
function makeBerry(col, hi){
  const s = 30, c = mk(s*2, s*2), g = c.getContext('2d'); g.scale(2,2);
  g.strokeStyle = '#3c5a2c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(15,3); g.quadraticCurveTo(15,8,13,11); g.moveTo(15,6); g.quadraticCurveTo(18,9,19,13); g.stroke();
  g.fillStyle = '#4f7a35'; g.beginPath(); g.ellipse(19,5,4.2,1.8,-0.4,0,TAU); g.fill();
  const b = (x,y,r) => { const gr = g.createRadialGradient(x-r*0.35,y-r*0.4,r*0.1,x,y,r); gr.addColorStop(0,hi); gr.addColorStop(0.45,col); gr.addColorStop(1,'#2a0a0c'); g.fillStyle = gr; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(x-r*0.38,y-r*0.38,r*0.22,0,TAU); g.fill(); };
  b(11,16,5.2); b(19,18,4.8); b(14.5,22,4.6);
  return c;
}
function makeGlow(){
  const s = 128, c = mk(s,s), g = c.getContext('2d');
  const gr = g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.25,'rgba(255,255,255,0.5)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s); return c;
}
function featherPath(g, len, w){
  g.beginPath(); g.moveTo(0, len*0.5);
  g.bezierCurveTo(w, len*0.25, w*1.1, -len*0.25, 0, -len*0.5);
  g.bezierCurveTo(-w*0.9, -len*0.2, -w*0.8, len*0.25, 0, len*0.5);
}
function makeGoldFeather(){
  const c = mk(60,90), g = c.getContext('2d'); g.translate(30,45); g.rotate(0.35); g.scale(2,2);
  const gr = g.createLinearGradient(-8,-18,8,18); gr.addColorStop(0,'#fff2b8'); gr.addColorStop(0.5,'#e8b23e'); gr.addColorStop(1,'#a8691c');
  g.fillStyle = gr; featherPath(g, 34, 8); g.fill();
  g.strokeStyle = 'rgba(120,70,10,0.55)'; g.lineWidth = 0.5;
  for (let i=-12;i<14;i+=2.4){ g.beginPath(); g.moveTo(0,i); g.lineTo(6.5, i-4); g.moveTo(0,i); g.lineTo(-5.5,i-4); g.stroke(); }
  g.strokeStyle = '#fff6d8'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0,19); g.lineTo(0,-16); g.stroke();
  return c;
}
function makeShaft(){
  const w = 160, h = 900, c = mk(w,h), g = c.getContext('2d');
  const gx = g.createLinearGradient(0,0,w,0); gx.addColorStop(0,'rgba(255,255,255,0)'); gx.addColorStop(0.5,'rgba(255,255,255,1)'); gx.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0,0,w,h);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0,0,0,h); gy.addColorStop(0,'rgba(0,0,0,1)'); gy.addColorStop(0.55,'rgba(0,0,0,0.5)'); gy.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0,0,w,h);
  return c;
}
function makeFront(v){
  const w = 260, h = 200, c = mk(w,h), g = c.getContext('2d');
  const r = mulberry(v*53+11);
  g.fillStyle = '#0d1510';
  for (let f=0; f<9; f++){
    const ang = -Math.PI/2 + (r()-0.5)*2.2, len = 90 + r()*90, bx = 130 + (r()-0.5)*60;
    g.strokeStyle = '#0d1510'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, h);
    const ex = bx + Math.cos(ang)*len, ey = h + Math.sin(ang)*len; g.quadraticCurveTo(bx + Math.cos(ang)*len*0.4, h + Math.sin(ang)*len*0.6 - 20, ex, ey); g.stroke();
    for (let k=1;k<10;k++){ const t = k/10; const px = lerp(bx, ex, t), py = lerp(h, ey, t) - Math.sin(t*Math.PI)*14; const l = (1-t)*24+6;
      for (const sd of [-1,1]){ g.beginPath(); g.ellipse(px + Math.cos(ang+sd*1.3)*l*0.5, py + Math.sin(ang+sd*1.3)*l*0.5, l*0.55, 4, ang+sd*1.2, 0, TAU); g.fill(); } }
  }
  return c;
}
function buildSprites(){
  SPR.leaf = ZONES.map(Z => [0,1,2].map(v => makeLeafSprite(Z, v)));
  SPR.fern = ZONES.map((Z,zi) => [0,1].map(v => makeFern(v+zi*3, Z.leaves)));
  SPR.berry.red = makeBerry('#b8242a','#ff8a7a');
  SPR.berry.blue = makeBerry('#33427e','#a7b6ff');
  SPR.glow = makeGlow();
  SPR.feather = makeGoldFeather();
  SPR.shaft = makeShaft();
  SPR.front = [0,1,2].map(makeFront);
}

/* background layer masks (screen-space, white) */
const LAYERS = [
  { p:0.10, fogA:0.62, c:null, tint:null, kind:'far' },
  { p:0.26, fogA:0.40, c:null, tint:null, kind:'mid' },
  { p:0.50, fogA:0.20, c:null, tint:null, kind:'near' },
];
const TW = 1024;
function buildLayer(L, LH){
  const c = mk(TW, LH), g = c.getContext('2d'); const r = mulberry(L.kind.length*101 + 3);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  const n = L.kind === 'far' ? 34 : L.kind === 'mid' ? 16 : 7;
  const wr = L.kind === 'far' ? [5,13] : L.kind === 'mid' ? [14,26] : [30,52];
  for (let i=0;i<n;i++){
    const x = (i + r()*0.8) * TW / n, w = wr[0] + r()*(wr[1]-wr[0]);
    for (const ox of [0, -TW, TW]){
      const X = x + ox; if (X < -120 || X > TW + 120) continue;
      g.beginPath(); g.moveTo(X - w*0.35, 0); g.lineTo(X + w*0.35, 0); g.lineTo(X + w*0.5, LH); g.lineTo(X - w*0.5, LH); g.fill();
      const nb = L.kind === 'far' ? 2 : 3;
      const rr = mulberry(i*17 + L.kind.length);
      for (let k=0;k<nb;k++){ const y = LH*(0.15 + rr()*0.6), d = rr() < 0.5 ? -1 : 1, len = w*2 + rr()*w*3;
        g.lineWidth = Math.max(1.5, w*0.18); g.beginPath(); g.moveTo(X, y); g.quadraticCurveTo(X + d*len*0.5, y - 4, X + d*len, y + 10); g.stroke(); }
    }
  }
  // canopy band
  for (let i=0;i<(L.kind==='far'?60:30);i++){ const x = r()*TW, y = r()*LH*0.08, rx = 30 + r()*60;
    for (const ox of [0,-TW,TW]){ g.beginPath(); g.ellipse(x+ox, y, rx, rx*0.55, 0, 0, TAU); g.fill(); } }
  // undergrowth
  for (let i=0;i<(L.kind==='near'?26:40);i++){ const x = r()*TW, rx = 20 + r()*50;
    for (const ox of [0,-TW,TW]){ g.beginPath(); g.ellipse(x+ox, LH - r()*10, rx, rx*0.5, 0, 0, TAU); g.fill(); } }
  L.c = c; L.tint = mk(TW, LH); L.LH = LH;
}
function tintLayers(col){
  for (const L of LAYERS){
    const g = L.tint.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0,0,TW,L.LH);
    g.drawImage(L.c,0,0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0,0,TW,L.LH);
  }
}
let vignette = null;
function buildScreenAssets(){
  const LH = Math.ceil(H*1.35);
  for (const L of LAYERS) buildLayer(L, LH);
  lastTintKey = '';
  vignette = mk(W, H); const g = vignette.getContext('2d');
  const gr = g.createRadialGradient(W/2, H*0.46, Math.min(W,H)*0.3, W/2, H*0.5, Math.hypot(W,H)*0.62);
  gr.addColorStop(0,'rgba(8,12,9,0)'); gr.addColorStop(1,'rgba(8,12,9,0.55)'); g.fillStyle = gr; g.fillRect(0,0,W,H);
}
let lastTintKey = '';

/* ---------- World state ---------- */
let trees = [], berries = [], feathers = [], owls = [], drafts = [], particles = [], popups = [];
let genX = 0, treeId = 0, branchId = 0, lastMidY = 560, prevTree = null;
let state = 'title';   // title | play | paused | dying | over
let time = 0, runTime = 0, hitStop = 0, shake = 0, slowmo = 1;
let score = 0, bonus = 0, distM = 0, combo = 0, bestCombo = 0, perfects = 0, berryCount = 0, lastZone = 0;
let nextHawkM = 520, hawk = { on:false };
let dieT = 0, deathCause = '';
const cam = { x:0, y:500, zoom:0.8, viewW:470 };
const bird = {};

function zoneAt(x){ const m = x / MPX; return ((Math.floor(m / ZONE_M)) % 4 + 4) % 4; }
function diff(){ return clamp(genX / MPX / 2600, 0, 1); }

function makeTree(x){
  const z = zoneAt(x);
  const w = z === 3 ? rand(60,80) : z === 1 ? rand(28,38) : rand(40,54);
  const t = { id: treeId++, x, w, z, branches:[], cracks:[], canopy:[], moss: z !== 1 && rnd() < 0.6, grad:null };
  for (let i=0;i<16;i++) t.cracks.push([rand(-0.42,0.42), rand(CEIL-300, GROUND-40), rand(50,190), rand(0.7,1.6)]);
  for (let i=0;i<7;i++) t.canopy.push({ dx: rand(-120,120), y: rand(-340,-170), s: rand(1.0,1.6), v: (rnd()*3)|0 });
  trees.push(t); return t;
}
function addBranch(t, y, dir, kind, len){
  const b = { id: branchId++, tree: t, dir, y, len: len || rand(105,160), kind: kind || 'normal', sag: rand(4,12),
    sway: 0, swayV: 0, x0: t.x + dir * t.w * 0.4, leafs:[], twigs:[], owl:null };
  b.leafs.push({ t: 1.0, dy: -14, s: rand(0.5,0.64), v: (rnd()*3)|0, tip: true });
  if (rnd() < 0.55) b.leafs.push({ t: rand(0.42,0.62), dy: rand(-34,-26), s: rand(0.36,0.48), v: (rnd()*3)|0 });
  for (let i=0;i<2;i++) b.twigs.push([rand(0.3,0.85), rand(-1.1,-0.5), rand(14,26)]);
  t.branches.push(b); return b;
}
function branchY(b, tt){ return b.y + b.sag * tt * tt + b.sway * tt; }
function branchT(b, x){ return (x - b.x0) * b.dir / b.len; }
function branchX(b, tt){ return b.x0 + b.dir * b.len * tt; }

function hangBerries(b){
  const tt = rand(0.45, 0.85);
  berries.push({ b, t: tt, x: branchX(b,tt), y: 0, kind: rnd() < 0.7 ? 'red' : 'blue', taken:false, ph: rnd()*6 });
}
function berryArc(sx, sy, ex, ey, n){
  const h = rand(50, 110);
  for (let i=0;i<n;i++){ const u = (i+0.5)/n; berries.push({ x: lerp(sx,ex,u), y: lerp(sy,ey,u) - Math.sin(u*Math.PI)*h, kind: 'red', taken:false, ph: i*0.6 }); }
}

function genNext(){
  const m = genX / MPX, d = diff();
  let gap = rand(185, 255) + d * 85;
  let clearing = false;
  if (m > 140 && rnd() < 0.07 + 0.08*d){ clearing = true; gap += rand(240, 380); }
  const x = genX + gap;
  const w = 0; // placeholder for symmetry
  if (clearing){
    if (rnd() < 0.8) drafts.push({ x: genX + gap*0.5, w: rand(110,150), up: true, s: rand(1900, 2300) });
    if (rnd() < 0.5) feathers.push({ x: genX + gap*rand(0.35,0.65), y: rand(560,820), taken:false, ph: rnd()*6 });
  } else if (m > 650 && rnd() < 0.06 + 0.1*d){
    drafts.push({ x: genX + gap*0.5, w: rand(120,165), up: false, s: rand(1100, 1500) });
  }
  const t = makeTree(x);
  // clip previous tree's right branches so they do not reach this trunk
  if (prevTree) for (const b of prevTree.branches) if (b.dir > 0){ const maxL = (x - t.w*0.5) - b.x0 - 34; if (b.len > maxL) b.len = Math.max(60, maxL); }
  const n = 2 + (rnd() < 0.7 ? 1 : 0) + (rnd() < 0.35 - 0.2*d ? 1 : 0);
  const ys = [clamp(lastMidY + rand(-190, 170), 230, 850)];
  let tries = 0;
  while (ys.length < n && tries++ < 50){ const y = rand(170, 870); if (ys.every(v => Math.abs(v - y) > 120)) ys.push(y); }
  const guaranteed = ys[0];
  ys.sort((a,b) => a - b);
  const made = [];
  for (const y of ys){
    let dir = rnd() < 0.5 ? -1 : 1;
    let len = rand(105, 160);
    if (dir < 0 && prevTree){
      const room = (t.x - t.w*0.4) - (prevTree.x + prevTree.w*0.5) - 34;
      let conflict = 0;
      for (const pb of prevTree.branches) if (pb.dir > 0 && Math.abs(pb.y - y) < 85) conflict = Math.max(conflict, pb.len + prevTree.w*0.1);
      len = Math.min(len, room - conflict - 30);
      if (len < 70){ dir = 1; len = rand(105,160); }
    }
    let kind = 'normal';
    if (y !== guaranteed && m > 220 && rnd() < 0.05 + 0.2*d) kind = 'thorn';
    made.push(addBranch(t, y, dir, kind, len));
  }
  const normals = made.filter(b => b.kind === 'normal');
  lastMidY = normals.length ? normals[(normals.length/2)|0].y : guaranteed;
  // owls
  if (m > 330){
    const night = zoneAt(x) === 3;
    if (rnd() < (night ? 0.24 : 0.07) + 0.1*d){
      const cands = normals.filter(b => b.y !== guaranteed);
      const b = cands.length ? cands[(rnd()*cands.length)|0] : null;
      if (b){ const o = { b, t: 0.26, state:'sleep', timer:0, x:0, y:0, vx:0, vy:0, flap:rnd()*6, blink:0 }; b.owl = o; owls.push(o); }
    }
  }
  for (const b of normals) if (!b.owl && rnd() < 0.32) hangBerries(b);
  if (prevTree && rnd() < 0.42){
    const from = prevTree.branches.filter(b => b.kind === 'normal');
    const to = normals;
    if (from.length && to.length){
      const a = from[(rnd()*from.length)|0], bb = to[(rnd()*to.length)|0];
      const sx = branchX(a, 1) + 26, ex = branchX(bb, 0.5) - 20;
      if (ex - sx > 120) berryArc(sx, a.y - 40, ex, bb.y - 50, 4 + (rnd()*3|0));
    }
  }
  if (!clearing && m > 80 && rnd() < 0.07) feathers.push({ x: genX + gap*rand(0.3,0.7), y: rand(420, 860), taken:false, ph: rnd()*6 });
  prevTree = t; genX = x;
}

function resetWorld(startM){
  startM = startM || 0; const SX = startM * MPX;
  seed = (Date.now() % 1000003) + 17;
  trees = []; berries = []; feathers = []; owls = []; drafts = []; particles = []; popups = [];
  treeId = 0; branchId = 0; lastMidY = 560; prevTree = null;
  // starter tree
  const t = makeTree(SX - 60); t.w = 50; t.z = startM ? zoneAt(SX + 100) : 0;
  addBranch(t, 330, 1, 'normal', 120);
  const start = addBranch(t, 590, 1, 'normal', 165);
  addBranch(t, 800, -1, 'normal', 130);
  prevTree = t; genX = SX - 60;
  // a gentle first stretch
  genNext(); genNext();
  Object.assign(bird, { x: SX, y: 0, vx:0, vy:0, mode:'perch', branch: start, t: 0.62, pitch: 0, speed: 0, holding:false,
    stall:0, flaps:3, maxFlaps:3, sqX:1, sqY:1, sqV:0, wingT:0, flapAnim:0, stun:0, rot:0, trail:[], alive:true,
    blink:0, blinkT:2, tilt:0, tiltT:1.5, dragDy:0, aiming:false, aimDX:0, aimDY:0, wvy:0, hurt:0, lastBranch: start.id,
    furthestTree: t.id, launchY: 0, airT:0, glideT:0, divedDeep:false, hiddenT:0, chirpT: 3 });
  bird.x = branchX(start, bird.t); bird.y = branchY(start, bird.t) - FOOT;
  score = 0; bonus = 0; distM = startM; combo = 0; bestCombo = 0; perfects = 0; berryCount = 0; lastZone = Math.floor(startM / ZONE_M);
  nextHawkM = startM + 520; hawk = { on:false }; runTime = 0; hitStop = 0; shake = 0;
  cam.x = bird.x + 40; cam.y = bird.y - 60;
  ensureGen();
}
function ensureGen(){
  while (genX < cam.x + 1300) genNext();
  const cut = cam.x - 900;
  if (trees.length && trees[0].x < cut) trees = trees.filter(t => t.x > cut);
  berries = berries.filter(b => (b.b ? branchX(b.b,b.t) : b.x) > cut && !(b.taken && b.fade <= 0));
  feathers = feathers.filter(f => f.x > cut && !(f.taken && f.fade <= 0));
  drafts = drafts.filter(d => d.x > cut);
  owls = owls.filter(o => (o.state === 'sleep' || o.state === 'alert' ? o.b.tree.x > cut : (o.x > cut && o.y > -900 && o.y < 2000)));
}

/* ---------- Particles & popups ---------- */
function spawn(o){ if (particles.length > 220) particles.shift(); o.age = 0; particles.push(o); return o; }
function leafBurst(x, y, n, zi, spread){
  const L = ZONES[zi].leaves;
  for (let i=0;i<n;i++) spawn({ type:'leaf', x: x + fr(-spread,spread), y: y + fr(-12,6), vx: fr(-70,70), vy: fr(-120,-10), life: fr(1.6,2.8), s: fr(3.5,6), rot: fr(0,TAU), vr: fr(-6,6), c: L[1 + (Math.random()*3|0)], ph: fr(0,6) });
}
function featherBurst(x, y, n, power){
  const cols = ['#6b4a35','#d0612f','#8b6748','#efe2c6'];
  for (let i=0;i<n;i++){ const a = fr(0,TAU), s = fr(60,220)*power; spawn({ type:'feather', x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 60, life: fr(1.4,2.6), s: fr(5,9), rot: fr(0,TAU), vr: fr(-5,5), c: cols[i%4], ph: fr(0,6) }); }
}
function sparkle(x, y, col, n){
  for (let i=0;i<n;i++){ const a = i/n*TAU + fr(-0.2,0.2), s = fr(90,180); spawn({ type:'spark', x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: fr(0.35,0.6), s: fr(2,3.5), c: col }); }
  spawn({ type:'ring', x, y, vx:0, vy:0, life: 0.45, s: 8, c: col });
}
function dust(x, y, n){ for (let i=0;i<n;i++) spawn({ type:'dust', x: x + fr(-14,14), y, vx: fr(-60,60), vy: fr(-40,-5), life: fr(0.5,0.9), s: fr(5,10), c:'#e8dcc0' }); }
function popup(x, y, text, col, size, sub){ popups.push({ x, y, text, col: col || '#fbf5e6', size: size || 22, life: 1.25, age: 0, sub }); }

/* ---------- Gameplay ---------- */
function perchScore(b){ return b.tree.id > bird.furthestTree; }

function land(b, tt, vx, vy){
  const speed = Math.hypot(vx, vy);
  if (b.kind === 'thorn'){ thornHit(b, tt, vx); return; }
  if (b.owl && (b.owl.state === 'sleep' || b.owl.state === 'alert') && Math.abs(tt - b.owl.t) * b.len < 72){
    b.owl.state = 'swoop'; b.owl.timer = 0.6; caught('owl', b.owl); return;
  }
  bird.mode = 'perch'; bird.branch = b; bird.t = tt; bird.holding = false; bird.vx = bird.vy = 0; bird.wvy = 0;
  bird.flaps = bird.maxFlaps; bird.stall = 0; bird.divedDeep = false;
  if (ptr) ptr.consumed = true;
  const fresh = perchScore(b);
  let q = 'good';
  if (speed < 390 && vy < 310) q = 'perfect';
  else if (speed > 820 || vy > 770) q = 'hard';
  b.swayV += clamp(vy, 80, 900) * (q === 'hard' ? 0.11 : 0.06);
  bird.sqX = q === 'hard' ? 1.45 : 1.3; bird.sqY = q === 'hard' ? 0.58 : 0.7; bird.sqV = 0;
  const fx = bird.x, fy = branchY(b, tt);
  const zi = b.tree.z;
  leafBurst(branchX(b, 0.95), fy - 22, q === 'hard' ? 9 : 4, zi, 26);
  if (fresh){
    bird.furthestTree = b.tree.id;
    if (q === 'perfect'){
      combo++; perfects++; bestCombo = Math.max(bestCombo, combo);
      const pts = 100 * combo; bonus += pts;
      popup(fx, fy - 46, combo > 1 ? 'PERFECT  x' + combo : 'PERFECT', '#ffd77a', 24, '+' + pts);
      sparkle(fx, fy - 4, '#ffe39a', 12);
      sfx.perfect(combo);
      comboBump();
      tutDone('perfect');
    } else {
      if (combo > 1) popup(fx, fy - 70, 'Chain broken', '#f2c1a8', 15);
      combo = 0;
      const pts = q === 'hard' ? 20 : 40; bonus += pts;
      popup(fx, fy - 46, q === 'hard' ? 'Hard landing' : 'Nice', q === 'hard' ? '#f2c1a8' : '#fbf5e6', 19, '+' + pts);
      if (!TUT.perfect) hintFlash = 3.2;
    }
  }
  if (q === 'hard'){ shake = Math.max(shake, 11); hitStop = 0.07; dust(fx, fy, 8); featherBurst(fx, fy - 10, 3, 0.6); bird.stun = 0.25; sfx.hard(); }
  else { dust(fx, fy, q === 'perfect' ? 3 : 5); }
  sfx.land(q);
  bird.lastBranch = b.id;
}
function thornHit(b, tt, vx){
  bird.vy = -430; bird.vx = Math.max(90, Math.abs(vx)*0.35); bird.holding = false;
  if (ptr) ptr.consumed = true;
  bird.flaps = Math.max(0, bird.flaps - 1); bird.hurt = 0.6;
  if (combo > 1) popup(bird.x, bird.y - 60, 'Chain broken', '#f2c1a8', 15);
  combo = 0;
  popup(bird.x, bird.y - 34, 'Thorns', '#ff9b80', 20, bird.flaps >= 0 ? '-1 flap' : '');
  featherBurst(bird.x, bird.y, 5, 0.8); shake = Math.max(shake, 7); hitStop = 0.05;
  b.swayV += 30; sfx.ouch();
}
function caught(by, who){
  if (!bird.alive) return;
  bird.alive = false; state = 'dying'; dieT = 0; deathCause = by; slowmo = 0.35;
  featherBurst(bird.x, bird.y, 16, 1.3); shake = 14; hitStop = 0.09;
  bird.hiddenT = 1;
  if (by === 'hawk') sfx.screech(1); else sfx.hoot(1);
  sfx.gameover();
}
function hitFloor(){
  if (!bird.alive) return;
  bird.alive = false; state = 'dying'; dieT = 0; deathCause = 'floor';
  bird.y = GROUND - FOOT * 0.6; bird.vx *= 0.2; bird.vy = -160; shake = 12; hitStop = 0.08;
  leafBurst(bird.x, GROUND - 6, 10, zoneAt(bird.x), 30); dust(bird.x, GROUND - 4, 10); featherBurst(bird.x, bird.y, 4, 0.6);
  sfx.hard(); sfx.gameover();
}
function flap(){
  if (bird.mode !== 'air' || !bird.alive) return;
  if (bird.flaps <= 0){ sfx.noflap(); popup(bird.x, bird.y - 30, 'No flaps left', '#f2c1a8', 14); return; }
  bird.flaps--; bird.vy = Math.min(bird.vy * 0.25, 0) + FLAP_VY; bird.vx = Math.max(bird.vx, 170) + 30;
  bird.flapAnim = 1; bird.sqX = 0.85; bird.sqY = 1.18;
  for (let i=0;i<2;i++) spawn({ type:'feather', x: bird.x - 6, y: bird.y + 8, vx: fr(-40,20), vy: fr(40,90), life: 1.6, s: 5, rot: fr(0,TAU), vr: fr(-4,4), c:'#8b6748', ph: fr(0,6) });
  sfx.flap();
  tutDone('flap');
  flapPop();
}
function launchVel(dx, dy){
  const len = Math.hypot(dx, dy);
  let a, pow;
  if (len < 16){ a = -0.82; pow = 0.5; }
  else {
    a = Math.atan2(dy, dx);
    if (dx <= 1) a = dy < 0 ? -1.45 : 0.3;
    a = clamp(a, -1.45, 0.3);
    pow = clamp(len / 135, 0.28, 1);
  }
  const sp = 320 + 570 * pow;
  return [Math.cos(a)*sp, Math.sin(a)*sp, pow];
}
function launch(dx, dy){
  if (bird.mode !== 'perch' || bird.stun > 0) return;
  const [vx, vy] = launchVel(dx, dy);
  const b = bird.branch;
  bird.mode = 'air'; bird.vx = vx; bird.vy = vy; bird.branch = null; bird.fromBranch = b; bird.flapAnim = 1; bird.airT = 0;
  bird.launchY = bird.y; bird.sqX = 0.8; bird.sqY = 1.25; bird.wvy = 0;
  b.swayV += 34;
  leafBurst(branchX(b, 0.95), branchY(b, 0.95) - 20, 2, b.tree.z, 20);
  sfx.launch();
  tutDone('launch');
}
function draftAcc(x){
  let a = 0;
  for (const d of drafts){ const dd = Math.abs(x - d.x); if (dd < d.w*0.5){ const f = 1 - dd/(d.w*0.5); a += (d.up ? -1 : 1) * d.s * (0.4 + 0.6*f); } }
  return a;
}
function findLanding(px, py, x, y, skip){
  for (const t of trees){ if (Math.abs(t.x - x) > 260) continue;
    for (const b of t.branches){ if (b === skip) continue;
      const ta = branchT(b, px), tb = branchT(b, x);
      if ((ta < 0.05 && tb < 0.05) || (ta > 1.01 && tb > 1.01)) continue;
      const s0 = py + FOOT - branchY(b, clamp(ta,0,1)), s1 = y + FOOT - branchY(b, clamp(tb,0,1));
      if (s0 <= 0.5 && s1 >= 0){
        const u = s0 >= s1 ? 1 : clamp(s0 / (s0 - s1), 0, 1), tc = lerp(ta, tb, u);
        if (tc >= 0.06 && tc <= 1.0) return { b, t: tc, x: branchX(b, tc), y: branchY(b, tc) };
      }
    } }
  return null;
}
function predictPath(dx, dy, out){
  const [vx0, vy0] = launchVel(dx, dy);
  let x = bird.x, y = bird.y, vx = vx0, vy = vy0, hit = null;
  out.length = 0;
  const h = 1/120;
  for (let i=0;i<150;i++){
    const px = x, py = y;
    vy += (G_FALL + draftAcc(x))*h; vx -= vx*0.12*h; if (vy > 900) vy = 900;
    x += vx*h; y += vy*h;
    if (y < CEIL + 10){ y = CEIL + 10; if (vy < 0) vy *= -0.2; }
    if (i % 6 === 0) out.push(x, y);
    if (vy > -20){ hit = findLanding(px, py, x, y, i < 36 ? bird.branch : null); if (hit) break; }
    if (y > GROUND) break;
  }
  return hit;
}

function updateBird(dt){
  bird.blinkT -= dt; if (bird.blinkT < 0){ bird.blink = 0.14; bird.blinkT = fr(1.8, 4.5); }
  if (bird.blink > 0) bird.blink -= dt;
  bird.tiltT -= dt; if (bird.tiltT < 0){ bird.tilt = fr(-0.25, 0.2); bird.tiltT = fr(1.2, 3); }
  // squash spring
  const k = 260, damp = 14;
  bird.sqV += ((1 - bird.sqY) * k - bird.sqV * damp) * dt; bird.sqY += bird.sqV * dt; bird.sqX = 1 / Math.max(0.5, bird.sqY);
  if (bird.hurt > 0) bird.hurt -= dt;
  if (bird.flapAnim > 0) bird.flapAnim = Math.max(0, bird.flapAnim - dt * 2.2);

  if (!bird.alive){
    if (deathCause === 'floor'){ bird.vy += G_FALL*dt; bird.y += bird.vy*dt; bird.x += bird.vx*dt; if (bird.y > GROUND - FOOT*0.6){ bird.y = GROUND - FOOT*0.6; bird.vy = 0; bird.vx *= 0.8; } bird.rot = lerp(bird.rot, 1.3, dt*6); }
    return;
  }
  if (bird.mode === 'perch'){
    const b = bird.branch;
    bird.x = branchX(b, bird.t); bird.y = branchY(b, bird.t) - FOOT;
    bird.rot = lerp(bird.rot, 0, Math.min(1, dt*12));
    bird.stun -= dt;
    bird.trail.length = 0;
    bird.wingT += dt * 4;
    if (state === 'title'){ bird.chirpT -= dt; if (bird.chirpT < 0){ bird.chirpT = fr(2.5, 5); bird.beak = 0.35; } }
    if (bird.beak > 0) bird.beak -= dt;
    return;
  }
  // airborne
  bird.airT += dt;
  if (bird.holding) bird.glideT += dt;
  if (bird.glideT > 0.5) tutDone('glide');
  const steps = Math.max(1, Math.ceil(dt / (1/120))), h = dt / steps;
  for (let s=0; s<steps; s++){
    const px = bird.x, py = bird.y;
    const dAcc = draftAcc(bird.x);
    if (bird.holding){
      let target = clamp(GLIDE_BASE + bird.dragDy * 0.011, -0.85, 1.25);
      if (bird.stall > 0){ target = 1.0; bird.stall -= h; }
      bird.pitch += (target - bird.pitch) * Math.min(1, 6*h);
      bird.speed += (GLIDE_G * Math.sin(bird.pitch) - GLIDE_DRAG * bird.speed) * h;
      if (bird.speed < 125 && bird.pitch < 0.1 && bird.stall <= 0){ bird.stall = 0.45; sfx.stall(); }
      bird.speed = clamp(bird.speed, 40, 1150);
      bird.vx = bird.speed * Math.cos(bird.pitch); bird.vy = bird.speed * Math.sin(bird.pitch);
      bird.wvy += dAcc * 0.55 * h; bird.wvy *= (1 - 2.2*h);
      if (bird.pitch > 0.95) bird.divedDeep = true;
      if (bird.divedDeep && bird.pitch < -0.2){ tutDone('dive'); }
    } else {
      bird.vy += (G_FALL + dAcc) * h; bird.vx -= bird.vx * 0.12 * h; if (bird.vy > 900) bird.vy = 900;
      bird.wvy *= (1 - 3*h);
    }
    bird.x += bird.vx * h; bird.y += (bird.vy + bird.wvy) * h;
    const vyT = bird.vy + bird.wvy;
    // ceiling (canopy)
    if (bird.y < CEIL + 10){ bird.y = CEIL + 10; if (bird.vy < 0) bird.vy *= -0.2; if (bird.holding){ bird.pitch = Math.max(bird.pitch, 0.15); } if (Math.random() < 0.2) leafBurst(bird.x, bird.y - 10, 1, zoneAt(bird.x), 20); }
    // landing
    if (vyT > -20){
      const hit = findLanding(px, py, bird.x, bird.y, bird.airT < 0.3 ? bird.fromBranch : null);
      if (hit){ bird.x = hit.x; land(hit.b, hit.t, bird.vx, vyT); return; }
    }
    if (bird.y > GROUND - FOOT*0.7){ hitFloor(); return; }
  }
  // visual rotation
  const tr = bird.holding ? bird.pitch : clamp(Math.atan2(bird.vy, Math.max(60, Math.abs(bird.vx))), -0.9, 1.2);
  bird.rot = lerp(bird.rot, tr, Math.min(1, dt * 10));
  bird.wingT += dt * (bird.flapAnim > 0 ? 30 : 17);
  const sp = Math.hypot(bird.vx, bird.vy);
  bird.trail.push(bird.x, bird.y, sp); if (bird.trail.length > 66) bird.trail.splice(0, 3);
}

/* owls, hawk, collectibles */
function updateHazards(dt){
  const d = clamp(distM / 2600, 0, 1);
  for (const o of owls){
    o.flap += dt * 9; o.blink -= dt;
    if (o.state === 'sleep' || o.state === 'alert'){ o.x = branchX(o.b, o.t); o.y = branchY(o.b, o.t) - 19; }
    if (o.state === 'sleep'){
      const dx = bird.x - o.x, dy = bird.y - o.y;
      if (bird.alive && dx > -240 && dx < 60 && Math.abs(dy) < 260 && Math.hypot(dx,dy) < 240){ o.state = 'alert'; o.timer = 0.75; sfx.hoot(0); }
    } else if (o.state === 'alert'){
      o.timer -= dt;
      if (o.timer <= 0){
        o.state = 'swoop'; o.timer = 1.15;
        const tx = bird.x + bird.vx * 0.32, ty = bird.y + (bird.vy + bird.wvy) * 0.25;
        const a = Math.atan2(ty - o.y, tx - o.x), sp = 560 + 80*d;
        o.vx = Math.cos(a)*sp; o.vy = Math.sin(a)*sp; o.b.owl = null;
        sfx.swoosh(0.6);
      }
    } else if (o.state === 'swoop'){
      o.timer -= dt; o.x += o.vx*dt; o.y += o.vy*dt;
      if (bird.alive && Math.hypot(bird.x - o.x, bird.y - o.y) < 27){ caught('owl', o); }
      if (o.timer <= 0){ o.state = 'leave'; }
    } else if (o.state === 'leave'){
      o.vy = lerp(o.vy, -380, dt*2); o.vx = lerp(o.vx, 260, dt*2); o.x += o.vx*dt; o.y += o.vy*dt;
    }
  }
  // hawk
  if (!hawk.on){
    if (state === 'play' && distM >= nextHawkM){ hawk = { on:true, phase:'warn', t:2.2, x: bird.x - 760, y: bird.y - 160, flap:0, scr: 2.5 }; sfx.screech(0); }
  } else {
    hawk.flap += dt * (hawk.phase === 'chase' ? 9 : 7);
    if (hawk.phase === 'warn'){
      hawk.t -= dt; hawk.x = bird.x - 760; hawk.y = lerp(hawk.y, bird.y - 120, dt*2);
      if (hawk.t <= 0){ hawk.phase = 'chase'; hawk.t = hawk.dur = 12; }
    } else if (hawk.phase === 'chase'){
      hawk.t -= dt; hawk.scr -= dt;
      const dx = bird.x - hawk.x;
      const sp = 268 + 45*d + (dx > 650 ? (dx - 650) * 1.2 : 0);
      hawk.x += sp * dt;
      hawk.y = lerp(hawk.y, bird.y - 10 + Math.sin(time*2.2)*26, Math.min(1, dt*(dx < 220 ? 4 : 1.6)));
      if (hawk.scr < 0){ hawk.scr = fr(2.5, 4); sfx.screech(0); }
      if (bird.alive && Math.hypot(bird.x - hawk.x, bird.y - hawk.y) < 34){ caught('hawk', hawk); }
      if (hawk.t <= 0 && bird.alive){ hawk.phase = 'leave'; hawk.t = 3; bonus += 300; popup(bird.x, bird.y - 60, 'Escaped the hawk', '#ffd77a', 20, '+300'); sfx.escape(); }
    } else if (hawk.phase === 'leave'){
      hawk.t -= dt; hawk.x += 460*dt; hawk.y -= 320*dt;
      if (hawk.t <= 0){ hawk = { on:false }; nextHawkM = distM + rand(850, 1300); }
    }
    if (hawk.on && !bird.alive && deathCause === 'hawk'){ hawk.x += 200*dt; hawk.y -= 150*dt; }
  }
  // collectibles
  for (const b of berries){
    if (b.b){ b.x = branchX(b.b, b.t); b.y = branchY(b.b, b.t) + 16; }
    if (!b.taken && bird.alive && Math.abs(bird.x - b.x) < 30 && Math.abs(bird.y - b.y) < 30){
      b.taken = true; b.fade = 0.35; berryCount++;
      const pts = 25 * Math.max(1, combo); bonus += pts; popup(b.x, b.y - 18, '+' + pts, '#ffb3a6', 16);
      sparkle(b.x, b.y, b.kind === 'red' ? '#ff8a7a' : '#a7b6ff', 7); sfx.berry();
    }
    if (b.taken) b.fade -= dt;
  }
  for (const f of feathers){
    if (!f.taken && bird.alive && Math.abs(bird.x - f.x) < 32 && Math.abs(bird.y - f.y) < 36){
      f.taken = true; f.fade = 0.4;
      if (bird.maxFlaps < 5){ bird.maxFlaps++; }
      bird.flaps = Math.min(bird.maxFlaps, bird.flaps + 1);
      bonus += 150; popup(f.x, f.y - 24, bird.maxFlaps <= 5 ? 'Golden feather' : '', '#ffe39a', 18, '+1 flap  +150');
      sparkle(f.x, f.y, '#ffe39a', 14); sfx.feather(); flapPop();
    }
    if (f.taken) f.fade -= dt;
  }
}

function updateBranches(dt){
  for (const t of trees) for (const b of t.branches){
    if (b.sway === 0 && b.swayV === 0) continue;
    b.swayV += (-b.sway * 120 - b.swayV * 7) * dt; b.sway += b.swayV * dt;
    if (Math.abs(b.sway) < 0.02 && Math.abs(b.swayV) < 0.05){ b.sway = 0; b.swayV = 0; }
  }
}
function updateParticles(dt){
  for (let i=particles.length-1; i>=0; i--){
    const p = particles[i]; p.age += dt;
    if (p.age >= p.life){ particles.splice(i,1); continue; }
    if (p.type === 'leaf' || p.type === 'feather'){
      p.vy += (p.type === 'leaf' ? 70 : 50) * dt; p.vy *= (1 - 1.6*dt); p.vx *= (1 - 1.2*dt);
      p.vx += Math.sin(time*3 + p.ph) * 50 * dt; p.rot += p.vr * dt;
    } else if (p.type === 'spark'){ p.vx *= (1 - 4*dt); p.vy *= (1 - 4*dt); }
    else if (p.type === 'dust'){ p.vx *= (1 - 3*dt); p.vy *= (1 - 3*dt); p.s += 14*dt; }
    else if (p.type === 'ring'){ p.s += 120*dt; }
    p.x += p.vx*dt; p.y += p.vy*dt;
  }
  for (let i=popups.length-1; i>=0; i--){ const p = popups[i]; p.age += dt; p.y -= 34*dt; if (p.age > p.life) popups.splice(i,1); }
}

function updateCamera(dt, snap){
  const sp = bird.mode === 'air' ? Math.hypot(bird.vx, bird.vy) : 0;
  let targetView = state === 'title' ? 430 : lerp(480, 620, clamp((sp - 260) / 600, 0, 1));
  cam.viewW = snap ? targetView : lerp(cam.viewW, targetView, Math.min(1, dt * 1.6));
  cam.zoom = Math.min(W / cam.viewW, H / 860);
  const vw = W / cam.zoom, vh = H / cam.zoom;
  let tx, ty;
  if (state === 'title'){ tx = bird.x + 20; ty = bird.y - vh*0.06; }
  else {
    let lead = vw*0.18;
    if (hawk.on && hawk.phase === 'chase'){ const hd = bird.x - hawk.x; if (hd < 520) lead = lerp(-vw*0.06, vw*0.18, clamp((hd - 120)/400, 0, 1)); }
    tx = bird.x + lead + clamp(bird.vx*0.25, -60, 150);
    ty = bird.y + (bird.mode === 'perch' ? -30 : clamp((bird.vy + bird.wvy)*0.18, -90, 140));
  }
  if (snap){ cam.x = tx; cam.y = ty; }
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 4));
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 3));
  cam.y = Math.min(cam.y, GROUND + 130 - vh/2);
  cam.y = Math.max(cam.y, CEIL - 300 + vh/2);
}

/* ---------- Drawing: creatures ---------- */
const BC = { back:'#6b4a35', backD:'#45301f', backL:'#8f6b4b', rust:'#cf5f2e', rustL:'#e98a4c', cream:'#f0e3c6', beak:'#2a201a' };
function drawWing(g, a, fold, far){
  const L = lerp(31, 15, fold), Wd = lerp(11, 7.2, fold);
  const phi = Math.PI - a, ux = Math.cos(phi), uy = Math.sin(phi), vx = uy, vy = -ux;
  const sx = 1.5, sy = -3.5;
  const P = (u, v) => [sx + ux*u + vx*v, sy + uy*u + vy*v];
  const pts = [P(0,-2.6), P(L*0.32,-4.4), P(L*0.72,-2.8), P(L,0.6), P(L*0.93,3.4), P(L*0.86,2.4), P(L*0.79,5.8), P(L*0.71,4.4), P(L*0.63,7.7), P(L*0.55,6.4), P(L*0.46,Wd*0.86), P(L*0.3,Wd*0.92), P(L*0.13,Wd*0.82), P(0,Wd*0.55)];
  g.fillStyle = far ? '#3a281b' : '#5b3f2c';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i=1;i<pts.length;i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fill();
  if (far) return;
  // coverts
  const c = [P(0,-2.6), P(L*0.32,-4.4), P(L*0.55,-3.4), P(L*0.5,1.8), P(L*0.32,4.2), P(L*0.12,4.4), P(0,3)];
  g.fillStyle = '#80603f'; g.beginPath(); g.moveTo(c[0][0], c[0][1]); for (let i=1;i<c.length;i++) g.lineTo(c[i][0], c[i][1]); g.closePath(); g.fill();
  // wing bar
  const w0 = P(L*0.08,3.6), w1 = P(L*0.3,3.9), w2 = P(L*0.5,1.6);
  g.strokeStyle = 'rgba(240,227,198,0.75)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(w0[0],w0[1]); g.quadraticCurveTo(w1[0],w1[1],w2[0],w2[1]); g.stroke();
  // primaries
  g.strokeStyle = 'rgba(30,20,12,0.6)'; g.lineWidth = 0.6; g.beginPath();
  for (const k of [4,6,8,10]){ const a0 = P(L*0.45, 0.5); g.moveTo(a0[0], a0[1]); g.lineTo(pts[k][0], pts[k][1]); }
  g.stroke();
}
function drawBird(g, P){
  // P: wingA, fold, legs, blink, beak, hurt, tilt
  drawWing(g, P.wingA - 0.16, P.fold, true);
  // tail
  g.fillStyle = BC.backD;
  g.beginPath(); g.moveTo(-8,-2.5); g.lineTo(-24,-6.2); g.quadraticCurveTo(-28.5,-1.5,-26,2.8); g.lineTo(-22.5,5); g.lineTo(-8,3.4); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(240,227,198,0.25)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-10,0); g.lineTo(-26,-1.5); g.moveTo(-10,1.5); g.lineTo(-24,3); g.stroke();
  // body
  g.save();
  g.beginPath(); g.ellipse(0, 0, 12.8, 8.8, 0, 0, TAU);
  const gr = g.createLinearGradient(0,-9,0,9); gr.addColorStop(0, BC.backL); gr.addColorStop(0.45, BC.back); gr.addColorStop(1, '#5a4030');
  g.fillStyle = gr; g.fill(); g.clip();
  g.fillStyle = BC.cream; g.beginPath(); g.ellipse(0, 6.5, 10, 4.8, 0, 0, TAU); g.fill();
  g.fillStyle = BC.rust; g.beginPath(); g.ellipse(8.5, 1.8, 7.4, 6.8, 0.15, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,190,130,0.45)'; g.beginPath(); g.ellipse(9.5, 0.4, 4, 3.2, 0.2, 0, TAU); g.fill();
  g.restore();
  // head
  g.save(); g.translate(10, -5.5); g.rotate(P.tilt || 0);
  g.fillStyle = BC.back; g.beginPath(); g.arc(0, 0, 7.2, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(0,0,7.2,0,TAU); g.clip();
  g.fillStyle = BC.rust; g.beginPath(); g.ellipse(3.2, 2.6, 5.6, 5.4, 0.2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(150,170,175,0.22)'; g.beginPath(); g.ellipse(-3.5, 2.5, 3, 5, 0.3, 0, TAU); g.fill();
  g.fillStyle = BC.backL; g.beginPath(); g.ellipse(-1, -5.2, 6, 2.6, -0.1, 0, TAU); g.fill();
  g.restore();
  // beak
  const open = P.beak > 0 ? 1.6 : 0;
  g.fillStyle = BC.beak;
  g.beginPath(); g.moveTo(6.3,-1.2); g.lineTo(12.4, 0.6 - open*0.3); g.lineTo(6.6, 1.4); g.closePath(); g.fill();
  g.fillStyle = '#4a3a30'; g.beginPath(); g.moveTo(6.6,1.4); g.lineTo(11.2, 1.3 + open); g.lineTo(6.2, 2.8); g.closePath(); g.fill();
  // eye
  if (P.blink > 0){ g.strokeStyle = '#1a120c'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(1.2,-1.6); g.quadraticCurveTo(3,-0.6,4.6,-1.6); g.stroke(); }
  else {
    g.fillStyle = 'rgba(240,227,198,0.8)'; g.beginPath(); g.arc(3, -1.6, 2.5, 0, TAU); g.fill();
    g.fillStyle = '#120c08'; g.beginPath(); g.arc(3.1, -1.6, 1.95, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(3.8, -2.3, 0.65, 0, TAU); g.fill();
  }
  g.restore();
  // legs
  if (P.legs){
    g.strokeStyle = '#3b2a20'; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0.5, 7); g.lineTo(-0.5, 12.3); g.moveTo(4, 7); g.lineTo(4, 12.3);
    g.moveTo(-3.5, 12.6); g.lineTo(2.2, 12.6); g.moveTo(1.5, 12.6); g.lineTo(7, 12.6); g.stroke();
    g.lineCap = 'butt';
  }
  drawWing(g, P.wingA, P.fold, false);
  if (P.hurt > 0){ g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,60,40,' + (P.hurt*0.5) + ')'; g.fillRect(-30,-20,60,40); g.globalCompositeOperation = 'source-over'; }
}
function birdPose(){
  const P = { wingA: 0.12, fold: 1, legs: true, blink: bird.blink, beak: bird.beak || 0, hurt: Math.max(0, bird.hurt), tilt: 0 };
  if (bird.mode === 'perch' || !bird.alive && deathCause === 'floor'){
    P.tilt = bird.tilt; P.wingA = 0.12 + (bird.sqY < 0.9 ? -0.4 : 0);
    if (bird.aiming){ P.fold = 0.75; P.wingA = -0.15; }
    return P;
  }
  P.legs = false;
  const sp = Math.hypot(bird.vx, bird.vy);
  if (bird.flapAnim > 0){ P.fold = 0.05; P.wingA = -0.15 + 1.05 * Math.sin(bird.wingT); }
  else if (bird.holding){
    if (bird.pitch > 0.75){ P.fold = clamp((bird.pitch - 0.75)*2.5, 0.3, 0.92); P.wingA = -0.05; }
    else if (bird.stall > 0){ P.fold = 0; P.wingA = -0.3 + 0.7*Math.sin(bird.wingT*1.4); }
    else { P.fold = 0; P.wingA = -0.62 + 0.05*Math.sin(time*5) + (bird.pitch < -0.2 ? 0.25 : 0); }
  } else if (bird.vy < 0){ P.fold = 0.1; P.wingA = -0.15 + 0.95*Math.sin(bird.wingT); }
  else { P.fold = 0.25; P.wingA = -0.35 + 0.55*Math.sin(bird.wingT*1.1); }
  return P;
}

function drawOwl(g, o){
  const awake = o.state !== 'sleep';
  if (o.state === 'swoop' || o.state === 'leave'){
    const f = Math.sin(o.flap);
    g.save(); g.rotate(clamp(Math.atan2(o.vy, Math.abs(o.vx)+1)*0.5, -0.6, 0.6)); if (o.vx < 0) g.scale(-1,1);
    g.fillStyle = '#4e4033';
    for (const s of [-1,1]){ g.beginPath(); g.moveTo(-6, -2); g.quadraticCurveTo(-20, -30*f*s - 6, -44, -24*f*s - 8 + s*4); g.quadraticCurveTo(-30, -6*f*s+2, -4, 6); g.closePath(); g.fill(); }
    g.restore();
  }
  // body
  g.fillStyle = '#6a5845'; g.beginPath(); g.ellipse(0, 3, 14, 18, 0, 0, TAU); g.fill();
  g.fillStyle = '#d7c6a6'; g.beginPath(); g.ellipse(0, 7, 9, 12, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(80,58,40,0.75)'; g.lineWidth = 1;
  for (let i=0;i<4;i++){ g.beginPath(); g.moveTo(-5 + (i%2)*2, 1 + i*4); g.quadraticCurveTo(0, 3 + i*4, 5 - (i%2)*2, 1 + i*4); g.stroke(); }
  g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(-11, 5, 5, 13, 0.15, 0, TAU); g.ellipse(11, 5, 5, 13, -0.15, 0, TAU); g.fill();
  // head + tufts
  g.fillStyle = '#6a5845'; g.beginPath(); g.ellipse(0, -14, 13, 11, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-11,-19); g.lineTo(-13,-30); g.lineTo(-5,-22); g.moveTo(11,-19); g.lineTo(13,-30); g.lineTo(5,-22); g.fill();
  g.fillStyle = '#cdb894'; g.beginPath(); g.ellipse(-5.2, -13, 5.6, 5.4, 0, 0, TAU); g.ellipse(5.2, -13, 5.6, 5.4, 0, 0, TAU); g.fill();
  if (!awake || o.blink > 0){ g.strokeStyle = '#2b2018'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-8,-13); g.quadraticCurveTo(-5,-11,-2,-13); g.moveTo(2,-13); g.quadraticCurveTo(5,-11,8,-13); g.stroke(); }
  else { g.fillStyle = '#f2a51c'; g.beginPath(); g.arc(-5,-13,3.8,0,TAU); g.arc(5,-13,3.8,0,TAU); g.fill(); g.fillStyle = '#120a04'; g.beginPath(); g.arc(-5,-13,2,0,TAU); g.arc(5,-13,2,0,TAU); g.fill(); }
  g.fillStyle = '#3a2c1e'; g.beginPath(); g.moveTo(-1.6,-10.5); g.lineTo(1.6,-10.5); g.lineTo(0,-6.5); g.closePath(); g.fill();
}
function drawHawk(g, hk){
  const f = Math.sin(hk.flap);
  g.save(); g.scale(1.25, 1.25);
  // far wing
  g.fillStyle = '#3c2818';
  g.beginPath(); g.moveTo(4,-2); g.quadraticCurveTo(-6, -22 - 22*f, -30, -34 - 26*f); g.lineTo(-24, -26 - 20*f); g.lineTo(-20, -24 - 16*f); g.quadraticCurveTo(-10, -6, -6, 2); g.closePath(); g.fill();
  // tail
  g.fillStyle = '#7a4e2e'; g.beginPath(); g.moveTo(-14,-3); g.lineTo(-36,-8); g.lineTo(-38,3); g.lineTo(-14,4); g.closePath(); g.fill();
  g.strokeStyle = '#3a2414'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-24,-5.5); g.lineTo(-25,3.5); g.moveTo(-31,-6.8); g.lineTo(-32,3.4); g.stroke();
  // body
  g.fillStyle = '#5c3b24'; g.beginPath(); g.ellipse(0, 0, 18, 8.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8d6b4'; g.beginPath(); g.ellipse(3, 3.5, 12, 4.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(92,59,36,0.8)'; g.lineWidth = 0.9; g.beginPath(); for (let i=-6;i<12;i+=3.5){ g.moveTo(i, 2); g.lineTo(i+1.5, 5.5); } g.stroke();
  // head
  g.fillStyle = '#5c3b24'; g.beginPath(); g.arc(17, -3, 6.5, 0, TAU); g.fill();
  g.fillStyle = '#e8d6b4'; g.beginPath(); g.ellipse(18, 0, 4, 3, 0, 0, TAU); g.fill();
  g.fillStyle = '#f1c232'; g.beginPath(); g.moveTo(22,-4.5); g.quadraticCurveTo(28,-4,27,0.5); g.lineTo(23,-1); g.closePath(); g.fill();
  g.fillStyle = '#1b1208'; g.beginPath(); g.moveTo(26,-1); g.lineTo(27,0.5); g.lineTo(25.4,1.4); g.fill();
  g.fillStyle = '#f5c518'; g.beginPath(); g.arc(19.5,-4.5,1.8,0,TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(19.8,-4.5,0.9,0,TAU); g.fill();
  g.strokeStyle = '#2a1a0e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(16.5,-7.5); g.lineTo(22,-6.2); g.stroke();
  // near wing
  g.fillStyle = '#6e4a2c';
  g.beginPath(); g.moveTo(8,-3); g.quadraticCurveTo(-2, -24 - 26*f, -28, -40 - 30*f); g.lineTo(-22, -31 - 24*f); g.lineTo(-19, -30 - 20*f); g.lineTo(-15, -26 - 16*f); g.quadraticCurveTo(-8, -6, -6, 3); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,24,12,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-2, -6 - 6*f); g.lineTo(-22, -31 - 24*f); g.moveTo(-1, -4 - 4*f); g.lineTo(-17, -27 - 18*f); g.stroke();
  g.restore();
}

/* ---------- Palette ---------- */
const PAL = {};
function updatePalette(){
  const m = Math.max(0, cam.x / MPX);
  const f = m / ZONE_M, zi = Math.floor(f) % 4, loc = f - Math.floor(f);
  const t = loc > 0.86 ? smooth((loc - 0.86) / 0.14) : 0;
  const A = ZONES[zi], B = ZONES[(zi+1)%4];
  for (const k of ['skyT','skyB','fog','shaft','grade','sun']) PAL[k] = mixC(A['_'+k], B['_'+k], t);
  PAL.night = (A.night ? 1 - t : 0) + (B.night ? t : 0);
  PAL.zi = zi;
  const key = ((PAL.fog[0]/6)|0)+','+((PAL.fog[1]/6)|0)+','+((PAL.fog[2]/6)|0);
  return key;
}

/* ---------- Drawing: world ---------- */
function worldTransform(){
  const z = cam.zoom;
  ctx.setTransform(DPR*z, 0, 0, DPR*z, DPR*(W/2 - cam.x*z + shakeX), DPR*(H/2 - cam.y*z + shakeY));
}
let shakeX = 0, shakeY = 0;
function viewBounds(){ const vw = W/cam.zoom, vh = H/cam.zoom; return [cam.x - vw/2, cam.y - vh/2, cam.x + vw/2, cam.y + vh/2]; }

function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, rgb(PAL.skyT)); g.addColorStop(1, rgb(PAL.skyB));
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  // sun / moon glow
  const sx = W*0.78, sy = H*0.12;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 - PAL.night*0.25;
  ctx.drawImage(tintedGlow(PAL.sun), sx - 220, sy - 220, 440, 440);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (PAL.night > 0.05){
    ctx.globalAlpha = PAL.night; ctx.fillStyle = '#f2f4ff'; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(PAL.skyT); ctx.beginPath(); ctx.arc(sx + 9, sy - 6, 19, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i=0;i<40;i++){ const x = hash(i)*W, y = hash(i+99)*H*0.45; const tw = 0.5 + 0.5*Math.sin(time*2 + i); ctx.globalAlpha = PAL.night * (0.3 + 0.5*tw) * (1 - y/(H*0.45)); ctx.fillRect(x, y, 1.6, 1.6); }
    ctx.globalAlpha = 1;
  }
}
const glowCache = {};
function tintedGlow(c){
  const key = ((c[0]/16)|0)+'_'+((c[1]/16)|0)+'_'+((c[2]/16)|0);
  if (glowCache[key]) return glowCache[key];
  const s = 128, cv = mk(s,s), g = cv.getContext('2d'); g.drawImage(SPR.glow,0,0); g.globalCompositeOperation = 'source-in'; g.fillStyle = rgb(c); g.fillRect(0,0,s,s);
  glowCache[key] = cv; return cv;
}
function drawLayer(L, fogCol){
  const p = L.p;
  let ox = -((cam.x * cam.zoom * p) % TW); if (ox > 0) ox -= TW;
  const baseY = -(L.LH - H) * 0.5;
  let oy = baseY - (cam.y - 500) * cam.zoom * p * 0.6;
  oy = clamp(oy, H - L.LH, 0);
  for (let x = ox; x < W; x += TW) ctx.drawImage(L.tint, x, oy);
  ctx.fillStyle = rgb(fogCol, L.fogA); ctx.fillRect(0,0,W,H);
}
function drawShafts(){
  ctx.globalCompositeOperation = 'lighter';
  const sh = tintedShaft(PAL.shaft);
  const span = 520, p = 0.4;
  const off = cam.x * cam.zoom * p;
  const start = Math.floor((off - 200) / span);
  for (let i = start; i < start + Math.ceil(W/span) + 3; i++){
    if (hash(i*3.7) < 0.35) continue;
    const x = i*span - off + hash(i)*200;
    const a = 0.10 + 0.07 * Math.sin(time*0.6 + i*1.7);
    ctx.save(); ctx.globalAlpha = a * (1 - PAL.night*0.4); ctx.translate(x, -60); ctx.rotate(0.34);
    const w = 90 + hash(i+5)*120; ctx.drawImage(sh, -w/2, 0, w, H*1.25); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
let shaftTint = null, shaftKey = '';
function tintedShaft(c){
  const key = ((c[0]/12)|0)+'_'+((c[1]/12)|0)+'_'+((c[2]/12)|0);
  if (key === shaftKey) return shaftTint;
  if (!shaftTint) shaftTint = mk(SPR.shaft.width, SPR.shaft.height);
  const g = shaftTint.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0,0,shaftTint.width,shaftTint.height);
  g.drawImage(SPR.shaft,0,0); g.globalCompositeOperation = 'source-in'; g.fillStyle = rgb(c); g.fillRect(0,0,shaftTint.width,shaftTint.height);
  shaftKey = key; return shaftTint;
}

function trunkGrad(t){
  if (t.grad) return t.grad;
  const C = ZONES[t.z].trunk, hw = t.w*0.5;
  const g = ctx.createLinearGradient(t.x - hw, 0, t.x + hw, 0);
  g.addColorStop(0, C[0]); g.addColorStop(0.3, C[1]); g.addColorStop(0.55, C[2]); g.addColorStop(0.85, C[1]); g.addColorStop(1, C[0]);
  t.grad = g; return g;
}
function drawTree(t, top, bot){
  const Z = ZONES[t.z], hw = t.w*0.5;
  const y0 = Math.max(top - 20, CEIL - 420), y1 = Math.min(bot + 20, GROUND);
  if (y1 > y0){
    const taper = y => 0.78 + 0.22 * (y - CEIL) / (GROUND - CEIL);
    ctx.fillStyle = trunkGrad(t);
    ctx.beginPath();
    ctx.moveTo(t.x - hw*taper(y0), y0); ctx.lineTo(t.x + hw*taper(y0), y0);
    if (y1 >= GROUND - 70){
      ctx.lineTo(t.x + hw, GROUND - 70); ctx.quadraticCurveTo(t.x + hw*1.05, GROUND - 14, t.x + hw*1.9, GROUND + 4);
      ctx.lineTo(t.x - hw*1.9, GROUND + 4); ctx.quadraticCurveTo(t.x - hw*1.05, GROUND - 14, t.x - hw, GROUND - 70);
    } else { ctx.lineTo(t.x + hw*taper(y1), y1); ctx.lineTo(t.x - hw*taper(y1), y1); }
    ctx.closePath(); ctx.fill();
    // bark
    if (Z.style === 'birch'){
      ctx.fillStyle = 'rgba(30,26,22,0.78)';
      for (const c of t.cracks){ if (c[1] < y0 - 20 || c[1] > y1) continue; const w = hw * (0.25 + c[3]*0.4); ctx.beginPath(); ctx.ellipse(t.x + c[0]*t.w, c[1], w, 1.6 + c[3], 0, 0, TAU); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(15,10,6,0.42)'; ctx.lineWidth = Z.style === 'redwood' ? 2.2 : 1.6; ctx.beginPath();
      for (const c of t.cracks){ if (c[1] + c[2] < y0 || c[1] > y1) continue; const x = t.x + c[0]*t.w; ctx.moveTo(x, c[1]); ctx.bezierCurveTo(x + 3*c[3], c[1] + c[2]*0.33, x - 3*c[3], c[1] + c[2]*0.66, x + 1, Math.min(c[1] + c[2], GROUND)); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.10)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const c of t.cracks){ if (c[1] + c[2] < y0 || c[1] > y1) continue; const x = t.x + c[0]*t.w + 3; ctx.moveTo(x, c[1] + 10); ctx.lineTo(x + 1, Math.min(c[1] + c[2]*0.8, GROUND)); }
      ctx.stroke();
    }
    if (t.moss && y1 > GROUND - 160){ ctx.fillStyle = 'rgba(92,128,52,0.55)'; ctx.beginPath(); ctx.ellipse(t.x - hw*0.4, GROUND - 40, hw*0.7, 50, 0.1, 0, TAU); ctx.fill(); }
  }
  // canopy at top
  if (top < -60){
    const S = SPR.leaf[t.z];
    for (const c of t.canopy){ const sp = S[c.v]; ctx.drawImage(sp.c, t.x + c.dx - sp.w*c.s/2, c.y - sp.h*c.s/2, sp.w*c.s, sp.h*c.s); }
  }
}
function drawBranch(b){
  const t = b.tree, Z = ZONES[t.z], C = Z.trunk;
  const n = 8, base = Math.min(13, t.w*0.3), tip = 2.6;
  ctx.fillStyle = b.kind === 'thorn' ? '#3a2722' : C[1];
  ctx.beginPath();
  for (let i=0;i<=n;i++){ const tt = i/n; ctx.lineTo(branchX(b,tt), branchY(b,tt) - 0.5); }
  for (let i=n;i>=0;i--){ const tt = i/n; ctx.lineTo(branchX(b,tt), branchY(b,tt) + lerp(base, tip, tt)); }
  ctx.closePath(); ctx.fill();
  // top highlight
  ctx.strokeStyle = b.kind === 'thorn' ? 'rgba(200,140,120,0.35)' : 'rgba(255,240,210,0.28)'; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i=0;i<=n;i++){ const tt = i/n; ctx.lineTo(branchX(b,tt), branchY(b,tt) + 0.8); } ctx.stroke();
  // collar
  ctx.fillStyle = C[0]; ctx.beginPath(); ctx.ellipse(b.x0, b.y + base*0.5, 5, base*0.75, 0, 0, TAU); ctx.fill();
  // twigs
  ctx.strokeStyle = b.kind === 'thorn' ? '#3a2722' : C[1]; ctx.lineWidth = 1.5; ctx.beginPath();
  for (const tw of b.twigs){ const x = branchX(b, tw[0]), y = branchY(b, tw[0]); ctx.moveTo(x, y + 1); ctx.lineTo(x + Math.cos(tw[1])*tw[2]*b.dir, y + Math.sin(tw[1])*tw[2]); }
  ctx.stroke();
  if (b.kind === 'thorn'){
    ctx.fillStyle = '#d9cbb8';
    for (let i=1;i<14;i++){ const tt = i/14; const x = branchX(b,tt), y = branchY(b,tt), th = lerp(base,tip,tt);
      const up = i % 2 === 0; ctx.beginPath();
      if (up){ ctx.moveTo(x - 2.4, y + 0.5); ctx.lineTo(x + b.dir*1.5, y - 7.5); ctx.lineTo(x + 2.4, y + 0.5); }
      else { ctx.moveTo(x - 2.2, y + th - 0.5); ctx.lineTo(x + b.dir*1.5, y + th + 6); ctx.lineTo(x + 2.2, y + th - 0.5); }
      ctx.fill(); }
    ctx.fillStyle = 'rgba(150,30,30,0.85)';
    for (let i=0;i<3;i++){ const tt = 0.3 + i*0.25; ctx.beginPath(); ctx.arc(branchX(b,tt) + 3, branchY(b,tt) - 4, 1.6, 0, TAU); ctx.fill(); }
  }
  const S = SPR.leaf[t.z];
  for (const l of b.leafs){
    const sp = S[l.v], x = branchX(b, l.t), y = branchY(b, l.t) + l.dy;
    const w = sp.w*l.s, h = sp.h*l.s, ox = l.tip ? b.dir*w*0.36 : b.dir*6;
    if (l.tip){ ctx.strokeStyle = b.kind === 'thorn' ? '#3a2722' : C[1]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, branchY(b,1) + 1); ctx.quadraticCurveTo(x + b.dir*w*0.2, y + 4, x + ox, y - 4); ctx.stroke(); }
    ctx.drawImage(sp.c, x - w/2 + ox, y - h*0.55, w, h);
  }
}
function drawGround(L, T, R, B){
  if (B < GROUND - 260) return;
  const zi = zoneAt(cam.x);
  // mist above floor
  const mg = ctx.createLinearGradient(0, GROUND - 260, 0, GROUND);
  mg.addColorStop(0, rgb(PAL.fog, 0)); mg.addColorStop(1, rgb(PAL.fog, 0.55));
  ctx.fillStyle = mg; ctx.fillRect(L, GROUND - 260, R - L, 260);
  if (B < GROUND - 30) return;
  const gg = ctx.createLinearGradient(0, GROUND - 6, 0, GROUND + 160);
  gg.addColorStop(0, '#3b4a2a'); gg.addColorStop(0.15, '#2a2a1c'); gg.addColorStop(1, '#141510');
  ctx.fillStyle = gg; ctx.fillRect(L, GROUND - 4, R - L, B - GROUND + 10);
  // ferns, logs, mushrooms
  const step = 64, i0 = Math.floor(L / step) - 1, i1 = Math.ceil(R / step) + 1;
  for (let i=i0;i<=i1;i++){
    const hv = hash(i), x = i*step + hv*40;
    if (hv < 0.12){ // log
      ctx.fillStyle = '#4a3527'; ctx.beginPath(); ctx.ellipse(x, GROUND - 7, 46, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a6a4c'; ctx.beginPath(); ctx.ellipse(x + 44, GROUND - 7, 4, 8.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(100,140,60,0.7)'; ctx.beginPath(); ctx.ellipse(x - 10, GROUND - 14, 22, 4, 0, 0, TAU); ctx.fill();
    } else if (hv < 0.2){ // mushrooms
      for (let k=0;k<3;k++){ const mx = x + k*7, mh = 6 + hash(i+k)*6;
        ctx.fillStyle = '#e8dcc4'; ctx.fillRect(mx - 1, GROUND - mh, 2.2, mh);
        ctx.fillStyle = zi === 2 ? '#c4532c' : '#b4362a'; ctx.beginPath(); ctx.ellipse(mx + 0.1, GROUND - mh, 5, 3.4, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = '#f5ead2'; ctx.fillRect(mx - 2, GROUND - mh - 2, 1.2, 1.2); }
    }
    if (hv > 0.3){ const sp = SPR.fern[zi][i & 1]; const s = 0.7 + hash(i+31)*0.6; ctx.drawImage(sp.c, x - sp.w*s/2, GROUND - sp.h*s + 4, sp.w*s, sp.h*s); }
  }
  ctx.fillStyle = 'rgba(120,150,80,0.35)'; ctx.fillRect(L, GROUND - 4, R - L, 3);
}
function drawDrafts(T, B){
  for (const d of drafts){
    if (d.up){
      const a = 0.16 + 0.05*Math.sin(time*2 + d.x);
      const g = ctx.createLinearGradient(d.x - d.w/2, 0, d.x + d.w/2, 0);
      g.addColorStop(0, rgb(PAL.shaft, 0)); g.addColorStop(0.5, rgb(PAL.shaft, a)); g.addColorStop(1, rgb(PAL.shaft, 0));
      ctx.fillStyle = g; ctx.fillRect(d.x - d.w/2, Math.max(T, CEIL), d.w, GROUND - Math.max(T, CEIL));
      ctx.fillStyle = rgb(PAL.shaft, 0.7);
      for (let k=0;k<18;k++){ const yy = GROUND - ((time*150 + k*73 + d.x) % (GROUND - CEIL)); const xx = d.x + Math.sin(k*2.1 + time*1.3)*d.w*0.35; ctx.beginPath(); ctx.arc(xx, yy, 1.5 + (k%3)*0.5, 0, TAU); ctx.fill(); }
      // chevrons
      ctx.strokeStyle = rgb(PAL.shaft, 0.35); ctx.lineWidth = 2;
      for (let k=0;k<6;k++){ const yy = GROUND - ((time*110 + k*190) % (GROUND - CEIL)); ctx.beginPath(); ctx.moveTo(d.x - 12, yy + 7); ctx.lineTo(d.x, yy); ctx.lineTo(d.x + 12, yy + 7); ctx.stroke(); }
    } else {
      ctx.fillStyle = 'rgba(70,80,100,0.10)'; ctx.fillRect(d.x - d.w/2, Math.max(T, CEIL), d.w, GROUND - Math.max(T, CEIL));
      ctx.strokeStyle = 'rgba(210,220,235,0.4)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let k=0;k<16;k++){ const yy = CEIL + ((time*420 + k*97 + d.x) % (GROUND - CEIL)); const xx = d.x - d.w*0.42 + (hash(k + d.x)*d.w*0.84); ctx.moveTo(xx, yy); ctx.lineTo(xx - 3, yy + 34); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210,220,235,0.3)'; ctx.lineWidth = 2;
      for (let k=0;k<5;k++){ const yy = CEIL + ((time*300 + k*230) % (GROUND - CEIL)); ctx.beginPath(); ctx.moveTo(d.x - 12, yy - 7); ctx.lineTo(d.x, yy); ctx.lineTo(d.x + 12, yy - 7); ctx.stroke(); }
    }
  }
}

const aimPts = [];
let aimHit = null;
function render(){
  const key = updatePalette();
  if (key !== lastTintKey){ lastTintKey = key; tintLayers(rgb(mixC(PAL.fog, [20,30,24], 0.55))); }
  ctx.setTransform(DPR,0,0,DPR,0,0);
  drawSky();
  drawLayer(LAYERS[0], PAL.fog);
  drawLayer(LAYERS[1], PAL.fog);
  drawShafts();
  drawLayer(LAYERS[2], PAL.fog);

  worldTransform();
  const [L, T, R, B] = viewBounds();
  drawDrafts(T, B);
  for (const t of trees){ if (t.x < L - 160 || t.x > R + 160) continue; drawTree(t, T, B); }
  for (const t of trees){ if (t.x < L - 200 || t.x > R + 200) continue; for (const b of t.branches) drawBranch(b); }
  drawGround(L, T, R, B);
  // sleeping/alert owls drawn within world (graded)
  for (const o of owls){ if (o.x < L - 60 || o.x > R + 60) continue; ctx.save(); ctx.translate(o.x, o.y); drawOwl(ctx, o); ctx.restore(); }

  // colour grade
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const gr = PAL.grade;
  if (gr[0] + gr[1] + gr[2] < 755){ ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgb(gr); ctx.fillRect(0,0,W,H); ctx.globalCompositeOperation = 'source-over'; }

  worldTransform();
  // glows (owl eyes, feathers)
  ctx.globalCompositeOperation = 'lighter';
  for (const o of owls){ if (o.state === 'alert' || o.state === 'swoop'){ const a = o.state === 'alert' ? 0.6 + 0.4*Math.sin(time*30) : 0.6; ctx.globalAlpha = a; ctx.drawImage(tintedGlow([255,170,40]), o.x - 26, o.y - 39, 52, 52); } }
  for (const f of feathers){ if (f.x < L - 40 || f.x > R + 40) continue; const a = f.taken ? Math.max(0, f.fade/0.4) : 0.55 + 0.25*Math.sin(time*3 + f.ph); ctx.globalAlpha = a; ctx.drawImage(tintedGlow([255,220,120]), f.x - 40, f.y + Math.sin(time*2+f.ph)*6 - 40, 80, 80); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // berries
  for (const b of berries){
    if (b.x < L - 30 || b.x > R + 30) continue;
    const s = b.taken ? 1 + (0.35 - Math.max(0,b.fade))*3 : 1; const a = b.taken ? Math.max(0, b.fade/0.35) : 1;
    ctx.globalAlpha = a; const im = SPR.berry[b.kind]; const bob = b.b ? 0 : Math.sin(time*2.4 + b.ph)*3;
    ctx.drawImage(im, b.x - 15*s, b.y - 17*s + bob, 30*s, 30*s);
  }
  for (const f of feathers){ if (f.x < L - 40 || f.x > R + 40) continue; const a = f.taken ? Math.max(0, f.fade/0.4) : 1; ctx.globalAlpha = a; const s = f.taken ? 1.4 : 1;
    ctx.save(); ctx.translate(f.x, f.y + Math.sin(time*2+f.ph)*6); ctx.rotate(Math.sin(time*1.5+f.ph)*0.25); ctx.drawImage(SPR.feather, -15*s, -22*s, 30*s, 45*s); ctx.restore(); }
  ctx.globalAlpha = 1;

  // aim preview
  if (state === 'play' && bird.mode === 'perch' && bird.aiming){
    for (let i=0;i<aimPts.length;i+=2){ const k = i/aimPts.length, r = (5.2*(1-k*0.45))/Math.max(0.6, cam.zoom);
      ctx.fillStyle = 'rgba(25,32,24,' + (0.45*(1-k)) + ')'; ctx.beginPath(); ctx.arc(aimPts[i], aimPts[i+1] + 1, r + 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,248,230,' + (0.95*(1-k*0.8)) + ')'; ctx.beginPath(); ctx.arc(aimPts[i], aimPts[i+1], r, 0, TAU); ctx.fill(); }
    if (aimHit){ ctx.strokeStyle = aimHit.b.kind === 'thorn' ? 'rgba(255,120,100,0.9)' : 'rgba(255,230,150,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(aimHit.x, aimHit.y, 16 + Math.sin(time*8)*2, 5.5, 0, 0, TAU); ctx.stroke(); }
  }
  // trail
  const tr = bird.trail;
  if (tr.length > 6 && bird.alive){
    ctx.lineCap = 'round';
    for (let i=3;i<tr.length;i+=3){
      const sp = tr[i+2]; if (sp < 420) continue;
      const k = i / tr.length, a = clamp((sp - 420)/500, 0, 1) * k * 0.55;
      ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 1 + k*4.5;
      ctx.beginPath(); ctx.moveTo(tr[i-3], tr[i-2]); ctx.lineTo(tr[i], tr[i+1]); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  // hawk
  if (hawk.on && hawk.phase !== 'warn'){ ctx.save(); ctx.translate(hawk.x, hawk.y); drawHawk(ctx, hawk); ctx.restore(); }
  // bird
  if (bird.hiddenT <= 0 || bird.alive){
    const P = birdPose();
    ctx.save(); ctx.translate(bird.x, bird.y + (bird.mode === 'perch' ? FOOT*(1 - bird.sqY)*0.9 : 0));
    ctx.rotate(bird.rot); ctx.scale(BS * bird.sqX, BS * bird.sqY);
    if (bird.mode === 'perch' && state !== 'dying'){ ctx.translate(0, Math.sin(time*2.2)*0.35); }
    drawBird(ctx, P);
    ctx.restore();
  }
  // particles
  for (const p of particles){
    const k = p.age / p.life, a = 1 - k;
    if (p.type === 'leaf'){ ctx.save(); ctx.globalAlpha = Math.min(1, a*2); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s*0.45, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.type === 'feather'){ ctx.save(); ctx.globalAlpha = Math.min(1, a*2); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; featherPath(ctx, p.s*2, p.s*0.45); ctx.fill(); ctx.restore(); }
    else if (p.type === 'spark'){ ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s*(1-k*0.5), 0, TAU); ctx.fill(); }
    else if (p.type === 'dust'){ ctx.globalAlpha = a*0.5; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); }
    else if (p.type === 'ring'){ ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = 2.5*a; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  // popups
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of popups){
    const k = p.age / p.life; const a = k < 0.75 ? 1 : 1 - (k - 0.75)/0.25; const sc = k < 0.12 ? 0.6 + k/0.12*0.5 : k < 0.22 ? 1.1 - (k-0.12) : 1;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc/cam.zoom*0.85, sc/cam.zoom*0.85); ctx.globalAlpha = a;
    ctx.font = '700 ' + p.size + 'px "Iowan Old Style", Palatino, Georgia, serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,24,18,0.75)'; ctx.lineJoin = 'round';
    if (p.text){ ctx.strokeText(p.text, 0, 0); ctx.fillStyle = p.col; ctx.fillText(p.text, 0, 0); }
    if (p.sub){ ctx.font = '700 ' + Math.round(p.size*0.62) + 'px -apple-system, system-ui, sans-serif'; ctx.strokeText(p.sub, 0, p.size*0.85); ctx.fillStyle = '#fbf5e6'; ctx.fillText(p.sub, 0, p.size*0.85); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ---- screen space overlays ----
  ctx.setTransform(DPR,0,0,DPR,0,0);
  drawFireflies();
  drawAmbientLeaves();
  drawFront();
  // speed lines
  const sp = bird.mode === 'air' && bird.alive ? Math.hypot(bird.vx, bird.vy) : 0;
  if (sp > 620){
    const a = clamp((sp - 620)/400, 0, 1) * 0.35; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i=0;i<14;i++){ const y = (hash(i + Math.floor(time*20)) * H); const x = ((hash(i*7) * W) - time*1800*(0.6 + hash(i)*0.6)) % W; const xx = x < 0 ? x + W : x; ctx.moveTo(xx, y); ctx.lineTo(xx + 60 + hash(i)*80, y - Math.sin(bird.rot)*20); }
    ctx.stroke();
  }
  ctx.drawImage(vignette, 0, 0, W, H);
  // danger near the floor
  if (state === 'play' && bird.mode === 'air' && bird.y > GROUND - 300){
    const a = clamp((bird.y - (GROUND - 300)) / 220, 0, 1) * (0.35 + 0.15*Math.sin(time*10));
    const g = ctx.createLinearGradient(0, H*0.6, 0, H); g.addColorStop(0, 'rgba(120,20,10,0)'); g.addColorStop(1, 'rgba(120,20,10,' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(0, H*0.6, W, H*0.4);
  }
  // hawk proximity
  if (hawk.on && hawk.phase === 'chase'){
    const dx = bird.x - hawk.x; const a = clamp(1 - (dx - 60)/500, 0, 1) * 0.5;
    if (a > 0){ const g = ctx.createLinearGradient(0,0,W*0.35,0); g.addColorStop(0,'rgba(150,25,10,' + a + ')'); g.addColorStop(1,'rgba(150,25,10,0)'); ctx.fillStyle = g; ctx.fillRect(0,0,W*0.35,H); }
  }
  // launch tutorial ghost
  if (state === 'play' && bird.mode === 'perch' && !TUT.launch && !bird.aiming) drawLaunchGhost();
  // flash
  if (flash > 0){ ctx.fillStyle = 'rgba(255,250,235,' + flash + ')'; ctx.fillRect(0,0,W,H); }
}
let flash = 0;
function toScreen(x, y){ return [(x - cam.x)*cam.zoom + W/2, (y - cam.y)*cam.zoom + H/2]; }
function drawLaunchGhost(){
  const [bx, by] = toScreen(bird.x, bird.y);
  const cyc = (time % 2.2) / 2.2;
  const pull = cyc < 0.15 ? 0 : cyc < 0.65 ? smooth((cyc - 0.15)/0.5) : cyc < 0.8 ? 1 : 0;
  const dx = -34 - 60*pull, dy = 30 + 48*pull;
  const a = cyc < 0.8 ? 1 : 1 - (cyc - 0.8)/0.2;
  ctx.globalAlpha = a;
  // dotted path preview
  if (pull > 0.2){ ctx.fillStyle = 'rgba(255,248,230,0.8)'; for (let i=1;i<9;i++){ const t = i/9; ctx.beginPath(); ctx.arc(bx + t*150*pull, by - Math.sin(t*Math.PI)*90*pull + t*30, 2.6, 0, TAU); ctx.fill(); } }
  ctx.strokeStyle = 'rgba(255,248,230,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([4,5]); ctx.beginPath(); ctx.moveTo(bx - 34, by + 30); ctx.lineTo(bx + dx, by + dy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,248,230,0.95)'; ctx.beginPath(); ctx.arc(bx + dx, by + dy, 15, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(47,74,53,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx + dx, by + dy, 15, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,230,' + (0.6*(1-cyc)) + ')'; ctx.beginPath(); ctx.arc(bx + dx, by + dy, 15 + cyc*16, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
/* ambient leaves / fireflies / foreground */
const amb = [];
for (let i=0;i<22;i++) amb.push({ x: Math.random(), y: Math.random(), s: fr(3,6.5), rot: fr(0,TAU), vr: fr(-2,2), d: fr(0.5,1.3), ph: fr(0,6), c: (Math.random()*3)|0 });
let lastCamX = 0, lastCamY = 0;
function drawAmbientLeaves(){
  const L = ZONES[PAL.zi].leaves;
  for (const p of amb){
    ctx.save(); ctx.translate(p.x*W, p.y*H); ctx.rotate(p.rot); ctx.globalAlpha = 0.85;
    ctx.fillStyle = L[1 + p.c]; ctx.beginPath(); ctx.ellipse(0, 0, p.s*p.d, p.s*p.d*0.42*Math.abs(Math.cos(p.rot*1.3)) + 0.6, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function updateAmbient(dt){
  const dcx = (cam.x - lastCamX) * cam.zoom, dcy = (cam.y - lastCamY) * cam.zoom; lastCamX = cam.x; lastCamY = cam.y;
  for (const p of amb){
    p.y += (24*p.d*dt - dcy*p.d*0.9) / H; p.x += (Math.sin(time*0.9 + p.ph)*18*dt - dcx*p.d*0.9 - 8*dt) / W; p.rot += p.vr*dt;
    if (p.y > 1.05) p.y -= 1.1; if (p.y < -0.05) p.y += 1.1; if (p.x < -0.05) p.x += 1.1; if (p.x > 1.05) p.x -= 1.1;
  }
}
const flies = []; for (let i=0;i<26;i++) flies.push({ x: Math.random(), y: Math.random(), ph: fr(0,6), d: fr(0.5,1.2) });
function drawFireflies(){
  if (PAL.night < 0.05) return;
  ctx.globalCompositeOperation = 'lighter'; const gl = tintedGlow([200,255,140]);
  for (const f of flies){
    const x = ((f.x*W*1.2 - cam.x*cam.zoom*0.3*f.d) % (W*1.2) + W*1.2) % (W*1.2) - W*0.1;
    const y = f.y*H + Math.sin(time*0.8 + f.ph)*20;
    const a = PAL.night * (0.35 + 0.65*Math.max(0, Math.sin(time*1.7 + f.ph*3)));
    ctx.globalAlpha = a; ctx.drawImage(gl, x - 9*f.d, y - 9*f.d, 18*f.d, 18*f.d);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawFront(){
  const p = 1.35, span = 620, off = cam.x * cam.zoom * p;
  const [, by] = toScreen(0, GROUND);
  const baseY = Math.max(H + 30, by + 40);
  if (baseY > H + 160) return;
  for (let i = Math.floor(off/span) - 1; i < Math.floor(off/span) + Math.ceil(W/span) + 2; i++){
    if (hash(i*2.3) < 0.4) continue;
    const x = i*span - off + hash(i)*200; const sp = SPR.front[i % 3 < 0 ? 0 : i % 3];
    const s = 0.6 + hash(i+9)*0.35;
    ctx.globalAlpha = 0.82; ctx.drawImage(sp, x - 130*s, baseY - 200*s, 260*s, 200*s);
  }
  ctx.globalAlpha = 1;
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
  const sp = (state === 'play' && bird.mode === 'air') ? Math.hypot(bird.vx, bird.vy) : 0;
  const wv = soundOn ? clamp((sp - 180) / 800, 0, 1) * 0.55 : 0;
  AU.windG.gain.setTargetAtTime(wv, now, 0.12);
  AU.windF.frequency.setTargetAtTime(300 + sp*1.6, now, 0.1);
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
  const html = (on ? ICON.soundOn : ICON.soundOff) + '<span>' + (on ? 'Sound on' : 'Sound off') + '</span>';
  $('soundBtn').innerHTML = html; $('soundBtn2').innerHTML = on ? 'Sound on' : 'Sound off';
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
  hawk:  { text:'Caught by the hawk', ico:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#7a2a18"/><path d="M32 34c-5-7-13-11-26-11 6 3 9 6 12 10 5 0 8 2 10 5l-3 9 7-4 7 4-3-9c2-3 5-5 10-5 3-4 6-7 12-10-13 0-21 4-26 11z" fill="#f4ecd8"/><circle cx="32" cy="29" r="3.6" fill="#f4ecd8"/><path d="M32 28.5l4 1.8-4 1.3z" fill="#e2b04a"/></svg>' },
};
const HINT_ICO = {
  drag: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="12" cy="22" r="5" fill="#f4ecd8"/><path d="M14 20l9-9" stroke="#f4ecd8" stroke-width="2" stroke-dasharray="2 2.5"/><path d="M19 9.5h5v5" fill="none" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/>',
  hold: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="19" r="5.5" fill="#f4ecd8"/><circle cx="17" cy="19" r="9.5" fill="none" stroke="#e2b04a" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M6 11c4-3 7-3 11 0 4-3 7-3 11 0" fill="none" stroke="#f4ecd8" stroke-width="1.6" stroke-linecap="round"/>',
  dive: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><path d="M9 8c2 8 5 13 9 15s7 0 9-4" fill="none" stroke="#f4ecd8" stroke-width="2.2" stroke-linecap="round"/><path d="M24 15l3.5 4-5 1" fill="none" stroke="#e2b04a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  tap:  '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><circle cx="17" cy="20" r="4.5" fill="#f4ecd8"/><path d="M17 4v6M9 8l3 4M25 8l-3 4" stroke="#e2b04a" stroke-width="2" stroke-linecap="round"/>',
  star: '<circle cx="17" cy="17" r="16" fill="#2f4a35"/><path d="M17 7l2.6 5.6 6 .7-4.5 4.1 1.2 6L17 20.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="#e2b04a"/>',
};
let hintKey = '', hintFlash = 0;
function showHint(key, ico, text){
  if (hintKey === key) return; hintKey = key;
  if (!key){ $('hint').classList.add('hidden'); return; }
  $('hintIco').innerHTML = HINT_ICO[ico]; $('hintText').textContent = text;
  const el = $('hint'); el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden');
}
function tutDone(k){ if (!TUT[k]){ TUT[k] = 1; store.set('fw_tut', TUT); } }
function updateHints(dt){
  if (hintFlash > 0) hintFlash -= dt;
  if (state !== 'play'){ showHint('', '', ''); return; }
  if (bird.mode === 'perch'){
    if (!TUT.launch) return showHint('launch', 'drag', 'Drag back and release to leap');
    if (hintFlash > 0 && !TUT.perfect) return showHint('perfect', 'star', 'Glide in gently to land a Perfect');
    return showHint('', '', '');
  }
  if (!TUT.glide && bird.airT > 0.2 && !bird.holding) return showHint('glide', 'hold', 'Hold anywhere to glide');
  if (TUT.glide && !TUT.dive && bird.holding) return showHint('dive', 'dive', 'Keep holding: slide down to dive, then up to swoop');
  if (!TUT.flap && TUT.glide && !bird.holding && bird.flaps > 0 && bird.y > bird.launchY + 60 && bird.vy > 0) return showHint('flap', 'tap', 'Tap to flap. You get ' + bird.maxFlaps + ' per flight');
  showHint('', '', '');
}
const hud = { score:-1, dist:-1, flaps:-1, max:-1, combo:-1 };
function buildFlaps(){ let s = ''; for (let i=0;i<5;i++) s += ICON.feather.replace('id="fg"', 'id="fg'+i+'"').replace('url(#fg)', 'url(#fg'+i+')'); $('flaps').innerHTML = s; }
function flapPop(){ const el = $('flaps').children[bird.flaps]; }
function comboBump(){ const el = $('combo'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function updateHUD(){
  score = Math.floor(distM) + bonus;
  if (hud.score !== score){ hud.score = score; $('score').textContent = score.toLocaleString('en-US'); }
  const dm = Math.floor(distM); if (hud.dist !== dm){ hud.dist = dm; $('distv').textContent = dm.toLocaleString('en-US'); }
  if (hud.flaps !== bird.flaps || hud.max !== bird.maxFlaps){
    const kids = $('flaps').children;
    for (let i=0;i<5;i++){ const k = kids[i]; k.style.display = i < bird.maxFlaps ? '' : 'none'; k.classList.toggle('off', i >= bird.flaps);
      if (i < bird.flaps && hud.flaps >= 0 && i >= hud.flaps){ k.classList.remove('pop'); void k.getBoundingClientRect(); k.classList.add('pop'); } }
    hud.flaps = bird.flaps; hud.max = bird.maxFlaps;
  }
  if (hud.combo !== combo){ hud.combo = combo; $('combo').classList.toggle('hidden', combo < 2); $('combov').textContent = combo; }
  // hawk
  const hw = $('hawkWarn');
  const showHawk = hawk.on && (hawk.phase === 'warn' || (hawk.phase === 'chase' && bird.x - hawk.x > 0 && toScreen(hawk.x, hawk.y)[0] < 0));
  hw.classList.toggle('hidden', !showHawk || state !== 'play');
  if (showHawk) $('hawkBar').style.width = (hawk.phase === 'chase' ? (hawk.t / hawk.dur * 100) : 100) + '%';
}
let bannerT = 0;
function showBanner(zi, m){
  $('bannerZ').textContent = ZONES[zi].name; $('bannerS').textContent = ZONES[zi].time + '  /  ' + m.toLocaleString('en-US') + ' m';
  $('banner').classList.add('show'); bannerT = 3.2; sfx.chime();
}

function setScreen(name){
  $('title').classList.toggle('hidden', name !== 'title');
  $('pause').classList.toggle('hidden', name !== 'pause');
  $('over').classList.toggle('hidden', name !== 'over');
  $('hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
  if (name !== 'play') $('combo').classList.add('hidden'); else hud.combo = -1;
}
function startRun(){
  resetWorld(); state = 'play'; flash = 0.25;
  hud.score = hud.dist = hud.flaps = hud.max = hud.combo = -1;
  setScreen('play'); updateCamera(0, true);
  showBanner(0, 0);
}
function toTitle(){ resetWorld(); state = 'title'; setScreen('title'); $('titleBest').innerHTML = 'Best<b>' + best.toLocaleString('en-US') + '</b>'; updateCamera(0, true); }
function pauseGame(){ if (state !== 'play') return; state = 'paused'; setScreen('pause'); if (ptr) ptr = null; bird.aiming = false; bird.holding = false; }
function resumeGame(){ if (state !== 'paused') return; state = 'play'; setScreen('play'); last = performance.now(); }
function showOver(){
  state = 'over';
  score = Math.floor(distM) + bonus;
  const nb = score > best; if (nb){ best = score; store.set('fw_best', best); }
  const C = CAUSE[deathCause] || CAUSE.floor;
  $('causeIco').innerHTML = C.ico.replace(/^<svg[^>]*>|<\/svg>$/g, ''); $('causeText').textContent = C.text;
  $('overScore').textContent = score.toLocaleString('en-US'); $('overBest').textContent = best.toLocaleString('en-US');
  $('newBest').classList.toggle('hidden', !nb);
  $('stDist').textContent = Math.floor(distM).toLocaleString('en-US'); $('stPerf').textContent = perfects; $('stBerry').textContent = berryCount; $('stCombo').textContent = bestCombo;
  setScreen('over');
}

/* ---------- Input ---------- */
let ptr = null;
function onDown(e){
  e.preventDefault();
  audioInit();
  if (ptr) return;
  ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, consumed: false, dived: false };
  if (state !== 'play') { if (state === 'title') ptr.consumed = true; return; }
  if (bird.mode === 'perch'){ if (bird.stun > 0.15) { ptr.consumed = true; return; } bird.aiming = true; bird.aimDX = 0; bird.aimDY = 0; aimHit = predictPath(0, 0, aimPts); }
  else if (bird.alive){
    bird.holding = true; bird.dragDy = 0;
    bird.speed = Math.max(140, Math.hypot(bird.vx, bird.vy));
    bird.pitch = clamp(Math.atan2(bird.vy, Math.max(40, bird.vx)), -0.85, 1.25);
    bird.wvy = 0;
  }
}
function onMove(e){
  if (!ptr || e.pointerId !== ptr.id) return;
  e.preventDefault();
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = Math.max(ptr.moved, Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy));
  if (state !== 'play' || ptr.consumed) return;
  if (bird.mode === 'perch' && bird.aiming){ bird.aimDX = ptr.sx - ptr.x; bird.aimDY = ptr.sy - ptr.y; aimHit = predictPath(bird.aimDX, bird.aimDY, aimPts); }
  else if (bird.mode === 'air' && bird.holding){
    bird.dragDy = ptr.y - ptr.sy;
    if (!ptr.dived && bird.dragDy > 40){ ptr.dived = true; sfx.swoosh(1); }
    if (ptr.dived && bird.dragDy < 10) ptr.dived = false;
  }
}
function onUp(e){
  if (!ptr || e.pointerId !== ptr.id) return;
  e.preventDefault();
  const p = ptr; ptr = null;
  if (state !== 'play' || p.consumed){ bird.aiming = false; bird.holding = false; return; }
  if (bird.mode === 'perch' && bird.aiming){ bird.aiming = false; launch(p.sx - p.x, p.sy - p.y); }
  else if (bird.mode === 'air'){
    bird.holding = false;
    if (performance.now() - p.t0 < 230 && p.moved < 18) flap();
  }
}
cvs.addEventListener('pointerdown', onDown, { passive:false });
window.addEventListener('pointermove', onMove, { passive:false });
window.addEventListener('pointerup', onUp, { passive:false });
window.addEventListener('pointercancel', onUp, { passive:false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive:false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && state === 'play' && bird.mode === 'air') flap();
  if (e.code === 'Escape' || e.code === 'KeyP'){ state === 'play' ? pauseGame() : resumeGame(); }
});
function btn(id, fn){ $(id).addEventListener('click', e => { e.preventDefault(); audioInit(); sfx.ui(); fn(); }); }
btn('playBtn', startRun);
btn('soundBtn', () => setSound(!soundOn));
btn('soundBtn2', () => setSound(!soundOn));
btn('pauseBtn', pauseGame);
btn('resumeBtn', resumeGame);
btn('restartBtn', startRun);
btn('quitBtn', toTitle);
btn('againBtn', startRun);
btn('titleBtn', toTitle);
document.addEventListener('visibilitychange', () => { if (document.hidden){ pauseGame(); if (AU.c) AU.c.suspend().catch(()=>{}); } else if (AU.c && soundOn) AU.c.resume().catch(()=>{}); });

/* ---------- Main loop ---------- */
let last = performance.now(), fpsN = 0, fpsT = 0, fps = 60;
function frame(now){
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsN++; fpsT += dt; if (fpsT >= 1){ fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  const w0 = performance.now();
  if (state === 'paused'){ render(); return; }
  time += dt;
  if (hitStop > 0){ hitStop -= dt; dt *= 0.08; }
  if (slowmo < 1){ slowmo = Math.min(1, slowmo + dt*0.9); }
  const gdt = dt * slowmo;
  if (state === 'play' || state === 'dying'){
    runTime += gdt;
    updateBird(gdt);
    updateHazards(gdt);
    distM = Math.max(distM, bird.x / MPX);
    const z = Math.floor(distM / ZONE_M);
    if (z > lastZone && state === 'play'){ lastZone = z; showBanner(z % 4, z * ZONE_M); }
    if (state === 'dying'){ dieT += dt; if (dieT > 1.3) showOver(); }
  } else if (state === 'title' || state === 'over'){
    updateBird(gdt);
  }
  updateBranches(gdt);
  updateParticles(gdt);
  updateCamera(dt);
  updateAmbient(dt);
  ensureGen();
  if (shake > 0){ shake = Math.max(0, shake - dt*40); shakeX = fr(-1,1)*shake; shakeY = fr(-1,1)*shake; } else { shakeX = shakeY = 0; }
  if (flash > 0) flash = Math.max(0, flash - dt*1.5);
  if (bannerT > 0){ bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  if (state === 'play' || state === 'dying') updateHUD();
  updateHints(dt);
  updateAudio(dt);
  render();
  workMs = workMs*0.95 + (performance.now() - w0)*0.05;
}
let workMs = 0;
function resize(){
  W = window.innerWidth; H = window.innerHeight; DPR = Math.min(2, window.devicePixelRatio || 1);
  cvs.width = Math.round(W*DPR); cvs.height = Math.round(H*DPR);
  buildScreenAssets();
}
window.addEventListener('resize', resize);

// boot
buildSprites();
resize();
buildFlaps();
setSound(soundOn);
toTitle();
requestAnimationFrame(t => { last = t; frame(t); });

// test hooks
window.__FW = { get state(){ return state; }, bird, get trees(){ return trees; }, get hawk(){ return hawk; }, get fps(){ return fps; }, get workMs(){ return workMs; },
  get distM(){ return distM; }, get score(){ return score; }, cam, toScreen, predict: (dx,dy) => { const o = []; const h = predictPath(dx,dy,o); return h ? { id: h.b.id, kind: h.b.kind, tree: h.b.tree.id, x: h.x, y: h.y, t: h.t } : null; },
  setDist(m){ distM = m; }, TUT, warp(m, hawkIn){ resetWorld(m); state = 'play'; setScreen('play'); if (hawkIn !== undefined) nextHawkM = m + hawkIn; updateCamera(0, true); }, get owls(){ return owls; }, get ptr(){ return ptr; }, get perfects(){ return perfects; }, get combo(){ return combo; } };
})();
