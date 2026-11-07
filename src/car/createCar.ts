import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAR } from '../config';

export interface CarVisual {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  dims: { width: number; height: number; length: number };
  setColor(color: string): void;
  setBraking(braking: boolean): void;
  dispose(): void;
}

/** 代码生成低多边形汽车：同一模型函数，仅颜色参数不同 */
export function buildCar(color: string): CarVisual {
  const group = new THREE.Group();
  group.name = 'car';
  let paintColor = color;
  let disposed = false;
  let braking = false;
  const brakeMaterials = new Set<THREE.MeshStandardMaterial>();

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.15, metalness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });

  // 车身底盘：放在轮顶高度附近（物理原点在悬架之上，若按 0.4+ 放置会悬浮在半空）
  // 轮心局部 y ≈ -0.24-0.38，轮顶 ≈ 该值+轮半径；车身底部略高于轮顶
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.34, CAR.length), bodyMat);
  body.position.y = 0.04;
  body.castShadow = true;
  group.add(body);

  // 座舱（车身中间的方块）
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width * 0.7, 0.26, CAR.length * 0.5), glassMat);
  cabin.position.set(0, 0.34, -0.3);
  cabin.castShadow = true;
  group.add(cabin);

  // 尾翼
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(CAR.width * 0.8, 0.08, 0.3), bodyMat);
  spoiler.position.set(0, 0.38, -CAR.length / 2 + 0.3);
  group.add(spoiler);

  // 前灯 / 尾灯
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 0.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, emissive: 0xaa2222, emissiveIntensity: 0.4 });
  brakeMaterials.add(tailMat);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), lightMat);
    head.position.set(side * CAR.width * 0.36, 0.1, CAR.length / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), tailMat);
    tail.position.set(side * CAR.width * 0.36, 0.1, -CAR.length / 2 - 0.02);
    group.add(tail);
  }

  // 四个轮子：圆柱体转 Z 轴使轴线沿 X；胎宽 0.38
  const wheelGeo = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.38, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const wheelPositions: Array<[number, number, number]> = [
    // 轮距略宽于车身（与物理连接点一致），让前轮在追尾视角下露出
    [-(CAR.width / 2 + 0.15), CAR.wheelRadius, CAR.length * 0.37],
    [CAR.width / 2 + 0.15, CAR.wheelRadius, CAR.length * 0.37],
    [-(CAR.width / 2 + 0.15), CAR.wheelRadius, -CAR.length * 0.37],
    [CAR.width / 2 + 0.15, CAR.wheelRadius, -CAR.length * 0.37],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  // A licensed PBR concept car. The chassis stays attached to the Cannon body;
  // each wheel is attached to its own Cannon world transform in Game.syncVisual.
  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/concept.glb`, (gltf) => {
    if (disposed) { disposeVisual([gltf.scene]); return; }
    const model = gltf.scene;
    const names = ['WheelFrontR', 'WheelFrontL', 'WheelRearR', 'WheelRearL'];
    const sourceWheels = names.map((name) => model.getObjectByName(name));
    if (sourceWheels.some((wheel) => !wheel)) {
      console.error('DriveX: the concept car is missing wheel nodes');
      return;
    }
    for (const wheel of sourceWheels) wheel!.removeFromParent();
    for (const child of [...group.children]) if (!wheels.includes(child as THREE.Mesh)) { group.remove(child); disposeVisual([child]); }
    wheelGeo.dispose();
    // The source is Z-up; its root transforms it to Three.js Y-up. Its wheelbase
    // is 2.80m, versus 2.664m between our physical contact points.
    model.scale.set(1, 1, (CAR.length * 0.74) / 2.8);
    model.position.y = -0.24 - 0.38 - 0.38376;
    model.position.z = -(1.48568 - 1.31406) * 0.5 * (CAR.length * 0.74) / 2.8;
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0) {
          // Avoid costly framebuffer transmission passes on low-end hardware.
          mat.transmission = 0; mat.transparent = true; mat.opacity = 0.55;
        }
        if (mat instanceof THREE.MeshStandardMaterial && mat.name.startsWith('Paint')) mat.color.set(paintColor);
        if (mat instanceof THREE.MeshStandardMaterial && mat.name === 'Brakelight') { mat.emissive.set(0xd51b10); mat.emissiveIntensity = braking ? 2 : .3; brakeMaterials.add(mat); }
      }
    });
    group.add(model);
    sourceWheels.forEach((wheel, i) => {
      const target = wheels[i];
      target.visible = true;
      // Keep the target's world-space physics transform, but replace the
      // fallback cylinder with the actual tire, rim and brake geometry.
      target.geometry = new THREE.BufferGeometry();
      wheel!.position.set(0, 0, 0);
      wheel!.quaternion.identity();
      wheel!.scale.setScalar(CAR.wheelRadius / 0.384);
      wheel!.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
      target.add(wheel!);
    });
  }, undefined, (error) => console.error('DriveX: could not load the concept car; using fallback', error));
  const setColor = (next: string): void => {
    paintColor = next;
    bodyMat.color.set(next);
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && material.name.startsWith('Paint')) material.color.set(next);
    });
  };
  const setBraking = (active: boolean): void => {
    if (active === braking) return; braking = active;
    for (const material of brakeMaterials) material.emissiveIntensity = active ? 2 : .3;
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    disposeVisual([group, ...wheels]);
    group.removeFromParent();
    for (const wheel of wheels) wheel.removeFromParent();
  };
  return { group, wheels, dims: { width: CAR.width, height: CAR.height, length: CAR.length }, setColor, setBraking, dispose };
}

// Each loaded car owns its materials, textures and geometry. Dispose once even
// where glTF primitives share a material or texture.
function disposeVisual(objects: THREE.Object3D[]): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const root of objects) root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const geo of geometries) geo.dispose();
  for (const mat of materials) mat.dispose();
  for (const texture of textures) texture.dispose();
}
