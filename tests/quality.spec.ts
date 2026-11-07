import { describe, expect, it } from 'vitest';
import { renderQuality } from '../src/render/quality';

describe('graphics presets', () => {
  it('scales actual rendering features and falls back safely', () => {
    const low = renderQuality('low'), medium = renderQuality('medium'), high = renderQuality('high'), ultra = renderQuality('ultra');
    expect(low.shadows).toBe(false); expect(medium.shadows).toBe(true);
    expect(high.antialias).toBe(true); expect(ultra.shadowSize).toBeGreaterThan(high.shadowSize);
    expect([low.pixelRatioCap,medium.pixelRatioCap,high.pixelRatioCap,ultra.pixelRatioCap]).toEqual([.85,1.2,1.5,2]);
    expect(renderQuality('invalid')).toEqual(medium);
  });
});
