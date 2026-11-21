// Everything Crest Bay Heat shows: the camera, the city, the cars and
// people, the HUD with its minimap, and the menus. All drawing is plain
// canvas 2D — no images, no fonts from the network.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_W, PALETTE, clamp } from './config.js';
import { MISSIONS, missionTarget } from './missions.js';

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(G) {
  const cam = G.camera;
  const tx = clamp(G.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  const ty = clamp(G.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-24, -11, 48, 24);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.fillRect(-23, -11, 46, 22);
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(-8, -9, 14, 18);
  ctx.fillStyle = '#dfe9f2';
  ctx.fillRect(14, -8, 6, 16);
  if (car.driver === 'cop') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-23, -11, 10, 22);
    ctx.fillStyle = '#ff3d3d';
    ctx.fillRect(-4, -12, 5, 4);
    ctx.fillStyle = '#3d7fff';
    ctx.fillRect(2, -12, 5, 4);
  }
  if (car.gold) {
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(-23, -11, 46, 22);
  }
  ctx.restore();
}

function drawPed(ctx, ped, t) {
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, ped.r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, G, t) {
  const p = G.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rook: teal jacket, dark jeans.
  ctx.fillStyle = '#1f8a7a';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e0d0';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when aiming.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();
  if (G.combat.muzzle > 0) {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(24, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, G, t) {
  const world = G.world;
  const cam = G.camera;
  const x0 = Math.max(0, cam.x - 60);
  const y0 = Math.max(0, cam.y - 60);
  const x1 = Math.min(WORLD_W, cam.x + VIEW_W + 60);
  const y1 = Math.min(WORLD_H, cam.y + VIEW_H + 60);

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Park block.
  ctx.fillStyle = PALETTE.parkGrass;
  ctx.fillRect(world.roadXs[2] + ROAD_W / 2, world.roadYs[3] + ROAD_W / 2, 300, 300);
  ctx.fillStyle = '#5a8a42';
  ctx.beginPath();
  ctx.arc(world.park.x, world.park.y, 46, 0, Math.PI * 2);
  ctx.fill();

  // Beach and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, Math.max(y0, world.beachY), x1 - x0, Math.min(y1, WORLD_H) - Math.max(y0, world.beachY));
  ctx.fillStyle = PALETTE.water;
  const wave = Math.sin(t * 0.8) * 6;
  ctx.fillRect(x0, Math.max(y0, world.beachY + 90 + wave), x1 - x0, Math.min(y1, WORLD_H) - Math.max(y0, world.beachY + 90 + wave));
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, world.beachY + 90 + wave);
  ctx.lineTo(x1, world.beachY + 90 + wave);
  ctx.stroke();

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of world.roadXs) {
    if (rx < x0 - ROAD_W || rx > x1 + ROAD_W) continue;
    ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  }
  for (const ry of world.roadYs) {
    if (ry < y0 - ROAD_W || ry > y1 + ROAD_W) continue;
    ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
  }
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  ctx.beginPath();
  for (const rx of world.roadXs) {
    if (rx < x0 - ROAD_W || rx > x1 + ROAD_W) continue;
    ctx.moveTo(rx, y0);
    ctx.lineTo(rx, y1);
  }
  for (const ry of world.roadYs) {
    if (ry < y0 - ROAD_W || ry > y1 + ROAD_W) continue;
    ctx.moveTo(x0, ry);
    ctx.lineTo(x1, ry);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Sidewalks around each block.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 10;
  for (const b of world.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.strokeRect(b.x - 12, b.y - 12, b.w + 24, b.h + 24);
  }

  // Buildings with a sun-baked roof and a long shadow.
  for (const b of world.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, 8);
  }

  // Palm trees.
  for (const palm of world.palms) {
    if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 4, palm.y - 14);
    ctx.stroke();
    ctx.fillStyle = '#3f8f4f';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 4 + Math.cos(a) * 10, palm.y - 14 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Landmarks.
  drawLandmark(ctx, world.safehouse.x, world.safehouse.y, 'SAFEHOUSE', '#1f8a7a');
  drawLandmark(ctx, world.garage.x, world.garage.y, 'GARAGE', '#c97f2f');
  drawLandmark(ctx, world.pier.x, world.pier.y, 'PIER', '#3d7fd9');
  drawLandmark(ctx, world.marina.x, world.marina.y, 'MARINA', '#8f7fb8');
}

function drawLandmark(ctx, x, y, label, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 24);
  ctx.restore();
}

function drawMissionMarker(ctx, G, t) {
  const target = missionTarget(G);
  if (!target) return;
  const pulse = 1 + Math.sin(t * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(target.x, target.y - 34 * pulse);
  ctx.lineTo(target.x - 9, target.y - 16);
  ctx.lineTo(target.x + 9, target.y - 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMinimap(ctx, G) {
  const mw = 220;
  const mh = 172;
  const mx = VIEW_W - mw - 16;
  const my = VIEW_H - mh - 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
  // Water + sand.
  ctx.fillStyle = '#2f6f8f';
  ctx.fillRect(mx, my + (G.world.beachY + 90) * sy, mw, mh - (G.world.beachY + 90) * sy);
  ctx.fillStyle = '#7a6f4f';
  ctx.fillRect(mx, my + G.world.beachY * sy, mw, 90 * sy);
  // Roads.
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const rx of G.world.roadXs) {
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
  }
  for (const ry of G.world.roadYs) {
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
  }
  ctx.stroke();
  // Mission target.
  const target = missionTarget(G);
  if (target) {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#5a8aff';
  for (const cop of G.police.cops) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const p = G.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f8a7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Cash + health, top left.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(12, 12, 250, 64);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 22, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Mission ${G.missions.completed} / 6 complete`, 22, 48);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(22, 66, 0, 0);
  ctx.fillStyle = p.health > 30 ? '#7ee787' : '#ff5a4a';
  ctx.fillRect(150, 24, 100 * (p.health / 100), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(150, 24, 100, 12);

  // Wanted stars, top right.
  const stars = G.police.wanted;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(VIEW_W - 190, 12, 178, 40);
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd24a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 168 + i * 34, 18);
  }
  ctx.textAlign = 'left';

  // Objective, bottom left.
  const m = G.missions.active;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const objText = m
    ? `${m.def.name} — ${objectiveLine(G, m)}`
    : G.missions.unlocked < 6
      ? `Press M for the next mission: ${MISSIONS[G.missions.unlocked].name}`
      : 'All missions complete — free roam, Rook.';
  ctx.font = '15px sans-serif';
  const ow = Math.min(560, 24 + ctx.measureText(objText).width);
  ctx.fillRect(12, VIEW_H - 64, ow, 52);
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(objText, 22, VIEW_H - 54);
  ctx.fillStyle = '#cfc8b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · Click shoot · M mission · P pause · H help', 22, VIEW_H - 32);

  // Speed when driving.
  if (p.inCar) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.fillRect(VIEW_W - 190, VIEW_H - 64, 178, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.18)} mph`, VIEW_W - 101, VIEW_H - 54);
    ctx.textAlign = 'left';
  }

  // Toast line.
  if (G.toastText && G.toastTimer > 0) {
    ctx.font = 'bold 17px sans-serif';
    const tw = ctx.measureText(G.toastText).width;
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(VIEW_W / 2 - tw / 2 - 14, 64, tw + 28, 34);
    ctx.fillStyle = '#ffd24a';
    ctx.textAlign = 'center';
    ctx.fillText(G.toastText, VIEW_W / 2, 72);
    ctx.textAlign = 'left';
  }

  // Mission banner (start / complete / fail).
  if (G.missions.banner && G.missions.banner.t > 0) {
    const b = G.missions.banner;
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(0, VIEW_H / 2 - 90, VIEW_W, 110);
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, VIEW_W / 2, VIEW_H / 2 - 78);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    wrapText(ctx, b.sub, VIEW_W / 2, VIEW_H / 2 - 30, 900, 22);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, G);
  ctx.restore();
}

function objectiveLine(G, m) {
  if (m.def.id === 0) return m.stage === 'go' ? 'Pick up the package at the marina' : 'Bring it back to the safehouse';
  if (m.def.id === 1) return 'Steal a car and deliver it to the garage';
  if (m.def.id === 2) return 'Reach the pier with 2 stars or fewer';
  if (m.def.id === 3) return `Deal with the Halden crew — ${m.kills} / 4 down`;
  if (m.def.id === 4) return `Hit the checkpoints — ${m.checkpointIndex} / 3 · ${Math.ceil(m.timer)}s left`;
  if (m.def.id === 5) return m.stage === 'go' ? 'Steal the gold coupe by the marina' : 'Escape to the pier in the gold coupe';
  return '';
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}

function drawMenu(ctx, G) {
  const t = G.time;
  // Sunset gradient sky over the city silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9a5a');
  grad.addColorStop(0.5, '#ff6b6b');
  grad.addColorStop(1, '#3d2b5a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.arc(VIEW_W - 240, 150, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(61,43,90,0.85)';
  for (let i = 0; i < 12; i++) {
    const bx = 40 + i * 105;
    const bh = 120 + ((i * 67) % 160);
    ctx.fillRect(bx, VIEW_H - bh - 90, 80, bh + 90);
  }
  ctx.fillStyle = '#2b1d42';
  ctx.fillRect(0, VIEW_H - 90, VIEW_W, 90);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText('CREST BAY', VIEW_W / 2, 190);
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('HEAT', VIEW_W / 2, 265);
  ctx.shadowBlur = 0;
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('An open-world crime game — steal cars, outrun the cops, run the Bay.', VIEW_W / 2, 310);

  const save = G.saveData;
  const y0 = 380;
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.sin(t * 4) > -0.2;
  if (blink) {
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('CLICK OR PRESS ENTER TO START', VIEW_W / 2, y0);
  }
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('WASD move & drive · E enter / steal a car · Mouse aim, Click to shoot', VIEW_W / 2, y0 + 44);
  ctx.fillText('M start mission · P pause · Space handbrake · Mute with N', VIEW_W / 2, y0 + 70);
  if (save) {
    ctx.fillStyle = '#7ee787';
    ctx.fillText(`Save found: $${save.cash} · mission ${save.missionUnlocked + 1} of 6 unlocked — press C to continue`, VIEW_W / 2, y0 + 104);
  }
  ctx.fillStyle = '#cfc8b8';
  ctx.font = '13px sans-serif';
  ctx.fillText('A fully original game. No Rockstar names, art, music or maps. All sounds are synthesised live.', VIEW_W / 2, VIEW_H - 30);
  ctx.textAlign = 'left';
}

function drawEndScreen(ctx, G, title, color, lines) {
  ctx.fillStyle = 'rgba(10,10,16,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 360 + i * 32));
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO CONTINUE', VIEW_W / 2, 520);
  ctx.textAlign = 'left';
}

export function render(G) {
  const ctx = G.ctx;
  const t = G.time;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (G.state === 'menu') {
    drawMenu(ctx, G);
    return;
  }

  ctx.save();
  ctx.translate(-Math.round(G.camera.x), -Math.round(G.camera.y));
  drawWorld(ctx, G, t);
  drawMissionMarker(ctx, G, t);
  for (const car of G.cars) {
    if (car.x < G.camera.x - 80 || car.x > G.camera.x + VIEW_W + 80) continue;
    if (car.y < G.camera.y - 80 || car.y > G.camera.y + VIEW_H + 80) continue;
    drawCar(ctx, car);
  }
  for (const e of G.combat.enemies) {
    ctx.fillStyle = '#8a2f2f';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * (e.hp / 100), 4);
  }
  for (const ped of G.peds) {
    if (ped.x < G.camera.x - 40 || ped.x > G.camera.x + VIEW_W + 40) continue;
    if (ped.y < G.camera.y - 40 || ped.y > G.camera.y + VIEW_H + 40) continue;
    drawPed(ctx, ped, t);
  }
  for (const fc of G.police.footCops) {
    ctx.fillStyle = '#1d3fae';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', fc.x, fc.y - 18);
    ctx.textAlign = 'left';
  }
  drawPlayer(ctx, G, t);
  // Bullets.
  ctx.fillStyle = '#ffd24a';
  for (const b of G.combat.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const pt of G.particles.list) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHud(ctx, G);

  if (G.state === 'paused') {
    ctx.fillStyle = 'rgba(10,10,16,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillText('P to resume · Missions: press M to start the next one', VIEW_W / 2, VIEW_H / 2 + 24);
    ctx.textAlign = 'left';
  }
  if (G.state === 'wasted') {
    drawEndScreen(ctx, G, 'WASTED', '#ff5a4a', [
      'Rook went down in the streets of Crest Bay.',
      `Cash kept: $${G.player.cash} · Missions complete: ${G.missions.completed} / 6`,
    ]);
  }
  if (G.state === 'busted') {
    drawEndScreen(ctx, G, 'BUSTED', '#5a8aff', [
      `The Crest Bay PD took you in — and $${G.lastBustedLoss || 0} of your cash.`,
      `Missions complete: ${G.missions.completed} / 6`,
    ]);
  }
  if (G.state === 'help') {
    drawEndScreen(ctx, G, 'HOW TO PLAY', '#ffd24a', [
      'WASD — walk / drive · E — enter or steal a car · Mouse + Click — aim & shoot',
      'Space — handbrake · M — start next mission · P — pause · N — mute',
      'Steal cars, finish missions, and keep the wanted stars down.',
      'Your progress saves automatically when a mission ends.',
    ]);
  }
}
