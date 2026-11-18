// Port Meridian — boot, game loop, camera, crime rules, particles,
// screen shake, bust/wasted flow and saving. This file wires the
// systems together; each system owns its own rules in its own file.

import { WORLD_SIZE, CITY_SEED, SAVE_KEY, BUST_FINE, HOSPITAL_SPAWN, PLAYER_MAX_HEALTH } from './config.js';
import { RNG } from './rng.js';
import { generateCity, districtAt, circleHitsBuilding } from './world.js';
import { Input } from './input.js';
import { createPlayer, updatePlayerOnFoot, playerPunch, punchPoint, damagePlayer, healPlayer } from './player.js';
import { createCar, spawnParkedCars, updatePlayerCar, resolveCarCollisions } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, knockPedDown, scarePedsNear } from './peds.js';
import { createPolice, addWanted, updateWanted, updatePolice, nearestPoliceDistance, checkBusted } from './police.js';
import { drawWorld, drawEntities, drawTitle, drawPause, drawBusted } from './render.js';
import { createMissions, startMission, updateMissions, failMission, nextMissionIndex } from './missions.js';
import { drawHud } from './hud.js';
import { AudioEngine } from './audio.js';
import { setupShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input();
const rng = new RNG(CITY_SEED);
const world = generateCity(CITY_SEED);

const player = createPlayer(HOSPITAL_SPAWN.x, HOSPITAL_SPAWN.y);
const parkedCars = spawnParkedCars(world, rng, 26);
const trafficCars = spawnTraffic(world, rng, 14);
const cars = [...parkedCars, ...trafficCars];
const peds = spawnPeds(world, rng, 36);
const police = createPolice();
const missions = createMissions();
const audio = new AudioEngine();

const state = {
  mode: 'title',
  time: 0,
  world,
  cars,
  peds,
  police,
  player,
  missions,
  audio,
  dusk: false,
  frozen: false,
  particles: [],
  skids: [],
  camera: { x: player.x, y: player.y },
  view: { w: 960, h: 600 },
  shake: 0,
  hint: 'Walk to a car and press E to get in.',
  district: 'Northside',
  endKind: null,
  endTimer: 0,
  saveTimer: 0,
  message: '',
  messageTimer: 0,
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.view.w = canvas.width;
  state.view.h = canvas.height;
}
window.addEventListener('resize', resize);
resize();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.cash === 'number') player.cash = data.cash;
    if (data.stats) Object.assign(player.stats, data.stats);
    if (Array.isArray(data.missionsCompleted) && data.missionsCompleted.length === missions.defs.length) {
      missions.completed = data.missionsCompleted.slice();
    }
    if (typeof data.health === 'number') player.health = Math.max(1, Math.min(PLAYER_MAX_HEALTH, data.health));
  } catch (err) {
    // A corrupt save must never stop the game from starting.
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(player.cash),
      health: Math.ceil(player.health),
      stats: player.stats,
      missionsCompleted: missions.completed,
    }));
  } catch (err) {
    // Storage may be unavailable; the game keeps running.
  }
}

function addParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * speed;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
      color, size: 2 + Math.random() * 3,
    });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

function addShake(amount) {
  state.shake = Math.min(18, state.shake + amount);
}

function showMessage(text) {
  state.message = text;
  state.messageTimer = 3;
  state.hint = text;
}

// The context object the mission system needs: world handles, the
// player, and the few actions a job is allowed to trigger.
function missionCtx() {
  return {
    cars,
    player,
    police,
    world,
    addWanted: (n) => addWanted(police, n, state.time),
    showMessage,
  };
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.isPolice) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  for (const car of police.cars) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  player.inCar = car;
  car.isPlayer = true;
  car.parked = false;
  player.x = car.x;
  player.y = car.y;
  if (car.kind === 'parked' || car.kind === 'traffic') {
    player.stats.carsStolen++;
    player.stats.crimes++;
    addWanted(police, 1, state.time);
    showMessage('Car stolen — the police are on their way.');
  } else if (car.isPolice) {
    player.stats.carsStolen++;
    player.stats.crimes++;
    addWanted(police, 2, state.time);
    showMessage('You stole a police car. That was bold.');
  }
  state.hint = 'W/S drive, A/D steer, E to get out.';
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  car.isPlayer = false;
  car.speed = 0;
  car.parked = true;
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  player.x = side.x;
  player.y = side.y;
  player.inCar = null;
  player.angle = car.angle;
  state.hint = 'Walk to a car and press E to get in.';
}

function respawnAtHospital(kind) {
  const fine = Math.min(player.cash, BUST_FINE);
  player.cash -= fine;
  player.stats[kind === 'busted' ? 'busts' : 'wasted']++;
  healPlayer(player);
  if (missions.active) {
    failMission(missions, missionCtx(), kind === 'busted' ? 'Busted — the job is blown.' : 'Wasted — the job is blown.');
    showMessage('Job failed. Press J to try again.');
  }
  police.wanted = 0;
  police.cars = [];
  police.officers = [];
  police.bustTimer = 0;
  if (player.inCar) {
    player.inCar.isPlayer = false;
    player.inCar.speed = 0;
    player.inCar = null;
  }
  player.x = HOSPITAL_SPAWN.x;
  player.y = HOSPITAL_SPAWN.y;
  state.camera.x = player.x;
  state.camera.y = player.y;
  saveGame();
}

function update(dt) {
  // Frozen scenes (screenshots) render but never simulate.
  if (state.frozen) return;
  state.time += dt;

  if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
    if (state.mode === 'playing') state.mode = 'paused';
    else if (state.mode === 'paused') state.mode = 'playing';
  }
  if (state.mode !== 'playing') return;

  // Take a job from Mara Voss. J starts the next unfinished job, or
  // replays the first one once all five are done.
  if (input.wasPressed('KeyJ')) {
    if (missions.active) {
      showMessage('Finish the current job first — ' + missions.active.def.name + ' is still open.');
    } else {
      const next = nextMissionIndex(missions);
      if (!startMission(missions, next, missionCtx())) {
        showMessage('No job available right now.');
      }
    }
  }

  // Missions: timers, waypoints, evade and chase rules.
  const missionEvents = updateMissions(missions, dt, missionCtx());
  for (const ev of missionEvents) {
    if (ev.type === 'complete') {
      audio.jingle();
      showMessage(ev.name + ' complete — $' + ev.reward + ' from Mara Voss.');
      saveGame();
    } else if (ev.type === 'fail') {
      audio.fail();
      showMessage(ev.name + ' failed: ' + ev.reason + ' Press J to retry.');
    } else if (ev.type === 'stage') {
      audio.blip();
    }
  }
  if (missions.storyTimer > 0) missions.storyTimer -= dt;

  // Dusk: the clock starts at 17:00 and one real second is one game
  // minute, so the city darkens and headlights come on after 18:00.
  const clockMinutes = 17 * 60 + Math.floor(state.time / 2);
  const clockHour = Math.floor(clockMinutes / 60) % 24;
  state.dusk = clockHour >= 18 || clockHour < 6;
  for (const car of cars) car.headlight = state.dusk;
  for (const car of police.cars) car.headlight = state.dusk;

  // --- Player ---
  if (player.inCar) {
    const car = player.inCar;
    const events = updatePlayerCar(car, dt, input, world, cars);
    for (const ev of events) {
      if (ev.type === 'crash') {
        addParticles(ev.x, ev.y, '#f39c12', 14, 180);
        addParticles(ev.x, ev.y, '#888888', 8, 90);
        addShake(Math.min(12, ev.speed / 40));
        audio.thud(ev.speed);
        if (ev.speed > 260) damagePlayer(player, Math.round((ev.speed - 260) / 22));
      } else if (ev.type === 'skid') {
        state.skids.push({ x: ev.x, y: ev.y, angle: ev.angle, life: 6 });
      }
    }
    player.x = car.x;
    player.y = car.y;
    player.stats.distanceDriven += Math.abs(car.speed) * dt;
    if (input.wasPressed('KeyE')) exitCar();
    // Running over pedestrians.
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 24 && Math.abs(car.speed) > 70) {
        knockPedDown(ped);
        player.stats.pedsHit++;
        player.stats.crimes++;
        addWanted(police, 1, state.time);
        addParticles(ped.x, ped.y, '#e74c3c', 10, 140);
        addShake(6);
        scarePedsNear(peds, ped.x, ped.y, 180);
        showMessage('You hit a pedestrian. The city saw that.');
      }
    }
  } else {
    updatePlayerOnFoot(player, dt, input, world);
    if (input.wasPressed('KeyE')) {
      const car = nearestCar(56);
      if (car) enterCar(car);
    }
    if (input.wasPressed('Space')) {
      if (playerPunch(player)) {
        const point = punchPoint(player);
        let hitSomeone = false;
        for (const ped of peds) {
          if (ped.state === 'down') continue;
          if (Math.hypot(ped.x - point.x, ped.y - point.y) < 26) {
            knockPedDown(ped);
            scarePedsNear(peds, ped.x, ped.y, 160);
            player.stats.crimes++;
            addWanted(police, 1, state.time);
            addParticles(point.x, point.y, '#ffffff', 6, 120);
            showMessage('You punched a pedestrian. Wanted level up.');
            hitSomeone = true;
            break;
          }
        }
        if (!hitSomeone) {
          for (const off of police.officers) {
            if (Math.hypot(off.x - point.x, off.y - point.y) < 28) {
              addWanted(police, 1, state.time);
              showMessage('You swung at an officer. Bad idea.');
              break;
            }
          }
        }
      }
    }
  }

  // --- Traffic, pedestrians, police ---
  updateTraffic(trafficCars, dt, world, state.time, cars);
  const danger = { active: false, x: player.x, y: player.y, radius: 90 };
  if (player.inCar && Math.abs(player.inCar.speed) > 200) {
    danger.active = true;
    danger.x = player.inCar.x;
    danger.y = player.inCar.y;
    danger.radius = 130;
  }
  updatePeds(peds, dt, world, danger, rng);

  const allCars = [...cars, ...police.cars];
  const crashEvents = resolveCarCollisions(allCars);
  for (const ev of crashEvents) {
    addParticles(ev.x, ev.y, '#f39c12', 12, 160);
    addShake(Math.min(10, ev.speed / 50));
    if (ev.a.isPlayer || ev.b.isPlayer) audio.thud(ev.speed);
    if (ev.a.isPlayer || ev.b.isPlayer) {
      const other = ev.a.isPlayer ? ev.b : ev.a;
      if (other.isPolice && ev.speed > 150) {
        // A ram is a crime too: the stat has to move with the stars.
        player.stats.crimes++;
        addWanted(police, 1, state.time);
        showMessage('You rammed a police car.');
      }
      if (ev.speed > 320) damagePlayer(player, Math.round((ev.speed - 320) / 30));
    }
    if (ev.a.isPolice || ev.b.isPolice) {
      // A police car shoved hard loses a little pursuit grip.
      const pc = ev.a.isPolice ? ev.a : ev.b;
      pc.speed *= 0.7;
    }
  }

  const playerPos = player.inCar || player;
  const nearPolice = nearestPoliceDistance(police, playerPos);
  updateWanted(police, dt, state.time, playerPos, nearPolice);
  updatePolice(police, dt, state.time, world, player, player.inCar);

  // Officers landing hits on foot.
  if (!player.inCar) {
    for (const off of police.officers) {
      if (Math.hypot(off.x - player.x, off.y - player.y) < 26 && off.punchCooldown <= 0) {
        off.punchCooldown = 0.9;
        damagePlayer(player, 8);
        addShake(4);
      }
    }
  }

  const busted = checkBusted(police, dt, player, player.inCar);
  if (busted) {
    state.mode = 'ended';
    state.endKind = 'busted';
    state.endTimer = 0;
    respawnAtHospital('busted');
    return;
  }
  if (player.health <= 0) {
    state.mode = 'ended';
    state.endKind = 'wasted';
    state.endTimer = 0;
    respawnAtHospital('wasted');
    return;
  }

  // Sound follows the car and the heat, every frame.
  audio.setEngine(player.inCar ? player.inCar.speed : 0, !!player.inCar);
  audio.setSiren(police.wanted, nearestPoliceDistance(police, playerPos));

  // --- Camera, particles, decay ---
  const targetX = player.x;
  const targetY = player.y;
  state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
  state.camera.x = Math.max(state.view.w / 2 - 100, Math.min(WORLD_SIZE - state.view.w / 2 + 100, state.camera.x));
  state.camera.y = Math.max(state.view.h / 2 - 100, Math.min(WORLD_SIZE - state.view.h / 2 + 100, state.camera.y));

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  if (state.skids.length > 500) state.skids.splice(0, state.skids.length - 500);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.hint = player.inCar ? 'W/S drive, A/D steer, E to get out.' : 'Walk to a car and press E to get in.';
  }
  state.district = districtAt(player.x, player.y) === 'downtown' ? 'Downtown'
    : districtAt(player.x, player.y) === 'harbour' ? 'Harbour'
    : districtAt(player.x, player.y) === 'northside' ? 'Northside'
    : districtAt(player.x, player.y) === 'oldtown' ? 'Old Town' : 'Palm Gardens';

  state.saveTimer += dt;
  if (state.saveTimer > 5) {
    state.saveTimer = 0;
    saveGame();
  }
}

function render() {
  ctx.clearRect(0, 0, state.view.w, state.view.h);
  if (state.mode === 'title') {
    drawTitle(ctx, state.view);
    return;
  }
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  ctx.translate(state.view.w / 2 - state.camera.x, state.view.h / 2 - state.camera.y);
  drawWorld(ctx, state);
  drawEntities(ctx, state);
  ctx.restore();
  // Dusk falls over the city after 18:00: a cool dark wash, with the
  // headlight beams (drawn in world space) still cutting through it.
  if (state.dusk) {
    ctx.fillStyle = 'rgba(12,10,48,0.30)';
    ctx.fillRect(0, 0, state.view.w, state.view.h);
  }
  drawHud(ctx, state, state.view);
  if (state.mode === 'paused') drawPause(ctx, state.view);
  if (state.mode === 'ended') drawBusted(ctx, state.view, state.endKind);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // M mutes and unmutes from anywhere, title screen included.
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    showMessage(muted ? 'Sound muted (M to unmute).' : 'Sound on.');
  }
  if (state.mode === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      state.mode = 'playing';
      audio.start();
    }
  } else if (state.mode === 'ended') {
    if (input.wasPressed('Enter')) state.mode = 'playing';
  }
  update(dt);
  render();
  input.endFrame();
  requestAnimationFrame(loop);
}

canvas.addEventListener('click', () => {
  if (state.mode === 'title' || state.mode === 'ended') {
    state.mode = 'playing';
    audio.start();
  }
});

// Screenshot hooks: ?shot=<scene>&seed=<n> stages a deterministic
// scene (chase, street, mission, dusk) and freezes it for capture.
// The session-one hooks still work: ?shot=play drops into a car,
// ?shot=end shows the busted screen.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const shotSeed = Number(params.get('seed') || 1);
if (shot === 'play') {
  state.mode = 'playing';
  const car = cars[0];
  if (car) enterCar(car);
} else if (shot === 'end') {
  state.mode = 'ended';
  state.endKind = 'busted';
} else if (shot) {
  setupShotScene(shot, shotSeed, {
    state,
    player,
    cars,
    peds,
    police,
    world,
    input,
    missions,
    enterCar,
    addWanted: (n) => addWanted(police, n, state.time),
    step: (dt) => update(dt),
  });
}

loadSave();

// Test hook: the verification script reads live state through this.
window.__game = {
  state,
  player,
  cars,
  peds,
  police,
  world,
  missions,
  audio,
  enterCar,
  exitCar,
  addWanted: (n) => addWanted(police, n, state.time),
  startMission: (i) => startMission(missions, i, missionCtx()),
  start: () => { state.mode = 'playing'; audio.start(); },
};

requestAnimationFrame(loop);
