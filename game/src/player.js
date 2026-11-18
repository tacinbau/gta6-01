// The player on foot: walking, running, sprinting, facing, and the
// punch. Driving lives in vehicles.js; this file only owns the body
// that walks the sidewalks of Port Meridian.

import {
  PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, PLAYER_SPRINT_SPEED,
  PLAYER_RADIUS, PLAYER_MAX_HEALTH,
} from './config.js';
import { circleHitsBuilding, clampToWorld, inWater } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: PLAYER_RADIUS,
    health: PLAYER_MAX_HEALTH,
    cash: 250,
    speed: 0,
    moving: false,
    inCar: null,
    punchCooldown: 0,
    punchAnim: 0,
    stats: { carsStolen: 0, pedsHit: 0, crimes: 0, busts: 0, wasted: 0, distanceDriven: 0 },
  };
}

export function updatePlayerOnFoot(player, dt, input, world) {
  const axis = input.moveAxis();
  player.moving = axis.x !== 0 || axis.y !== 0;
  let speed = PLAYER_WALK_SPEED;
  if (input.sprint) speed = PLAYER_SPRINT_SPEED;
  else if (player.moving) speed = PLAYER_RUN_SPEED;
  player.speed = player.moving ? speed : 0;
  if (player.moving) player.angle = Math.atan2(axis.y, axis.x);

  const nx = player.x + axis.x * speed * dt;
  const ny = player.y + axis.y * speed * dt;
  // Move one axis at a time so the player slides along walls instead
  // of sticking on corners.
  if (!circleHitsBuilding(world, nx, player.y, player.radius) && !inWater(world, nx, player.y)) {
    player.x = nx;
  }
  if (!circleHitsBuilding(world, player.x, ny, player.radius) && !inWater(world, player.x, ny)) {
    player.y = ny;
  }
  const clamped = clampToWorld(player.x, player.y, player.radius + 4);
  player.x = clamped.x;
  player.y = clamped.y;

  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.punchAnim > 0) player.punchAnim -= dt;
}

export function playerPunch(player) {
  if (player.punchCooldown > 0) return false;
  player.punchCooldown = 0.45;
  player.punchAnim = 0.25;
  return true;
}

// The point a punch lands, a short reach in front of the player.
export function punchPoint(player) {
  return {
    x: player.x + Math.cos(player.angle) * 34,
    y: player.y + Math.sin(player.angle) * 34,
  };
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  return player.health <= 0;
}

export function healPlayer(player) {
  player.health = PLAYER_MAX_HEALTH;
}
