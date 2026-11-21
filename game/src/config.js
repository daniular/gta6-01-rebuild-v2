// Crest Bay Heat — shared constants and the seeded random source.
// Every number that tunes the feel of the game lives here so the other
// modules can stay about behaviour, not magic numbers.

export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const BLOCK = 420; // distance between road centre lines
export const ROAD_W = 96; // width of a road
export const VIEW_W = 1280;
export const VIEW_H = 800;

// Sunset palette for the whole city.
export const PALETTE = {
  grass: '#7fae5a',
  parkGrass: '#6da34e',
  sand: '#e8d29a',
  water: '#3f8fb5',
  road: '#3a3a40',
  roadLine: '#e8d24a',
  sidewalk: '#b9b3a4',
  buildingRoof: '#c98f5f',
  buildingRoof2: '#8f7fb8',
  buildingRoof3: '#5f9e8f',
  buildingEdge: '#6e5a44',
  wall: '#8a7a63',
};

// Mulberry32: a small deterministic generator so the city layout and the
// screenshot scenes are the same on every load.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a towards angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
