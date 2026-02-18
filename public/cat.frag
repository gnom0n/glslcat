#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_camera;
uniform float u_from; // source pose index (0-6, where 4=walk)
uniform float u_to; // target pose index (0-6, where 4=walk)
uniform float u_blend; // 0-1 eased blend factor
uniform int u_mode; // 0=halftone, 1=normals, 2=silhouette
uniform float u_lick; // 0-1 lick cycle progress, >=1 means inactive
uniform float u_walkOffset; // time offset for walk phase sync
uniform float u_headYaw;   // head yaw offset from arrow keys

#define PI 3.14159265
#define TAU 6.28318530

// ============================================================
//  POSE SYSTEM — direct A->B transitions, 6 poses + walk
//  0=Stand 1=Sit 2=Loaf 3=Stretch 4=Walk(gait) 5=OnBack 6=UprightSit
// ============================================================

// select per-pose value by float ID — 0.5 thresholds treat floats as integer indices
float pval(float id, float v0, float v1, float v2, float v3, float v4, float v5, float v6) {
  if (id < 0.5) return v0;
  if (id < 1.5) return v1;
  if (id < 2.5) return v2;
  if (id < 3.5) return v3;
  if (id < 4.5) return v4;
  if (id < 5.5) return v5;
  return v6;
}
vec3 vval(float id, vec3 v0, vec3 v1, vec3 v2, vec3 v3, vec3 v4, vec3 v5, vec3 v6) {
  if (id < 0.5) return v0;
  if (id < 1.5) return v1;
  if (id < 2.5) return v2;
  if (id < 3.5) return v3;
  if (id < 4.5) return v4;
  if (id < 5.5) return v5;
  return v6;
}

// mutable blend factor — body, head, and tail use different easing curves,
// so callers swap gBlend before invoking pose-lookup functions (pl/vl)
float gBlend;

float pl(float v0, float v1, float v2, float v3, float v4, float v5, float v6) {
  return mix(pval(u_from, v0, v1, v2, v3, v4, v5, v6), pval(u_to, v0, v1, v2, v3, v4, v5, v6), gBlend);
}
vec3 vl(vec3 v0, vec3 v1, vec3 v2, vec3 v3, vec3 v4, vec3 v5, vec3 v6) {
  return mix(vval(u_from, v0, v1, v2, v3, v4, v5, v6), vval(u_to, v0, v1, v2, v3, v4, v5, v6), gBlend);
}

// Returns blend weight for a specific pose: 1.0 when fully in that pose,
// 0.0 when neither from/to is that pose, smooth blend during transitions
float poseWeight(float id) {
  bool toMatch = abs(u_to - id) < 0.5;
  bool frMatch = abs(u_from - id) < 0.5;
  if (toMatch && frMatch) return 1.0;
  if (toMatch) return u_blend;
  if (frMatch) return 1.0 - u_blend;
  return 0.0;
}
float lickWeight() {
  float f = (abs(u_from - 1.0) < 0.5 || u_from > 5.5) ? 1.0 : 0.0;
  float t = (abs(u_to - 1.0) < 0.5 || u_to > 5.5) ? 1.0 : 0.0;
  return mix(f, t, u_blend);
}
// ============================================================
//  CONSTANTS
// ============================================================

const float SP_LEN_0 = 0.16;
const float SP_LEN_1 = 0.15;
const float SP_LEN_2 = 0.18;
const float SP_LEN_3 = 0.10;
const float SP_LEN_4 = 0.18;

const float SP_RAD_0 = 0.045;
const float SP_RAD_1 = 0.08;
const float SP_RAD_2 = 0.15;
const float SP_RAD_3 = 0.14;
const float SP_RAD_4 = 0.065;
const float SP_RAD_4_TIP = 0.038;

const vec3 RIBCAGE_RADII = vec3(0.24, 0.17, 0.15);
const vec3 HAUNCH_RADII = vec3(0.16, 0.14, 0.14);
const vec3 SHOULDER_PAD_RADII = vec3(0.057, 0.068, 0.049);
const vec3 HIP_VOL_RADII = vec3(0.036, 0.036, 0.036);

const vec3 CRANIUM_RADII = vec3(0.11, 0.10, 0.105);
const vec3 MUZZLE_OFFSET = vec3(0.085, -0.03, 0.0);
const vec3 MUZZLE_RADII = vec3(0.04, 0.032, 0.048);
const vec3 CHEEK_OFFSET = vec3(0.055, -0.045, 0.0);
const float CHEEK_SPREAD = 0.048;
const float CHEEK_RADIUS = 0.028;
const vec3 JAW_OFFSET = vec3(0.035, -0.085, 0.0);
const float JAW_WIDTH = 0.032;
const float JAW_THICKNESS = 0.022;
const vec3 NOSE_OFFSET = vec3(0.095, -0.018, 0.0);
const vec3 NOSE_TIP_R = vec3(0.030, 0.011, 0.022);
const vec3 NOSE_BRIDGE_OFF = vec3(-0.008, 0.008, 0.0);
const vec3 NOSE_BRIDGE_R = vec3(0.020, 0.012, 0.014);
const float NOSTRIL_SPREAD = 0.012;
const float NOSTRIL_R = 0.007;
const vec3 NOSTRIL_OFF = vec3(0.005, -0.006, 0.0);
const vec3 EYE_POS = vec3(0.052, 0.015, 0.0);
const float EYE_SPREAD = 0.04;
const float EYE_RADIUS = 0.020;
const vec3 EAR_OFFSET = vec3(0.0, 0.04, 0.0);
const float EAR_SPREAD = 0.065;
const float EAR_TILT_BACK = -0.1;
const float EAR_FLARE_OUT = 0.4;
const float EAR_YAW_C = 0.5;
const float EAR_BASE_R = 0.042;
const float EAR_TIP_R = 0.003;
const float EAR_HEIGHT = 0.11;
const float EAR_THICK = 0.1;
const float EAR_CURVE = 1.8;

const float FU_RT = 0.060; const float FU_RB = 0.042;
const float FF_RT = 0.040; const float FF_RB = 0.031;
const float FP_RT = 0.030; const float FP_RB = 0.031;
const float RT_RT = 0.062; const float RT_RB = 0.047;
const float RL_RT = 0.043; const float RL_RB = 0.033;
const float RM_RT = 0.032; const float RM_RB = 0.033;

const float FRONT_PAW_CHAIN = 0.80;
const float REAR_PAW_CHAIN = 0.82;

const vec3 FRONT_PAW_PAD_OFF = vec3(-0.24, -0.16, 0.0);
const vec3 FRONT_PAW_PAD_RADII = vec3(0.46, 0.28, 0.42);
const vec3 FRONT_PAW_DORSAL_OFF = vec3(-0.04, 0.15, 0.0);
const vec3 FRONT_PAW_DORSAL_RADII = vec3(0.40, 0.22, 0.34);
const vec3 FRONT_PAW_TOE_BASE = vec3(0.20, -0.07, 0.0);
const vec3 FRONT_PAW_TOE_RADII = vec3(0.23, 0.16, 0.16);
const float FRONT_PAW_TOE_SPREAD = 0.18;
const float FRONT_PAW_TOE_INSET = 0.05;
const float FRONT_PAW_TOE_BLEND = 0.23;
const float FRONT_PAW_BLEND = 0.31;

const vec3 REAR_PAW_PAD_OFF = vec3(-0.26, -0.14, 0.0);
const vec3 REAR_PAW_PAD_RADII = vec3(0.54, 0.24, 0.34);
const vec3 REAR_PAW_DORSAL_OFF = vec3(-0.02, 0.12, 0.0);
const vec3 REAR_PAW_DORSAL_RADII = vec3(0.44, 0.20, 0.30);
const vec3 REAR_PAW_TOE_BASE = vec3(0.25, -0.06, 0.0);
const vec3 REAR_PAW_TOE_RADII = vec3(0.21, 0.13, 0.13);
const float REAR_PAW_TOE_SPREAD = 0.14;
const float REAR_PAW_TOE_INSET = 0.04;
const float REAR_PAW_TOE_BLEND = 0.20;
const float REAR_PAW_BLEND = 0.28;

const vec3 THIGH_POST_OFF = vec3(0.34, -0.08, 0.14);
const vec3 THIGH_POST_RADII = vec3(0.54, 0.36, 0.40);
const vec3 THIGH_CRAN_OFF = vec3(0.46, 0.10, -0.05);
const vec3 THIGH_CRAN_RADII = vec3(0.42, 0.30, 0.30);
const vec3 STIFLE_OFF = vec3(-0.06, 0.10, 0.02);
const vec3 STIFLE_RADII = vec3(0.26, 0.22, 0.24);
const float TR0 = 0.036; const float TR1 = 0.032;
const float TR2 = 0.027; const float TR3 = 0.022;
const float TR_TIP = 0.014;
const float TL0 = 0.12; const float TL1 = 0.12;
const float TL2 = 0.12; const float TL3 = 0.06;
const float LLAT = 0.10;

const float BL_SPINE = 0.06;
const float BL_SNECK = 0.10;
const float BL_RIB = 0.08;
const float BL_HAUN = 0.12;
const float BL_SHLD = 0.04;
const float BL_HIP = 0.055;
const float BL_BELLY = 0.04;
const float BL_NECK = 0.08;
const float BL_HINTL = 0.06;
const float BL_EAR = 0.002;
const float BL_TAIL = 0.06;
const float BL_ELBOW = 0.022;
const float BL_WRIST = 0.016;
const float BL_KNEE = 0.022;
const float BL_HOCK = 0.016;
const float BL_FRONT_PAW = 0.024;
const float BL_REAR_PAW = 0.024;
const float BL_THIGH_ANAT = 0.045;
const float BL_STIFLE_ANAT = 0.028;
const float BL_FRONT_ATTACH = 0.050;
const float BL_REAR_ATTACH = 0.048;

// ============================================================
//  MATH & PRIMITIVES
// ============================================================
// smooth minimum — cubic polynomial blend for organic flesh joins
float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}
// tight smooth minimum — smoothstep blend with reduced shoulder for articulated joints
float sminJointTight(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = smoothstep(0.0, 1.0, 0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1.0 - h) * 0.28;
}
// asymmetric smooth minimum — stronger blend on the body side for limb attachments
float sminAttach(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = smoothstep(0.0, 1.0, 0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1.0 - h) * mix(0.4, 1.0, h);
}
float smax(float a, float b, float k) {
  if (k <= 0.0) return max(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * h * k * (1.0 / 6.0);
}
mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}
float sdEllipsoid(vec3 p, vec3 r) {
  return (length(p / r) - 1.0) * min(min(r.x, r.y), r.z);
}
float sdCurvedCone(vec3 p, float r1, float r2, float h, float curve) {
  vec2 q = vec2(length(p.xz), p.y);
  if (q.y < 0.0) return length(q) - r1;
  if (q.y > h) return length(q - vec2(0, h)) - r2;
  return q.x - mix(r1, r2, pow(q.y / h, curve));
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}
float sdTCap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float ba2 = dot(ba, ba);
  if (ba2 < 1e-8) return length(pa) - 0.5 * (ra + rb);
  float h = clamp(dot(pa, ba) / ba2, 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
// ============================================================
//  GLOBALS
// ============================================================
vec3 j0, j1, j2, j3, j4, j5;
vec3 flS, flE, flW, flP, frS, frE, frW, frP;
vec3 rlH, rlK, rlHk, rlP_, rrH, rrK, rrHk, rrP_;
vec3 t0_, t1_, t2_, t3_, t4_;
float gBellyY, gHeadPitch, gHeadYaw, gBreathAmp, gEarFlick, gBodyRoll;
float gBreath, gBreathZ, gLoafWeight, gOnBackWeight;
mat2 gRotBodyYaw, gRotBodyRoll;
mat2 gRotHeadPitch, gRotHeadYaw;
mat2 gRotEarTilt, gRotEarFlare, gRotEarYaw;
vec3 gCatCenter, gFLegCenter, gRLegCenter, gTailCenter;
float gCatRadius, gFLegRadius, gRLegRadius, gTailRadius;
// ============================================================
//  POSE DATA
// ============================================================
float poseBreathAmp() {
  return pl(0.0015, 0.002, 0.0015, 0.0015, 0.0015, 0.0025, 0.0015);
}

float poseBellyY() {
  return pl(0.20, 0.26, 0.28, 0.22, 0.20, 1.50, 0.30);
}

float poseHeadPitchBase() {
  return pl(-0.05, -0.08, -0.10, -0.10, 0.02, 1.30, -0.15);
}

float poseHeadYawBase() {
  return pl(0.0, -0.4, -0.4, -0.5, 0.0, 0.0, -0.15);
}

float poseBodyRollAt(float poseId) {
  return pval(poseId, 0.0, 0.0, 0.0, 0.0, 0.0, PI, 0.0);
}

vec3 poseSpineRoot() {
  return vl(
    vec3(-0.42, 0.00, 0.0),
    vec3(-0.30, -0.18, 0.0),
    vec3(-0.42, -0.12, 0.0),
    vec3(-0.42, 0.04, 0.0),
    vec3(-0.42, 0.00, 0.0),
    vec3(-0.42, -0.08, 0.0),
    vec3(-0.28, -0.27, 0.0)
  );
}

float poseSpinePitch0() {
  return pl(0.02, 0.60, 0.10, -0.10, 0.02, 0.02, 1.05);
}
float poseSpinePitch1() {
  return pl(-0.06, -0.10, -0.02, -0.20, -0.06, -0.03, 0.0);
}
float poseSpinePitch2() {
  return pl(0.04, -0.12, 0.03, -0.08, 0.04, 0.03, 0.0);
}
float poseSpinePitch3() {
  return pl(0.0, -0.04, 0.02, 0.08, 0.0, 0.01, 0.0);
}
float poseSpinePitch4() {
  return pl(0.35, 0.20, 0.22, 0.55, 0.35, 0.30, 0.15);
}

float poseSpineYaw0() {
  return pl(0.0, 0.0, 0.0, 0.0, 0.0, 0.15, 0.0);
}
float poseSpineYaw1() {
  return pl(0.0, 0.0, 0.0, 0.0, 0.0, 0.12, 0.0);
}
float poseSpineYaw2() {
  return pl(0.0, 0.0, 0.0, 0.0, 0.0, 0.09, 0.0);
}
float poseSpineYaw3() {
  return pl(0.0, 0.0, 0.0, 0.0, 0.0, 0.02, 0.0);
}
float poseSpineYaw4() {
  return pl(0.0, 0.0, 0.0, 0.0, 0.0, 0.00, 0.0);
}

vec3 poseFrontShoulderBase() {
  return vl(
    vec3(0.00, 0.02, 0.0),
    vec3(0.00, 0.02, 0.0),
    vec3(0.00, -0.12, 0.0),
    vec3(0.05, 0.02, 0.0),
    vec3(0.00, 0.02, 0.0),
    vec3(0.0, 0.0, 0.0),
    vec3(0.075, -0.02, 0.0)
  );
}

vec3 poseFrontElbowBase() {
  return vl(
    vec3(-0.02, -0.12, 0.0),
    vec3(-0.01, -0.14, 0.0),
    vec3(0.02, -0.01, 0.0),
    vec3(0.10, -0.09, 0.0),
    vec3(-0.02, -0.12, 0.0),
    vec3(0.01, -0.175, 0.0),
    vec3(0.01, -0.19, 0.0)
  );
}

vec3 poseFrontWristBase() {
  return vl(
    vec3(0.01, -0.18, 0.0),
    vec3(0.008, -0.168, 0.0),
    vec3(0.01, 0.0, 0.0),
    vec3(0.14, -0.14, 0.0),
    vec3(0.01, -0.18, 0.0),
    vec3(0.0, -0.015, 0.0),
    vec3(0.008, -0.19, 0.0)
  );
}

vec3 poseFrontPawBase() {
  return vl(
    vec3(0.02, -0.055, -0.01),
    vec3(0.02, -0.04, -0.01),
    vec3(0.00, 0.0, 0.0),
    vec3(0.04, -0.06, -0.01),
    vec3(0.02, -0.055, -0.01),
    vec3(-0.08, -0.03, 0.0),
    vec3(0.01, -0.055, 0.0)
  );
}

vec3 poseRearHipBase() {
  return vl(
    vec3(0.03, 0.02, 0.0),
    vec3(0.08, -0.01, 0.0),
    vec3(0.02, -0.08, 0.0),
    vec3(0.03, 0.02, 0.0),
    vec3(0.03, 0.02, 0.0),
    vec3(0.02, 0.0, 0.0),
    vec3(0.06, -0.01, 0.0)
  );
}

vec3 poseRearKneeBase() {
  return vl(
    vec3(0.08, -0.19, 0.0),
    vec3(0.14, 0.08, 0.02),
    vec3(0.02, -0.01, 0.0),
    vec3(0.06, -0.20, 0.0),
    vec3(0.08, -0.19, 0.0),
    vec3(0.2, -0.061, 0.0),
    vec3(0.06, -0.008, 0.0)
  );
}

vec3 poseRearHockBase() {
  return vl(
    vec3(-0.11, -0.12, 0.0),
    vec3(-0.115, -0.148, 0.0),
    vec3(0.00, 0.0, 0.0),
    vec3(-0.08, -0.14, 0.0),
    vec3(-0.11, -0.12, 0.0),
    vec3(-0.055, -0.085, 0.0),
    vec3(0.018, -0.006, 0.0)
  );
}

vec3 poseRearPawBase() {
  return vl(
    vec3(0.02, -0.07, 0.0),
    vec3(0.06, -0.02, 0.0),
    vec3(0.00, 0.0, 0.0),
    vec3(0.02, -0.074, 0.0),
    vec3(0.02, -0.07, 0.0),
    vec3(0.01, -0.05, 0.0),
    vec3(0.01, -0.006, 0.0)
  );
}

vec3 poseLickElbow(float uprightMix) {
  return mix(vec3(0.12, 0.02, 0.0), vec3(0.06, 0.08, 0.03), uprightMix);
}

vec3 poseLickWrist(float uprightMix) {
  return mix(vec3(0.06, -0.02, 0.0), vec3(0.02, 0.045, -0.06), uprightMix);
}

vec3 poseLickPaw(float uprightMix) {
  return mix(vec3(0.02, -0.01, 0.0), vec3(0.01, 0.02, -0.05), uprightMix);
}

float poseLickShoulderSlide(float uprightMix) {
  return mix(0.06, 0.03, uprightMix);
}

float poseLickShoulderRise(float uprightMix) {
  return mix(0.04, 0.08, uprightMix);
}

vec3 poseRibcageRadii() {
  return vl(
    RIBCAGE_RADII,
    RIBCAGE_RADII,
    RIBCAGE_RADII,
    RIBCAGE_RADII,
    RIBCAGE_RADII,
    RIBCAGE_RADII,
    vec3(0.17, 0.24, 0.15)
  );
}

vec3 poseHaunchRadii() {
  return vl(
    HAUNCH_RADII,
    HAUNCH_RADII,
    HAUNCH_RADII,
    HAUNCH_RADII,
    HAUNCH_RADII,
    HAUNCH_RADII,
    vec3(0.14, 0.16, 0.14)
  );
}

vec3 poseTailOffset(float poseId) {
  return vval(
    poseId,
    vec3(-0.08, 0.02, 0.0),
    vec3(-0.06, 0.01, 0.04),
    vec3(-0.08, 0.00, 0.0),
    vec3(-0.08, 0.04, 0.0),
    vec3(-0.08, 0.02, 0.0),
    vec3(-0.08, 0.01, 0.0),
    vec3(-0.06, 0.01, 0.04)
  );
}

float poseTailBasePitch(float poseId) {
  return pval(poseId, 0.15, -0.05, -0.08, 0.20, 0.15, -0.15, -0.05);
}

float poseTailBaseYaw(float poseId) {
  return pval(poseId, PI, 2.10, 2.40, PI, PI, 2.60, 2.10);
}

float poseTailSwayAmp(float poseId) {
  return pval(poseId, 1.0, 0.15, 0.2, 0.7, 0.9, 1.3, 0.15);
}

float poseTailSegPitch(float poseId) {
  return pval(poseId, 0.06, 0.01, -0.02, 0.06, 0.05, -0.02, 0.01);
}

float poseTailSegYaw(float poseId) {
  return pval(poseId, 0.0, -0.20, 0.0, 0.0, 0.0, 0.10, -0.20);
}

float poseTailCurlPitch(float poseId) {
  return pval(poseId, 0.06, 0.20, 0.26, 0.08, 0.10, -0.25, 0.22);
}

float poseTailCurlTip(float poseId) {
  return pval(poseId, 0.08, 0.30, 0.38, 0.10, 0.14, -0.15, 0.30);
}

float poseTailCurlYaw(float poseId) {
  return pval(poseId, 0.00, -0.12, -0.06, 0.03, 0.00, 0.35, -0.14);
}
// ============================================================
//  WALK HELPERS
// ============================================================
float pawLift(float phi) {
  float t = mod(phi / TAU, 1.0);
  float swing = smoothstep(0.58, 0.64, t) * (1.0 - smoothstep(0.86, 0.92, t));
  float inSwing = clamp((t - 0.58) / 0.34, 0.0, 1.0);
  return swing * sin(inSwing * PI) * sin(inSwing * PI);
}
float stanceOsc(float phi) {
  return sin(phi - 0.5);
}

void walkRear(float phi, out vec3 dK, out vec3 dH, out vec3 dP, out float hipRiseY) {
  float lift = pawLift(phi), osc = stanceOsc(phi);
  dK = vec3(-osc * 0.06, lift * 0.012, 0.0);
  dH = vec3(stanceOsc(phi - 0.4) * 0.03, lift * 0.008, 0.0);
  dP = vec3(-osc * 0.02, lift * 0.012, 0.0);
  hipRiseY = -osc * 0.005;
}
void walkFront(float phi, out vec3 dE, out vec3 dW, out vec3 dP, out float scapSlideX, out float scapRiseY) {
  float lift = pawLift(phi), osc = stanceOsc(phi);
  scapSlideX = osc * 0.04;
  scapRiseY = -osc * 0.008;
  dE = vec3(-osc * 0.04, lift * 0.012, 0.0);
  dW = vec3(-stanceOsc(phi - 0.3) * 0.025, lift * 0.008, 0.0);
  dP = vec3(-osc * 0.015, lift * 0.012, 0.0);
}

// ============================================================
//  LICK HELPERS
// ============================================================
float lickEnv(float t) {
  // t = u_lick, range [0,1]
  // 0.00-0.16: paw rises
  // 0.16-0.60: paw up (licking)
  // 0.60-0.76: paw lowers
  // 0.76-1.00: rest
  return smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.60, 0.76, t));
}
float lickBob(float t) {
  float gate = smoothstep(0.16, 0.20, t) * (1.0 - smoothstep(0.56, 0.60, t));
  return gate * sin((t - 0.16) / 0.40 * 3.0 * TAU);
}

// 3-harmonic organic sway: primary + overtone + subsonic drift
float tailSway(float t) {
  return sin(t * 0.7 * TAU) + 0.3 * sin(t * 1.83 * TAU + 0.7) + 0.15 * sin(t * 0.31 * TAU + 2.1);
}

// ============================================================
//  TAIL FK — compute full chain for a single pose
// ============================================================
void tailFK(float poseId, float poseWeight, vec3 base, out vec3 t0, out vec3 t1, out vec3 t2, out vec3 t3, out vec3 t4) {
  vec3 tOff = poseTailOffset(poseId);
  float tBP = poseTailBasePitch(poseId);
  float tBY = poseTailBaseYaw(poseId);
  float swayA = poseTailSwayAmp(poseId);
  float segP = poseTailSegPitch(poseId);
  float segY = poseTailSegYaw(poseId);
  float curlP = poseTailCurlPitch(poseId);
  float curlTip = poseTailCurlTip(poseId);
  float curlY = poseTailCurlYaw(poseId);

  t0 = base + tOff;
  tBP += gBreath * 0.02;
  float tp = tBP;
  float ty = tBY;
  float tAnim = u_time;

  // Walk coupling (only for pose 4)
  float isWalk = step(3.5, poseId) * step(poseId, 4.5);
  if (isWalk > 0.0) {
    float walkPhase = (tAnim - u_walkOffset) / STRIDE_PERIOD * TAU;
    ty += sin(walkPhase - 0.35) * 0.035;
    tp += sin(walkPhase * 0.5) * 0.02;
  }

  // Sway (uniform frequencies — amplitude-only variation via swayA)
  float sd = 0.18;
  float amp = 0.036 * swayA;
  float t_s1 = tAnim - sd;
  float t_s2 = tAnim - sd * 2.0;
  float t_s3 = tAnim - sd * 3.0;
  float t_s4 = tAnim - sd * 4.0;

  float sw1 = tailSway(t_s1);
  float sw2 = tailSway(t_s2);
  float sw3 = tailSway(t_s3);
  float sw4 = tailSway(t_s4);

  float pitchDrift = sin(tAnim * 0.23 * TAU + 1.0) * 0.03 * swayA;

  float ampGrow = 1.28;
  float a1 = amp;
  float a2 = amp * ampGrow;
  float a3 = amp * ampGrow * ampGrow;
  float a4 = amp * ampGrow * ampGrow * ampGrow;

  // Per-pose character (gated during transitions to prevent interference)
  float charGate = smoothstep(0.7, 1.0, poseWeight);
  if (poseId < 0.5) {
    // Stand: alertness twitches — brief flick
    float gate = smoothstep(0.93, 1.0, sin(tAnim * 0.19 * TAU));
    ty += charGate * gate * sin(tAnim * 3.5 * TAU) * 0.011;
  } else if (poseId < 1.5) {
    // Sit: slow languid wrap (accumulates per segment)
    segY += charGate * 0.05 * sin(tAnim * 0.15 * TAU);
  } else if (poseId < 2.5) {
    // Loaf: occasional flick
    float gate = smoothstep(0.92, 0.97, sin(tAnim * 0.13 * TAU + 2.7));
    ty += charGate * gate * 0.04;
  } else if (poseId < 3.5) {
    // Stretch: subtle high-freq tremor
    tp += charGate * 0.008 * sin(tAnim * 12.0);
  } else if (poseId < 4.5) {
    // Walk: counter-sway anti-phase to gait
    float walkPhase2 = (tAnim - u_walkOffset) / STRIDE_PERIOD * TAU;
    ty += charGate * sin(walkPhase2 + PI) * 0.06;
  } else if (poseId < 5.5) {
    // OnBack: playful horizontal sway
    ty += charGate * 0.10 * sin(tAnim * 0.45 * TAU);
    segY += charGate * 0.04 * sin(tAnim * 0.45 * TAU + 1.0);
  } else {
    // UprightSit: mirrored wrap direction
    segY += charGate * -0.05 * sin(tAnim * 0.15 * TAU);
  }

  // FK chain
  tp += segP + pitchDrift + curlP * 0.30;
  ty += segY + curlY * 0.30;
  ty += sw1 * a1;
  t1 = t0 + vec3(cos(tp) * cos(ty), sin(tp), cos(tp) * sin(ty)) * TL0;

  tp += segP + pitchDrift * 0.7 + curlP * 0.55 + curlTip * 0.15;
  ty += segY + curlY * 0.55;
  ty += (sw2 - sw1) * a2;
  t2 = t1 + vec3(cos(tp) * cos(ty), sin(tp), cos(tp) * sin(ty)) * TL1;

  tp += segP + pitchDrift * 0.4 + curlP * 0.78 + curlTip * 0.35;
  ty += segY + curlY * 0.78;
  ty += (sw3 - sw2) * a3;
  t3 = t2 + vec3(cos(tp) * cos(ty), sin(tp), cos(tp) * sin(ty)) * TL2;

  tp += segP + curlP + curlTip * 0.60;
  ty += segY + curlY;
  ty += (sw4 - sw3) * a4;
  t4 = t3 + vec3(cos(tp) * cos(ty), sin(tp), cos(tp) * sin(ty)) * TL3;
}
// ============================================================
//  COMPUTE ALL JOINTS
// ============================================================
void applyFrontLegDynamics(
  vec3 elBase,
  vec3 wrBase,
  vec3 pawBase,
  float phase,
  float gait,
  float onBack,
  float sideSign,
  out float shoulderSlide,
  out float shoulderRise,
  out vec3 dElbow,
  out vec3 dWrist,
  out vec3 dPaw) {
  shoulderSlide = 0.0;
  shoulderRise = 0.0;
  dElbow = elBase;
  dWrist = wrBase;
  dPaw = pawBase;

  if (gait > 0.0) {
    vec3 wE, wW, wP;
    float wSx, wSy;
    walkFront(phase, wE, wW, wP, wSx, wSy);
    shoulderSlide = wSx * gait;
    shoulderRise = wSy * gait;
    dElbow = mix(elBase, elBase + wE, gait);
    dWrist = mix(wrBase, wrBase + wW, gait);
    dPaw = mix(pawBase, pawBase + wP, gait);
  }

  if (onBack > 0.0) {
    float fIn = onBack * 0.35;
    dElbow.yz *= rot(sideSign * fIn * 0.5);
    dWrist.yz *= rot(sideSign * fIn);
    dPaw.yz *= rot(sideSign * fIn);
  }
}

void applyRearLegDynamics(
  vec3 knBase,
  vec3 hkBase,
  vec3 pawBase,
  float phase,
  float gait,
  float onBack,
  float latSign,
  out vec3 dKnee,
  out vec3 dHock,
  out vec3 dPaw,
  out float hipRise) {
  dKnee = knBase;
  dHock = hkBase;
  dPaw = pawBase;
  hipRise = 0.0;

  if (gait > 0.0) {
    vec3 wK, wH, wP;
    float wHr;
    walkRear(phase, wK, wH, wP, wHr);
    dKnee = mix(knBase, knBase + wK, gait);
    dHock = mix(hkBase, hkBase + wH, gait);
    dPaw = mix(pawBase, pawBase + wP, gait);
    hipRise = wHr * gait;
  }

  if (onBack > 0.0) {
    float hinge = onBack * 0.8;
    float lateral = onBack * 0.3;
    dKnee.xy *= rot(-hinge);
    dHock.xy *= rot(-hinge);
    dPaw.xy *= rot(-hinge);
    dKnee.yz *= rot(latSign * lateral);
    dHock.yz *= rot(latSign * lateral);
    dPaw.yz *= rot(latSign * lateral);
  }
}

void computePoseWeightsAndLickState(
  out float ww,
  out float wwGait,
  out float bw,
  out float lw,
  out float lickE,
  out float lickB,
  out float usitLick,
  out float tAnim) {
  ww = poseWeight(4.0);
  wwGait = ww * ww;
  bw = poseWeight(5.0);
  gOnBackWeight = bw;
  lw = lickWeight();
  float lickT = u_lick;
  float lickActive = (lw > 0.0 && u_lick >= 0.0 && u_lick < 1.0) ? 1.0 : 0.0;
  lickE = lickActive > 0.0 ? lickEnv(lickT) : 0.0;
  lickB = lickActive > 0.0 ? lickBob(lickT) : 0.0;
  float fU = u_from > 5.5 ? 1.0 : 0.0;
  float tU = u_to > 5.5 ? 1.0 : 0.0;
  usitLick = mix(fU, tU, u_blend);
  tAnim = u_time;
}

void computeBreathAndHeadState(float ww, float lw, float lickE, float lickB, float usitLick, float tAnim, float hBlend) {
  float bodyB = gBlend;
  gBreathAmp = poseBreathAmp();
  float breathBase = sin(tAnim * 2.9);
  float breathBaseZ = sin(tAnim * 2.9 + 0.3);
  float breathWalk = sin(tAnim * 4.5);
  float breathWalkZ = sin(tAnim * 4.5 + 0.3);
  gBreath = mix(breathBase, breathWalk, ww);
  gBreathZ = mix(breathBaseZ, breathWalkZ, ww);
  gBreathAmp *= 1.0 + ww * 0.5;

  gBellyY = poseBellyY();
  gBlend = hBlend;
  gHeadPitch = poseHeadPitchBase();
  gHeadPitch += gBreath * 0.008;
  gHeadYaw = poseHeadYawBase();
  if (lw > 0.0) {
    float hPitch = mix(0.35, 0.50, usitLick);
    float hYaw = mix(0.25, 0.25, usitLick);
    gHeadPitch += lw * (lickE * hPitch + lickB * -0.03);
    gHeadYaw += lw * lickE * hYaw;
  }
  float spineUpperYaw = poseSpineYaw0() + poseSpineYaw1() + poseSpineYaw2() + poseSpineYaw3() + poseSpineYaw4();
  gHeadYaw = mix(gHeadYaw, spineUpperYaw, gOnBackWeight);
  gHeadYaw += u_headYaw;
  gBlend = bodyB;
  float rollFrom = poseBodyRollAt(u_from);
  float rollTo = poseBodyRollAt(u_to);
  if (rollFrom > 0.5 && rollTo < 0.5) rollTo = TAU;
  gBodyRoll = mix(rollFrom, rollTo, gBlend);

  gRotBodyYaw = rot(BODY_YAW);
  gRotBodyRoll = rot(gBodyRoll);
  gRotHeadPitch = rot(gHeadPitch);
  gRotHeadYaw = rot(gHeadYaw);

  gEarFlick = sin(tAnim * 1.3 + 3.0) * 0.06 * smoothstep(0.7, 1.0, sin(tAnim * 0.37));
  gEarFlick *= 1.0 - ww * 0.5;
  gRotEarTilt = rot(EAR_TILT_BACK + gEarFlick - ww * 0.12);
  gRotEarFlare = rot(EAR_FLARE_OUT);
  gRotEarYaw = rot(EAR_YAW_C);

  gLoafWeight = poseWeight(2.0);
}

void computeSpineJoints(float wwGait, float tAnim, out float strideT) {
  // === SPINE ===
  j0 = poseSpineRoot();

  float p0 = poseSpinePitch0();
  float p1 = poseSpinePitch1();
  float p2 = poseSpinePitch2();
  float p3 = poseSpinePitch3();
  float p4 = poseSpinePitch4();
  float y0 = poseSpineYaw0();
  float y1 = poseSpineYaw1();
  float y2 = poseSpineYaw2();
  float y3 = poseSpineYaw3();
  float y4 = poseSpineYaw4();

  float spPitch = p0;
  float spYaw = y0;
  j1 = j0 + vec3(cos(spPitch) * cos(spYaw), sin(spPitch), cos(spPitch) * sin(spYaw)) * SP_LEN_0;
  spPitch += p1;
  spYaw += y1;
  j2 = j1 + vec3(cos(spPitch) * cos(spYaw), sin(spPitch), cos(spPitch) * sin(spYaw)) * SP_LEN_1;
  spPitch += p2;
  spYaw += y2;
  j3 = j2 + vec3(cos(spPitch) * cos(spYaw), sin(spPitch), cos(spPitch) * sin(spYaw)) * SP_LEN_2;
  spPitch += p3;
  spYaw += y3;
  j4 = j3 + vec3(cos(spPitch) * cos(spYaw), sin(spPitch), cos(spPitch) * sin(spYaw)) * SP_LEN_3;
  spPitch += p4;
  spYaw += y4;
  j5 = j4 + vec3(cos(spPitch) * cos(spYaw), sin(spPitch), cos(spPitch) * sin(spYaw)) * SP_LEN_4;

  strideT = (tAnim - u_walkOffset) / STRIDE_PERIOD;

  if (wwGait > 0.0) {
    float wPhJ = strideT * TAU;
    float bobV = sin(wPhJ) * 0.008 * wwGait;
    float bobH = cos(wPhJ) * 0.005 * wwGait;
    j4 += vec3(bobH * 0.5, bobV * 0.5, 0.0);
    j5 += vec3(bobH, bobV, 0.0);
  }
}

void computeFrontLegJoints(float strideT, float wwGait, float bw, float lw, float lickE, float usitLick) {
  // === FRONT LEGS ===
  float wCyc = strideT;
  float phLF = fract(wCyc + 0.25) * TAU, phRF = fract(wCyc + 0.75) * TAU;
  float shoulderYaw = poseSpineYaw0() + poseSpineYaw1() + poseSpineYaw2();

  vec3 shB = poseFrontShoulderBase();
  shB.xz *= rot(shoulderYaw);
  vec3 elB = poseFrontElbowBase();
  elB.xz *= rot(shoulderYaw);
  vec3 wrB = poseFrontWristBase();
  wrB.xz *= rot(shoulderYaw);
  vec3 fpB = poseFrontPawBase();
  fpB.xz *= rot(shoulderYaw);

  float scL, srL;
  vec3 deL, dwL, dpL;
  applyFrontLegDynamics(elB, wrB, fpB, phLF, wwGait, bw, 1.0, scL, srL, deL, dwL, dpL);
  if (lw > 0.0) {
    float w = lw * lickE;
    vec3 lickElb = poseLickElbow(usitLick);
    vec3 lickWri = poseLickWrist(usitLick);
    vec3 lickPaw = poseLickPaw(usitLick);
    scL += w * poseLickShoulderSlide(usitLick);
    srL += w * poseLickShoulderRise(usitLick);
    deL = mix(deL, lickElb, w);
    dwL = mix(dwL, lickWri, w);
    dpL = mix(dpL, lickPaw, w);
  }
  float fLLAT = LLAT + bw * 0.04;
  vec3 shLOff = vec3(scL, srL, fLLAT);
  shLOff.xz *= rot(shoulderYaw);
  flS = j3 + shB + shLOff;
  flE = flS + deL;
  flW = flE + dwL;
  flP = flW + dpL;

  float scR, srR;
  vec3 deR, dwR, dpR;
  applyFrontLegDynamics(elB, wrB, fpB, phRF, wwGait, bw, -1.0, scR, srR, deR, dwR, dpR);
  vec3 shROff = vec3(scR, srR, -fLLAT);
  shROff.xz *= rot(shoulderYaw);
  frS = j3 + shB + shROff;
  frE = frS + deR;
  frW = frE + dwR;
  frP = frW + dpR;
}

void computeRearLegJoints(float strideT, float wwGait, float bw) {
  // === REAR LEGS ===
  float wCyc = strideT;
  float phLH = fract(wCyc) * TAU, phRH = fract(wCyc + 0.50) * TAU;
  float hipYaw = poseSpineYaw0() + poseSpineYaw1();

  vec3 hiB = poseRearHipBase();
  hiB.xz *= rot(hipYaw);
  vec3 knB = poseRearKneeBase();
  vec3 hkB = poseRearHockBase();
  vec3 rpB = poseRearPawBase();

  vec3 dkL, dhL, drL;
  float hrL;
  applyRearLegDynamics(knB, hkB, rpB, phLH, wwGait, bw, -1.0, dkL, dhL, drL, hrL);
  vec3 hipLOff = vec3(0, hrL, LLAT);
  hipLOff.xz *= rot(hipYaw);
  rlH = j0 + hiB + hipLOff;
  rlK = rlH + dkL;
  rlHk = rlK + dhL;
  rlP_ = rlHk + drL;

  vec3 dkR, dhR, drR;
  float hrR;
  applyRearLegDynamics(knB, hkB, rpB, phRH, wwGait, bw, 1.0, dkR, dhR, drR, hrR);
  vec3 hipROff = vec3(0, hrR, -LLAT);
  hipROff.xz *= rot(hipYaw);
  rrH = j0 + hiB + hipROff;
  rrK = rrH + dkR;
  rrHk = rrK + dhR;
  rrP_ = rrHk + drR;
}

void computeTailBlendJoints() {
  // === TAIL (dual-FK with position interpolation) ===
  vec3 ft0, ft1, ft2, ft3, ft4;
  tailFK(u_from, 1.0 - gBlend, j0, ft0, ft1, ft2, ft3, ft4);
  vec3 tt0, tt1, tt2, tt3, tt4;
  tailFK(u_to, gBlend, j0, tt0, tt1, tt2, tt3, tt4);
  t0_ = mix(ft0, tt0, gBlend);
  t1_ = mix(ft1, tt1, gBlend);
  t2_ = mix(ft2, tt2, gBlend);
  t3_ = mix(ft3, tt3, gBlend);
  t4_ = mix(ft4, tt4, gBlend);
}

void computeJointBounds() {
  // --- Bounding spheres ---
  gCatCenter = (j0 + j2 + j5) / 3.0;
  gCatRadius = 0.0;
  gCatRadius = max(gCatRadius, length(j5 - gCatCenter));
  gCatRadius = max(gCatRadius, length(t4_ - gCatCenter));
  gCatRadius = max(gCatRadius, length(flP - gCatCenter));
  gCatRadius = max(gCatRadius, length(rrP_ - gCatCenter));
  gCatRadius += 0.25;

  gFLegCenter = (flS + frS + flP + frP) * 0.25;
  gFLegRadius = max(
      max(length(flS - gFLegCenter), length(flP - gFLegCenter)),
      max(length(frS - gFLegCenter), length(frP - gFLegCenter))
    ) + 0.08;

  gRLegCenter = (rlH + rrH + rlP_ + rrP_) * 0.25;
  gRLegRadius = max(
      max(length(rlH - gRLegCenter), length(rlP_ - gRLegCenter)),
      max(length(rrH - gRLegCenter), length(rrP_ - gRLegCenter))
    ) + 0.08;

  gTailCenter = (t0_ + t2_ + t4_) / 3.0;
  gTailRadius = max(
      max(length(t0_ - gTailCenter), length(t1_ - gTailCenter)),
      max(max(length(t2_ - gTailCenter), length(t3_ - gTailCenter)),
        length(t4_ - gTailCenter))
    ) + 0.06;
}

void computeAllJoints() {
  float bodyBlend = u_blend;
  float headBlend = smoothstep(0.10, 1.0, u_blend);
  float tailBlend = smoothstep(0.06, 1.0, u_blend);

  gBlend = bodyBlend;
  float ww, wwGait, bw, lw, lickE, lickB, usitLick, tAnim;
  computePoseWeightsAndLickState(ww, wwGait, bw, lw, lickE, lickB, usitLick, tAnim);
  computeBreathAndHeadState(ww, lw, lickE, lickB, usitLick, tAnim, headBlend);
  float strideT;
  computeSpineJoints(wwGait, tAnim, strideT);
  computeFrontLegJoints(strideT, wwGait, bw, lw, lickE, usitLick);
  computeRearLegJoints(strideT, wwGait, bw);
  gBlend = tailBlend;
  computeTailBlendJoints();
  computeJointBounds();
}

// ============================================================
//  SDF BODY PARTS
// ============================================================
float sdTorso(vec3 p) {
  float breath = gBreath * gBreathAmp;
  float onBack = gOnBackWeight;
  float d = sdCapsule(p, j0, j1, SP_RAD_0);
  d = smin(d, sdCapsule(p, j1, j2, SP_RAD_1), BL_SPINE);
  d = smin(d, sdCapsule(p, j2, j3, SP_RAD_2 + breath), BL_SPINE);
  d = smin(d, sdCapsule(p, j3, j4, SP_RAD_3), BL_SPINE);
  d = smin(d, sdTCap(p, j4, j5, SP_RAD_4, SP_RAD_4_TIP), BL_SNECK);
  vec3 rr = poseRibcageRadii();
  rr.y += breath;
  rr.z += gBreathZ * gBreathAmp * 0.5;
  d = smin(d, sdEllipsoid(p - j2, rr), BL_RIB);
  vec3 hr = poseHaunchRadii();
  d = smin(d, sdEllipsoid(p - mix(j0, j1, 0.5), hr), BL_HAUN);
  vec3 sMid = (flS + frS) * 0.5;
  vec3 pS = p;
  pS.z = abs(pS.z);
  vec3 sM = sMid;
  sM.z = abs(sM.z);
  float dWithShoulderPad = smin(d, sdEllipsoid(pS - sM, SHOULDER_PAD_RADII), BL_SHLD);
  d = mix(dWithShoulderPad, d, onBack);
  vec3 hMid = (rlH + rrH) * 0.5;
  vec3 pH = p;
  pH.z = abs(pH.z);
  vec3 hM = hMid;
  hM.z = abs(hM.z);
  d = smin(d, sdEllipsoid(pH - hM, HIP_VOL_RADII), BL_HIP);
  d = smax(d, -(p.y + gBellyY), BL_BELLY);
  return d;
}

float sdEyes(vec3 pH) {
  vec3 pE = pH - EYE_POS;
  pE.z = abs(pE.z) - EYE_SPREAD;
  return sdSphere(pE, EYE_RADIUS);
}

float sdNose(vec3 pH) {
  vec3 pN = pH - NOSE_OFFSET;
  float tip = sdEllipsoid(pN, NOSE_TIP_R);
  float bridge = sdEllipsoid(pN - NOSE_BRIDGE_OFF, NOSE_BRIDGE_R);
  float d = smin(tip, bridge, 0.01);
  vec3 pNos = pN - NOSTRIL_OFF;
  pNos.z = abs(pNos.z) - NOSTRIL_SPREAD;
  d = smax(d, -sdSphere(pNos, NOSTRIL_R), 0.004);
  return d;
}

float sdHead(vec3 p) {
  vec3 pH = p - j5;
  pH.xy *= gRotHeadPitch;
  pH.xz *= gRotHeadYaw;
  float d = sdEllipsoid(pH, CRANIUM_RADII);
  d = smin(d, sdEllipsoid(pH - MUZZLE_OFFSET, MUZZLE_RADII), BL_HINTL);
  vec3 pC = pH - CHEEK_OFFSET;
  pC.z = abs(pC.z) - CHEEK_SPREAD;
  d = smin(d, sdSphere(pC, CHEEK_RADIUS), BL_HINTL);
  vec3 pJ = pH - JAW_OFFSET;
  d = smin(d, sdCapsule(pJ, vec3(0, 0, -JAW_WIDTH), vec3(0, 0, JAW_WIDTH), JAW_THICKNESS), 0.04);
  d = smin(d, sdNose(pH), 0.04);
  d = min(d, sdEyes(pH));
  vec3 pE = pH - EAR_OFFSET;
  pE.z = abs(pE.z) - EAR_SPREAD;
  pE.xy *= gRotEarTilt;
  pE.xz *= gRotEarFlare;
  pE.zy *= gRotEarYaw;
  float earO = sdCurvedCone(pE, EAR_BASE_R, EAR_TIP_R, EAR_HEIGHT, EAR_CURVE);
  vec3 pEI = pE;
  pEI.z -= 0.015;
  pEI.x -= 0.02;
  float earI = sdCurvedCone(pEI, EAR_BASE_R * (1.0 - EAR_THICK), EAR_TIP_R, EAR_HEIGHT * 1.05, EAR_CURVE);
  float ear = smax(earO, -earI, 0.01);
  ear = smax(ear, pE.y - EAR_HEIGHT, 0.03);
  d = smin(d, ear, BL_EAR);
  return d;
}

vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float u) {
  float u2 = u * u;
  float u3 = u2 * u;
  return 0.5 * (
    (2.0 * p1) +
      (-p0 + p2) * u +
      (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u2 +
      (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u3
    );
}

vec3 tailPos(float s) {
  float u = clamp(s, 0.0, 1.0) * 4.0;
  int seg = int(min(floor(u), 3.0));
  float t = u - float(seg);
  if (seg == 0) return catmullRom(t0_, t0_, t1_, t2_, t);
  if (seg == 1) return catmullRom(t0_, t1_, t2_, t3_, t);
  if (seg == 2) return catmullRom(t1_, t2_, t3_, t4_, t);
  return catmullRom(t2_, t3_, t4_, t4_, t);
}

float tailRad(float s) {
  float baseR = TR0 * 1.02;
  float tipR = TR3 * TAIL_TIP_RADIUS_MUL;
  float a = clamp(s, 0.0, 1.0);
  float w = pow(a, TAIL_TAPER_EXP);
  float r = mix(baseR, tipR, w);
  float hold = 1.0 - smoothstep(0.0, TAIL_BASE_HOLD, s);
  r = mix(r, baseR, hold * 0.22);
  return r;
}

float sdTail(vec3 p) {
  vec3 prevP = tailPos(0.0);
  float prevR = tailRad(0.0);
  float d = 1e6;
  for (int i = 1; i <= TAIL_SDF_SAMPLES; i++) {
    float s = float(i) / float(TAIL_SDF_SAMPLES);
    vec3 currP = tailPos(s);
    float currR = min(tailRad(s), prevR * 0.992);
    float segD = sdTCap(p, prevP, currP, prevR, currR);
    d = i == 1 ? segD : smin(d, segD, TAIL_BLEND_K);
    prevP = currP;
    prevR = currR;
  }
  float dTip = sdSphere(p - t4_, prevR * TAIL_TIP_ROUND_MUL);
  d = smin(d, dTip, TAIL_BLEND_K);
  return d;
}

void buildLimbFrame(
  vec3 root,
  vec3 tip,
  vec3 prox,
  out vec3 eLong,
  out vec3 eDor,
  out vec3 eLat,
  out float segLen) {
  vec3 seg = tip - root;
  float seg2 = dot(seg, seg);
  segLen = sqrt(max(seg2, 1e-8));
  if (seg2 < 1e-8) {
    vec3 fbLong = prox;
    if (dot(fbLong, fbLong) < 1e-8) fbLong = vec3(1.0, 0.0, 0.0);
    eLong = normalize(fbLong);
  } else {
    eLong = seg / segLen;
  }

  vec3 ref = prox;
  if (dot(ref, ref) < 1e-8) ref = abs(eLong.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  eLat = cross(eLong, ref);
  float lat2 = dot(eLat, eLat);
  if (lat2 < 1e-8) {
    vec3 alt = abs(eLong.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    eLat = cross(eLong, alt);
    lat2 = dot(eLat, eLat);
  }
  if (lat2 < 1e-8) {
    eLat = vec3(0.0, 0.0, 1.0);
  } else {
    eLat *= inversesqrt(lat2);
  }

  eDor = normalize(cross(eLat, eLong));
  vec3 proxDir = root - tip;
  if (dot(proxDir, proxDir) > 1e-8 && dot(eDor, proxDir) < 0.0) {
    eDor = -eDor;
    eLat = -eLat;
  }
}

vec3 toLimbLocal(vec3 p, vec3 origin, vec3 eLong, vec3 eDor, vec3 eLat) {
  vec3 q = p - origin;
  return vec3(dot(q, eLong), dot(q, eDor), dot(q, eLat));
}

float sdFrontPaw(vec3 p, vec3 e, vec3 w, vec3 pw) {
  vec3 eLong, eDor, eLat;
  float pawLen;
  buildLimbFrame(w, pw, w - e, eLong, eDor, eLat, pawLen);
  vec3 qL = toLimbLocal(p, pw, eLong, eDor, eLat);
  float dPad = sdEllipsoid(qL - FRONT_PAW_PAD_OFF * pawLen, FRONT_PAW_PAD_RADII * pawLen);
  float dDorsal = sdEllipsoid(qL - FRONT_PAW_DORSAL_OFF * pawLen, FRONT_PAW_DORSAL_RADII * pawLen);
  float d = smin(dPad, dDorsal, FRONT_PAW_BLEND * pawLen);

  vec3 toeBase = FRONT_PAW_TOE_BASE * pawLen;
  vec3 toeRIn = FRONT_PAW_TOE_RADII * pawLen;
  vec3 toeROut = toeRIn * vec3(0.86, 0.92, 0.84);
  float toeSpread = FRONT_PAW_TOE_SPREAD * pawLen;
  float toeInset = FRONT_PAW_TOE_INSET * pawLen;
  float kToe = FRONT_PAW_TOE_BLEND * pawLen;

  float dToe = sdEllipsoid(qL - (toeBase + vec3(-toeInset, 0.0, -1.5 * toeSpread)), toeROut);
  dToe = smin(dToe, sdEllipsoid(qL - (toeBase + vec3(0.0, 0.0, -0.5 * toeSpread)), toeRIn), kToe);
  dToe = smin(dToe, sdEllipsoid(qL - (toeBase + vec3(0.0, 0.0, 0.5 * toeSpread)), toeRIn), kToe);
  dToe = smin(dToe, sdEllipsoid(qL - (toeBase + vec3(-toeInset, 0.0, 1.5 * toeSpread)), toeROut), kToe);

  d = smin(d, dToe, kToe);
  return d;
}

float sdRearPaw(vec3 p, vec3 k, vec3 hk, vec3 pw) {
  vec3 eLong, eDor, eLat;
  float pawLen;
  buildLimbFrame(hk, pw, hk - k, eLong, eDor, eLat, pawLen);
  vec3 qL = toLimbLocal(p, pw, eLong, eDor, eLat);
  float dPad = sdEllipsoid(qL - REAR_PAW_PAD_OFF * pawLen, REAR_PAW_PAD_RADII * pawLen);
  float dDorsal = sdEllipsoid(qL - REAR_PAW_DORSAL_OFF * pawLen, REAR_PAW_DORSAL_RADII * pawLen);
  float d = smin(dPad, dDorsal, REAR_PAW_BLEND * pawLen);

  vec3 toeBase = REAR_PAW_TOE_BASE * pawLen;
  vec3 toeRIn = REAR_PAW_TOE_RADII * pawLen;
  vec3 toeROut = toeRIn * vec3(0.82, 0.90, 0.82);
  float toeSpread = REAR_PAW_TOE_SPREAD * pawLen;
  float toeInset = REAR_PAW_TOE_INSET * pawLen;
  float kToe = REAR_PAW_TOE_BLEND * pawLen;

  float dToe = sdEllipsoid(qL - (toeBase + vec3(-toeInset, 0.0, -1.5 * toeSpread)), toeROut);
  dToe = smin(dToe, sdEllipsoid(qL - (toeBase + vec3(0.0, 0.0, -0.5 * toeSpread)), toeRIn), kToe);
  dToe = smin(dToe, sdEllipsoid(qL - (toeBase + vec3(0.0, 0.0, 0.5 * toeSpread)), toeRIn), kToe);
  dToe = smin(dToe, sdEllipsoid(qL - (toeBase + vec3(-toeInset, 0.0, 1.5 * toeSpread)), toeROut), kToe);

  d = smin(d, dToe, kToe);
  return d;
}

float sdFLeg(vec3 p, vec3 s, vec3 e, vec3 w, vec3 pw) {
  float d = sdTCap(p, s, e, FU_RT, FU_RB);
  d = sminJointTight(d, sdTCap(p, e, w, FF_RT, FF_RB), BL_ELBOW);
  vec3 fKn = mix(w, pw, FRONT_PAW_CHAIN);
  d = sminJointTight(d, sdTCap(p, w, fKn, FP_RT, FP_RB), BL_WRIST);
  d = sminJointTight(d, sdFrontPaw(p, e, w, pw), BL_FRONT_PAW);
  return d;
}

float sdRLeg(vec3 p, vec3 h, vec3 k, vec3 hk, vec3 pw) {
  float d = sdTCap(p, h, k, RT_RT, RT_RB);
  vec3 fem = k - h;
  float femLen = max(length(fem), 1e-4);
  vec3 eLong = fem / femLen;
  vec3 eLat = cross(vec3(0.0, 1.0, 0.0), eLong);
  if (dot(eLat, eLat) < 1e-6) eLat = cross(vec3(0.0, 0.0, 1.0), eLong);
  eLat = normalize(eLat);
  float sideSign = h.z >= 0.0 ? 1.0 : -1.0;
  if (eLat.z * sideSign > 0.0) eLat = -eLat;
  vec3 eDor = normalize(cross(eLong, eLat));

  vec3 postC = h
      + eLong * (THIGH_POST_OFF.x * femLen)
      + eDor * (THIGH_POST_OFF.y * femLen)
      + eLat * (THIGH_POST_OFF.z * femLen);
  vec3 pPost = p - postC;
  vec3 postL = vec3(dot(pPost, eLong), dot(pPost, eDor), dot(pPost, eLat));
  float dPost = sdEllipsoid(postL, THIGH_POST_RADII * femLen);
  d = smin(d, dPost, BL_THIGH_ANAT);

  vec3 cranC = h
      + eLong * (THIGH_CRAN_OFF.x * femLen)
      + eDor * (THIGH_CRAN_OFF.y * femLen)
      + eLat * (THIGH_CRAN_OFF.z * femLen);
  vec3 pCran = p - cranC;
  vec3 cranL = vec3(dot(pCran, eLong), dot(pCran, eDor), dot(pCran, eLat));
  float dCran = sdEllipsoid(cranL, THIGH_CRAN_RADII * femLen);
  d = smin(d, dCran, BL_THIGH_ANAT);

  vec3 stifleC = k
      + eLong * (STIFLE_OFF.x * femLen)
      + eDor * (STIFLE_OFF.y * femLen)
      + eLat * (STIFLE_OFF.z * femLen);
  vec3 pStifle = p - stifleC;
  vec3 stifleL = vec3(dot(pStifle, eLong), dot(pStifle, eDor), dot(pStifle, eLat));
  float dStifle = sdEllipsoid(stifleL, STIFLE_RADII * femLen);
  d = sminJointTight(d, dStifle, BL_STIFLE_ANAT);

  d = sminJointTight(d, sdTCap(p, k, hk, RL_RT, RL_RB), BL_KNEE);
  vec3 rKn = mix(hk, pw, REAR_PAW_CHAIN);
  d = sminJointTight(d, sdTCap(p, hk, rKn, RM_RT, RM_RB), BL_HOCK);
  d = sminJointTight(d, sdRearPaw(p, k, hk, pw), BL_REAR_PAW);
  return d;
}

float sdFrontLegs(vec3 p) {
  float d = sdFLeg(p, flS, flE, flW, flP);
  d = min(d, sdFLeg(p, frS, frE, frW, frP));
  return d;
}

float sdRearLegs(vec3 p) {
  float d = sdRLeg(p, rlH, rlK, rlHk, rlP_);
  d = min(d, sdRLeg(p, rrH, rrK, rrHk, rrP_));
  return d;
}

// ============================================================
//  SCENE
// ============================================================
float mapCat(vec3 p) {
  float bd = length(p - gCatCenter) - gCatRadius;
  if (bd > 0.55) return bd;
  float lw = gLoafWeight;
  float d = sdTorso(p);
  d = smin(d, sdHead(p), BL_NECK);
  float tBd = length(p - gTailCenter) - gTailRadius;
  d = smin(d, tBd > 0.45 ? tBd : sdTail(p), BL_TAIL);
  float flBd = length(p - gFLegCenter) - gFLegRadius;
  d = sminAttach(d, flBd > 0.45 ? flBd : sdFrontLegs(p), mix(BL_FRONT_ATTACH, 0.10, lw));
  float rlBd = length(p - gRLegCenter) - gRLegRadius;
  d = sminAttach(d, rlBd > 0.45 ? rlBd : sdRearLegs(p), mix(BL_REAR_ATTACH, 0.10, lw));
  return d;
}

// world -> cat-local: 1.5x scale, x-flip (cat faces -X in world), body yaw + roll
vec3 toCat(vec3 p) {
  p /= 1.5;
  p.x = -p.x;
  p.xz *= gRotBodyYaw;
  p.yz *= gRotBodyRoll;
  return p;
}

float map(vec3 p) {
  return mapCat(toCat(p)) * 1.5;
}

// Query head-local distances for material identification
void queryHeadParts(vec3 p, out float eyeD, out float noseD) {
  p = toCat(p);
  vec3 pH = p - j5;
  pH.xy *= gRotHeadPitch;
  pH.xz *= gRotHeadYaw;
  eyeD = sdEyes(pH) * 1.5;
  noseD = sdNose(pH) * 1.5;
}

// ============================================================
//  NORMALS & MARCHING
// ============================================================
// Tetrahedron normal estimation — eps controls sharpness vs smoothness
vec3 calcNormal(vec3 p, float eps) {
  vec2 e = vec2(eps, -eps);
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
      e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// < 1.0 to avoid stepping past thin features (ears, tail tip)
const float STEP_MARCH = 0.8;

float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < RAYMARCH_STEPS; i++) {
    float d = map(ro + rd * t);
    t += d * STEP_MARCH;
    if (t > 20.0 || d < 0.001) break;
  }
  return t;
}
float calcShadow(vec3 pos, vec3 lDir) {
  float res = 1.0;
  float ph = 1e10;
  float t = 0.045;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float d = map(pos + lDir * t);
    float y = d * d / (2.0 * ph);
    float k = sqrt(max(d * d - y * y, 0.0));
    res = min(res, 2.0 * k / max(t - y, 0.001));
    ph = d;
    t += clamp(d, 0.006, 0.10);
    if (res < 0.005 || t > 2.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

float halftone(float darkness) {
  vec2 px = gl_FragCoord.xy;
  float ca = HALFTONE_COS, sa = HALFTONE_SIN;
  vec2 rotUV = vec2(px.x * ca - px.y * sa,
      px.x * sa + px.y * ca);
  float minRes = min(u_resolution.x, u_resolution.y);
  float cellSize = max(4.0, min(7.0, minRes / 160.0));
  vec2 cell = floor(rotUV / cellSize) + 0.5;
  vec2 cc = cell * cellSize;
  vec2 sc = vec2(cc.x * ca + cc.y * sa,
      -cc.x * sa + cc.y * ca);

  float dist = length(px - sc);

  float maxR = cellSize * HALFTONE_DOT_MAX;
  float dotR = maxR * sqrt(clamp(darkness, 0.0, 1.0));
  return 1.0 - smoothstep(dotR - 0.5, dotR + 0.5, dist);
}

// ============================================================
//  MAIN
// ============================================================
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec3 ro = u_camera;
  computeAllJoints();

  vec3 cw = normalize(CAM_TARGET - ro);
  vec3 cu = normalize(cross(cw, vec3(0, 1, 0)));
  vec3 cv = normalize(cross(cu, cw));
  vec3 rd = normalize(uv.x * cu + uv.y * cv + CAM_FOCAL * cw);

  vec3 col = PAPER;
  float t = rayMarch(ro, rd);

  if (t < 20.0) {
    vec3 p = ro + rd * t;
    vec3 l = normalize(LIGHT_POS - p);
    vec3 n = calcNormal(p, 0.002);
    vec3 ns = calcNormal(p, 0.20);
    float sha = calcShadow(p + n * 0.05, l);

    float eyeD = 1.0, noseD = 1.0;
    vec3 pCat = toCat(p);
    if (length(pCat - j5) < 0.25)
      queryHeadParts(p, eyeD, noseD);
    bool isEye = eyeD < 0.006;
    bool isNose = !isEye && noseD < 0.010;

    float dif = max(dot(ns, l), 0.0);
    float hemi = 0.65 + 0.35 * ns.y;
    if (u_mode == 0) {
      // Halftone — ink dots on paper
      float rim = pow(clamp(1.0 + dot(ns, rd), 0.0, 1.0), 3.0);
      float fill = clamp(dot(ns, normalize(vec3(0.5, 0.3, -0.6))), 0.0, 1.0) * 0.12;
      float brightness = dif * sha * 0.55
          + hemi * 0.15
          + rim * 0.28
          + fill
          + 0.08;
      brightness = mix(brightness, 1.0, 1.0 - exp(-t * t * 0.003));
      if (isEye) brightness = 0.0;
      if (isNose) brightness *= 0.25;

      float darkness = 1.0 - clamp(brightness, 0.0, 1.0);
      float inkFactor = halftone(darkness);

      col = mix(PAPER, INK, inkFactor);
    } else if (u_mode == 1) {
      // Normals — world-space normal mapped to RGB
      col = ns * 0.5 + 0.5;
      col = pow(col, vec3(1.0 / 2.2));
    } else if (u_mode == 2) {
      // Silhouette — solid ink shape
      col = INK;
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
