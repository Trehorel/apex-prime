/* ============================================================
   APEX PRIME — Données : disciplines, voitures, circuits
   ============================================================ */

export const DISCIPLINES = {
  f1: {
    id: 'f1', name: 'Formule 1', badge: 'Grand Prix', badgeClass: 'race-badge-battle',
    car: 'f1', track: 'circuit-azur', laps: 3, ai: true,
    desc: 'Adhérence totale, appui aérodynamique et freinage millimétré sur circuit.',
    physics: { topSpeed: 92, accel: 16, brake: 42, grip: 12.5, steerMax: 2.4, drift: 0.35 },
  },
  rally: {
    id: 'rally', name: 'Rallye', badge: 'Terre & gravier', badgeClass: 'race-badge-battle',
    car: 'rally', track: 'speciale-foret', laps: 3, ai: true,
    desc: 'Glisse pilotée sur spéciale forestière, le contre-braquage comme arme.',
    physics: { topSpeed: 58, accel: 12, brake: 30, grip: 6.2, steerMax: 2.7, drift: 0.9 },
  },
  drift: {
    id: 'drift', name: 'Drift', badge: 'Style', badgeClass: 'race-badge-solo',
    car: 'drift', track: 'drift-plaza', laps: 2, ai: false, mode: 'drift',
    desc: "Garde l'angle maximal dans chaque virage pour engranger les points.",
    physics: { topSpeed: 46, accel: 14, brake: 30, grip: 3.4, steerMax: 3.4, drift: 1.5 },
  },
  kart: {
    id: 'kart', name: 'Karting', badge: 'Pilote débutant', badgeClass: 'race-badge-battle',
    car: 'kart', track: 'kart-sprint', laps: 4, ai: true,
    desc: 'Bagarres de kart sur un circuit serré : la porte d\u2019entrée de la course.',
    physics: { topSpeed: 25, accel: 11, brake: 22, grip: 13, steerMax: 3.6, drift: 0.3 },
  },
  drag: {
    id: 'drag', name: 'Dragster', badge: '402 mètres', badgeClass: 'race-badge-solo',
    car: 'drag', track: 'quart-mille', laps: 1, ai: false, mode: 'drag',
    desc: 'Ligne droite, régime dans le rouge, passages de vitesse au millimètre.',
    physics: { topSpeed: 128, accel: 30, brake: 18, grip: 10, steerMax: 1.2, drift: 0.2 },
  },
  oval: {
    id: 'oval', name: 'Ovale', badge: 'Pack racing', badgeClass: 'race-badge-battle',
    car: 'gt', track: 'ovale-speedway', laps: 4, ai: true,
    desc: 'Vitesse pure en drafting, trois de large dans les virages relevés.',
    physics: { topSpeed: 82, accel: 14, brake: 34, grip: 10.5, steerMax: 2.2, drift: 0.5 },
  },
  hill: {
    id: 'hill', name: 'Course de côte', badge: 'Dénivelé 80 m', badgeClass: 'race-badge-solo',
    car: 'rally', track: 'col-montagne', laps: 1, ai: false, mode: 'time',
    desc: 'Un col de montagne, un chrono, aucune marge d\u2019erreur.',
    physics: { topSpeed: 52, accel: 11, brake: 26, grip: 6.8, steerMax: 2.7, drift: 0.8 },
  },
  time: {
    id: 'time', name: 'Contre-la-montre', badge: 'Chrono pur', badgeClass: 'race-badge-solo',
    car: 'f1', track: 'circuit-azur', laps: 99, ai: false, mode: 'time',
    desc: 'Seul en piste, meilleur tour après meilleur tour, sans trafic.',
    physics: { topSpeed: 92, accel: 16, brake: 42, grip: 12.5, steerMax: 2.4, drift: 0.35 },
  },
};

export const THEMES = {
  gp: {
    label: 'Circuit GP',
    sky: 0x9ec8e8, fog: 0x9ec8e8, fogFar: 900,
    grass: '#5d8f3e', grassFar: '#4c7433',
    trees: 'pine', walls: 'tire', curbs: true, sun: 0xfff3e0, sunI: 2.6,
  },
  forest: {
    label: 'Forêt de rallye',
    sky: 0xb8c9b0, fog: 0xb8c9b0, fogFar: 520,
    grass: '#6e7f4a', grassFar: '#5b6b3d',
    trees: 'dense', walls: 'wood', curbs: false, sun: 0xfff0d0, sunI: 1.9,
  },
  mountain: {
    label: 'Montagne',
    sky: 0xa9c4e0, fog: 0xa9c4e0, fogFar: 800,
    grass: '#7c8a68', grassFar: '#6b7a5c',
    trees: 'pine', walls: 'rock', curbs: true, mountains: true, sun: 0xfff6e8, sunI: 2.4,
  },
  desert: {
    label: 'Désert',
    sky: 0xf3d9a8, fog: 0xf3d9a8, fogFar: 700,
    grass: '#c8a86a', grassFar: '#b3965c',
    trees: 'cactus', walls: 'rock', curbs: true, sun: 0xfff0cc, sunI: 3.0,
  },
  night: {
    label: 'Nuit urbaine',
    sky: 0x14161f, fog: 0x14161f, fogFar: 420,
    grass: '#2b2e3a', grassFar: '#22242e',
    trees: 'city', walls: 'urban', curbs: true, sun: 0xc9d8ff, sunI: 0.9, night: true,
  },
};

/* ------------------------------------------------------------
   Circuits intégrés — points de contrôle [x, y(altitude), z]
   x/z en mètres. y = altitude du point.
   ------------------------------------------------------------ */

export const BUILTIN_TRACKS = [
  {
    id: 'circuit-azur', name: 'Circuit Azur', theme: 'gp', width: 12, closed: true,
    points: [
      [0, 0, -120], [110, 0, -130], [185, 0, -95], [195, 0, -30], [150, 0, 20],
      [90, 0, 35], [60, 1, 90], [110, 2, 150], [80, 2, 215], [10, 2, 230],
      [-70, 1, 200], [-95, 0, 130], [-160, 0, 120], [-210, 0, 60], [-200, 0, -40],
      [-140, 0, -95], [-70, 0, -110],
    ],
  },
  {
    id: 'speciale-foret', name: 'Spéciale Forêt', theme: 'forest', width: 9, closed: true,
    points: [
      [0, 0, -90], [70, 2, -100], [120, 5, -70], [130, 8, -10], [90, 9, 40],
      [110, 10, 95], [60, 11, 130], [-10, 12, 120], [-45, 12, 70], [-100, 13, 85],
      [-135, 12, 30], [-110, 9, -25], [-140, 6, -70], [-80, 2, -95],
    ],
  },
  {
    id: 'drift-plaza', name: 'Drift Plaza', theme: 'night', width: 13, closed: true,
    points: [
      [0, 0, -60], [70, 0, -65], [115, 0, -30], [105, 0, 25], [60, 0, 45],
      [65, 0, 90], [10, 0, 100], [-55, 0, 80], [-95, 0, 35], [-85, 0, -25],
      [-50, 0, -55],
    ],
  },
  {
    id: 'kart-sprint', name: 'Kart Sprint', theme: 'gp', width: 7, closed: true,
    points: [
      [0, 0, -34], [30, 0, -36], [52, 0, -18], [48, 0, 8], [24, 0, 16],
      [28, 0, 34], [0, 0, 38], [-26, 0, 28], [-40, 0, 4], [-30, 0, -22],
      [-16, 0, -30],
    ],
  },
  {
    id: 'quart-mille', name: 'Ligne Quart-Mille', theme: 'desert', width: 10, closed: false,
    points: [
      [0, 0, 0], [0, 0, 60], [0, 0, 140], [0, 0, 230], [0, 0, 330], [0, 0, 440], [0, 0, 520],
    ],
  },
  {
    id: 'ovale-speedway', name: 'Ovale Speedway', theme: 'gp', width: 16, closed: true,
    banking: 0.12,
    points: [
      [0, 0, -95], [85, 0, -95], [140, 0, -55], [140, 0, 55], [85, 0, 95],
      [0, 0, 95], [-85, 0, 95], [-140, 0, 55], [-140, 0, -55], [-85, 0, -95],
    ],
  },
  {
    id: 'col-montagne', name: 'Col de la Montagne', theme: 'mountain', width: 9, closed: false,
    points: [
      [0, 0, 0], [-35, 6, 55], [25, 14, 110], [-20, 22, 165], [30, 30, 220],
      [-30, 38, 275], [10, 46, 330], [-25, 54, 385], [20, 62, 440], [-10, 70, 495],
      [0, 78, 545], [0, 80, 585],
    ],
  },
];

export function trackById(id) {
  return BUILTIN_TRACKS.find((t) => t.id === id) || null;
}

/* Livrées par défaut (utilisées si rien dans le garage) */
export const DEFAULT_LIVERY = {
  f1:    { body: '#e84e0f', accent: '#101014' },
  rally: { body: '#2f6fd8', accent: '#f2b705' },
  drift: { body: '#6c2bd9', accent: '#ffffff' },
  kart:  { body: '#e84e0f', accent: '#101014' },
  gt:    { body: '#f2b705', accent: '#101014' },
  drag:  { body: '#e84e0f', accent: '#f2b705' },
};

/* IA : noms de pilotes */
export const AI_NAMES = ['Vasseur', 'Moreno', 'Tanaka', 'Sørensen', 'Rossi', 'Duval', 'Ekström'];

/* Couleurs IA (carrosseries adversaires) */
export const AI_COLORS = ['#2f6fd8', '#0f9d58', '#f2b705', '#6c2bd9', '#c62828', '#00838f', '#5d4037'];
