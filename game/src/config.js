// Neon Tide: Palmira Bay — shared constants, helpers and the game state.
// Every other module reads the world through the NT namespace.
'use strict';
const NT = {
  // City geometry: a grid of blocks separated by roads, a beach to the south.
  PITCH: 84,          // distance between road centrelines
  ROAD: 17,           // road width
  GRID: 4,            // blocks from centre to edge (city is 2*GRID+1 blocks wide)
  WATER_Z: 402,       // z beyond this is open water
  WORLD: 430,         // playable half-extent

  // Palette: sun-soaked modern coastal city.
  SKY: 0x8ec9e8, FOG: 0xc7dde8,
  PASTELS: [0xf6d8a8, 0xf2b8c6, 0xa8d8c8, 0xf6efe0, 0xc9d6f2, 0xf2c49b, 0xdff2f8, 0xe8c8e0],
  CAR_COLORS: [0xd64541, 0x3f8cff, 0xffd23c, 0x58b368, 0xf5f0e6, 0x30343e, 0xff8c42, 0x9b7ede, 0x3fb8af],

  state: {
    mode: 'menu',           // menu | play | wasted | busted | complete
    cash: 120, health: 100,
    wanted: 0,              // 0..5 stars
    heat: 0,                // hidden pressure that turns sightings into stars
    time: 0,                // seconds played
    missionIndex: -1,       // -1 free roam, else index into MISSIONS
    missionStage: 0,
    missionTimer: -1,
    storyDone: false,
    inCar: null,            // vehicle the player drives, or null on foot
    shots: new URLSearchParams(location.search).has('shot'),
  },

  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist2(ax, az, bx, bz) { const x = ax - bx, z = az - bz; return x * x + z * z; },
  // Deterministic RNG (mulberry32) so screenshot poses and the city are stable.
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
};
