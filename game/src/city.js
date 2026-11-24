// Neon Tide — Palmira Bay itself: the road grid, pastel towers, palms,
// lamps, the beach and the bay. Also the collision and road helpers every
// other system uses.
'use strict';
NT.city = (function () {
  const colliders = [];   // {minX, maxX, minZ, maxZ} for buildings
  const rand = NT.rng(20261124);

  function windowTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 120; y += 12) for (let x = 6; x < 58; x += 12) {
      g.fillStyle = rand() > 0.28 ? '#2c3e50' : '#ffe9a8';
      g.fillRect(x, y, 7, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function build(scene) {
    const P = NT.PITCH, half = NT.GRID * P + P / 2;
    scene.background = new THREE.Color(NT.SKY);
    scene.fog = new THREE.Fog(NT.FOG, 260, 900);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.05);
    sun.position.set(180, 300, 120);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xbfd9e8, 0.75));
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.35);
    scene.add(hemi);

    // Ground: city slab, then beach sand and water to the south.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshLambertMaterial({ color: 0x7e7a68 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
    scene.add(ground);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(2400, 130),
      new THREE.MeshLambertMaterial({ color: 0xf2ddab }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, NT.WATER_Z + 40);
    scene.add(sand);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 700),
      new THREE.MeshPhongMaterial({ color: 0x2e7fb8, shininess: 120, specular: 0xbfe8ff }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, NT.WATER_Z + 430);
    scene.add(water);
    NT.city.water = water;

    // Roads: dark strips along every grid line, with dashed centre lines.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x33373d });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf7e9a0 });
    const sideMat = new THREE.MeshLambertMaterial({ color: 0xa89e83 });
    for (let k = -NT.GRID; k <= NT.GRID; k++) {
      const c = k * P;
      for (const along of ['x', 'z']) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, NT.ROAD), roadMat);
        road.rotation.x = -Math.PI / 2;
        if (along === 'x') { road.position.set(0, 0.02, c); } else { road.rotation.z = Math.PI / 2; road.position.set(c, 0.02, 0); }
        scene.add(road);
        const side = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, NT.ROAD + 5), sideMat);
        side.rotation.x = -Math.PI / 2;
        if (along === 'x') { side.position.set(0, 0.005, c); } else { side.rotation.z = Math.PI / 2; side.position.set(c, 0.005, 0); }
        scene.add(side);
        for (let d = -half + 8; d < half - 8; d += 12) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), lineMat);
          dash.rotation.x = -Math.PI / 2;
          if (along === 'x') dash.position.set(d, 0.04, c); else { dash.rotation.z = Math.PI / 2; dash.position.set(c, 0.04, d); }
          scene.add(dash);
        }
      }
    }

    // Buildings: one to four pastel towers per block, windows from a canvas.
    const winTex = windowTexture();
    for (let bx = -NT.GRID; bx < NT.GRID; bx++) for (let bz = -NT.GRID; bz < NT.GRID; bz++) {
      const cx = bx * P + P / 2, cz = bz * P + P / 2;
      const towers = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < towers; i++) {
        const w = 16 + rand() * 16, d = 16 + rand() * 16;
        const h = 14 + rand() * rand() * 64;
        const x = cx + (rand() - 0.5) * (P - NT.ROAD - w - 8);
        const z = cz + (rand() - 0.5) * (P - NT.ROAD - d - 8);
        if (colliders.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 3 && Math.abs(b.z - z) < (b.d + d) / 2 + 3)) continue;
        const mat = new THREE.MeshLambertMaterial({ color: NT.PASTELS[Math.floor(rand() * NT.PASTELS.length)], map: winTex });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(x, h / 2, z);
        scene.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 1.2, d + 1.5),
          new THREE.MeshLambertMaterial({ color: 0x8a4b3a }));
        roof.position.set(x, h + 0.6, z);
        scene.add(roof);
        colliders.push({ x, z, w, d, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }

    // Palms and lamps along the avenues.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    for (let k = -NT.GRID; k <= NT.GRID; k++) for (let d = -half + 20; d < half; d += 42) {
      for (const [x, z] of [[k * P + NT.ROAD / 2 + 3, d], [k * P - NT.ROAD / 2 - 3, d + 21], [d, k * P + NT.ROAD / 2 + 3], [d + 21, k * P - NT.ROAD / 2 - 3]]) {
        if (Math.abs(x) > half || Math.abs(z) > half) continue;
        if (rand() > 0.45) {
          const palm = new THREE.Group();
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.5, 5), trunkMat);
          trunk.position.y = 3.25; trunk.rotation.z = (rand() - 0.5) * 0.16; palm.add(trunk);
          for (let f = 0; f < 6; f++) {
            const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.6, 4), frondMat);
            frond.position.y = 6.6; frond.rotation.z = 1.15; frond.rotation.y = (f / 6) * Math.PI * 2;
            frond.translateX(1.6); palm.add(frond);
          }
          palm.position.set(x, 0, z); scene.add(palm);
          colliders.push({ x, z, w: 0.8, d: 0.8, minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
        } else {
          const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6, 5), lampMat);
          lamp.position.set(x, 2.8, z); scene.add(lamp);
        }
      }
    }

    // The pier: planks reaching into the bay, a mission landmark.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0xa08156 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 90), pierMat);
    pier.position.set(0, 0.4, NT.WATER_Z + 60); scene.add(pier);
    NT.city.pier = { x: 0, z: NT.WATER_Z + 95 };
  }

  function collide(px, pz, r) {
    // Push a circle at (px, pz) out of every building AABB; returns corrected [x, z].
    let x = px, z = pz;
    for (const b of colliders) {
      const nx = NT.clamp(x, b.minX, b.maxX), nz = NT.clamp(z, b.minZ, b.maxZ);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        else { x = b.maxX + r; }
      }
    }
    return [NT.clamp(x, -NT.WORLD, NT.WORLD), NT.clamp(z, -NT.WORLD, NT.WATER_Z + 30)];
  }

  function onRoad(x, z) {
    const P = NT.PITCH, m = NT.ROAD / 2 + 2;
    const fx = Math.abs(((x % P) + P) % P), fz = Math.abs(((z % P) + P) % P);
    return Math.min(fx, P - fx) < m || Math.min(fz, P - fz) < m;
  }

  return { build, collide, onRoad, colliders };
})();
