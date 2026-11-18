// Missions: a five-job story arc handed out by Mara Voss, a fixer who
// runs Port Meridian from a booth in the back of a Downtown diner.
// Jobs unlock in order, pay cash on completion, can fail and be
// retried, and can be replayed once finished. The main loop owns the
// frame; this file owns the job state machine and nothing else.

import { createCar } from './vehicles.js';
import { CAR_MODELS } from './config.js';
import { circleHitsBuilding, inWater } from './world.js';
import { nearestPoliceDistance } from './police.js';

// Road intersections used as job waypoints. Roads run at 200, 600,
// 1000, 1400, 1800, 2200, 2600 and 3000, so every point below sits on
// asphalt the player can actually drive to.
const MISSION_DEFS = [
  {
    name: 'First Run',
    reward: 300,
    timeLimit: 110,
    story: 'Mara Voss: "New face. Simple job — pick up the case at the park corner and get it across town. Don\'t keep the buyer waiting."',
    briefing: 'Pick up the package, then deliver it across town.',
    stages: [
      { kind: 'goto', x: 600, y: 600, label: 'Pick up the package' },
      { kind: 'goto', x: 2600, y: 2600, label: 'Deliver the package to the buyer' },
    ],
  },
  {
    name: 'Hot Package',
    reward: 450,
    timeLimit: 120,
    story: 'Mara Voss: "That last run put eyes on you. The next package is already warm — grab it while the heat is on and don\'t stop moving."',
    briefing: 'Grab the package while wanted, then deliver it.',
    startWanted: 2,
    stages: [
      { kind: 'goto', x: 1400, y: 2200, label: 'Pick up the hot package' },
      { kind: 'goto', x: 600, y: 2600, label: 'Deliver it to the drop house' },
    ],
  },
  {
    name: 'Shake the Tail',
    reward: 600,
    timeLimit: 130,
    story: 'Mara Voss: "Three stars and every cruiser in the city knows your plate. Lose them. Stay out of sight until the radio goes quiet."',
    briefing: 'Lose the 3-star tail — stay far from every police car.',
    startWanted: 3,
    evadeNeed: 10,
    stages: [
      { kind: 'evade', label: 'Stay out of sight of the police' },
    ],
  },
  {
    name: 'The Runner',
    reward: 800,
    timeLimit: 100,
    story: 'Mara Voss: "A courier skimmed my cut and he\'s running. He\'s fast and he knows the streets. Catch his car and take back what\'s mine."',
    briefing: 'Chase down the runner\'s car and hold on to it.',
    stages: [
      { kind: 'chase', label: 'Catch the runner\'s car' },
    ],
  },
  {
    name: 'The Meridian Job',
    reward: 1500,
    timeLimit: 160,
    story: 'Mara Voss: "This is the big one. The vault under Meridian Tower, then the pier — a boat is waiting. Every cop in the city will be coming. Make it count."',
    briefing: 'Hit the vault, then escape to the pier.',
    stages: [
      { kind: 'goto', x: 2200, y: 1800, label: 'Grab the cash at the Meridian vault' },
      { kind: 'goto', x: 2900, y: 1445, label: 'Escape to the pier — boat is waiting' },
    ],
    escapeWanted: 4,
  },
];

export function createMissions(savedCompleted) {
  return {
    defs: MISSION_DEFS,
    completed: Array.isArray(savedCompleted) && savedCompleted.length === MISSION_DEFS.length
      ? savedCompleted.slice()
      : MISSION_DEFS.map(() => false),
    active: null,
    story: '',
    storyTimer: 0,
  };
}

export function nextMissionIndex(missions) {
  for (let i = 0; i < missions.defs.length; i++) {
    if (!missions.completed[i]) return i;
  }
  return 0;
}

export function canStart(missions, index) {
  if (index < 0 || index >= missions.defs.length) return false;
  if (missions.active) return false;
  return index === 0 || missions.completed[index - 1];
}

export function startMission(missions, index, ctx) {
  if (!canStart(missions, index)) return false;
  const def = missions.defs[index];
  const active = {
    index,
    def,
    stageIndex: 0,
    timer: def.timeLimit,
    evade: 0,
    catchTimer: 0,
    targetCar: null,
  };
  missions.active = active;
  missions.story = def.story;
  missions.storyTimer = 7;
  if (def.startWanted) ctx.addWanted(def.startWanted);
  if (index === 3) {
    // The runner: a fast gold coupe that flees from the player.
    const car = createCar(1800, 1000, 0, {
      model: CAR_MODELS[1],
      color: '#f1c40f',
      kind: 'target',
    });
    car.speed = 300;
    car.isTarget = true;
    ctx.cars.push(car);
    active.targetCar = car;
  }
  ctx.showMessage(def.name + ' — ' + def.briefing);
  return true;
}

function endMission(missions, ctx, won, reason) {
  const active = missions.active;
  if (!active) return null;
  if (active.targetCar) {
    const car = active.targetCar;
    car.isTarget = false;
    if (ctx.player.inCar !== car) {
      const at = ctx.cars.indexOf(car);
      if (at !== -1) ctx.cars.splice(at, 1);
    }
  }
  missions.active = null;
  if (won) {
    missions.completed[active.index] = true;
    ctx.player.cash += active.def.reward;
    ctx.player.stats.missionsCompleted = (ctx.player.stats.missionsCompleted || 0) + 1;
    return { type: 'complete', index: active.index, name: active.def.name, reward: active.def.reward };
  }
  return { type: 'fail', index: active.index, name: active.def.name, reason };
}

export function failMission(missions, ctx, reason) {
  if (!missions.active) return null;
  return endMission(missions, ctx, false, reason || 'Job failed.');
}

export function missionTarget(missions) {
  const active = missions.active;
  if (!active) return null;
  const stage = active.def.stages[active.stageIndex];
  if (!stage) return null;
  if (stage.kind === 'chase' && active.targetCar) {
    return { x: active.targetCar.x, y: active.targetCar.y, label: stage.label, moving: true };
  }
  if (stage.kind === 'goto') return { x: stage.x, y: stage.y, label: stage.label, moving: false };
  return null;
}

export function objectiveText(missions) {
  const active = missions.active;
  if (!active) return '';
  const stage = active.def.stages[active.stageIndex];
  if (!stage) return '';
  if (stage.kind === 'evade') {
    const need = active.def.evadeNeed || 10;
    return stage.label + '  (' + Math.max(0, need - Math.floor(active.evade)) + 's to go)';
  }
  return stage.label;
}

function updateTargetCar(active, dt, ctx) {
  const car = active.targetCar;
  if (!car) return;
  const px = ctx.player.x;
  const py = ctx.player.y;
  const distToPlayer = Math.hypot(car.x - px, car.y - py);
  // Flee: point away from the player and drive hard — but once the
  // player is right on the bumper the runner is boxed in and has to
  // weave slowly, which is what makes the catch possible at all.
  const away = Math.atan2(car.y - py, car.x - px);
  let diff = away - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
  const top = distToPlayer < 140 ? 220 : 380;
  if (car.speed < top) car.speed += 300 * dt;
  else if (car.speed > top) car.speed -= 320 * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!circleHitsBuilding(ctx.world, nx, ny, 22) && !inWater(ctx.world, nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Blocked: swing around and try another line.
    car.angle += 1.15;
    car.speed *= 0.7;
  }
  if (car.x < 180 || car.x > 3040 || car.y < 180 || car.y > 3180) car.angle += Math.PI;
}

// Advance the active job one step. Returns a list of events the main
// loop turns into messages and sounds: complete, fail, stage.
export function updateMissions(missions, dt, ctx) {
  const events = [];
  const active = missions.active;
  if (!active) return events;
  active.timer -= dt;
  if (active.timer <= 0) {
    events.push(endMission(missions, ctx, false, 'Out of time.'));
    return events;
  }
  const stage = active.def.stages[active.stageIndex];
  const px = ctx.player.x;
  const py = ctx.player.y;

  if (stage.kind === 'goto') {
    // 80 units: wide enough that a car at speed can actually clip
    // the waypoint instead of overshooting it lap after lap.
    const d = Math.hypot(stage.x - px, stage.y - py);
    if (d < 80) {
      active.stageIndex++;
      if (active.stageIndex >= active.def.stages.length) {
        events.push(endMission(missions, ctx, true));
        return events;
      }
      // The final job turns the heat all the way up on the escape leg.
      if (active.def.escapeWanted && active.stageIndex === 1) {
        ctx.addWanted(active.def.escapeWanted);
        ctx.showMessage('The alarm is up — every cruiser is coming. Run!');
      } else {
        ctx.showMessage(active.def.stages[active.stageIndex].label);
      }
      events.push({ type: 'stage', index: active.index, stage: active.stageIndex });
    }
  } else if (stage.kind === 'evade') {
    const near = nearestPoliceDistance(ctx.police, { x: px, y: py });
    if (near > 480 || ctx.police.wanted < 1) {
      active.evade += dt;
    } else {
      active.evade = Math.max(0, active.evade - dt * 2);
    }
    if (active.evade >= (active.def.evadeNeed || 10)) {
      events.push(endMission(missions, ctx, true));
      return events;
    }
  } else if (stage.kind === 'chase') {
    updateTargetCar(active, dt, ctx);
    const car = active.targetCar;
    if (car) {
      const d = Math.hypot(car.x - px, car.y - py);
      if (d < 56) {
        active.catchTimer += dt;
        if (active.catchTimer >= 0.9) {
          events.push(endMission(missions, ctx, true));
          return events;
        }
      } else {
        active.catchTimer = Math.max(0, active.catchTimer - dt);
      }
    }
  }
  return events;
}
