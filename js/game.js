/* 
   APEX PRIME — Moteur de course 3D
   Partie 1 : scène, circuit, voiture, caméra
*/

import * as THREE from 'three';
import { makeCar } from './cars.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function sampleTrack(points, width, samplesPerSegment = 24) {
  const samples = [];
  const closed = points.length > 2;

  for (let i = 0; i < points.length; i++) {
    const a = new THREE.Vector3(points[i].x, 0, points[i].z);
    const b = closed
      ? new THREE.Vector3(points[(i + 1) % points.length].x, 0, points[(i + 1) % points.length].z)
      : new THREE.Vector3(points[i + 1].x, 0, points[i + 1].z);

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const pos = a.clone().lerp(b, t);
      const dir = b.clone().sub(a).normalize();
      const normal = new THREE.Vector3(-dir.z, 0, dir.x);
      samples.push({ pos, dir, normal, width });
    }
  }

  return { samples, count: samples.length, width };
}

function buildTrackMesh(runtime) {
  const { samples, count, width } = runtime;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < count; i++) {
    const s = samples[i];
    const left = s.pos.clone().addScaledVector(s.normal, width / 2);
    const right = s.pos.clone().addScaledVector(s.normal, -width / 2);

    positions.push(left.x, 0.02, left.z);
    positions.push(right.x, 0.02, right.z);
    uvs.push(0, i / count * 40);
    uvs.push(1, i / count * 40);

    if (i < count - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2);
      indices.push(a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x2a2a33,
    roughness: 0.85,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function buildTrackLines(runtime) {
  const group = new THREE.Group();
  const { samples, count, width } = runtime;

  for (let i = 0; i < count; i += 8) {
    const s = samples[i];

    for (const side of [1, -1]) {
      const p = s.pos.clone().addScaledVector(s.normal, (width / 2) * side);
      const geometry = new THREE.BoxGeometry(0.35, 0.04, 2.2);
      const material = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });
      const kerb = new THREE.Mesh(geometry, material);
      kerb.position.set(p.x, 0.04, p.z);
      kerb.rotation.y = Math.atan2(s.dir.x, s.dir.z);
      group.add(kerb);
    }
  }

  return group;
}

function buildGround(size = 900) {
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({
    color: 0x7fa653,
    roughness: 1,
  });

  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  return ground;
}

function buildSky() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(80, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;

  const group = new THREE.Group();
  group.add(hemi, sun);
  return group;
}

export class RaceGame {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.disposed = false;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd9ea);
    this.scene.fog = new THREE.Fog(0xbfd9ea, 220, 620);

    this.camera = new THREE.PerspectiveCamera(
      68,
      container.clientWidth / container.clientHeight,
      0.1,
      1600
    );

    this.scene.add(buildSky());
    this.scene.add(buildGround());

    this.clock = new THREE.Clock();
    this.keys = {};
    this.speed = 0;
    this.lap = 1;
    this.progress = 0;
    this.finished = false;
    this.startTime = performance.now();

    this.bindEvents();
    this.buildTrack(options.track);
    this.buildCar(options.car);
    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);
  }

  buildTrack(track) {
    const points = track?.points?.length
      ? track.points
      : [
          { x: -90, z: -60 }, { x: 10, z: -78 }, { x: 92, z: -40 },
          { x: 96, z: 30 }, { x: 30, z: 66 }, { x: -40, z: 88 },
          { x: -98, z: 40 }, { x: -96, z: -14 },
        ];

    this.trackRuntime = sampleTrack(points, track?.width || 14);
    this.trackMesh = buildTrackMesh(this.trackRuntime);
    this.trackLines = buildTrackLines(this.trackRuntime);

    this.scene.add(this.trackMesh);
    this.scene.add(this.trackLines);

    const start = this.trackRuntime.samples[0];
    this.carPosition = start.pos.clone();
    this.carHeading = Math.atan2(start.dir.x, start.dir.z);
  }

  buildCar(car) {
    const livery = car?.livery || { body: 0xe84e0f, accent: 0x101014, number: '1' };
    const built = makeCar(car?.type || 'f1', livery);

    this.car = built.group;
    this.carWheels = built.wheels || [];
    this.carUpdate = built.update || null;

    this.car.position.copy(this.carPosition);
    this.car.rotation.y = this.carHeading;
    this.scene.add(this.car);
  }

  bindEvents() {
    this.onKeyDown = (event) => {
      this.keys[event.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };

    this.onKeyUp = (event) => {
      this.keys[event.code] = false;
    };

    this.onResize = () => {
      if (this.disposed || !this.container) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);

    this.renderer.dispose();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
  getNearestSample(position) {
    const { samples, count } = this.trackRuntime;
    let best = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < count; i++) {
      const distance = samples[i].pos.distanceToSquared(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    return { sample: samples[best], index: best };
  }

  updateCar(dt) {
    const accelerate = this.keys['ArrowUp'] || this.keys['KeyW'];
    const brake = this.keys['ArrowDown'] || this.keys['KeyS'];
    const left = this.keys['ArrowLeft'] || this.keys['KeyA'];
    const right = this.keys['ArrowRight'] || this.keys['KeyD'];
    const handbrake = this.keys['Space'];

    const maxSpeed = this.options.maxSpeed || 78;
    const acceleration = this.options.acceleration || 34;
    const brakeForce = this.options.brakeForce || 58;
    const drag = 0.72;

    if (accelerate) {
      this.speed += acceleration * dt;
    }

    if (brake) {
      this.speed -= brakeForce * dt;
    }

    if (!accelerate && !brake) {
      this.speed -= this.speed * drag * dt;
    }

    if (handbrake) {
      this.speed -= this.speed * 2.4 * dt;
    }

    this.speed = clamp(this.speed, -18, maxSpeed);

    const speedFactor = clamp(Math.abs(this.speed) / 22, 0, 1);
    const steerStrength = 1.55 * speedFactor;
    let steer = 0;

    if (left) steer += steerStrength;
    if (right) steer -= steerStrength;

    this.carHeading += steer * dt * Math.sign(this.speed || 1);

    const forward = new THREE.Vector3(
      Math.sin(this.carHeading),
      0,
      Math.cos(this.carHeading)
    );

    this.carPosition.addScaledVector(forward, this.speed * dt);

    const { sample } = this.getNearestSample(this.carPosition);
    const distanceFromCenter = sample.pos.distanceTo(this.carPosition);
    const limit = sample.width / 2 + 2.5;

    if (distanceFromCenter > limit) {
      const back = sample.pos.clone().addScaledVector(
        this.carPosition.clone().sub(sample.pos).normalize(),
        limit
      );

      this.carPosition.x = back.x;
      this.carPosition.z = back.z;
      this.speed *= 0.55;
    }

    this.car.position.set(this.carPosition.x, 0, this.carPosition.z);
    this.car.rotation.y = this.carHeading;

    const wheelSpin = this.speed * dt * 2.4;

    for (const wheel of this.carWheels) {
      if (wheel.rotation) {
        wheel.rotation.x -= wheelSpin;
      }
    }

    if (this.carUpdate) {
      this.carUpdate(dt, this.speed);
    }
  }

  updateCamera(dt) {
    const target = new THREE.Vector3(
      this.carPosition.x,
      4.2,
      this.carPosition.z
    );

    const behind = new THREE.Vector3(
      Math.sin(this.carHeading),
      0,
      Math.cos(this.carHeading)
    ).multiplyScalar(-11);

    const desired = target.clone().add(behind);
    desired.y = 5.2;

    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(
      this.carPosition.x,
      1.4,
      this.carPosition.z
    );
  }

  updateRace() {
    const { samples, count } = this.trackRuntime;
    const { index } = this.getNearestSample(this.carPosition);
    const newProgress = index / count;

    if (this.progress > 0.85 && newProgress < 0.15) {
      this.lap += 1;

      if (this.options.onLap) {
        this.options.onLap(this.lap);
      }

      const totalLaps = this.options.laps || 3;

      if (this.lap > totalLaps && !this.finished) {
        this.finished = true;
        this.speed = 0;

        if (this.options.onFinish) {
          this.options.onFinish({
            time: performance.now() - this.startTime,
            laps: totalLaps,
          });
        }
      }
    }

    this.progress = newProgress;

    if (this.options.onHud) {
      this.options.onHud({
        speed: Math.abs(Math.round(this.speed * 3.6)),
        lap: Math.min(this.lap, this.options.laps || 3),
        totalLaps: this.options.laps || 3,
        progress: this.progress,
      });
    }
  }

  animate() {
    if (this.disposed) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.finished) {
      this.updateCar(dt);
      this.updateRace();
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
