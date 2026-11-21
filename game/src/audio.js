// All sound in Crest Bay Heat is synthesised with WebAudio — no audio
// files, no network. Every effect is a few oscillators / filtered noise
// bursts built on demand. Safe to call before any user gesture: the
// context is created lazily and every call no-ops until it exists.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
  };

  audio.unlock = function () {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.35;
      audio.master.connect(audio.ctx.destination);
    } catch {
      audio.ctx = null;
    }
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    try {
      const t0 = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* audio is decoration; never break the game for it */
    }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    try {
      const t0 = audio.ctx.currentTime;
      const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filt = audio.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = filterFreq || 1200;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(audio.master);
      src.start(t0);
    } catch {
      /* ignore */
    }
  }

  audio.shoot = function () {
    noiseBurst(0.12, 0.5, 2600);
    tone(180, 0.08, 'square', 0.25, 60);
  };

  audio.pickup = function () {
    tone(660, 0.09, 'sine', 0.3);
    setTimeout(() => tone(990, 0.12, 'sine', 0.3), 70);
  };

  audio.crash = function () {
    noiseBurst(0.25, 0.6, 500);
    tone(90, 0.2, 'sawtooth', 0.3, 40);
  };

  audio.explosion = function () {
    noiseBurst(0.7, 0.8, 300);
    tone(60, 0.6, 'sawtooth', 0.4, 28);
  };

  audio.missionDone = function () {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.3), i * 110));
  };

  audio.busted = function () {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 160));
  };

  // Continuous engine hum: call every frame with speed 0..1 (0 = off).
  audio.engine = function (speed) {
    if (!audio.ctx || audio.muted) {
      audio.stopEngine();
      return;
    }
    try {
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        const filt = audio.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 500;
        audio.engineOsc.connect(filt);
        filt.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      audio.engineOsc.frequency.value = 55 + speed * 130;
      audio.engineGain.gain.value = speed > 0.02 ? 0.05 + speed * 0.05 : 0;
    } catch {
      /* ignore */
    }
  };

  audio.stopEngine = function () {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
  };

  // Two-tone police siren while wanted > 0; call every frame with dt.
  audio.siren = function (dt, active) {
    if (!audio.ctx || audio.muted || !active) {
      if (audio.sirenGain) audio.sirenGain.gain.value = 0;
      return;
    }
    try {
      if (!audio.sirenOsc) {
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'triangle';
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
      }
      audio.sirenTimer += dt;
      const hi = Math.floor(audio.sirenTimer * 1.6) % 2 === 0;
      audio.sirenOsc.frequency.value = hi ? 880 : 660;
      audio.sirenGain.gain.value = 0.045;
    } catch {
      /* ignore */
    }
  };

  audio.toggleMute = function () {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.35;
    return audio.muted;
  };

  return audio;
}
