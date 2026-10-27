/* ============================================================
   APEX PRIME — Voitures 3D procédurales
   Chaque constructeur retourne { group, wheels[], update(dt) }
   livery = { body, accent, number }
   Axe : +z = avant de la voiture. Unités : mètres.
   ============================================================ */

import * as THREE from 'three';

/* ---------- helpers ---------- */

function carPaint(color, { metalness = 0.35, roughness = 0.32 } = {}) {
  return new THREE.MeshStandardMaterial({
    color, metalness, roughness,
  });
}

function darkMat(roughness = 0.7) {
  return new THREE.MeshStandardMaterial({ color: 0x141417, roughness, metalness: 0.2 });
}

function glassMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x0c0f14, roughness: 0.12, metalness: 0.55,
  });
}

/* Prisme à section rectangulaire variable : idéal pour proues, capots,
   caisses de rallye, carénages — bien plus organique que des cubes. */
function prism(w1, h1, w2, h2, len, { y1 = 0, y2 = 0, z = 0 } = {}) {
  const hw1 = w1 / 2, hw2 = w2 / 2;
  const zf = len / 2, zb = -len / 2;
  const A = [-hw1, y1, zf], B = [hw1, y1, zf], C = [hw1, y1 + h1, zf], D = [-hw1, y1 + h1, zf];
  const E = [-hw2, y2, zb], F = [hw2, y2, zb], G = [hw2, y2 + h2, zb], H = [-hw2, y2 + h2, zb];
  const tris = [
    A, B, C, A, C, D,       // face avant
    F, E, H, F, H, G,       // face arrière
    E, A, D, E, D, H,       // gauche
    B, F, G, B, G, C,       // droite
    D, C, G, D, G, H,       // dessus
    E, F, B, E, B, A,       // dessous
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => { pos[i * 3] = p[0] + 0; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2] + z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function box(w, h, len, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r, w, mat, x, y, z, { rotX = Math.PI / 2, seg = 22 } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, seg), mat);
  m.rotation.x = rotX;
  m.position.set(x, y, z);
  return m;
}

function wheel(r, w, mat, x, y, z, opts = {}) {
  const g = new THREE.Group();
  const tire = cyl(r, w, opts.tireMat || darkMat(0.85), 0, 0, 0, { seg: 20 });
  tire.castShadow = true;
  g.add(tire);
  if (opts.rimColor !== undefined) {
    const rim = cyl(r * 0.62, w + 0.015, new THREE.MeshStandardMaterial({ color: opts.rimColor, metalness: 0.8, roughness: 0.25 }), 0, 0, 0, { seg: 18 });
    g.add(rim);
  }
  g.position.set(x, y, z);
  return g;
}

/* Numéro de course (texture canvas) */
function numberPlane(n, size = 0.42) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#17171c';
  ctx.font = '900 86px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false })
  );
  return m;
}

/* ============================================================
   FORMULE 1 — monocoque effilée, ailerons, halo, pneus larges
   ============================================================ */
function buildF1(livery) {
  const g = new THREE.Group();
  const body = carPaint(livery.body);
  const accent = carPaint(livery.accent, { metalness: 0.5, roughness: 0.3 });

  // Plancher
  g.add(box(1.5, 0.05, 4.7, darkMat(0.9), 0, 0.09, -0.15));

  // Monocoque : proue fine -> baquet -> capot moteur
  const tub = new THREE.Mesh(prism(0.34, 0.24, 0.62, 0.44, 2.6, { y1: 0.16, y2: 0.18 }), body);
  tub.position.z = 0.55;
  g.add(tub);
  const nose = new THREE.Mesh(prism(0.34, 0.2, 0.12, 0.12, 0.85, { y1: 0.17, y2: 0.19 }), body);
  nose.position.z = 2.3;
  g.add(nose);
  const engineCover = new THREE.Mesh(prism(0.62, 0.46, 0.26, 0.22, 2.0, { y1: 0.16, y2: 0.16 }), body);
  engineCover.position.z = -1.3;
  g.add(engineCover);
  // Aileron requin
  g.add(box(0.03, 0.34, 1.5, accent, 0, 0.5, -1.35));

  // Baquet + halo + prise d'air
  const cockpit = box(0.5, 0.13, 0.85, darkMat(0.6), 0, 0.6, 0.72);
  g.add(cockpit);
  const haloMat = darkMat(0.4);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 20, Math.PI), haloMat);
  halo.position.set(0, 0.72, 0.7);
  halo.rotation.set(Math.PI / 2.35, 0, 0);
  g.add(halo);
  const haloBar = cyl(0.03, 0.05, haloMat, 0, 0.7, 1.06);
  g.add(haloBar);
  // Boîte à air au-dessus du casque
  const airbox = new THREE.Mesh(prism(0.3, 0.3, 0.24, 0.34, 0.55, { y1: 0.6, y2: 0.55 }), body);
  airbox.position.z = 0.22;
  g.add(airbox);
  const intake = box(0.2, 0.16, 0.1, darkMat(0.3), 0, 0.72, 0.48);
  g.add(intake);

  // Pontons latéraux
  const podL = new THREE.Mesh(prism(0.52, 0.3, 0.3, 0.26, 1.7, { y1: 0.2, y2: 0.22 }), body);
  podL.position.set(-0.56, 0, 0.02);
  const podR = podL.clone();
  podR.position.x = 0.56;
  g.add(podL, podR);

  // Aileron avant
  const fwMain = box(1.9, 0.03, 0.5, accent, 0, 0.14, 2.5);
  fwMain.rotation.x = 0.12;
  const fwSec = box(1.7, 0.025, 0.28, accent, 0, 0.24, 2.42);
  fwSec.rotation.x = 0.3;
  g.add(fwMain, fwSec);
  g.add(box(0.03, 0.22, 0.55, accent, -0.94, 0.24, 2.45));
  g.add(box(0.03, 0.22, 0.55, accent, 0.94, 0.24, 2.45));

  // Aileron arrière
  const rwMat = accent;
  const rw1 = box(1.05, 0.04, 0.38, rwMat, 0, 0.95, -2.32);
  const rw2 = box(1.0, 0.035, 0.3, rwMat, 0, 0.82, -2.36);
  rw2.rotation.x = -0.2;
  const rwEndL = box(0.022, 0.36, 0.62, rwMat, -0.51, 0.78, -2.32);
  const rwEndR = box(0.022, 0.36, 0.62, rwMat, 0.51, 0.78, -2.32);
  g.add(rw1, rw2, rwEndL, rwEndR);
  g.add(box(0.05, 0.62, 0.05, darkMat(0.5), 0, 0.45, -2.3)); // pylône
  // Diffuseur arrière
  const diffuser = box(1.1, 0.14, 0.4, darkMat(0.6), 0, 0.13, -2.35);
  diffuser.rotation.x = -0.35;
  g.add(diffuser);
  // Bargeboards
  g.add(box(0.02, 0.22, 0.5, darkMat(0.5), -0.52, 0.3, 0.85));
  g.add(box(0.02, 0.22, 0.5, darkMat(0.5), 0.52, 0.3, 0.85));

  // Roues + couvertures 2022 + suspensions
  const wheels = [];
  const tireMat = darkMat(0.9);
  const rimMat = new THREE.MeshStandardMaterial({ color: livery.accent, metalness: 0.85, roughness: 0.2 });
  const positions = [
    [-0.84, 0.34, 1.62, 0.33, 0.34],
    [0.84, 0.34, 1.62, 0.33, 0.34],
    [-0.82, 0.37, -1.82, 0.37, 0.4],
    [0.82, 0.37, -1.82, 0.37, 0.4],
  ];
  positions.forEach(([x, y, z, r, w]) => {
    const wh = wheel(r, w, tireMat, x, y, z, { rimColor: livery.accent });
    g.add(wh);
    wheels.push(wh);
    // couverture de roue (disque fin côté extérieur)
    const cover = cyl(r * 0.85, 0.012, rimMat, x + Math.sign(x) * (w / 2 + 0.008), y, z, { seg: 18 });
    g.add(cover);
    // triangle de suspension : deux bras fins châssis -> moyeu
    const armLen = Math.abs(x) - 0.28;
    const arm = box(armLen, 0.022, 0.05, haloMat, Math.sign(x) * (0.28 + armLen / 2), y - 0.04, z + 0.12);
    const arm2 = box(armLen, 0.022, 0.05, haloMat, Math.sign(x) * (0.28 + armLen / 2), y - 0.04, z - 0.12);
    g.add(arm, arm2);
  });

  // Rétroviseurs
  g.add(box(0.14, 0.08, 0.05, haloMat, -0.34, 0.62, 1.05));
  g.add(box(0.14, 0.08, 0.05, haloMat, 0.34, 0.62, 1.05));

  // Numéros
  const nL = numberPlane(livery.number ?? 27, 0.34);
  nL.rotation.y = -Math.PI / 2;
  nL.position.set(-0.63, 0.38, 0.35);
  const nR = nL.clone();
  nR.rotation.y = Math.PI / 2;
  nR.position.x = 0.63;
  g.add(nL, nR);

  return { group: g, wheels, wheelRadius: 0.35 };
}

/* ============================================================
   VOITURE DE RALLYE — citadine compacte, vitres, lumières
   ============================================================ */
function buildRally(livery) {
  const g = new THREE.Group();
  const body = carPaint(livery.body, { metalness: 0.45, roughness: 0.38 });
  const accent = carPaint(livery.accent, { metalness: 0.3, roughness: 0.4 });

  // Caisse basse (capot plus bas à l'avant)
  const lower = new THREE.Mesh(prism(1.72, 0.42, 1.78, 0.5, 4.0, { y1: 0.28, y2: 0.3 }), body);
  g.add(lower);
  // Habitacle vitré
  const cabin = new THREE.Mesh(prism(1.5, 0.4, 1.58, 0.34, 2.1, { y1: 0.76, y2: 0.78 }), glassMat());
  g.add(cabin);
  // Toit
  const roof = new THREE.Mesh(prism(1.52, 0.06, 1.6, 0.06, 2.16, { y1: 1.14, y2: 1.12 }), body);
  g.add(roof);
  // Bandeau de livrée
  g.add(box(1.82, 0.16, 2.6, accent, 0, 0.62, -0.2));

  // Boucliers + antibrouillaires
  g.add(box(1.7, 0.16, 0.18, darkMat(0.5), 0, 0.3, 2.06));
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1.2 });
  g.add(box(0.34, 0.12, 0.06, lightMat, -0.55, 0.44, 2.02));
  g.add(box(0.34, 0.12, 0.06, lightMat, 0.55, 0.44, 2.02));

  // Aileron de toit + prise d'air
  g.add(box(1.4, 0.05, 0.34, darkMat(0.5), 0, 1.24, -1.35));
  g.add(box(0.5, 0.06, 0.3, darkMat(0.6), 0, 1.2, -0.3));

  // Roues + bavanges
  const wheels = [];
  const tireMat = darkMat(0.95);
  const wp = [
    [-0.86, 0.34, 1.32, 0.32],
    [0.86, 0.34, 1.32, 0.32],
    [-0.88, 0.34, -1.28, 0.32],
    [0.88, 0.34, -1.28, 0.32],
  ];
  wp.forEach(([x, y, z, r]) => {
    const wh = wheel(r, 0.26, tireMat, x, y, z, { rimColor: livery.accent });
    g.add(wh);
    wheels.push(wh);
    g.add(box(0.3, 0.16, 0.28, darkMat(1), Math.sign(x) * 0.98, 0.22, z)); // bavette
  });

  // Échappement
  g.add(cyl(0.05, 0.16, new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.3 }), -0.4, 0.36, -2.02));

  const nB = numberPlane(livery.number ?? 27, 0.4);
  nB.rotation.y = -Math.PI / 2;
  nB.position.set(-0.9, 0.6, 0.3);
  const nBr = nB.clone();
  nBr.rotation.y = Math.PI / 2;
  nBr.position.x = 0.9;
  g.add(nB, nBr);

  return { group: g, wheels, wheelRadius: 0.32 };
}

/* ============================================================
   VOITURE DE DRIFT — coupé large, gros aileron, arches évasées
   ============================================================ */
function buildDrift(livery) {
  const g = new THREE.Group();
  const body = carPaint(livery.body, { metalness: 0.5, roughness: 0.3 });
  const accent = carPaint(livery.accent, { metalness: 0.4, roughness: 0.35 });

  const lower = new THREE.Mesh(prism(1.86, 0.4, 1.9, 0.5, 4.4, { y1: 0.26, y2: 0.28 }), body);
  g.add(lower);
  const cabin = new THREE.Mesh(prism(1.56, 0.38, 1.62, 0.26, 2.0, { y1: 0.72, y2: 0.74 }), glassMat());
  g.add(cabin);
  const roof = new THREE.Mesh(prism(1.58, 0.06, 1.64, 0.05, 2.05, { y1: 1.08, y2: 1.06 }), body);
  g.add(roof);
  // Capot
  const hoodScoop = box(0.4, 0.08, 0.5, darkMat(0.5), 0, 0.68, 1.2);
  g.add(hoodScoop);

  // Évasements d'aile
  [[-1, 1.35], [1, 1.35], [-1, -1.45], [1, -1.45]].forEach(([sx, z]) => {
    g.add(box(0.16, 0.14, 0.9, body, sx * 0.98, 0.52, z));
  });

  // Gros aileron arrière sur pieds
  const wing = box(1.6, 0.045, 0.42, accent, 0, 1.18, -2.0);
  wing.rotation.x = -0.14;
  g.add(wing);
  g.add(box(0.05, 0.4, 0.05, darkMat(0.4), -0.7, 0.95, -2.0));
  g.add(box(0.05, 0.4, 0.05, darkMat(0.4), 0.7, 0.95, -2.0));

  const wheels = [];
  const tireMat = darkMat(0.95);
  const wp = [
    [-0.92, 0.33, 1.42, 0.32],
    [0.92, 0.33, 1.42, 0.32],
    [-0.94, 0.34, -1.42, 0.33],
    [0.94, 0.34, -1.42, 0.33],
  ];
  wp.forEach(([x, y, z, r]) => {
    const wh = wheel(r, 0.3, tireMat, x, y, z, { rimColor: 0xc9c9cf });
    g.add(wh);
    wheels.push(wh);
  });

  const nL = numberPlane(livery.number ?? 27, 0.4);
  nL.rotation.y = -Math.PI / 2;
  nL.position.set(-0.96, 0.55, 0.2);
  const nR = nL.clone();
  nR.rotation.y = Math.PI / 2;
  nR.position.x = 0.96;
  g.add(nL, nR);

  return { group: g, wheels, wheelRadius: 0.32 };
}

/* ============================================================
   KART — châssis tubulaire, petit et bas
   ============================================================ */
function buildKart(livery) {
  const g = new THREE.Group();
  const body = carPaint(livery.body, { metalness: 0.3, roughness: 0.4 });
  const accent = carPaint(livery.accent, { metalness: 0.4, roughness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8b8b93, metalness: 0.85, roughness: 0.3 });

  // Plancher châssis
  g.add(box(0.8, 0.05, 1.3, body, 0, 0.12, -0.1));
  // Proue
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.4, 0.55, 12), body);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.16, 0.95);
  g.add(nose);
  // Pontons latéraux
  g.add(box(0.18, 0.1, 0.85, accent, -0.42, 0.16, 0.25));
  g.add(box(0.18, 0.1, 0.85, accent, 0.42, 0.16, 0.25));
  // Siège baquet
  const seat = box(0.36, 0.42, 0.08, darkMat(0.6), 0, 0.42, -0.42);
  seat.rotation.x = -0.18;
  g.add(seat);
  g.add(box(0.36, 0.1, 0.4, darkMat(0.6), 0, 0.2, -0.45));
  // Volant
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 18), darkMat(0.4));
  steering.rotation.x = -0.5;
  steering.position.set(0, 0.48, 0.32);
  g.add(steering);
  g.add(cyl(0.02, 0.3, metal, 0, 0.42, 0.38));
  // Moteur
  g.add(box(0.3, 0.24, 0.3, darkMat(0.5), 0.32, 0.24, -0.5));

  // Pare-chocs
  const bumpMat = metal;
  g.add(cyl(0.03, 1.0, bumpMat, 0, 0.28, 1.28));
  g.add(cyl(0.03, 0.9, bumpMat, 0, 0.28, -0.98));

  const wheels = [];
  const tireMat = darkMat(0.95);
  const wp = [
    [-0.44, 0.16, 0.78, 0.16],
    [0.44, 0.16, 0.78, 0.16],
    [-0.5, 0.18, -0.72, 0.18],
    [0.5, 0.18, -0.72, 0.18],
  ];
  wp.forEach(([x, y, z, r]) => {
    const wh = wheel(r, 0.16, tireMat, x, y, z, { rimColor: 0xc9c9cf });
    g.add(wh);
    wheels.push(wh);
  });

  const nF = numberPlane(livery.number ?? 27, 0.3);
  nF.rotation.x = -Math.PI / 2;
  nF.position.set(0, 0.16, 0.55);
  g.add(nF);

  return { group: g, wheels, wheelRadius: 0.17 };
}

/* ============================================================
   GT OVALE — muscle car carénée
   ============================================================ */
function buildGT(livery) {
  const g = new THREE.Group();
  const body = carPaint(livery.body, { metalness: 0.55, roughness: 0.28 });
  const accent = carPaint(livery.accent, { metalness: 0.4 });

  const lower = new THREE.Mesh(prism(1.88, 0.46, 1.92, 0.56, 4.9, { y1: 0.3, y2: 0.32 }), body);
  g.add(lower);
  const cabin = new THREE.Mesh(prism(1.6, 0.4, 1.66, 0.3, 2.3, { y1: 0.76, y2: 0.78 }), glassMat());
  g.add(cabin);
  const roof = new THREE.Mesh(prism(1.62, 0.06, 1.68, 0.06, 2.36, { y1: 1.14, y2: 1.12 }), body);
  g.add(roof);
  // Rayures
  g.add(box(0.4, 0.02, 4.9, accent, -0.25, 0.85, 0));
  g.add(box(0.4, 0.02, 4.9, accent, 0.25, 0.85, 0));
  // Becquet
  g.add(box(1.7, 0.06, 0.4, accent, 0, 1.0, -2.3));

  const wheels = [];
  const tireMat = darkMat(0.95);
  const wp = [
    [-0.92, 0.36, 1.55, 0.35],
    [0.92, 0.36, 1.55, 0.35],
    [-0.94, 0.37, -1.55, 0.36],
    [0.94, 0.37, -1.55, 0.36],
  ];
  wp.forEach(([x, y, z, r]) => {
    const wh = wheel(r, 0.32, tireMat, x, y, z, { rimColor: 0xb9b9c2 });
    g.add(wh);
    wheels.push(wh);
  });

  const nL = numberPlane(livery.number ?? 27, 0.44);
  nL.rotation.y = -Math.PI / 2;
  nL.position.set(-0.97, 0.55, 0.4);
  const nR = nL.clone();
  nR.rotation.y = Math.PI / 2;
  nR.position.x = 0.97;
  g.add(nL, nR);

  return { group: g, wheels, wheelRadius: 0.35 };
}

/* ============================================================
   DRAGSTER — châssis long, moteur exposé, slicks énormes
   ============================================================ */
function buildDrag(livery) {
  const g = new THREE.Group();
  const body = carPaint(livery.body, { metalness: 0.5, roughness: 0.3 });
  const accent = carPaint(livery.accent, { metalness: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 1, roughness: 0.15 });

  // Châssis long et fin
  const chassis = new THREE.Mesh(prism(0.5, 0.16, 0.34, 0.14, 5.6, { y1: 0.5, y2: 0.52 }), body);
  chassis.position.z = 0.6;
  g.add(chassis);
  // Longue proue
  const noseD = new THREE.Mesh(prism(0.34, 0.14, 0.08, 0.08, 1.8, { y1: 0.5, y2: 0.54 }), body);
  noseD.position.z = 3.7;
  g.add(noseD);

  // Bloc moteur exposé
  const eng = box(0.62, 0.5, 0.85, darkMat(0.4), 0, 0.62, 1.1);
  g.add(eng);
  // Échappements en V
  for (let i = 0; i < 4; i++) {
    const pipe = cyl(0.045, 0.75, chrome, -0.28 + i * 0.02, 0.95, 0.82 + i * 0.14, { rotX: 0 });
    pipe.rotation.z = 0.25;
    g.add(pipe);
    const pipe2 = cyl(0.045, 0.75, chrome, 0.28 - i * 0.02, 0.95, 0.82 + i * 0.14, { rotX: 0 });
    pipe2.rotation.z = -0.25;
    g.add(pipe2);
  }

  // Cockpit arrière + arceau
  const cockpit = new THREE.Mesh(prism(0.44, 0.3, 0.5, 0.34, 1.0, { y1: 0.6, y2: 0.6 }), accent);
  cockpit.position.z = -1.3;
  g.add(cockpit);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 16, Math.PI), darkMat(0.4));
  hoop.position.set(0, 0.78, -1.75);
  hoop.rotation.set(Math.PI / 2, 0, 0);
  g.add(hoop);

  // Aileron arrière
  const wing = box(1.5, 0.05, 0.5, accent, 0, 1.25, -2.4);
  g.add(wing);
  g.add(box(0.06, 0.55, 0.06, darkMat(0.4), -0.7, 0.95, -2.4));
  g.add(box(0.06, 0.55, 0.06, darkMat(0.4), 0.7, 0.95, -2.4));

  // Parachute replié
  g.add(box(0.3, 0.12, 0.25, darkMat(0.6), 0, 0.6, -2.62));

  // Slicks arrière géants + roues avant vélo
  const wheels = [];
  const tireMat = darkMat(0.95);
  const slick = wheel(0.46, 0.56, tireMat, -0.78, 0.46, -1.7, { rimColor: livery.accent });
  const slickR = wheel(0.46, 0.56, tireMat, 0.78, 0.46, -1.7, { rimColor: livery.accent });
  g.add(slick, slickR);
  wheels.push(slick, slickR);
  const fwL = wheel(0.2, 0.1, tireMat, -0.22, 0.54, 3.4, { rimColor: 0xc9c9cf });
  const fwR = wheel(0.2, 0.1, tireMat, 0.22, 0.54, 3.4, { rimColor: 0xc9c9cf });
  g.add(fwL, fwR);
  wheels.push(fwL, fwR);

  const nL = numberPlane(livery.number ?? 27, 0.5);
  nL.rotation.y = -Math.PI / 2;
  nL.position.set(-0.3, 0.7, -1.2);
  const nR = nL.clone();
  nR.rotation.y = Math.PI / 2;
  nR.position.x = 0.3;
  g.add(nL, nR);

  return { group: g, wheels, wheelRadius: 0.4 };
}

/* ---------- Dispatcher ---------- */

const BUILDERS = { f1: buildF1, rally: buildRally, drift: buildDrift, kart: buildKart, gt: buildGT, drag: buildDrag };

export function makeCar(type, livery) {
  const builder = BUILDERS[type] || buildF1;
  const car = builder(livery);
  car.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return car;
}

export const CAR_LABELS = {
  f1: 'Formule 1', rally: 'Rallye', drift: 'Coupé drift', kart: 'Kart', gt: 'GT Ovale', drag: 'Top Fuel',
};
