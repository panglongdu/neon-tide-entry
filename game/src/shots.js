// Neon Tide — screenshot poses. With ?shot=<name> the game sets up one
// composed, deterministic scene (the same scene the screenshots in
// screenshots/ were taken from) and flags window.__shotReady when it is
// on screen. Normal play never passes ?shot and never sees this.
'use strict';
(function () {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  const S = NT.state;
  S.stamina = NT.STAMINA_MAX;
  // Flag ready only after two rendered frames, so one-frame systems (the
  // HUD speed badge, the search helicopter) are visibly settled in frame.
  function ready() {
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = shot; }));
  }
  function hideMenu() { document.getElementById('menu').style.display = 'none'; S.mode = 'play'; }

  setTimeout(() => {
    if (shot === 'start') {
      // The menu over the bay at golden hour: camera low across the avenue.
      ready();
      return;
    }
    hideMenu();
    if (shot === 'drive') {
      // Vex at the wheel of the turquoise job coupe, mid-avenue downtown.
      NT.missions.startMission(0);
      const car = NT.missions.jobCar;
      car.x = 20; car.z = 84; car.heading = Math.PI / 2; car.speed = 13;
      car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.heading;
      S.inCar = car; car.kind = 'player';
      NT.player._p.mesh.visible = false;
      NT.state.missionStage = 1;
      NT.hud.setObjective('JOB 1 · FIRST WHEELS', 'Drive the coupe to the end of the pier');
    } else if (shot === 'chase') {
      // Four stars: patrol cars on the tail, mid-intersection downtown —
      // and the search helicopter (wanted >= 4) circling into frame with
      // its spotlight, which police.update raises on the next frames.
      const car = NT.vehicles.spawn(84, 84, Math.PI / 2, { kind: 'parked', color: 0x30343e });
      S.inCar = car; car.kind = 'player'; car.speed = 21; car.heading = Math.PI / 2;
      NT.player._p.mesh.visible = false;
      S.heat = 5.6; S.wanted = 4;
      NT.hud.flashDamage();
      const cop1 = NT.vehicles.spawn(74, 76, Math.PI / 2, { kind: 'police', police: true });
      const cop2 = NT.vehicles.spawn(70, 92, Math.PI / 2, { kind: 'police', police: true });
      cop1.speed = 19; cop2.speed = 18;
      NT.police.units.push(cop1, cop2);
      NT.hud.setObjective('JOB 3 · CLEAN GETAWAY', 'Lose the police completely');
    } else if (shot === 'foot') {
      // On foot at the marina, the job car waiting, the beacon on the pier.
      NT.player._p.x = -6; NT.player._p.z = 74; NT.player._p.heading = Math.PI * 0.9;
      NT.player._p.camYaw = Math.PI * 0.9;
      NT.missions.startMission(0);
    }
    ready();
  }, 450);
})();
