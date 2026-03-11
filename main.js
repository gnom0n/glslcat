import { CAT_CONFIG, QUALITY_PRESETS } from "./cat-config.js";
import { computeCatFK } from "./cat-fk.js";

const VERT_SRC =
  "attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}";
const FRAG_PATH = "cat.frag";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const POSE_KEYS = [0, 1, 2, 3, 5, 6];

// ── Shader config ───────────────────────────────────────────────────────────

function shaderConfigForPreset(preset) {
  const base = { ...CAT_CONFIG.shader };
  delete base.RAYMARCH_STEPS;
  delete base.SHADOW_STEPS;
  delete base.TAIL_SDF_SAMPLES;
  return { ...base, ...preset };
}

function shaderConfigToGLSL(cfg) {
  const INT_KEYS = new Set(["TAIL_SDF_SAMPLES", "RAYMARCH_STEPS", "SHADOW_STEPS"]);
  const FK_ONLY_KEYS = new Set(["STRIDE_PERIOD"]);
  const lines = [];
  for (const [key, val] of Object.entries(cfg)) {
    if (FK_ONLY_KEYS.has(key)) continue;
    if (Array.isArray(val)) {
      const t = "vec" + val.length;
      lines.push(`const ${t} ${key} = ${t}(${val.join(", ")});`);
    } else if (INT_KEYS.has(key)) {
      lines.push(`const int ${key} = ${val};`);
    } else {
      lines.push(`const float ${key} = ${val.toFixed(5)};`);
    }
  }
  const a = cfg.HALFTONE_ANGLE;
  lines.push(`const float HALFTONE_COS = ${Math.cos(a).toFixed(5)};`);
  lines.push(`const float HALFTONE_SIN = ${Math.sin(a).toFixed(5)};`);
  return lines.join("\n") + "\n";
}

function buildFullShaderSource(fragBase, preset) {
  const configGLSL = shaderConfigToGLSL(shaderConfigForPreset(preset));
  const endifIdx = fragBase.indexOf("#endif");
  if (endifIdx < 0) throw new Error("cat.frag: missing #endif precision guard");
  const insertPos = endifIdx + "#endif".length;
  return fragBase.slice(0, insertPos) + "\n" + configGLSL + fragBase.slice(insertPos);
}

// ── GL helpers ──────────────────────────────────────────────────────────────

function showError(message) {
  console.error(message);
  document.body.innerHTML = "";
  const pre = document.createElement("pre");
  pre.style.margin = "0";
  pre.style.padding = "12px";
  pre.style.color = "#fff";
  pre.style.font = "12px/1.4 monospace";
  pre.textContent = String(message);
  document.body.appendChild(pre);
}

function createGLContext(canvas) {
  const opts = {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: false,
  };
  return canvas.getContext("webgl2", opts) || canvas.getContext("webgl", opts);
}

function setupFullscreenQuad(gl) {
  const quad = gl.createBuffer();
  if (!quad) throw new Error("Failed to create vertex buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

// ── Async shader compilation ────────────────────────────────────────────────

function startProgramCompile(gl, fragSource) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT_SRC);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragSource);
  gl.compileShader(fs);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);

  // Don't check status — let GPU compile asynchronously
  return { program, vs, fs };
}

function validateProgram(gl, compile) {
  const { program, vs, fs } = compile;
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(vs) || "vertex shader compile error";
    cleanupCompile(gl, compile);
    throw new Error(log);
  }
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fs) || "fragment shader compile error";
    cleanupCompile(gl, compile);
    throw new Error(log);
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "program link error";
    cleanupCompile(gl, compile);
    throw new Error(log);
  }
  // Detach and delete shader objects (program is linked)
  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function cleanupCompile(gl, compile) {
  gl.deleteShader(compile.vs);
  gl.deleteShader(compile.fs);
  gl.deleteProgram(compile.program);
}

function waitForCompletion(gl, compile, ext) {
  return new Promise((resolve) => {
    if (!ext) {
      resolve();
      return;
    }
    function check() {
      if (gl.getProgramParameter(compile.program, ext.COMPLETION_STATUS_KHR)) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  });
}

function isCompileComplete(gl, program, ext) {
  if (!ext) return true;
  return gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR);
}

// ── FK uniform wiring ───────────────────────────────────────────────────────

const FK_VEC3_MAP = {
  j0: "u_j0", j1: "u_j1", j2: "u_j2", j3: "u_j3", j4: "u_j4", j5: "u_j5",
  flS: "u_flS", flE: "u_flE", flW: "u_flW", flP: "u_flP",
  frS: "u_frS", frE: "u_frE", frW: "u_frW", frP: "u_frP",
  rlH: "u_rlH", rlK: "u_rlK", rlHk: "u_rlHk", rlP: "u_rlP",
  rrH: "u_rrH", rrK: "u_rrK", rrHk: "u_rrHk", rrP: "u_rrP",
  t0: "u_t0", t1: "u_t1", t2: "u_t2", t3: "u_t3", t4: "u_t4",
  catCenter: "u_catCenter", flegCenter: "u_flegCenter",
  rlegCenter: "u_rlegCenter", tailCenter: "u_tailCenter",
  ribcageRadii: "u_ribcageRadii", haunchRadii: "u_haunchRadii",
};

const FK_FLOAT_MAP = {
  catRadius: "u_catRadius", flegRadius: "u_flegRadius",
  rlegRadius: "u_rlegRadius", tailRadius: "u_tailRadius",
  bodyRoll: "u_bodyRoll", breath: "u_breath", breathZ: "u_breathZ",
  breathAmp: "u_breathAmp", bellyY: "u_bellyY",
  loafWeight: "u_loafWeight", onBackWeight: "u_onBackWeight",
  headPitch: "u_headPitch", headYaw: "u_headYaw",
  earTilt: "u_earTilt", earFlare: "u_earFlare", earYaw: "u_earYawA",
};

const ALL_UNIFORM_NAMES = [
  "u_resolution", "u_camera", "u_mode",
  ...Object.values(FK_VEC3_MAP),
  ...Object.values(FK_FLOAT_MAP),
];

function getUniformLocations(gl, program) {
  const locs = {};
  for (const name of ALL_UNIFORM_NAMES) {
    locs[name] = gl.getUniformLocation(program, name);
  }
  return locs;
}

// ── State & input ───────────────────────────────────────────────────────────

function createState() {
  return {
    camT: 0.6,
    camP: 0.35,
    camD: 3.5,
    dragging: false,
    dragId: -1,
    lastX: 0,
    lastY: 0,
    fromPose: 0,
    toPose: 0,
    blendT: 1,
    blendDurationSec: CAT_CONFIG.animation.blendSeconds,
    mode: 0,
    lickT: 1,
    walkOffset: 0,
    startTime: 0,
    headYawOffset: 0,
    arrowUp: false,
    arrowLeft: false,
    arrowRight: false,
  };
}

function setPose(state, pose) {
  let src;
  if (state.blendT >= 1) {
    src = state.toPose;
  } else {
    const eased = 1 - Math.pow(1 - state.blendT, 2.5);
    src = eased >= 0.5 ? state.toPose : state.fromPose;
  }
  if (pose === state.toPose) return;
  const key = `${src}_${pose}`;
  if (CAT_CONFIG.animation.blockedTransitions?.[key]) return;
  if (state.lickT < 0.60) state.lickT = 0.60;
  if (pose === 4) {
    state.walkOffset = (performance.now() - state.startTime) * 0.001;
  }
  state.fromPose = src;
  state.toPose = pose;
  state.blendT = 0;
  state.blendDurationSec = CAT_CONFIG.animation.blendSeconds;
}

function resizeCanvas(gl, canvas) {
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    CAT_CONFIG.rendering.maxPixelRatio,
  );
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);
}

function attachInputHandlers(canvas, state) {
  const { dragSensitivity, zoomSensitivity, elevRange, distRange } =
    CAT_CONFIG.camera;

  canvas.addEventListener("pointerdown", (e) => {
    state.dragging = true;
    state.dragId = e.pointerId;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    canvas.setPointerCapture(state.dragId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!state.dragging || e.pointerId !== state.dragId) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.camT -= dx * dragSensitivity;
    state.camP = clamp(
      state.camP + dy * dragSensitivity,
      elevRange[0],
      elevRange[1],
    );
  });

  function endDrag(e) {
    if (e.pointerId !== state.dragId) return;
    state.dragging = false;
    state.dragId = -1;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);

  canvas.addEventListener(
    "wheel",
    (e) => {
      state.camD = clamp(
        state.camD * (1 + e.deltaY * zoomSensitivity),
        distRange[0],
        distRange[1],
      );
      e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const key = e.key;
      if (key === "ArrowUp" && !state.arrowUp) {
        state.arrowUp = true;
        setPose(state, 4);
        return;
      }
      if (key === "ArrowLeft") { state.arrowLeft = true; return; }
      if (key === "ArrowRight") { state.arrowRight = true; return; }
      const lk = key.toLowerCase();
      if (lk >= "1" && lk <= "6") {
        setPose(state, POSE_KEYS[lk.charCodeAt(0) - 49]);
        return;
      }
      if (lk === "d") { state.mode = (state.mode + 1) % 3; return; }
      if (lk === "l") {
        if (
          (state.toPose === 1 || state.toPose === 6) &&
          state.blendT >= 1 && state.lickT >= 1
        ) {
          state.lickT = 0;
        }
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "keyup",
    (e) => {
      const key = e.key;
      if (key === "ArrowUp") {
        state.arrowUp = false;
        if (state.toPose === 4) setPose(state, 0);
        return;
      }
      if (key === "ArrowLeft") { state.arrowLeft = false; return; }
      if (key === "ArrowRight") { state.arrowRight = false; return; }
    },
    { passive: true },
  );
}

// ── Simulation & rendering ──────────────────────────────────────────────────

function updateSimulation(state, dt) {
  if (state.blendT < 1) {
    state.blendT = Math.min(1, state.blendT + dt / state.blendDurationSec);
  }
  if (state.lickT < 1) {
    state.lickT = Math.min(1, state.lickT + dt / CAT_CONFIG.animation.lickSeconds);
  }
  const headTarget = ((state.arrowRight ? 1 : 0) - (state.arrowLeft ? 1 : 0)) *
    CAT_CONFIG.animation.headTurnMax;
  const headSpeed = CAT_CONFIG.animation.headTurnSpeed;
  const easeFactor = 1 - Math.exp(-headSpeed * dt);
  state.headYawOffset += (headTarget - state.headYawOffset) * easeFactor;
}

function applyUniforms(gl, locs, canvas, state, now, start) {
  const eased = 1 - Math.pow(1 - state.blendT, 2.5);
  const cp = Math.cos(state.camP), sp = Math.sin(state.camP);
  const camX = state.camD * cp * Math.sin(state.camT);
  const camY = state.camD * sp + 0.1;
  const camZ = state.camD * cp * Math.cos(state.camT);

  gl.uniform2f(locs["u_resolution"], canvas.width, canvas.height);
  gl.uniform3f(locs["u_camera"], camX, camY, camZ);
  gl.uniform1i(locs["u_mode"], state.mode);

  const fk = computeCatFK({
    from: state.fromPose,
    to: state.toPose,
    blend: eased,
    lick: state.lickT,
    walkOffset: state.walkOffset,
    headYawOffset: state.headYawOffset,
    time: (now - start) * 0.001,
  });

  for (const [prop, uName] of Object.entries(FK_VEC3_MAP)) {
    const loc = locs[uName];
    if (loc) {
      const v = fk[prop];
      gl.uniform3f(loc, v[0], v[1], v[2]);
    }
  }
  for (const [prop, uName] of Object.entries(FK_FLOAT_MAP)) {
    const loc = locs[uName];
    if (loc) gl.uniform1f(loc, fk[prop]);
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

async function init() {
  const canvas = document.getElementById("c");
  const gl = createGLContext(canvas);
  if (!gl) {
    document.body.textContent = "WebGL not supported";
    return;
  }

  const parallelExt = gl.getExtension("KHR_parallel_shader_compile");

  // Fetch shader source (allow browser caching)
  const res = await fetch(FRAG_PATH);
  if (!res.ok) throw new Error(FRAG_PATH + ": " + res.status);
  const fragBase = await res.text();

  // Shared vertex buffer — attribute 0 is pinned via bindAttribLocation
  setupFullscreenQuad(gl);

  // Determine quality strategy
  const qualityParam = new URLSearchParams(window.location.search).get("quality");
  const wantProgressive = !qualityParam; // progressive when no explicit preference
  const initialPreset = (qualityParam === "high" && !wantProgressive)
    ? QUALITY_PRESETS.high
    : QUALITY_PRESETS.fast;

  // Compile initial shader (async if extension available)
  const initialSource = buildFullShaderSource(fragBase, initialPreset);
  const initialCompile = startProgramCompile(gl, initialSource);
  await waitForCompletion(gl, initialCompile, parallelExt);
  let currentProgram = validateProgram(gl, initialCompile);

  gl.useProgram(currentProgram);
  let locs = getUniformLocations(gl, currentProgram);

  // Start background compilation of high-quality shader
  let pendingUpgrade = null;
  if (wantProgressive) {
    const highSource = buildFullShaderSource(fragBase, QUALITY_PRESETS.high);
    pendingUpgrade = startProgramCompile(gl, highSource);
  }

  const state = createState();
  attachInputHandlers(canvas, state);

  const resize = () => resizeCanvas(gl, canvas);
  resize();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener(
      "beforeunload",
      () => observer.disconnect(),
      { once: true, passive: true },
    );
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  document.getElementById("loading")?.remove();

  const start = performance.now();
  state.startTime = start;
  let prev = start;

  function frame(now) {
    // Check for high-quality upgrade
    if (pendingUpgrade && isCompileComplete(gl, pendingUpgrade.program, parallelExt)) {
      try {
        const upgraded = validateProgram(gl, pendingUpgrade);
        gl.deleteProgram(currentProgram);
        currentProgram = upgraded;
        gl.useProgram(currentProgram);
        locs = getUniformLocations(gl, currentProgram);
      } catch (e) {
        console.warn("High-quality shader failed, staying on fast:", e.message);
      }
      pendingUpgrade = null;
    }

    const dt = Math.min((now - prev) * 0.001, 0.1);
    prev = now;
    updateSimulation(state, dt);
    applyUniforms(gl, locs, canvas, state, now, start);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init().catch(showError);
