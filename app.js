(() => {
  "use strict";

  const canvas = document.getElementById("dungeonCanvas");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  const messageLog = document.getElementById("messageLog");
  const positionText = document.getElementById("positionText");

  if (!gl) {
    messageLog.textContent = "このブラウザではWebGLを初期化できませんでした。";
    return;
  }

  const TILE = {
    EMPTY: 0,
    WALL: 1,
    DOOR: 2,
    STAIR: 3,
    EVENT: 4,
  };

  // 0: north, 1: east, 2: south, 3: west
  const DIRS = [
    { x: 0, z: -1, label: "N" },
    { x: 1, z: 0, label: "E" },
    { x: 0, z: 1, label: "S" },
    { x: -1, z: 0, label: "W" },
  ];

  const map = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,3,1],
    [1,0,1,0,1,0,1,1,1,0,0,1],
    [1,0,1,0,0,0,0,0,1,0,1,1],
    [1,0,1,1,1,2,1,0,1,0,0,1],
    [1,0,0,0,1,0,1,0,0,0,1,1],
    [1,1,1,0,1,0,1,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,1,1,0,1],
    [1,0,1,1,1,1,1,0,0,0,0,1],
    [1,0,0,0,4,0,1,0,1,1,0,1],
    [1,1,1,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  const state = {
    floor: "B1F",
    x: 1,
    z: 1,
    dir: 1,
    openedDoors: new Set(),
    showMap: false,
    animation: null,
    message: "前進・旋回・調べるが動く、WebGLポリゴン3Dの最小試作です。",
  };

  const visual = {
    x: state.x,
    z: state.z,
    dir: state.dir,
  };

  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;

    uniform mat4 uProjection;
    uniform mat4 uView;

    varying vec3 vNormal;
    varying vec3 vColor;
    varying float vDepth;

    void main() {
      vec4 viewPos = uView * vec4(aPosition, 1.0);
      gl_Position = uProjection * viewPos;
      vNormal = aNormal;
      vColor = aColor;
      vDepth = -viewPos.z;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vColor;
    varying float vDepth;

    void main() {
      vec3 lightDir = normalize(vec3(0.25, 0.85, 0.45));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
      float shade = 0.28 + diffuse * 0.62;
      float fog = clamp((vDepth - 2.0) / 7.5, 0.0, 1.0);
      vec3 fogColor = vec3(0.025, 0.027, 0.032);
      vec3 color = mix(vColor * shade, fogColor, fog);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  const attribs = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    color: gl.getAttribLocation(program, "aColor"),
  };
  const uniforms = {
    projection: gl.getUniformLocation(program, "uProjection"),
    view: gl.getUniformLocation(program, "uView"),
  };

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  // CULL_FACE is intentionally disabled for the prototype.
  // It prevents disappearing faces while the wall/floor geometry is still simple.
  gl.clearColor(0.03, 0.032, 0.038, 1.0);

  let scene = buildSceneGeometry();
  let mapOverlay = null;

  function tileAt(x, z) {
    if (z < 0 || z >= map.length || x < 0 || x >= map[0].length) return TILE.WALL;
    return map[z][x];
  }

  function doorKey(x, z) {
    return `${x},${z}`;
  }

  function isDoorOpen(x, z) {
    return state.openedDoors.has(doorKey(x, z));
  }

  function isBlocked(x, z) {
    const tile = tileAt(x, z);
    if (tile === TILE.WALL) return true;
    if (tile === TILE.DOOR && !isDoorOpen(x, z)) return true;
    return false;
  }

  function moveForward(step) {
    if (state.animation) return;
    const d = DIRS[state.dir];
    const nx = state.x + d.x * step;
    const nz = state.z + d.z * step;
    if (isBlocked(nx, nz)) {
      setMessage(step > 0 ? "壁または閉じた扉に阻まれています。" : "背後には進めません。", true);
      return;
    }
    startMoveAnimation(nx, nz);
  }

  function turn(delta) {
    if (state.animation) return;
    const ndir = (state.dir + delta + 4) % 4;
    startTurnAnimation(ndir, delta);
  }

  function inspectFront() {
    if (state.animation) return;
    const d = DIRS[state.dir];
    const fx = state.x + d.x;
    const fz = state.z + d.z;
    const tile = tileAt(fx, fz);

    if (tile === TILE.DOOR && !isDoorOpen(fx, fz)) {
      state.openedDoors.add(doorKey(fx, fz));
      scene = buildSceneGeometry();
      setMessage("重い石扉を押し開けました。通路の奥から冷たい空気が流れます。", false);
      return;
    }

    if (tile === TILE.WALL) {
      setMessage("石壁です。表面には灰色の鉱脈が細く走っています。", false);
      return;
    }

    if (tile === TILE.STAIR) {
      setMessage("下層へ続く階段が見えます。今回は移動処理は未実装です。", false);
      return;
    }

    const current = tileAt(state.x, state.z);
    if (current === TILE.EVENT) {
      setMessage("床に古い紋章があります。目録候補: 『灰冠の印章』。", false);
      return;
    }

    setMessage("周囲を調べました。今のところ目立つものはありません。", false);
  }

  function resetPosition() {
    if (state.animation) return;
    state.x = 1;
    state.z = 1;
    state.dir = 1;
    visual.x = state.x;
    visual.z = state.z;
    visual.dir = state.dir;
    setMessage("初期位置に戻りました。", false);
    updateHud();
  }

  function toggleMap() {
    state.showMap = !state.showMap;
    renderMapOverlay();
  }

  function startMoveAnimation(nx, nz) {
    state.animation = {
      type: "move",
      start: performance.now(),
      duration: 160,
      fromX: state.x,
      fromZ: state.z,
      toX: nx,
      toZ: nz,
    };
    state.x = nx;
    state.z = nz;
    const tile = tileAt(nx, nz);
    if (tile === TILE.STAIR) setMessage("階段の前に到達しました。", false);
    else if (tile === TILE.EVENT) setMessage("足元で古い石板がかすかに鳴りました。", false);
    else setMessage("一歩進みました。", false);
    updateHud();
  }

  function startTurnAnimation(ndir, delta) {
    state.animation = {
      type: "turn",
      start: performance.now(),
      duration: 130,
      fromDir: state.dir,
      toDir: ndir,
      delta,
    };
    state.dir = ndir;
    setMessage(delta > 0 ? "右を向きました。" : "左を向きました。", false);
    updateHud();
  }

  function animate(now) {
    if (!state.animation) return;
    const a = state.animation;
    const t = Math.min(1, (now - a.start) / a.duration);
    const e = easeOutCubic(t);

    if (a.type === "move") {
      visual.x = lerp(a.fromX, a.toX, e);
      visual.z = lerp(a.fromZ, a.toZ, e);
      visual.dir = state.dir;
    } else if (a.type === "turn") {
      const fromAngle = dirToAngle(a.fromDir);
      const toAngle = fromAngle + a.delta * Math.PI / 2;
      visual.dir = angleToVirtualDir(lerp(fromAngle, toAngle, e));
      visual.x = state.x;
      visual.z = state.z;
    }

    if (t >= 1) {
      visual.x = state.x;
      visual.z = state.z;
      visual.dir = state.dir;
      state.animation = null;
    }
  }

  function setMessage(text, isWarning) {
    state.message = text;
    messageLog.textContent = text;
    messageLog.style.borderColor = isWarning ? "rgba(168, 93, 85, .65)" : "rgba(255,255,255,.12)";
  }

  function updateHud() {
    positionText.textContent = `${state.floor} x${state.x} y${state.z} ${DIRS[state.dir].label}`;
    renderMapOverlay();
  }

  function renderMapOverlay() {
    if (!state.showMap) {
      if (mapOverlay) {
        mapOverlay.remove();
        mapOverlay = null;
      }
      return;
    }
    if (!mapOverlay) {
      mapOverlay = document.createElement("pre");
      mapOverlay.className = "map-overlay";
      mapOverlay.setAttribute("aria-label", "簡易マップ");
      document.querySelector(".viewport-panel").appendChild(mapOverlay);
      const style = document.createElement("style");
      style.textContent = `.map-overlay{position:absolute;right:10px;top:42px;margin:0;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(0,0,0,.62);font:11px/1.05 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d8d1c4;letter-spacing:.02em;}`;
      document.head.appendChild(style);
    }
    const lines = map.map((row, z) => row.map((tile, x) => {
      if (state.x === x && state.z === z) return ["▲", "▶", "▼", "◀"][state.dir];
      if (tile === TILE.WALL) return "█";
      if (tile === TILE.DOOR) return isDoorOpen(x, z) ? "·" : "D";
      if (tile === TILE.STAIR) return "S";
      if (tile === TILE.EVENT) return "*";
      return "·";
    }).join("")).join("\n");
    mapOverlay.textContent = lines;
  }

  function buildSceneGeometry() {
    const g = createGeometryBuilder();
    const wallColor = [0.35, 0.36, 0.39];
    const wallDark = [0.25, 0.26, 0.29];
    const floorColor = [0.16, 0.15, 0.14];
    const ceilingColor = [0.10, 0.11, 0.13];
    const doorColor = [0.34, 0.24, 0.16];
    const stairColor = [0.42, 0.39, 0.30];
    const markColor = [0.43, 0.34, 0.14];

    for (let z = 0; z < map.length; z++) {
      for (let x = 0; x < map[z].length; x++) {
        const tile = map[z][x];
        const isOpenFloor = tile !== TILE.WALL && !(tile === TILE.DOOR && !isDoorOpen(x, z));
        if (isOpenFloor) {
          addQuad(g, [x, 0, z], [x + 1, 0, z], [x + 1, 0, z + 1], [x, 0, z + 1], [0, 1, 0], floorColor);
          addQuad(g, [x, 1.45, z + 1], [x + 1, 1.45, z + 1], [x + 1, 1.45, z], [x, 1.45, z], [0, -1, 0], ceilingColor);
        }
        if (tile === TILE.WALL) {
          addCube(g, x, 0, z, 1, 1.45, 1, wallColor, wallDark);
        }
        if (tile === TILE.DOOR && !isDoorOpen(x, z)) {
          addCube(g, x + 0.08, 0, z + 0.08, 0.84, 1.3, 0.84, doorColor, [0.24, 0.15, 0.10]);
        }
        if (tile === TILE.STAIR) {
          addLowPillar(g, x + 0.5, z + 0.5, stairColor);
        }
        if (tile === TILE.EVENT) {
          addFlatMarker(g, x + 0.5, z + 0.5, markColor);
        }
      }
    }

    return new Float32Array(g.data);
  }

  function createGeometryBuilder() {
    return { data: [] };
  }

  function pushVertex(g, pos, normal, color) {
    g.data.push(pos[0], pos[1], pos[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }

  function addTri(g, a, b, c, normal, color) {
    pushVertex(g, a, normal, color);
    pushVertex(g, b, normal, color);
    pushVertex(g, c, normal, color);
  }

  function addQuad(g, a, b, c, d, normal, color) {
    addTri(g, a, b, c, normal, color);
    addTri(g, a, c, d, normal, color);
  }

  function addCube(g, x, y, z, w, h, d, color, altColor) {
    const x0 = x, x1 = x + w;
    const y0 = y, y1 = y + h;
    const z0 = z, z1 = z + d;
    const cTop = [Math.min(color[0] + 0.05, 1), Math.min(color[1] + 0.05, 1), Math.min(color[2] + 0.05, 1)];
    addQuad(g, [x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [0,0,1], color);
    addQuad(g, [x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [0,0,-1], altColor);
    addQuad(g, [x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0], [-1,0,0], altColor);
    addQuad(g, [x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [1,0,0], color);
    addQuad(g, [x0,y1,z1], [x1,y1,z1], [x1,y1,z0], [x0,y1,z0], [0,1,0], cTop);
    addQuad(g, [x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1], [0,-1,0], altColor);
  }

  function addLowPillar(g, cx, cz, color) {
    addCube(g, cx - 0.24, 0.01, cz - 0.24, 0.48, 0.08, 0.48, color, [0.28,0.26,0.20]);
    addCube(g, cx - 0.18, 0.09, cz - 0.18, 0.36, 0.08, 0.36, color, [0.30,0.28,0.22]);
  }

  function addFlatMarker(g, cx, cz, color) {
    const y = 0.012;
    addQuad(g, [cx - 0.28, y, cz], [cx, y, cz - 0.28], [cx + 0.28, y, cz], [cx, y, cz + 0.28], [0,1,0], color);
  }

  function render(now) {
    animate(now);
    resizeCanvas();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;
    const projection = mat4Perspective(58 * Math.PI / 180, aspect, 0.05, 32);
    const cam = getCamera();
    const view = mat4LookAt(cam.eye, cam.target, [0, 1, 0]);

    gl.uniformMatrix4fv(uniforms.projection, false, projection);
    gl.uniformMatrix4fv(uniforms.view, false, view);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, scene, gl.STATIC_DRAW);

    const stride = 9 * 4;
    gl.enableVertexAttribArray(attribs.position);
    gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attribs.normal);
    gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(attribs.color);
    gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, stride, 6 * 4);

    gl.drawArrays(gl.TRIANGLES, 0, scene.length / 9);
    requestAnimationFrame(render);
  }

  function getCamera() {
    const angle = typeof visual.dir === "number" && visual.dir % 1 !== 0 ? visual.dir : dirToAngle(visual.dir);
    const eye = [visual.x + 0.5, 0.72, visual.z + 0.5];
    const forward = [Math.sin(angle), 0, -Math.cos(angle)];
    return {
      eye,
      target: [eye[0] + forward[0], eye[1] + 0.02, eye[2] + forward[2]],
    };
  }

  function dirToAngle(dir) {
    return dir * Math.PI / 2;
  }

  function angleToVirtualDir(angle) {
    return angle;
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "WebGL program link failed");
    }
    return p;
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "WebGL shader compile failed");
    }
    return shader;
  }

  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0,
    ]);
  }

  function mat4LookAt(eye, center, up) {
    const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
    ]);
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function bindButton(id, handler) {
    const el = document.getElementById(id);
    el.addEventListener("click", handler);
  }

  bindButton("forwardBtn", () => moveForward(1));
  bindButton("backBtn", () => moveForward(-1));
  bindButton("turnLeftBtn", () => turn(-1));
  bindButton("turnRightBtn", () => turn(1));
  bindButton("inspectBtn", inspectFront);
  bindButton("resetBtn", resetPosition);
  bindButton("mapBtn", toggleMap);
  bindButton("campBtn", () => setMessage("キャンプ画面は未実装です。ここではダンジョン基盤だけ確認します。", false));
  bindButton("formationBtn", () => setMessage("隊列画面は未実装です。パーティ枠表示だけ置いています。", false));

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") moveForward(1);
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") moveForward(-1);
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") turn(-1);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") turn(1);
    if (event.key === " " || event.key === "Enter") inspectFront();
  });

  setMessage(state.message, false);
  updateHud();
  requestAnimationFrame(render);
})();
