// cat-fk.js — Forward kinematics for the cat skeleton
// Ported from cat.frag computeAllJoints() and all dependencies.
// All vec3 values are [x, y, z] plain arrays.

import { CAT_CONFIG } from "./cat-config.js";

// ── Constants (must match cat.frag) ─────────────────────────────────────────

const PI = Math.PI;
const TAU = PI * 2;

const SP_LEN = [0.16, 0.15, 0.18, 0.10, 0.18];
const TL = [0.12, 0.12, 0.12, 0.06];
const LLAT = 0.10;

const EAR_TILT_BACK = -0.1;
const EAR_FLARE_OUT = 0.4;
const EAR_YAW_C = 0.5;

const RIBCAGE_RADII = [0.24, 0.17, 0.15];
const HAUNCH_RADII = [0.16, 0.14, 0.14];

// ── Math helpers ────────────────────────────────────────────────────────────

const { sin, cos, sqrt, abs, pow, min, max, floor } = Math;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function mix(a, b, t) {
  return a + (b - a) * t;
}
function step(edge, x) {
  return x < edge ? 0 : 1;
}
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function fract(x) {
  return x - floor(x);
}

// Vec3
function v3(x, y, z) {
  return [x, y, z];
}
function v3add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function v3sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function v3scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function v3mix(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
function v3len(a) {
  return sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

// In-place 2-component rotations matching GLSL: v.AB *= rot(a)
// where rot(a) = mat2(cos,-sin,sin,cos) and *= is row-vector * matrix.
// Result: new_A = A*cos - B*sin, new_B = A*sin + B*cos
function rotXZ(v, a) {
  const c = cos(a),
    s = sin(a);
  const x = v[0] * c - v[2] * s;
  const z = v[0] * s + v[2] * c;
  v[0] = x;
  v[2] = z;
}
function rotXY(v, a) {
  const c = cos(a),
    s = sin(a);
  const x = v[0] * c - v[1] * s;
  const y = v[0] * s + v[1] * c;
  v[0] = x;
  v[1] = y;
}
function rotYZ(v, a) {
  const c = cos(a),
    s = sin(a);
  const y = v[1] * c - v[2] * s;
  const z = v[1] * s + v[2] * c;
  v[1] = y;
  v[2] = z;
}
function rotZY(v, a) {
  const c = cos(a),
    s = sin(a);
  const z = v[2] * c - v[1] * s;
  const y = v[2] * s + v[1] * c;
  v[2] = z;
  v[1] = y;
}

// ── Pose interpolation ─────────────────────────────────────────────────────

function pval(id, v0, v1, v2, v3, v4, v5, v6) {
  if (id < 0.5) return v0;
  if (id < 1.5) return v1;
  if (id < 2.5) return v2;
  if (id < 3.5) return v3;
  if (id < 4.5) return v4;
  if (id < 5.5) return v5;
  return v6;
}

function vval(id, a0, a1, a2, a3, a4, a5, a6) {
  if (id < 0.5) return a0.slice();
  if (id < 1.5) return a1.slice();
  if (id < 2.5) return a2.slice();
  if (id < 3.5) return a3.slice();
  if (id < 4.5) return a4.slice();
  if (id < 5.5) return a5.slice();
  return a6.slice();
}

function pl(fr, to, bl, a0, a1, a2, a3, a4, a5, a6) {
  return mix(pval(fr, a0, a1, a2, a3, a4, a5, a6), pval(to, a0, a1, a2, a3, a4, a5, a6), bl);
}

function vl(fr, to, bl, a0, a1, a2, a3, a4, a5, a6) {
  return v3mix(vval(fr, a0, a1, a2, a3, a4, a5, a6), vval(to, a0, a1, a2, a3, a4, a5, a6), bl);
}

function poseWeight(fr, to, blend, id) {
  const toMatch = abs(to - id) < 0.5;
  const frMatch = abs(fr - id) < 0.5;
  if (toMatch && frMatch) return 1.0;
  if (toMatch) return blend;
  if (frMatch) return 1.0 - blend;
  return 0.0;
}

function lickWeight(fr, to, blend) {
  const f = abs(fr - 1.0) < 0.5 || fr > 5.5 ? 1.0 : 0.0;
  const t = abs(to - 1.0) < 0.5 || to > 5.5 ? 1.0 : 0.0;
  return mix(f, t, blend);
}

// ── Pose data functions ─────────────────────────────────────────────────────
// Body group: use bodyBlend
// Head group: use headBlend
// Tail group: use individual poseId (not blended via pl/vl)

function poseBreathAmp(f, t, b) {
  return pl(f, t, b, 0.0015, 0.002, 0.0015, 0.0015, 0.0015, 0.0025, 0.0015);
}
function poseBellyY(f, t, b) {
  return pl(f, t, b, 0.20, 0.26, 0.28, 0.22, 0.20, 1.50, 0.30);
}
function poseHeadPitchBase(f, t, b) {
  return pl(f, t, b, -0.05, -0.08, -0.10, -0.10, 0.02, 1.30, -0.15);
}
function poseHeadYawBase(f, t, b) {
  return pl(f, t, b, 0.0, -0.4, -0.4, -0.5, 0.0, 0.0, -0.15);
}
function poseBodyRollAt(id) {
  return pval(id, 0.0, 0.0, 0.0, 0.0, 0.0, PI, 0.0);
}
function poseSpineRoot(f, t, b) {
  return vl(f, t, b, [-0.42, 0.0, 0.0], [-0.30, -0.18, 0.0], [-0.42, -0.12, 0.0], [-0.42, 0.04, 0.0], [-0.42, 0.0, 0.0], [-0.42, -0.08, 0.0], [-0.28, -0.27, 0.0]);
}
function poseSpinePitch0(f, t, b) {
  return pl(f, t, b, 0.02, 0.60, 0.10, -0.10, 0.02, 0.02, 1.05);
}
function poseSpinePitch1(f, t, b) {
  return pl(f, t, b, -0.06, -0.10, -0.02, -0.20, -0.06, -0.03, 0.0);
}
function poseSpinePitch2(f, t, b) {
  return pl(f, t, b, 0.04, -0.12, 0.03, -0.08, 0.04, 0.03, 0.0);
}
function poseSpinePitch3(f, t, b) {
  return pl(f, t, b, 0.0, -0.04, 0.02, 0.08, 0.0, 0.01, 0.0);
}
function poseSpinePitch4(f, t, b) {
  return pl(f, t, b, 0.35, 0.20, 0.22, 0.55, 0.35, 0.30, 0.15);
}
function poseSpineYaw0(f, t, b) {
  return pl(f, t, b, 0.0, 0.0, 0.0, 0.0, 0.0, 0.15, 0.0);
}
function poseSpineYaw1(f, t, b) {
  return pl(f, t, b, 0.0, 0.0, 0.0, 0.0, 0.0, 0.12, 0.0);
}
function poseSpineYaw2(f, t, b) {
  return pl(f, t, b, 0.0, 0.0, 0.0, 0.0, 0.0, 0.09, 0.0);
}
function poseSpineYaw3(f, t, b) {
  return pl(f, t, b, 0.0, 0.0, 0.0, 0.0, 0.0, 0.02, 0.0);
}
function poseSpineYaw4(f, t, b) {
  return pl(f, t, b, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
}

function poseFrontShoulderBase(f, t, b) {
  return vl(f, t, b, [0.0, 0.02, 0.0], [0.0, 0.02, 0.0], [0.0, -0.12, 0.0], [0.05, 0.02, 0.0], [0.0, 0.02, 0.0], [0.0, 0.0, 0.0], [0.075, -0.02, 0.0]);
}
function poseFrontElbowBase(f, t, b) {
  return vl(f, t, b, [-0.02, -0.12, 0.0], [-0.01, -0.14, 0.0], [0.02, -0.01, 0.0], [0.10, -0.09, 0.0], [-0.02, -0.12, 0.0], [0.01, -0.175, 0.0], [0.01, -0.19, 0.0]);
}
function poseFrontWristBase(f, t, b) {
  return vl(f, t, b, [0.01, -0.18, 0.0], [0.008, -0.168, 0.0], [0.01, 0.0, 0.0], [0.14, -0.14, 0.0], [0.01, -0.18, 0.0], [0.0, -0.015, 0.0], [0.008, -0.19, 0.0]);
}
function poseFrontPawBase(f, t, b) {
  return vl(f, t, b, [0.02, -0.055, -0.01], [0.02, -0.04, -0.01], [0.0, 0.0, 0.0], [0.04, -0.06, -0.01], [0.02, -0.055, -0.01], [-0.08, -0.03, 0.0], [0.01, -0.055, 0.0]);
}
function poseRearHipBase(f, t, b) {
  return vl(f, t, b, [0.03, 0.02, 0.0], [0.08, -0.01, 0.0], [0.02, -0.08, 0.0], [0.03, 0.02, 0.0], [0.03, 0.02, 0.0], [0.02, 0.0, 0.0], [0.06, -0.01, 0.0]);
}
function poseRearKneeBase(f, t, b) {
  return vl(f, t, b, [0.08, -0.19, 0.0], [0.14, 0.08, 0.02], [0.02, -0.01, 0.0], [0.06, -0.20, 0.0], [0.08, -0.19, 0.0], [0.2, -0.061, 0.0], [0.06, -0.008, 0.0]);
}
function poseRearHockBase(f, t, b) {
  return vl(f, t, b, [-0.11, -0.12, 0.0], [-0.115, -0.148, 0.0], [0.0, 0.0, 0.0], [-0.08, -0.14, 0.0], [-0.11, -0.12, 0.0], [-0.055, -0.085, 0.0], [0.018, -0.006, 0.0]);
}
function poseRearPawBase(f, t, b) {
  return vl(f, t, b, [0.02, -0.07, 0.0], [0.06, -0.02, 0.0], [0.0, 0.0, 0.0], [0.02, -0.074, 0.0], [0.02, -0.07, 0.0], [0.01, -0.05, 0.0], [0.01, -0.006, 0.0]);
}

function poseLickElbow(uM) {
  return v3mix([0.12, 0.02, 0.0], [0.06, 0.08, 0.03], uM);
}
function poseLickWrist(uM) {
  return v3mix([0.06, -0.02, 0.0], [0.02, 0.045, -0.06], uM);
}
function poseLickPaw(uM) {
  return v3mix([0.02, -0.01, 0.0], [0.01, 0.02, -0.05], uM);
}
function poseLickShoulderSlide(uM) {
  return mix(0.06, 0.03, uM);
}
function poseLickShoulderRise(uM) {
  return mix(0.04, 0.08, uM);
}

function poseRibcageRadii(f, t, b) {
  return vl(f, t, b, RIBCAGE_RADII, RIBCAGE_RADII, RIBCAGE_RADII, RIBCAGE_RADII, RIBCAGE_RADII, RIBCAGE_RADII, [0.17, 0.24, 0.15]);
}
function poseHaunchRadii(f, t, b) {
  return vl(f, t, b, HAUNCH_RADII, HAUNCH_RADII, HAUNCH_RADII, HAUNCH_RADII, HAUNCH_RADII, HAUNCH_RADII, [0.14, 0.16, 0.14]);
}

// Tail pose data (indexed by single poseId, not blended via pl/vl)
function poseTailOffset(id) {
  return vval(id, [-0.08, 0.02, 0.0], [-0.06, 0.01, 0.04], [-0.08, 0.0, 0.0], [-0.08, 0.04, 0.0], [-0.08, 0.02, 0.0], [-0.08, 0.01, 0.0], [-0.06, 0.01, 0.04]);
}
function poseTailBasePitch(id) {
  return pval(id, 0.15, -0.05, -0.08, 0.20, 0.15, -0.15, -0.05);
}
function poseTailBaseYaw(id) {
  return pval(id, PI, 2.10, 2.40, PI, PI, 2.60, 2.10);
}
function poseTailSwayAmp(id) {
  return pval(id, 1.0, 0.15, 0.2, 0.7, 0.9, 1.3, 0.15);
}
function poseTailSegPitch(id) {
  return pval(id, 0.06, 0.01, -0.02, 0.06, 0.05, -0.02, 0.01);
}
function poseTailSegYaw(id) {
  return pval(id, 0.0, -0.20, 0.0, 0.0, 0.0, 0.10, -0.20);
}
function poseTailCurlPitch(id) {
  return pval(id, 0.06, 0.20, 0.26, 0.08, 0.10, -0.25, 0.22);
}
function poseTailCurlTip(id) {
  return pval(id, 0.08, 0.30, 0.38, 0.10, 0.14, -0.15, 0.30);
}
function poseTailCurlYaw(id) {
  return pval(id, 0.00, -0.12, -0.06, 0.03, 0.00, 0.35, -0.14);
}

// ── Walk / lick / tail animation helpers ────────────────────────────────────

function pawLift(phi) {
  const t = ((phi / TAU) % 1.0 + 1.0) % 1.0;
  const swing = smoothstep(0.58, 0.64, t) * (1.0 - smoothstep(0.86, 0.92, t));
  const inSwing = clamp((t - 0.58) / 0.34, 0.0, 1.0);
  return swing * sin(inSwing * PI) * sin(inSwing * PI);
}

function stanceOsc(phi) {
  return sin(phi - 0.5);
}

function walkRear(phi) {
  const lift = pawLift(phi),
    osc = stanceOsc(phi);
  return {
    dK: [-osc * 0.06, lift * 0.012, 0.0],
    dH: [stanceOsc(phi - 0.4) * 0.03, lift * 0.008, 0.0],
    dP: [-osc * 0.02, lift * 0.012, 0.0],
    hipRiseY: -osc * 0.005,
  };
}

function walkFront(phi) {
  const lift = pawLift(phi),
    osc = stanceOsc(phi);
  return {
    scapSlideX: osc * 0.04,
    scapRiseY: -osc * 0.008,
    dE: [-osc * 0.04, lift * 0.012, 0.0],
    dW: [-stanceOsc(phi - 0.3) * 0.025, lift * 0.008, 0.0],
    dP: [-osc * 0.015, lift * 0.012, 0.0],
  };
}

function lickEnv(t) {
  return smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.60, 0.76, t));
}
function lickBob(t) {
  const gate = smoothstep(0.16, 0.20, t) * (1.0 - smoothstep(0.56, 0.60, t));
  return gate * sin(((t - 0.16) / 0.40) * 3.0 * TAU);
}

function tailSway(t) {
  return sin(t * 0.7 * TAU) + 0.3 * sin(t * 1.83 * TAU + 0.7) + 0.15 * sin(t * 0.31 * TAU + 2.1);
}

// ── Tail FK ─────────────────────────────────────────────────────────────────

function tailFK(poseId, pw, base, breath, time, walkOffset, stridePeriod) {
  const tOff = poseTailOffset(poseId);
  let tBP = poseTailBasePitch(poseId);
  let tBY = poseTailBaseYaw(poseId);
  const swayA = poseTailSwayAmp(poseId);
  const segP = poseTailSegPitch(poseId);
  let segY = poseTailSegYaw(poseId);
  const curlP = poseTailCurlPitch(poseId);
  const curlTip = poseTailCurlTip(poseId);
  let curlY = poseTailCurlYaw(poseId);

  const t0 = v3add(base, tOff);
  tBP += breath * 0.02;
  let tp = tBP;
  let ty = tBY;
  const tAnim = time;

  const isWalk = poseId > 3.5 && poseId < 4.5;
  if (isWalk) {
    const walkPhase = ((tAnim - walkOffset) / stridePeriod) * TAU;
    ty += sin(walkPhase - 0.35) * 0.035;
    tp += sin(walkPhase * 0.5) * 0.02;
  }

  const sd = 0.18;
  const amp = 0.036 * swayA;
  const sw1 = tailSway(tAnim - sd);
  const sw2 = tailSway(tAnim - sd * 2.0);
  const sw3 = tailSway(tAnim - sd * 3.0);
  const sw4 = tailSway(tAnim - sd * 4.0);
  const pitchDrift = sin(tAnim * 0.23 * TAU + 1.0) * 0.03 * swayA;

  const ampGrow = 1.28;
  const a1 = amp;
  const a2 = amp * ampGrow;
  const a3 = a2 * ampGrow;
  const a4 = a3 * ampGrow;

  const charGate = smoothstep(0.7, 1.0, pw);
  if (poseId < 0.5) {
    const gate = smoothstep(0.93, 1.0, sin(tAnim * 0.19 * TAU));
    ty += charGate * gate * sin(tAnim * 3.5 * TAU) * 0.011;
  } else if (poseId < 1.5) {
    segY += charGate * 0.05 * sin(tAnim * 0.15 * TAU);
  } else if (poseId < 2.5) {
    const gate = smoothstep(0.92, 0.97, sin(tAnim * 0.13 * TAU + 2.7));
    ty += charGate * gate * 0.04;
  } else if (poseId < 3.5) {
    tp += charGate * 0.008 * sin(tAnim * 12.0);
  } else if (poseId < 4.5) {
    const walkPhase2 = ((tAnim - walkOffset) / stridePeriod) * TAU;
    ty += charGate * sin(walkPhase2 + PI) * 0.06;
  } else if (poseId < 5.5) {
    ty += charGate * 0.10 * sin(tAnim * 0.45 * TAU);
    segY += charGate * 0.04 * sin(tAnim * 0.45 * TAU + 1.0);
  } else {
    segY += charGate * -0.05 * sin(tAnim * 0.15 * TAU);
  }

  tp += segP + pitchDrift + curlP * 0.30;
  ty += segY + curlY * 0.30;
  ty += sw1 * a1;
  const dir = (tp_, ty_) => [cos(tp_) * cos(ty_), sin(tp_), cos(tp_) * sin(ty_)];
  const t1 = v3add(t0, v3scale(dir(tp, ty), TL[0]));

  tp += segP + pitchDrift * 0.7 + curlP * 0.55 + curlTip * 0.15;
  ty += segY + curlY * 0.55;
  ty += (sw2 - sw1) * a2;
  const t2 = v3add(t1, v3scale(dir(tp, ty), TL[1]));

  tp += segP + pitchDrift * 0.4 + curlP * 0.78 + curlTip * 0.35;
  ty += segY + curlY * 0.78;
  ty += (sw3 - sw2) * a3;
  const t3 = v3add(t2, v3scale(dir(tp, ty), TL[2]));

  tp += segP + curlP + curlTip * 0.60;
  ty += segY + curlY;
  ty += (sw4 - sw3) * a4;
  const t4 = v3add(t3, v3scale(dir(tp, ty), TL[3]));

  return { t0, t1, t2, t3, t4 };
}

// ── Limb dynamics ───────────────────────────────────────────────────────────

function applyFrontLegDynamics(elBase, wrBase, pawBase, phase, gait, onBack, sideSign) {
  let shoulderSlide = 0,
    shoulderRise = 0;
  let dElbow = elBase.slice(),
    dWrist = wrBase.slice(),
    dPaw = pawBase.slice();

  if (gait > 0) {
    const w = walkFront(phase);
    shoulderSlide = w.scapSlideX * gait;
    shoulderRise = w.scapRiseY * gait;
    dElbow = v3mix(elBase, v3add(elBase, w.dE), gait);
    dWrist = v3mix(wrBase, v3add(wrBase, w.dW), gait);
    dPaw = v3mix(pawBase, v3add(pawBase, w.dP), gait);
  }
  if (onBack > 0) {
    const fIn = onBack * 0.35;
    rotYZ(dElbow, sideSign * fIn * 0.5);
    rotYZ(dWrist, sideSign * fIn);
    rotYZ(dPaw, sideSign * fIn);
  }
  return { shoulderSlide, shoulderRise, dElbow, dWrist, dPaw };
}

function applyRearLegDynamics(knBase, hkBase, pawBase, phase, gait, onBack, latSign) {
  let dKnee = knBase.slice(),
    dHock = hkBase.slice(),
    dPaw = pawBase.slice(),
    hipRise = 0;

  if (gait > 0) {
    const w = walkRear(phase);
    dKnee = v3mix(knBase, v3add(knBase, w.dK), gait);
    dHock = v3mix(hkBase, v3add(hkBase, w.dH), gait);
    dPaw = v3mix(pawBase, v3add(pawBase, w.dP), gait);
    hipRise = w.hipRiseY * gait;
  }
  if (onBack > 0) {
    const hinge = onBack * 0.8;
    const lateral = onBack * 0.3;
    rotXY(dKnee, -hinge);
    rotXY(dHock, -hinge);
    rotXY(dPaw, -hinge);
    rotYZ(dKnee, latSign * lateral);
    rotYZ(dHock, latSign * lateral);
    rotYZ(dPaw, latSign * lateral);
  }
  return { dKnee, dHock, dPaw, hipRise };
}

// ── Main FK computation ─────────────────────────────────────────────────────

export function computeCatFK({ from, to, blend, lick, walkOffset, headYawOffset, time }) {
  const stridePeriod = CAT_CONFIG.shader.STRIDE_PERIOD;
  const bodyBlend = blend;
  const headBlend = smoothstep(0.10, 1.0, blend);
  const tailBlend = smoothstep(0.06, 1.0, blend);

  const f = from,
    t = to;

  // ── Pose weights & lick state ───────────────────────────────────────────
  const ww = poseWeight(f, t, blend, 4.0);
  const wwGait = ww * ww;
  const bw = poseWeight(f, t, blend, 5.0);
  const lw = lickWeight(f, t, blend);
  const lickT = lick;
  const lickActive = lw > 0 && lickT >= 0 && lickT < 1;
  const lickE = lickActive ? lickEnv(lickT) : 0;
  const lickB = lickActive ? lickBob(lickT) : 0;
  const fU = f > 5.5 ? 1.0 : 0.0;
  const tU = to > 5.5 ? 1.0 : 0.0;
  const usitLick = mix(fU, tU, blend);
  const tAnim = time;

  // ── Breath & head state (body blend for breath/belly, head blend for head) ─
  const bb = bodyBlend;
  const breathAmp_ = poseBreathAmp(f, t, bb) * (1.0 + ww * 0.5);
  const breath_ = mix(sin(tAnim * 2.9), sin(tAnim * 4.5), ww);
  const breathZ_ = mix(sin(tAnim * 2.9 + 0.3), sin(tAnim * 4.5 + 0.3), ww);
  const bellyY_ = poseBellyY(f, t, bb);

  const hb = headBlend;
  let headPitch_ = poseHeadPitchBase(f, t, hb);
  headPitch_ += breath_ * 0.008;
  let headYaw_ = poseHeadYawBase(f, t, hb);
  if (lw > 0) {
    const hPitch = mix(0.35, 0.50, usitLick);
    const hYaw = mix(0.25, 0.25, usitLick);
    headPitch_ += lw * (lickE * hPitch + lickB * -0.03);
    headYaw_ += lw * lickE * hYaw;
  }
  // spineUpperYaw uses headBlend (matches GLSL: called after gBlend = hBlend)
  const spineUpperYaw =
    poseSpineYaw0(f, t, hb) +
    poseSpineYaw1(f, t, hb) +
    poseSpineYaw2(f, t, hb) +
    poseSpineYaw3(f, t, hb) +
    poseSpineYaw4(f, t, hb);
  headYaw_ = mix(headYaw_, spineUpperYaw, bw);
  headYaw_ += headYawOffset;

  // Body roll
  let rollFrom = poseBodyRollAt(f);
  let rollTo = poseBodyRollAt(t);
  if (rollFrom > 0.5 && rollTo < 0.5) rollTo = TAU;
  const bodyRoll_ = mix(rollFrom, rollTo, bb);

  // Ear flick
  const earFlick =
    sin(tAnim * 1.3 + 3.0) * 0.06 * smoothstep(0.7, 1.0, sin(tAnim * 0.37)) * (1.0 - ww * 0.5);
  const earTilt_ = EAR_TILT_BACK + earFlick - ww * 0.12;
  const earFlare_ = EAR_FLARE_OUT;
  const earYaw_ = EAR_YAW_C;

  const loafWeight_ = poseWeight(f, t, blend, 2.0);
  const onBackWeight_ = bw;

  // ── Spine FK (body blend) ───────────────────────────────────────────────
  const j0 = poseSpineRoot(f, t, bb);
  let spPitch = poseSpinePitch0(f, t, bb);
  let spYaw = poseSpineYaw0(f, t, bb);
  const spDir = () => [cos(spPitch) * cos(spYaw), sin(spPitch), cos(spPitch) * sin(spYaw)];

  const j1 = v3add(j0, v3scale(spDir(), SP_LEN[0]));
  spPitch += poseSpinePitch1(f, t, bb);
  spYaw += poseSpineYaw1(f, t, bb);
  const j2 = v3add(j1, v3scale(spDir(), SP_LEN[1]));
  spPitch += poseSpinePitch2(f, t, bb);
  spYaw += poseSpineYaw2(f, t, bb);
  const j3 = v3add(j2, v3scale(spDir(), SP_LEN[2]));
  spPitch += poseSpinePitch3(f, t, bb);
  spYaw += poseSpineYaw3(f, t, bb);
  const j4 = v3add(j3, v3scale(spDir(), SP_LEN[3]));
  spPitch += poseSpinePitch4(f, t, bb);
  spYaw += poseSpineYaw4(f, t, bb);
  const j5 = v3add(j4, v3scale(spDir(), SP_LEN[4]));

  // Walk body bob
  const strideT = (tAnim - walkOffset) / stridePeriod;
  if (wwGait > 0) {
    const wPhJ = strideT * TAU;
    const bobV = sin(wPhJ) * 0.008 * wwGait;
    const bobH = cos(wPhJ) * 0.005 * wwGait;
    j4[0] += bobH * 0.5;
    j4[1] += bobV * 0.5;
    j5[0] += bobH;
    j5[1] += bobV;
  }

  // ── Front legs (body blend) ─────────────────────────────────────────────
  const phLF = fract(strideT + 0.25) * TAU;
  const phRF = fract(strideT + 0.75) * TAU;
  const shoulderYawAngle = poseSpineYaw0(f, t, bb) + poseSpineYaw1(f, t, bb) + poseSpineYaw2(f, t, bb);

  const shB = poseFrontShoulderBase(f, t, bb);
  rotXZ(shB, shoulderYawAngle);
  const elB = poseFrontElbowBase(f, t, bb);
  rotXZ(elB, shoulderYawAngle);
  const wrB = poseFrontWristBase(f, t, bb);
  rotXZ(wrB, shoulderYawAngle);
  const fpB = poseFrontPawBase(f, t, bb);
  rotXZ(fpB, shoulderYawAngle);

  // Left front leg
  const fll = applyFrontLegDynamics(elB, wrB, fpB, phLF, wwGait, bw, 1.0);
  if (lw > 0) {
    const w = lw * lickE;
    fll.shoulderSlide += w * poseLickShoulderSlide(usitLick);
    fll.shoulderRise += w * poseLickShoulderRise(usitLick);
    fll.dElbow = v3mix(fll.dElbow, poseLickElbow(usitLick), w);
    fll.dWrist = v3mix(fll.dWrist, poseLickWrist(usitLick), w);
    fll.dPaw = v3mix(fll.dPaw, poseLickPaw(usitLick), w);
  }
  const fLLAT = LLAT + bw * 0.04;
  const shLOff = [fll.shoulderSlide, fll.shoulderRise, fLLAT];
  rotXZ(shLOff, shoulderYawAngle);
  const flS = v3add(v3add(j3, shB), shLOff);
  const flE = v3add(flS, fll.dElbow);
  const flW = v3add(flE, fll.dWrist);
  const flP = v3add(flW, fll.dPaw);

  // Right front leg
  const flr = applyFrontLegDynamics(elB, wrB, fpB, phRF, wwGait, bw, -1.0);
  const shROff = [flr.shoulderSlide, flr.shoulderRise, -fLLAT];
  rotXZ(shROff, shoulderYawAngle);
  const frS = v3add(v3add(j3, shB), shROff);
  const frE = v3add(frS, flr.dElbow);
  const frW = v3add(frE, flr.dWrist);
  const frP = v3add(frW, flr.dPaw);

  // ── Rear legs (body blend) ──────────────────────────────────────────────
  const phLH = fract(strideT) * TAU;
  const phRH = fract(strideT + 0.50) * TAU;
  const hipYawAngle = poseSpineYaw0(f, t, bb) + poseSpineYaw1(f, t, bb);

  const hiB = poseRearHipBase(f, t, bb);
  rotXZ(hiB, hipYawAngle);
  const knB = poseRearKneeBase(f, t, bb);
  const hkB = poseRearHockBase(f, t, bb);
  const rpB = poseRearPawBase(f, t, bb);

  // Left rear leg
  const rll = applyRearLegDynamics(knB, hkB, rpB, phLH, wwGait, bw, -1.0);
  const hipLOff = [0, rll.hipRise, LLAT];
  rotXZ(hipLOff, hipYawAngle);
  const rlH = v3add(v3add(j0, hiB), hipLOff);
  const rlK = v3add(rlH, rll.dKnee);
  const rlHk = v3add(rlK, rll.dHock);
  const rlP = v3add(rlHk, rll.dPaw);

  // Right rear leg
  const rlr = applyRearLegDynamics(knB, hkB, rpB, phRH, wwGait, bw, 1.0);
  const hipROff = [0, rlr.hipRise, -LLAT];
  rotXZ(hipROff, hipYawAngle);
  const rrH = v3add(v3add(j0, hiB), hipROff);
  const rrK = v3add(rrH, rlr.dKnee);
  const rrHk = v3add(rrK, rlr.dHock);
  const rrP = v3add(rrHk, rlr.dPaw);

  // ── Tail FK (tail blend) ────────────────────────────────────────────────
  const tb = tailBlend;
  const ftPw = 1.0 - tb;
  const ttPw = tb;
  const ftail = tailFK(f, ftPw, j0, breath_, tAnim, walkOffset, stridePeriod);
  const ttail = tailFK(t, ttPw, j0, breath_, tAnim, walkOffset, stridePeriod);
  const t0 = v3mix(ftail.t0, ttail.t0, tb);
  const t1 = v3mix(ftail.t1, ttail.t1, tb);
  const t2 = v3mix(ftail.t2, ttail.t2, tb);
  const t3 = v3mix(ftail.t3, ttail.t3, tb);
  const t4 = v3mix(ftail.t4, ttail.t4, tb);

  // ── Bounding spheres ────────────────────────────────────────────────────
  const catCenter = v3scale(v3add(v3add(j0, j2), j5), 1 / 3);
  const catRadius =
    max(
      max(v3len(v3sub(j5, catCenter)), v3len(v3sub(t4, catCenter))),
      max(v3len(v3sub(flP, catCenter)), v3len(v3sub(rrP, catCenter))),
    ) + 0.25;

  const flegCenter = v3scale(v3add(v3add(flS, frS), v3add(flP, frP)), 0.25);
  const flegRadius =
    max(
      max(v3len(v3sub(flS, flegCenter)), v3len(v3sub(flP, flegCenter))),
      max(v3len(v3sub(frS, flegCenter)), v3len(v3sub(frP, flegCenter))),
    ) + 0.08;

  const rlegCenter = v3scale(v3add(v3add(rlH, rrH), v3add(rlP, rrP)), 0.25);
  const rlegRadius =
    max(
      max(v3len(v3sub(rlH, rlegCenter)), v3len(v3sub(rlP, rlegCenter))),
      max(v3len(v3sub(rrH, rlegCenter)), v3len(v3sub(rrP, rlegCenter))),
    ) + 0.08;

  const tailCenter = v3scale(v3add(v3add(t0, t2), t4), 1 / 3);
  const tailRadius =
    max(
      max(v3len(v3sub(t0, tailCenter)), v3len(v3sub(t1, tailCenter))),
      max(
        max(v3len(v3sub(t2, tailCenter)), v3len(v3sub(t3, tailCenter))),
        v3len(v3sub(t4, tailCenter)),
      ),
    ) + 0.06;

  // ── Pose-dependent body radii (body blend) ──────────────────────────────
  const ribcageRadii = poseRibcageRadii(f, t, bb);
  const haunchRadii = poseHaunchRadii(f, t, bb);

  return {
    j0, j1, j2, j3, j4, j5,
    flS, flE, flW, flP,
    frS, frE, frW, frP,
    rlH, rlK, rlHk, rlP,
    rrH, rrK, rrHk, rrP,
    t0, t1, t2, t3, t4,
    catCenter, flegCenter, rlegCenter, tailCenter,
    catRadius, flegRadius, rlegRadius, tailRadius,
    bodyRoll: bodyRoll_,
    breath: breath_,
    breathZ: breathZ_,
    breathAmp: breathAmp_,
    bellyY: bellyY_,
    loafWeight: loafWeight_,
    onBackWeight: onBackWeight_,
    headPitch: headPitch_,
    headYaw: headYaw_,
    earTilt: earTilt_,
    earFlare: earFlare_,
    earYaw: earYaw_,
    ribcageRadii,
    haunchRadii,
  };
}
