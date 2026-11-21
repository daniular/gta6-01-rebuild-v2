// Missions and the story of Crest Bay Heat. Rook Calloway, a getaway
// driver who swore he was out, gets pulled back in by fixer Mara Voss.
// Six missions, each with a marker, an objective, and a cash reward.
// Completing one unlocks the next; progress is saved.

import { dist2 } from './config.js';
import { spawnEnemy } from './combat.js';

export const MISSIONS = [
  {
    id: 0,
    name: 'First Pickup',
    giver: 'Mara Voss',
    brief: 'Mara left a package at the marina. Walk or drive there, grab it, and bring it back to the safehouse.',
    reward: 500,
  },
  {
    id: 1,
    name: 'Hot Wheels',
    giver: 'Mara Voss',
    brief: 'A client wants a clean ride. Steal any car off the street and deliver it to the garage on 5th Avenue.',
    reward: 800,
  },
  {
    id: 2,
    name: 'Getaway',
    giver: 'Mara Voss',
    brief: 'The pickup went loud. The cops are on you — reach the pier at the south shore and lose them.',
    reward: 1200,
  },
  {
    id: 3,
    name: 'Street Sweep',
    giver: 'Duke Halden',
    brief: 'The Halden crew is muscling into the Bay. Four of them are waiting near the park. Deal with them.',
    reward: 1500,
  },
  {
    id: 4,
    name: 'The Drop',
    giver: 'Mara Voss',
    brief: 'Three drops, one clock. Hit every checkpoint before the timer runs out — drive fast, drive clean.',
    reward: 2000,
  },
  {
    id: 5,
    name: 'King of the Bay',
    giver: 'Mara Voss',
    brief: 'The gold coupe by the marina belongs to the mayor’s nephew. Steal it, survive a five-star storm, and bring it to the pier.',
    reward: 5000,
  },
];

export function createMissions() {
  return {
    active: null, // { def, stage, timer, targets, checkpoints, ... }
    unlocked: 0, // highest mission index available
    completed: 0, // how many finished
    banner: null, // { text, sub, t } shown on start / complete
  };
}

// Where the current mission's marker should point.
export function missionTarget(G) {
  const m = G.missions.active;
  if (!m) return null;
  if (m.stage === 'go') return m.target;
  if (m.stage === 'return') return G.world.safehouse;
  if (m.stage === 'checkpoint') return m.checkpoints[m.checkpointIndex];
  if (m.stage === 'escape') return G.world.pier;
  return null;
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def || index > G.missions.unlocked) return false;
  const w = G.world;
  const m = { def, stage: 'go', timer: 0, kills: 0, checkpointIndex: 0, checkpoints: [], target: null };
  if (index === 0) {
    m.target = { x: w.marina.x, y: w.marina.y };
  } else if (index === 1) {
    m.target = { x: w.garage.x, y: w.garage.y };
    m.needCar = true;
  } else if (index === 2) {
    G.police.wanted = 3;
    G.police.heat = 20;
    m.stage = 'escape';
    m.target = { x: w.pier.x, y: w.pier.y };
  } else if (index === 3) {
    m.target = { x: w.park.x, y: w.park.y };
    for (let i = 0; i < 4; i++) {
      spawnEnemy(G, w.park.x + (i % 2) * 120 - 60, w.park.y + Math.floor(i / 2) * 120 - 60);
    }
  } else if (index === 4) {
    m.timer = 150;
    m.checkpoints = [
      { x: w.roadXs[1], y: w.roadYs[5] },
      { x: w.roadXs[6], y: w.roadYs[1] },
      { x: w.roadXs[3], y: w.roadYs[4] },
    ];
    m.stage = 'checkpoint';
  } else if (index === 5) {
    m.target = { x: w.marina.x + 60, y: w.marina.y - 40 };
    m.needGold = true;
  }
  G.missions.active = m;
  G.missions.banner = { text: def.name, sub: `${def.giver}: ${def.brief}`, t: 5 };
  G.audio.pickup();
  return true;
}

export function completeMission(G) {
  const m = G.missions.active;
  if (!m) return;
  G.player.cash += m.def.reward;
  G.missions.completed = Math.max(G.missions.completed, m.def.id + 1);
  G.missions.unlocked = Math.max(G.missions.unlocked, Math.min(5, m.def.id + 1));
  G.missions.banner = {
    text: 'MISSION COMPLETE',
    sub: `${m.def.name} — +$${m.def.reward}`,
    t: 4,
  };
  G.audio.missionDone();
  G.particles.burst(G.player.x, G.player.y, '#ffd24a', 30);
  G.missions.active = null;
  G.missions.savePending = true;
}

export function failMission(G, reason) {
  const m = G.missions.active;
  if (!m) return;
  G.missions.banner = { text: 'MISSION FAILED', sub: reason, t: 4 };
  G.missions.active = null;
  G.combat.enemies = [];
}

// Called by combat when an enemy goes down.
export function onEnemyDown(G, enemy) {
  const m = G.missions.active;
  if (!m || m.def.id !== 3) return;
  m.kills += 1;
  G.toast(`${m.kills} / 4 crew dealt with`);
  if (m.kills >= 4) completeMission(G);
}

function near(G, x, y, r) {
  return dist2(G.player.x, G.player.y, x, y) < r * r;
}

export function updateMissions(G, dt) {
  const m = G.missions.active;
  if (!m) return;
  const p = G.player;
  const w = G.world;

  if (m.def.id === 0) {
    if (m.stage === 'go' && near(G, m.target.x, m.target.y, 70)) {
      m.stage = 'return';
      G.toast('Package grabbed — get it back to the safehouse.');
      G.audio.pickup();
    } else if (m.stage === 'return' && near(G, w.safehouse.x, w.safehouse.y, 90)) {
      completeMission(G);
    }
  } else if (m.def.id === 1) {
    if (p.inCar && near(G, w.garage.x, w.garage.y, 110)) {
      completeMission(G);
    }
  } else if (m.def.id === 2) {
    if (near(G, w.pier.x, w.pier.y, 120) && G.police.wanted <= 2) {
      completeMission(G);
    } else if (near(G, w.pier.x, w.pier.y, 120) && G.police.wanted > 2) {
      G.toast('Too hot — shake the cops first, then come back.');
    }
  } else if (m.def.id === 3) {
    // Completion happens in onEnemyDown.
    if (G.combat.enemies.length === 0 && m.kills < 4 && m.stage !== 'done') {
      // Enemies all gone without enough kills (should not happen).
    }
  } else if (m.def.id === 4) {
    m.timer -= dt;
    const cp = m.checkpoints[m.checkpointIndex];
    if (cp && near(G, cp.x, cp.y, 90)) {
      m.checkpointIndex += 1;
      G.audio.pickup();
      G.toast(`Checkpoint ${m.checkpointIndex} / 3`);
      if (m.checkpointIndex >= m.checkpoints.length) completeMission(G);
    }
    if (m.timer <= 0) failMission(G, 'Out of time — the drop went cold.');
  } else if (m.def.id === 5) {
    if (m.stage === 'go') {
      if (p.inCar === G.goldCar) {
        m.stage = 'escape';
        G.police.wanted = 5;
        G.police.heat = 30;
        G.toast('Five stars! Get the gold coupe to the pier!');
      }
    } else if (m.stage === 'escape' && p.inCar === G.goldCar && near(G, w.pier.x, w.pier.y, 120)) {
      completeMission(G);
    } else if (m.stage === 'escape' && p.inCar !== G.goldCar) {
      failMission(G, 'You lost the gold coupe.');
    }
  }
}
