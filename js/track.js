/* ============================================================
   APEX PRIME — Circuits : spline -> géométrie 3D + runtime
   ============================================================ */

import * as THREE from 'three';
import { THEMES } from './data.js';

/* ---------- Textures procédurales (canvas) ---------- */

function noiseCanvas(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  fn(ctx, size);
  return c;
}

function makeAsphaltTex() {
  const c = noiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#3c3d42';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const v = 40 + Math.random() * 50;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.12 + Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 1.6, 1.6);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCurbTex() {
  const c = noiseCanvas(64, (ctx, s) => {
    ctx.fillStyle = '#d43a3a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, s, s / 2);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeGrassTex(color) {
  const c = noiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4200; i++) {
      const g = Math.random() * 0.22;
      ctx.fillStyle = `rgba(${g * 180},${g * 230},${g * 120},0.25)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCheckerTex() {
  const c = noiseCanvas(128, (ctx, s) => {
    const n = 8, cs = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#101014' : '#f5f5f5';
        ctx.fillRect(i * cs, j * cs, cs, cs);
      }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Runtime : échantillonnage de la ligne centrale ---------- */

export function buildRuntime(def) {
  const pts = def.points.map((p) => new THREE.Vector3(p[0], p[1] || 0, p[2]));
  const closed = !!def.closed;
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.5);
  const approxLen = curve.getLength();
  const n = Math.max(60, Math.min(1400, Math.round(approxLen / 2.5)));
  const spaced = curve.getSpacedPoints(n);
  const count = spaced.length; // closed: last point == first, keep it
  const samples = [];
  for (let i = 0; i < count; i++) {
    const p = spaced[i];
    const pNext = spaced[(i + 1) % count];
    const pPrev = spaced[(i - 1 + count) % count];
    const tan = new THREE.Vector3().subVectors(closed || i < count - 1 ? pNext : p, closed || i > 0 ? pPrev : p).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tan).normalize();
    samples.push({ pos: p, tan, right });
  }
  // distances + courbure
  let dist = 0;
  for (let i = 0; i < count; i++) {
    samples[i].dist = dist;
    const next = samples[(i + 1) % count];
    let d;
    if (i === count - 1) {
      d = closed ? samples[0].pos.distanceTo(next.pos) : 0;
    } else d = samples[i].pos.distanceTo(next.pos);
    dist += d;
  }
  const length = dist;
  for (let i = 0; i < count; i++) {
    const prev = samples[(i - 1 + count) % count];
    const next = samples[(i + 1) % count];
    const a1 = Math.atan2(prev.tan.x, prev.tan.z);
    const a2 = Math.atan2(next.tan.x, next.tan.z);
    let da = a2 - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const segLen = (i === 0 && !closed) ? 2.5 : (length / count);
    samples[i].curv = Math.abs(da) / Math.max(segLen, 0.5) * (closed ? 1 : 1);
    samples[i].curvSign = da;
    // pente (slope)
    samples[i].slope = (next.pos.y - prev.pos.y) / (2 * Math.max(segLen, 0.5));
  }

  const halfW = (def.width || 10) / 2;
  const bankK = def.banking ? def.banking * 120 : 0;

  return {
    def, closed, samples, count, length, halfW, bankK,
    /* Projection : position monde -> { index, lateral, progress, y } */
    project(pos, hint = 0) {
      let best = -1, bestD2 = Infinity;
      const W = 40;
      for (let k = -W; k <= W; k++) {
        const i = (hint + k + count) % count;
        const d2 = samples[i].pos.distanceToSquared(pos);
        if (d2 < bestD2) { bestD2 = d2; best = i; }
      }
      // pour les pistes ouvertes, évite le wrap
      if (!closed && Math.abs(hint - best) > W) best = hint;
      const s = samples[best];
      const rel = new THREE.Vector3().subVectors(pos, s.pos);
      const lateral = rel.x * s.right.x + rel.z * s.right.z;
      const along = rel.x * s.tan.x + rel.z * s.tan.z;
      let progress = s.dist + along;
      if (progress < 0) progress += length;
      if (progress >= length) progress -= length;
      return { index: best, lateral, progress, y: s.pos.y, sample: s };
    },
    /* Point sur la ligne centrale à la distance s */
    sampleAt(s) {
      s = ((s % length) + length) % length;
      const i = Math.min(count - 1, Math.floor((s / length) * count));
      return samples[i];
    },
    sampleIndexAt(s) {
      s = ((s % length) + length) % length;
      return Math.min(count - 1, Math.floor((s / length) * count));
    },
  };
}

/* ---------- Génération de la scène 3D du circuit ---------- */

function ribbon(runtime, offA, offB, yLift, mat, { vScale = 0.06, curbTex = false, uvWidth = 1 } = {}) {
  const { samples, count, closed, halfW, bankK } = runtime;
  const verts = [], uvs = [], idx = [];
  const segs = count; // closed : boucle complète (wrap) ; open : count-1 segments
  const totalSegs = closed ? segs : segs - 1;
  for (let i = 0; i < (closed ? count : count); i++) {
    const s = samples[i];
    // banking : inclinaison de la section
    const bank = Math.min(0.32, Math.abs(s.curv) * bankK) * (s.curvSign > 0 ? 1 : -1);
    const right = s.right.clone();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromAxisAngle(s.tan, -bank);
    right.applyQuaternion(q);
    const a = s.pos.clone().addScaledVector(right, offA);
    const b = s.pos.clone().addScaledVector(right, offB);
    a.y += yLift; b.y += yLift;
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uvs.push(0, s.dist * vScale, uvWidth, s.dist * vScale);
  }
  for (let i = 0; i < totalSegs; i++) {
    const j = (i + 1) % count;
    const v0 = i * 2, v1 = i * 2 + 1, v2 = j * 2, v3 = j * 2 + 1;
    idx.push(v0, v2, v1, v1, v2, v3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildTrackScene(runtime, themeKey = 'gp') {
  const theme = THEMES[themeKey] || THEMES.gp;
  const g = new THREE.Group();
  const { halfW, count, samples, closed, length } = runtime;

  // Asphalte
  const asphalt = new THREE.MeshStandardMaterial({ map: makeAsphaltTex(), roughness: 0.92, metalness: 0 });
  g.add(ribbon(runtime, -halfW, halfW, 0.02, asphalt, { vScale: 0.04 }));

  // Lignes blanches de bord
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
  g.add(ribbon(runtime, -halfW + 0.05, -halfW + 0.28, 0.045, lineMat));
  g.add(ribbon(runtime, halfW - 0.28, halfW - 0.05, 0.045, lineMat));

  // Vibreurs (rouge/blanc) sur les zones courbées -> on pose un ruban continu fin
  if (theme.curbs !== false) {
    const curbMat = new THREE.MeshStandardMaterial({ map: makeCurbTex(), roughness: 0.8 });
    g.add(ribbon(runtime, -halfW - 0.5, -halfW - 0.02, 0.03, curbMat, { vScale: 0.35 }));
    g.add(ribbon(runtime, halfW + 0.02, halfW + 0.5, 0.03, curbMat, { vScale: 0.35 }));
  }

  // Bas-côté (herbe / terre / désert)
  const grassMat = new THREE.MeshStandardMaterial({ map: makeGrassTex(theme.grass), roughness: 1 });
  const grassMatFar = new THREE.MeshStandardMaterial({ map: makeGrassTex(theme.grassFar), roughness: 1 });
  g.add(ribbon(runtime, -halfW - 0.5, -halfW - 55, -0.06, grassMat, { vScale: 0.012 }));
  g.add(ribbon(runtime, halfW + 0.5, halfW + 55, -0.06, grassMat, { vScale: 0.012 }));

  // Sol lointain
  let minY = Infinity, maxX = -Infinity, maxZ = -Infinity, minX = Infinity, minZ = Infinity;
  samples.forEach((s) => {
    minY = Math.min(minY, s.pos.y);
    maxX = Math.max(maxX, s.pos.x); minX = Math.min(minX, s.pos.x);
    maxZ = Math.max(maxZ, s.pos.z); minZ = Math.min(minZ, s.pos.z);
  });
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const rad = Math.max(maxX - minX, maxZ - minZ) / 2 + 260;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), grassMatFar);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, Math.max(0, minY) - 0.5, cz);
  ground.receiveShadow = true;
  g.add(ground);

  // Ligne de départ / arrivée
  const startLine = new THREE.Mesh(
    new THREE.PlaneGeometry(runtime.def.width || 10, 3),
    new THREE.MeshStandardMaterial({ map: makeCheckerTex(), roughness: 0.8 })
  );
  const s0 = samples[0];
  startLine.position.copy(s0.pos).setY(s0.pos.y + 0.05);
  startLine.lookAt(s0.pos.clone().add(s0.tan));
  startLine.rotateX(-Math.PI / 2);
  g.add(startLine);

  // Portique de départ
  const postMat = new THREE.MeshStandardMaterial({ color: 0x232630, roughness: 0.5, metalness: 0.4 });
  const gate = new THREE.Group();
  const ph = 6;
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ph, 8), postMat);
  const pR = pL.clone();
  pL.position.set(-halfW - 0.6, ph / 2, 0);
  pR.position.set(halfW + 0.6, ph / 2, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry((halfW + 0.6) * 2, 0.9, 0.3), postMat);
  beam.position.y = ph - 0.4;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry((halfW + 0.4) * 2, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xe84e0f, emissive: 0xe84e0f, emissiveIntensity: 0.35 })
  );
  banner.position.set(0, ph - 0.4, 0.18);
  gate.add(pL, pR, beam, banner);
  gate.position.copy(s0.pos);
  gate.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(), s0.tan, new THREE.Vector3(0, 1, 0))
  );
  g.add(gate);

  // Murs de sécurité (instanciés)
  const wallStep = 9;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb9b9c2, roughness: 0.6, metalness: 0.3 });
  const wallGeo = new THREE.BoxGeometry(1.6, 0.9, 0.5);
  const nWalls = Math.floor(length / wallStep) * 2;
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, nWalls);
  let wi = 0;
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let d = 0; d < length && wi < nWalls; d += wallStep) {
    const s = runtime.sampleAt(d);
    for (const side of [-1, 1]) {
      const p = s.pos.clone().addScaledVector(s.right, side * (halfW + 1.4));
      p.y += 0.45;
      const yaw = Math.atan2(s.tan.x, s.tan.z);
      qq.setFromAxisAngle(up, yaw);
      m4.compose(p, qq, new THREE.Vector3(1, 1, 1));
      walls.setMatrixAt(wi++, m4);
    }
  }
  walls.count = wi;
  g.add(walls);

  // Arbres / rochers / cactus (instanciés)
  const treeCount = themeKey === 'forest' ? 220 : 130;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const canopyGeo = new THREE.ConeGeometry(1.6, 3.6, 7);
  const canopyMats = {
    pine: new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 }),
    dense: new THREE.MeshStandardMaterial({ color: 0x3d7a3a, roughness: 1 }),
    cactus: new THREE.MeshStandardMaterial({ color: 0x4a8a52, roughness: 1 }),
  };
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMats[theme.trees === 'cactus' ? 'cactus' : theme.trees === 'dense' ? 'dense' : 'pine'], treeCount);
  let ti = 0;
  let guard = 0;
  while (ti < treeCount && guard++ < 5000) {
    const x = cx + (Math.random() - 0.5) * (rad * 1.5);
    const z = cz + (Math.random() - 0.5) * (rad * 1.5);
    const p = new THREE.Vector3(x, 0, z);
    // distance à la piste
    let ok = true;
    for (let i = 0; i < count; i += 4) {
      if (samples[i].pos.distanceToSquared(p) < (halfW + 9) * (halfW + 9)) { ok = false; break; }
    }
    if (!ok) continue;
    const near = nearestSampleY(runtime, p);
    const sc = 0.8 + Math.random() * 0.7;
    m4.compose(new THREE.Vector3(x, near + 1.1 * sc, z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    trunks.setMatrixAt(ti, m4);
    m4.compose(new THREE.Vector3(x, near + (2.2 + 1.8) * sc, z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    canopies.setMatrixAt(ti, m4);
    ti++;
  }
  trunks.count = canopies.count = ti;
  trunks.castShadow = canopies.castShadow = true;
  g.add(trunks, canopies);

  // Montagnes (thème montagne)
  if (theme.mountains) {
    const mMat = new THREE.MeshStandardMaterial({ color: 0x7d8a96, roughness: 1, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.8 });
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const d = rad * (0.75 + Math.random() * 0.3);
      const h = 90 + Math.random() * 130;
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 7), mMat);
      m.position.set(cx + Math.cos(ang) * d, minY + h / 2 - 8, cz + Math.sin(ang) * d);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h * 0.3, 7), snowMat);
      cap.position.set(m.position.x, minY + h - h * 0.15 - 8, m.position.z);
      g.add(m, cap);
    }
  }

  // Tribune (thème GP)
  if (themeKey === 'gp') {
    const standMat = new THREE.MeshStandardMaterial({ color: 0xd8d8de, roughness: 0.8 });
    const crowdMat = new THREE.MeshStandardMaterial({ color: 0x8f9aa8, roughness: 1 });
    for (let k = -1; k <= 1; k++) {
      const d = length * 0.05 + k * 2;
      const s = runtime.sampleAt(d);
      const p = s.pos.clone().addScaledVector(s.right, -(halfW + 16));
      const stand = new THREE.Mesh(new THREE.BoxGeometry(40, 8, 14), standMat);
      stand.position.set(p.x, p.y + 4, p.z);
      stand.rotation.y = Math.atan2(s.tan.x, s.tan.z);
      const crowd = new THREE.Mesh(new THREE.BoxGeometry(38, 3, 12), crowdMat);
      crowd.position.set(p.x, p.y + 9, p.z);
      crowd.rotation.y = stand.rotation.y;
      g.add(stand, crowd);
    }
  }

  // Lampadaires nuit
  if (theme.night) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.5 });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9b0, emissiveIntensity: 2 });
    for (let d = 0; d < length; d += 36) {
      const s = runtime.sampleAt(d);
      for (const side of [-1, 1]) {
        const p = s.pos.clone().addScaledVector(s.right, side * (halfW + 3.5));
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), poleMat);
        pole.position.set(p.x, p.y + 4.5, p.z);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), bulbMat);
        bulb.position.set(p.x - side * 1.6, p.y + 9, p.z);
        g.add(pole, bulb);
      }
    }
  }

  return { group: g, theme };
}

function nearestSampleY(runtime, p) {
  let best = 0, bd = Infinity;
  const { samples, count } = runtime;
  for (let i = 0; i < count; i += 6) {
    const d = samples[i].pos.distanceToSquared(p);
    if (d < bd) { bd = d; best = i; }
  }
  return samples[best].pos.y;
}
