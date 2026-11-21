// Driving: arcade car physics for Crest Bay Heat. Acceleration, steering
// that bites harder at low speed, handbrake slides, and collisions with
// buildings, other cars and pedestrians (which the police notice).

import { clamp, dist2 } from './config.js';
import { collideBuildings, clampToLand } from './world.js';
import { raiseWanted } from './police.js';

export function updateDriving(G, dt) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  const input = G.input;

  const forward = input.keys['w'] || input.keys['ArrowUp'];
  const reverse = input.keys['s'] || input.keys['ArrowDown'];
  const left = input.keys['a'] || input.keys['ArrowLeft'];
  const right = input.keys['d'] || input.keys['ArrowRight'];
  const handbrake = input.keys[' '];

  const accel = 420;
  const maxFwd = car.driver === 'cop' ? car.maxSpeed : 540;
  const maxRev = 180;

  if (forward) car.speed += accel * dt;
  else if (reverse) car.speed -= accel * 0.9 * dt;
  else car.speed -= Math.sign(car.speed) * 160 * dt;

  if (handbrake) car.speed -= Math.sign(car.speed) * 500 * dt;
  car.speed = clamp(car.speed, -maxRev, maxFwd);
  if (Math.abs(car.speed) < 6 && !forward && !reverse) car.speed = 0;

  // Steering: stronger when slow, reversed when reversing.
  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  const steerAuthority = clamp(Math.abs(car.speed) / 140, 0, 1) * 2.4;
  car.angle += steerInput * steerAuthority * Math.sign(car.speed) * dt;
  if (handbrake && Math.abs(car.speed) > 120) {
    car.angle += steerInput * 1.1 * dt;
    if (Math.random() < dt * 14) {
      G.particles.burst(car.x, car.y, '#cfc8b8', 2);
    }
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;

  // Buildings: stop dead with a thud and a spark.
  const body = { x: car.x, y: car.y, r: 24 };
  if (collideBuildings(G.world, body)) {
    car.x = body.x;
    car.y = body.y;
    if (Math.abs(car.speed) > 180) {
      G.audio.crash();
      G.particles.burst(car.x, car.y, '#ffd24a', 8);
    }
    car.speed *= 0.35;
    p.x = car.x;
    p.y = car.y;
  }
  clampToLand(G.world, car);
  p.x = car.x;
  p.y = car.y;

  // Bumping other cars slows both down.
  for (const other of G.cars) {
    if (other === car || other.wrecked) continue;
    const d2 = dist2(car.x, car.y, other.x, other.y);
    if (d2 < 48 * 48) {
      const push = 48 - Math.sqrt(d2);
      const a = Math.atan2(other.y - car.y, other.x - car.x);
      other.x += Math.cos(a) * push;
      other.y += Math.sin(a) * push;
      if (Math.abs(car.speed) > 200) {
        G.audio.crash();
        if (other.driver === 'traffic') {
          other.driver = 'parked';
          other.speed = 0;
          raiseWanted(G, 1, 'hit and run');
        }
      }
      car.speed *= 0.82;
    }
  }

  // Running over a pedestrian is a crime; they scatter.
  for (const ped of G.peds) {
    if (dist2(car.x, car.y, ped.x, ped.y) < 30 * 30) {
      ped.flee = 4;
      ped.x += Math.cos(car.angle) * 40;
      ped.y += Math.sin(car.angle) * 40;
      if (Math.abs(car.speed) > 120) {
        raiseWanted(G, 1, 'pedestrian hit');
        G.audio.crash();
        car.speed *= 0.7;
      }
    }
  }

  G.audio.engine(Math.abs(car.speed) / maxFwd);
}
