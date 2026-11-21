// Wanted level and the Crest Bay Police Department. Crimes raise stars;
// stars decide how many cop cars hunt the player. Cops ram the player's
// car, and on foot they get out and chase — touch the player long enough
// and he is busted. Stars decay when the player stays clean and unseen.

import { WORLD_W, WORLD_H, clamp, dist2, angleDiff } from './config.js';
import { makeCar } from './traffic.js';
import { bustPlayer, damagePlayer } from './player.js';

export function createPolice() {
  return {
    wanted: 0,
    cops: [], // cop cars
    footCops: [], // cops on foot
    heat: 0, // decays; when it hits 0 a star drops
    spawnTimer: 0,
    bustedTouch: 0,
  };
}

export function raiseWanted(G, stars, reason) {
  const pol = G.police;
  const before = pol.wanted;
  pol.wanted = clamp(pol.wanted + stars, 0, 5);
  pol.heat = 12;
  if (pol.wanted > before) {
    G.toast(`WANTED LEVEL ${pol.wanted} — ${reason}`);
    G.audio.siren(0, false);
  }
}

function wantedCopCount(wanted) {
  return [0, 1, 2, 3, 4, 6][wanted] || 0;
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;

  // Decay: stay clean and out of sight and the heat cools off.
  if (pol.wanted > 0) {
    const nearestCop = pol.cops.reduce((m, c) => Math.min(m, dist2(c.x, c.y, p.x, p.y)), Infinity);
    if (nearestCop > 700 * 700) {
      pol.heat -= dt;
      if (pol.heat <= 0) {
        pol.wanted -= 1;
        pol.heat = 12;
        if (pol.wanted === 0) G.toast('You lost the cops.');
      }
    } else {
      pol.heat = Math.max(pol.heat, 4);
    }
  }

  // Spawn cop cars up to the wanted count, off-screen near the player.
  const want = wantedCopCount(pol.wanted);
  pol.spawnTimer -= dt;
  if (pol.cops.length < want && pol.spawnTimer <= 0) {
    pol.spawnTimer = 1.2;
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(angle) * 750, 100, WORLD_W - 100);
    const y = clamp(p.y + Math.sin(angle) * 750, 100, WORLD_H - 300);
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 'cop');
    car.color = '#1d3fae';
    car.maxSpeed = 380 + pol.wanted * 22;
    car.speed = car.maxSpeed * 0.8;
    pol.cops.push(car);
    G.cars.push(car);
  }

  // Cop cars chase and ram.
  for (const cop of pol.cops) {
    const target = p.inCar ? p.inCar : p;
    const wantAngle = Math.atan2(target.y - cop.y, target.x - cop.x);
    cop.angle += clamp(angleDiff(cop.angle, wantAngle), -3.4 * dt, 3.4 * dt);
    const d = Math.sqrt(dist2(cop.x, cop.y, target.x, target.y));
    const speed = d > 90 ? cop.maxSpeed : cop.maxSpeed * 0.45;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    // Ramming the player's car damages it; ramming the player hurts.
    if (p.inCar && d < 52) {
      p.inCar.speed *= 0.94;
      cop.speed = 0;
      if (Math.random() < dt * 2) G.audio.crash();
    }
    if (!p.inCar && d < 30) {
      damagePlayer(G, 12 * dt * 4);
    }
    // A cop close to a player on foot gets out and chases on foot.
    if (!p.inCar && d < 130 && pol.footCops.length < 3 && Math.random() < dt * 0.7) {
      pol.footCops.push({ x: cop.x + 30, y: cop.y, r: 13, speed: 185, angle: 0 });
    }
  }

  // Foot cops chase; touching the player for 1.5s busts him.
  let touching = false;
  for (const fc of pol.footCops) {
    const a = Math.atan2(p.y - fc.y, p.x - fc.x);
    fc.angle = a;
    fc.x += Math.cos(a) * fc.speed * dt;
    fc.y += Math.sin(a) * fc.speed * dt;
    if (dist2(fc.x, fc.y, p.x, p.y) < 28 * 28) {
      touching = true;
      damagePlayer(G, 6 * dt);
    }
  }
  if (touching) pol.bustedTouch += dt;
  else pol.bustedTouch = 0;
  if (pol.bustedTouch > 1.5) {
    bustPlayer(G);
  }

  // Despawn far cops when the heat is gone.
  if (pol.wanted === 0) {
    pol.cops = pol.cops.filter((c) => dist2(c.x, c.y, p.x, p.y) < 1200 * 1200);
    pol.footCops = [];
  }
  G.cars = G.cars.filter((c) => c.driver !== 'cop' || pol.cops.includes(c));
}
