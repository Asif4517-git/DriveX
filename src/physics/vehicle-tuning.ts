import { CAR } from '../config';

/**
 * 车辆物理调参常量（唯一入口）。
 *
 * 这里只放“会改变手感/稳定性”的数值：仿真结构（shape 布局、事件、状态机）仍留在
 * `vehicle.ts`。调参时只需要看本文件，避免数值散落在类字段、内联对象和方法字面量中。
 *
 * 单位约定：距离 m、速度 m/s、力 N、力矩 N·m、角度 rad。
 */

// ── 步进 / 世界 ─────────────────────────────────────────────
/** 物理固定子步（1/60 经实测最稳定；120Hz 会导致松油俯仰失稳翻车） */
export const FIXED_TIME_STEP = 1 / 60;
export const MAX_SUBSTEPS = 3;
export const GRAVITY = -9.81;

// ── 车身 / 悬架 ─────────────────────────────────────────────
export const CHASSIS_MASS = 750;
/** 线性阻尼模拟空气阻力/滚动阻力，避免松油门后滑行过长 */
export const CHASSIS_LINEAR_DAMPING = 0.05;
/** 角阻尼 0.75：1.0 会让 cannon 每步直接清零角速度，旋转动力学失真（2026-10-23 教训） */
export const CHASSIS_ANGULAR_DAMPING = 0.75;
/** 整车单一碰撞盒：高度取车高的该比例，长度两端各内缩 0.05m */
export const CHASSIS_SHAPE_HEIGHT_RATIO = 0.26;
export const CHASSIS_SHAPE_LENGTH_INSET = 0.05;
/** 碰撞盒中心下移（重心下移），车身更贴地、降低抬头力矩 */
export const CHASSIS_SHAPE_OFFSET_Y = -0.1;

/** 悬架加硬、行程缩短，抑制刹车/加速时的俯仰振荡（防止高速前翻） */
export const SUSPENSION_STIFFNESS = 45;
export const SUSPENSION_REST_LENGTH = 0.38;
export const MAX_SUSPENSION_TRAVEL = 0.25;
export const WHEEL_FRICTION_SLIP = 3.2;
export const DAMPING_RELAXATION = 6.0;
/** 前/后悬架压缩阻尼：对静态 squat 无效（只抗瞬态，实测差分加强反而伤复杂地形冲击缓冲，已撤销） */
export const FRONT_DAMPING_COMPRESSION = 14;
export const MAX_SUSPENSION_FORCE = 200000;
export const ROLL_INFLUENCE = 0.05;
export const CUSTOM_SLIDING_ROTATIONAL_SPEED = 30;
/** 车轮布局：前后轴距 = 车长 × 0.37；轮距 = 车宽/2 + 0.15；轮心相对底盘原点下移 0.24m */
export const WHEEL_Z_RATIO = 0.37;
export const WHEEL_X_EXTRA = 0.15;
export const WHEEL_Y_OFFSET = -0.24;
/** 底盘原点在静止时的离地高度（|连接点y| + 悬架静止长 + 轮半径 + 0.03 落差），重生/出生用 */
export const CHASSIS_SPAWN_HEIGHT =
  Math.abs(WHEEL_Y_OFFSET) + SUSPENSION_REST_LENGTH + CAR.wheelRadius + 0.03;

// ── 动力 / 传动 ─────────────────────────────────────────────
// Moderate drive force for smoother, more controllable acceleration.
export const ENGINE_FORCE = 3200;
/** 四驱（2026-10-23 用户要求）：前轴每轮额外叠加 force × 0.5，前轴总驱动力 ≈ 后轴一半。
 *  前轮悬空时自然回退为纯后驱；倒车+转向时四轮全给满力。调 0.35 更后偏、0.6 更前偏。 */
export const FRONT_DRIVE_RATIO = 0.5;
/** Throttle smoothing rate (/s); release is faster than application. */
export const THROTTLE_RAMP_RATE = 5;
export const THROTTLE_RAMP_RELEASE_MULTIPLIER = 2.5;
/** 刹车偏置：前轮 0.6、后轮 (2−0.6)=1.4（总容量守恒）——后偏压制急刹点头 */
export const BRAKE_BIAS_FRONT = 0.6;
export const BRAKE_FORCE = 55;
export const ENGINE_BRAKE = 50;
/** 单纯松油门（无转向）的滑行制动，缓慢减速；带转向时用 ENGINE_BRAKE 快速降速 */
export const COAST_BRAKE = 4;
export const REVERSE_FORCE_RATIO = 0.65;
/** 倒车最高速度（m/s）：普通 8 ≈ 29km/h；倒车+转向 10 ≈ 36km/h */
export const REVERSE_MAX_SPEED = 8;
export const REVERSE_TURN_MAX_SPEED = 10;
/** 前进极速 200km/h */
export const FORWARD_MAX_SPEED = 200 / 3.6;
/** 接近极速时渐入削减动力：0.85 倍处开始，0.13 倍区间内完全切断 */
export const SPEED_TAPER_START_RATIO = 0.85;
export const SPEED_TAPER_RANGE_RATIO = 0.13;
/** 判定“正在倒车”的纵向速度阈值（m/s） */
export const REVERSE_DETECT_SPEED = -0.5;

// ── 转向 ───────────────────────────────────────────────────
/** 低速最大转向角 37°、高速最小 7°（STEER_FALLOFF_SPEED 处到底，≈162km/h） */
export const MAX_STEER_SLOW = 0.65;
export const MAX_STEER_FAST = 0.12;
export const STEER_FALLOFF_SPEED = 45;
/** 转向输入死区：低于该值视为回正/无转向 */
export const STEER_INPUT_DEADZONE = 0.05;
/** 满舵动力损失：转向越深动力越低（满舵约 55% 动力，出弯线性恢复） */
export const STEER_FORCE_LOSS_AT_FULL_LOCK = 0.45;
/** 转向梯形速度曲线（2026-10-25 用户反馈“左右向控制不够顺滑”，替换指数平滑）：
 *  v ≤ VMAX、|dv| ≤ ACCEL·dt（软启动）、v ≤ √(2·ACCEL·剩余角)（零过冲贴齐）。 */
export const STEER_SLEW_VMAX = 4.2;
export const STEER_SLEW_ACCEL = 38;
/** 高速 vmax 加成：45m/s 时 vmax×2.3；高速目标角小，近乎即时到位，减少前轮冲量停留 */
export const STEER_SLEW_SPEED_POWER = 1.3;

// ── 漂移 / 抓地 ────────────────────────────────────────────
/** 漂移状态（HUD 用）：进入/退出侧偏角阈值（rad）与最低进入/退出速度（m/s） */
export const DRIFT_SLIP_ENTER = 0.35;
export const DRIFT_SLIP_EXIT = 0.15;
export const DRIFT_MIN_SPEED = 8;
export const DRIFT_EXIT_MIN_SPEED = 4;
/** 抓地：前轴（转向轮）5——横向加速度 ≈1.4g，低于整车倾翻阈值（≈1.8g）；
 *  2026-10-23 实测前轴 10（≈2.8g）满舵兜圈直接侧翻 */
export const GRIP_FRONT = 5;
/** 后轴 3.5（2026-10-26 十字路口可达性 +0.3）：满舵深弯更快进入稳态弧线 */
export const GRIP_REAR = 3.5;
/** 前轴滑移时抓地滚动衰减（0.2→0.5 rad 间从 5 降到 3.8） */
export const GRIP_FRONT_SLIDING = 3.8;
export const GRIP_ROLL_START = 0.2;
export const GRIP_ROLL_END = 0.5;
/** 侧滑抑制：侧偏角超过该值后抑制强度线性衰减到 0 */
export const CENTERING_SLIP_FADE = 0.9;
/** 侧滑抑制强度保底（比例）：深侧滑也不至于完全不抑制 */
export const CENTERING_SLIP_FLOOR = 0.3;
/** 侧滑抑制强度（/s）：无转向输入时横向速度的衰减速率基准 */
export const CENTERING_STRENGTH = 4;
/** 松键回正（无转向输入）生效的最低车速与最小横向速度 */
export const CENTERING_MIN_SPEED = 2;
export const CENTERING_MIN_LATERAL_SPEED = 0.05;
/** 侧偏角计算的前向速度下限（m/s），避免低速时 atan2 除零/噪声 */
export const SLIP_FORWARD_SPEED_FLOOR = 0.5;

// ── 姿态稳定 / 防翻 ────────────────────────────────────────
/** 滚转稳定：接地时 up.y 低于该阈值才施加反侧倾力矩 */
export const ROLL_STAB_UP_LIMIT = 0.97;
export const ROLL_STAB_TORQUE_MAX = 30000;
export const ROLL_STAB_P = 160000;
export const ROLL_STAB_D = 12000;
/** 防抬头 PD 反扭矩上限：≥2 轮接地 20000；空中/坡顶 <2 轮接触时允许更大（48000） */
export const PITCH_COUNTER_MAX = 20000;
export const PITCH_COUNTER_AIR_MAX = 48000;
/** 防抬头 PD：阈值低于“前轮悬垂落空”的俯仰角，满油门不误压前轮 */
export const PITCH_COUNTER_THRESHOLD = 0.03;
export const PITCH_COUNTER_P = 160000;
export const PITCH_COUNTER_D = 8000;
/** 抗 squat 前馈：低头反扭矩 = FACTOR × 总驱动力（N·m/N）。
 *  0.55=完全抵消；实测 0.45 接地率 58%，0.55 会压空后轴（已弃）。结构上限 12000。 */
export const ATI_SQUAT_FACTOR = 0.45;
export const ATI_SQUAT_MAX = 12000;
/** squat 速度门 <30m/s：只在起步/中速大油门介入；高速稳态过弯必须关闭 */
export const SQUAT_SPEED_GATE = 30;
/** 空中角速度阻尼（/s）：四轮全离地时温和衰减角速度，防抬头 PD 空中振荡 */
export const AIR_ANGULAR_DAMPING = 1.2;
/** 四轮全离地时的上升速度上限（m/s）：只防极端弹射，下落交给重力 */
export const MAX_AIR_UPWARD_SPEED = 2.0;

// ── 碰撞响应 ───────────────────────────────────────────────
/** 撞护栏后沿接触法线的回弹比例，最低回弹速度 0.8m/s，整体保留 80% 速度 */
export const COLLISION_BOUNCE = 0.35;
export const COLLISION_MIN_REBOUND = 0.8;
export const COLLISION_SPEED_RETAIN = 0.8;
/** 低于该法向冲击速度（m/s）不主动回弹（贴墙低速接触不抖动） */
export const COLLISION_MIN_IMPACT = 1.2;
/** 法向速度仍朝向护栏的判定阈值（m/s） */
export const COLLISION_NORMAL_SPEED_THRESHOLD = 0.5;

/** Contact-weighted arcade stability assistance during ordinary steering (/s). */
export const CORNERING_LATERAL_DAMPING = 3;
