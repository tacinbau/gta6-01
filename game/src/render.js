// Canvas drawing: the city, the cars, the people, the particles and
// the HUD. Everything is drawn from the live state each frame — there
// are no pre-rendered images, so the view always matches the simulation.

import { ROAD_WIDTH, WORLD_SIZE } from './config.js';
import { lightPhase } from './world.js';
import { missionTarget } from './missions.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.model.length;
  const wid = car.model.width;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 6);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Cabin / windows.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -len * 0.18, -wid / 2 + 3, len * 0.36, wid - 6, 4);
  ctx.fill();
  // Windshield strip.
  ctx.fillStyle = 'rgba(180,220,240,0.55)';
  ctx.fillRect(len * 0.18, -wid / 2 + 4, 3, wid - 8);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 2, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 2, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2222' : '#aa2222';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 2, 5);
  ctx.fillRect(-len / 2, wid / 2 - 7, 2, 5);
  // Headlights: a pale beam ahead of the car after dark.
  if (car.headlight) {
    ctx.fillStyle = 'rgba(255,244,180,0.30)';
    ctx.beginPath();
    ctx.moveTo(len / 2, -8);
    ctx.lineTo(len / 2 + 150, -34);
    ctx.lineTo(len / 2 + 150, 34);
    ctx.lineTo(len / 2, 8);
    ctx.closePath();
    ctx.fill();
  }
  if (car.isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-len * 0.28, -wid / 2 + 2, len * 0.56, 4);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const blink = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = blink ? '#ff0000' : '#2244ff';
    ctx.beginPath();
    ctx.arc(-6, -wid / 2 + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2244ff' : '#ff0000';
    ctx.beginPath();
    ctx.arc(6, -wid / 2 + 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.model.name === 'Taxi') {
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -wid / 2 - 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, skin, down, isOfficer) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.fillRect(-11, -4, 22, 8);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(13, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  if (isOfficer) {
    ctx.fillStyle = '#0b1e5b';
    ctx.fillRect(-8, -3, 16, 6);
  }
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Facing nub.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(8, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, state) {
  const { world, camera, time, view } = state;
  const x0 = camera.x - view.w / 2 - 80;
  const y0 = camera.y - view.h / 2 - 80;
  const x1 = camera.x + view.w / 2 + 80;
  const y1 = camera.y + view.h / 2 + 80;

  // Ground.
  ctx.fillStyle = '#7a8a5a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Sidewalk blocks (pavement between roads).
  ctx.fillStyle = '#b9b3a4';
  for (let i = 0; i < world.roads.length - 1; i++) {
    for (let j = 0; j < world.roads.length - 1; j++) {
      const bx = world.roads[i] + ROAD_WIDTH / 2;
      const by = world.roads[j] + ROAD_WIDTH / 2;
      const bw = ROAD_WIDTH * 0 + (world.roads[i + 1] - world.roads[i] - ROAD_WIDTH);
      const bh = world.roads[j + 1] - world.roads[j] - ROAD_WIDTH;
      if (bx + bw < x0 || bx > x1 || by + bh < y0 || by > y1) continue;
      ctx.fillRect(bx, by, bw, bh);
    }
  }
  // Park.
  ctx.fillStyle = '#4e9b47';
  ctx.fillRect(world.park.x, world.park.y, world.park.w, world.park.h);
  ctx.fillStyle = '#8bc34a';
  ctx.fillRect(world.park.x + 20, world.park.y + 20, world.park.w - 40, world.park.h - 40);
  ctx.fillStyle = '#d7ccc8';
  ctx.fillRect(world.park.x + world.park.w / 2 - 6, world.park.y, 12, world.park.h);
  // Water and pier.
  ctx.fillStyle = '#1e6f9f';
  ctx.fillRect(world.water.x, 0, world.water.w, world.size);
  ctx.fillStyle = '#2a9d8f';
  for (let y = 0; y < world.size; y += 90) {
    ctx.fillRect(world.water.x + 20, y, 90, 4);
  }
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(world.pier.x, world.pier.y, world.pier.w, world.pier.h);
  ctx.fillStyle = '#6d4c41';
  for (let x = world.pier.x; x < world.pier.x + world.pier.w; x += 18) {
    ctx.fillRect(x, world.pier.y, 2, world.pier.h);
  }
  for (const boat of world.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = '#f5f5f5';
    roundRect(ctx, -boat.w / 2, -boat.h / 2, boat.w, boat.h, 4);
    ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-boat.w / 2 + 4, -boat.h / 2 + 2, 8, boat.h - 4);
    ctx.restore();
  }
  // Trees.
  for (const t of world.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads.
  ctx.fillStyle = '#3a3f44';
  for (const c of world.roads) {
    ctx.fillRect(c - ROAD_WIDTH / 2, 0, ROAD_WIDTH, world.size);
    ctx.fillRect(0, c - ROAD_WIDTH / 2, world.size, ROAD_WIDTH);
  }
  // Centre dashes.
  ctx.fillStyle = '#f7d54d';
  for (const c of world.roads) {
    for (let v = 0; v < world.size; v += 44) {
      ctx.fillRect(c - 2, v, 4, 22);
      ctx.fillRect(v, c - 2, 22, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const inter of world.intersections) {
    if (inter.x < x0 || inter.x > x1 || inter.y < y0 || inter.y > y1) continue;
    for (let k = -3; k <= 3; k++) {
      ctx.fillRect(inter.x + k * 9 - 3, inter.y - ROAD_WIDTH / 2 - 8, 6, 10);
      ctx.fillRect(inter.x + k * 9 - 3, inter.y + ROAD_WIDTH / 2 - 2, 6, 10);
    }
  }
  // Buildings with drop shadows and rooftop detail.
  for (const b of world.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const lift = b.height * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop windows / units.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        ctx.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 12, 10);
      }
    }
    if (b.height >= 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h / 2 - 10, 20, 20);
    }
  }
  // Traffic lights.
  for (const inter of world.intersections) {
    if (inter.x < x0 || inter.x > x1 || inter.y < y0 || inter.y > y1) continue;
    const phase = lightPhase(inter, time);
    const nsGreen = phase === 'ns';
    const ewGreen = phase === 'ew';
    ctx.fillStyle = '#222222';
    ctx.fillRect(inter.x + ROAD_WIDTH / 2 - 2, inter.y - ROAD_WIDTH / 2 - 14, 5, 16);
    ctx.fillStyle = nsGreen ? '#2ecc71' : phase === 'ns-yellow' ? '#f1c40f' : '#e74c3c';
    ctx.beginPath();
    ctx.arc(inter.x + ROAD_WIDTH / 2, inter.y - ROAD_WIDTH / 2 - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.fillRect(inter.x - ROAD_WIDTH / 2 - 14, inter.y + ROAD_WIDTH / 2 - 2, 16, 5);
    ctx.fillStyle = ewGreen ? '#2ecc71' : phase === 'ew-yellow' ? '#f1c40f' : '#e74c3c';
    ctx.beginPath();
    ctx.arc(inter.x - ROAD_WIDTH / 2 - 12, inter.y + ROAD_WIDTH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.45)';
  ctx.lineWidth = 4;
  for (const s of state.skids) {
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }
}

export function drawEntities(ctx, state) {
  const { cars, peds, police, player } = state;
  // Mission marker: a pulsing diamond and ring over the target point.
  const target = state.missions ? missionTarget(state.missions) : null;
  if (target) {
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.12;
    ctx.save();
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 16);
    ctx.lineTo(target.x + 11, target.y);
    ctx.lineTo(target.x, target.y + 16);
    ctx.lineTo(target.x - 11, target.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const car of cars) {
    drawCarShape(ctx, car);
    // The runner's car gets a gold ring so the chase reads at a glance.
    if (car.isTarget) {
      ctx.save();
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  for (const car of police.cars) drawCarShape(ctx, car);
  for (const ped of peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.skin, ped.state === 'down', false);
  }
  for (const off of police.officers) {
    drawPerson(ctx, off.x, off.y, off.angle, '#1a2a6c', '#e0ac69', false, true);
  }
  if (!player.inCar) {
    drawPerson(ctx, player.x, player.y, player.angle, '#ff4757', '#f1c27d', false, false);
    if (player.punchAnim > 0) {
      ctx.save();
      ctx.translate(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // Particles.
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawTitle(ctx, view) {
  ctx.fillStyle = '#0b1026';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PORT MERIDIAN', view.w / 2, view.h / 2 - 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText('An open-world street story — drive, steal, run, survive.', view.w / 2, view.h / 2 - 70);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#c0c8d8';
  const lines = [
    'WASD / Arrows — walk and drive    Shift — sprint',
    'E — enter / exit a car    Space — punch',
    'J — take a job from Mara Voss    M — mute sound    Esc / P — pause',
    'Stealing cars and hitting people raises your wanted level.',
    'Outrun the police, or get busted and pay the fine at the hospital.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, view.w / 2, view.h / 2 - 20 + i * 28));
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Click or press Enter to start', view.w / 2, view.h / 2 + 130);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText('An original game. Not affiliated with any other game or studio.', view.w / 2, view.h - 30);
}

export function drawPause(ctx, view) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 10);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press Esc or P to resume', view.w / 2, view.h / 2 + 30);
}

export function drawBusted(ctx, view, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = kind === 'busted' ? '#3498db' : '#e74c3c';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', view.w / 2, view.h / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('You wake up at Meridian General. The fine has been taken from your cash.', view.w / 2, view.h / 2 + 40);
  ctx.fillText('Press Enter to get back on the streets.', view.w / 2, view.h / 2 + 72);
}
