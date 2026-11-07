import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { CAR, TRACK_VERSION } from '../config';
import { surfaceTexture } from '../track/surface';
import type { BuiltTrack } from '../track/generator';

/** A small, connected road-grid playground. This is not a geographically accurate map. */
export const WORLD_ROADS = [-200, 0, 200] as const;
export const WORLD_LIMIT = 300;
export const WORLD_ROAD_WIDTH = 12;

/** Project a recovery point onto a left-hand lane, heading along a cardinal road. */
export function worldRecovery(x: number, z: number): { x: number; z: number; heading: number } {
  const clamp = (n: number) => Math.max(-WORLD_LIMIT + 12, Math.min(WORLD_LIMIT - 12, n));
  let nearestX: number = WORLD_ROADS[0], nearestZ: number = WORLD_ROADS[0];
  for (const road of WORLD_ROADS) {
    if (Math.abs(x - road) < Math.abs(x - nearestX)) nearestX = road;
    if (Math.abs(z - road) < Math.abs(z - nearestZ)) nearestZ = road;
  }
  return Math.abs(x - nearestX) <= Math.abs(z - nearestZ)
    ? { x: nearestX + 3, z: clamp(z), heading: 0 }
    : { x: clamp(x), z: nearestZ + 3, heading: Math.PI / 2 };
}

export function buildVillageWorld(): BuiltTrack {
  const group = new THREE.Group(); group.name = 'village-world';
  const groundMat = new THREE.MeshStandardMaterial({color:0xa3b88c, map:surfaceTexture('grass'), roughness:1});
  const groundVisual = new THREE.Mesh(new THREE.PlaneGeometry(700,700),groundMat);
  const groundUV = groundVisual.geometry.getAttribute('uv') as THREE.BufferAttribute;
  for(let i=0;i<groundUV.count;i++) groundUV.setXY(i,groundUV.getX(i)*87.5,groundUV.getY(i)*87.5);
  groundVisual.rotation.x = -Math.PI/2; groundVisual.position.y=-0.04; groundVisual.receiveShadow=true; group.add(groundVisual);
  const ground = new CANNON.Body({mass:0, shape:new CANNON.Plane()}); ground.quaternion.setFromEuler(-Math.PI/2,0,0);
  const roadMaterial = new THREE.MeshStandardMaterial({color:0xd4d6d4,roughness:0.95,map:surfaceTexture('asphalt'),normalMap:surfaceTexture('asphalt-normal'),normalScale:new THREE.Vector2(.35,.35)});
  for (const road of WORLD_ROADS) {
    for (const horizontal of [false,true]) {
      const geo = new THREE.PlaneGeometry(horizontal ? 600 : WORLD_ROAD_WIDTH, horizontal ? WORLD_ROAD_WIDTH : 600);
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      for (let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*(horizontal ? 75 : 1.5), uv.getY(i)*(horizontal ? 1.5 : 75));
      const roadMesh = new THREE.Mesh(geo,roadMaterial); roadMesh.rotation.x=-Math.PI/2;
      roadMesh.position.set(horizontal ? 0 : road, horizontal ? 0.012 : 0.01, horizontal ? road : 0); roadMesh.receiveShadow = true; group.add(roadMesh);
    }
  }
  // Dashed center and white edge lines; leave intersections unmarked.
  const markings: Array<{x:number;z:number;horizontal:boolean;edge:boolean}> = [];
  for (const road of WORLD_ROADS) for (const horizontal of [false,true]) {
    for (let along=-295;along<300;along+=8) {
      if (WORLD_ROADS.some(intersection=>Math.abs(along-intersection)<10)) continue;
      for (const offset of [0,-5.7,5.7]) markings.push({x:horizontal?along:road+offset,z:horizontal?road+offset:along,horizontal,edge:offset!==0});
    }
  }
  const markGeo = new THREE.BoxGeometry(1,1,1);
  const paint = new THREE.MeshStandardMaterial({color:0xd9d7bf,roughness:1});
  const lines = new THREE.InstancedMesh(markGeo,paint,markings.length); lines.name='village-road-markings';
  const obj = new THREE.Object3D();
  markings.forEach((mark,i)=>{obj.position.set(mark.x,0.03,mark.z);obj.rotation.set(0,0,0);obj.scale.set(mark.horizontal ? (mark.edge?7.8:4) : 0.13,0.02,mark.horizontal ? 0.13 : (mark.edge?7.8:4));obj.updateMatrix();lines.setMatrixAt(i,obj.matrix);});
  lines.instanceMatrix.needsUpdate=true;lines.computeBoundingSphere();group.add(lines);
  const crossings: Array<{x:number;z:number;horizontal:boolean}> = [];
  for (const x of WORLD_ROADS) for (const z of WORLD_ROADS) for (const side of [-1,1]) for (let stripe=-4;stripe<=4;stripe+=2) {
    crossings.push({x:x+stripe,z:z+side*9,horizontal:true});
    crossings.push({x:x+side*9,z:z+stripe,horizontal:false});
  }
  const crosswalks = new THREE.InstancedMesh(markGeo,paint,crossings.length);
  crossings.forEach((cross,i)=>{obj.position.set(cross.x,0.032,cross.z);obj.rotation.set(0,0,0);obj.scale.set(cross.horizontal ? 1 : 3,0.02,cross.horizontal ? 3 : 1);obj.updateMatrix();crosswalks.setMatrixAt(i,obj.matrix);});
  crosswalks.name='junction-crossings'; crosswalks.computeBoundingSphere();group.add(crosswalks);
  const bodies: CANNON.Body[]=[];
  const houses: Array<{x:number;z:number;color:number}> = [];
  for (const x of [-230,-170,-30,30,170,230]) for (const z of [-260,-140,-60,60,140,260]) houses.push({x,z,color:(Math.abs(x+z)%3)});
  const houseGeo=new THREE.BoxGeometry(1,1,1), roofGeo=new THREE.ConeGeometry(1,1,4);
  const house = new THREE.InstancedMesh(houseGeo,new THREE.MeshStandardMaterial({color:0xc7b9a0,roughness:1}),houses.length);
  const roof = new THREE.InstancedMesh(roofGeo,new THREE.MeshStandardMaterial({color:0x864d36,roughness:1}),houses.length);
  house.name='village-houses'; roof.name='village-roofs';
  houses.forEach(({x,z},i)=>{
    obj.position.set(x,2.5,z);obj.rotation.set(0,0,0);obj.scale.set(14,5,12);obj.updateMatrix();house.setMatrixAt(i,obj.matrix);
    house.setColorAt(i,new THREE.Color([0xffffff,0xead4b7,0xd5e0cc,0xe4c9ba][i%4]));
    obj.position.set(x,6.2,z);obj.rotation.set(0,Math.PI/4,0);obj.scale.set(11,2.6,10);obj.updateMatrix();roof.setMatrixAt(i,obj.matrix);
    const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(7,2.5,6)),position:new CANNON.Vec3(x,2.5,z)}); bodies.push(body);
  });
  if(house.instanceColor) house.instanceColor.needsUpdate=true;
  house.castShadow=true;house.receiveShadow=true;roof.castShadow=true;house.computeBoundingSphere();roof.computeBoundingSphere();group.add(house,roof);
  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x566b69,roughness:0.35,metalness:0.1}),houses.length*4);
  houses.forEach(({x,z},i)=>{for(const [k,dx,side] of [[0,-3,-1],[1,3,-1],[2,-3,1],[3,3,1]]) {obj.position.set(x+dx,3,z+side*6.02);obj.rotation.set(0,0,0);obj.scale.set(2,1.5,0.06);obj.updateMatrix();windows.setMatrixAt(i*4+k,obj.matrix);}});
  windows.name='village-windows';windows.computeBoundingSphere();group.add(windows);
  const lampPositions: Array<[number,number,boolean]> = [];
  for(const road of WORLD_ROADS) for(const along of [-250,-150,-50,50,150,250]) {lampPositions.push([road+8,along,false]);lampPositions.push([along,road+8,true]);}
  const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.11,.15,7,6),new THREE.MeshStandardMaterial({color:0x777e78,roughness:.8}),lampPositions.length);
  const lamps=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xddd1aa,emissive:0x433622,roughness:.8}),lampPositions.length);
  lampPositions.forEach(([x,z,horizontal],i)=>{obj.position.set(x,3.5,z);obj.rotation.set(0,0,0);obj.scale.set(1,1,1);obj.updateMatrix();poles.setMatrixAt(i,obj.matrix);obj.position.set(x+(horizontal?0:-1),7,z+(horizontal?-1:0));obj.scale.set(horizontal?0.6:2,0.18,horizontal?2:0.6);obj.updateMatrix();lamps.setMatrixAt(i,obj.matrix);});
  poles.name='streetlights';poles.computeBoundingSphere();lamps.computeBoundingSphere();group.add(poles,lamps);
  // Deep eaves, verandas, columns and doorways echo regional residential forms.
  const porch = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x9c7256,roughness:1}),houses.length);
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xe0cfb1,roughness:1}),houses.length*2);
  const doors = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x594736,roughness:1}),houses.length);
  houses.forEach(({x,z},i)=>{
    const road = WORLD_ROADS.reduce((best,v)=>Math.abs(v-x)<Math.abs(best-x)?v:best,WORLD_ROADS[0] as number);
    const side = Math.sign(road-x) || 1;
    obj.position.set(x+side*8,4.35,z);obj.rotation.set(0,0,0);obj.scale.set(2.4,.28,10);obj.updateMatrix();porch.setMatrixAt(i,obj.matrix);
    for (const k of [0,1]) {obj.position.set(x+side*9,2.05,z+(k?4:-4));obj.scale.set(.35,4.1,.35);obj.updateMatrix();pillars.setMatrixAt(i*2+k,obj.matrix);}
    obj.position.set(x+side*7.03,1.7,z);obj.scale.set(.08,3.4,2);obj.updateMatrix();doors.setMatrixAt(i,obj.matrix);
  });
  porch.name='village-verandas';pillars.name='village-columns';doors.name='village-doors';
  for(const mesh of [porch,pillars,doors]) {mesh.castShadow=true;mesh.computeBoundingSphere();group.add(mesh);}
  // Gravel shoulders are below the asphalt and omitted at junctions.
  const shoulders = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x9f9885,roughness:1}),markings.filter(m=>m.edge).length);
  let shoulderIndex=0;
  for (const mark of markings) if(mark.edge) {const out=mark.horizontal ? Math.sign(mark.z-WORLD_ROADS.reduce((a,b)=>Math.abs(mark.z-a)<Math.abs(mark.z-b)?a:b)) : Math.sign(mark.x-WORLD_ROADS.reduce((a,b)=>Math.abs(mark.x-a)<Math.abs(mark.x-b)?a:b));obj.position.set(mark.x+(mark.horizontal?0:out*1.1),.003,mark.z+(mark.horizontal?out*1.1:0));obj.rotation.set(0,0,0);obj.scale.set(mark.horizontal?7.9:2,.012,mark.horizontal?2:7.9);obj.updateMatrix();shoulders.setMatrixAt(shoulderIndex++,obj.matrix);}
  shoulders.name='road-shoulders';shoulders.computeBoundingSphere();group.add(shoulders);
  // Palms repeat as three instanced batches to keep draw calls bounded.
  const palms: Array<[number,number]> = [];
  for (const x of [-285,-245,-155,-115,-85,-45,45,85,115,155,245,285]) for (const z of [-285,-245,-155,-115,-85,-45,45,85,115,155,245,285]) if (Math.abs(x%200)>15 && Math.abs(z%200)>15 && !houses.some(h=>Math.abs(h.x-x)<12&&Math.abs(h.z-z)<12)) palms.push([x,z]);
  // A few closer palms break up the empty roadside without changing road collision geometry.
  for (const road of WORLD_ROADS) for (const along of [-280,-220,-180,-120,-80,-20,20,80,120,180,220,280]) for (const side of [-1,1]) {
    const jitter = Math.sin((road+along)*12.9898)*2;
    if (!WORLD_ROADS.some(r=>Math.abs(along-r)<16)) palms.push([road+side*(14+Math.abs(jitter)),along+jitter]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14,0.24,7,7),new THREE.MeshStandardMaterial({color:0x70533b,roughness:1}),palms.length);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1,9,6),new THREE.MeshStandardMaterial({color:0x426441,roughness:1}),palms.length);
  palms.forEach(([x,z],i)=>{obj.position.set(x,3.5,z);obj.rotation.set(0,0,0);obj.scale.set(1,1,1);obj.updateMatrix();trunks.setMatrixAt(i,obj.matrix);obj.position.y=7.2;obj.scale.set(2.3,0.75,2.3);obj.updateMatrix();crowns.setMatrixAt(i,obj.matrix);});
  trunks.castShadow=true;crowns.castShadow=true;trunks.computeBoundingSphere();crowns.computeBoundingSphere();group.add(trunks,crowns);
  // Replace temporary silhouettes with the real textured CC0 palm as soon as it is ready.
  if (typeof document !== 'undefined') {
    let removed = false;
    group.addEventListener('removed', () => { removed = true; });
    const dir = `${import.meta.env.BASE_URL}environment/palm/`;
    const loader = new THREE.TextureLoader();
    Promise.all([new OBJLoader().loadAsync(`${dir}palm_tree.obj`), loader.loadAsync(`${dir}diffuse.png`), loader.loadAsync(`${dir}normal.jpg`)]).then(([model, map, normal]) => {
      if (removed) { map.dispose(); normal.dispose(); model.traverse(o=>{if(o instanceof THREE.Mesh) o.geometry.dispose();}); return; }
      map.colorSpace=THREE.SRGBColorSpace; map.anisotropy=2;
      group.addEventListener('removed', () => { map.dispose(); normal.dispose(); });
      const material = new THREE.MeshStandardMaterial({map, normalMap:normal, alphaTest:0.5, side:THREE.DoubleSide, roughness:0.9});
      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const batch = new THREE.InstancedMesh(child.geometry, material, palms.length); batch.name = 'textured-palms';
        palms.forEach(([x,z],i)=>{const scale=(7.2+(i%5)*0.55)/439.7393;obj.position.set(x,0,z);obj.rotation.set(0,(i*2.399)% (Math.PI*2),0);obj.scale.setScalar(scale);obj.updateMatrix();batch.setMatrixAt(i,obj.matrix);});
        batch.castShadow=true;batch.receiveShadow=true;batch.computeBoundingSphere();group.add(batch);
      });
      group.remove(trunks,crowns); trunks.geometry.dispose(); crowns.geometry.dispose(); (trunks.material as THREE.Material).dispose(); (crowns.material as THREE.Material).dispose();
    }).catch(error=>console.error('DriveX: palm asset failed to load',error));
  }
  // A simple roadside shelter with solid end posts; its open side faces the road.
  const shelter = new THREE.Group(); shelter.name='roadside-shelter';
  const shelterMaterial = new THREE.MeshStandardMaterial({color:0x9eaa9a,roughness:1});
  const shelterRoof = new THREE.Mesh(new THREE.BoxGeometry(3.6,.25,6),new THREE.MeshStandardMaterial({color:0x844a38,roughness:1})); shelterRoof.position.set(15.5,3.2,-225);shelterRoof.castShadow=true;shelter.add(shelterRoof);
  for (const z of [-227.5,-222.5]) {const post=new THREE.Mesh(new THREE.BoxGeometry(.3,3,.3),shelterMaterial);post.position.set(17,1.5,z);shelter.add(post);bodies.push(new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(.15,1.5,.15)),position:new CANNON.Vec3(17,1.5,z)}));}
  const bench=new THREE.Mesh(new THREE.BoxGeometry(.7,.2,4),new THREE.MeshStandardMaterial({color:0x674c38,roughness:1}));bench.position.set(16.8,1,-225);shelter.add(bench);group.add(shelter);
  // Consistent junction signs make the repeated grid easier to navigate. Signs
  // are decorative and placed beyond the shoulder, not in the drivable lane.
  if (typeof document !== 'undefined') {
    const names = ['WEST JUNCTION','VILLAGE CENTRE','EAST JUNCTION'];
    const textureCanvas = document.createElement('canvas'); textureCanvas.width=768; textureCanvas.height=128;
    const context = textureCanvas.getContext('2d');
    if (context) {
      names.forEach((name,i)=>{const x=i*256;context.fillStyle='#204e3f';context.fillRect(x,0,256,128);context.strokeStyle='#e9e7cf';context.lineWidth=5;context.strokeRect(x+5,5,246,118);context.fillStyle='#fff';context.textAlign='center';context.font='bold 20px sans-serif';context.fillText(name,x+128,53);context.font='18px sans-serif';context.fillText('←  ROAD  →',x+128,88);});
      const map = new THREE.CanvasTexture(textureCanvas);map.colorSpace=THREE.SRGBColorSpace;
      group.addEventListener('removed',()=>map.dispose());
      // Three atlas-mapped boards; no per-frame geometry work.
      for (let i=0;i<3;i++) {
        const geometry=new THREE.PlaneGeometry(4.5,2.25);const uv=geometry.getAttribute('uv') as THREE.BufferAttribute;
        for(let j=0;j<uv.count;j++)uv.setX(j,(uv.getX(j)+i)/3);
        const board=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map,roughness:1,side:THREE.DoubleSide}));board.position.set(WORLD_ROADS[i]+11,3.8,-217);board.rotation.y=Math.PI;board.name='junction-sign';group.add(board);
        const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.7,6),new THREE.MeshStandardMaterial({color:0xa9aca1,roughness:1}));post.position.set(WORLD_ROADS[i]+11,1.35,-217);group.add(post);
      }
    }
  }
  // Bound the finite prototype world; these are collision walls, not driveable roads beyond the map.
  const boundaryLayout = [[0,-302,604,2],[0,302,604,2],[-302,0,2,604],[302,0,2,604]];
  const boundary = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x697a6f,roughness:1}),boundaryLayout.length);
  boundaryLayout.forEach(([x,z,sx,sz],i)=>{
    bodies.push(new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(sx/2,2,sz/2)),position:new CANNON.Vec3(x,2,z)}));
    obj.position.set(x,0.7,z);obj.rotation.set(0,0,0);obj.scale.set(sx,1.4,sz);obj.updateMatrix();boundary.setMatrixAt(i,obj.matrix);
  });
  boundary.name='world-boundary';boundary.computeBoundingSphere();group.add(boundary);
  const points=[new THREE.Vector3(3,0,-260),new THREE.Vector3(3,0,-259),new THREE.Vector3(3,0,-258)];
  const tangents=points.map(()=>new THREE.Vector3(0,0,1));
  return {meta:{id:'village-world-v1',mode:'simple',presetId:null,seed:91842,createdAt:0,version:TRACK_VERSION},points,tangents,lengths:[0,1,2],totalLength:2,roadWidth:WORLD_ROAD_WIDTH,halfWidths:points.map(()=>WORLD_ROAD_WIDTH/2),barrierHeight:CAR.height,group,physics:{ground,barriers:bodies},barrierAabbs:[],roadGeometry:{positions:[],indices:[]},terrain:null};
}
