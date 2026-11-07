import { fmtTime } from '../utils/format';
import { Speedometer } from './speedometer';
import { labelKey, type Bindings } from '../input/bindings';

export interface HudData {
  speedKmh: number;
  gear: string;
  rpm: number;
  transmission: string;
  elapsedMs: number;
  timePenaltyMs: number;
  distancePenaltyM: number;
  drift: boolean;
}

export interface HudResult {
  lapTimeMs: number;
  timePenaltyMs: number;
  distancePenaltyM: number;
}

export interface HudRefs {
  minimap: HTMLCanvasElement;
  update(data: HudData): void;
  showPause(paused: boolean): void;
  showWrongWay(active: boolean): void;
  showResult(result: HudResult): void;
  onBack(cb: () => void): void;
  onRestart(cb: () => void): void;
  onToggleMute(cb: () => void): void;
  setMuteIcon(muted: boolean): void;
}

export function createHUD(container: HTMLElement, freeRoam = false, bindings?: Bindings): HudRefs {
  container.insertAdjacentHTML(
    'beforeend',
    `
    <div class="hud">
      <div class="hud-panel hud-session"><span class="hud-caption">DRIVEX / ${freeRoam ? 'FREE ROAM' : 'TIME TRIAL'}</span><div class="hud-timer"><span>${freeRoam ? 'DRIVE TIME' : 'LAP TIME'}</span><strong id="hud-time">00:00.00</strong></div><div class="hud-small" ${freeRoam ? 'hidden' : ''}>PENALTY <span id="hud-penalty">+0s</span></div><div id="hud-wrongway" class="hud-wrongway hidden">WRONG WAY</div><div id="hud-drift" class="hud-drift hidden">LOSING GRIP</div></div>
      <button id="hud-back" class="btn hud-back">MAIN MENU</button>
      <button id="hud-audio" class="btn hud-audio" aria-label="Toggle engine sound"></button>
      <canvas id="hud-minimap" class="hud-minimap" width="230" height="230" aria-label="${freeRoam ? 'Road map' : 'Circuit map'}"></canvas>
      <div class="hud-dashboard"><div class="hud-caption">VEHICLE TELEMETRY</div><div class="hud-speed-line"><strong id="hud-speed">0 km/h</strong><div><small>GEAR / MODE</small><b id="hud-gear">1 / AUTO</b></div></div><div class="hud-rpm-line"><span>ENGINE</span><span><b id="hud-rpm">900</b> RPM</span></div><div class="rpm-track"><i id="rpm-fill"></i></div></div>
      <div class="hud-hint"></div>
      <div id="pause-overlay" class="hud-overlay hidden">
        <div class="overlay-box"><h2>PAUSED</h2><p id="pause-hint">Game paused</p></div>
      </div>
      <div id="result-overlay" class="hud-overlay hidden">
        <div class="overlay-box">
          <h2>LAP COMPLETE</h2>
          <p class="result-time" id="result-time">00:00.00</p>
          <p id="result-penalty" class="result-penalty"></p>
          <div class="overlay-actions">
            <button id="result-restart" class="btn">DRIVE AGAIN</button>
            <button id="result-back" class="btn">MAIN MENU</button>
          </div>
        </div>
      </div>
    </div>
    `,
  );

  const speedEl = container.querySelector<HTMLElement>('#hud-speed')!;
  const gearEl = container.querySelector<HTMLElement>('#hud-gear')!;
  const rpmFill = container.querySelector<HTMLElement>('#rpm-fill')!;
  const rpmEl = container.querySelector<HTMLElement>('#hud-rpm')!;
  const timeEl = container.querySelector<HTMLElement>('#hud-time')!;
  const penaltyEl = container.querySelector<HTMLElement>('#hud-penalty')!;
  const pauseEl = container.querySelector<HTMLElement>('#pause-overlay')!;
  const wrongWayEl = container.querySelector<HTMLElement>('#hud-wrongway')!;
  const driftEl = container.querySelector<HTMLElement>('#hud-drift')!;
  const resultEl = container.querySelector<HTMLElement>('#result-overlay')!;
  const minimap = container.querySelector<HTMLCanvasElement>('#hud-minimap')!;
  const backBtn = container.querySelector<HTMLButtonElement>('#hud-back')!;
  const audioBtn = container.querySelector<HTMLButtonElement>('#hud-audio')!;
  const resultTimeEl = container.querySelector<HTMLElement>('#result-time')!;
  const resultPenaltyEl = container.querySelector<HTMLElement>('#result-penalty')!;

  const speedometer = new Speedometer();
  let lastSpeed = -1;
  if (bindings) container.querySelector<HTMLElement>('#pause-hint')!.textContent = `Press ${labelKey(bindings.pause)} to resume`;
  if (bindings) container.querySelector<HTMLElement>('.hud-hint')!.textContent =
    `${labelKey(bindings.accelerate)} accelerate · ${labelKey(bindings.left)}/${labelKey(bindings.right)} steer · ${labelKey(bindings.brake)} brake · ${labelKey(bindings.reverse)} reverse · ${labelKey(bindings.camera)} camera · ${labelKey(bindings.pause)} pause`;
  let backCb: (() => void) | null = null;
  let restartCb: (() => void) | null = null;
  let muteCb: (() => void) | null = null;

  backBtn.addEventListener('click', () => backCb?.());
  audioBtn.addEventListener('click', () => muteCb?.());
  container.querySelector('#result-back')!.addEventListener('click', () => backCb?.());
  container.querySelector('#result-restart')!.addEventListener('click', () => restartCb?.());

  return {
    minimap,
    update({ speedKmh, gear, rpm, transmission, elapsedMs, timePenaltyMs, distancePenaltyM, drift }) {
      const displayedSpeed = speedometer.read(speedKmh);
      if (displayedSpeed !== lastSpeed) { speedEl.textContent = `${displayedSpeed} km/h`; lastSpeed = displayedSpeed; }
      gearEl.textContent = `${gear} / ${transmission.toUpperCase()}`;
      rpmEl.textContent = `${Math.round(rpm)}`;
      rpmFill.style.width = `${Math.min(100, Math.max(0, rpm / 7200 * 100))}%`;
      rpmFill.classList.toggle('redline', rpm > 6000);
      timeEl.textContent = fmtTime(elapsedMs);
      const parts: string[] = [];
      if (timePenaltyMs > 0) parts.push(`+${(timePenaltyMs / 1000).toFixed(1)}s`);
      if (distancePenaltyM > 0.5) parts.push(`Distance -${distancePenaltyM.toFixed(1)}m`);
      penaltyEl.textContent = parts.length ? parts.join('  ') : '+0s';
      driftEl.classList.toggle('hidden', !drift);
    },
    showPause(paused) {
      pauseEl.classList.toggle('hidden', !paused);
    },
    showWrongWay(active) {
      wrongWayEl.classList.toggle('hidden', !active);
    },
    showResult(result) {
      resultTimeEl.textContent = fmtTime(result.lapTimeMs);
      const parts: string[] = [];
      if (result.timePenaltyMs > 0) parts.push(`Time penalty +${(result.timePenaltyMs / 1000).toFixed(1)}s`);
      if (result.distancePenaltyM > 0.5) parts.push(`Distance penalty -${result.distancePenaltyM.toFixed(1)}m`);
      resultPenaltyEl.textContent = parts.length ? parts.join('　·　') : 'No penalties';
      resultEl.classList.remove('hidden');
    },
    onBack(cb) {
      backCb = cb;
    },
    onRestart(cb) {
      restartCb = cb;
    },
    onToggleMute(cb) {
      muteCb = cb;
    },
    setMuteIcon(muted) {
      audioBtn.setAttribute('aria-label', muted ? 'Unmute engine sound' : 'Mute engine sound');
      audioBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z${muted ? 'M16 9l5 6m0-6l-5 6' : 'M16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12'}"/></svg>`;
    },
  };
}
