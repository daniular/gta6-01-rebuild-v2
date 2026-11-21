// Crest Bay Heat — bootstrap and game loop. Builds the game state, runs
// the update/render loop, handles menus, and hosts the ?shot= hooks the
// screenshot pass uses to stage each scene deterministically.

import { VIEW_W, VIEW_H } from './config.js';
import { createInput, pressed, consumeClick } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayerOnFoot, tryEnterCar, exitCar } from './player.js';
import { seedCity, maintainCrowd, updateTrafficCar, updatePed } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, playerShoot, updateCombat } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { updateDriving } from './vehicles.js';
import { createCamera, updateCamera, render } from './render.js';
import { loadSave, writeSave, clearSave } from './save.js';

function createParticles() {
  return {
    list: [],
    burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 140;
        this.list.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.4 + Math.random() * 0.5,
          maxLife: 0.9,
          size: 2 + Math.random() * 4,
          color,
        });
      }
    },
    update(dt) {
      for (const pt of this.list) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
        pt.life -= dt;
      }
      this.list = this.list.filter((pt) => pt.life > 0);
    },
  };
}

function buildGame(canvas) {
  const world = buildWorld();
  const G = {
    canvas,
    ctx: canvas.getContext('2d'),
    time: 0,
    state: 'menu', // menu | playing | paused | wasted | busted | help
    world,
    input: createInput(canvas),
    audio: createAudio(),
    player: null,
    camera: createCamera(),
    police: createPolice(),
    combat: createCombat(),
    missions: createMissions(),
    particles: createParticles(),
    cars: [],
    peds: [],
    goldCar: null,
    saveData: loadSave(),
    toastText: '',
    toastTimer: 0,
    lastBustedLoss: 0,
    shotMode: null,
  };
  G.player = createPlayer(world);
  if (G.saveData) {
    G.player.cash = G.saveData.cash;
    G.missions.unlocked = G.saveData.missionUnlocked;
    G.missions.completed = Math.min(G.saveData.missionUnlocked, 6);
  }
  seedCity(G);
  G.toast = function (text) {
    G.toastText = text;
    G.toastTimer = 4;
  };
  return G;
}

function startPlaying(G, fresh) {
  if (fresh) {
    G.player = createPlayer(G.world);
    G.player.cash = 0;
    G.missions = createMissions();
    G.police = createPolice();
    G.combat = createCombat();
    seedCity(G);
  }
  G.state = 'playing';
  G.audio.unlock();
  G.audio.engine(0);
}

function saveProgress(G) {
  if (G.missions.savePending) {
    G.missions.savePending = false;
    writeSave({
      cash: G.player.cash,
      missionUnlocked: G.missions.unlocked,
      player: G.player,
    });
  }
}

// Stage a scene for a screenshot: ?shot=start|play|chase|mission.
function applyShot(G) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;
  G.shotMode = shot;
  if (shot === 'start') {
    G.state = 'menu';
    return;
  }
  G.state = 'playing';
  G.audio.unlock();
  if (shot === 'play') {
    // Rook driving down the avenue with traffic around him.
    const car = G.cars.find((c) => c.driver === 'parked');
    if (car) {
      G.player.inCar = car;
      car.driver = 'player';
      car.x = G.world.roadXs[3];
      car.y = G.world.roadYs[2];
      car.angle = 0;
      car.speed = 260;
      G.player.x = car.x;
      G.player.y = car.y;
    }
    G.camera.x = G.player.x - VIEW_W / 2;
    G.camera.y = G.player.y - VIEW_H / 2;
  } else if (shot === 'chase') {
    const car = G.cars.find((c) => c.driver === 'parked');
    if (car) {
      G.player.inCar = car;
      car.driver = 'player';
      car.x = G.world.roadXs[4];
      car.y = G.world.roadYs[3];
      car.angle = Math.PI / 2;
      car.speed = 320;
      G.player.x = car.x;
      G.player.y = car.y;
    }
    G.police.wanted = 3;
    G.police.heat = 20;
    for (let i = 0; i < 2; i++) {
      updatePolice(G, 1.5);
    }
    G.camera.x = G.player.x - VIEW_W / 2;
    G.camera.y = G.player.y - VIEW_H / 2;
  } else if (shot === 'mission') {
    startMission(G, 2);
    G.player.x = G.world.roadXs[3];
    G.player.y = G.world.roadYs[4];
    const car = G.cars.find((c) => c.driver === 'parked');
    if (car) {
      G.player.inCar = car;
      car.driver = 'player';
      car.x = G.player.x;
      car.y = G.player.y;
      car.angle = 0;
      car.speed = 0;
    }
    G.camera.x = G.player.x - VIEW_W / 2;
    G.camera.y = G.player.y - VIEW_H / 2;
  }
  // Let the crowd settle around the staged scene for a few frames.
  for (let i = 0; i < 20; i++) {
    maintainCrowd(G, 0.05);
    for (const car of G.cars) updateTrafficCar(G, car, 0.05);
  }
}

function update(G, dt) {
  G.time += dt;
  if (G.toastTimer > 0) G.toastTimer -= dt;
  if (G.missions.banner) {
    G.missions.banner.t -= dt;
    if (G.missions.banner.t <= 0) G.missions.banner = null;
  }
  if (G.state !== 'playing') return;

  const p = G.player;
  const input = G.input;

  if (pressed(input, 'p', 'P', 'Escape')) {
    G.state = 'paused';
    G.audio.stopEngine();
    return;
  }
  if (pressed(input, 'h', 'H')) {
    G.state = 'help';
    return;
  }
  if (pressed(input, 'n', 'N')) {
    G.audio.toggleMute();
    input.keys['n'] = false;
    input.keys['N'] = false;
  }
  if (pressed(input, 'm', 'M')) {
    if (!G.missions.active && G.missions.unlocked < 6) {
      startMission(G, G.missions.unlocked);
    }
    input.keys['m'] = false;
    input.keys['M'] = false;
  }
  if (pressed(input, 'e', 'E')) {
    if (p.inCar) exitCar(G);
    else tryEnterCar(G);
    input.keys['e'] = false;
    input.keys['E'] = false;
  }

  if (p.inCar) updateDriving(G, dt);
  else updatePlayerOnFoot(G, dt);

  if (input.mouseDown) playerShoot(G);
  updateCombat(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  maintainCrowd(G, dt);
  for (const car of G.cars) updateTrafficCar(G, car, dt);
  for (const ped of G.peds) updatePed(G, ped, dt);
  G.particles.update(dt);
  updateCamera(G);
  G.audio.siren(dt, G.police.wanted > 0);
  if (!p.inCar) G.audio.engine(0);
  saveProgress(G);
  if (p.health < 100 && !p.inCar) p.health = Math.min(100, p.health + 2 * dt);
}

function handleMenuKeys(G) {
  const input = G.input;
  const enter = pressed(input, 'Enter') || consumeClick(input);
  if (!enter && !pressed(input, 'c', 'C')) return;
  G.audio.unlock();
  if (G.state === 'menu') {
    if (pressed(input, 'c', 'C') && G.saveData) {
      startPlaying(G, false);
      if (G.saveData.x !== null) {
        G.player.x = G.saveData.x;
        G.player.y = G.saveData.y;
      }
      G.toast('Welcome back to Crest Bay.');
    } else {
      startPlaying(G, true);
      clearSave();
    }
    input.keys['c'] = false;
    input.keys['C'] = false;
    input.keys['Enter'] = false;
  } else if (G.state === 'wasted' || G.state === 'busted') {
    G.state = 'menu';
    G.saveData = loadSave();
    input.keys['Enter'] = false;
  } else if (G.state === 'help') {
    G.state = 'playing';
    input.keys['Enter'] = false;
  }
}

function handlePausedKeys(G) {
  const input = G.input;
  if (pressed(input, 'p', 'P', 'Escape') || consumeClick(input)) {
    G.state = 'playing';
    input.keys['p'] = false;
    input.keys['P'] = false;
    input.keys['Escape'] = false;
  }
}

export function boot() {
  const canvas = document.getElementById('game');
  const G = buildGame(canvas);
  window.__crestBay = G; // exposed for play-testing and debugging
  applyShot(G);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.state === 'menu' || G.state === 'wasted' || G.state === 'busted' || G.state === 'help') {
      G.time += dt;
      if (G.missions.banner) {
        G.missions.banner.t -= dt;
        if (G.missions.banner.t <= 0) G.missions.banner = null;
      }
      handleMenuKeys(G);
    } else if (G.state === 'paused') {
      handlePausedKeys(G);
    } else {
      update(G, dt);
    }
    render(G);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
