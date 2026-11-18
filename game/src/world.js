// Port Meridian city generation: a deterministic road grid, city blocks,
// buildings, a park, a harbour waterfront and traffic-light intersections.
// Everything here is pure data — drawing lives in render.js, movement
// collision queries live here so every system agrees on where walls are.

import { WORLD_SIZE, ROAD_WIDTH, ROAD_SPACING, ROAD_OFFSET, CITY_SEED } from './config.js';
import { RNG } from './rng.js';

export function roadCenters() {
  const centers = [];
  for (let x = ROAD_OFFSET; x < WORLD_SIZE; x += ROAD_SPACING) centers.push(x);
  return centers;
}

export function districtAt(x, y) {
  if (x > 2800) return 'harbour';
  if (x >= 1200 && x <= 2200 && y >= 1200 && y <= 2200) return 'downtown';
  if (y < 900) return 'northside';
  if (x < 900 && y > 2000) return 'oldtown';
  return 'gardens';
}

export function generateCity(seed = CITY_SEED) {
  const rng = new RNG(seed);
  const roads = roadCenters();
  const buildings = [];
  const trees = [];
  const boats = [];

  // Park block: the block between roads 600 and 1000, rows 600 and 1000.
  const park = { x: 632, y: 632, w: 336, h: 336 };
  // Harbour water strip along the east edge, plus a pier.
  const water = { x: 3032, y: 0, w: 168, h: WORLD_SIZE };
  const pier = { x: 2960, y: 1400, w: 240, h: 90 };

  const roofPalettes = {
    downtown: ['#5d6d7e', '#2e4053', '#7f8c8d', '#34495e', '#616a6b'],
    harbour: ['#a67c52', '#7e5109', '#935116', '#6e2c00'],
    northside: ['#a04000', '#7d6608', '#6c3483', '#1a5276'],
    oldtown: ['#922b21', '#7e5109', '#5d4037', '#4a235a'],
    gardens: ['#1e8449', '#117864', '#2e86c1', '#b7950b'],
  };

  for (let bi = 0; bi < roads.length - 1; bi++) {
    for (let bj = 0; bj < roads.length - 1; bj++) {
      const x0 = roads[bi] + ROAD_WIDTH / 2 + 8;
      const y0 = roads[bj] + ROAD_WIDTH / 2 + 8;
      const x1 = roads[bi + 1] - ROAD_WIDTH / 2 - 8;
      const y1 = roads[bj + 1] - ROAD_WIDTH / 2 - 8;
      // Park block stays open green space.
      if (x0 >= park.x - 4 && y0 >= park.y - 4 && x1 <= park.x + park.w + 4 && y1 <= park.y + park.h + 4) {
        for (let t = 0; t < 14; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 16) });
        }
        continue;
      }
      // Harbour blocks east of the last road are water, not buildings.
      if (x0 > 2800) continue;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      const tall = district === 'downtown';
      const count = rng.int(1, tall ? 2 : 4);
      if (count === 1) {
        const w = rng.range((x1 - x0) * 0.55, x1 - x0);
        const h = rng.range((y1 - y0) * 0.55, y1 - y0);
        buildings.push(makeBuilding(rng, x0 + (x1 - x0 - w) / 2, y0 + (y1 - y0 - h) / 2, w, h, district, roofPalettes, tall));
      } else {
        const cols = 2;
        const rows = Math.ceil(count / 2);
        const cw = (x1 - x0) / cols;
        const ch = (y1 - y0) / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (rng.chance(0.18)) continue;
            const w = rng.range(cw * 0.55, cw * 0.88);
            const h = rng.range(ch * 0.55, ch * 0.88);
            buildings.push(makeBuilding(
              rng,
              x0 + c * cw + (cw - w) / 2,
              y0 + r * ch + (ch - h) / 2,
              w, h, district, roofPalettes, tall,
            ));
          }
        }
      }
      if (rng.chance(0.5)) {
        trees.push({ x: rng.range(x0 + 10, x1 - 10), y: rng.range(y0 + 10, y1 - 10), r: rng.range(7, 11) });
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    boats.push({ x: rng.range(3060, 3160), y: rng.range(150, 3000), w: rng.range(26, 46), h: 14, angle: rng.range(-0.4, 0.4) });
  }

  const intersections = [];
  for (const x of roads) {
    for (const y of roads) intersections.push({ x, y });
  }

  return { seed, roads, buildings, trees, boats, park, water, pier, intersections, size: WORLD_SIZE };
}

function makeBuilding(rng, x, y, w, h, district, palettes, tall) {
  return {
    x, y, w, h,
    height: tall ? rng.int(3, 9) : rng.int(1, 3),
    color: rng.pick(palettes[district] || palettes.gardens),
    district,
  };
}

export function isOnRoad(world, x, y) {
  for (const c of world.roads) {
    if (Math.abs(x - c) <= ROAD_WIDTH / 2) return true;
    if (Math.abs(y - c) <= ROAD_WIDTH / 2) return true;
  }
  return false;
}

export function inWater(world, x, y) {
  return x >= world.water.x && x <= world.water.x + world.water.w && y >= 0 && y <= world.size;
}

export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function circleHitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

export function clampToWorld(x, y, margin = 24) {
  return {
    x: Math.max(margin, Math.min(WORLD_SIZE - margin, x)),
    y: Math.max(margin, Math.min(WORLD_SIZE - margin, y)),
  };
}

export function nearestRoadCenter(world, v) {
  let best = world.roads[0];
  let bestD = Infinity;
  for (const c of world.roads) {
    const d = Math.abs(v - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Traffic light cycle: 8 seconds. 0-3s north-south green, 3-4 yellow,
// 4-7 east-west green, 7-8 yellow. Each intersection is offset by its
// grid position so the city does not flip all at once.
export function lightPhase(intersection, time) {
  const offset = ((intersection.x / 400 + intersection.y / 400) % 2) * 2;
  const t = (time + offset) % 8;
  if (t < 3) return 'ns';
  if (t < 4) return 'ns-yellow';
  if (t < 7) return 'ew';
  return 'ew-yellow';
}

export function lightIsGreenFor(intersection, time, axis) {
  const phase = lightPhase(intersection, time);
  if (axis === 'ns') return phase === 'ns';
  return phase === 'ew';
}
