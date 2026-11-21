// Traffic cars and pedestrians: the life of Crest Bay. Traffic follows
// the road grid; pedestrians stroll the sidewalks and run from gunfire.
// Both are kept near the camera so the city always feels busy without
// simulating thousands of actors.

import { WORLD_W, WORLD_H, ROAD_W, makeRng, clamp, dist2, angleDiff } from './config.js';
import { nearestRoadX, nearestRoadY, isRoadAt } from './world.js';

const CAR_COLORS = ['#d94f3d', '#3d7fd9', '#e8c33d', '#e8e8e8', '#2f2f33', '#7fb069', '#c97fb8', '#e08a3d'];
const PED_COLORS = ['#e8e0d0', '#d9a06b', '#8a6b4f', '#c98a7a', '#7a8a99', '#b8a06b'];

export function makeCar(x, y, angle, kind) {
  return {
    x,
    y,
    angle,
    speed: 0,
    maxSpeed: 300 + Math.random() * 120,
    driver: kind || 'parked', // parked | traffic | cop | player
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    w: 46,
    h: 22,
    wrecked: false,
    targetRoad: null,
    stuck: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    x,
    y,
    r: 12,
    angle: rng() * Math.PI * 2,
    speed: 30 + rng() * 35,
    color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
    flee: 0, // seconds of panic left
    walkPhase: rng() * 6,
    targetX: x,
    targetY: y,
  };
}

// Spawn the opening cast: parked cars from the world's spots, a spread of
// moving traffic and pedestrians across the city.
export function seedCity(G) {
  const rng = makeRng(777);
  G.cars = [];
  for (const spot of G.world.parkedSpots) {
    const car = makeCar(spot.x, spot.y, spot.angle, 'parked');
    G.cars.push(car);
  }
  // One special gold car for the final mission, parked by the marina.
  const gold = makeCar(G.world.marina.x + 60, G.world.marina.y - 40, 0, 'parked');
  gold.color = '#e8c33d';
  gold.gold = true;
  G.cars.push(gold);
  G.goldCar = gold;

  G.peds = [];
  for (let i = 0; i < 70; i++) {
    const x = 100 + rng() * (WORLD_W - 200);
    const y = 100 + rng() * (WORLD_H - 500);
    G.peds.push(makePed(x, y, rng));
  }
}

// Keep a minimum of traffic and pedestrians around the camera: despawn
// the far ones, spawn new ones on roads / sidewalks just out of view.
export function maintainCrowd(G, dt) {
  const cam = G.camera;
  const cx = cam.x;
  const cy = cam.y;
  const viewR = 1100;

  // Traffic: want ~14 moving cars near the player.
  let moving = 0;
  for (const car of G.cars) if (car.driver === 'traffic') moving++;
  G.cars = G.cars.filter((car) => {
    if (car.driver === 'traffic' && dist2(car.x, car.y, cx, cy) > viewR * viewR * 1.6) return false;
    return true;
  });
  while (moving < 14) {
    moving++;
    const angle = Math.random() * Math.PI * 2;
    const rx = cx + Math.cos(angle) * (viewR * 0.9);
    const ry = cy + Math.sin(angle) * (viewR * 0.9);
    const x = clamp(rx, 120, WORLD_W - 120);
    const y = clamp(ry, 120, WORLD_H - 320);
    const vertical = Math.abs(nearestRoadX(G.world, x) - x) < Math.abs(nearestRoadY(G.world, y) - y);
    const car = makeCar(
      vertical ? nearestRoadX(G.world, x) : x,
      vertical ? y : nearestRoadY(G.world, y),
      vertical ? Math.PI / 2 : 0,
      'traffic',
    );
    car.speed = car.maxSpeed * 0.55;
    G.cars.push(car);
  }

  // Pedestrians: want ~46 near the player.
  G.peds = G.peds.filter((p) => dist2(p.x, p.y, cx, cy) < viewR * viewR * 1.8);
  while (G.peds.length < 46) {
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(cx + Math.cos(angle) * (viewR * 0.85), 80, WORLD_W - 80);
    const y = clamp(cy + Math.sin(angle) * (viewR * 0.85), 80, WORLD_H - 280);
    G.peds.push(makePed(x, y, Math.random));
  }
}

// A traffic car drives along its current road, turning at intersections.
export function updateTrafficCar(G, car, dt) {
  if (car.driver !== 'traffic') return;
  const world = G.world;
  const speed = car.maxSpeed * 0.55;
  car.speed = speed;
  const aheadX = car.x + Math.cos(car.angle) * 30;
  const aheadY = car.y + Math.sin(car.angle) * 30;
  // Stay glued to the road: if the road ahead bends, turn towards the
  // nearest road centre line.
  if (!isRoadAt(world, aheadX, aheadY)) {
    const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
    if (vertical) {
      const targetX = nearestRoadX(world, car.x);
      car.angle += clamp(angleDiff(car.angle, car.x < targetX ? 0 : Math.PI), -2.2 * dt, 2.2 * dt);
    } else {
      const targetY = nearestRoadY(world, car.y);
      car.angle += clamp(angleDiff(car.angle, car.y < targetY ? Math.PI / 2 : -Math.PI / 2), -2.2 * dt, 2.2 * dt);
    }
  }
  // Slow for the car ahead.
  let blocked = false;
  for (const other of G.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 70 && side < 26) {
      blocked = true;
      break;
    }
  }
  const v = blocked ? 0 : speed;
  car.x += Math.cos(car.angle) * v * dt;
  car.y += Math.sin(car.angle) * v * dt;
  // Wrap around the map edges so traffic never piles up in a corner.
  if (car.x < 60) car.x = WORLD_W - 80;
  if (car.x > WORLD_W - 60) car.x = 80;
  if (car.y < 60) car.y = WORLD_H - 300;
  if (car.y > WORLD_H - 280) car.y = 80;
}

export function updatePed(G, ped, dt) {
  const p = G.player;
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = Math.atan2(ped.y - p.y, ped.x - p.x);
    ped.angle = away;
    ped.x += Math.cos(away) * 150 * dt;
    ped.y += Math.sin(away) * 150 * dt;
  } else {
    // Wander towards a nearby target, then pick a new one.
    const d = dist2(ped.x, ped.y, ped.targetX, ped.targetY);
    if (d < 900) {
      ped.targetX = clamp(ped.x + (Math.random() - 0.5) * 500, 60, WORLD_W - 60);
      ped.targetY = clamp(ped.y + (Math.random() - 0.5) * 500, 60, WORLD_H - 260);
    }
    const a = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
    ped.angle += clamp(angleDiff(ped.angle, a), -3 * dt, 3 * dt);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.walkPhase += dt * 8;
  // Stay out of buildings and the sea.
  ped.x = clamp(ped.x, 40, WORLD_W - 40);
  ped.y = clamp(ped.y, 40, WORLD_H - 240);
}
