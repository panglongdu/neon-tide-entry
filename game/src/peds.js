// Neon Tide — pedestrians: Palmira's citizens stroll the sidewalks, flee
// from gunfire and traffic, and remember what they saw.
'use strict';
NT.peds = (function () {
  const list = [];
  const rand = NT.rng(4242);
  let scene = null;
  const SHIRTS = [0xff6b6b, 0xfeca57, 0x48dbfb, 0x1dd1a1, 0xf368e0, 0xffffff, 0x54a0ff, 0x5f27cd];

  function makePed(x, z) {
    const g = new THREE.Group();
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34),
      new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rand() * SHIRTS.length)] }));
    shirt.position.y = 1.05; g.add(shirt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.72; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2c3140 }));
    legs.position.y = 0.31; g.add(legs);
    g.position.set(x, 0, z);
    scene.add(g);
    const ped = {
      mesh: g, x, z, heading: rand() * Math.PI * 2, speed: 0,
      walkSpeed: 1.6 + rand() * 1.4, state: 'walk', panic: 0, dead: false, legPhase: rand() * 6,
      tx: x, tz: z,
    };
    pickTarget(ped);
    list.push(ped);
    return ped;
  }

  function pickTarget(ped) {
    // Stroll to a point up the sidewalk: mostly along the avenues.
    const P = NT.PITCH;
    const gx = NT.clamp(Math.round(ped.x / P) * P + (rand() - 0.5) * 10, -NT.WORLD + 10, NT.WORLD - 10);
    const gz = NT.clamp(Math.round(ped.z / P) * P + (rand() - 0.5) * 10, -NT.WORLD + 10, NT.WATER_Z - 6);
    if (rand() > 0.5) { ped.tx = gx; ped.tz = ped.z + (rand() - 0.5) * 160; }
    else { ped.tx = ped.x + (rand() - 0.5) * 160; ped.tz = gz; }
    ped.tz = NT.clamp(ped.tz, -NT.WORLD + 10, NT.WATER_Z - 6);
    ped.tx = NT.clamp(ped.tx, -NT.WORLD + 10, NT.WORLD - 10);
  }

  function hurt(ped, byPlayer) {
    if (ped.dead) return;
    ped.dead = true;
    ped.mesh.rotation.x = Math.PI / 2;
    ped.mesh.position.y = 0.25;
    if (byPlayer) NT.crime('ped', ped.x, ped.z, 1.6);
    setTimeout(() => { scene.remove(ped.mesh); const i = list.indexOf(ped); if (i >= 0) list.splice(i, 1); }, 9000);
  }

  function scare(x, z, radius) {
    for (const p of list) {
      if (p.dead) continue;
      if (NT.dist2(x, z, p.x, p.z) < radius * radius) { p.panic = 3 + rand() * 2; p.fleeX = x; p.fleeZ = z; }
    }
  }

  function update(dt, focus) {
    for (const p of list) {
      if (p.dead) continue;
      let tx = p.tx, tz = p.tz, speed = p.walkSpeed;
      if (p.panic > 0) {
        p.panic -= dt;
        const dx = p.x - (p.fleeX || 0), dz = p.z - (p.fleeZ || 0);
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 30; tz = p.z + (dz / d) * 30; speed = 5.2;
      } else if (NT.dist2(p.x, p.z, tx, tz) < 9) pickTarget(p);
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
      p.heading = Math.atan2(dx, dz);
      const step = Math.min(d, speed * dt);
      const [cx, cz] = NT.city.collide(p.x + (dx / d) * step, p.z + (dz / d) * step, 0.45);
      p.x = cx; p.z = cz;
      p.legPhase += dt * speed * 3.4;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.legPhase)) * 0.05, p.z);
      p.mesh.rotation.y = p.heading;
      // Run over by the player's car?
      const car = NT.state.inCar;
      if (car && Math.abs(car.speed) > 5 && NT.dist2(p.x, p.z, car.x, car.z) < 4.4) hurt(p, true);
      // Keep the crowd near the action, recycle the far ones.
      if (focus && NT.dist2(p.x, p.z, focus.x, focus.z) > 320 * 320) {
        const a = rand() * Math.PI * 2, r = 60 + rand() * 60;
        p.x = NT.clamp(focus.x + Math.cos(a) * r, -NT.WORLD, NT.WORLD);
        p.z = NT.clamp(focus.z + Math.sin(a) * r, -NT.WORLD, NT.WATER_Z - 6);
        pickTarget(p);
      }
    }
  }

  function init(sc, focus) {
    scene = sc;
    for (let i = 0; i < 34; i++) {
      const a = rand() * Math.PI * 2, r = 20 + rand() * 130;
      makePed(NT.clamp(focus.x + Math.cos(a) * r, -NT.WORLD, NT.WORLD),
        NT.clamp(focus.z + Math.sin(a) * r, -NT.WORLD, NT.WATER_Z - 8));
    }
  }

  return { init, update, scare, hurt, list };
})();
