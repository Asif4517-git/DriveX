/** A deliberately simple wheel-speed/ratio drivetrain, not a validated powertrain simulation. */
export type TransmissionMode = 'auto' | 'manual';
const RATIOS = [3.1, 2.0, 1.45, 1.1, 0.86];
const FINAL_DRIVE = 3.7;
export class Transmission {
  gear = 1;
  rpm = 900;
  mode: TransmissionMode;
  private shiftCooldown = 0;
  private shiftTime = 0;
  constructor(mode: TransmissionMode = 'auto') { this.mode = mode; }
  shift(direction: 1 | -1): void {
    if (this.mode !== 'manual') return;
    const next = Math.max(1, Math.min(RATIOS.length, this.gear + direction));
    if (next !== this.gear) { this.gear = next; this.shiftTime = 0.2; }
  }
  toggle(): void { this.mode = this.mode === 'auto' ? 'manual' : 'auto'; }
  update(speed: number, throttle: number, clutch: boolean, dt: number): number {
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
    this.shiftTime = Math.max(0, this.shiftTime - dt);
    const wheelRpm = Math.abs(speed) / (2 * Math.PI * 0.4) * 60;
    const reversing = speed < -0.5 || throttle < 0;
    const coupled = wheelRpm * (reversing ? 3.0 : RATIOS[this.gear - 1]) * FINAL_DRIVE;
    const desiredRpm = clutch ? 900 + Math.max(0, throttle) * 3500 : Math.max(900 + Math.max(0, throttle) * 500, coupled);
    this.rpm += (Math.min(7200, desiredRpm) - this.rpm) * Math.min(1, dt * 8);
    if (this.mode === 'auto' && !reversing && !clutch && this.shiftCooldown === 0) {
      if (this.rpm > 5700 && this.gear < RATIOS.length) { this.gear++; this.shiftCooldown = 0.8; this.shiftTime = 0.2; }
      else if (this.rpm < 1750 && this.gear > 1) { this.gear--; this.shiftCooldown = 0.8; this.shiftTime = 0.2; }
    }
    if (clutch) return 0;
    // A gear affects the applied wheel force; over-revving cuts drive force.
    const revLimiter = coupled > 7200 ? 0 : 1;
    const torqueCurve = Math.max(0.45, 1 - Math.abs(this.rpm - 4200) / 7000);
    const shiftEngagement = 1 - this.shiftTime / 0.2;
    const ratio = reversing ? 3.0 : RATIOS[this.gear - 1];
    return revLimiter * torqueCurve * shiftEngagement * (0.35 + 0.65 * ratio / RATIOS[0]);
  }
}
export function loadTransmissionMode(): TransmissionMode { try { return localStorage.getItem('drivex.transmission.v1') === 'manual' ? 'manual' : 'auto'; } catch { return 'auto'; } }
export function saveTransmissionMode(mode: TransmissionMode): void { try { localStorage.setItem('drivex.transmission.v1', mode); } catch { /* private mode */ } }
