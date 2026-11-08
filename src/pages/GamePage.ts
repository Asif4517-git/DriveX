import * as THREE from 'three';
import { TRACK_VERSION } from '../config';
import { Game, type GameOptions } from '../game/Game';
import { loadSettings } from '../storage/settings';
import { loadActiveTrack, saveActiveTrack } from '../storage/db';
import { buildTrack, generateCenterlinePoints } from '../track/generator';
import type { TrackMeta } from '../types';
import { randomSeed } from '../utils/random';
import { buildVillageWorld } from '../world/village';

export function mountGamePage(root: HTMLElement, mode: 'time-trial' | 'free-roam' = 'time-trial'): () => void {
  const container = document.createElement('div');
  container.className = 'game-root';
  root.appendChild(container);

  let game: Game | null = null;
  let disposed = false;
  let generation = 0;

  function start(): void {
    const current = ++generation;
    void (async () => {
      const settings = loadSettings();
      if (mode === 'free-roam') {
        if (disposed || current !== generation) return;
        game = new Game(container, buildVillageWorld(), { mode, playerName: settings.playerName, carColor: settings.carColor, onBack: () => { window.location.hash = '#/start'; }, onRestart: () => { game?.dispose(); game = null; start(); } });
        return;
      }
      let pkg = await loadActiveTrack();
      if (!pkg) {
        const meta: TrackMeta = {
          id: crypto.randomUUID(),
          mode: settings.trackMode,
          presetId: settings.trackMode === 'preset' ? settings.trackPresetId : null,
          seed: randomSeed(),
          createdAt: Date.now(),
          version: TRACK_VERSION,
        };
        const points = generateCenterlinePoints(meta);
        pkg = { meta, centerline: points.map((p) => ({ x: p.x, y: p.y, z: p.z })), glb: null };
        await saveActiveTrack(pkg);
      }
      if (disposed || current !== generation) return;
      const points = pkg.centerline.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const track = buildTrack(pkg.meta, points);
      const opts: GameOptions = {
        playerName: settings.playerName,
        carColor: settings.carColor,
        onBack: () => {
          window.location.hash = '#/start';
        },
        onRestart: () => {
          game?.dispose();
          game = null;
          start();
        },
      };
      game = new Game(container, track, opts);
    })();
  }

  start();

  return () => {
    disposed = true;
    generation++;
    game?.dispose();
    root.removeChild(container);
  };
}
