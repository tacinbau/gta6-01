# Port Meridian

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/tacinbau/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/tacinbau/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world street story in 2D. You are a new face in Port Meridian, a
seeded city of roads, traffic, pedestrians and police — and Mara Voss, a
fixer working out of a Downtown diner, has five jobs for you. Drive,
steal, run, survive.

This is an original game, built in plain HTML5 Canvas and vanilla
JavaScript (ES modules, no libraries, no network). It is not affiliated
with any other game or studio.

## How to play

You start on foot near Meridian General hospital with $250 in your
pocket. Walk to a parked car, press E, and the city is yours — but
stealing cars, hitting pedestrians and ramming police cruisers all raise
your wanted level, and the police chase, ram, and arrest.

Press **J** to take a job from Mara Voss. Jobs unlock in order and pay
cash on completion; a failed job can be retried, and a finished job can
be replayed. The five jobs:

1. **First Run** — pick up a package at the park corner and deliver it
   across town against the clock. ($300)
2. **Hot Package** — grab the next package while already wanted, then
   deliver it. ($450)
3. **Shake the Tail** — lose a 3-star police tail by staying out of
   sight until the radio goes quiet. ($600)
4. **The Runner** — chase down a courier's fast gold coupe and hold on
   to it. ($800)
5. **The Meridian Job** — hit the vault under Meridian Tower, then
   escape to the pier while every cruiser in the city comes for you.
   ($1,500)

A yellow marker in the world and on the minimap shows where to go, an
arrow at the edge of the screen points the way, and the banner at the
top of the screen shows the objective and the time left. Get busted or
wasted mid-job and the job is blown — you wake up at the hospital
minus a fine.

### Controls

| Key | Action |
| --- | --- |
| W A S D / Arrows | Walk / drive |
| Shift | Sprint on foot |
| E | Enter / exit a car |
| Space | Punch |
| J | Take a job from Mara Voss |
| M | Mute / unmute sound |
| Esc / P | Pause |

## Systems

- **Open world** — a deterministic seeded city (seed 1337): a road
  grid with traffic lights, crosswalks, buildings, a park, a harbour
  waterfront with a pier, and five named districts.
- **Driving** — arcade physics with acceleration, braking, reverse,
  speed-sensitive steering, drift and skid marks, and car-to-car and
  car-to-building collisions.
- **Traffic** — cars that keep their lane, stop at red lights, slow
  for the car ahead, and turn at intersections.
- **Pedestrians** — walkers who stroll the sidewalks, cross at
  intersections, and flee from speeding cars and crimes.
- **Police & wanted level** — five stars. Crimes raise the heat;
  staying quiet and unseen lets it decay. Police cars chase and ram;
  officers on foot chase and punch. Get caught standing still and you
  are busted; lose all your health and you are wasted. Either way you
  wake up at the hospital minus a $150 fine.
- **Missions** — the five-job Mara Voss story arc, with markers, a
  guiding arrow, timers, cash rewards, fail-and-retry, and replay.
- **HUD & minimap** — wanted stars, cash, health bar, in-game clock,
  speed, the mission banner, and a live minimap with roads, the player
  arrow, police blips and the mission marker.
- **Sound** — fully synthesized WebAudio: an engine hum tied to speed,
  a two-tone police siren, pickup blips, crash thuds, a mission
  jingle, and a quiet bass-line loop. No audio files. M mutes.
- **Day cycle** — the clock starts at 17:00 and slides toward dusk;
  after 18:00 the city darkens and headlights come on.
- **Saving** — cash, health, stats and completed jobs persist in
  localStorage.

## How to run locally

```sh
node serve.ts
```

Then open <http://localhost:8080> in a browser. Click or press Enter
to start. No build step, no dependencies.

## Screenshots

The four staged shots in `shots.json` are captured from the game
itself with `?shot=<scene>&seed=<n>` URLs: a 3-star police chase, a
busy Downtown street on foot, a mission in progress, and driving at
dusk with the headlights on.
