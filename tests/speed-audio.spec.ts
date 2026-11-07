import { describe, expect, it } from 'vitest';
import { Speedometer } from '../src/ui/speedometer';
import { engineSoundTargets } from '../src/audio/engine';
describe('telemetry and sound',()=>{
  it('suppresses standstill noise with start/stop hysteresis without hiding real movement',()=>{
    const meter=new Speedometer();
    expect([0,.3,.8,.65,.95].map(n=>meter.read(n))).toEqual([0,0,0,0,0]);
    expect(meter.read(1.1)).toBe(1);expect(meter.read(.8)).toBe(1);expect(meter.read(.5)).toBe(0);expect(meter.read(35.6)).toBe(36);
  });
  it('keeps sound targets finite and smooth across speed, load and rpm changes',()=>{
    const idle=engineSoundTargets(0,0,900), accelerating=engineSoundTargets(12,1,3000), shift=engineSoundTargets(13,1,2800);
    expect(accelerating.frequency).toBeGreaterThan(idle.frequency);expect(accelerating.gain).toBeGreaterThan(idle.gain);
    expect(Math.abs(accelerating.frequency-shift.frequency)).toBeLessThan(10);
    for (const v of Object.values(engineSoundTargets(NaN,NaN,NaN))) expect(Number.isFinite(v)).toBe(true);
  });
});
