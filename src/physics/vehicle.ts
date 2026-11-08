import * as CANNON from 'cannon-es';
import { CAR } from '../config';
import {
  AIR_ANGULAR_DAMPING,
  ATI_SQUAT_FACTOR,
  ATI_SQUAT_MAX,
  BRAKE_BIAS_FRONT,
  BRAKE_FORCE,
  CENTERING_MIN_LATERAL_SPEED,
  CENTERING_MIN_SPEED,
  CENTERING_SLIP_FADE,
  CENTERING_SLIP_FLOOR,
  CENTERING_STRENGTH,
  CHASSIS_ANGULAR_DAMPING,
  CHASSIS_LINEAR_DAMPING,
  CHASSIS_MASS,
  CHASSIS_SHAPE_HEIGHT_RATIO,
  CHASSIS_SHAPE_LENGTH_INSET,
  CHASSIS_SHAPE_OFFSET_Y,
  COAST_BRAKE,
  CORNERING_LATERAL_DAMPING,
  COLLISION_BOUNCE,
  COLLISION_MIN_IMPACT,
  COLLISION_MIN_REBOUND,
  COLLISION_NORMAL_SPEED_THRESHOLD,
  COLLISION_SPEED_RETAIN,
  CUSTOM_SLIDING_ROTATIONAL_SPEED,
  DAMPING_RELAXATION,
  DRIFT_EXIT_MIN_SPEED,
  DRIFT_MIN_SPEED,
  DRIFT_SLIP_ENTER,
  DRIFT_SLIP_EXIT,
  ENGINE_BRAKE,
  ENGINE_FORCE,
  FIXED_TIME_STEP,
  FORWARD_MAX_SPEED,
  FRONT_DAMPING_COMPRESSION,
  FRONT_DRIVE_RATIO,
  GRAVITY,
  GRIP_FRONT,
  GRIP_FRONT_SLIDING,
  GRIP_REAR,
  GRIP_ROLL_END,
  GRIP_ROLL_START,
  MAX_AIR_UPWARD_SPEED,
  MAX_STEER_FAST,
  MAX_STEER_SLOW,
  MAX_SUBSTEPS,
  MAX_SUSPENSION_FORCE,
  MAX_SUSPENSION_TRAVEL,
  PITCH_COUNTER_AIR_MAX,
  PITCH_COUNTER_D,
  PITCH_COUNTER_MAX,
  PITCH_COUNTER_P,
  PITCH_COUNTER_THRESHOLD,
  REVERSE_DETECT_SPEED,
  REVERSE_FORCE_RATIO,
  REVERSE_MAX_SPEED,
  REVERSE_TURN_MAX_SPEED,
  ROLL_INFLUENCE,
  ROLL_STAB_D,
  ROLL_STAB_P,
  ROLL_STAB_TORQUE_MAX,
  ROLL_STAB_UP_LIMIT,
  SLIP_FORWARD_SPEED_FLOOR,
  SPEED_TAPER_RANGE_RATIO,
  SPEED_TAPER_START_RATIO,
  SQUAT_SPEED_GATE,
  STEER_FALLOFF_SPEED,
  STEER_INPUT_DEADZONE,
  STEER_SLEW_ACCEL,
  STEER_SLEW_SPEED_POWER,
  STEER_SLEW_VMAX,
  SUSPENSION_REST_LENGTH,
  SUSPENSION_STIFFNESS,
  THROTTLE_RAMP_RATE,
  THROTTLE_RAMP_RELEASE_MULTIPLIER,
  WHEEL_FRICTION_SLIP,
  WHEEL_X_EXTRA,
  WHEEL_Y_OFFSET,
  WHEEL_Z_RATIO,
} from './vehicle-tuning';

export { CHASSIS_SPAWN_HEIGHT } from './vehicle-tuning';

export interface VehicleInput {
  throttle: number;
  brake: number;
  steering: number;
  handbrake?: boolean;
  driveFactor?: number;
}

export interface VehicleState {
  position: CANNON.Vec3;
  quaternion: CANNON.Quaternion;
  forward: CANNON.Vec3;
  up: CANNON.Vec3;
  velocity: CANNON.Vec3;
  angularVelocity: CANNON.Vec3;
  forwardSpeed: number;
  absoluteSpeed: number;
}

/** cannon-es 四轮车辆（RaycastVehicle 悬架） */
export class CarPhysics {
  readonly world: CANNON.World;
  readonly chassis: CANNON.Body;
  /** 物理固定子步与最大追赶步数（见 vehicle-tuning） */
  fixedTimeStep = FIXED_TIME_STEP;
  maxSubSteps = MAX_SUBSTEPS;
  /** 碰撞到护栏时的回调（参数为法向冲击速度 m/s） */
  onBarrierCollide: ((impactSpeed: number) => void) | null = null;
  private readonly vehicle: CANNON.RaycastVehicle;
  private readonly barrierIds = new Set<number>();
  private readonly onCollide: (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => void;
  /** 本步内最强的一次护栏接触（在 step 后统一施加回弹） */
  private barrierHit: { body: CANNON.Body; normal: CANNON.Vec3; impact: number } | null = null;
  private steerCurrent = 0;
  /** 转向轮角速度（梯形跟踪器状态，reset 清零） */
  private steerVel = 0;
  /** 油门缓入状态：平滑后的踏板量（0-1，reset 归零） */
  private throttleActual = 0;
  private drift = false;

  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // 整车单一碰撞盒（2026-10-20 用户要求：以小车为一个完整模型判断碰撞，不再有轮位附加碰撞盒）
    // 底盘与车身同宽、覆盖全车；重心低、离地高
    const chassisShape = new CANNON.Box(
      new CANNON.Vec3(CAR.width / 2, CAR.height * CHASSIS_SHAPE_HEIGHT_RATIO, CAR.length / 2 - CHASSIS_SHAPE_LENGTH_INSET),
    );
    this.chassis = new CANNON.Body({
      mass: CHASSIS_MASS,
      // 线性阻尼模拟空气阻力/滚动阻力，避免松油门后滑行过长
      linearDamping: CHASSIS_LINEAR_DAMPING,
      // 角阻尼：1.0 会让 cannon 按 pow(1-1,dt)=0 每步直接清零角速度，旋转动力学完全失真
      angularDamping: CHASSIS_ANGULAR_DAMPING,
    });
    // 重心下移（碰撞盒下偏），车身也更贴近路面，降低抬头力矩
    this.chassis.addShape(chassisShape, new CANNON.Vec3(0, CHASSIS_SHAPE_OFFSET_Y, 0));

    // y-up 坐标系：right=X(0)、forward=Z(2)、up=Y(1)。
    // 默认值 (right=Z, forward=X, up=Y) 会让油门/转向偏 90°，车辆无法正常驾驶。
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassis,
      indexRightAxis: 0,
      indexForwardAxis: 2,
      indexUpAxis: 1,
    });

    const wheelOptionsBase = {
      radius: CAR.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: SUSPENSION_STIFFNESS,
      suspensionRestLength: SUSPENSION_REST_LENGTH,
      maxSuspensionTravel: MAX_SUSPENSION_TRAVEL,
      frictionSlip: WHEEL_FRICTION_SLIP,
      dampingRelaxation: DAMPING_RELAXATION,
      dampingCompression: FRONT_DAMPING_COMPRESSION,
      maxSuspensionForce: MAX_SUSPENSION_FORCE,
      rollInfluence: ROLL_INFLUENCE,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      useCustomSlidingRotationalSpeed: true,
      customSlidingRotationalSpeed: CUSTOM_SLIDING_ROTATIONAL_SPEED,
    };

    const zFront = CAR.length * WHEEL_Z_RATIO;
    const zRear = -CAR.length * WHEEL_Z_RATIO;
    // 轮距略宽于车身，前轮在追尾视角下可见
    const xOffset = CAR.width / 2 + WHEEL_X_EXTRA;
    const yOffset = WHEEL_Y_OFFSET;
    for (const [x, z] of [
      [-xOffset, zFront],
      [xOffset, zFront],
      [-xOffset, zRear],
      [xOffset, zRear],
    ]) {
      this.vehicle.addWheel({
        ...wheelOptionsBase,
        chassisConnectionPointLocal: new CANNON.Vec3(x, yOffset, z),
      });
    }
    this.vehicle.addToWorld(this.world);
    this.world.addBody(this.chassis);

    this.onCollide = (event) => {
      if (!this.barrierIds.has(event.body.id)) return;
      const contact = event.contact;
      if (!contact) return;
      const impact = Math.abs(contact.getImpactVelocityAlongNormal?.() ?? 0);
      if (impact > 0) {
        this.onBarrierCollide?.(impact);
        // 记录最强冲击，step 后统一施加“立即回弹 + 适当减速”（见 update 尾部）
        if (!this.barrierHit || impact > this.barrierHit.impact) {
          // 接触法线 ni 统一取“从障碍指向车身”的方向：若反向则翻转。
          // 必须用接触点而不是 event.body.position：compound body 的 position 是 chunk 原点，
          // 不代表实际碰撞段的位置，用它判断会把法线方向判反（回弹把车推向护栏内侧）。
          const n = contact.ni.clone();
          const contactPoint = new CANNON.Vec3();
          if (contact.bi === this.chassis) {
            contact.bi.position.vadd(contact.ri, contactPoint);
          } else {
            contact.bj.position.vadd(contact.rj, contactPoint);
          }
          const away = this.chassis.position.vsub(contactPoint);
          if (away.length() > 0 && n.dot(away) < 0) n.negate(n);
          this.barrierHit = { body: event.body, normal: n, impact };
        }
      }
    };
    this.chassis.addEventListener('collide', this.onCollide);
  }

  addGround(body: CANNON.Body): void {
    // 防御性刷新：静态体创建后手动设置 position/quaternion 时 AABB 不会自动更新，
    // 错误的 AABB 会让 SAPBroadphase 排序错位并跳过碰撞对（穿墙/穿地）。
    body.updateAABB();
    this.world.addBody(body);
  }

  markBarrier(body: CANNON.Body): void {
    this.barrierIds.add(body.id);
  }

  /** 速度敏感最大转向角：低速 MAX_STEER_SLOW，高速平滑衰减到 MAX_STEER_FAST */
  maxSteerAt(speed: number): number {
    const t = Math.min(1, Math.max(0, speed) / STEER_FALLOFF_SPEED);
    // 幂 1.7 衰减（2026-10-26 十字路口可达性调优：原二次 ease-out 在速度前段丢角太快，
    // 低中速欠转；改幂曲线低速多留 ~7%、中速（19.4m/s）多留 ~18%，高速端点不变）
    const eased = 1 - Math.pow(1 - t, 1.7);
    return MAX_STEER_SLOW + (MAX_STEER_FAST - MAX_STEER_SLOW) * eased;
  }

  /** 车身侧偏角（rad）：横向速度相对前进速度的 atan2（取绝对值） */
  private computeSlipAngle(): number {
    const fwd = new CANNON.Vec3(0, 0, 1);
    this.chassis.quaternion.vmult(fwd, fwd);
    const right = new CANNON.Vec3(1, 0, 0);
    this.chassis.quaternion.vmult(right, right);
    const v = this.chassis.velocity;
    const fwdComp = Math.max(Math.abs(v.dot(fwd)), SLIP_FORWARD_SPEED_FLOOR);
    return Math.atan2(Math.abs(v.dot(right)), fwdComp);
  }

  /**
   * 转向梯形速度曲线跟踪器（rad、rad/s 态机）：
   * 目标角速度受三约束：|v| ≤ vmax（速度门随速加成）、v 不超过 √(2·a·剩余角)
   * （恰好停在目标 → 无过冲）、|Δv| ≤ a·dt（限加速度 → 软启动/软停止）。
   * 打角与回正共用同一跟踪器（松手回正同样受制动约束，不再"匀速冲到 0 再突停"）。
   */
  private trackSteer(target: number, dt: number): void {
    const diff = target - this.steerCurrent;
    if (Math.abs(diff) < 1e-5) {
      this.steerCurrent = target;
      this.steerVel = 0; // 贴齐即清残留速度，避免下一步轻推轮角
      return;
    }
    const speedT = Math.min(1, Math.max(0, this.forwardSpeed()) / STEER_FALLOFF_SPEED);
    const vmax = STEER_SLEW_VMAX * (1 + STEER_SLEW_SPEED_POWER * speedT);
    const goalVel = Math.sign(diff) * Math.min(vmax, Math.sqrt(2 * STEER_SLEW_ACCEL * Math.abs(diff)));
    const dvMax = STEER_SLEW_ACCEL * dt;
    this.steerVel += Math.max(-dvMax, Math.min(dvMax, goalVel - this.steerVel));
    const next = this.steerCurrent + this.steerVel * dt;
    // 数值兜底：越目标即贴齐并把速度清零（正常被制动约束自然拦下，罕见于积分量化边界）
    if ((next - target) * diff >= 0 || Math.abs(next - target) < 1e-5) {
      this.steerCurrent = target;
      this.steerVel = 0;
      return;
    }
    this.steerCurrent = next;
  }

  update(input: VehicleInput, dt: number): void {
    // 转向角随速度衰减（速度敏感转向）：低速灵活，高速收敛
    const targetSteer = input.steering * this.maxSteerAt(Math.abs(this.forwardSpeed()));
    // 梯形跟踪：打角/回正统一走"角加速度受限 + vmax + 二次制动"速度曲线（常量区注释）；
    // 高速 vmax 加成沿用旧设计动机——松键后转向角不在前轮冲量上多停留（yaw 惯量甩尾根源）
    this.trackSteer(targetSteer, dt);

    // 油门缓入：踏板指令指数平滑后再进入动力计算（起步不窜、四驱前轴咬合更稳）；松油门回零更快
    const throttleRate = input.throttle !== 0 ? THROTTLE_RAMP_RATE : THROTTLE_RAMP_RATE * THROTTLE_RAMP_RELEASE_MULTIPLIER;
    this.throttleActual += (input.throttle - this.throttleActual) * Math.min(1, throttleRate * dt);

    const slipAngle = this.computeSlipAngle();
    const absSpeed = this.chassis.velocity.length();

    // 漂移状态机（侧偏角驱动，带迟滞）：高速 + 大侧偏进入，侧偏回落或车辆降速退出。
    if (!this.drift) {
      if (absSpeed > DRIFT_MIN_SPEED && slipAngle > DRIFT_SLIP_ENTER) this.drift = true;
    } else if (slipAngle < DRIFT_SLIP_EXIT || absSpeed < DRIFT_EXIT_MIN_SPEED) {
      this.drift = false;
    }

    // Road-contact stability aid: damp horizontal side velocity during normal
    // cornering as well as recovery. Contact weighting prevents an airborne car
    // from being pulled sideways; handbrake intentionally relaxes the assist.
    const contactCount = this.vehicle.wheelInfos.filter(w => w.isInContact).length;
    if (contactCount >= 2 && this.chassis.velocity.length() > CENTERING_MIN_SPEED) {
      const right = new CANNON.Vec3(1, 0, 0);
      this.chassis.quaternion.vmult(right, right);
      right.y = 0;
      if (right.lengthSquared() > 1e-6) {
        right.normalize();
        const lateralSpeed = this.chassis.velocity.dot(right);
        if (Math.abs(lateralSpeed) > CENTERING_MIN_LATERAL_SPEED) {
          const strength = input.handbrake ? 2.5 : Math.abs(input.steering) < STEER_INPUT_DEADZONE
            ? CENTERING_STRENGTH * Math.max(CENTERING_SLIP_FLOOR, 1 - slipAngle / CENTERING_SLIP_FADE)
            : CORNERING_LATERAL_DAMPING;
          const fraction = 1 - Math.exp(-strength * (contactCount / 4) * Math.max(0, dt));
          this.chassis.velocity.x -= right.x * lateralSpeed * fraction;
          this.chassis.velocity.z -= right.z * lateralSpeed * fraction;
        }
      }
    }

    // 前轴抓地随侧偏角滚动衰减；后轴保持低抓地（动力甩尾倾向）
    const gripT = Math.min(1, Math.max(0, (slipAngle - GRIP_ROLL_START) / (GRIP_ROLL_END - GRIP_ROLL_START)));
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      const w = this.vehicle.wheelInfos[i];
      w.frictionSlip = i < 2
        ? GRIP_FRONT + (GRIP_FRONT_SLIDING - GRIP_FRONT) * gripT
        : GRIP_REAR;
    }

    this.vehicle.setSteeringValue(this.steerCurrent, 0);
    this.vehicle.setSteeringValue(this.steerCurrent, 1);

    // RaycastVehicle 在 right=X(0)/forward=Z(2)/up=Y(1) 配置下，
    // 正发动机力会沿 -Z 推（实测倒车），因此取反：正油门 = 向前(+Z)。
    let force = -this.throttleActual * ENGINE_FORCE * (input.driveFactor ?? 1);
    // Steering no longer cuts engine power: tire contact determines cornering.
    if (this.throttleActual > 0) {
      const fwdSpeed = this.forwardSpeed();
      // 前进限速 200km/h：接近上限时渐入削减动力，避免惯性超调（在 0.98×上限处完全切断）
      if (fwdSpeed >= FORWARD_MAX_SPEED * SPEED_TAPER_START_RATIO) {
        const taper = Math.max(0, 1 - (fwdSpeed - FORWARD_MAX_SPEED * SPEED_TAPER_START_RATIO) / (FORWARD_MAX_SPEED * SPEED_TAPER_RANGE_RATIO));
        force *= taper;
      }
      // 过弯限速“50km/h 硬截断 + ramp 刹车”已移除：转向能力改为随速度衰减（maxSteerAt），
      // 高速过弯靠动力削减与抓地下降自然受限，不再有“撞限速墙”感。
      // 防抬头后翻：PD 反扭矩（等效“防抬头杠”）——抬角度数取“车头相对路面法线的带符号角”
      // （asin(forward·normal)）：车身贴合坡面时天然 ≈0（斜坡不误伤），越过 90°（倒栽）方向依旧正确——
      // 2026-10-23 实测：acos(up·normal) 版在越过 90° 后会把已经翻过头的车继续往旋转方向推，转为失控空翻
      const groundNormal = new CANNON.Vec3(0, 1, 0);
      let groundCount = 0;
      for (const w of this.vehicle.wheelInfos) {
        if (w.isInContact && w.raycastResult.hitNormalWorld) {
          groundNormal.vadd(w.raycastResult.hitNormalWorld, groundNormal);
          groundCount++;
        }
      }
      groundNormal.normalize();

      // 抗 squat 前馈：推进力作用于接地点（重心下方），惯性反作用掀起车头（静态平衡，
      // 悬架差分压缩阻尼无效——实测 21/120 接地率）。施加与总驱动力成比例的低头反扭矩，
      // 保持前轮接地让四驱前轴在直线也生效；空中不介入（groundCount=0 时跳过）。
      // 速度门 <30m/s：squat 只在起步/中速大油门真实发生；高速满舵稳态过弯阶段必须关闭，
      // 否则稳态侧偏翻倍（实测 0.35/0.45 系数下均如此）。
      if (groundCount > 0 && fwdSpeed < SQUAT_SPEED_GATE) {
        const totalDrive = 2 * Math.abs(force) * (1 + FRONT_DRIVE_RATIO);
        const squatCounter = Math.min(ATI_SQUAT_MAX, ATI_SQUAT_FACTOR * totalDrive);
        const rightAxis = new CANNON.Vec3(1, 0, 0);
        this.chassis.quaternion.vmult(rightAxis, rightAxis);
        this.chassis.torque.x += rightAxis.x * squatCounter;
        this.chassis.torque.y += rightAxis.y * squatCounter;
        this.chassis.torque.z += rightAxis.z * squatCounter;
      }

      const fwdNow = new CANNON.Vec3(0, 0, 1);
      this.chassis.quaternion.vmult(fwdNow, fwdNow);
      const pitchUp = Math.asin(Math.max(-1, Math.min(1, fwdNow.dot(groundNormal))));
      // 阈值低于“前轮悬垂落空”的俯仰角，满油门不误压前轮
      if (pitchUp > PITCH_COUNTER_THRESHOLD) {
        const right = new CANNON.Vec3(1, 0, 0);
        this.chassis.quaternion.vmult(right, right);
        const pitchRate = -this.chassis.angularVelocity.dot(right); // 正=抬头速率
        // 接地轮 <2 时认为“即将离地/坡顶冲出”，启用空中加强版反扭矩压制后空翻
        const counter = Math.min(
          groundCount < 2 ? PITCH_COUNTER_AIR_MAX : PITCH_COUNTER_MAX,
          PITCH_COUNTER_P * pitchUp + PITCH_COUNTER_D * Math.max(0, pitchRate),
        );
        this.chassis.torque.x += right.x * counter;
        this.chassis.torque.y += right.y * counter;
        this.chassis.torque.z += right.z * counter;
      }
    } else if (input.throttle < 0) {
      // 倒车限制：更小的加速力 + 最高倒车速度
      // 倒车+转向时给满反向动力，让倒车转弯能实际达到 10 m/s 上限
      const reverseRatio = REVERSE_FORCE_RATIO;
      force = -this.throttleActual * ENGINE_FORCE * reverseRatio * (input.driveFactor ?? 1);
      const reverseMax = REVERSE_MAX_SPEED;
      if (this.forwardSpeed() < -reverseMax || this.chassis.velocity.length() > reverseMax) {
        force = 0;
      }
    }
    // 四驱：前轴每轮额外叠加 force × FRONT_DRIVE_RATIO（前轮接地时才实际产生推力，前轮悬空
    // 时自然回退为纯后驱）；倒车+转向时四轮全给满力（保证倒车转弯能加速到 10 m/s 上限，同旧逻辑）。
    // 四轮每帧必须都设置：cannon 的 wheel.engineForce 跨帧残留，漏设会让上一帧的动力延续。
    const frontForce = force * FRONT_DRIVE_RATIO;
    this.vehicle.applyEngineForce(frontForce, 0);
    this.vehicle.applyEngineForce(frontForce, 1);
    this.vehicle.applyEngineForce(force, 2);
    this.vehicle.applyEngineForce(force, 3);

    // 松油门且不踩刹车时施加制动：无转向只缓慢滑行；按住左右键或正在倒车则快速降速
    const reversing = this.forwardSpeed() < REVERSE_DETECT_SPEED;
    const engineBrake = input.throttle === 0 && input.brake === 0
      ? (reversing ? ENGINE_BRAKE : COAST_BRAKE)
      : 0;
    const brake = Math.max(input.brake * BRAKE_FORCE, engineBrake);
    // 刹车偏置：前 0.6 / 后 1.4（总容量守恒 4×brake）——后偏压制急刹点头，同时前轮保留转向抓地
    this.vehicle.setBrake(brake * BRAKE_BIAS_FRONT, 0);
    this.vehicle.setBrake(brake * BRAKE_BIAS_FRONT, 1);
    const rearBrake = Math.max(brake * (2 - BRAKE_BIAS_FRONT), input.handbrake ? BRAKE_FORCE * 0.65 : 0);
    this.vehicle.setBrake(rearBrake, 2);
    this.vehicle.setBrake(rearBrake, 3);

    // 空中姿态阻尼（完全离地时）：温和衰减角速度——防抬头 PD 在空中不会 bang-bang 振荡，落地更顺。
    // 缓慢（~1.2/s），不影响正常跳跃的抛物线与坡顶空中 PD 的救车能力。
    if (this.vehicle.wheelInfos.every((w) => !w.isInContact)) {
      const airDamp = Math.max(0, 1 - AIR_ANGULAR_DAMPING * dt);
      this.chassis.angularVelocity.scale(airDamp, this.chassis.angularVelocity);
    }

    // 滚转稳定（街机防翻辅助）：接地且车身明显侧倾（up.y 低）时，沿车头方向施加反侧倾力矩。
    // 防止“油门+满舵”过弯或山坡瞬态侧翻（角阻尼 1.0 曾每步清零角速度，掩盖了翻车；
    // 降到真实动力学后需要这个辅助保持街机可控感）。空中不介入，落地仍会自然翻转/弹跳。
    {
      let rollWheels = 0;
      for (const w of this.vehicle.wheelInfos) {
        if (w.isInContact) rollWheels++;
      }
      if (rollWheels > 0) {
        const upNow = new CANNON.Vec3(0, 1, 0);
        this.chassis.quaternion.vmult(upNow, upNow);
        if (upNow.y < ROLL_STAB_UP_LIMIT) {
          const rightNow = new CANNON.Vec3(1, 0, 0);
          this.chassis.quaternion.vmult(rightNow, rightNow);
          const fwdNow = new CANNON.Vec3(0, 0, 1);
          this.chassis.quaternion.vmult(fwdNow, fwdNow);
          // 侧倾角：右轴竖直分量>0 = 右侧抬起（车体向左滚转）；>1 侧 = 反向
          const roll = Math.asin(Math.max(-1, Math.min(1, rightNow.y)));
          const rollRate = this.chassis.angularVelocity.dot(fwdNow);
          const counter = Math.min(ROLL_STAB_TORQUE_MAX, ROLL_STAB_P * roll + ROLL_STAB_D * rollRate);
          this.chassis.torque.x -= fwdNow.x * counter;
          this.chassis.torque.y -= fwdNow.y * counter;
          this.chassis.torque.z -= fwdNow.z * counter;
        }
      }
    }

    this.world.step(this.fixedTimeStep, dt, this.maxSubSteps);

    // 空中垂直速度钳制：四轮离地时限制上升速度，避免高速上坡/过顶时飞太高
    let wheelsOnGround = 0;
    for (const w of this.vehicle.wheelInfos) {
      if (w.isInContact) wheelsOnGround++;
    }
    // 倒车+转向的绝对速度钳制（HUD 上限 10 m/s ≈ 36 km/h）
    if (input.throttle < 0 && Math.abs(input.steering) > STEER_INPUT_DEADZONE) {
      const v = this.chassis.velocity;
      const len = v.length();
      if (len > REVERSE_TURN_MAX_SPEED) {
        v.scale(REVERSE_TURN_MAX_SPEED / len, v);
      }
    }
    if (wheelsOnGround === 0 && this.chassis.velocity.y > MAX_AIR_UPWARD_SPEED) {
      this.chassis.velocity.y = MAX_AIR_UPWARD_SPEED;
    }

    // 碰撞响应：撞护栏后沿接触法线立即回弹，并整体适当减速（避免反弹后仍高速贴墙蹭行）。
    if (this.barrierHit) {
      const { normal, impact } = this.barrierHit;
      this.barrierHit = null;
      const v = this.chassis.velocity;
      const vn = v.dot(normal); // < 0 = 速度分量仍朝向护栏
      if (impact > COLLISION_MIN_IMPACT && vn < COLLISION_NORMAL_SPEED_THRESHOLD) {
        // 法向分量重置为向外反弹速度（0.35 × 冲击，最低 0.8m/s），切向保留
        const rebound = Math.max(COLLISION_BOUNCE * impact, COLLISION_MIN_REBOUND);
        v.vsub(normal.clone().scale(vn + rebound), v);
        // 整体减速：保留原速度的 80%
        v.scale(COLLISION_SPEED_RETAIN, v);
      }
    }
  }

  getState(): VehicleState {
    const forward = new CANNON.Vec3(0, 0, 1);
    this.chassis.quaternion.vmult(forward, forward);
    const up = new CANNON.Vec3(0, 1, 0);
    this.chassis.quaternion.vmult(up, up);
    const forwardSpeed = this.chassis.velocity.dot(forward);
    return {
      position: this.chassis.position,
      quaternion: this.chassis.quaternion,
      forward,
      up,
      velocity: this.chassis.velocity,
      angularVelocity: this.chassis.angularVelocity,
      forwardSpeed,
      absoluteSpeed: this.chassis.velocity.length(),
    };
  }

  reset(position: CANNON.Vec3, quaternion: CANNON.Quaternion): void {
    this.chassis.position.copy(position);
    this.chassis.quaternion.copy(quaternion);
    this.chassis.velocity.setZero();
    this.chassis.angularVelocity.setZero();
    // 传送后必须刷新 AABB：动态体虽然每步 integrate 会刷新，但重生当帧的 broadphase
    // 仍用旧位置 AABB，可能漏掉与重生点护栏的碰撞对。
    this.chassis.aabbNeedsUpdate = true;
    this.chassis.updateAABB();
    this.chassis.wakeUp();
    this.throttleActual = 0;
    // 旧实现只清 steerVel 不清 steerCurrent：玩家重生时仍按着方向键会带着满舵出弯，
    // 在发卡弯直接再次冲出赛道，形成“反复出轨”的观感。
    this.steerCurrent = 0;
    this.steerVel = 0;
    this.barrierHit = null;
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
    }
  }

  getWheelTransform(index: number): CANNON.Transform {
    // cannon-es updateWheelTransformWorld clears isInContact as a side effect.
    // Rendering must not erase the contact state used by next-frame stability,
    // grip and suspension assists.
    const wheel = this.vehicle.wheelInfos[index];
    const contact = wheel.isInContact;
    this.vehicle.updateWheelTransform(index);
    wheel.isInContact = contact;
    return wheel.worldTransform;
  }

  /** 调试用：当前各轮关键状态（接触/悬架力/侧向冲量/滑移标记） */
  debugWheelStates(): Array<{ isInContact: boolean; suspensionForce: number; sideImpulse: number; skidInfo: number; sliding: boolean; slipAngle: number }> {
    return this.vehicle.wheelInfos.map((w, i) => ({
      isInContact: w.isInContact,
      suspensionForce: w.suspensionForce,
      sideImpulse: w.sideImpulse,
      skidInfo: w.skidInfo,
      sliding: w.sliding,
      slipAngle: this.vehicle.wheelInfos[i].steering,
    }));
  }

  getSteering(): number {
    return this.steerCurrent;
  }

  getDrifting(): boolean {
    return this.drift;
  }

  /** 当前车身侧偏角（rad），供 HUD 与调试 */
  getSlipAngle(): number {
    return this.computeSlipAngle();
  }

  private forwardSpeed(): number {
    const fwd = new CANNON.Vec3(0, 0, 1);
    this.chassis.quaternion.vmult(fwd, fwd);
    return this.chassis.velocity.dot(fwd);
  }

  dispose(): void {
    this.chassis.removeEventListener('collide', this.onCollide);
    this.vehicle.removeFromWorld(this.world);
    this.world.removeBody(this.chassis);
  }
}
