// Neon Tide — Vex Marlowe on foot: movement, sprinting, stealing cars and
// the pistol. The camera lives here too: it trails whoever Vex is now.
'use strict';
NT.player = (function () {
  const p = {
    x: 6, z: 78, heading: Math.PI, speed: 0, mesh: null, legPhase: 0,
    camYaw: Math.PI, camDist: 15, shootCd: 0,
  };

  function buildMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xd64541 }));
    jacket.position.y = 1.06; g.add(jacket);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98d5e }));
    head.position.y = 1.74; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x2a1c10 }));
    hair.position.y = 1.82; hair.scale.y = 0.7; g.add(hair);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x1f2733 }));
    legs.position.y = 0.32; g.add(legs);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    gun.position.set(0.42, 1.15, 0.3); g.add(gun);
    g.userData.gun = gun;
    return g;
  }

  function init(scene) {
    p.mesh = buildMesh();
    p.mesh.position.set(p.x, 0, p.z);
    scene.add(p.mesh);
  }

  function focus() {
    const S = NT.state;
    return S.inCar ? { x: S.inCar.x, z: S.inCar.z } : { x: p.x, z: p.z };
  }

  function tryEnterExit() {
    const S = NT.state;
    if (S.inCar) {
      const car = S.inCar;
      S.inCar = null; car.kind = 'parked'; car.speed = 0;
      p.x = car.x + Math.cos(car.heading) * 2.4; p.z = car.z - Math.sin(car.heading) * 2.4;
      [p.x, p.z] = NT.city.collide(p.x, p.z, 0.5);
      p.mesh.visible = true;
      NT.audio.engine(false); NT.audio.door();
      return;
    }
    const car = NT.vehicles.nearestFreeCar(p.x, p.z, 4.2);
    if (car) {
      const wasParked = car.kind === 'parked';
      S.inCar = car; car.kind = 'player';
      p.mesh.visible = false;
      NT.audio.door();
      if (wasParked || car.kind === 'traffic') NT.crime('theft', car.x, car.z, 0.9);
      NT.hud.toast(wasParked ? 'You took the car. Smooth — if nobody saw.' : 'You are driving');
    }
  }

  function shoot() {
    if (p.shootCd > 0 || NT.state.inCar) return;
    p.shootCd = 0.32;
    NT.audio.shot();
    NT.crime('shot', p.x, p.z, 1.1);
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    let best = null, bd = 34;
    for (const ped of NT.peds.list) {
      if (ped.dead) continue;
      const dx = ped.x - p.x, dz = ped.z - p.z;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < bd && side < 1.6) { bd = along; best = ped; }
    }
    if (best) NT.peds.hurt(best, true);
  }

  function update(dt, input) {
    const S = NT.state;
    p.shootCd -= dt;
    if (S.inCar) {
      NT.vehicles.drivePlayer(S.inCar, input, dt);
      p.x = S.inCar.x; p.z = S.inCar.z;
      p.heading = S.inCar.heading;
      return;
    }
    const run = input.shift ? 8.6 : 5.0;
    let mx = 0, mz = 0;
    if (input.up) mz += 1; if (input.down) mz -= 1;
    if (input.left) mx += 1; if (input.right) mx -= 1;
    if (mx || mz) {
      const target = Math.atan2(mx, mz) + p.camYaw + Math.PI;
      let dh = target - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += NT.clamp(dh, -dt * 12, dt * 12);
      const step = run * dt;
      const [cx, cz] = NT.city.collide(
        p.x + Math.sin(p.heading) * step, p.z + Math.cos(p.heading) * step, 0.5);
      p.x = cx; p.z = cz;
      p.legPhase += dt * run * 2.2;
      p.speed = run;
    } else p.speed = 0;
    if (input.shoot) shoot();
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.legPhase)) * 0.06, p.z);
    p.mesh.rotation.y = p.heading;
    // Slow recovery when out of trouble.
    if (S.wanted === 0 && S.health < 100) S.health = Math.min(100, S.health + dt * 2.5);
  }

  // Camera: trails behind the focus, higher and further in a car.
  function camera(dt, cam) {
    const S = NT.state;
    const f = focus();
    const targetYaw = S.inCar ? S.inCar.heading : p.heading;
    let dh = targetYaw - p.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.camYaw += dh * Math.min(1, dt * (S.inCar ? 2.6 : 1.6));
    const dist = S.inCar ? 15.5 : 11, height = S.inCar ? 6.4 : 5.2;
    const cx = f.x - Math.sin(p.camYaw) * dist;
    const cz = f.z - Math.cos(p.camYaw) * dist;
    cam.position.x = NT.lerp(cam.position.x, cx, Math.min(1, dt * 5));
    cam.position.z = NT.lerp(cam.position.z, cz, Math.min(1, dt * 5));
    cam.position.y = NT.lerp(cam.position.y, height, Math.min(1, dt * 5));
    cam.lookAt(f.x, 1.2, f.z);
  }

  return { init, update, camera, focus, tryEnterExit, shoot,
    get x() { return p.x; }, get z() { return p.z; },
    get heading() { return p.heading; }, _p: p };
})();
