// Port Meridian — shared tuning constants for the whole game.
// One place for every number a system needs, so balancing never means
// hunting through draw code or physics code.

export const WORLD_SIZE = 3200;
export const ROAD_WIDTH = 64;
export const ROAD_SPACING = 400;
export const ROAD_OFFSET = 200;
export const CITY_SEED = 1337;

export const PLAYER_WALK_SPEED = 170;
export const PLAYER_RUN_SPEED = 265;
export const PLAYER_SPRINT_SPEED = 360;
export const PLAYER_RADIUS = 14;
export const PLAYER_MAX_HEALTH = 100;

export const CAR_ACCEL = 430;
export const CAR_BRAKE = 700;
export const CAR_REVERSE_ACCEL = 260;
export const CAR_MAX_SPEED = 520;
export const CAR_MAX_REVERSE = 150;
export const CAR_DRAG = 0.55;
export const CAR_STEER = 2.4;
export const CAR_RADIUS = 20;

export const WANTED_MAX = 5;
export const WANTED_DECAY_PER_SEC = 0.045;
export const BUST_FINE = 150;
export const HOSPITAL_SPAWN = { x: 1000, y: 1000 };

export const SAVE_KEY = 'port-meridian-save-v1';

export const DISTRICTS = {
  downtown: 'Downtown',
  harbour: 'Harbour',
  northside: 'Northside',
  oldtown: 'Old Town',
  gardens: 'Palm Gardens',
};

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#8e44ad',
  '#e67e22', '#ecf0f1', '#2c3e50', '#16a085', '#d35400',
  '#7f8c8d', '#c0a080', '#e74c3c', '#3498db',
];

export const CAR_MODELS = [
  { name: 'Sedan', length: 46, width: 22, topSpeed: 480, accel: 400 },
  { name: 'Coupe', length: 44, width: 21, topSpeed: 560, accel: 470 },
  { name: 'Hatch', length: 38, width: 20, topSpeed: 430, accel: 380 },
  { name: 'Van', length: 54, width: 24, topSpeed: 380, accel: 300 },
  { name: 'Pickup', length: 50, width: 23, topSpeed: 450, accel: 360 },
  { name: 'Taxi', length: 46, width: 22, topSpeed: 500, accel: 420 },
];

export const PED_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#fd79a8', '#00cec9', '#6c5ce7',
];
