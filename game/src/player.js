// The player: Rook Calloway, getaway driver. On foot he walks with
// WASD; near a car, E gets in (stealing it if it is occupied, which the
// police notice). In a car the same keys drive. Health, busted and
// respawn live here too.

import { clamp, dist2 } from './config.js';
import { collideBuildings, clampToLand, isWaterAt } from './world.js';

export function createPlayer(world) {
  return {
    x: world.safehouse.x + 40,
    y: world.safehouse.y + 40,
    r: 14,
    angle: -Math.PI / 2, // facing up
    speed: 0,
    health: 100,
    cash: 0,
    inCar: null, // car object when driving, else null
    bustedTimer: 0,
    invuln: 0,
    walkAnim: 0,
  };
}

// Move on foot. Returns nothing; collisions push the player out of walls.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let mx = 0;
  let my = 0;
  if (input.keys['w'] || input.keys['ArrowUp']) my -= 1;
  if (input.keys['s'] || input.keys['ArrowDown']) my += 1;
  if (input.keys['a'] || input.keys['ArrowLeft']) mx -= 1;
  if (input.keys['d'] || input.keys['ArrowRight']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const walkSpeed = 175;
    p.x += mx * walkSpeed * dt;
    p.y += my * walkSpeed * dt;
    p.angle = Math.atan2(my, mx);
    p.walkAnim += dt * 10;
  } else {
    p.walkAnim = 0;
  }
  if (isWaterAt(G.world, p.x, p.y)) {
    // The sea is not a shortcut: push back onto the sand.
    p.y = G.world.beachY + 78;
  }
  collideBuildings(G.world, p);
  clampToLand(G.world, p);
  if (p.invuln > 0) p.invuln -= dt;
}

// Find the nearest car the player could get into.
export function nearestCar(G, maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// E pressed near a car: get in. Stealing an occupied car is a crime.
export function tryEnterCar(G) {
  const p = G.player;
  if (p.inCar) return false;
  const car = nearestCar(G, 64);
  if (!car) return false;
  if (car.driver === 'traffic' || car.driver === 'cop') {
    // Yank the driver out and take the car: grand theft auto.
    car.driver = 'player';
    G.police.raiseWanted(G, 1, 'stole a car');
    G.particles.burst(car.x, car.y, '#ffd24a', 10);
    const ejected = { x: car.x + 26, y: car.y + 26, r: 12, flee: 2.5, angle: 0, speed: 0, color: '#e8e0d0' };
    G.peds.push(ejected);
  } else {
    car.driver = 'player';
  }
  p.inCar = car;
  car.speed = 0;
  G.audio.pickup();
  return true;
}

// Leave the car where it stands.
export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  p.inCar = null;
  collideBuildings(G.world, p);
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invuln > 0 || G.state !== 'playing') return;
  p.health = clamp(p.health - amount, 0, 100);
  p.invuln = 0.4;
  if (p.health <= 0) {
    G.state = 'wasted';
    G.audio.busted();
  }
}

// Busted by the police: lose a cut of the cash, lose the wanted level,
// wake up back at the safehouse.
export function bustPlayer(G) {
  const p = G.player;
  const lost = Math.floor(p.cash * 0.2);
  p.cash -= lost;
  G.police.wanted = 0;
  G.police.cops = [];
  if (p.inCar) {
    p.inCar.driver = 'parked';
    p.inCar = null;
  }
  p.x = G.world.safehouse.x + 40;
  p.y = G.world.safehouse.y + 40;
  p.health = 100;
  p.bustedTimer = 0;
  G.lastBustedLoss = lost;
  G.state = 'busted';
  G.audio.busted();
}
