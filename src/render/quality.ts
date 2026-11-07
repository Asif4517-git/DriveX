export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';
export interface RenderQuality { antialias: boolean; pixelRatioCap: number; shadows: boolean; shadowSize: number }
const PRESETS: Record<GraphicsPreset, RenderQuality> = {
  low: { antialias: false, pixelRatioCap: 0.85, shadows: false, shadowSize: 512 },
  medium: { antialias: false, pixelRatioCap: 1.2, shadows: true, shadowSize: 1024 },
  high: { antialias: true, pixelRatioCap: 1.5, shadows: true, shadowSize: 2048 },
  ultra: { antialias: true, pixelRatioCap: 2, shadows: true, shadowSize: 3072 },
};
export function renderQuality(value: string | null): RenderQuality {
  return PRESETS[Object.hasOwn(PRESETS, value ?? '') ? value as GraphicsPreset : 'medium'];
}
