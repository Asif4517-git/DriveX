import { describe, expect, it } from 'vitest';
import { Transmission } from '../src/physics/transmission';
describe('prototype drivetrain', () => {
  it('engages clutch and changes actual drive force by gear', () => {
    const box = new Transmission('manual');
    const first = box.update(10, 1, false, 1);
    expect(box.update(10, 1, true, 1)).toBe(0);
    box.shift(1);
    expect(box.gear).toBe(2);
    expect(box.update(10, 1, false, 1)).toBeLessThan(first);
  });
  it('automatically upshifts at high engine rpm', () => {
    const box = new Transmission('auto');
    box.update(22, 1, false, 1);
    expect(box.gear).toBe(2);
  });
  it('does not auto-shift from reverse or with the clutch disengaged', () => {
    const box = new Transmission('auto');
    box.update(-25, -1, false, 1);
    expect(box.gear).toBe(1);
    box.update(25, 1, true, 1);
    expect(box.gear).toBe(1);
  });
  it('smoothly restores torque after a manual shift', () => {
    const box = new Transmission('manual');
    box.shift(1);
    const during = box.update(10, 1, false, 0.02);
    const after = box.update(10, 1, false, 1);
    expect(during).toBeLessThan(after);
  });
  it('limits manual gear selection', () => {
    const box = new Transmission('manual');
    box.shift(-1); expect(box.gear).toBe(1);
    for (let i = 0; i < 10; i++) box.shift(1);
    expect(box.gear).toBe(5);
  });
});
