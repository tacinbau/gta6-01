// Pedestrians: they stroll the sidewalks, cross at intersections,
// and run when a speeding car or a crime comes at them. A knocked-down
// pedestrian stays down a while, then gets up and walks away.

import { PED_COLORS } from './config.js';
import { isOnRoad, circleHitsBuilding, inWater, clampToWorld } from './world.js';
import { RNG } from './rng.js';

let nextPedId = 1;

export function spawnPeds(world, rng, count = 36) {
  const peds = [];
  let tries = 0;
  while (peds.length < count && tries < 800) {
    tries++;
    const road = rng.pick(world.roads);
    const along = rng.range(260, 3050);
    const vertical = rng.chance(0.5);
    const side = rng.pick([-44, 44]);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    if (inWater(world, x, y)) continue;
    if (circleHitsBuilding(world, x, y, 16)) continue;
    peds.push({
      id: nextPedId++,
      x, y,
      angle: rng.range(0, Math.PI * 2),
      color: rng.pick(PED_COLORS),
      speed: rng.range(28, 55),
      state: 'walk',
      downTimer: 0,
      fleeTimer: 0,
      target: null,
      skin: rng.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    });
  }
  return peds;
}

function pickWalkTarget(ped, world, rng) {
  // Head for a nearby intersection, then along a sidewalk from there.
  const inter = rng.pick(world.intersections);
  ped.target = { x: inter.x + rng.pick([-44, 44]), y: inter.y + rng.pick([-44, 44]) };
}

export function updatePeds(peds, dt, world, danger, rng) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
      }
      continue;
    }
    // Flee: run away from the danger point.
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const d = Math.hypot(dx, dy) || 1;
      ped.angle = Math.atan2(dy / d, dx / d);
      const speed = 150;
      stepPed(ped, dt, world, speed);
      if (ped.fleeTimer <= 0 && d > 260) ped.state = 'walk';
      continue;
    }
    // A fast car or a nearby punch scares walkers into fleeing.
    if (danger.active) {
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const d = Math.hypot(dx, dy);
      if (d < danger.radius) {
        ped.state = 'flee';
        ped.fleeTimer = 2.5;
        continue;
      }
    }
    if (!ped.target) pickWalkTarget(ped, world, rng);
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      ped.target = null;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    stepPed(ped, dt, world, ped.speed);
  }
}

function stepPed(ped, dt, world, speed) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!circleHitsBuilding(world, nx, ped.y, 10) && !inWater(world, nx, ped.y)) ped.x = nx;
  if (!circleHitsBuilding(world, ped.x, ny, 10) && !inWater(world, ped.x, ny)) ped.y = ny;
  const clamped = clampToWorld(ped.x, ped.y, 14);
  ped.x = clamped.x;
  ped.y = clamped.y;
}

export function knockPedDown(ped) {
  ped.state = 'down';
  ped.downTimer = 4;
}

export function scarePedsNear(peds, x, y, radius) {
  for (const ped of peds) {
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius && ped.state !== 'down') {
      ped.state = 'flee';
      ped.fleeTimer = 3;
    }
  }
}
