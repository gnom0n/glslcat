#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

// ── Uniforms ────────────────────────────────────────────────────────────────

uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform int u_mode;

// FK skeleton (computed per-frame on CPU)
uniform vec3 u_j0, u_j1, u_j2, u_j3, u_j4, u_j5;
uniform vec3 u_flS, u_flE, u_flW, u_flP;
uniform vec3 u_frS, u_frE, u_frW, u_frP;
uniform vec3 u_rlH, u_rlK, u_rlHk, u_rlP;
uniform vec3 u_rrH, u_rrK, u_rrHk, u_rrP;
uniform vec3 u_t0, u_t1, u_t2, u_t3, u_t4;
uniform vec3 u_catCenter, u_flegCenter, u_rlegCenter, u_tailCenter;
uniform float u_catRadius, u_flegRadius, u_rlegRadius, u_tailRadius;
uniform float u_bodyRoll;
uniform float u_breath, u_breathZ, u_breathAmp;
uniform float u_bellyY, u_loafWeight, u_onBackWeight;
uniform float u_headPitch, u_headYaw;
uniform float u_earTilt, u_earFlare, u_earYawA;
uniform vec3 u_ribcageRadii, u_haunchRadii;

// ── Name aliases (SDF code references bare names) ───────────────────────────

#define j0 u_j0
#define j1 u_j1
#define j2 u_j2
#define j3 u_j3
#define j4 u_j4
#define j5 u_j5
#define flS u_flS
#define flE u_flE
#define flW u_flW
#define flP u_flP
#define frS u_frS
#define frE u_frE
#define frW u_frW
#define frP u_frP
#define rlH u_rlH
#define rlK u_rlK
#define rlHk u_rlHk
#define rlP_ u_rlP
#define rrH u_rrH
#define rrK u_rrK
#define rrHk u_rrHk
#define rrP_ u_rrP
#define t0_ u_t0
#define t1_ u_t1
#define t2_ u_t2
#define t3_ u_t3
#define t4_ u_t4
#define gCatCenter u_catCenter
#define gCatRadius u_catRadius
#define gFLegCenter u_flegCenter
#define gFLegRadius u_flegRadius
#define gRLegCenter u_rlegCenter
#define gRLegRadius u_rlegRadius
#define gTailCenter u_tailCenter
#define gTailRadius u_tailRadius
#define gBellyY u_bellyY
#define gBreath u_breath
#define gBreathZ u_breathZ
#define gBreathAmp u_breathAmp
#define gLoafWeight u_loafWeight
#define gOnBackWeight u_onBackWeight

#define PI 3.14159265
#define TAU 6.28318530

// ── SDF geometry constants ──────────────────────────────────────────────────

const float SP_RAD_0 = 0.045;
const float SP_RAD_1 = 0.08;
const float SP_RAD_2 = 0.15;
const float SP_RAD_3 = 0.14;
const float SP_RAD_4 = 0.065;
const float SP_RAD_4_TIP = 0.038;

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
const float EAR_BASE_R = 0.042;
const float EAR_TIP_R = 0.003;
const float EAR_HEIGHT = 0.11;
const float EAR_THICK = 0.1;
const float EAR_CURVE = 1.8;

const float FU_RT = 0.060;
const float FU_RB = 0.042;
const float FF_RT = 0.040;
const float FF_RB = 0.031;
const float FP_RT = 0.030;
const float FP_RB = 0.031;
const float RT_RT = 0.062;
const float RT_RB = 0.047;
const float RL_RT = 0.043;
const float RL_RB = 0.033;
const float RM_RT = 0.032;
const float RM_RB = 0.033;
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
const float TR0 = 0.036;
const float TR1 = 0.032;
const float TR2 = 0.027;
const float TR3 = 0.022;
const float TR_TIP = 0.014;

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

// ── Math helpers & SDF primitives ───────────────────────────────────────────

float smin(float a, float b, float k) {
  if (k <= 0.0)
    return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}
float sminJointTight(float a, float b, float k) {
  if (k <= 0.0)
    return min(a, b);
  float h = smoothstep(0.0, 1.0, 0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1.0 - h) * 0.28;
}
float sminAttach(float a, float b, float k) {
  if (k <= 0.0)
    return min(a, b);
  float h = smoothstep(0.0, 1.0, 0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1.0 - h) * mix(0.4, 1.0, h);
}
float smax(float a, float b, float k) {
  if (k <= 0.0)
    return max(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * h * k * (1.0 / 6.0);
}
mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float sdSphere(vec3 p, float s) { return length(p) - s; }
float sdEllipsoid(vec3 p, vec3 r) {
  return (length(p / r) - 1.0) * min(min(r.x, r.y), r.z);
}
float sdCurvedCone(vec3 p, float r1, float r2, float h, float curve) {
  vec2 q = vec2(length(p.xz), p.y);
  if (q.y < 0.0)
    return length(q) - r1;
  if (q.y > h)
    return length(q - vec2(0, h)) - r2;
  return q.x - mix(r1, r2, pow(q.y / h, curve));
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}
float sdTCap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float ba2 = dot(ba, ba);
  if (ba2 < 1e-8)
    return length(pa) - 0.5 * (ra + rb);
  float h = clamp(dot(pa, ba) / ba2, 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

// ── Rotation matrices (computed once per pixel from FK uniform angles) ──────

mat2 gRotBodyYaw, gRotBodyRoll, gRotHeadPitch, gRotHeadYaw;
mat2 gRotEarTilt, gRotEarFlare, gRotEarYaw;

void initFromUniforms() {
  gRotBodyYaw = rot(BODY_YAW);
  gRotBodyRoll = rot(u_bodyRoll);
  gRotHeadPitch = rot(u_headPitch);
  gRotHeadYaw = rot(u_headYaw);
  gRotEarTilt = rot(u_earTilt);
  gRotEarFlare = rot(u_earFlare);
  gRotEarYaw = rot(u_earYawA);
}

// ── Tail path helpers ───────────────────────────────────────────────────────

vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float u) {
  float u2 = u * u;
  float u3 = u2 * u;
  return 0.5 * ((2.0 * p1) + (-p0 + p2) * u +
                (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u2 +
                (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u3);
}
vec3 tailPos(float s) {
  float u = clamp(s, 0.0, 1.0) * 4.0;
  int seg = int(min(floor(u), 3.0));
  float t = u - float(seg);
  if (seg == 0)
    return catmullRom(t0_, t0_, t1_, t2_, t);
  if (seg == 1)
    return catmullRom(t0_, t1_, t2_, t3_, t);
  if (seg == 2)
    return catmullRom(t1_, t2_, t3_, t4_, t);
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

// ── SDF body parts ──────────────────────────────────────────────────────────

float sdTorso(vec3 p) {
  float breath = gBreath * gBreathAmp;
  float d = sdCapsule(p, j0, j1, SP_RAD_0);
  d = smin(d, sdCapsule(p, j1, j2, SP_RAD_1), BL_SPINE);
  d = smin(d, sdCapsule(p, j2, j3, SP_RAD_2 + breath), BL_SPINE);
  d = smin(d, sdCapsule(p, j3, j4, SP_RAD_3), BL_SPINE);
  d = smin(d, sdTCap(p, j4, j5, SP_RAD_4, SP_RAD_4_TIP), BL_SNECK);
  vec3 rr = u_ribcageRadii;
  rr.y += breath;
  rr.z += gBreathZ * gBreathAmp * 0.5;
  d = smin(d, sdEllipsoid(p - j2, rr), BL_RIB);
  d = smin(d, sdEllipsoid(p - mix(j0, j1, 0.5), u_haunchRadii), BL_HAUN);
  vec3 pS = p;
  pS.z = abs(pS.z);
  vec3 sM = (flS + frS) * 0.5;
  sM.z = abs(sM.z);
  d = mix(smin(d, sdEllipsoid(pS - sM, SHOULDER_PAD_RADII), BL_SHLD), d,
          gOnBackWeight);
  vec3 pH = p;
  pH.z = abs(pH.z);
  vec3 hM = (rlH + rrH) * 0.5;
  hM.z = abs(hM.z);
  d = smin(d, sdEllipsoid(pH - hM, HIP_VOL_RADII), BL_HIP);
  d = smax(d, -(p.y + gBellyY), BL_BELLY);
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
  d = smin(d,
           sdCapsule(pH - JAW_OFFSET, vec3(0, 0, -JAW_WIDTH),
                     vec3(0, 0, JAW_WIDTH), JAW_THICKNESS),
           0.04);

  vec3 pN = pH - NOSE_OFFSET;
  d = smin(d,
           smin(sdEllipsoid(pN, NOSE_TIP_R),
                sdEllipsoid(pN - NOSE_BRIDGE_OFF, NOSE_BRIDGE_R), 0.01),
           0.04);
  vec3 pNos = pN - NOSTRIL_OFF;
  pNos.z = abs(pNos.z) - NOSTRIL_SPREAD;
  d = smax(d, -sdSphere(pNos, NOSTRIL_R), 0.004);

  vec3 pEye = pH - EYE_POS;
  pEye.z = abs(pEye.z) - EYE_SPREAD;
  d = min(d, sdSphere(pEye, EYE_RADIUS));

  vec3 pE = pH - EAR_OFFSET;
  pE.z = abs(pE.z) - EAR_SPREAD;
  pE.xy *= gRotEarTilt;
  pE.xz *= gRotEarFlare;
  pE.zy *= gRotEarYaw;
  float earO = sdCurvedCone(pE, EAR_BASE_R, EAR_TIP_R, EAR_HEIGHT, EAR_CURVE);
  vec3 pEI = pE;
  pEI.z -= 0.015;
  pEI.x -= 0.02;
  float ear = smax(earO,
                   -sdCurvedCone(pEI, EAR_BASE_R * (1.0 - EAR_THICK), EAR_TIP_R,
                                 EAR_HEIGHT * 1.05, EAR_CURVE),
                   0.01);
  d = smin(d, smax(ear, pE.y - EAR_HEIGHT, 0.03), BL_EAR);
  return d;
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

void buildLimbFrame(vec3 root, vec3 tip, vec3 prox, out vec3 eLong,
                    out vec3 eDor, out vec3 eLat, out float segLen) {
  vec3 seg = tip - root;
  float seg2 = dot(seg, seg);
  segLen = sqrt(max(seg2, 1e-8));
  if (seg2 < 1e-8) {
    eLong = normalize(dot(prox, prox) < 1e-8 ? vec3(1.0, 0.0, 0.0) : prox);
  } else {
    eLong = seg / segLen;
  }
  vec3 ref = dot(prox, prox) < 1e-8 ? (abs(eLong.y) < 0.9 ? vec3(0.0, 1.0, 0.0)
                                                          : vec3(1.0, 0.0, 0.0))
                                    : prox;
  eLat = cross(eLong, ref);
  float lat2 = dot(eLat, eLat);
  if (lat2 < 1e-8) {
    eLat = cross(eLong, abs(eLong.z) < 0.9 ? vec3(0.0, 0.0, 1.0)
                                           : vec3(1.0, 0.0, 0.0));
    lat2 = dot(eLat, eLat);
  }
  eLat = lat2 < 1e-8 ? vec3(0.0, 0.0, 1.0) : eLat * inversesqrt(lat2);
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

float sdPaw(vec3 p, vec3 eLong, vec3 eDor, vec3 eLat, float pawLen, vec3 padOff,
            vec3 padR, vec3 dorOff, vec3 dorR, float blend, vec3 tBase, vec3 tR,
            float tSpread, float tInset, float tk) {
  vec3 qL = toLimbLocal(p, vec3(0.0), eLong, eDor, eLat);
  float d =
      smin(sdEllipsoid(qL - padOff * pawLen, padR * pawLen),
           sdEllipsoid(qL - dorOff * pawLen, dorR * pawLen), blend * pawLen);
  vec3 b = tBase * pawLen;
  vec3 rI = tR * pawLen;
  vec3 rO = rI * vec3(0.86, 0.92, 0.84);
  float ts = tSpread * pawLen;
  float ti = tInset * pawLen;
  float k = tk * pawLen;
  float dt = sdEllipsoid(qL - (b + vec3(-ti, 0.0, -1.5 * ts)), rO);
  dt = smin(dt, sdEllipsoid(qL - (b + vec3(0.0, 0.0, -0.5 * ts)), rI), k);
  dt = smin(dt, sdEllipsoid(qL - (b + vec3(0.0, 0.0, 0.5 * ts)), rI), k);
  return smin(
      d, smin(dt, sdEllipsoid(qL - (b + vec3(-ti, 0.0, 1.5 * ts)), rO), k), k);
}

float sdFLeg(vec3 p, vec3 s, vec3 e, vec3 w, vec3 pw) {
  float d = sminJointTight(sdTCap(p, s, e, FU_RT, FU_RB),
                           sdTCap(p, e, w, FF_RT, FF_RB), BL_ELBOW);
  d = sminJointTight(d, sdTCap(p, w, mix(w, pw, FRONT_PAW_CHAIN), FP_RT, FP_RB),
                     BL_WRIST);
  vec3 eL, eD, eLa;
  float len;
  buildLimbFrame(w, pw, w - e, eL, eD, eLa, len);
  return sminJointTight(
      d,
      sdPaw(p - pw, eL, eD, eLa, len, FRONT_PAW_PAD_OFF, FRONT_PAW_PAD_RADII,
            FRONT_PAW_DORSAL_OFF, FRONT_PAW_DORSAL_RADII, FRONT_PAW_BLEND,
            FRONT_PAW_TOE_BASE, FRONT_PAW_TOE_RADII, FRONT_PAW_TOE_SPREAD,
            FRONT_PAW_TOE_INSET, FRONT_PAW_TOE_BLEND),
      BL_FRONT_PAW);
}

float sdRLeg(vec3 p, vec3 h, vec3 k, vec3 hk, vec3 pw) {
  float d = sdTCap(p, h, k, RT_RT, RT_RB);
  vec3 fem = k - h;
  float fL = max(length(fem), 1e-4);
  vec3 eL = fem / fL;
  vec3 eLa = cross(vec3(0.0, 1.0, 0.0), eL);
  if (dot(eLa, eLa) < 1e-6)
    eLa = cross(vec3(0.0, 0.0, 1.0), eL);
  eLa = normalize(eLa);
  if (eLa.z * (h.z >= 0.0 ? 1.0 : -1.0) > 0.0)
    eLa = -eLa;
  vec3 eD = normalize(cross(eL, eLa));

  vec3 pP = p - (h + eL * (THIGH_POST_OFF.x * fL) +
                 eD * (THIGH_POST_OFF.y * fL) + eLa * (THIGH_POST_OFF.z * fL));
  d = smin(d,
           sdEllipsoid(vec3(dot(pP, eL), dot(pP, eD), dot(pP, eLa)),
                       THIGH_POST_RADII * fL),
           BL_THIGH_ANAT);

  vec3 pC = p - (h + eL * (THIGH_CRAN_OFF.x * fL) +
                 eD * (THIGH_CRAN_OFF.y * fL) + eLa * (THIGH_CRAN_OFF.z * fL));
  d = smin(d,
           sdEllipsoid(vec3(dot(pC, eL), dot(pC, eD), dot(pC, eLa)),
                       THIGH_CRAN_RADII * fL),
           BL_THIGH_ANAT);

  vec3 pS = p - (k + eL * (STIFLE_OFF.x * fL) + eD * (STIFLE_OFF.y * fL) +
                 eLa * (STIFLE_OFF.z * fL));
  d = sminJointTight(
      sminJointTight(d,
                     sdEllipsoid(vec3(dot(pS, eL), dot(pS, eD), dot(pS, eLa)),
                                 STIFLE_RADII * fL),
                     BL_STIFLE_ANAT),
      sdTCap(p, k, hk, RL_RT, RL_RB), BL_KNEE);

  d = sminJointTight(
      d, sdTCap(p, hk, mix(hk, pw, REAR_PAW_CHAIN), RM_RT, RM_RB), BL_HOCK);

  vec3 pL, pD, pLa;
  float pLen;
  buildLimbFrame(hk, pw, hk - k, pL, pD, pLa, pLen);
  return sminJointTight(
      d,
      sdPaw(p - pw, pL, pD, pLa, pLen, REAR_PAW_PAD_OFF, REAR_PAW_PAD_RADII,
            REAR_PAW_DORSAL_OFF, REAR_PAW_DORSAL_RADII, REAR_PAW_BLEND,
            REAR_PAW_TOE_BASE, REAR_PAW_TOE_RADII, REAR_PAW_TOE_SPREAD,
            REAR_PAW_TOE_INSET, REAR_PAW_TOE_BLEND),
      BL_REAR_PAW);
}

// ── Scene evaluation ────────────────────────────────────────────────────────

vec3 toCat(vec3 p) {
  p /= 1.5;
  p.x = -p.x;
  p.xz *= gRotBodyYaw;
  p.yz *= gRotBodyRoll;
  return p;
}

float map(vec3 rawP) {
  vec3 p = toCat(rawP);
  float bd = length(p - gCatCenter) - gCatRadius;
  if (bd > 0.55)
    return bd * 1.5;

  float d = sdTorso(p);

  float hBd = length(p - j5) - 0.25;
  d = smin(d, hBd > 0.35 ? hBd : sdHead(p), BL_NECK);

  float tBd = length(p - gTailCenter) - gTailRadius;
  d = smin(d, tBd > 0.45 ? tBd : sdTail(p), BL_TAIL);

  float flBd = length(p - gFLegCenter) - gFLegRadius;
  d = sminAttach(d,
                 flBd > 0.45 ? flBd
                             : min(sdFLeg(p, flS, flE, flW, flP),
                                   sdFLeg(p, frS, frE, frW, frP)),
                 mix(BL_FRONT_ATTACH, 0.10, gLoafWeight));

  float rlBd = length(p - gRLegCenter) - gRLegRadius;
  d = sminAttach(d,
                 rlBd > 0.45 ? rlBd
                             : min(sdRLeg(p, rlH, rlK, rlHk, rlP_),
                                   sdRLeg(p, rrH, rrK, rrHk, rrP_)),
                 mix(BL_REAR_ATTACH, 0.10, gLoafWeight));

  return d * 1.5;
}

float mapShadow(vec3 rawP) {
  vec3 p = toCat(rawP);
  float bd = length(p - gCatCenter) - gCatRadius;
  if (bd > 0.55)
    return bd * 1.5;

  float d =
      min(min(sdCapsule(p, j0, j1, SP_RAD_0), sdCapsule(p, j1, j2, SP_RAD_1)),
          min(sdCapsule(p, j2, j3, SP_RAD_2), sdCapsule(p, j3, j4, SP_RAD_3)));
  d = min(d, sdTCap(p, j4, j5, SP_RAD_4, SP_RAD_4_TIP));

  d = min(d, sdEllipsoid(p - j5, CRANIUM_RADII * 1.1));

  d = min(d, min(sdTCap(p, flS, flE, FU_RT, FU_RB),
                 sdTCap(p, flE, flW, FF_RT, FF_RB)));
  d = min(d, min(sdTCap(p, frS, frE, FU_RT, FU_RB),
                 sdTCap(p, frE, frW, FF_RT, FF_RB)));
  d = min(d, min(sdTCap(p, rlH, rlK, RT_RT, RT_RB),
                 sdTCap(p, rlK, rlHk, RL_RT, RL_RB)));
  d = min(d, min(sdTCap(p, rrH, rrK, RT_RT, RT_RB),
                 sdTCap(p, rrK, rrHk, RL_RT, RL_RB)));

  d = min(d, min(sdTCap(p, t0_, t1_, TR0, TR1), sdTCap(p, t1_, t2_, TR1, TR2)));
  d = min(d, sdTCap(p, t2_, t3_, TR2, TR3));

  return d * 1.5;
}

void queryHeadParts(vec3 p, out float eyeD, out float noseD) {
  p = toCat(p);
  vec3 pH = p - j5;
  pH.xy *= gRotHeadPitch;
  pH.xz *= gRotHeadYaw;
  eyeD = (length(pH - EYE_POS) - EYE_RADIUS) * 1.5;
  vec3 pN = pH - NOSE_OFFSET;
  noseD = smax(smin(sdEllipsoid(pN, NOSE_TIP_R),
                    sdEllipsoid(pN - NOSE_BRIDGE_OFF, NOSE_BRIDGE_R), 0.01),
               -sdSphere(pN - NOSTRIL_OFF, NOSTRIL_R), 0.004) *
          1.5;
}

vec3 calcNormal(vec3 p, float eps) {
  vec2 e = vec2(eps, -eps);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
                   e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// ── Ray marching & lighting ─────────────────────────────────────────────────

const float STEP_MARCH = 0.8;
float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < RAYMARCH_STEPS; i++) {
    float d = map(ro + rd * t);
    t += d * STEP_MARCH;
    if (t > 20.0 || d < 0.001)
      break;
  }
  return t;
}

float calcShadow(vec3 pos, vec3 lDir) {
  float res = 1.0;
  float ph = 1e10;
  float t = 0.045;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float d = mapShadow(pos + lDir * t);
    float y = d * d / (2.0 * ph);
    float k = sqrt(max(d * d - y * y, 0.0));
    res = min(res, 2.0 * k / max(t - y, 0.001));
    ph = d;
    t += clamp(d, 0.006, 0.10);
    if (res < 0.005 || t > 2.5)
      break;
  }
  return clamp(res, 0.0, 1.0);
}

float halftone(float darkness) {
  vec2 px = gl_FragCoord.xy;
  float ca = HALFTONE_COS, sa = HALFTONE_SIN;
  vec2 rotUV = vec2(px.x * ca - px.y * sa, px.x * sa + px.y * ca);
  float cellSize =
      max(4.0, min(7.0, min(u_resolution.x, u_resolution.y) / 160.0));
  vec2 cc = (floor(rotUV / cellSize) + 0.5) * cellSize;
  float dist = length(px - vec2(cc.x * ca + cc.y * sa, -cc.x * sa + cc.y * ca));
  float dotR = cellSize * HALFTONE_DOT_MAX * sqrt(clamp(darkness, 0.0, 1.0));
  return 1.0 - smoothstep(dotR - 0.5, dotR + 0.5, dist);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec3 ro = u_camera;
  initFromUniforms();

  vec3 cw = normalize(CAM_TARGET - ro);
  vec3 cu = normalize(cross(cw, vec3(0, 1, 0)));
  vec3 cv = normalize(cross(cu, cw));
  vec3 rd = normalize(uv.x * cu + uv.y * cv + CAM_FOCAL * cw);

  vec3 col = PAPER;
  float t = rayMarch(ro, rd);

  if (t < 20.0) {
    vec3 p = ro + rd * t;
    vec3 l = normalize(LIGHT_POS - p);
    if (u_mode == 2) {
      col = INK;
    } else if (u_mode == 1) {
      vec3 ns = calcNormal(p, 0.20);
      col = pow(ns * 0.5 + 0.5, vec3(1.0 / 2.2));
    } else if (u_mode == 0) {
      vec3 ns = calcNormal(p, 0.20);

      float sha = calcShadow(p + ns * 0.05, l);

      float eyeD = 1.0, noseD = 1.0;
      if (length(toCat(p) - j5) < 0.25)
        queryHeadParts(p, eyeD, noseD);
      bool isEye = eyeD < 0.006;
      bool isNose = !isEye && noseD < 0.010;

      float dif = max(dot(ns, l), 0.0);
      float hemi = 0.65 + 0.35 * ns.y;
      float rim = pow(clamp(1.0 + dot(ns, rd), 0.0, 1.0), 3.0);
      float fill =
          clamp(dot(ns, normalize(vec3(0.5, 0.3, -0.6))), 0.0, 1.0) * 0.12;
      float brightness =
          dif * sha * 0.55 + hemi * 0.15 + rim * 0.28 + fill + 0.08;
      brightness = mix(brightness, 1.0, 1.0 - exp(-t * t * 0.003));

      if (isEye)
        brightness = 0.0;
      if (isNose)
        brightness *= 0.25;

      col = mix(PAPER, INK, halftone(1.0 - clamp(brightness, 0.0, 1.0)));
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
