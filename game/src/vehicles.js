// Cars: models, spawning parked cars, and arcade driving physics —
// acceleration, braking and reverse, speed-sensitive steering, drag,
// drift and skid marks, and building / car collision with a bounce.

import { CAR_MODELS, CAR_COLORS, CAR_RADIUS } from './config.js';
import { circleHitsBuilding, clampToWorld, inWater } from './world.js';
import { RNG } from './rng.js';

let nextCarId = 1;

export function createCar(x, y, angle, opts = {}) {
  const model = opts.model || CAR_MODELS[0];
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    model,
    color: opts.color || '#c0392b',
    kind: opts.kind || 'parked',
    isPolice: !!opts.isPolice,
    isPlayer: false,
    parked: opts.kind === 'parked',
    health: 100,
    steer: 0,
    drift: 0,
    brakeLight: false,
    headlight: false,
  };
}

export function spawnParkedCars(world, rng, count = 26) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 600) {
    tries++;
    const road = rng.pick(world.roads);
    const along = rng.range(300, 3100);
    const vertical = rng.chance(0.5);
    const lane = rng.pick([-20, 20]);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    if (inWater(world, x, y)) continue;
    if (circleHitsBuilding(world, x, y, 30)) continue;
    let tooClose = false;
    for (const c of cars) {
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy < 70 * 70) { tooClose = true; break; }
    }
    if (tooClose) continue;
    const model = rng.pick(CAR_MODELS);
    cars.push(createCar(x, y, vertical ? Math.PI / 2 : 0, {
      model,
      color: model.name === 'Taxi' ? '#f1c40f' : rng.pick(CAR_COLORS),
      kind: 'parked',
    }));
  }
  return cars;
}

export function randomCar(rng, x, y, angle, kind) {
  const model = rng.pick(CAR_MODELS);
  return createCar(x, y, angle, {
    model,
    color: model.name === 'Taxi' ? '#f1c40f' : rng.pick(CAR_COLORS),
    kind,
  });
}

// Player driving. Returns an event list: { type: 'crash', speed } and
// { type: 'skid', x, y, angle } entries the main loop turns into
// particles, shake and damage.
export function updatePlayerCar(car, dt, input, world, cars) {
  const events = [];
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  let steerInput = 0;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) steerInput -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) steerInput += 1;

  const top = car.model.topSpeed;
  if (forward) car.speed += car.model.accel * dt;
  if (back) {
    if (car.speed > 5) car.speed -= 700 * dt;
    else car.speed -= 260 * dt;
  }
  // Drag plus rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (!forward && !back) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (Math.abs(car.speed) < 4 && !forward && !back) car.speed = 0;
  car.speed = Math.max(-150, Math.min(top, car.speed));

  const speedFactor = Math.min(1, Math.abs(car.speed) / 220);
  const targetSteer = steerInput * 2.4 * speedFactor;
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 10);
  car.angle += car.steer * dt * Math.sign(car.speed || 1);

  const hardTurn = Math.abs(steerInput) === 1 && Math.abs(car.speed) > 300;
  car.drift = hardTurn ? 1 : Math.max(0, car.drift - dt * 2);
  if (hardTurn && Math.random() < 0.6) {
    events.push({ type: 'skid', x: car.x, y: car.y, angle: car.angle });
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = circleHitsBuilding(world, nx, ny, CAR_RADIUS);
  const wet = inWater(world, nx, ny);
  if (hit || wet) {
    const impact = Math.abs(car.speed);
    if (impact > 120) events.push({ type: 'crash', speed: impact, x: nx, y: ny });
    car.speed = -car.speed * 0.25;
    car.angle += 0.12;
  } else {
    car.x = nx;
    car.y = ny;
  }
  const clamped = clampToWorld(car.x, car.y, 26);
  car.x = clamped.x;
  car.y = clamped.y;

  car.brakeLight = back && car.speed > 5;
  return events;
}

// Simple circle push-apart between cars. Returns crash events for
// impacts hard enough to matter.
export function resolveCarCollisions(cars) {
  const events = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = 36;
      if (dist > 0 && dist < min) {
        const overlap = (min - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        const aParked = a.parked || Math.abs(a.speed) < 5;
        const bParked = b.parked || Math.abs(b.speed) < 5;
        if (!aParked) { a.x -= ux * overlap; a.y -= uy * overlap; }
        if (!bParked) { b.x += ux * overlap; b.y += uy * overlap; }
        if (aParked) { a.x -= ux * overlap; a.y -= uy * overlap; }
        if (bParked) { b.x += ux * overlap; b.y += uy * overlap; }
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 140) {
          events.push({ type: 'car-crash', speed: impact, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a, b });
          a.speed *= 0.55;
          b.speed *= 0.55;
        }
      }
    }
  }
  return events;
}

export function carFront(car) {
  return {
    x: car.x + Math.cos(car.angle) * (car.model.length / 2),
    y: car.y + Math.sin(car.angle) * (car.model.length / 2),
  };
}
