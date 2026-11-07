import * as THREE from 'three';

// Small, local Poly Haven CC0 maps. Shared across track and world materials.
const cache = new Map<string, THREE.Texture>();
const files: Record<string, string> = {
  asphalt: 'asfalto_diff.webp', grass: 'pasto_diff.webp', concrete: 'concreto_diff.webp',
  'asphalt-normal': 'asfalto_nor_gl.webp',
};
export function surfaceTexture(kind: 'asphalt' | 'grass' | 'concrete' | 'asphalt-normal'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const existing = cache.get(kind); if (existing) return existing;
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}environment/surfaces/${files[kind]}`);
  texture.colorSpace = kind === 'asphalt-normal' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  cache.set(kind, texture); return texture;
}
