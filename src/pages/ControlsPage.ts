import { defaults, labelKey, loadBindings, saveBindings, type Action } from '../input/bindings';
const labels: Record<Action, string> = { accelerate:'Accelerate', brake:'Brake', left:'Steer left', right:'Steer right', handbrake:'Handbrake', camera:'Change camera', reset:'Reset vehicle', pause:'Pause / resume', reverse:'Reverse', gearUp:'Gear up', gearDown:'Gear down', clutch:'Clutch', transmission:'Toggle transmission' };
export function mountControlsPage(root: HTMLElement): () => void {
  root.innerHTML = `<main class="about-page"><nav class="top-nav"><a class="brand" href="#/start">DRIVE<span>X</span></a><a href="#/start">← BACK TO HOME</a></nav><div class="about-content"><span class="eyebrow">DRIVE YOUR WAY</span><h1>Take<br><em>control.</em></h1><p>Choose a binding and press a key. Arrow keys also drive. Changes are saved on this browser.</p><p class="binding-status" role="status" aria-live="polite"></p><div class="controls-grid"></div><section class="settings-panel"><div class="settings-item"><label for="graphics">Graphics preset</label> <select id="graphics"><option value="low">Low · no shadows</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></div><div class="settings-item"><label for="camera-distance">Chase camera</label><select id="camera-distance"><option value="near">Near</option><option value="standard">Standard</option><option value="far">Far</option></select></div><div class="settings-item"><label for="engine-volume">Engine volume</label> <input type="range" id="engine-volume" min="0" max="100" aria-label="Engine volume"></div><div class="settings-item"><label for="effects-volume">Tire / collision volume</label> <input type="range" id="effects-volume" min="0" max="100" aria-label="Tire and collision volume"></div><p>Changes take effect next time you start driving. Environment and UI sound channels are not yet implemented.</p></section><button class="hero-button controls-reset">RESTORE DEFAULTS</button></div></main>`;
  const grid = root.querySelector<HTMLElement>('.controls-grid')!;
  const status = root.querySelector<HTMLElement>('.binding-status')!;
  let bindings = loadBindings(); let listening: Action | null = null;
  function render() {
    grid.innerHTML = '';
    for (const action of Object.keys(defaults) as Action[]) {
      const row = document.createElement('div'); row.className = 'binding-row';
      const name = document.createElement('span'); name.textContent = labels[action];
      const actions = document.createElement('div'); actions.className = 'binding-actions';
      const assign = document.createElement('button'); assign.textContent = listening === action ? 'PRESS A KEY…' : labelKey(bindings[action]); assign.setAttribute('aria-label', `Change ${labels[action]} binding`);
      assign.onclick = () => { listening = action; status.textContent = `Press a key for ${labels[action]}.`; render(); };
      const reset = document.createElement('button'); reset.textContent = 'Reset'; reset.setAttribute('aria-label', `Reset ${labels[action]} binding`);
      reset.onclick = () => { if (Object.entries(bindings).some(([a, key]) => a !== action && key === defaults[action])) { status.textContent = 'Default key is in use by another action.'; return; } bindings[action] = defaults[action]; saveBindings(bindings); listening = null; status.textContent = `${labels[action]} reset.`; render(); };
      actions.append(assign,reset); row.append(name,actions); grid.append(row);
    }
  }
  const onKey = (event: KeyboardEvent) => {
    if (!listening) return;
    event.preventDefault(); event.stopPropagation();
    const action = listening;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) { status.textContent = 'Arrow keys are reserved as alternate driving controls.'; return; }
    if (Object.entries(bindings).some(([a, key]) => a !== action && key === event.code)) { status.textContent = 'That key is already assigned. Choose a different key.'; return; }
    bindings[action] = event.code; saveBindings(bindings); listening = null; status.textContent = `${labels[action]} updated.`; render();
  };
  window.addEventListener('keydown', onKey, true);
  root.querySelector<HTMLButtonElement>('.controls-reset')!.onclick = () => { bindings = { ...defaults }; saveBindings(bindings); listening = null; status.textContent = 'Default bindings restored.'; render(); };
  const graphics = root.querySelector<HTMLSelectElement>('#graphics')!;
  const cameraDistance = root.querySelector<HTMLSelectElement>('#camera-distance')!;
  try { cameraDistance.value = localStorage.getItem('drivex.cameraDistance.v1') || 'standard'; } catch { cameraDistance.value = 'standard'; }
  cameraDistance.onchange = () => { try { localStorage.setItem('drivex.cameraDistance.v1', cameraDistance.value); } catch {} };
  const volume = root.querySelector<HTMLInputElement>('#engine-volume')!;
  const effects = root.querySelector<HTMLInputElement>('#effects-volume')!;
  try { effects.value = String(Math.round(Number(localStorage.getItem('drivex.effectsVolume.v1') ?? 0.5) * 100)); } catch { effects.value = '50'; }
  effects.oninput = () => { try { localStorage.setItem('drivex.effectsVolume.v1', String(Number(effects.value) / 100)); } catch {} };
  try { graphics.value = localStorage.getItem('drivex.graphics.v1') || 'medium'; volume.value = String(Math.round(Number(localStorage.getItem('drivex.engineVolume.v1') ?? 0.5) * 100)); } catch { graphics.value = 'medium'; volume.value = '50'; }
  graphics.onchange = () => { try { localStorage.setItem('drivex.graphics.v1', graphics.value); } catch {} };
  volume.oninput = () => { try { localStorage.setItem('drivex.engineVolume.v1', String(Number(volume.value) / 100)); } catch {} };
  render(); return () => { window.removeEventListener('keydown', onKey, true); root.innerHTML = ''; };
}
