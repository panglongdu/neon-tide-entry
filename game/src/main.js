// Neon Tide: Palmira Bay — boot, the game loop, input, damage, and the
// state machine between menu, play, wasted, busted and story complete.
// Progress (cash, jobs done) is saved in the browser between visits.
'use strict';
(function () {
  const SAVE_KEY = 'neontide-save-v1';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.className = 'webgl';
  document.getElementById('scene').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1600);
  camera.position.set(0, 30, -40);

  const input = { up: 0, down: 0, left: 0, right: 0, brake: 0, shift: 0, shoot: 0 };
  const KEYS = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'shift', ShiftRight: 'shift',
  };
  addEventListener('keydown', (e) => {
    NT.audio.unlock();
    if (KEYS[e.code]) { input[KEYS[e.code]] = 1; e.preventDefault(); }
    if (e.code === 'Space') { input.brake = 1; input.shoot = 1; e.preventDefault(); }
    if (e.code === 'KeyE' && NT.state.mode === 'play') NT.player.tryEnterExit();
    if (e.code === 'KeyM' && NT.state.mode === 'play') NT.game.nextJob();
  });
  addEventListener('keyup', (e) => {
    if (KEYS[e.code]) input[KEYS[e.code]] = 0;
    if (e.code === 'Space') { input.brake = 0; input.shoot = 0; }
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: NT.state.cash, storyDone: NT.state.storyDone,
        nextJob: NT.state.storyDone ? 3 : (NT.game._nextJob || 0),
      }));
    } catch (e) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  }

  function startGame(freeRoam) {
    NT.audio.unlock();
    const S = NT.state;
    S.mode = 'play'; S.health = 100; S.wanted = 0; S.heat = 0; S.bustMeter = 0;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('wasted').style.display = 'none';
    document.getElementById('busted').style.display = 'none';
    document.getElementById('complete').style.display = 'none';
    if (!freeRoam && !S.storyDone) {
      NT.hud.banner('NEON TIDE', 'Palmira Bay. Work the jobs. Buy back your name.');
      setTimeout(() => NT.game.nextJob(), 1200);
    } else {
      NT.hud.setObjective('FREE ROAM', 'Explore Palmira Bay. Press M for the next job, or just cause weather.');
    }
  }

  NT.game = {
    _nextJob: 0,
    save,
    nextJob() {
      const S = NT.state;
      if (S.missionIndex >= 0) { NT.hud.toast('Finish the current job first'); return; }
      if (S.storyDone || NT.game._nextJob >= NT.missions.MISSIONS.length) {
        NT.hud.toast('Every job is done — the bay is yours');
        return;
      }
      NT.missions.startMission(NT.game._nextJob);
      NT.game._nextJob++;
    },
    busted() {
      const S = NT.state;
      if (S.mode !== 'play') return;
      S.mode = 'busted';
      const fine = Math.min(S.cash, 150 + S.wanted * 60);
      S.cash -= fine; S.wanted = 0; S.heat = 0; S.bustMeter = 0;
      if (S.inCar) { S.inCar.kind = 'parked'; S.inCar = null; NT.player._p.mesh.visible = true; }
      NT.audio.engine(false); NT.audio.siren(false);
      document.getElementById('busted').style.display = 'flex';
      save();
    },
    wasted() {
      const S = NT.state;
      if (S.mode !== 'play') return;
      S.mode = 'wasted';
      S.wanted = 0; S.heat = 0;
      if (S.inCar) { S.inCar.kind = 'parked'; S.inCar = null; NT.player._p.mesh.visible = true; }
      NT.audio.engine(false); NT.audio.siren(false);
      document.getElementById('wasted').style.display = 'flex';
      save();
    },
    complete() {
      if (NT.state.mode !== 'play') return;
      NT.state.mode = 'complete';
      document.getElementById('complete').style.display = 'flex';
    },
  };

  document.getElementById('btn-start').onclick = () => {
    const s = load();
    NT.state.cash = 120; NT.game._nextJob = 0; NT.state.storyDone = false;
    startGame(false);
  };
  document.getElementById('btn-continue').onclick = () => {
    const s = load();
    if (s) { NT.state.cash = s.cash; NT.state.storyDone = !!s.storyDone; NT.game._nextJob = s.nextJob || 0; }
    startGame(false);
  };
  document.getElementById('btn-free').onclick = () => startGame(true);
  document.getElementById('btn-wasted').onclick = () => startGame(true);
  document.getElementById('btn-busted').onclick = () => startGame(true);
  document.getElementById('btn-roam').onclick = () => startGame(true);
  if (!load()) document.getElementById('btn-continue').style.display = 'none';

  // Build the world.
  NT.city.build(scene);
  NT.vehicles.init(scene);
  NT.player.init(scene);
  NT.peds.init(scene, NT.player.focus());
  NT.police.init(scene);
  NT.missions.init(scene);

  // Damage: traffic and patrol cars hurt Vex on foot; hard crashes hurt in a car.
  function damage(dt) {
    const S = NT.state;
    if (S.mode !== 'play') return;
    if (!S.inCar) {
      for (const c of NT.vehicles.list) {
        if (Math.abs(c.speed) > 8 && NT.dist2(c.x, c.z, NT.player.x, NT.player.z) < 4.6) {
          S.health -= 34;
          NT.audio.crash();
          NT.hud.toast('You got clipped by traffic');
          NT.player._p.x += (NT.player.x - c.x) * 1.4;
          NT.player._p.z += (NT.player.z - c.z) * 1.4;
          if (S.health <= 0) NT.game.wasted();
          break;
        }
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const S = NT.state;
    if (S.mode === 'play' || S.mode === 'menu') {
      S.time += dt;
      const focus = NT.player.focus();
      if (S.mode === 'play') NT.player.update(dt, input);
      NT.vehicles.update(dt);
      NT.peds.update(dt, NT.player.focus());
      if (S.mode === 'play') {
        NT.police.update(dt, NT.player.focus());
        NT.missions.update(dt, NT.player.focus());
        damage(dt);
      }
      NT.player.camera(dt, camera);
      if (NT.city.water) NT.city.water.position.y = -0.4 + Math.sin(S.time * 0.7) * 0.08;
      NT.hud.update(NT.player.focus());
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
