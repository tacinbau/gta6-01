// Wanted level and police pursuit. Stars rise on crimes, decay when
// the player stays quiet and unseen, and police cars and foot officers
// spawn in proportion to the stars, chase, ram, and make the arrest
// (busted) when they catch the player standing still or on foot.

import { WANTED_MAX, WANTED_DECAY_PER_SEC } from './config.js';
import { createCar } from './vehicles.js';
import { CAR_MODELS } from './config.js';
import { nearestRoadCenter } from './world.js';

export function createPolice() {
  return {
    wanted: 0,
    lastCrimeAt: -100,
    quietTime: 0,
    cars: [],
    officers: [],
    bustTimer: 0,
    nextSpawnAt: 0,
  };
}

export function addWanted(police, amount, time) {
  police.wanted = Math.max(0, Math.min(WANTED_MAX, police.wanted + amount));
  police.lastCrimeAt = time;
  police.quietTime = 0;
  return police.wanted;
}

export function updateWanted(police, dt, time, playerPos, nearestPoliceDist) {
  if (police.wanted <= 0) return;
  const sinceCrime = time - police.lastCrimeAt;
  if (sinceCrime > 8 && nearestPoliceDist > 320) {
    police.quietTime += dt;
    police.wanted = Math.max(0, police.wanted - WANTED_DECAY_PER_SEC * dt * (police.quietTime > 4 ? 2 : 1));
    if (police.wanted < 0.5) police.wanted = 0;
  } else {
    police.quietTime = 0;
  }
}

function spawnPointNear(world, playerPos, dist) {
  // Pick a road point roughly `dist` away from the player.
  const road = nearestRoadCenter(world, playerPos.x);
  const candidates = [
    { x: playerPos.x + dist, y: nearestRoadCenter(world, playerPos.y) },
    { x: playerPos.x - dist, y: nearestRoadCenter(world, playerPos.y) },
    { x: road, y: playerPos.y + dist },
    { x: road, y: playerPos.y - dist },
  ];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function updatePolice(police, dt, time, world, player, playerCar) {
  const wanted = Math.round(police.wanted);
  const playerPos = playerCar || player;

  // Spawn police cars up to the wanted level (max 3 cars).
  const wantCars = Math.min(3, wanted);
  if (police.cars.length < wantCars && time >= police.nextSpawnAt) {
    police.nextSpawnAt = time + 2.5;
    const spot = spawnPointNear(world, playerPos, 520);
    const car = createCar(spot.x, spot.y, 0, {
      model: CAR_MODELS[1],
      color: '#1a1a2e',
      kind: 'police',
      isPolice: true,
    });
    car.speed = 120;
    police.cars.push(car);
  }
  // Foot officers when the player is on foot and wanted.
  const wantOfficers = playerCar ? 0 : Math.min(2, wanted);
  if (police.officers.length < wantOfficers && time >= police.nextSpawnAt) {
    police.nextSpawnAt = time + 2;
    const spot = spawnPointNear(world, playerPos, 380);
    police.officers.push({
      x: spot.x, y: spot.y, angle: 0, speed: 0,
      color: '#1a2a6c', state: 'chase', punchCooldown: 0,
    });
  }

  // Chase: steer each police car straight at the player, faster with
  // more stars, and ram on contact.
  for (const car of police.cars) {
    const dx = playerPos.x - car.x;
    const dy = playerPos.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desired = Math.atan2(dy, dx);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const top = 300 + wanted * 55;
    if (car.speed < top) car.speed += 260 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  // Officers run at the player on foot.
  for (const off of police.officers) {
    const dx = player.x - off.x;
    const dy = player.y - off.y;
    const dist = Math.hypot(dx, dy) || 1;
    off.angle = Math.atan2(dy, dx);
    const speed = 205;
    off.x += Math.cos(off.angle) * speed * dt;
    off.y += Math.sin(off.angle) * speed * dt;
    if (off.punchCooldown > 0) off.punchCooldown -= dt;
  }

  // Despawn police far away once the heat is off.
  if (wanted === 0) {
    police.cars = police.cars.filter((c) => {
      const d = Math.hypot(c.x - playerPos.x, c.y - playerPos.y);
      return d < 700;
    });
    if (police.cars.length === 0) police.officers = [];
  }
}

export function nearestPoliceDistance(police, pos) {
  let best = Infinity;
  for (const c of police.cars) best = Math.min(best, Math.hypot(c.x - pos.x, c.y - pos.y));
  for (const o of police.officers) best = Math.min(best, Math.hypot(o.x - pos.x, o.y - pos.y));
  return best;
}

// Returns 'busted' when an arrest completes, otherwise null.
// On foot: an officer touching the player for a while. In a car: a
// police car pressed against a nearly-stopped player car.
export function checkBusted(police, dt, player, playerCar) {
  if (police.wanted < 1) { police.bustTimer = 0; return null; }
  let touching = false;
  if (playerCar) {
    if (Math.abs(playerCar.speed) < 25) {
      for (const c of police.cars) {
        if (Math.hypot(c.x - playerCar.x, c.y - playerCar.y) < 52) { touching = true; break; }
      }
    }
  } else {
    for (const o of police.officers) {
      if (Math.hypot(o.x - player.x, o.y - player.y) < 30) { touching = true; break; }
    }
  }
  if (touching) {
    police.bustTimer += dt;
    if (police.bustTimer > 1.6) {
      police.bustTimer = 0;
      return 'busted';
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }
  return null;
}
