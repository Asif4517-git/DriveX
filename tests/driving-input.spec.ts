import { expect, it } from 'vitest';
import type * as CANNON from 'cannon-es';
import { buildTrackForMode, createCarRig } from './helpers';

it('steering does not arbitrarily halve applied throttle force', () => {
  const rig = createCarRig(buildTrackForMode('simple'));
  const vehicle = (rig.physics as unknown as { vehicle: CANNON.RaycastVehicle }).vehicle;
  for (let i = 0; i < 20; i++) rig.physics.update({ throttle: 1, brake: 0, steering: 0 }, 1 / 60);
  const straight = Math.abs(vehicle.wheelInfos[2].engineForce);
  rig.physics.update({ throttle: 1, brake: 0, steering: 1 }, 1 / 60);
  const turning = Math.abs(vehicle.wheelInfos[2].engineForce);
  expect(turning / straight).toBeGreaterThan(0.95);
  rig.physics.dispose();
});

it('disengaging the clutch removes reverse drive force too', () => {
  const rig = createCarRig(buildTrackForMode('simple'));
  const vehicle = (rig.physics as unknown as { vehicle: CANNON.RaycastVehicle }).vehicle;
  for (let i = 0; i < 8; i++) rig.physics.update({ throttle: -1, brake: 0, steering: 0, driveFactor: 0 }, 1 / 60);
  expect(vehicle.wheelInfos.every(w => w.engineForce === 0)).toBe(true);
  rig.physics.dispose();
});


it('reading the render transform does not clear wheel-ground contacts', () => {
  const rig = createCarRig(buildTrackForMode('simple'));
  for (let i = 0; i < 90; i++) rig.physics.update({ throttle: 0, brake: 0, steering: 0 }, 1 / 60);
  const before = rig.physics.debugWheelStates().map(w => w.isInContact);
  expect(before.filter(Boolean).length).toBeGreaterThan(0);
  for (let i = 0; i < 4; i++) rig.physics.getWheelTransform(i);
  expect(rig.physics.debugWheelStates().map(w => w.isInContact)).toEqual(before);
  rig.physics.dispose();
});
