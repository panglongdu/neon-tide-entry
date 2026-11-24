// Neon Tide — the HUD: wanted stars, cash and health, the objective card,
// toasts and banners, the bust meter, and the minimap that ties it together.
'use strict';
NT.hud = (function () {
  const $ = (id) => document.getElementById(id);
  let toastTimer = null, bannerTimer = null;
  let hurtFlash = 0;   // 0..1, set by flashDamage(), fades in update()

  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg; t.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = 0; }, ms || 2600);
  }
  function banner(title, sub) {
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub || '';
    $('banner').style.opacity = 1;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { $('banner').style.opacity = 0; }, 3400);
  }
  function setObjective(title, text) {
    $('obj-title').textContent = title;
    $('obj-text').textContent = text;
  }
  // Red edge-flash when Vex takes a hit; main.js calls this from damage().
  function flashDamage() { hurtFlash = 1; }

  function drawMinimap(focus) {
    const cv = $('minimap'), g = cv.getContext('2d');
    const W = cv.width, scale = W / (NT.WORLD * 2 + 40);
    const px = (x) => (x + NT.WORLD + 20) * scale;
    const pz = (z) => (z + NT.WORLD + 20) * scale;
    g.fillStyle = '#20242c'; g.fillRect(0, 0, W, W);
    g.fillStyle = '#2e7fb8'; g.fillRect(0, pz(NT.WATER_Z), W, W - pz(NT.WATER_Z));
    g.strokeStyle = '#4a5058'; g.lineWidth = Math.max(1, NT.ROAD * scale);
    for (let k = -NT.GRID; k <= NT.GRID; k++) {
      g.beginPath(); g.moveTo(px(k * NT.PITCH), 0); g.lineTo(px(k * NT.PITCH), W); g.stroke();
      g.beginPath(); g.moveTo(0, pz(k * NT.PITCH)); g.lineTo(W, pz(k * NT.PITCH)); g.stroke();
    }
    const t = NT.missions.target();
    if (t) {
      g.fillStyle = '#ffd23c';
      g.beginPath(); g.arc(px(t.x), pz(t.z), 5, 0, 7); g.fill();
    }
    for (const u of NT.police.units) {
      g.fillStyle = (Math.floor(NT.state.time * 3) % 2) ? '#ff4455' : '#4488ff';
      g.beginPath(); g.arc(px(u.x), pz(u.z), 3, 0, 7); g.fill();
    }
    for (const c of NT.vehicles.list) {
      if (c.kind !== 'traffic') continue;
      g.fillStyle = '#c8ccd4'; g.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3);
    }
    // The player: a wedge pointing the way they face.
    const heading = NT.state.inCar ? NT.state.inCar.heading : NT.player.heading;
    g.save();
    g.translate(px(focus.x), pz(focus.z));
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * -1 + 0);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
  }

  function update(focus) {
    const S = NT.state;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '<span class="off">★</span>';
    $('stars').innerHTML = stars;
    let line = `CASH <b>$${S.cash}</b> &nbsp; HEALTH <b>${Math.max(0, Math.round(S.health))}</b>`;
    if (S.missionTimer > 0) line += ` &nbsp; TIME <b>${Math.ceil(S.missionTimer)}s</b>`;
    if (S.inCar) line += ` &nbsp; SPEED <b>${Math.round(Math.abs(S.inCar.speed) * 3.6)}</b>`;
    $('stats').innerHTML = line;
    const bar = $('bustbar');
    if (S.bustMeter > 0.1 && S.mode === 'play') {
      bar.style.display = 'block';
      $('bustfill').style.width = `${Math.min(100, (S.bustMeter / 2.4) * 100)}%`;
    } else bar.style.display = 'none';
    // Speed badge: a conic arc that sweeps with speed, number in the middle.
    const speedo = $('speedo');
    if (S.inCar && S.mode === 'play') {
      const kmh = Math.round(Math.abs(S.inCar.speed) * 3.6);
      const frac = NT.clamp(Math.abs(S.inCar.speed) / 30, 0, 1);
      speedo.style.display = 'flex';
      speedo.style.background =
        `conic-gradient(from 210deg, #ffd23c ${frac * 300}deg, rgba(255,255,255,.14) ${frac * 300}deg 300deg, transparent 300deg)`;
      $('speedo-num').textContent = kmh;
    } else speedo.style.display = 'none';
    // Stamina bar: only matters on foot.
    const stam = $('stamwrap');
    if (!S.inCar && S.mode === 'play') {
      stam.style.display = 'block';
      const fill = $('stamfill');
      fill.style.width = `${S.stamina}%`;
      fill.style.background = S.stamina < 25 ? '#ff5d5d' : '#7ae0a3';
    } else stam.style.display = 'none';
    // Damage vignette: full flash on a hit, then a quick fade; a low-health
    // pulse keeps a faint edge while Vex is nearly down.
    hurtFlash = Math.max(0, hurtFlash - 0.045);
    const lowHp = (S.mode === 'play' && S.health < 30) ? 0.22 + 0.1 * Math.sin(S.time * 5) : 0;
    $('vignette').style.opacity = Math.min(0.85, hurtFlash * 0.8 + lowHp).toFixed(2);
    drawMinimap(focus);
  }

  return { toast, banner, setObjective, update, flashDamage };
})();
