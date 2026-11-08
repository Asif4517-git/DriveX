import { expect, it } from 'vitest';
import * as CANNON from 'cannon-es';
import { buildVillageWorld, worldRecovery, WORLD_ROADS } from '../src/world/village';
import { CarPhysics, CHASSIS_SPAWN_HEIGHT } from '../src/physics/vehicle';

it('creates a connected road grid and physical buildings with a stable spawn', () => {
  const world = buildVillageWorld();
  expect(world.group.getObjectByName('village-road-markings')).toBeTruthy();
  expect(world.physics.barriers.length).toBeGreaterThan(4);
  const car = new CarPhysics(); car.addGround(world.physics.ground);
  const p = world.points[0];
  car.reset(new CANNON.Vec3(p.x, CHASSIS_SPAWN_HEIGHT, p.z), new CANNON.Quaternion());
  for (let i = 0; i < 180; i++) car.update({throttle:0,brake:0,steering:0}, 1/60);
  expect(car.getState().position.y).toBeGreaterThan(0.5);
  expect(car.debugWheelStates().filter(w => w.isInContact).length).toBeGreaterThan(0);
  car.dispose();
});
it('recovery projects onto a left lane and remains within bounds', () => {
  const vertical = worldRecovery(4, 110);
  expect(vertical.x).toBe(WORLD_ROADS[1] + 3); expect(vertical.heading).toBe(0);
  const horizontal = worldRecovery(118, 202);
  expect(horizontal.z).toBe(WORLD_ROADS[2] + 3); expect(horizontal.heading).toBeCloseTo(Math.PI/2);
  expect(worldRecovery(900,900).x).toBeLessThanOrEqual(288);
});
it('keeps free-roam boundaries visible and collidable', () => {
  const world = buildVillageWorld();
  expect(world.group.getObjectByName('world-boundary')).toBeTruthy();
  expect(world.group.getObjectByName('streetlights')).toBeTruthy();
  expect(world.group.getObjectByName('junction-crossings')).toBeTruthy();
});
