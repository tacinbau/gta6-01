// Traffic AI: cars that pick a road, drive a lane, turn at random
// intersections, stop on a red light, and slow down for the car ahead.
// They never leave the roads, so the city always feels alive.

import { ROAD_WIDTH, CAR_RADIUS } from './config.js';
import { lightIsGreenFor, nearestRoadCenter, inWater, circleHitsBuilding } from './world.js';
import { createCar, randomCar } from './vehicles.js';
import { RNG } from './rng.js';

export function spawnTraffic(world, rng, count = 14) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 500) {
    tries++;
    const vertical = rng.chance(0.5);
    const road = rng.pick(world.roads);
    const along = rng.range(260, 3040);
    const lane = rng.pick([-16, 16]);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    if (inWater(world, x, y)) continue;
    const angle = vertical ? (lane < 0 ? Math.PI / 2 : -Math.PI / 2) : (lane < 0 ? 0 : Math.PI);
    const car = randomCar(rng, x, y, angle, 'traffic');
    car.speed = rng.range(90, 170);
    car.targetSpeed = car.speed;
    car.axis = vertical ? 'ns' : 'ew';
    car.lane = lane;
    cars.push(car);
  }
  return cars;
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updateTraffic(cars, dt, world, time, allCars) {
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    // Waypoint: keep driving along the current road; at an intersection
    // sometimes turn onto the crossing road.
    const vertical = car.axis === 'ns';
    const roadCenter = nearestRoadCenter(world, vertical ? car.x : car.y);
    const movingForward = vertical ? Math.sin(car.angle) > 0 : Math.cos(car.angle) > 0;

    // Find the next intersection ahead.
    let nextInter = null;
    let nextDist = Infinity;
    for (const inter of world.intersections) {
      if (vertical && Math.abs(inter.x - roadCenter) > 2) continue;
      if (!vertical && Math.abs(inter.y - roadCenter) > 2) continue;
      const d = vertical ? (inter.y - car.y) * Math.sin(car.angle) : (inter.x - car.x) * Math.cos(car.angle);
      if (d > 0 && d < nextDist) { nextDist = d; nextInter = inter; }
    }

    let wantSpeed = car.targetSpeed || 140;
    // Red light: stop before the intersection.
    if (nextInter && nextDist < 78) {
      const green = lightIsGreenFor(nextInter, time, car.axis);
      if (!green) wantSpeed = 0;
    }
    // Car ahead: slow down instead of rear-ending it. The stop gap is
    // generous on purpose — tight queues at lights used to shove cars
    // into each other and pile up at intersections.
    for (const other of allCars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 76 && side < 26) wantSpeed = Math.min(wantSpeed, 0);
      else if (ahead > 0 && ahead < 140 && side < 26) wantSpeed = Math.min(wantSpeed, 60);
    }

    // Ease toward the wanted speed.
    if (car.speed < wantSpeed) car.speed += 160 * dt;
    else if (car.speed > wantSpeed) car.speed -= 320 * dt;
    if (Math.abs(car.speed) < 2 && wantSpeed === 0) car.speed = 0;

    // Turn at the intersection: decide once per intersection (a key
    // stops the re-roll every frame that used to flip cars around),
    // then sweep the angle round smoothly instead of snapping it.
    if (car.turning) {
      const tDiff = angleDiff(car.angle, car.turnTarget);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, tDiff));
      if (Math.abs(tDiff) < 0.05) {
        car.angle = car.turnTarget;
        car.turning = false;
      }
    } else if (nextInter && nextDist < 16 && car.speed > 40) {
      const key = nextInter.x + ',' + nextInter.y;
      if (car.lastTurnKey !== key) {
        car.lastTurnKey = key;
        if (Math.random() < 0.5) {
          const turnLeft = Math.random() < 0.5;
          car.axis = vertical ? 'ew' : 'ns';
          car.turnTarget = vertical
            ? (turnLeft ? Math.PI : 0)
            : (turnLeft ? -Math.PI / 2 : Math.PI / 2);
          car.turning = true;
          // Lane flips with the turn so we stay on the correct side.
          car.lane = -car.lane;
        }
      }
    }

    // Steer back onto the lane centre. While turning, the turning
    // block above already sweeps the angle, so lane steering waits
    // until the corner is done.
    if (!car.turning) {
      const laneTarget = roadCenter + car.lane;
      const pos = vertical ? car.x : car.y;
      const lateralError = laneTarget - pos;
      const desired = vertical
        ? (Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2) + lateralError * 0.012
        : (Math.cos(car.angle) > 0 ? 0 : Math.PI) + lateralError * 0.012;
      const diff = angleDiff(car.angle, desired);
      car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    }

    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!circleHitsBuilding(world, nx, ny, CAR_RADIUS) && !inWater(world, nx, ny)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed = 0;
      car.angle += Math.PI / 2;
    }
    if (car.x < 180 || car.x > 3040 || car.y < 180 || car.y > 3180) {
      car.angle += Math.PI;
    }
  }
}
