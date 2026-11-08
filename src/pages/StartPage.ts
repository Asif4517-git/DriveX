import * as THREE from 'three';
import { TRACK_VERSION } from '../config';
import { getLeaderboard, loadActiveTrack, replaceActiveTrack } from '../storage/db';
import { loadSettings, saveCarColor, savePlayerName, saveTrackMode, saveTrackPreset } from '../storage/settings';
import { buildTrack, generateCenterlinePoints } from '../track/generator';
import { PRESET_TRACKS, getPresetTrack } from '../track/presets';
import { listLocalPresets, loadLocalPresetTrack, type LocalPresetInfo } from '../track/localPresets';
import { downloadBlob, exportTrackToBlob, importTrackFromFile } from '../track/gltf';
import type { BuiltTrack } from '../track/generator';
import { TrackPreview } from '../ui/TrackPreview';
import { showConfirmDialog } from '../ui/confirmDialog';
import type { TrackMode, TrackPackage } from '../types';
import { fmtTime } from '../utils/format';
import { randomPlayerName, randomSeed } from '../utils/random';

const MODE_LABEL: Record<TrackMode, string> = {
  preset: 'Preset',
  simple: 'Flat',
  complex: 'Terrain',
};

export function mountStartPage(root: HTMLElement): () => void {
  root.innerHTML = `
    <div id="preview-background" class="preview-background"></div><div class="page-overlay"></div>
    <div class="page start-page">
      <nav class="top-nav"><a class="brand" href="#/start" aria-label="DriveX home">DRIVE<span>X</span><small> / DRIVING EXPERIENCE</small></a><div class="nav-links"><a href="#/garage">GARAGE</a><a href="#/controls">SETTINGS</a><a href="#/about">ABOUT</a></div></nav>
      <div class="home-stage">
        <div class="home-title"><div class="eyebrow"><i></i> THE DRIVING EXPERIENCE</div><h1>Drive<br><em>your way.</em></h1><p>Find your rhythm on the circuit or take the long way home.</p><div class="home-version">CONCEPT COUPÉ &nbsp; / &nbsp; SINGLE PLAYER</div></div>
        <div class="home-actions" aria-label="Choose a driving mode"><span class="home-actions-label">SELECT YOUR DRIVE</span>
          <button id="btn-start" class="home-action primary" disabled><span><small>01 / TIME TRIAL</small><strong>Drive the circuit</strong><em>One lap. Set your best time.</em></span><b>↗</b></button>
          <a href="#/world" class="home-action"><span><small>02 / FREE ROAM</small><strong>Explore the roads</strong><em>Open driving in the village prototype.</em></span><b>↗</b></a>
          <div class="home-utility"><a href="#/garage">GARAGE <span>↗</span></a><a href="#session">SESSION SETUP <span>↓</span></a></div>
          <div class="home-coming">PROVING GROUND &nbsp; / &nbsp; COMING LATER</div>
        </div>
      </div>
      <div class="section-heading" id="session"><div><span class="eyebrow">YOUR SESSION</span><h2>Set up your drive.</h2></div><p>Choose your route, set your name, and get behind the wheel.</p></div>
      <div class="start-grid">
        <section class="panel"><div class="card-index">01 / DRIVER</div><h2>Driver &amp; vehicle</h2><p class="card-desc">Set your driver identity and choose a colour.</p>
          <label class="field"><span>DRIVER NAME</span><input id="player-name" type="text" maxlength="12" placeholder="Your name" /></label>
          <label class="field"><span>PAINT COLOUR</span><input id="car-color" type="color" /></label><div class="garage-note">CONCEPT COUPÉ · ONE VEHICLE AVAILABLE <span>●</span></div></section>
        <section class="panel"><div class="card-index">02 / ROUTE</div><h2>Choose a circuit</h2><p class="card-desc">One lap. Your time to beat.</p><div id="track-info" class="track-info">Loading…</div>
          <label class="field"><span>TRACK TYPE</span><select id="track-mode"><option value="preset">Curated circuits</option><option value="simple">Generated · flat</option><option value="complex">Generated · terrain</option></select></label>
          <label class="field" id="preset-field"><span>CIRCUIT</span><select id="track-preset"></select></label>
          <div class="track-actions"><button id="btn-regenerate" class="btn" hidden>Generate</button><button id="btn-preview" class="btn">Preview circuit</button><button id="btn-export" class="btn">Export</button><button id="btn-import" class="btn">Import</button><input id="file-import" type="file" accept=".glb,.gltf" hidden /></div></section>
        <section class="panel"><div class="card-index">03 / TIMES</div><h2>Personal bests</h2><p class="card-desc">Your locally saved laps on this circuit.</p><div id="leaderboard" class="leaderboard">Loading…</div><div class="controls-preview"><span>QUICK CONTROLS</span><p><kbd>W</kbd> Accelerate &nbsp; <kbd>S</kbd> Brake &nbsp; <kbd>Z</kbd> Reverse</p><p><kbd>A</kbd> <kbd>D</kbd> Steer &nbsp; <kbd>ESC</kbd> Pause</p></div></section>
      </div>
      <footer class="start-footer"><div><strong>DRIVE<span>X</span></strong><p>Built for the feeling of driving.</p></div><div class="creator"><span>DEVELOPED BY ASIF</span><div class="social-links"><a href="https://asif4517-git.github.io/" target="_blank" rel="noopener noreferrer" aria-label="Asif's portfolio (opens in a new tab)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm7.7 9h-3.1a15.9 15.9 0 0 0-1.5-6.1A8 8 0 0 1 19.7 11ZM12 4c1 1.2 2.2 3.7 2.5 7h-5C9.8 7.7 11 5.2 12 4ZM4.3 13h3.1c.2 2.3.7 4.4 1.5 6.1A8 8 0 0 1 4.3 13Zm3.1-2H4.3a8 8 0 0 1 4.6-6.1A15.9 15.9 0 0 0 7.4 11ZM12 20c-1-1.2-2.2-3.7-2.5-7h5c-.3 3.3-1.5 5.8-2.5 7Zm3.1-.9c.8-1.7 1.3-3.8 1.5-6.1h3.1a8 8 0 0 1-4.6 6.1Z"/></svg> Portfolio</a><a href="https://www.instagram.com/asif_xrk/" target="_blank" rel="noopener noreferrer" aria-label="Instagram (opens in a new tab)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.5-3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/></svg> Instagram</a><a href="mailto:asifsrk4517@gmail.com" aria-label="Email Asif"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.4L4.4 7h15.2L12 12.4ZM4 9v8h16V9l-8 5.7L4 9Z"/></svg> Email</a></div></div><a href="#/about">About &amp; credits ↗</a></footer><div id="toast" class="toast hidden"></div>
    </div>
  `;

  root.querySelectorAll<HTMLAnchorElement>('a[href="#session"]').forEach(link => link.addEventListener('click', (event) => { event.preventDefault(); root.querySelector('#session')?.scrollIntoView({ behavior: 'smooth' }); }));

  const nameInput = root.querySelector<HTMLInputElement>('#player-name')!;
  const colorInput = root.querySelector<HTMLInputElement>('#car-color')!;
  const modeSelect = root.querySelector<HTMLSelectElement>('#track-mode')!;
  const presetSelect = root.querySelector<HTMLSelectElement>('#track-preset')!;
  const presetField = root.querySelector<HTMLLabelElement>('#preset-field')!;
  const trackInfo = root.querySelector<HTMLElement>('#track-info')!;
  const leaderboardEl = root.querySelector<HTMLElement>('#leaderboard')!;
  const toastEl = root.querySelector<HTMLElement>('#toast')!;
  const fileInput = root.querySelector<HTMLInputElement>('#file-import')!;
  const previewContainer = root.querySelector<HTMLElement>('#preview-background')!;

  let current: TrackPackage | null = null;
  let currentBuilt: BuiltTrack | null = null;
  let preview: TrackPreview | null = null;
  let toastTimer = 0;
  let disposed = false;

  function toast(msg: string): void {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2600);
  }

  /** 根据设置当前选择的Mode/Preset生成新Circuit包；preset 用固定 seed 使环境稳定 */
  async function createNewTrack(mode: TrackMode, presetId?: string): Promise<TrackPackage> {
    const preset = mode === 'preset' ? getPresetTrack(presetId) : null;
    const meta = {
      id: crypto.randomUUID(),
      mode,
      presetId: preset ? preset.id : null,
      seed: preset ? preset.seed : randomSeed(),
      createdAt: Date.now(),
      version: TRACK_VERSION,
    };
    const points = generateCenterlinePoints(meta);
    // Export is only needed on demand; avoiding it here makes first launch faster.
    const glb = null;
    return {
      meta,
      centerline: points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      glb,
    };
  }

  /** 本地 GLB Preset清单（public/presets/，可为空） */
  let localPresets: LocalPresetInfo[] = [];

  /** Preset下拉同步：内置 + 本地（data-local），并校准存档 ID（不在列表时回落第一个内置） */
  function syncPresetSelect(): void {
    presetSelect.querySelectorAll('option[data-local]').forEach((o) => o.remove());
    for (const info of localPresets) {
      const opt = document.createElement('option');
      opt.value = info.id;
      opt.dataset.local = '1';
      opt.textContent = `Local preset · ${info.fileName}`;
      presetSelect.appendChild(opt);
    }
    const wanted = loadSettings().trackPresetId;
    const hasWanted =
      PRESET_TRACKS.some((p) => p.id === wanted) || localPresets.some((p) => p.id === wanted);
    if (!hasWanted) {
      presetSelect.value = PRESET_TRACKS[0].id;
      if (modeSelect.value === 'preset') saveTrackPreset(presetSelect.value);
    } else if (presetSelect.value !== wanted) {
      presetSelect.value = wanted;
    }
    if (current?.meta.presetId?.startsWith('local-') && localPresets.some((p) => p.id === current!.meta.presetId)) {
      presetSelect.value = current.meta.presetId;
    }
  }

  async function refreshTrack(): Promise<void> {
    current = (await loadActiveTrack()) ?? null;
    if (!current) {
      const settings = loadSettings();
      current = await createNewTrack(settings.trackMode, settings.trackPresetId);
      await replaceActiveTrack(current);
    }
    localPresets = await listLocalPresets();
    if (disposed) return;
    syncPresetSelect();
    currentBuilt = buildTrack(current.meta, current.centerline.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    ensurePreview();
    renderTrackInfo();
    await renderLeaderboard();
    if (!disposed) { const button = root.querySelector<HTMLButtonElement>('#btn-start'); if (button) { button.disabled = false; button.innerHTML = '<span><small>01 / TIME TRIAL</small><strong>Drive the circuit</strong><em>One lap. Set your best time.</em></span><b>↗</b>';  } }
  }

  function ensurePreview(): void {
    if (disposed || !currentBuilt) return;
    if (preview) {
      preview.setTrack(currentBuilt);
    } else {
      try {
        preview = new TrackPreview(previewContainer, currentBuilt, loadSettings().carColor);
      } catch {
        previewContainer.innerHTML = '<p class="empty">WebGL preview is unavailable in this browser.</p>';
      }
    }
  }

  function renderTrackInfo(): void {
    if (!current) return;
    const m = current.meta;
    const date = new Date(m.createdAt).toLocaleString();
    const modeValue =
      m.mode === 'preset'
        ? m.presetId?.startsWith('local-')
          ? `Preset · Local (${localPresets.find((p) => p.id === m.presetId)?.fileName ?? 'file'})`
          : `Preset · ${getPresetTrack(m.presetId).name}`
        : MODE_LABEL[m.mode];
    trackInfo.innerHTML = `
      <div class="info-line"><span>Mode</span><b>${modeValue}</b></div>
      <div class="info-line"><span>Seed</span><b>${m.seed}</b></div>
      <div class="info-line"><span>Created</span><b>${date}</b></div>
      <div class="info-line"><span>Data version</span><b>v${m.version}</b></div>
    `;
  }

  async function renderLeaderboard(): Promise<void> {
    if (!current) {
      leaderboardEl.textContent = 'No circuit available';
      return;
    }
    const entries = await getLeaderboard(current.meta.id);
    if (entries.length === 0) {
      leaderboardEl.innerHTML = '<p class="empty">No laps yet. Set your first time.</p>';
      return;
    }
    const rows = entries
      .map(
        (e, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(e.playerName)}</td>
          <td>${fmtTime(e.lapTimeMs)}</td>
          <td>${new Date(e.date).toLocaleDateString()}</td>
        </tr>`,
      )
      .join('');
    leaderboardEl.innerHTML = `
      <table class="leaderboard-table">
        <thead><tr><th>#</th><th>Driver</th><th>Time</th><th>Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
  }

  /** 通用激活流程：分配新 id → 覆盖活动Circuit → 刷新页面 UI（清榜语义） */
  async function applyTrack(raw: TrackPackage, trackDesc: string): Promise<void> {
    const pkg: TrackPackage = {
      meta: { ...raw.meta, id: crypto.randomUUID(), createdAt: Date.now() },
      centerline: raw.centerline,
      glb: raw.glb,
    };
    await replaceActiveTrack(pkg);
    current = pkg;
    currentBuilt = buildTrack(pkg.meta, pkg.centerline.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    ensurePreview();
    renderTrackInfo();
    await renderLeaderboard();
    toast(`Switched to ${trackDesc}. Leaderboard cleared.`);
  }

  /** 描述目标Circuit（Preset / Local preset / 自定义） */
  function trackDescFor(mode: TrackMode, presetId?: string): string {
    const local = presetId?.startsWith('local-') ? localPresets.find((p) => p.id === presetId) : undefined;
    const preset = mode === 'preset' ? getPresetTrack(presetId) : null;
    return local
      ? `local preset “${local.fileName}”`
      : preset
        ? `circuit “${preset.name}”`
        : `generated ${MODE_LABEL[mode]} circuit`;
  }

  /** 激活所选Preset：确认清榜后生效（Preset立即生效，不走Generate按钮） */
  async function activatePreset(presetId: string): Promise<void> {
    if (current?.meta.mode === 'preset' && current.meta.presetId === presetId) {
      toast('This circuit is already selected.');
      return;
    }
    const trackDesc = trackDescFor('preset', presetId);
    const ok = await showConfirmDialog({
      title: 'Switch circuit',
      message: `Switch to ${trackDesc}? The current circuit leaderboard will be cleared.`,
      confirmText: 'Switch',
      danger: true,
    });
    if (!ok) {
      // 取消：下拉与存档回退到当前Circuit的Preset
      const back = current?.meta.presetId ?? PRESET_TRACKS[0].id;
      presetSelect.value = back;
      saveTrackPreset(back);
      return;
    }
    try {
      const local = localPresets.find((p) => p.id === presetId);
      // 本地 GLB Preset：从 public/presets 读取并解析；内置Preset：控制点生成
      await applyTrack(local ? await loadLocalPresetTrack(local) : await createNewTrack('preset', presetId), trackDesc);
    } catch {
      toast('Could not load the local preset. Use a circuit exported by DriveX in public/presets.');
      const back = current?.meta.presetId ?? PRESET_TRACKS[0].id;
      presetSelect.value = back;
      saveTrackPreset(back);
    }
  }

  /** 自定义Mode：确认后Generate（Generate按钮仅在自定义Mode显示） */
  async function regenerate(mode: TrackMode): Promise<void> {
    const trackDesc = trackDescFor(mode);
    const ok = await showConfirmDialog({
      title: 'Generate circuit',
      message: `Generate ${trackDesc}? The current circuit leaderboard will be cleared.`,
      confirmText: 'Generate',
      danger: true,
    });
    if (!ok) return;
    await applyTrack(await createNewTrack(mode), trackDesc);
  }

  function init(): void {
    const settings = loadSettings();
    nameInput.value = settings.playerName;
    colorInput.value = settings.carColor;
    // Preset下拉由数据驱动生成（后续新增Preset自动出现）
    for (const p of PRESET_TRACKS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}（${p.description}）`;
      presetSelect.appendChild(opt);
    }
    modeSelect.value = settings.trackMode;
    presetSelect.value = settings.trackPresetId;
    presetField.hidden = modeSelect.value !== 'preset';

    nameInput.addEventListener('change', () => savePlayerName(nameInput.value.trim()));
    colorInput.addEventListener('input', () => {
      saveCarColor(colorInput.value);
      preview?.setColor(colorInput.value);
    });
    const regenBtn = root.querySelector<HTMLButtonElement>('#btn-regenerate')!;
    regenBtn.hidden = modeSelect.value === 'preset';
    modeSelect.addEventListener('change', () => {
      const nextMode = modeSelect.value as TrackMode;
      saveTrackMode(nextMode);
      presetField.hidden = nextMode !== 'preset';
      // Preset布局固定，无“Generate”概念；切到PresetMode时按当前下拉立即生效
      regenBtn.hidden = nextMode === 'preset';
      if (nextMode === 'preset') void activatePreset(presetSelect.value);
    });
    presetSelect.addEventListener('change', () => {
      saveTrackPreset(presetSelect.value);
      if (modeSelect.value === 'preset') void activatePreset(presetSelect.value);
    });

    document.querySelector('#btn-start')!.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        const defaultName = randomPlayerName();
        nameInput.value = defaultName;
        savePlayerName(defaultName);
        toast(`Using default driver name: ${defaultName}`);
      }
      window.location.hash = '#/game';
    });

    document.querySelector('#btn-preview')!.addEventListener('click', () => {
      window.location.hash = '#/preview';
    });

    regenBtn!.addEventListener('click', () => {
      void regenerate(modeSelect.value as TrackMode);
    });

    document.querySelector('#btn-export')!.addEventListener('click', () => {
      void (async () => {
        if (!current) {
          toast('No circuit to export.');
          return;
        }
        const points = current.centerline.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const built = buildTrack(current.meta, points);
        const blob = await exportTrackToBlob(built);
        downloadBlob(blob, `racing-track-${current.meta.seed}.glb`);
        toast('Circuit exported.');
      })();
    });

    document.querySelector('#btn-import')!.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      void (async () => {
        try {
          const pkg = await importTrackFromFile(file);
          await replaceActiveTrack(pkg);
          current = pkg;
          currentBuilt = buildTrack(pkg.meta, pkg.centerline.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
          ensurePreview();
          renderTrackInfo();
          await renderLeaderboard();
          toast('Circuit imported; leaderboard cleared.');
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Import failed.');
        }
      })();
    });
  }

  void refreshTrack().catch((error) => { console.error('DriveX: could not initialize track', error); if (!disposed) { const button = root.querySelector<HTMLButtonElement>('#btn-start'); if (button) button.textContent = 'TRACK UNAVAILABLE'; toast('Unable to load track. Check browser storage and reload.'); } });
  init();

  return () => {
    disposed = true;
    window.clearTimeout(toastTimer);
    preview?.dispose();
    preview = null;
    root.innerHTML = '';
  };
}
