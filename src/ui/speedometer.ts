/** Integer road speed with a small stop/start hysteresis to suppress idle jitter. */
export class Speedometer {
  private stopped = true;
  read(kmh: number): number {
    const speed = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
    if (this.stopped ? speed >= 1 : speed < 0.6) this.stopped = !this.stopped;
    return this.stopped ? 0 : Math.max(1, Math.round(speed));
  }
}
