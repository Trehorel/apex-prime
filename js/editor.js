/* ============================================================
   APEX PRIME — Créateur de circuits
   Clique : ajouter un point. Glisser : déplacer. Double-clic :
   supprimer. Le circuit suit les points en douceur (spline).
   ============================================================ */

import * as THREE from 'three';

const VIEW = 170; // demi-taille de la zone visible en mètres

export class TrackEditor {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.ctx = canvas.getContext('2d');
    this.points = [];
    this.closed = true;
    this.width = 10;
    this.relief = 0;
    this.theme = 'gp';
    this.name = '';
    this.dragIndex = -1;
    this.hoverIndex = -1;
    this.scale = 1;

    this.bindEvents();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.scale = this.canvas.width / (VIEW * 2);
    this.dpr = dpr;
    this.render();
  }

  toWorld(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * VIEW * 2 - VIEW;
    const z = (e.clientY - r.top) / r.height * VIEW * 2 - VIEW;
    return { x, z };
  }

  pointAt(p, radius = 14) {
    const r = radius / this.scale;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const pt = this.points[i];
      if ((pt.x - p.x) ** 2 + (pt.z - p.z) ** 2 < r * r) return i;
    }
    return -1;
  }

  bindEvents() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = this.toWorld(e);
      const hit = this.pointAt(p);
      if (e.button === 2) {
        if (hit >= 0) { this.points.splice(hit, 1); this.render(); }
        return;
      }
      if (hit >= 0) this.dragIndex = hit;
      else if (this.points.length < 40) { this.points.push(p); this.dragIndex = this.points.length - 1; this.render(); }
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.toWorld(e);
      this.hoverIndex = this.pointAt(p);
      c.style.cursor = this.hoverIndex >= 0 ? 'grab' : 'crosshair';
      if (this.dragIndex >= 0) {
        this.points[this.dragIndex] = p;
        this.render();
      }
    });
    const endDrag = () => { this.dragIndex = -1; };
    c.addEventListener('pointerup', endDrag);
    c.addEventListener('pointercancel', endDrag);
    c.addEventListener('dblclick', (e) => {
      const hit = this.pointAt(e ? this.toWorld(e) : null, 20);
      if (hit >= 0 && this.points.length > 4) { this.points.splice(hit, 1); this.render(); }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  clear() { this.points = []; this.render(); }
  undo() { this.points.pop(); this.render(); }

  loadDef(def) {
    this.points = def.points.map((p) => ({ x: p[0], z: p[2] }));
    this.closed = !!def.closed;
    this.width = def.width || 10;
    this.theme = def.theme || 'gp';
    this.relief = def.points.some((p) => p[1]) ? 8 : 0;
    this.name = def.name || '';
    this.render();
  }

  /* Définition exportable */
  toDef(name) {
    const pts = this.points.map((p, i) => {
      const y = this.relief > 0 ? Math.sin((i / Math.max(1, this.points.length - 1)) * Math.PI * 2) * this.relief : 0;
      return [Math.round(p.x * 10) / 10, Math.round(y * 10) / 10, Math.round(p.z * 10) / 10];
    });
    return {
      id: 'custom-' + Date.now().toString(36),
      name: name || this.name || 'Mon circuit',
      theme: this.theme,
      width: this.width,
      closed: this.closed,
      points: pts,
    };
  }

  isValid() {
    const n = this.points.length;
    return (this.closed ? n >= 4 : n >= 3) && this.lengthEstimate() > 40;
  }

  lengthEstimate() {
    if (this.points.length < 2) return 0;
    const pts = this.points.map((p) => new THREE.Vector3(p.x, 0, p.z));
    const curve = new THREE.CatmullRomCurve3(pts, this.closed, 'catmullrom', 0.5);
    return curve.getLength();
  }

  /* Courbe lissée (mêmes maths que le moteur 3D) */
  sampledPath() {
    if (this.points.length < 3) return [];
    const pts = this.points.map((p) => new THREE.Vector3(p.x, 0, p.z));
    const curve = new THREE.CatmullRomCurve3(pts, this.closed, 'catmullrom', 0.5);
    return curve.getSpacedPoints(Math.min(220, Math.max(40, Math.round(curve.getLength() / 3))));
  }

  toScreen(p) {
    return [((p.x + VIEW) / (VIEW * 2)) * this.canvas.width, ((p.z + VIEW) / (VIEW * 2)) * this.canvas.height];
  }

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // fond
    ctx.fillStyle = '#fbfaf8';
    ctx.fillRect(0, 0, W, H);

    // grille
    const step = (20 / (VIEW * 2)) * W;
    ctx.strokeStyle = 'rgba(23,23,28,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // bordure de zone jouable
    ctx.strokeStyle = 'rgba(23,23,28,0.14)';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.setLineDash([]);

    const path = this.sampledPath();
    if (path.length >= 3) {
      // bas-côté
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#d9d4c8';
      ctx.lineWidth = (this.width + 3) / (VIEW * 2) * W;
      this.tracePath(ctx, path);
      ctx.stroke();
      // asphalte
      ctx.strokeStyle = '#4a4b52';
      ctx.lineWidth = this.width / (VIEW * 2) * W;
      this.tracePath(ctx, path);
      ctx.stroke();
      // ligne centrale
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 12]);
      this.tracePath(ctx, path);
      ctx.stroke();
      ctx.setLineDash([]);
      // ligne de départ
      const s = path[0], s2 = path[1] || path[path.length - 1];
      const ang = Math.atan2(s2.z - s.z, s2.x - s.x) + Math.PI / 2;
      const [sx, sy] = this.toScreen(s);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = '#f2b705';
      ctx.fillRect(-4, -(this.width / 2) / (VIEW * 2) * W, 8, (this.width) / (VIEW * 2) * W);
      ctx.restore();
    }

    // points de contrôle
    this.points.forEach((p, i) => {
      const [x, y] = this.toScreen(p);
      const r = i === this.hoverIndex || i === this.dragIndex ? 9 : 6.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#f2b705' : '#e84e0f';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // aide si vide
    if (this.points.length === 0) {
      ctx.fillStyle = 'rgba(23,23,28,0.35)';
      ctx.font = `600 ${15 * this.dpr}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Clique sur la grille pour poser ton premier point', W / 2, H / 2);
    }
  }

  tracePath(ctx, path) {
    ctx.beginPath();
    path.forEach((p, i) => {
      const [x, y] = this.toScreen(p);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    if (this.closed) ctx.closePath();
  }
}

/* Aperçu statique (page d'accueil) */
export function drawEditorPreview(canvas) {
  const editor = new TrackEditor(canvas, null);
  editor.points = [
    { x: -90, z: -60 }, { x: 10, z: -78 }, { x: 92, z: -40 }, { x: 96, z: 30 },
    { x: 30, z: 66 }, { x: -40, z: 88 }, { x: -98, z: 40 }, { x: -96, z: -14 },
  ];
  editor.width = 12;
  editor.render();
}
