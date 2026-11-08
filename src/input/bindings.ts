export const defaults = { accelerate: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', handbrake: 'Space', camera: 'KeyC', reset: 'KeyR', pause: 'Escape', reverse: 'KeyZ', gearUp: 'KeyE', gearDown: 'KeyQ', clutch: 'ShiftLeft', transmission: 'KeyM' } as const;
export type Action = keyof typeof defaults;
export type Bindings = Record<Action, string>;
const KEY = 'drivex.controls.v1';
export function loadBindings(): Bindings {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    const result: Bindings = { ...defaults };
    // Reject invalid, unknown or conflicting persisted bindings atomically.
    for (const action of Object.keys(defaults) as Action[]) {
      if (action in data) {
        if (typeof data[action] !== 'string' || data[action].length > 40 || !data[action]) return { ...defaults };
        result[action] = data[action];
      }
    }
    return new Set(Object.values(result)).size === Object.keys(defaults).length ? result : { ...defaults };
  } catch { return { ...defaults }; }
}
export function saveBindings(bindings: Bindings): void { try { localStorage.setItem(KEY, JSON.stringify(bindings)); } catch { /* storage unavailable */ } }
export function labelKey(code: string): string { return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'SPACE').replace('Escape', 'ESC'); }
