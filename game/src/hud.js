// HUD: wanted stars, cash, health, clock, speed, the mission
// objective banner, the guiding arrow and a live minimap. Everything
// here is drawn on the main canvas in screen space, once per frame,
// from the live state — the minimap is a fresh draw each frame, so it
// never goes stale.

import { WORLD_SIZE } from './config.js';
import { missionTarget, objectiveText, nextMissionIndex } from './missions.js';

const MINIMAP_SIZE = 190;

function clockText(time) {
  // The day starts at 17:00; one real second is one game minute, so
  // the city slides toward dusk as a session goes on.
  const totalMinutes = 17 * 60 + Math.floor(time / 2);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawMinimap(ctx, state, x, y, size) {
  const { world, player, police, missions } = state;
  const scale = size / WORLD_SIZE;
  panel(ctx, x, y, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Ground, park, water.
  ctx.fillStyle = '#5a6b45';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#4e9b47';
  ctx.fillRect(x + world.park.x * scale, y + world.park.y * scale, world.park.w * scale, world.park.h * scale);
  ctx.fillStyle = '#1e6f9f';
  ctx.fillRect(x + world.water.x * scale, y, world.water.w * scale, size);
  // Roads.
  ctx.strokeStyle = '#3a3f44';
  ctx.lineWidth = Math.max(2, 64 * scale);
  for (const c of world.roads) {
    ctx.beginPath();
    ctx.moveTo(x + c * scale, y);
    ctx.lineTo(x + c * scale, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + c * scale);
    ctx.lineTo(x + size, y + c * scale);
    ctx.stroke();
  }
  // Mission marker: a pulsing yellow diamond.
  const target = missionTarget(missions);
  if (target) {
    const pulse = 3 + Math.sin(performance.now() / 180) * 1.5;
    const tx = x + target.x * scale;
    const ty = y + target.y * scale;
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 5 - pulse);
    ctx.lineTo(tx + 5 + pulse, ty);
    ctx.lineTo(tx, ty + 5 + pulse);
    ctx.lineTo(tx - 5 - pulse, ty);
    ctx.closePath();
    ctx.fill();
  }
  // Target car for the chase job.
  if (missions.active && missions.active.targetCar) {
    const car = missions.active.targetCar;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#ff3b30';
  for (const car of police.cars) {
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const off of police.officers) {
    ctx.beginPath();
    ctx.arc(x + off.x * scale, y + off.y * scale, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow, rotated to face the direction of travel.
  const px = x + player.x * scale;
  const py = y + player.y * scale;
  const angle = player.inCar ? player.inCar.angle : player.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Viewport outline, so the player can tell how much city is on screen.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x + (state.camera.x - state.view.w / 2) * scale,
    y + (state.camera.y - state.view.h / 2) * scale,
    state.view.w * scale,
    state.view.h * scale,
  );
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 3;
  ctx.fillText('PORT MERIDIAN', x + 5, y + 4);
  ctx.shadowBlur = 0;
}

function drawGuidingArrow(ctx, state, view) {
  const target = missionTarget(state.missions);
  if (!target) return;
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 90) return;
  const angle = Math.atan2(dy, dx);
  // Clamp the arrow to a ring around the screen centre so it stays
  // visible even when the target is far off-screen.
  const cx = view.w / 2;
  const cy = view.h / 2;
  const rx = Math.min(cx - 70, Math.abs(Math.cos(angle)) * cx * 0.9 + 40);
  const ry = Math.min(cy - 70, Math.abs(Math.sin(angle)) * cy * 0.9 + 40);
  const ax = cx + Math.cos(angle) * rx;
  const ay = cy + Math.sin(angle) * ry;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#f5c518';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f5c518';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  const meters = Math.round(dist / 10);
  // Keep the label on screen even when the arrow sits on an edge.
  const labelX = Math.max(120, Math.min(view.w - 120, ax));
  const labelY = Math.min(view.h - 44, ay + 20);
  ctx.fillText(meters + 'm  —  ' + target.label, labelX, labelY);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

export function drawHud(ctx, state, view) {
  const { player, police, missions, audio } = state;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;

  // Wanted stars.
  const stars = Math.round(police.wanted);
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd700' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', 16 + i * 30, 12);
  }
  // Cash.
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#2ecc71';
  ctx.fillText('$' + Math.floor(player.cash), 16, 46);
  // Health bar.
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(16, 76, 180, 16);
  ctx.fillStyle = player.health > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(18, 78, 176 * Math.max(0, player.health / 100), 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HEALTH ' + Math.ceil(player.health), 20, 79);
  ctx.shadowBlur = 4;

  // District + clock, top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state.district || '', view.w - 16, 14);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(clockText(state.time) + '  ·  Port Meridian', view.w - 16, 38);
  if (audio && audio.muted) {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('MUTED (M)', view.w - 16, 60);
  }

  // Mission objective banner, top centre.
  if (missions.active) {
    const active = missions.active;
    const label = active.def.name + ' — ' + objectiveText(missions);
    const timer = Math.max(0, Math.ceil(active.timer));
    const timerText = Math.floor(timer / 60) + ':' + String(timer % 60).padStart(2, '0');
    const text = label + '   ⏱ ' + timerText + '   ·   $' + active.def.reward;
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(text).width;
    const bx = (view.w - tw) / 2 - 14;
    panel(ctx, bx, 10, tw + 28, 30);
    ctx.fillStyle = '#f5c518';
    ctx.textAlign = 'center';
    ctx.fillText(text, view.w / 2, 17);
    ctx.textAlign = 'left';
  } else {
    // No job running: nudge the player toward the next one, tucked
    // under the health bar on the left so it never collides with the
    // district and clock on the right.
    const next = missions.defs[nextMissionIndex(missions)];
    const done = missions.completed.filter(Boolean).length;
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('J — job from Mara Voss: "' + next.name + '"  (' + done + '/5 done)', 16, 100);
  }

  // Story panel while a job briefing is fresh.
  if (missions.storyTimer > 0 && missions.story) {
    ctx.font = '15px sans-serif';
    const maxW = Math.min(view.w - 120, 760);
    const words = missions.story.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const boxH = lines.length * 20 + 18;
    const boxW = maxW + 28;
    panel(ctx, (view.w - boxW) / 2, 52, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, view.w / 2, 60 + i * 20));
    ctx.textAlign = 'left';
  }

  // Guiding arrow toward the mission target.
  drawGuidingArrow(ctx, state, view);

  // Speed, hint and minimap.
  const speed = player.inCar ? Math.round(Math.abs(player.inCar.speed) * 0.18) : 0;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffffff';
  if (player.inCar) ctx.fillText(speed + ' km/h  —  ' + player.inCar.model.name, 16, view.h - 96);
  ctx.fillText(state.hint || '', 16, view.h - 70);

  drawMinimap(ctx, state, view.w - MINIMAP_SIZE - 16, view.h - MINIMAP_SIZE - 16, MINIMAP_SIZE);
  ctx.restore();
}
