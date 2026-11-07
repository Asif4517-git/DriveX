import { describe, expect, it } from 'vitest';
import * as CANNON from 'cannon-es';
import { CarPhysics, CHASSIS_SPAWN_HEIGHT } from '../src/physics/vehicle';
const dt=1/60;
function rig() {
  const p=new CarPhysics();
  const ground=new CANNON.Body({mass:0,shape:new CANNON.Plane()});
  ground.quaternion.setFromEuler(-Math.PI/2,0,0);p.addGround(ground);
  p.reset(new CANNON.Vec3(0,CHASSIS_SPAWN_HEIGHT,0),new CANNON.Quaternion());
  for(let i=0;i<120;i++)p.update({throttle:0,brake:0,steering:0},dt);
  return p;
}
function lateralSpeed(p:CarPhysics) {const s=p.getState();const right=new CANNON.Vec3(1,0,0);s.quaternion.vmult(right,right);return Math.abs(s.velocity.dot(right));}
describe('road handling regressions',()=>{
  it('accelerates smoothly and stays controllable through six seconds of steering',()=>{
    const p=rig();let idleMax=0;for(let i=0;i<240;i++){p.update({throttle:0,brake:0,steering:0},dt);idleMax=Math.max(idleMax,p.getState().absoluteSpeed)}
    let lastSpeed=0,maxStep=0,contactSamples=0;
    for(let i=0;i<180;i++){p.update({throttle:1,brake:0,steering:0},dt);const speed=p.getState().absoluteSpeed;maxStep=Math.max(maxStep,Math.abs(speed-lastSpeed));lastSpeed=speed;contactSamples+=(p as unknown as {vehicle:CANNON.RaycastVehicle}).vehicle.wheelInfos.filter(w=>w.isInContact).length;}
    expect(idleMax).toBeLessThan(.03);expect(lastSpeed).toBeGreaterThan(10);expect(maxStep).toBeLessThan(1);expect(contactSamples).toBeGreaterThan(180*2);
    let maxAngle=0,maxSide=0,minUp=1;
    for(let i=0;i<360;i++){p.update({throttle:1,brake:0,steering:.6},dt);const s=p.getState();const side=lateralSpeed(p);maxSide=Math.max(maxSide,side);maxAngle=Math.max(maxAngle,Math.atan2(side,Math.max(.5,Math.abs(s.forwardSpeed))));minUp=Math.min(minUp,s.up.y);}
    expect(maxSide).toBeLessThan(3);expect(maxAngle).toBeLessThan(.15);expect(minUp).toBeGreaterThan(.85);
    for(let i=0;i<60;i++)p.update({throttle:0,brake:0,steering:0},dt);
    expect(Math.abs(p.getSteering())).toBeLessThan(.01);p.dispose();
  });
  it('keeps an intentional handbrake slide possible',()=>{
    function run(handbrake:boolean){const p=rig();for(let i=0;i<130;i++)p.update({throttle:1,brake:0,steering:0},dt);let peak=0;for(let i=0;i<90;i++){p.update({throttle:.5,brake:0,steering:.8,handbrake},dt);peak=Math.max(peak,p.getSlipAngle());}p.dispose();return peak;}
    expect(run(true)).toBeGreaterThan(run(false)+.05);
  });
  it('does not weaken the service brake when the handbrake is also pressed',()=>{
    const p=rig();p.update({throttle:0,brake:1,steering:0,handbrake:false},dt);
    const wheels=(p as unknown as {vehicle:CANNON.RaycastVehicle}).vehicle.wheelInfos;
    const service=wheels[2].brake;
    p.update({throttle:0,brake:1,steering:0,handbrake:true},dt);
    expect(wheels[2].brake).toBeGreaterThanOrEqual(service);p.dispose();
  });
  it('does not apply sideways road assistance in mid-air and gravity still acts',()=>{
    const p=rig();p.reset(new CANNON.Vec3(0,20,0),new CANNON.Quaternion());p.chassis.velocity.set(5,0,0);
    for(let i=0;i<30;i++)p.update({throttle:0,brake:0,steering:1},dt);
    expect(p.chassis.velocity.x).toBeGreaterThan(4);expect(p.chassis.velocity.y).toBeLessThan(-2);p.dispose();
  });
});
