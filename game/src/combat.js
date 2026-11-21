// Combat: the player's pistol, bullets, and the rival crew members who
// shoot back. Shooting is mouse-aimed; bullets fly straight, hit cars,
// pedestrians and enemies, and make a mess the police notice.

import { dist2, clamp } from './config.js';
import { raiseWanted } from './police.js';
import { onEnemyDown } from './missions.js';

export function createCombat() {
  return {
    bullets: [],
    enemies: [], // rival crew members, spawned by missions
    shootCooldown: 0,
    muzzle: 0,
  };
}

export function playerShoot(G) {
  const c = G.combat;
  const p = G.player;
  if (c.shootCooldown > 0 || p.inCar || G.state !== 'playing') return;
  c.shootCooldown = 0.28;
  c.muzzle = 0.08;
  // Aim from the player on screen towards the mouse.
  const screenX = p.x - G.camera.x;
  const screenY = p.y - G.camera.y;
  const angle = Math.atan2(G.input.mouseY - screenY, G.input.mouseX - screenX);
  c.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    life: 0.7,
    from: 'player',
  });
  G.audio.shoot();
  G.particles.burst(p.x + Math.cos(angle) * 26, p.y + Math.sin(angle) * 26, '#ffd24a', 4);
  // Gunfire draws attention.
  if (G.police.wanted < 2) raiseWanted(G, 1, 'shots fired');
  for (const ped of G.peds) {
    if (dist2(ped.x, ped.y, p.x, p.y) < 320 * 320) ped.flee = 3;
  }
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.shootCooldown > 0) c.shootCooldown -= dt;
  if (c.muzzle > 0) c.muzzle -= dt;

  for (const b of c.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }

  // Bullet hits.
  for (const b of c.bullets) {
    if (b.life <= 0) continue;
    if (b.from === 'player') {
      // Enemies first.
      for (const e of c.enemies) {
        if (e.hp > 0 && dist2(b.x, b.y, e.x, e.y) < 18 * 18) {
          e.hp -= 34;
          b.life = 0;
          G.particles.burst(e.x, e.y, '#ff5a4a', 8);
          if (e.hp <= 0) {
            G.particles.burst(e.x, e.y, '#ff5a4a', 22);
            G.audio.explosion();
            onEnemyDown(G, e);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Pedestrians: a hit is a crime and they flee.
      for (const ped of G.peds) {
        if (dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
          ped.flee = 4;
          b.life = 0;
          raiseWanted(G, 1, 'civilian hit');
          break;
        }
      }
      if (b.life <= 0) continue;
      // Cars: sparks, and a wrecked car stops.
      for (const car of G.cars) {
        if (car.wrecked) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along < 26 && side < 14) {
          b.life = 0;
          car.hp = (car.hp || 3) - 1;
          G.particles.burst(b.x, b.y, '#ffd24a', 5);
          if (car.hp <= 0) {
            car.wrecked = true;
            car.speed = 0;
            G.particles.burst(car.x, car.y, '#ff8a3d', 26);
            G.audio.explosion();
            if (car.driver === 'player') G.player.inCar = null;
          }
          break;
        }
      }
    } else {
      // Enemy bullets hurt the player.
      const p = G.player;
      if (!p.inCar && dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
        b.life = 0;
        G.player.health = clamp(G.player.health - 9, 0, 100);
        if (G.player.health <= 0) G.state = 'wasted';
      }
    }
  }
  c.bullets = c.bullets.filter((b) => b.life > 0);

  // Enemies chase the player and shoot when in range.
  for (const e of c.enemies) {
    if (e.hp <= 0) continue;
    e.cooldown -= dt;
    const p = G.player;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = a;
    if (d > 260) {
      e.x += Math.cos(a) * 130 * dt;
      e.y += Math.sin(a) * 130 * dt;
    } else if (e.cooldown <= 0) {
      e.cooldown = 1.1 + Math.random() * 0.5;
      c.bullets.push({
        x: e.x + Math.cos(a) * 20,
        y: e.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 520,
        vy: Math.sin(a) * 520,
        life: 1.1,
        from: 'enemy',
      });
      G.audio.shoot();
    }
  }
  c.enemies = c.enemies.filter((e) => e.hp > 0);
}

export function spawnEnemy(G, x, y) {
  G.combat.enemies.push({
    x,
    y,
    r: 13,
    hp: 100,
    angle: 0,
    cooldown: 0.8,
    color: '#8a2f2f',
  });
}
