// Small maths + formatting helpers. Deliberately dependency free: sim/ uses this
// instead of Three.js so the assembly rules can run without a browser.

export const MM = 0.001;                    // millimetres -> scene metres
export const DEG = Math.PI / 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (v, p = 0) => { const f = 10 ** p; return Math.round(v * f) / f; };
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic 32-bit RNG so a kit always shuffles the same way for a seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- vectors ----

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a, b) => len(sub(a, b));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a) {
  const l = len(a);
  return l < 1e-9 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}

// ------------------------------------------------------- rotation matrices ---
// 3x3 row-major, XYZ intrinsic order in degrees — matches Three.js Euler 'XYZ'.

export function eulerMatrix([rx, ry, rz]) {
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  // R = Rz * Ry * Rx  (Three.js applies X, then Y, then Z)
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy,     cy * sx,                cy * cx],
  ];
}

export const applyM = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

/** Rotation matrices are orthonormal, so the inverse is the transpose. */
export const applyMT = (m, v) => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
];

/** World point -> local frame of a placed part. */
export const toLocal = (worldPt, pos, rotM) => applyMT(rotM, sub(worldPt, pos));
/** Local point -> world. */
export const toWorld = (localPt, pos, rotM) => add(applyM(rotM, localPt), pos);

/** Compose euler rotations: apply `extra` in the part's LOCAL frame, then `base`. */
export function composeEuler(base, extra) {
  const A = eulerMatrix(base), B = eulerMatrix(extra);
  const M = [0, 1, 2].map((i) => [0, 1, 2].map((j) =>
    A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
  return matrixToEuler(M);
}

export function matrixToEuler(m) {
  const sy = clamp(-m[2][0], -1, 1);
  const ry = Math.asin(sy);
  let rx, rz;
  if (Math.abs(sy) < 0.9999) {
    rx = Math.atan2(m[2][1], m[2][2]);
    rz = Math.atan2(m[1][0], m[0][0]);
  } else {                                   // gimbal lock: fold rz into rx
    rx = Math.atan2(-m[1][2], m[1][1]);
    rz = 0;
  }
  return [rx / DEG, ry / DEG, rz / DEG].map((v) => round(v, 4));
}

export const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// ------------------------------------------------------------- formatting ---

export const mm = (v) => `${Math.round(v)} mm`;
export const cm = (v) => `${round(v / 10, 1)} cm`;
export const money = (v) => `€${v.toFixed(0)}`;
export function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
