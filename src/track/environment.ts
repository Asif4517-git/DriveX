import * as THREE from 'three';
import type { TrackMeta } from '../types';
import { mulberry32 } from '../utils/random';
import type { TerrainData } from './generator';

/**
 * 环境生成：低多边形树与石头，纯装饰，自动避开所有路面；复杂赛道按地形高度摆放。
 *
 * 所有装饰共用 4 份单位几何（树干/锥形树冠/球形树冠/石头），按“几何 × 材质”分成
 * 约 14 个 InstancedMesh。随机尺寸/旋转全部写进实例矩阵，RNG 调用顺序保持与旧实现一致。
 */

interface EnvBatch {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  matrices: THREE.Matrix4[];
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const EULER_ORDER = 'XYZ';

export function buildEnvironment(
  meta: TrackMeta,
  points: THREE.Vector3[],
  halfWidths: number[],
  maxHalfWidth: number,
  terrain: TerrainData | null,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'environment';
  const rng = mulberry32(meta.seed ^ 0x5bd1e995);
  const n = points.length;

  const trunkMats = [0x5d3f24, 0x6b4a2b, 0x7a5633].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }),
  );
  const leafMats = [0x395e39, 0x486a3f, 0x53754a, 0x314f36].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const rockMats = [0x6f7680, 0x7d838c, 0x8d949c].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }),
  );

  // 单位几何：实例矩阵负责所有尺寸变化
  const trunkGeo = new THREE.CylinderGeometry(1, 1.5, 1, 6);
  const coneGeo = new THREE.SphereGeometry(1, 10, 7);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  // A single low-cost instanced frond geometry for tropical palms.
  const frondGeo = new THREE.BufferGeometry();
  frondGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, -.38,.18,1.1, .38,.18,1.1, 0,-.58,2.8], 3));
  frondGeo.setIndex([0,1,2,1,3,2]); frondGeo.computeVertexNormals();
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x46633d, roughness: 1, side: THREE.DoubleSide });

  const batches = new Map<string, EnvBatch>();
  const getBatch = (
    kind: 'trunk' | 'cone' | 'sphere' | 'rock' | 'palm',
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
    matIndex: number,
  ): EnvBatch => {
    const key = `${kind}:${matIndex}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material, matrices: [] };
      batches.set(key, batch);
    }
    return batch;
  };

  const isClear = (x: number, z: number): boolean => {
    for (let i = 0; i < n; i += 4) {
      const p = points[i];
      const d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      if (d < (maxHalfWidth + 5) ** 2) return false;
    }
    return true;
  };

  const dummy = new THREE.Object3D();
  const parentQuat = new THREE.Quaternion();
  const localQuat = new THREE.Quaternion();
  const localEuler = new THREE.Euler(0, 0, 0, EULER_ORDER);

  for (let i = 0; i < n; i += 12 + Math.floor(rng() * 8)) {
    const p = points[i];
    const t = points[(i + 1) % n].clone().sub(points[(i - 1 + n) % n]).normalize();
    const right = new THREE.Vector3(t.z, 0, -t.x).normalize();
    const side = rng() < 0.5 ? -1 : 1;
    const dist = halfWidths[i] + 9 + rng() * 20;
    const x = p.x + right.x * dist * side;
    const z = p.z + right.z * dist * side;
    if (!isClear(x, z)) continue;

    const isTree = rng() < 0.7;
    const baseY = terrain ? terrain.sample(x, z) : 0;
    const yaw = rng() * Math.PI * 2;
    parentQuat.setFromAxisAngle(Y_AXIS, yaw);

    if (isTree) {
      // 树：随机粗细/高低/树冠大小/形状
      const palm = rng() < 0.4;
      const trunkR = palm ? 0.19 + rng() * 0.06 : 0.16 + rng() * 0.24;
      const trunkH = palm ? 5.5 + rng() * 3.0 : 1.6 + rng() * 3.0;
      const trunkMatIndex = Math.floor(rng() * trunkMats.length);
      dummy.position.set(x, baseY + trunkH / 2, z);
      dummy.quaternion.copy(parentQuat);
      dummy.scale.set(trunkR, trunkH, trunkR);
      dummy.updateMatrix();
      getBatch('trunk', trunkGeo, trunkMats[trunkMatIndex], trunkMatIndex).matrices.push(dummy.matrix.clone());

      if (palm) {
        for (let leaf = 0; leaf < 8; leaf++) {
          dummy.position.set(x, baseY + trunkH, z);
          dummy.rotation.set(0, yaw + leaf * Math.PI / 4, 0);
          dummy.scale.set(1, 1, 1); dummy.updateMatrix();
          getBatch('palm', frondGeo, palmMat, 0).matrices.push(dummy.matrix.clone());
        }
        continue;
      }
      const crownR = 1.0 + rng() * 2.0;
      const crownH = 2.0 + rng() * 3.0;
      const leafMatIndex = Math.floor(rng() * leafMats.length);
      if (rng() < 0.6) {
        dummy.position.set(x, baseY + trunkH + crownH * 0.45, z);
        dummy.quaternion.copy(parentQuat);
        dummy.scale.set(crownR, crownH * 0.55, crownR);
        dummy.updateMatrix();
        getBatch('cone', coneGeo, leafMats[leafMatIndex], leafMatIndex).matrices.push(dummy.matrix.clone());
      } else {
        dummy.position.set(x, baseY + trunkH + crownR * 0.7, z);
        dummy.quaternion.copy(parentQuat);
        dummy.scale.set(crownR, crownR * 0.8, crownR);
        dummy.updateMatrix();
        getBatch('sphere', sphereGeo, leafMats[leafMatIndex], leafMatIndex).matrices.push(dummy.matrix.clone());
      }
    } else {
      // 石头：随机大小/扁度/朝向
      const rockR = 0.7 + rng() * 2.0;
      const rockMatIndex = Math.floor(rng() * rockMats.length);
      const flatness = 0.45 + rng() * 0.55;
      localEuler.set(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3);
      localQuat.setFromEuler(localEuler);
      localQuat.premultiply(parentQuat);
      dummy.position.set(x, baseY + rockR * flatness * 0.6, z);
      dummy.quaternion.copy(localQuat);
      dummy.scale.set(rockR, rockR * flatness, rockR);
      dummy.updateMatrix();
      getBatch('rock', rockGeo, rockMats[rockMatIndex], rockMatIndex).matrices.push(dummy.matrix.clone());
    }
  }

  for (const [key, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    mesh.name = `env-${key}`;
    for (let i = 0; i < batch.matrices.length; i++) {
      mesh.setMatrixAt(i, batch.matrices[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  return group;
}
