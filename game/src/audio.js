// Neon Tide — tiny synthesized sound: no audio assets, everything is made
// with WebAudio oscillators and noise at the moment it is needed.
'use strict';
NT.audio = (function () {
  let ctx = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  // Music: a slow synthwave bassline sequenced note by note. A-minor pulse,
  // one bar of eighth notes every 3.2 s, kept well under the effects.
  let musicTimer = null, musicStep = 0, musicGain = null;
  const BASSLINE = [55, 0, 55, 55, 0, 65.41, 0, 55, 49, 0, 49, 49, 0, 73.42, 82.41, 0];
  function bassNote(freq) {
    const c = ac(); if (!c || !freq) return;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 4;
    g.gain.setValueAtTime(0.16, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.34);
    o.connect(f); f.connect(g); g.connect(musicGain); o.start(); o.stop(c.currentTime + 0.36);
  }
  function startMusic() {
    const c = ac(); if (!c || musicTimer) return;
    if (!musicGain) { musicGain = c.createGain(); musicGain.gain.value = 0.5; musicGain.connect(c.destination); }
    NT.state.musicOn = true;
    musicTimer = setInterval(() => { bassNote(BASSLINE[musicStep % BASSLINE.length]); musicStep++; }, 200);
  }
  function stopMusic() {
    NT.state.musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    return ctx;
  }
  function blip(freq, dur, type, vol, slide) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol) {
    const c = ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol || 0.15;
    src.connect(g); g.connect(c.destination); src.start();
  }
  return {
    unlock() { ac(); },
    // Started by main.js on the first user gesture; N toggles it after that.
    musicStart() { startMusic(); },
    musicToggle() {
      if (musicTimer) { stopMusic(); return false; }
      startMusic(); return true;
    },
    hurt() { noise(0.16, 0.2); blip(70, 0.22, 'sine', 0.2, -30); },
    pickup() { blip(880, 0.12, 'sine', 0.1); setTimeout(() => blip(1320, 0.16, 'sine', 0.1), 70); },
    cash() { blip(1560, 0.09, 'triangle', 0.1); setTimeout(() => blip(2090, 0.14, 'triangle', 0.09), 60); },
    shot() { noise(0.12, 0.22); blip(160, 0.1, 'sawtooth', 0.1, -100); },
    crash() { noise(0.25, 0.25); blip(90, 0.2, 'sine', 0.16, -40); },
    door() { blip(240, 0.07, 'square', 0.06); },
    siren(on) {
      const c = ac(); if (!c) return;
      if (on && !sirenOsc) {
        sirenOsc = c.createOscillator(); sirenGain = c.createGain();
        sirenOsc.type = 'triangle'; sirenGain.gain.value = 0.0;
        sirenOsc.connect(sirenGain); sirenGain.connect(c.destination); sirenOsc.start();
        sirenGain.gain.linearRampToValueAtTime(0.035, c.currentTime + 0.4);
        const wail = () => { if (sirenOsc) { sirenOsc.frequency.setValueAtTime(660, c.currentTime); sirenOsc.frequency.linearRampToValueAtTime(990, c.currentTime + 0.45); } };
        wail(); sirenOsc._iv = setInterval(wail, 900);
      } else if (!on && sirenOsc) {
        clearInterval(sirenOsc._iv);
        try { sirenOsc.stop(); } catch (e) {}
        sirenOsc = null; sirenGain = null;
      }
    },
    engine(on, speedRatio) {
      const c = ac(); if (!c) return;
      if (on && !engineOsc) {
        engineOsc = c.createOscillator(); engineGain = c.createGain();
        engineOsc.type = 'sawtooth'; engineGain.gain.value = 0.018;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(c.destination); engineOsc.start();
      }
      if (engineOsc) engineOsc.frequency.value = 55 + Math.abs(speedRatio || 0) * 130;
      if (!on && engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; engineGain = null; }
    },
  };
})();
