// Port Meridian entry packager: copies game/ (and screenshots/ when it
// exists) beside this file into the output directory, then writes a
// deterministic dossier.json from the kit's buildDossier. Running it
// twice over the same tree writes byte-identical output.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

mkdirSync(outDir, { recursive: true });

const gameSrc = join(here, 'game');
cpSync(gameSrc, join(outDir, 'game'), { recursive: true });

const shotsSrc = join(here, 'screenshots');
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });
  console.log('Port Meridian: copied game/ and screenshots/ to ' + outDir);
} else {
  console.log('Port Meridian: copied game/ to ' + outDir + ' (no screenshots/ yet)');
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Port Meridian: dossier.json written (' + dossier.length + ' bytes)');
