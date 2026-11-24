// Neon Tide: Palmira Bay — hand-in program for the gta6-01 bounty.
// Validates the entry against the gate's caps, copies game/ and
// screenshots/ into the output and writes the dossier the judge reads,
// with the vendored make.fun library. MAKEFUN_OUTPUT_DIR stands in for
// /output outside the grader's container.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, checked before anything is copied so a bad entry fails
// here with a named problem instead of scoring 0 in the sandbox.
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648; // 48 MiB
const SHOT_MIN = 3;
const SHOT_MAX = 4;
const SHOT_MAX_BYTES = 262144; // 256 KiB
const IMAGE_EXT = /\.(png|jpe?g)$/i;

function refuse(problem: string): never {
  process.stderr.write(`neon tide: hand-in refused: ${problem}\n`);
  process.exit(1);
}

// Every regular file under dir, as paths relative to it.
function walk(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(join(dir, entry.name), rel));
    else if (entry.isFile()) found.push(rel);
  }
  return found;
}

const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  refuse('game/index.html is missing — the entry has no game to hand in');
}
const gameFiles = walk(gameDir);
if (gameFiles.length > GAME_MAX_FILES) {
  refuse(`game/ holds ${gameFiles.length} files, over the ${GAME_MAX_FILES}-file cap`);
}
let gameBytes = 0;
for (const rel of gameFiles) gameBytes += statSync(join(gameDir, rel)).size;
if (gameBytes > GAME_MAX_BYTES) {
  refuse(`game/ totals ${gameBytes} bytes, over the ${GAME_MAX_BYTES}-byte (48 MiB) cap`);
}

const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith('.') && IMAGE_EXT.test(e.name))
      .map((e) => e.name)
  : [];
if (shots.length < SHOT_MIN || shots.length > SHOT_MAX) {
  refuse(`screenshots/ holds ${shots.length} image files, but the gate takes ${SHOT_MIN} to ${SHOT_MAX}`);
}
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > SHOT_MAX_BYTES) {
    refuse(`screenshots/${name} is ${size} bytes, over the ${SHOT_MAX_BYTES}-byte (256 KiB) cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
const dossierBytes = statSync(join(out, 'dossier.json')).size;
process.stdout.write(
  `neon tide: handed in to ${out}: ${gameFiles.length} game files, ${gameBytes} game bytes, ` +
    `${shots.length} screenshots, dossier ${dossierBytes} bytes\n`,
);
