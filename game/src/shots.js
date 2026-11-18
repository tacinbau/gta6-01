// Staged screenshot scenes for ?shot=<scene>&seed=<n>. Each scene
// starts from the real game, fast-forwards the real rules for a fixed
// number of steps with a seeded RNG and a simple driving autopilot,
// then freezes the simulation so the captured frame is exactly the
// staged one. Scenes: chase, street, mission, dusk.

import { RNG } from './rng.js';
import { createCar } from './vehicles.js';
import { CAR_MODELS } from './config.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Hold W and steer toward a heading that keeps the car on its road.
function autopilotAlongRoad(g, roadCoord, axis) {
  const input = g.input;
  const car = g.player.inCar;
  if (!car) return;
  input.down.add('KeyW');
  let desired;
  if (axis === 'ew') {
    desired = Math.max(-0.45, Math.min(0.45, (roadCoord - car.y) * 0.005));
  } else {
    desired = Math.PI / 2 + Math.max(-0.45, Math.min(0.45, (roadCoord - car.x) * 0.005));
  }
  const diff = normalizeAngle(desired - car.angle);
  input.down.delete('KeyA');
  input.down.delete('KeyD');
  if (diff > 0.06) input.down.add('KeyD');
  else if (diff < -0.06) input.down.add('KeyA');
}

// Steer toward a point in the world (used for the mission scene).
function autopilotToward(g, tx, ty) {
  const input = g.input;
  const car = g.player.inCar;
  if (!car) return;
  input.down.add('KeyW');
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const diff = normalizeAngle(desired - car.angle);
  input.down.delete('KeyA');
  input.down.delete('KeyD');
  if (diff > 0.06) input.down.add('KeyD');
  else if (diff < -0.06) input.down.add('KeyA');
}

function placePlayerInCar(g, car, x, y, angle) {
  g.enterCar(car);
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  g.player.x = x;
  g.player.y = y;
  g.state.camera.x = x;
  g.state.camera.y = y;
}

function finish(g) {
  g.input.down.clear();
  g.state.frozen = true;
}

function sceneChase(g, rng) {
  const car = g.cars.find((c) => c.kind === 'parked') || g.cars[0];
  placePlayerInCar(g, car, 1000, 1000, 0);
  // Two cruisers already on the player's tail, wanted level 3.
  g.police.wanted = 3;
  g.police.lastCrimeAt = g.state.time;
  const spots = [
    { x: 1000 - 280, y: 1000 - 26 },
    { x: 1000 - 380, y: 1000 + 30 },
  ];
  for (const spot of spots) {
    const pc = createCar(spot.x, spot.y, 0, {
      model: CAR_MODELS[1],
      color: '#1a1a2e',
      kind: 'police',
      isPolice: true,
    });
    pc.speed = 320;
    g.police.cars.push(pc);
  }
  const steps = 300;
  for (let i = 0; i < steps; i++) {
    autopilotAlongRoad(g, 1000, 'ew');
    g.step(STEP);
  }
  finish(g);
}

function sceneStreet(g, rng) {
  // On foot in the middle of Downtown, walkers and traffic around.
  g.player.x = 1400;
  g.player.y = 1560;
  g.player.angle = -Math.PI / 2;
  g.state.camera.x = g.player.x;
  g.state.camera.y = g.player.y;
  // Pull a dozen pedestrians into the frame.
  let moved = 0;
  for (const ped of g.peds) {
    if (moved >= 12) break;
    ped.x = 1400 + rng.range(-280, 280);
    ped.y = 1560 + rng.range(-220, 220);
    ped.state = 'walk';
    moved++;
  }
  const steps = 150;
  for (let i = 0; i < steps; i++) {
    g.input.down.add('KeyW');
    g.step(STEP);
  }
  finish(g);
}

function sceneMission(g, rng) {
  const ctx = {
    cars: g.cars,
    player: g.player,
    police: g.police,
    world: g.world,
    addWanted: (n) => g.addWanted(n),
    showMessage: (t) => { g.state.hint = t; },
  };
  startMission(g.missions, 0, ctx);
  const car = g.cars.find((c) => c.kind === 'parked') || g.cars[0];
  // Westbound on the park road, closing on the pickup marker.
  placePlayerInCar(g, car, 1400, 600, Math.PI);
  const steps = 130;
  for (let i = 0; i < steps; i++) {
    autopilotToward(g, 600, 600);
    g.step(STEP);
  }
  finish(g);
}

function sceneDusk(g, rng) {
  // Evening: the clock reads after six, headlights are on.
  g.state.time = 170;
  g.state.dusk = true;
  const car = g.cars.find((c) => c.kind === 'parked') || g.cars[0];
  placePlayerInCar(g, car, 600, 1800, 0);
  // A shorter run than the chase: enough road to show the beams and
  // the dark city, before traffic piles up around the player.
  const steps = 200;
  for (let i = 0; i < steps; i++) {
    autopilotAlongRoad(g, 1800, 'ew');
    g.step(STEP);
  }
  finish(g);
}

const SCENES = {
  chase: sceneChase,
  street: sceneStreet,
  mission: sceneMission,
  dusk: sceneDusk,
};

export function setupShotScene(scene, seed, g) {
  const run = SCENES[scene];
  if (!run) return false;
  const rng = new RNG((seed >>> 0) * 7919 + 13);
  g.state.mode = 'playing';
  run(g, rng);
  return true;
}
