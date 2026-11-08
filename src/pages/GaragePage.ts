import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCar } from '../car/createCar';
import { CAR } from '../config';
import { CHASSIS_SPAWN_HEIGHT } from '../physics/vehicle';
import { CHASSIS_MASS } from '../physics/vehicle-tuning';
import { loadSettings, saveCarColor } from '../storage/settings';
import { loadTransmissionMode, saveTransmissionMode, type TransmissionMode } from '../physics/transmission';

/** One owned car, shown with its actual in-game mesh and saved settings. */
export function mountGaragePage(root: HTMLElement): () => void {
  root.innerHTML = `<main class="garage-page"><nav class="top-nav"><a class="brand" href="#/start">DRIVE<span>X</span><small> / GARAGE</small></a><div class="nav-links"><a href="#/start">HOME</a><a href="#/controls">SETTINGS</a></div></nav><div class="garage-layout"><section class="garage-stage"><div class="garage-stage-label"><span class="eyebrow">YOUR VEHICLE / 01</span><h1>Concept Coupé</h1><p>Drag to orbit · scroll to zoom</p></div><div id="garage-canvas" class="garage-canvas" aria-label="Interactive 3D vehicle preview"></div><div class="garage-views" role="group" aria-label="Vehicle views"><button data-view="front">FRONT</button><button data-view="rear">REAR</button><button data-view="left">LEFT</button><button data-view="right">RIGHT</button><button data-view="elevated">ELEVATED</button></div></section><aside class="garage-panel"><div class="garage-overline">YOUR GARAGE <span>01 / 01</span></div><h2>Concept Coupé</h2><p>A road-going concept with four driven wheels. One vehicle is currently available.</p><div class="garage-selected"><span>SELECTED VEHICLE</span><strong>Concept Coupé</strong><small>OWNED · READY TO DRIVE</small></div><h3>VEHICLE DETAILS</h3><dl class="garage-specs"><div><dt>Drive</dt><dd>All-wheel drive</dd></div><div><dt>Transmission</dt><dd>5-speed auto / manual</dd></div><div><dt>Wheel radius</dt><dd>${CAR.wheelRadius.toFixed(2)} m</dd></div><div><dt>Chassis mass</dt><dd>${CHASSIS_MASS} kg</dd></div></dl><p class="garage-footnote">Prototype physics dimensions and drivetrain; performance is not manufacturer-verified.</p><div class="garage-controls"><label for="garage-paint">PAINT COLOUR</label><input id="garage-paint" type="color" aria-label="Vehicle paint colour"><label for="garage-transmission">TRANSMISSION</label><select id="garage-transmission"><option value="auto">Automatic</option><option value="manual">Manual</option></select></div><button id="garage-drive" class="hero-button">DRIVE THIS CAR <span>↗</span></button><a class="garage-link" href="#/about">Vehicle attribution &amp; credits ↗</a></aside></div></main>`;
  const container = root.querySelector<HTMLElement>('#garage-canvas')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  container.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x202a2b);
  scene.fog = new THREE.Fog(0x202a2b, 18, 45);
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x666353, 2.1));
  const key = new THREE.DirectionalLight(0xffead2, 3.1); key.position.set(4, 8, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7; key.shadow.normalBias = 0.02; scene.add(key);
  const rim = new THREE.DirectionalLight(0xb5dfff, 2); rim.position.set(-5, 4, -6); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(18, 64), new THREE.MeshStandardMaterial({ color: 0x343c3b, roughness: 0.85, metalness: 0.05 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.22, 96), new THREE.MeshBasicMaterial({ color: 0x778782, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0; scene.add(ring);
  const car = buildCar(loadSettings().carColor);
  car.group.position.y = CHASSIS_SPAWN_HEIGHT;
  for (const wheel of car.wheels) wheel.position.y = CAR.wheelRadius - CHASSIS_SPAWN_HEIGHT;
  scene.add(car.group);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(7.3, 3.2, 8); camera.lookAt(0, 0.8, 0);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 0.75, 0); orbit.enableDamping = true; orbit.autoRotate = true; orbit.autoRotateSpeed = 0.7;
  orbit.minDistance = 5.5; orbit.maxDistance = 17; orbit.maxPolarAngle = Math.PI / 2.06;
  orbit.addEventListener('start', () => { orbit.autoRotate = false; });
  const resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  const views: Record<string, [number, number, number]> = { front:[0,2.1,10], rear:[0,2.1,-10], left:[-10,2.3,0], right:[10,2.3,0], elevated:[7.3,7.5,8] };
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-view]')) button.onclick = () => { orbit.autoRotate = false; camera.position.set(...views[button.dataset.view!]); orbit.update(); };
  const paint = root.querySelector<HTMLInputElement>('#garage-paint')!; paint.value = loadSettings().carColor;
  paint.oninput = () => { saveCarColor(paint.value); car.setColor(paint.value); };
  const transmission = root.querySelector<HTMLSelectElement>('#garage-transmission')!; transmission.value = loadTransmissionMode();
  transmission.onchange = () => saveTransmissionMode(transmission.value as TransmissionMode);
  root.querySelector<HTMLButtonElement>('#garage-drive')!.onclick = () => { window.location.hash = '#/game'; };
  renderer.setAnimationLoop(() => { orbit.update(); renderer.render(scene, camera); });
  return () => { observer.disconnect(); orbit.dispose(); renderer.setAnimationLoop(null); car.dispose(); renderer.dispose(); floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); root.innerHTML = ''; };
}
