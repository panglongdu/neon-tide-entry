// Neon Tide — the law: crimes witnessed by citizens or officers build heat;
// heat becomes stars; stars bring patrol cars that hunt, ram and bust.
// Lose every tail long enough and the stars fade.
'use strict';
NT.police = (function () {
  const units = [];       // police vehicles currently hunting
  let scene = null;
  let spawnClock = 0, unseenClock = 0;
  // The search helicopter: appears at four stars and up. Purely a visual
  // threat plus one pressure — while its spotlight is on you, you are never
  // "unseen", so the wanted cool-down cannot bleed away.
  let heli = null, heliAngle = 0;

  function buildHeli() {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c2f57 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 4.6), dark);
    g.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 8, 7),
      new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
    nose.position.set(0, 0.1, 2.2); nose.scale.set(0.95, 0.8, 1); g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), dark);
    tail.position.set(0, 0.3, -4.2); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.7), dark);
    fin.position.set(0, 0.7, -6.3); g.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x22262e }));
    rotor.position.y = 1.25; g.add(rotor);
    g.userData.rotor = rotor;
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x11141a });
    for (const s of [-0.9, 0.9]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.6), skidMat);
      skid.position.set(s, -1.15, 0.2); g.add(skid);
    }
    // Spotlight: a translucent cone from the belly to the street.
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 8.5, 36, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -18.5; g.add(cone);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    lamp.position.y = -0.95; g.add(lamp);
    g.visible = false;
    scene.add(g);
    return g;
  }

  function updateHeli(dt, focus) {
    const active = NT.state.wanted >= 4 && NT.state.mode === 'play';
    if (!heli) { if (active) heli = buildHeli(); else return false; }
    heli.visible = active;
    if (!active) return false;
    heliAngle += dt * 0.45;
    const R = 27, H = 35;
    const hx = focus.x + Math.cos(heliAngle) * R;
    const hz = focus.z + Math.sin(heliAngle) * R;
    heli.position.set(hx, H + Math.sin(NT.state.time * 1.3) * 1.2, hz);
    // Face along the orbit tangent (heading -angle), banked slightly inward.
    heli.rotation.set(0, -heliAngle, 0.16);
    heli.userData.rotor.rotation.y += dt * 28;
    return true;   // the spotlight counts as being seen
  }

  NT.crime = function (kind, x, z, severity) {
    if (NT.state.mode !== 'play') return;
    // A crime counts double when an officer is close enough to see it.
    let seen = false;
    for (const u of units) if (NT.dist2(x, z, u.x, u.z) < 70 * 70) seen = true;
    for (const p of NT.peds.list) if (!p.dead && NT.dist2(x, z, p.x, p.z) < 26 * 26) seen = true;
    const gain = severity * (seen ? 1 : 0.35);
    NT.state.heat += gain;
    const stars = NT.clamp(Math.floor(NT.state.heat / 1.4), 0, 5);
    if (stars > NT.state.wanted) {
      NT.state.wanted = stars;
      NT.hud.toast(stars >= 3 ? 'The whole bay is looking for you now' : 'Wanted level rising');
    }
    if (kind === 'shot' || kind === 'ped') NT.peds.scare(x, z, 30);
  };

  function wantedUnits() { return [0, 0, 1, 2, 3, 4][NT.state.wanted] || 0; }

  function spawnUnit(focus) {
    const a = Math.random() * Math.PI * 2;
    const x = NT.clamp(focus.x + Math.cos(a) * 85, -NT.WORLD, NT.WORLD);
    const z = NT.clamp(focus.z + Math.sin(a) * 85, -NT.WORLD, NT.WATER_Z);
    const car = NT.vehicles.spawn(x, z, 0, { kind: 'police', police: true });
    units.push(car);
    return car;
  }

  function update(dt, focus) {
    const S = NT.state;
    spawnClock -= dt;
    const want = wantedUnits();
    if (S.wanted > 0 && units.length < want && spawnClock <= 0) { spawnUnit(focus); spawnClock = 4; }
    if (S.wanted === 0 && units.length) {
      for (const u of [...units]) { NT.vehicles.removeCar(u); }
      units.length = 0;
    }
    let anySee = false;
    for (const u of [...units]) {
      const d2 = NT.dist2(u.x, u.z, focus.x, focus.z);
      if (d2 < 95 * 95) anySee = true;
      if (d2 > 420 * 420) { NT.vehicles.removeCar(u); units.splice(units.indexOf(u), 1); continue; }
      // Hunt: steer at the target, faster with more stars; ram on contact.
      const targetSpeed = 17 + S.wanted * 2.6;
      const dx = focus.x - u.x, dz = focus.z - u.z;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += NT.clamp(dh, -dt * 1.7, dt * 1.7);
      const slow = d2 < 30 ? 0.45 : 1;
      u.speed = NT.lerp(u.speed, targetSpeed * slow, Math.min(1, dt * 1.5));
      const nx = u.x + Math.sin(u.heading) * u.speed * dt;
      const nz = u.z + Math.cos(u.heading) * u.speed * dt;
      const [cx, cz] = NT.city.collide(nx, nz, 2.1);
      if (cx !== nx || cz !== nz) u.speed *= 0.4;
      u.x = cx; u.z = cz;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      if (u.mesh.userData.lightbar) {
        u.sirenPhase += dt * 9;
        u.mesh.userData.lightbar.material.color.setHex(Math.sin(u.sirenPhase) > 0 ? 0xff3344 : 0x3366ff);
      }
      // Ram: contact with the player's car knocks speed off both.
      const car = S.inCar;
      if (car && NT.dist2(u.x, u.z, car.x, car.z) < 13) {
        car.speed *= 0.82; u.speed *= 0.6; NT.audio.crash();
      }
    }
    if (updateHeli(dt, focus)) anySee = true;
    NT.audio.siren(S.wanted > 0 && units.length > 0 && NT.state.mode === 'play');
    // Cool-down: stay unseen and the heat bleeds away.
    if (S.wanted > 0) {
      if (!anySee) {
        unseenClock += dt;
        if (unseenClock > 7) {
          S.heat = Math.max(0, S.heat - dt * 0.55);
          S.wanted = NT.clamp(Math.floor(S.heat / 1.4), 0, 5);
          if (S.wanted === 0) { S.heat = 0; NT.hud.toast('You lost them. Lay low.'); }
        }
      } else unseenClock = 0;
    }
    // Bust pressure: an officer on top of a slow or on-foot player fills the meter.
    S.bust = 0;
    if (S.wanted > 0) {
      const speed = S.inCar ? Math.abs(S.inCar.speed) : 0;
      for (const u of units) {
        if (NT.dist2(u.x, u.z, focus.x, focus.z) < 8.5 * 8.5 && speed < 3.2) S.bust = 1;
      }
      if (S.bust) {
        S.bustMeter = (S.bustMeter || 0) + dt;
        if (S.bustMeter > 2.4) NT.game.busted();
      } else S.bustMeter = Math.max(0, (S.bustMeter || 0) - dt * 2);
    }
  }

  function init(sc) { scene = sc; }
  return { init, update, units, get heli() { return heli; } };
})();
