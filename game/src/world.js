// Crest Bay itself: a road grid, building blocks, a beach on the south
// shore, a park, and the safehouse / garage / pier landmarks. The layout
// is generated once from a fixed seed so every load plays the same city.

import { WORLD_W, WORLD_H, BLOCK, ROAD_W, PALETTE, makeRng, clamp } from './config.js';

export function buildWorld() {
  const rng = makeRng(20261121);
  const buildings = [];
  const palms = [];
  const parkedSpots = [];
  const roadXs = [];
  const roadYs = [];

  for (let x = BLOCK / 2; x < WORLD_W; x += BLOCK) roadXs.push(x);
  for (let y = BLOCK / 2; y < WORLD_H; y += BLOCK) roadYs.push(y);

  // Buildings fill each block between roads, leaving a sidewalk margin.
  const roofColors = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3];
  for (let bx = 0; bx < roadXs.length - 1; bx++) {
    for (let by = 0; by < roadYs.length - 1; by++) {
      const x0 = roadXs[bx] + ROAD_W / 2 + 26;
      const y0 = roadYs[by] + ROAD_W / 2 + 26;
      const x1 = roadXs[bx + 1] - ROAD_W / 2 - 26;
      const y1 = roadYs[by + 1] - ROAD_W / 2 - 26;
      // The park block stays open.
      if (bx === 2 && by === 3) continue;
      // The beach strip is the bottom two rows.
      if (by >= roadYs.length - 2) continue;
      const w = x1 - x0;
      const h = y1 - y0;
      const two = rng() < 0.45;
      if (two) {
        const split = rng() < 0.5;
        if (split) {
          buildings.push({ x: x0, y: y0, w: w * 0.46, h, roof: roofColors[(bx + by) % 3] });
          buildings.push({ x: x0 + w * 0.54, y: y0, w: w * 0.46, h, roof: roofColors[(bx * 2 + by) % 3] });
        } else {
          buildings.push({ x: x0, y: y0, w, h: h * 0.46, roof: roofColors[(bx + by) % 3] });
          buildings.push({ x: x0, y: y0 + h * 0.54, w, h: h * 0.46, roof: roofColors[(bx + by * 2) % 3] });
        }
      } else {
        buildings.push({ x: x0, y: y0, w, h, roof: roofColors[(bx * 3 + by) % 3] });
      }
    }
  }

  // Palm trees along the beach and around the park.
  for (let i = 0; i < 90; i++) {
    const beach = i < 55;
    palms.push({
      x: 60 + rng() * (WORLD_W - 120),
      y: beach ? WORLD_H - 170 + rng() * 120 : roadYs[3] + 60 + rng() * 200,
      r: 7 + rng() * 4,
    });
  }

  // Parked cars line the roads.
  for (let i = 0; i < 46; i++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = roadXs[Math.floor(rng() * roadXs.length)];
      parkedSpots.push({
        x: rx + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16),
        y: 120 + rng() * (WORLD_H - 420),
        angle: Math.PI / 2,
      });
    } else {
      const ry = roadYs[Math.floor(rng() * roadYs.length)];
      parkedSpots.push({
        x: 120 + rng() * (WORLD_W - 240),
        y: ry + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16),
        angle: 0,
      });
    }
  }

  const world = {
    buildings,
    palms,
    parkedSpots,
    roadXs,
    roadYs,
    // Landmarks (world coords).
    safehouse: { x: roadXs[1], y: roadYs[1] },
    garage: { x: roadXs[5], y: roadYs[2] },
    pier: { x: WORLD_W - 260, y: WORLD_H - 130 },
    marina: { x: 320, y: WORLD_H - 130 },
    park: { x: roadXs[2] + BLOCK / 2, y: roadYs[3] + BLOCK / 2 },
    beachY: WORLD_H - 220,
  };
  return world;
}

export function isRoadAt(world, x, y) {
  const half = ROAD_W / 2;
  for (const rx of world.roadXs) if (Math.abs(x - rx) < half) return true;
  for (const ry of world.roadYs) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function isWaterAt(world, x, y) {
  return y > world.beachY + 90;
}

// Nearest road centre coordinate on the given axis.
export function nearestRoadX(world, x) {
  let best = world.roadXs[0];
  for (const rx of world.roadXs) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(world, y) {
  let best = world.roadYs[0];
  for (const ry of world.roadYs) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// Push a circle (x, y, radius) out of every building it overlaps.
// Returns true when a push happened.
export function collideBuildings(world, body) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = clamp(body.x, b.x, b.x + b.w);
    const cy = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.r * body.r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * body.r;
        body.y = cy + (dy / d) * body.r;
      } else {
        body.x = b.x - body.r;
      }
    }
  }
  return hit;
}

// Keep a body inside the playable land (not into the sea, not off-map).
export function clampToLand(world, body) {
  body.x = clamp(body.x, 30, WORLD_W - 30);
  body.y = clamp(body.y, 30, world.beachY + 80);
}
