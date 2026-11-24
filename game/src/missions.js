// Neon Tide — the story: four jobs for the Solace family that teach the
// city, the car, the law and the clock, in that order. Each job is a chain
// of stages; a stage is an objective line, a glowing beacon in the world
// and a test. A stage may carry a `pickup` colour: a glowing crate waits
// at its target and is collected by reaching it.
'use strict';
NT.missions = (function () {
  let beacon = null, scene = null, packageMesh = null;

  const MISSIONS = [
    {
      title: 'JOB 1 · FIRST WHEELS',
      intro: 'Marisol Solace left a turquoise coupe by the marina garage. Take it — gently — and bring it to the pier.',
      stages: [
        { text: 'Get into the turquoise coupe by the marina garage', kind: 'enterCar' },
        { text: 'Drive the coupe to the end of the pier', kind: 'reach', at: () => NT.city.pier, r: 9 },
      ],
      reward: 250,
    },
    {
      title: 'JOB 2 · HOT DELIVERY',
      intro: 'A package is waiting in the alley behind the Palms Hotel. Pick it up and drop it at the docks — the family is watching the clock.',
      stages: [
        { text: 'Pick up the package behind the Palms Hotel', kind: 'reach', at: () => ({ x: -126, z: -84 }), r: 5, onfoot: true, pickup: 0xffd23c },
        { text: 'Deliver it to the docks, south-east gate — 150 seconds', kind: 'reach', at: () => ({ x: 252, z: 336 }), r: 9, timer: 150, heat: 2.9 },
      ],
      reward: 600,
    },
    {
      title: 'JOB 3 · CLEAN GETAWAY',
      intro: 'The Starlight Casino holds the family ledger. Walk in, take it, and be nobody by the time you reach the hill safehouse.',
      stages: [
        { text: 'Take the ledger from the Starlight Casino door', kind: 'reach', at: () => ({ x: 168, z: -168 }), r: 5, onfoot: true, heat: 5.6 },
        { text: 'Lose the police completely', kind: 'loseCops' },
        { text: 'Reach the hill safehouse, north-west corner', kind: 'reach', at: () => ({ x: -336, z: -336 }), r: 10 },
      ],
      reward: 1200,
    },
    {
      title: 'JOB 4 · BAY RUNNER',
      intro: 'One last run. A cooler of "fresh catch" waits at the beach kiosk on the south shore — grab it and haul it clear across town to the north gate before the ice melts. The clock is the only cop on this one.',
      stages: [
        { text: 'Pick up the cooler at the beach kiosk, south shore', kind: 'reach', at: () => ({ x: 168, z: 378 }), r: 6, pickup: 0x3fb8af },
        { text: 'Deliver it across the map to the north gate — 120 seconds', kind: 'reach', at: () => ({ x: -252, z: -336 }), r: 10, timer: 120, heat: 1.5 },
      ],
      reward: 900,
    },
  ];

  function current() {
    const S = NT.state;
    if (S.missionIndex < 0 || S.missionIndex >= MISSIONS.length) return null;
    return MISSIONS[S.missionIndex];
  }
  function stage() {
    const m = current();
    return m ? m.stages[NT.state.missionStage] : null;
  }
  function target() {
    const s = stage();
    if (!s) return null;
    if (s.kind === 'reach') return s.at();
    if (s.kind === 'enterCar' && NT.missions.jobCar) return { x: NT.missions.jobCar.x, z: NT.missions.jobCar.z };
    return null;
  }

  function setBeacon(at) {
    if (!beacon) {
      beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 30, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      scene.add(beacon);
    }
    if (at) { beacon.visible = true; beacon.position.set(at.x, 15, at.z); }
    else beacon.visible = false;
  }

  function startMission(i) {
    const S = NT.state;
    S.missionIndex = i; S.missionStage = 0; S.missionTimer = -1;
    const m = MISSIONS[i];
    NT.hud.banner(m.title, m.intro);
    NT.hud.setObjective(m.title, m.stages[0].text);
    if (i === 0 && !NT.missions.jobCar) {
      NT.missions.jobCar = NT.vehicles.spawn(-14, 80.5, Math.PI / 2, { kind: 'parked', color: 0x3fb8af });
    }
    armStage();
  }

  function armStage() {
    const s = stage();
    if (!s) return;
    if (s.timer) NT.state.missionTimer = s.timer;
    if (s.heat) { NT.state.heat = Math.max(NT.state.heat, s.heat); NT.state.wanted = NT.clamp(Math.floor(NT.state.heat / 1.4), 0, 5); }
    if (s.kind === 'reach' && s.pickup !== undefined && !packageMesh) {
      packageMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1),
        new THREE.MeshLambertMaterial({ color: s.pickup, emissive: 0x333333 }));
      const at = s.at(); packageMesh.position.set(at.x, 0.6, at.z);
      scene.add(packageMesh);
    }
  }

  function advance() {
    const S = NT.state;
    const m = current();
    NT.audio.pickup();
    const done = stage();
    if (packageMesh && done && done.pickup !== undefined) { scene.remove(packageMesh); packageMesh = null; }
    S.missionStage++;
    if (S.missionStage >= m.stages.length) {
      S.cash += m.reward;
      NT.audio.cash();
      NT.hud.banner('JOB DONE', `+$${m.reward} — the family remembers loyalty.`);
      const next = S.missionIndex + 1;
      S.missionIndex = -1; S.missionTimer = -1;
      if (next >= MISSIONS.length) { S.storyDone = true; NT.game.save(); setTimeout(() => NT.game.complete(), 1600); }
      else { NT.hud.setObjective('FREE ROAM', 'Press M when you are ready for the next job.'); NT.game.save(); }
      setBeacon(null);
      return;
    }
    const s = stage();
    NT.hud.setObjective(m.title, s.text);
    armStage();
  }

  function update(dt, focus) {
    const s = stage();
    setBeacon(target());
    if (packageMesh) packageMesh.rotation.y += dt * 2;
    if (!s) return;
    const S = NT.state;
    if (S.missionTimer > 0) {
      S.missionTimer -= dt;
      if (S.missionTimer <= 0) {
        NT.hud.banner('JOB FAILED', 'Too slow. Press M to try the job again.');
        S.missionIndex = -1; S.missionTimer = -1; setBeacon(null);
        NT.hud.setObjective('FREE ROAM', 'Press M to restart the job.');
        return;
      }
    }
    if (s.kind === 'reach') {
      const at = s.at();
      if (NT.dist2(focus.x, focus.z, at.x, at.z) < s.r * s.r && (!s.onfoot || !S.inCar)) advance();
    } else if (s.kind === 'enterCar') {
      if (S.inCar && S.inCar === NT.missions.jobCar) advance();
    } else if (s.kind === 'loseCops') {
      if (S.wanted === 0) advance();
    }
  }

  function init(sc) { scene = sc; }
  return { init, update, startMission, current, stage, target, MISSIONS, jobCar: null };
})();
