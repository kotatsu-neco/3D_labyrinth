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

  const SURFACE = {
    WALL: 1,
    FLOOR: 2,
    CEILING: 3,
    DOOR: 4,
    PROP: 5,
    MARK: 6,
  };

  // 通路幅。v02bの1.5から1.75へ拡張する。
  // 内部のグリッド座標はそのまま維持し、描画座標だけを拡大する。
  const CELL = 1.75;
  const ROOM_HEIGHT = 1.62;
  const CAMERA_HEIGHT = 0.80;

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

  const DUNGEON_OBJECTS = [
    // v05: 3Dダンジョン内の代表的な配置物を、UIに触れず最小テストする。
    { id: "chest01", type: "chest", x: 8, z: 10, blocking: true, mapChar: "C" },
    { id: "lever01", type: "lever", x: 9, z: 5, side: "E", blocking: false, mapChar: "L" },
    { id: "altar01", type: "altar", x: 4, z: 9, blocking: true, mapChar: "A" },
  ];

  const SIDE_TO_DIR = { N: 0, E: 1, S: 2, W: 3 };

  const state = {
    floor: "B1F",
    x: 1,
    z: 1,
    dir: 1,
    openedDoors: new Set(),
    openedChests: new Set(),
    activatedLevers: new Set(),
    showMap: false,
    animation: null,
    message: "v05: 開扉後の中央パーツ残りを修正し、階段・宝箱・レバー・祭壇をテスト配置しました。",
  };

  const visual = {
    x: state.x,
    z: state.z,
    dir: state.dir,
    stepBob: 0,
    turnLean: 0,
  };

  const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    attribute vec2 aUV;
    attribute float aSurface;

    uniform mat4 uProjection;
    uniform mat4 uView;

    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec2 vUV;
    varying float vSurface;
    varying float vDepth;

    void main() {
      vec4 viewPos = uView * vec4(aPosition, 1.0);
      gl_Position = uProjection * viewPos;
      vNormal = aNormal;
      vColor = aColor;
      vUV = aUV;
      vSurface = aSurface;
      vDepth = -viewPos.z;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    uniform sampler2D uWallTexture;
    uniform sampler2D uFloorTexture;
    uniform sampler2D uCeilingTexture;

    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec2 vUV;
    varying float vSurface;
    varying float vDepth;

    void main() {
      vec3 lightDir = normalize(vec3(0.18, 0.88, 0.42));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
      float shade = 0.34 + diffuse * 0.66;

      vec3 tex = vec3(1.0);
      if (vSurface < 1.5) {
        tex = texture2D(uWallTexture, vUV).rgb;
      } else if (vSurface < 2.5) {
        tex = texture2D(uFloorTexture, vUV).rgb;
      } else if (vSurface < 3.5) {
        tex = texture2D(uCeilingTexture, vUV).rgb;
      } else if (vSurface < 4.5) {
        // Dedicated procedural door pattern. Keep it brighter than walls.
        float board = floor(vUV.x * 5.0);
        float boardShade = 0.86 + mod(board, 2.0) * 0.10;
        float verticalLine = step(0.94, fract(vUV.x * 5.0));
        float bandCenter = abs(fract(vUV.y * 3.0) - 0.5);
        float metalBand = 1.0 - step(0.055, bandCenter);
        float edgeLine = max(max(step(vUV.x, 0.055), step(0.945, vUV.x)), max(step(vUV.y, 0.055), step(0.945, vUV.y)));
        vec3 wood = vec3(0.64, 0.42, 0.22) * boardShade;
        vec3 metal = vec3(0.19, 0.17, 0.15);
        tex = mix(wood, vec3(0.18, 0.13, 0.09), max(verticalLine, edgeLine));
        tex = mix(tex, metal, metalBand * 0.82);
      }

      // 近距離の壁面が潰れないよう、v01より霧を少し弱める。
      float fog = clamp((vDepth - 4.8) / 11.5, 0.0, 1.0);
      vec3 fogColor = vec3(0.030, 0.032, 0.038);
      vec3 color = mix(vColor * tex * shade, fogColor, fog);

      // 床・天井・壁の境界を少し締める。低解像度スマホでも面が読み取りやすい。
      if (abs(vNormal.y) < 0.25) {
        color *= 1.05;
      } else if (vNormal.y < -0.5) {
        color *= 0.76;
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(program);

  const attribs = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    color: gl.getAttribLocation(program, "aColor"),
    uv: gl.getAttribLocation(program, "aUV"),
    surface: gl.getAttribLocation(program, "aSurface"),
  };

  const uniforms = {
    projection: gl.getUniformLocation(program, "uProjection"),
    view: gl.getUniformLocation(program, "uView"),
    wallTexture: gl.getUniformLocation(program, "uWallTexture"),
    floorTexture: gl.getUniformLocation(program, "uFloorTexture"),
    ceilingTexture: gl.getUniformLocation(program, "uCeilingTexture"),
  };

  const textures = {
    wall: createTextureFromCanvas(makeWallTexture()),
    floor: createTextureFromCanvas(makeFloorTexture()),
    ceiling: createTextureFromCanvas(makeCeilingTexture()),
  };

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.035, 0.037, 0.044, 1.0);

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

  function objectKey(obj) {
    return `${obj.type}:${obj.id}`;
  }

  function objectAt(x, z) {
    return DUNGEON_OBJECTS.find((obj) => obj.x === x && obj.z === z) || null;
  }

  function leverOnCurrentWall(x, z, dir) {
    return DUNGEON_OBJECTS.find((obj) => obj.type === "lever" && obj.x === x && obj.z === z && SIDE_TO_DIR[obj.side] === dir) || null;
  }

  function isChestOpen(obj) {
    return state.openedChests.has(objectKey(obj));
  }

  function isLeverActive(obj) {
    return state.activatedLevers.has(objectKey(obj));
  }

  function isBlocked(x, z) {
    const tile = tileAt(x, z);
    if (tile === TILE.WALL) return true;
    if (tile === TILE.DOOR && !isDoorOpen(x, z)) return true;
    const obj = objectAt(x, z);
    if (obj && obj.blocking) return true;
    return false;
  }

  function moveForward(step) {
    if (state.animation) return;
    const d = DIRS[state.dir];
    const nx = state.x + d.x * step;
    const nz = state.z + d.z * step;
    if (isBlocked(nx, nz)) {
      startBumpAnimation(step);
      setMessage(step > 0 ? "壁・閉じた扉・配置物に阻まれています。" : "背後には進めません。", true);
      return;
    }
    startMoveAnimation(nx, nz, step);
  }

  function turn(delta) {
    if (state.animation) return;
    const ndir = (state.dir + delta + 4) % 4;
    startTurnAnimation(ndir, delta);
  }

  function inspectFront() {
    if (state.animation) return;

    const wallLever = leverOnCurrentWall(state.x, state.z, state.dir);
    if (wallLever) {
      const key = objectKey(wallLever);
      if (state.activatedLevers.has(key)) {
        state.activatedLevers.delete(key);
        scene = buildSceneGeometry();
        setMessage("壁のレバーを元の位置に戻しました。どこかで石の擦れる音がしました。", false);
      } else {
        state.activatedLevers.add(key);
        scene = buildSceneGeometry();
        setMessage("壁のレバーを下ろしました。奥で小さな機構音が響きました。", false);
      }
      return;
    }

    const d = DIRS[state.dir];
    const fx = state.x + d.x;
    const fz = state.z + d.z;
    const frontObject = objectAt(fx, fz);
    if (frontObject) {
      if (frontObject.type === "chest") {
        const key = objectKey(frontObject);
        if (state.openedChests.has(key)) {
          setMessage("開いた宝箱です。中は空です。", false);
        } else {
          state.openedChests.add(key);
          scene = buildSceneGeometry();
          setMessage("古い宝箱を開けました。内部に未鑑定の小片が残されています。", false);
        }
        return;
      }
      if (frontObject.type === "altar") {
        setMessage("低い石の祭壇です。表面に灰色の印章が刻まれています。", false);
        return;
      }
    }

    const tile = tileAt(fx, fz);

    if (tile === TILE.DOOR && !isDoorOpen(fx, fz)) {
      state.openedDoors.add(doorKey(fx, fz));
      scene = buildSceneGeometry();
      setMessage("重い石扉を押し開けました。通路の奥から冷たい空気が流れます。", false);
      return;
    }

    if (tile === TILE.WALL) {
      setMessage("石壁です。粗い石積みと目地が見えます。", false);
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
    visual.stepBob = 0;
    visual.turnLean = 0;
    setMessage("初期位置に戻りました。", false);
    updateHud();
  }

  function toggleMap() {
    state.showMap = !state.showMap;
    renderMapOverlay();
  }

  function startMoveAnimation(nx, nz, step) {
    state.animation = {
      type: "move",
      start: performance.now(),
      duration: 240,
      fromX: state.x,
      fromZ: state.z,
      toX: nx,
      toZ: nz,
      step,
    };
    state.x = nx;
    state.z = nz;
    const tile = tileAt(nx, nz);
    if (tile === TILE.STAIR) setMessage("階段の前に到達しました。", false);
    else if (tile === TILE.EVENT) setMessage("足元で古い石板がかすかに鳴りました。", false);
    else setMessage(step > 0 ? "一歩進みました。" : "一歩下がりました。", false);
    updateHud();
  }

  function startBumpAnimation(step) {
    const d = DIRS[state.dir];
    state.animation = {
      type: "bump",
      start: performance.now(),
      duration: 150,
      fromX: state.x,
      fromZ: state.z,
      hitX: state.x + d.x * 0.052 * step,
      hitZ: state.z + d.z * 0.052 * step,
    };
  }

  function startTurnAnimation(ndir, delta) {
    state.animation = {
      type: "turn",
      start: performance.now(),
      duration: 190,
      fromDir: state.dir,
      toDir: ndir,
      delta,
    };
    state.dir = ndir;
    setMessage(delta > 0 ? "右を向きました。" : "左を向きました。", false);
    updateHud();
  }

  function animate(now) {
    if (!state.animation) {
      visual.stepBob = 0;
      visual.turnLean = 0;
      return;
    }
    const a = state.animation;
    const t = Math.min(1, (now - a.start) / a.duration);

    if (a.type === "move") {
      const e = easeInOutCubic(t);
      const stepPulse = Math.sin(Math.PI * t);
      const settlePulse = t > 0.70 ? Math.sin((t - 0.70) / 0.30 * Math.PI) : 0;
      visual.x = lerp(a.fromX, a.toX, e);
      visual.z = lerp(a.fromZ, a.toZ, e);
      visual.dir = state.dir;
      visual.stepBob = stepPulse * 0.026 - settlePulse * 0.010;
      visual.turnLean = 0;
    } else if (a.type === "turn") {
      const e = easeInOutCubic(t);
      const fromAngle = dirToAngle(a.fromDir);
      const toAngle = fromAngle + a.delta * Math.PI / 2;
      visual.dir = angleToVirtualDir(lerp(fromAngle, toAngle, e));
      visual.x = state.x;
      visual.z = state.z;
      visual.stepBob = 0;
      visual.turnLean = Math.sin(Math.PI * t) * 0.010 * a.delta;
    } else if (a.type === "bump") {
      const e = Math.sin(Math.PI * t);
      visual.x = lerp(a.fromX, a.hitX, e);
      visual.z = lerp(a.fromZ, a.hitZ, e);
      visual.dir = state.dir;
      visual.stepBob = -Math.sin(Math.PI * t) * 0.012;
      visual.turnLean = 0;
    }

    if (t >= 1) {
      visual.x = state.x;
      visual.z = state.z;
      visual.dir = state.dir;
      visual.stepBob = 0;
      visual.turnLean = 0;
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
      const obj = objectAt(x, z);
      if (obj) return obj.mapChar;
      if (tile === TILE.WALL) return "█";
      if (tile === TILE.DOOR) return isDoorOpen(x, z) ? "O" : "D";
      if (tile === TILE.STAIR) return "S";
      if (tile === TILE.EVENT) return "*";
      return "·";
    }).join("")).join("\n");
    mapOverlay.textContent = lines;
  }

  function buildSceneGeometry() {
    const g = createGeometryBuilder();
    const wallColor = [0.74, 0.75, 0.76];
    const wallDark = [0.58, 0.59, 0.61];
    const floorColor = [0.75, 0.70, 0.62];
    const ceilingColor = [0.58, 0.60, 0.64];
    const doorColor = [0.55, 0.39, 0.24];
    const stairColor = [0.72, 0.68, 0.52];
    const markColor = [0.82, 0.65, 0.25];

    for (let z = 0; z < map.length; z++) {
      for (let x = 0; x < map[z].length; x++) {
        const tile = map[z][x];
        const wx = x * CELL;
        const wz = z * CELL;
        const isOpenFloor = tile !== TILE.WALL;

        if (isOpenFloor) {
          addQuad(g,
            [wx, 0, wz], [wx + CELL, 0, wz], [wx + CELL, 0, wz + CELL], [wx, 0, wz + CELL],
            [0, 1, 0], floorColor, SURFACE.FLOOR, CELL * 0.88, CELL * 0.88);
          addQuad(g,
            [wx, ROOM_HEIGHT, wz + CELL], [wx + CELL, ROOM_HEIGHT, wz + CELL], [wx + CELL, ROOM_HEIGHT, wz], [wx, ROOM_HEIGHT, wz],
            [0, -1, 0], ceilingColor, SURFACE.CEILING, CELL * 0.72, CELL * 0.72);
        }

        if (tile === TILE.WALL) {
          addCube(g, wx, 0, wz, CELL, ROOM_HEIGHT, CELL, wallColor, wallDark, SURFACE.WALL);
        }

        if (tile === TILE.DOOR) {
          addDoor(g, x, z, doorColor, wallColor, wallDark, isDoorOpen(x, z));
        }

        if (tile === TILE.STAIR) {
          addStaircase(g, x, z, stairColor, [0.44, 0.40, 0.30]);
        }

        if (tile === TILE.EVENT) {
          addFlatMarker(g, wx + CELL / 2, wz + CELL / 2, markColor);
        }
      }
    }

    for (const obj of DUNGEON_OBJECTS) {
      if (obj.type === "chest") addChest(g, obj.x, obj.z, isChestOpen(obj));
      if (obj.type === "lever") addWallLever(g, obj.x, obj.z, obj.side, isLeverActive(obj));
      if (obj.type === "altar") addStoneAltar(g, obj.x, obj.z);
    }

    return new Float32Array(g.data);
  }

  function createGeometryBuilder() {
    return { data: [] };
  }

  function pushVertex(g, pos, normal, color, uv, surface) {
    g.data.push(
      pos[0], pos[1], pos[2],
      normal[0], normal[1], normal[2],
      color[0], color[1], color[2],
      uv[0], uv[1],
      surface
    );
  }

  function addTri(g, a, b, c, normal, color, uvA, uvB, uvC, surface) {
    pushVertex(g, a, normal, color, uvA, surface);
    pushVertex(g, b, normal, color, uvB, surface);
    pushVertex(g, c, normal, color, uvC, surface);
  }

  function addQuad(g, a, b, c, d, normal, color, surface, uvU = 1, uvV = 1) {
    const uvA = [0, uvV];
    const uvB = [uvU, uvV];
    const uvC = [uvU, 0];
    const uvD = [0, 0];
    addTri(g, a, b, c, normal, color, uvA, uvB, uvC, surface);
    addTri(g, a, c, d, normal, color, uvA, uvC, uvD, surface);
  }

  function addCube(g, x, y, z, w, h, d, color, altColor, surface) {
    const x0 = x, x1 = x + w;
    const y0 = y, y1 = y + h;
    const z0 = z, z1 = z + d;
    const cTop = [Math.min(color[0] + 0.06, 1), Math.min(color[1] + 0.06, 1), Math.min(color[2] + 0.06, 1)];
    const uLong = Math.max(w, d) * 0.92;
    const vWall = h * 0.95;

    addQuad(g, [x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [0,0,1], color, surface, uLong, vWall);
    addQuad(g, [x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [0,0,-1], altColor, surface, uLong, vWall);
    addQuad(g, [x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0], [-1,0,0], altColor, surface, uLong, vWall);
    addQuad(g, [x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [1,0,0], color, surface, uLong, vWall);
    addQuad(g, [x0,y1,z1], [x1,y1,z1], [x1,y1,z0], [x0,y1,z0], [0,1,0], cTop, SURFACE.CEILING, w * 0.72, d * 0.72);
    addQuad(g, [x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1], [0,-1,0], altColor, SURFACE.FLOOR, w * 0.88, d * 0.88);
  }

  function addDoor(g, gridX, gridZ, doorColor, frameColor, frameDark, isOpen) {
    const wx = gridX * CELL;
    const wz = gridZ * CELL;

    // v05: 扉のズレ感を減らすため、扉板・左右枠・上枠をセル中心から対称に配置する。
    // 開いた後も「扉が消える」状態にせず、枠と開放済み扉板を残す。
    const centerX = wx + CELL / 2;
    const centerZ = wz + CELL / 2;
    const frameThickness = CELL * 0.105;
    const panelThickness = CELL * 0.058;
    const frameInset = CELL * 0.105;
    const panelHeight = ROOM_HEIGHT * 0.82;
    const frameHeight = ROOM_HEIGHT * 0.90;
    const y = 0.025;
    const darkDoor = [0.34, 0.22, 0.13];

    const northOpen = tileAt(gridX, gridZ - 1) !== TILE.WALL;
    const southOpen = tileAt(gridX, gridZ + 1) !== TILE.WALL;
    const eastOpen = tileAt(gridX + 1, gridZ) !== TILE.WALL;
    const westOpen = tileAt(gridX - 1, gridZ) !== TILE.WALL;
    const northSouthDoor = (northOpen || southOpen) && !(eastOpen || westOpen);

    if (northSouthDoor) {
      const openingX0 = wx + frameInset;
      const openingX1 = wx + CELL - frameInset;
      const openingWidth = openingX1 - openingX0;
      const halfLeaf = openingWidth / 2 - panelThickness * 0.50;
      const zClosed = centerZ - panelThickness / 2;

      // Symmetric stone frame.
      addCube(g, openingX0 - frameThickness, 0, zClosed - panelThickness * 0.55, frameThickness, frameHeight, panelThickness * 2.10, frameColor, frameDark, SURFACE.WALL);
      addCube(g, openingX1, 0, zClosed - panelThickness * 0.55, frameThickness, frameHeight, panelThickness * 2.10, frameColor, frameDark, SURFACE.WALL);
      addCube(g, openingX0 - frameThickness, panelHeight, zClosed - panelThickness * 0.55, openingWidth + frameThickness * 2, ROOM_HEIGHT - panelHeight, panelThickness * 2.10, frameColor, frameDark, SURFACE.WALL);

      if (!isOpen) {
        addCube(g, openingX0, y, zClosed, openingWidth, panelHeight, panelThickness, doorColor, darkDoor, SURFACE.DOOR);
        return;
      }

      // Opened leaves: keep the door visible by folding both panels to the side of the passage.
      const leafDepth = Math.max(halfLeaf, CELL * 0.28);
      addCube(g, openingX0, y, centerZ - leafDepth, panelThickness, panelHeight, leafDepth, doorColor, darkDoor, SURFACE.DOOR);
      addCube(g, openingX1 - panelThickness, y, centerZ, panelThickness, panelHeight, leafDepth, doorColor, darkDoor, SURFACE.DOOR);
      // v05: 開扉後に中央へ閂のような横長パーツが残らないよう、中央金具は描画しない。
    } else {
      const openingZ0 = wz + frameInset;
      const openingZ1 = wz + CELL - frameInset;
      const openingWidth = openingZ1 - openingZ0;
      const halfLeaf = openingWidth / 2 - panelThickness * 0.50;
      const xClosed = centerX - panelThickness / 2;

      // Symmetric stone frame.
      addCube(g, xClosed - panelThickness * 0.55, 0, openingZ0 - frameThickness, panelThickness * 2.10, frameHeight, frameThickness, frameColor, frameDark, SURFACE.WALL);
      addCube(g, xClosed - panelThickness * 0.55, 0, openingZ1, panelThickness * 2.10, frameHeight, frameThickness, frameColor, frameDark, SURFACE.WALL);
      addCube(g, xClosed - panelThickness * 0.55, panelHeight, openingZ0 - frameThickness, panelThickness * 2.10, ROOM_HEIGHT - panelHeight, openingWidth + frameThickness * 2, frameColor, frameDark, SURFACE.WALL);

      if (!isOpen) {
        addCube(g, xClosed, y, openingZ0, panelThickness, panelHeight, openingWidth, doorColor, darkDoor, SURFACE.DOOR);
        return;
      }

      // Opened leaves: keep the door visible by folding both panels to the side of the passage.
      const leafDepth = Math.max(halfLeaf, CELL * 0.28);
      addCube(g, centerX - leafDepth, y, openingZ0, leafDepth, panelHeight, panelThickness, doorColor, darkDoor, SURFACE.DOOR);
      addCube(g, centerX, y, openingZ1 - panelThickness, leafDepth, panelHeight, panelThickness, doorColor, darkDoor, SURFACE.DOOR);
      // v05: 開扉後に中央へ閂のような横長パーツが残らないよう、中央金具は描画しない。
    }
  }

  function addStaircase(g, gridX, gridZ, color, darkColor) {
    const wx = gridX * CELL;
    const wz = gridZ * CELL;
    const cx = wx + CELL / 2;
    const cz = wz + CELL / 2;
    const westOpen = tileAt(gridX - 1, gridZ) !== TILE.WALL;
    const eastOpen = tileAt(gridX + 1, gridZ) !== TILE.WALL;
    const horizontal = westOpen || eastOpen;
    const stepCount = 5;
    const total = CELL * 0.76;
    const stepDepth = total / stepCount;
    const stepWidth = CELL * 0.62;
    const baseY = 0.020;

    // Dark opening below the steps, so it reads as a stair rather than a low pedestal.
    addCube(g, cx - CELL * 0.34, baseY, cz - CELL * 0.34, CELL * 0.68, 0.028, CELL * 0.68, [0.08, 0.075, 0.065], [0.04, 0.04, 0.04], SURFACE.PROP);

    for (let i = 0; i < stepCount; i++) {
      const h = 0.045 + i * 0.032;
      if (horizontal) {
        const x = cx - total / 2 + i * stepDepth;
        addCube(g, x, baseY, cz - stepWidth / 2, stepDepth * 0.92, h, stepWidth, color, darkColor, SURFACE.PROP);
      } else {
        const z = cz - total / 2 + i * stepDepth;
        addCube(g, cx - stepWidth / 2, baseY, z, stepWidth, h, stepDepth * 0.92, color, darkColor, SURFACE.PROP);
      }
    }

    if (horizontal) {
      addCube(g, cx - total / 2, 0.020, cz - stepWidth / 2 - CELL * 0.055, total, 0.070, CELL * 0.055, darkColor, [0.30, 0.28, 0.22], SURFACE.PROP);
      addCube(g, cx - total / 2, 0.020, cz + stepWidth / 2, total, 0.070, CELL * 0.055, darkColor, [0.30, 0.28, 0.22], SURFACE.PROP);
    } else {
      addCube(g, cx - stepWidth / 2 - CELL * 0.055, 0.020, cz - total / 2, CELL * 0.055, 0.070, total, darkColor, [0.30, 0.28, 0.22], SURFACE.PROP);
      addCube(g, cx + stepWidth / 2, 0.020, cz - total / 2, CELL * 0.055, 0.070, total, darkColor, [0.30, 0.28, 0.22], SURFACE.PROP);
    }
  }

  function addChest(g, gridX, gridZ, isOpen) {
    const cx = gridX * CELL + CELL / 2;
    const cz = gridZ * CELL + CELL / 2;
    const w = CELL * 0.52;
    const d = CELL * 0.40;
    const y = 0.040;
    const baseH = ROOM_HEIGHT * 0.17;
    const lidH = ROOM_HEIGHT * 0.070;
    const wood = [0.52, 0.31, 0.16];
    const darkWood = [0.27, 0.15, 0.08];
    const metal = [0.14, 0.13, 0.11];
    addCube(g, cx - w / 2, y, cz - d / 2, w, baseH, d, wood, darkWood, SURFACE.DOOR);
    addCube(g, cx - w * 0.54, y + baseH * 0.42, cz - d / 2 - CELL * 0.010, w * 1.08, CELL * 0.035, CELL * 0.032, metal, [0.08, 0.075, 0.065], SURFACE.PROP);
    addCube(g, cx - CELL * 0.035, y + baseH * 0.15, cz - d / 2 - CELL * 0.018, CELL * 0.070, baseH * 0.45, CELL * 0.036, metal, [0.08, 0.075, 0.065], SURFACE.PROP);

    if (isOpen) {
      addCube(g, cx - w / 2, y + baseH, cz + d / 2 - CELL * 0.040, w, lidH * 2.4, CELL * 0.060, wood, darkWood, SURFACE.DOOR);
      addCube(g, cx - w * 0.28, y + baseH + CELL * 0.020, cz - d * 0.22, w * 0.56, CELL * 0.025, d * 0.44, [0.18, 0.14, 0.09], [0.10, 0.08, 0.05], SURFACE.PROP);
    } else {
      addCube(g, cx - w / 2, y + baseH, cz - d / 2, w, lidH, d, wood, darkWood, SURFACE.DOOR);
      addCube(g, cx - CELL * 0.026, y + baseH + lidH * 0.20, cz - d / 2 - CELL * 0.022, CELL * 0.052, lidH * 0.85, CELL * 0.040, metal, [0.08, 0.075, 0.065], SURFACE.PROP);
    }
  }

  function addWallLever(g, gridX, gridZ, side, active) {
    const wx = gridX * CELL;
    const wz = gridZ * CELL;
    const cx = wx + CELL / 2;
    const cz = wz + CELL / 2;
    const plate = [0.26, 0.25, 0.23];
    const metal = active ? [0.48, 0.34, 0.15] : [0.20, 0.18, 0.16];
    const y = ROOM_HEIGHT * 0.50;
    const plateW = CELL * 0.22;
    const plateH = ROOM_HEIGHT * 0.22;
    const t = CELL * 0.030;
    const rod = CELL * 0.18;

    if (side === "E") {
      const x = wx + CELL - t;
      addCube(g, x, y, cz - plateW / 2, t, plateH, plateW, plate, [0.14,0.13,0.12], SURFACE.PROP);
      addCube(g, x - rod, y + (active ? -plateH * 0.10 : plateH * 0.18), cz - CELL * 0.025, rod, CELL * 0.040, CELL * 0.050, metal, [0.10,0.09,0.08], SURFACE.PROP);
      addCube(g, x - rod - CELL * 0.030, y + (active ? -plateH * 0.12 : plateH * 0.16), cz - CELL * 0.045, CELL * 0.060, CELL * 0.060, CELL * 0.090, metal, [0.10,0.09,0.08], SURFACE.PROP);
    } else if (side === "W") {
      const x = wx;
      addCube(g, x, y, cz - plateW / 2, t, plateH, plateW, plate, [0.14,0.13,0.12], SURFACE.PROP);
      addCube(g, x + t, y + (active ? -plateH * 0.10 : plateH * 0.18), cz - CELL * 0.025, rod, CELL * 0.040, CELL * 0.050, metal, [0.10,0.09,0.08], SURFACE.PROP);
      addCube(g, x + t + rod - CELL * 0.030, y + (active ? -plateH * 0.12 : plateH * 0.16), cz - CELL * 0.045, CELL * 0.060, CELL * 0.060, CELL * 0.090, metal, [0.10,0.09,0.08], SURFACE.PROP);
    } else if (side === "S") {
      const z = wz + CELL - t;
      addCube(g, cx - plateW / 2, y, z, plateW, plateH, t, plate, [0.14,0.13,0.12], SURFACE.PROP);
      addCube(g, cx - CELL * 0.025, y + (active ? -plateH * 0.10 : plateH * 0.18), z - rod, CELL * 0.050, CELL * 0.040, rod, metal, [0.10,0.09,0.08], SURFACE.PROP);
      addCube(g, cx - CELL * 0.045, y + (active ? -plateH * 0.12 : plateH * 0.16), z - rod - CELL * 0.030, CELL * 0.090, CELL * 0.060, CELL * 0.060, metal, [0.10,0.09,0.08], SURFACE.PROP);
    } else {
      const z = wz;
      addCube(g, cx - plateW / 2, y, z, plateW, plateH, t, plate, [0.14,0.13,0.12], SURFACE.PROP);
      addCube(g, cx - CELL * 0.025, y + (active ? -plateH * 0.10 : plateH * 0.18), z + t, CELL * 0.050, CELL * 0.040, rod, metal, [0.10,0.09,0.08], SURFACE.PROP);
      addCube(g, cx - CELL * 0.045, y + (active ? -plateH * 0.12 : plateH * 0.16), z + t + rod - CELL * 0.030, CELL * 0.090, CELL * 0.060, CELL * 0.060, metal, [0.10,0.09,0.08], SURFACE.PROP);
    }
  }

  function addStoneAltar(g, gridX, gridZ) {
    const cx = gridX * CELL + CELL / 2;
    const cz = gridZ * CELL + CELL / 2;
    const stone = [0.52, 0.53, 0.55];
    const dark = [0.36, 0.37, 0.39];
    const accent = [0.72, 0.56, 0.25];
    addCube(g, cx - CELL * 0.34, 0.020, cz - CELL * 0.25, CELL * 0.68, ROOM_HEIGHT * 0.16, CELL * 0.50, stone, dark, SURFACE.WALL);
    addCube(g, cx - CELL * 0.42, ROOM_HEIGHT * 0.18, cz - CELL * 0.30, CELL * 0.84, ROOM_HEIGHT * 0.07, CELL * 0.60, [0.58,0.59,0.61], dark, SURFACE.WALL);
    addCube(g, cx - CELL * 0.10, ROOM_HEIGHT * 0.25, cz - CELL * 0.08, CELL * 0.20, ROOM_HEIGHT * 0.13, CELL * 0.16, [0.40,0.41,0.43], dark, SURFACE.WALL);
    addCube(g, cx - CELL * 0.045, ROOM_HEIGHT * 0.39, cz - CELL * 0.035, CELL * 0.09, ROOM_HEIGHT * 0.035, CELL * 0.07, accent, [0.42,0.32,0.12], SURFACE.PROP);
  }

  function addLowPillar(g, cx, cz, color) {
    addCube(g, cx - CELL * 0.24, 0.015, cz - CELL * 0.24, CELL * 0.48, 0.08, CELL * 0.48, color, [0.48,0.44,0.32], SURFACE.PROP);
    addCube(g, cx - CELL * 0.18, 0.095, cz - CELL * 0.18, CELL * 0.36, 0.08, CELL * 0.36, color, [0.52,0.48,0.36], SURFACE.PROP);
  }

  function addFlatMarker(g, cx, cz, color) {
    const y = 0.018;
    const r = CELL * 0.28;
    addQuad(g, [cx - r, y, cz], [cx, y, cz - r], [cx + r, y, cz], [cx, y, cz + r], [0,1,0], color, SURFACE.MARK, 1, 1);
  }

  function render(now) {
    animate(now);
    resizeCanvas();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    bindTextures();

    const aspect = canvas.width / canvas.height;
    const projection = mat4Perspective(64 * Math.PI / 180, aspect, 0.05, 48);
    const cam = getCamera();
    const view = mat4LookAt(cam.eye, cam.target, [0, 1, 0]);

    gl.uniformMatrix4fv(uniforms.projection, false, projection);
    gl.uniformMatrix4fv(uniforms.view, false, view);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, scene, gl.STATIC_DRAW);

    const stride = 12 * 4;
    gl.enableVertexAttribArray(attribs.position);
    gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attribs.normal);
    gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(attribs.color);
    gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(attribs.uv);
    gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, stride, 9 * 4);
    gl.enableVertexAttribArray(attribs.surface);
    gl.vertexAttribPointer(attribs.surface, 1, gl.FLOAT, false, stride, 11 * 4);

    gl.drawArrays(gl.TRIANGLES, 0, scene.length / 12);
    requestAnimationFrame(render);
  }

  function getCamera() {
    const angle = typeof visual.dir === "number" && visual.dir % 1 !== 0 ? visual.dir : dirToAngle(visual.dir);
    const centerX = visual.x * CELL + CELL / 2;
    const centerZ = visual.z * CELL + CELL / 2;
    const eye = [centerX, CAMERA_HEIGHT + visual.stepBob, centerZ];
    const forward = [Math.sin(angle), 0, -Math.cos(angle)];
    const lean = [Math.cos(angle), 0, Math.sin(angle)];
    const leanOffset = visual.turnLean * CELL;
    return {
      eye: [eye[0] + lean[0] * leanOffset, eye[1], eye[2] + lean[2] * leanOffset],
      target: [
        eye[0] + lean[0] * leanOffset + forward[0] * CELL,
        eye[1] + 0.018,
        eye[2] + lean[2] * leanOffset + forward[2] * CELL,
      ],
    };
  }

  function bindTextures() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures.wall);
    gl.uniform1i(uniforms.wallTexture, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures.floor);
    gl.uniform1i(uniforms.floorTexture, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures.ceiling);
    gl.uniform1i(uniforms.ceilingTexture, 2);
  }

  function createTextureFromCanvas(sourceCanvas) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }

  function makeWallTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#8a8c8d";
    ctx.fillRect(0, 0, c.width, c.height);

    // 石積み。奇数段は半ブロックずらして、壁面らしい反復を出す。
    for (let row = 0; row < 4; row++) {
      const y = row * 32;
      const offset = row % 2 ? -24 : 0;
      for (let col = -1; col < 4; col++) {
        const x = col * 48 + offset;
        const shade = 126 + ((row * 29 + col * 17) % 24);
        ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 3})`;
        ctx.fillRect(x + 2, y + 2, 44, 28);
        ctx.fillStyle = "rgba(255,255,255,.06)";
        ctx.fillRect(x + 4, y + 4, 38, 3);
        ctx.fillStyle = "rgba(0,0,0,.16)";
        ctx.fillRect(x + 4, y + 25, 38, 3);
      }
      ctx.fillStyle = "rgba(25,25,27,.62)";
      ctx.fillRect(0, y, 128, 2);
      ctx.fillRect(0, y + 30, 128, 2);
    }

    ctx.strokeStyle = "rgba(20,20,22,.42)";
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      const y = row * 32;
      const offset = row % 2 ? 24 : 0;
      for (let x = offset; x < 128; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x, y + 30);
        ctx.stroke();
      }
    }

    // 小さな傷・鉱脈。規則的になりすぎない程度に固定値で入れる。
    const cracks = [[18,18,32,25],[80,11,91,20],[56,48,69,43],[105,72,115,85],[28,94,42,102],[72,112,85,118]];
    ctx.strokeStyle = "rgba(42,43,46,.58)";
    ctx.lineWidth = 1;
    for (const [x1,y1,x2,y2] of cracks) {
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo((x1+x2)/2,y1 + 6);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    }
    return c;
  }

  function makeFloorTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#514b42";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(0,0,0,.34)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.045)";
    ctx.fillRect(3, 4, 42, 5);
    ctx.fillRect(63, 70, 34, 4);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(34, 27, 48, 4);
    ctx.fillRect(92, 104, 28, 5);
    return c;
  }

  function makeCeilingTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#5b5f66";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fillRect(6, 8, 76, 5);
    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.fillRect(44, 90, 70, 5);
    return c;
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

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function bindButton(id, handler) {
    const el = document.getElementById(id);
    let lastFire = 0;

    const fire = (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const now = performance.now();
      if (now - lastFire < 90) return;
      lastFire = now;
      el.blur();
      handler();
    };

    if (window.PointerEvent) {
      el.addEventListener("pointerdown", fire, { passive: false });
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    } else {
      el.addEventListener("touchstart", fire, { passive: false });
      el.addEventListener("mousedown", fire);
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") fire(event);
    });
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
    const key = event.key;
    const lower = key.length === 1 ? key.toLowerCase() : key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(key)) event.preventDefault();
    if (key === "ArrowUp" || lower === "w") moveForward(1);
    if (key === "ArrowDown" || lower === "s") moveForward(-1);
    if (key === "ArrowLeft" || lower === "a") turn(-1);
    if (key === "ArrowRight" || lower === "d") turn(1);
    if (key === " " || key === "Enter") inspectFront();
  });

  setMessage(state.message, false);
  updateHud();
  requestAnimationFrame(render);
})();
