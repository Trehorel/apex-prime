/* ============================================================
   APEX PRIME — Garage : visionneuse 3D + personnalisation
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeCar, CAR_LABELS } from './cars.js';

export class Garage {
  constructor(canvas, { interactive = true } = {}) {
    this.canvas = canvas;
    this.interactive = interactive;
    this.type = 'f1';
    this.livery = { body: '#e84e0f', accent: '#6c2bd9', number: 27 };
    this.running = false;

    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || w * 0.75;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: canvas });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(5.8, 2.7, 6.8);

    // environnement studio pour les reflets de peinture
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;

    // sol : disque sombre + anneau orange
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7, 64),
      new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.32, metalness: 0.35 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 0.035, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xe84e0f })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    // lumières
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(5, 8, 4);
    const rim = new THREE.DirectionalLight(0xe84e0f, 1.6);
    rim.position.set(-6, 3, -5);
    const fill = new THREE.DirectionalLight(0x8f7bff, 0.7);
    fill.position.set(0, 5, -7);
    this.scene.add(key, rim, fill, new THREE.AmbientLight(0xffffff, 0.25));

    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);
    this.buildCar();

    if (interactive) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.minDistance = 4;
      this.controls.maxDistance = 14;
      this.controls.maxPolarAngle = Math.PI / 2.05;
      this.controls.target.set(0, 0.7, 0);
    }

    this.clock = new THREE.Clock();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }

  buildCar() {
    this.carGroup.clear();
    const car = makeCar(this.type, this.livery);
    car.group.position.y = 0.02;
    this.carGroup.add(car.group);
    this.wheels = car.wheels;
    // recadre la voiture selon sa taille
    const box = new THREE.Box3().setFromObject(car.group);
    const size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.z);
    const k = clampNum(6.2 / d, 0.5, 2.4);
    this.carGroup.scale.setScalar(k);
    this.camera.position.set(5.8, 2.7, 6.8);
  }

  setType(t) { this.type = t; this.buildCar(); }
  setLivery(l) { this.livery = { ...this.livery, ...l }; this.buildCar(); }

  resize() {
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || w * 0.75;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.carGroup.rotation.y += dt * 0.45;
      if (this.wheels) this.wheels.forEach((w) => (w.rotation.x -= dt * 0.8));
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    if (this.controls) this.controls.dispose();
    if (this.envMap) this.envMap.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.renderer.dispose();
  }
}

function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* Aperçu du garage sur la page d'accueil */
export function makeGaragePreview(canvas) {
  const g = new Garage(canvas, { interactive: false });
  g.camera.position.set(6.4, 2.9, 7.5);
  g.camera.lookAt(0, 0.8, 0);
  g.start();
  return g;
}

export const LIVERY_PRESETS = [
  { name: 'Papaya', body: '#e84e0f', accent: '#101014' },
  { name: 'Violet', body: '#6c2bd9', accent: '#f2b705' },
  { name: 'Or', body: '#f2b705', accent: '#17171c' },
  { name: 'Azur', body: '#2f6fd8', accent: '#ffffff' },
  { name: 'Rouge', body: '#c62828', accent: '#f2f2f2' },
  { name: 'Émeraude', body: '#0f9d58', accent: '#101014' },
];
