const QUALITY_PRESETS = {
  fast: {
    RAYMARCH_STEPS: 48,
    SHADOW_STEPS: 16,
    TAIL_SDF_SAMPLES: 8,
  },
  high: {
    RAYMARCH_STEPS: 96,
    SHADOW_STEPS: 32,
    TAIL_SDF_SAMPLES: 16,
  },
};

const quality = new URLSearchParams(window.location.search).get("quality") ||
  "fast";
const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.fast;

export const CAT_CONFIG = {
  // Injected into GLSL as const declarations before shader compilation
  shader: {
    CAM_TARGET: [0.0, 0.05, 0.0],
    CAM_FOCAL: 2.0,
    LIGHT_POS: [-2.0, 4.0, 4.0],
    PAPER: [0.941, 0.925, 0.894],
    BODY_YAW: -0.8,
    STRIDE_PERIOD: 0.82,
    INK: [0.102, 0.102, 0.118],
    HALFTONE_ANGLE: 0.26,
    HALFTONE_DOT_MAX: 0.55,
    TAIL_BLEND_K: 0.035,
    TAIL_BASE_HOLD: 0.22,
    TAIL_TAPER_EXP: 1.65,
    TAIL_TIP_RADIUS_MUL: 0.96,
    TAIL_TIP_ROUND_MUL: 1.1,
    ...preset,
  },

  // Used directly by JS
  camera: {
    elevRange: [-0.3, 1.2],
    distRange: [0.6, 5.0],
    dragSensitivity: 0.005,
    zoomSensitivity: 0.001,
  },
  animation: {
    blendSeconds: 0.8,
    lickSeconds: 5.0,
    // OnBack requires standing (0) as an intermediate — direct transitions
    // to other grounded poses would clip through the floor
    blockedTransitions: {
      "5_6": true,
      "6_5": true, // OnBack ↔ UprightSit
      "5_1": true,
      "1_5": true, // OnBack ↔ Sit
      "5_2": true,
      "2_5": true, // OnBack ↔ Loaf
      "5_3": true,
      "3_5": true, // OnBack ↔ Stretch
      "5_4": true,
      "4_5": true, // OnBack ↔ Walk
    },
    headTurnSpeed: 6.0,
    headTurnMax: 0.5,
  },
  rendering: {
    maxPixelRatio: 1,
  },
};
