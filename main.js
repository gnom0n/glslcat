import { CAT_CONFIG } from "./cat-config.js";

const VERT_SRC =
  "attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}";
const FRAG_PATH = "cat.frag";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// number keys 1-6 map to these pose indices; walk (4) is ArrowUp-only
const POSE_KEYS = [0, 1, 2, 3, 5, 6];

function shaderConfigToGLSL(cfg) {
  const INT_KEYS = new Set(["TAIL_SDF_SAMPLES", "RAYMARCH_STEPS", "SHADOW_STEPS"]);
  const lines = [];
  for (const [key, val] of Object.entries(cfg)) {
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

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader object");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log =
      gl.getShaderInfoLog(shader) || "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl, fragSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error("Failed to create program object");
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log =
      gl.getProgramInfoLog(program) || "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

async function loadFragmentSource(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(path + ": " + res.status);
  return res.text();
}

function setupFullscreenQuad(gl, program) {
  const quad = gl.createBuffer();
  if (!quad) throw new Error("Failed to create vertex buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPos = gl.getAttribLocation(program, "a_pos");
  if (aPos < 0) throw new Error("Missing attribute: a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
}

function getUniformLocations(gl, program) {
  return {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    time: gl.getUniformLocation(program, "u_time"),
    camera: gl.getUniformLocation(program, "u_camera"),
    from: gl.getUniformLocation(program, "u_from"),
    to: gl.getUniformLocation(program, "u_to"),
    blend: gl.getUniformLocation(program, "u_blend"),
    mode: gl.getUniformLocation(program, "u_mode"),
    lick: gl.getUniformLocation(program, "u_lick"),
    walkOffset: gl.getUniformLocation(program, "u_walkOffset"),
    headYaw: gl.getUniformLocation(program, "u_headYaw"),
  };
}

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
    // mid-blend pose change: snap source to whichever pose is visually dominant
    const eased = 1 - Math.pow(1 - state.blendT, 2.5);
    src = eased >= 0.5 ? state.toPose : state.fromPose;
  }
  if (pose === state.toPose) return;
  const key = `${src}_${pose}`;
  if (CAT_CONFIG.animation.blockedTransitions?.[key]) return;
  // if paw is still raised (lick phase 0.00-0.60), skip to lowering phase
  if (state.lickT < 0.60) {
    state.lickT = 0.60;
  }
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
  const w = Math.max(1, Math.round(window.innerWidth * dpr));
  const h = Math.max(1, Math.round(window.innerHeight * dpr));
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
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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
      if (lk === "d") {
        state.mode = (state.mode + 1) % 3;
        return;
      }
      if (lk === "l") {
        if (
          (state.toPose === 1 || state.toPose === 6) &&
          state.blendT >= 1 && state.lickT >= 1
        )
          state.lickT = 0;
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

function updateSimulation(state, dt) {
  if (state.blendT < 1)
    state.blendT = Math.min(
      1,
      state.blendT + dt / state.blendDurationSec,
    );
  if (state.lickT < 1)
    state.lickT = Math.min(
      1,
      state.lickT + dt / CAT_CONFIG.animation.lickSeconds,
    );
  const headTarget = ((state.arrowRight ? 1 : 0) - (state.arrowLeft ? 1 : 0))
    * CAT_CONFIG.animation.headTurnMax;
  const headSpeed = CAT_CONFIG.animation.headTurnSpeed;
  // exponential smoothing — approaches target asymptotically at headTurnSpeed
  state.headYawOffset += (headTarget - state.headYawOffset) * Math.min(1, headSpeed * dt);
}

function applyUniforms(gl, uniforms, canvas, state, now, start) {
  const eased = 1 - Math.pow(1 - state.blendT, 2.5);
  const cp = Math.cos(state.camP), sp = Math.sin(state.camP);
  const camX = state.camD * cp * Math.sin(state.camT);
  const camY = state.camD * sp + 0.1;
  const camZ = state.camD * cp * Math.cos(state.camT);

  if (uniforms.resolution)
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  if (uniforms.time) gl.uniform1f(uniforms.time, (now - start) * 0.001);
  if (uniforms.camera)
    gl.uniform3f(uniforms.camera, camX, camY, camZ);
  if (uniforms.from) gl.uniform1f(uniforms.from, state.fromPose);
  if (uniforms.to) gl.uniform1f(uniforms.to, state.toPose);
  if (uniforms.blend) gl.uniform1f(uniforms.blend, eased);
  if (uniforms.mode) gl.uniform1i(uniforms.mode, state.mode);
  if (uniforms.lick) gl.uniform1f(uniforms.lick, state.lickT);
  if (uniforms.walkOffset)
    gl.uniform1f(uniforms.walkOffset, state.walkOffset);
  if (uniforms.headYaw)
    gl.uniform1f(uniforms.headYaw, state.headYawOffset);
}

async function init() {
  const canvas = document.getElementById("c");
  const gl = createGLContext(canvas);
  if (!gl) {
    document.body.textContent = "WebGL not supported";
    return;
  }

  const fragSource = await loadFragmentSource(FRAG_PATH);
  const configGLSL = shaderConfigToGLSL(CAT_CONFIG.shader);
  // inject shader constants after the precision #endif guard so they
  // appear before any GLSL code that references them
  const endifIdx = fragSource.indexOf("#endif");
  if (endifIdx < 0) throw new Error("cat.frag: missing #endif precision guard");
  const insertPos = endifIdx + "#endif".length;
  const fullSource =
    fragSource.slice(0, insertPos) +
    "\n" +
    configGLSL +
    fragSource.slice(insertPos);
  const program = createProgram(gl, fullSource);
  gl.useProgram(program);
  setupFullscreenQuad(gl, program);
  const uniforms = getUniformLocations(gl, program);
  const state = createState();
  attachInputHandlers(canvas, state);

  const resize = () => resizeCanvas(gl, canvas);
  resize();
  window.addEventListener("resize", resize, { passive: true });

  document.getElementById("loading")?.remove();

  const start = performance.now();
  state.startTime = start;
  let prev = start;
  function frame(now) {
    const dt = (now - prev) * 0.001;
    prev = now;
    updateSimulation(state, dt);
    applyUniforms(gl, uniforms, canvas, state, now, start);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init().catch(showError);
