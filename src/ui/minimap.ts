import * as THREE from 'three';

export interface MinimapRenderer {
  /** 每帧只重绘“静态底图 + 车辆标记”，不再遍历中心线 */
  draw(carPos: { x: number; z: number }, heading: number): void;
}

/**
 * 2D Canvas 俯视小地图：赛道轮廓 + 车 + 起终点。
 *
 * 赛道轮廓/起终点在创建时绘制到离屏 canvas，运行时每帧只 drawImage + 画车辆。
 * 旧实现每帧遍历 1500~1900 个点并描边两次，是固定的 Canvas CPU 开销。
 */
export function createMinimapRenderer(
  canvas: HTMLCanvasElement,
  points: THREE.Vector3[],
  roadWidth: number,
): MinimapRenderer {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 16;
  const scale = Math.min(
    (W - pad * 2) / Math.max(1, maxX - minX),
    (H - pad * 2) / Math.max(1, maxZ - minZ),
  );
  const toScreen = (x: number, z: number): [number, number] => [
    // X 轴镜像：3D 追尾视角里 +X 在屏幕左侧，小地图必须一致，否则左右转向看起来相反
    pad + (maxX - x) * scale,
    pad + (maxZ - z) * scale,
  ];

  const staticLayer = document.createElement('canvas');
  staticLayer.width = W;
  staticLayer.height = H;
  const staticCtx = staticLayer.getContext('2d');

  if (staticCtx) {
    staticCtx.clearRect(0, 0, W, H);

    // 路面（粗线描边模拟道路轮廓）
    staticCtx.beginPath();
    points.forEach((p, i) => {
      const [sx, sy] = toScreen(p.x, p.z);
      if (i === 0) staticCtx.moveTo(sx, sy);
      else staticCtx.lineTo(sx, sy);
    });
    staticCtx.closePath();
    staticCtx.lineWidth = Math.max(3, roadWidth * scale);
    staticCtx.lineJoin = 'round';
    staticCtx.lineCap = 'round';
    staticCtx.strokeStyle = '#565c66';
    staticCtx.stroke();

    // 中心线
    staticCtx.beginPath();
    points.forEach((p, i) => {
      const [sx, sy] = toScreen(p.x, p.z);
      if (i === 0) staticCtx.moveTo(sx, sy);
      else staticCtx.lineTo(sx, sy);
    });
    staticCtx.closePath();
    staticCtx.lineWidth = 1.2;
    staticCtx.strokeStyle = '#9aa1ac';
    staticCtx.stroke();

    // 起终点
    const p0 = points[0];
    const p1 = points[1 % points.length];
    if (p0 && p1) {
      const [ax, ay] = toScreen(p0.x, p0.z);
      const [bx, by] = toScreen(p1.x, p1.z);
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 8;
      const ny = (dx / len) * 8;
      staticCtx.beginPath();
      staticCtx.moveTo(ax - nx, ay - ny);
      staticCtx.lineTo(ax + nx, ay + ny);
      staticCtx.lineWidth = 3;
      staticCtx.strokeStyle = '#ffffff';
      staticCtx.stroke();
    }
  }

  return {
    draw(carPos, heading): void {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(staticLayer, 0, 0);

      // 车辆
      const [cx, cy] = toScreen(carPos.x, carPos.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd54a';
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 车头朝向
      const dirX = -Math.sin(heading) * 12;
      const dirY = -Math.cos(heading) * 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dirX, cy + dirY);
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 2;
      ctx.stroke();
    },
  };
}

/** Static road grid for the free-drive map, with a live player marker. */
export function createVillageMinimap(canvas: HTMLCanvasElement): MinimapRenderer {
  const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height,pad=17,scale=(w-pad*2)/600;
  const xy=(x:number,z:number):[number,number]=>[pad+(300-x)*scale,pad+(300-z)*scale];
  const base=document.createElement('canvas');base.width=w;base.height=h;const bg=base.getContext('2d');
  if(bg){bg.strokeStyle='#536763';bg.lineWidth=1;bg.strokeRect(pad,pad,w-pad*2,h-pad*2);bg.strokeStyle='#9eafaa';bg.lineWidth=5;for(const r of [-200,0,200]) {const [x]=xy(r,0);const [,y]=xy(0,r);bg.beginPath();bg.moveTo(x,pad);bg.lineTo(x,h-pad);bg.moveTo(pad,y);bg.lineTo(w-pad,y);bg.stroke();}const [sx,sy]=xy(16,-225);bg.fillStyle='#d9926b';bg.fillRect(sx-3,sy-3,6,6);}
  return {draw(pos,heading){if(!ctx)return;ctx.clearRect(0,0,w,h);ctx.drawImage(base,0,0);const [x,y]=xy(pos.x,pos.z);ctx.fillStyle='#ffd54a';ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd54a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.sin(heading)*12,y-Math.cos(heading)*12);ctx.stroke();}};
}
