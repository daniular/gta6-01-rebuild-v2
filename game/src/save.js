// Save / load for Crest Bay Heat. Progress lives in localStorage under
// one key: cash, the highest mission unlocked, and the player's last
// position. Nothing else is persisted; the city is deterministic.

const SAVE_KEY = 'crest-bay-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? Math.max(0, Math.floor(data.cash)) : 0,
      missionUnlocked: Number.isFinite(data.missionUnlocked)
        ? Math.max(0, Math.min(6, Math.floor(data.missionUnlocked)))
        : 0,
      x: Number.isFinite(data.x) ? data.x : null,
      y: Number.isFinite(data.y) ? data.y : null,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: state.cash,
        missionUnlocked: state.missionUnlocked,
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage may be unavailable; the game still plays */
  }
}
