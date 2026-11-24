// Neon Tide — vehicles: the car factory, parked cars, traffic that follows
// the avenue grid, and the driving model the player uses.
'use strict';
NT.vehicles = (function () {
  const list = [];
  const rand = NT.rng(777);
  let scene = null;

  function makeCarMesh(color, police) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf2f2f2 : color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.3), bodyMat);
    body.position.y = 0.55; g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.9),
      new THREE.MeshLambertMaterial({ color: police ? 0x1c1e24 : color }));
    nose.position.set(0, 0.48, 2.3); g.add(nose);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0),
      new THREE.MeshLambertMaterial({ color: 0x22303e }));
    cabin.position.set(0, 1.05, -0.2); g.add(cabin);
    if (police) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.3, 4.34),
        new THREE.MeshLambertMaterial({ color: 0x1c2f57 }));
      stripe.position.y = 0.55; g.add(stripe);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff3344 }));
      bar.position.set(0, 1.42, -0.2); g.add(bar);
      g.userData.lightbar = bar;
    }
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w);
    }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    for (const s of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), lightMat);
      hl.position.set(s, 0.62, 2.76); g.add(hl);
    }
    // Tail lights: one shared material per car so braking can flare them.
    // (No headlight cones — Palmira is a daylight city, beams stay off.)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0x7a1620 });
    for (const s of [-0.62, 0.62]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.06), tailMat);
      tl.position.set(s, 0.64, -2.16); g.add(tl);
    }
    g.userData.tailMat = tailMat;
    return g;
  }

  // Brake glow: bright red while the car is shedding speed, dim otherwise.
  function setBrake(car, on) {
    if (!car.tailMat || car.braking === on) return;
    car.braking = on;
    car.tailMat.color.setHex(on ? 0xff2a30 : 0x7a1620);
  }

  function spawn(x, z, heading, opts) {
    opts = opts || {};
    const color = opts.color !== undefined ? opts.color : NT.CAR_COLORS[Math.floor(rand() * NT.CAR_COLORS.length)];
    const mesh = makeCarMesh(color, !!opts.police);
    mesh.position.set(x, 0, z); mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh, x, z, heading, speed: 0, color, police: !!opts.police,
      kind: opts.kind || 'parked',           // parked | traffic | player | police
      axis: opts.axis || 'x', line: opts.line || 0, dir: opts.dir || 1,
      lane: opts.lane || 3.6, cruise: 11 + rand() * 5, dead: false,
      sirenPhase: rand() * 6,
      tailMat: mesh.userData.tailMat || null, braking: false,
    };
    list.push(car);
    return car;
  }

  function nearestFreeCar(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const c of list) {
      if (c.kind === 'police' || c.dead) continue;
      const d = NT.dist2(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function removeCar(car) {
    car.dead = true;
    scene.remove(car.mesh);
    const i = list.indexOf(car); if (i >= 0) list.splice(i, 1);
  }

  // Traffic: drive along the current avenue; at each crossing, sometimes turn.
  function stepTraffic(car, dt) {
    const P = NT.PITCH;
    // Slow for a car ahead in the same lane.
    let target = car.cruise;
    for (const o of list) {
      if (o === car || o.dead) continue;
      const ahead = car.axis === 'x' ? (o.x - car.x) * car.dir : (o.z - car.z) * car.dir;
      const side = car.axis === 'x' ? Math.abs(o.z - car.z) : Math.abs(o.x - car.x);
      if (ahead > 0 && ahead < 9 && side < 2.2) target = Math.min(target, Math.max(0, (ahead - 5) * 1.6));
    }
    setBrake(car, target < car.speed - 0.4);
    car.speed = NT.lerp(car.speed, target, Math.min(1, dt * 2));
    const move = car.speed * dt * car.dir;
    if (car.axis === 'x') car.x += move; else car.z += move;
    // Crossing a perpendicular avenue centre? Maybe turn onto it.
    const along = car.axis === 'x' ? car.x : car.z;
    const cross = Math.round(along / P) * P;
    if (Math.abs(along - cross) < Math.abs(move) + 0.01 && Math.abs(along) > 0.01) {
      if (rand() > 0.55) {
        const across = car.axis === 'x' ? car.z : car.x;
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.dir = rand() > 0.5 ? 1 : -1;
        car.line = cross;
        if (car.axis === 'x') { car.z = across; } else { car.x = across; }
      }
    }
    // Keep to the lane: cross-axis coordinate eases to the avenue centre + lane.
    if (car.axis === 'x') {
      const roadC = Math.round(car.z / P) * P;
      car.z = NT.lerp(car.z, roadC + (car.dir > 0 ? -car.lane : car.lane), Math.min(1, dt * 3));
      car.heading = NT.lerp(car.heading, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, dt * 6));
    } else {
      const roadC = Math.round(car.x / P) * P;
      car.x = NT.lerp(car.x, roadC + (car.dir > 0 ? car.lane : -car.lane), Math.min(1, dt * 3));
      car.heading = NT.lerp(car.heading, car.dir > 0 ? Math.PI : 0, Math.min(1, dt * 6));
    }
    if (Math.abs(car.x) > NT.WORLD + 60 || Math.abs(car.z) > NT.WORLD + 60) removeCar(car);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  // The player's driving: arcade model, handbrake, building and car bumps.
  function drivePlayer(car, input, dt) {
    const accel = 16, maxF = 30, maxR = -10;
    const before = car.speed;
    if (input.up) car.speed += accel * dt;
    else if (input.down) car.speed -= (car.speed > 0.5 ? 22 : accel * 0.7) * dt;
    else car.speed = NT.lerp(car.speed, 0, Math.min(1, dt * (car.speed > 0 ? 0.7 : 1.4)));
    car.speed = NT.clamp(car.speed, maxR, maxF);
    if (input.brake) car.speed = NT.lerp(car.speed, 0, Math.min(1, dt * 5));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    if (steer && Math.abs(car.speed) > 0.4) {
      car.heading += steer * dt * 1.9 * Math.min(1, Math.abs(car.speed) / 9) * (car.speed < 0 ? -1 : 1);
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const [cx, cz] = NT.city.collide(nx, nz, 2.1);
    if ((cx !== nx || cz !== nz) && Math.abs(car.speed) > 9) { NT.audio.crash(); NT.crime('crash', car.x, car.z, 0.25); }
    if (cx !== nx || cz !== nz) car.speed *= 0.45;
    car.x = cx; car.z = cz;
    for (const o of list) {
      if (o === car || o.dead) continue;
      const d2 = NT.dist2(car.x, car.z, o.x, o.z);
      if (d2 < 12) {
        const d = Math.sqrt(d2) || 1;
        const push = (3.5 - d) * 0.5;
        o.x += ((o.x - car.x) / d) * push; o.z += ((o.z - car.z) / d) * push;
        o.mesh.position.set(o.x, 0, o.z);
        if (Math.abs(car.speed) > 6) { NT.audio.crash(); car.speed *= 0.55; NT.crime('hitcar', car.x, car.z, 0.5); }
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Brake lights flare on the pedal, the handbrake, or a hard speed scrub.
    setBrake(car, !!(input.brake || (input.down && car.speed > 0.5) || car.speed < before - 6 * dt));
    NT.audio.engine(true, car.speed / maxF);
    return car.speed;
  }

  function init(sc) {
    scene = sc;
    // Parked cars along the avenues and a living traffic stream.
    const P = NT.PITCH;
    for (let i = 0; i < 26; i++) {
      const alongX = rand() > 0.5;
      const line = (Math.floor(rand() * (2 * NT.GRID + 1)) - NT.GRID) * P;
      const at = (rand() - 0.5) * 2 * NT.WORLD * 0.92;
      const laneOff = (rand() > 0.5 ? 1 : -1) * (NT.ROAD / 2 - 1.6);
      const x = alongX ? at : line + laneOff;
      const z = alongX ? line + laneOff : at;
      const [cx, cz] = NT.city.collide(x, z, 0.1);
      spawn(cx, cz, alongX ? Math.PI / 2 : 0, { kind: 'parked' });
    }
    for (let i = 0; i < 13; i++) {
      const axis = rand() > 0.5 ? 'x' : 'z';
      const line = (Math.floor(rand() * (2 * NT.GRID + 1)) - NT.GRID) * P;
      const at = (rand() - 0.5) * 2 * NT.WORLD * 0.9;
      const dir = rand() > 0.5 ? 1 : -1;
      const car = spawn(axis === 'x' ? at : line, axis === 'x' ? line : at, 0,
        { kind: 'traffic', axis, line, dir, lane: 3.6 });
      car.speed = car.cruise;
    }
  }

  function update(dt) {
    for (const car of [...list]) if (car.kind === 'traffic') stepTraffic(car, dt);
  }

  return { init, update, spawn, removeCar, nearestFreeCar, drivePlayer, list };
})();
