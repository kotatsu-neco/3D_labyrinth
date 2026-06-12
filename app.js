(() => {
  "use strict";

  const canvas = document.getElementById("dungeonCanvas");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  const statusToast = document.getElementById("statusToast");
  const partyCardGrid = document.getElementById("explorePartyCards");
  const positionText = document.getElementById("positionText");
  let statusToastTimer = 0;

  if (!gl) {
    if (statusToast) {
      statusToast.textContent = "このブラウザではWebGLを初期化できませんでした。";
      statusToast.hidden = false;
    }
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

  // v22a: 低解像度敵画像を使った敵遭遇ウィンドウの試作。
  // v23では敵HP生成と前衛攻撃によるHP減少だけを接続した。
  // v23aでは実機確認結果を受け、戦闘ログ枠追加、コマンド/パーティ位置入れ替え、パーティ表の重なり対策を行う。
  // v23bではログ枠にトースト風のタイプライター表示を追加する。
  // v23cでは実機確認結果を受け、戦闘UIとステータス画面を圧縮・再配置する。
  // v23dでは戦闘画面の上部大見出しを排除し、戦闘ウィンドウ内レイアウトを再整理する。
  // v23gでは実機確認結果を受け、下部2列操作パッド、閉じられる浮動LOG、ステータス詳細2カラムを導入する。
  // v23hでは正式候補タイトル「暗澹の石櫃」を反映し、LOG小窓を実機スクリーンショットに合わせて少し縮小する。
  // v24では次段階として敵の反撃、プレイヤーHP減少、暫定逃走判定を接続する。
  // v25では勝利時の経験値・GOLD報酬を接続する。
  // v27では戦闘中の呪文・回復道具に対象選択を追加する。
  // v28ではキャンプ内アイテム操作として、戦闘外HEALING HERB使用・受け渡し・破棄を接続する。
  // v29ではアイテム個体ごとの装備状態、装備/外す、装備による攻撃ダイスと有効ACを接続する。
  // v29aでは装備入口から所持品画面へ進んだ場合の戻り先保持を修正する。
  // ENCOUNTER_DEMOS は実機確認用の一時的なUIデモデータであり、正本の遭遇テーブルではない。
  // データファイル data/encounters_v23.json / data/enemy_definitions_v23.json は参照用として同梱しているが、
  // v28時点の画面表示は外部JSON読み込みではなく、このローカル定数を使う。
  const START_POS = { x: 9, z: 10, dir: 3 };

  const BUILD_VERSION = "v29a";
  const PROTOTYPE_TITLE = "暗澹の石櫃";
  const PROTOTYPE_SUBTITLE = "Stone Casket of Gloom";
  const FLOOR_META = {
    B1F: {
      layer: "浅層",
      zone: "外縁部",
      role: "搬入口・倉庫・飼育区に近い確認階層",
    },
  };

  const ENCOUNTER_DEMO_DATA_SOURCE = "data/encounters_v23.json";
  const ENEMY_DEFINITION_DATA_SOURCE = "data/enemy_definitions_v23.json";

  // v23b: 戦闘ログの文字送り速度。0にすると即時表示。
  const BATTLE_LOG_TYPE_SPEED_MS = 18;
  const BATTLE_LOG_HISTORY_LIMIT = 1;
  const BATTLE_LOG_NEXT_DELAY_MS = 180;
  const BATTLE_ESCAPE_BASE_CHANCE = 0.58;
  const RANDOM_ENCOUNTER_MIN_STEPS = 4;
  const RANDOM_ENCOUNTER_STEP_CHANCE = 0.16;
  const LEVEL_XP_THRESHOLDS = [0, 60, 160, 320, 560, 900];
  const BATTLE_PARTY_ACTION_MARKS = { current: "▶", queued: "✓", waiting: "-", unable: "×" };
  let battleLogTimer = 0;

  const TREASURE_TABLES = {
    shallow_battle_basic: [
      { item: "HEALING HERB", chance: 38 },
      { item: "SMALL KNIFE", chance: 18 },
      { item: "TORN SCROLL", chance: 14 },
      { item: "COPPER RING", chance: 10 }
    ],
    shallow_chest_basic: [
      { item: "HEALING HERB", chance: 100 },
      { item: "IRON KEY", chance: 55 },
      { item: "OLD COIN", chance: 70 },
      { item: "UNIDENTIFIED SCROLL", chance: 38 }
    ]
  };

  const ITEM_DEFINITIONS = {
    "LONG SWORD": { slot: "weapon", slotLabel: "WEAPON", damageDice: "1d8", hitBonus: 1 },
    "SHORT SWORD": { slot: "weapon", slotLabel: "WEAPON", damageDice: "1d6", hitBonus: 0 },
    "SMALL KNIFE": { slot: "weapon", slotLabel: "WEAPON", damageDice: "1d4", hitBonus: 0 },
    "MACE": { slot: "weapon", slotLabel: "WEAPON", damageDice: "1d6", hitBonus: 0 },
    "STAFF": { slot: "weapon", slotLabel: "WEAPON", damageDice: "1d4", hitBonus: 0 },
    "DAGGER": { slot: "weapon", slotLabel: "WEAPON", damageDice: "1d4", hitBonus: 0 },
    "LEATHER ARMOR": { slot: "armor", slotLabel: "ARMOR", acBonus: -2 },
    "CHAIN MAIL": { slot: "armor", slotLabel: "ARMOR", acBonus: -4 },
    "ROBES": { slot: "armor", slotLabel: "ARMOR", acBonus: -1 },
    "SMALL SHIELD": { slot: "shield", slotLabel: "SHIELD", acBonus: -1 },
    "HELM": { slot: "head", slotLabel: "HEAD", acBonus: -1 },
  };

  const EQUIPMENT_SLOTS = [
    { key: "weapon", label: "WEAPON" },
    { key: "armor", label: "ARMOR" },
    { key: "shield", label: "SHIELD" },
    { key: "head", label: "HEAD" },
  ];

  let nextItemInstanceSeq = 1;

  const ENEMY_DEFINITIONS = {
    enemy_black_slime_proto: {
      id: "enemy_black_slime_proto", displayName: "仮分類: 粘性体", layerBand: "shallow", family: "slime", rank: 1, level: 1, hp: { dice: "1d6", fixed: 0 }, ac: 8, xp: 10, assetId: "black_slime",
      attacks: [{ id: "touch", targetRule: "front_single", hitBonus: 0, damageDice: "1d4", damageBonus: 0, element: "physical", statusEffect: null, chance: 100, messageKey: "enemy_attack_default" }]
    },
    enemy_black_wing_bug_proto: {
      id: "enemy_black_wing_bug_proto", displayName: "仮分類: 虫型", layerBand: "shallow", family: "insect", rank: 1, level: 1, hp: { dice: "1d4", fixed: 0 }, ac: 7, xp: 8, assetId: "black_wing_bug",
      attacks: [{ id: "bite", targetRule: "front_single", hitBonus: 0, damageDice: "1d3", damageBonus: 0, element: "physical", statusEffect: null, chance: 100, messageKey: "enemy_attack_default" }]
    },
    enemy_goblin_raider_proto: {
      id: "enemy_goblin_raider_proto", displayName: "仮分類: 小型亜人", layerBand: "shallow", family: "goblin", rank: 1, level: 1, hp: { dice: "1d8", fixed: 0 }, ac: 6, xp: 18, assetId: "goblin_raider",
      attacks: [{ id: "weapon", targetRule: "front_single", hitBonus: 0, damageDice: "1d6", damageBonus: 0, element: "physical", statusEffect: null, chance: 100, messageKey: "enemy_attack_default" }]
    },
    enemy_bone_servant_proto: {
      id: "enemy_bone_servant_proto", displayName: "仮分類: 骨の従者", layerBand: "shallow", family: "undead", rank: 2, level: 1, hp: { dice: "1d8", fixed: 2 }, ac: 7, xp: 22, assetId: "bone_servant",
      attacks: [{ id: "claw", targetRule: "front_single", hitBonus: 0, damageDice: "1d5", damageBonus: 0, element: "physical", statusEffect: null, chance: 100, messageKey: "enemy_attack_default" }]
    }
  };

  const ENCOUNTER_DEMOS = [
    {
      id: "encounter_b1_shallow_test_01",
      floor: "B1F",
      layer: "浅層",
      title: "ENCOUNTER",
      prompt: "敵が現れた。",
      note: "確認用。敵HP、反撃、EXP/GOLD、暫定戦利品を接続。",
      gold: { min: 8, max: 18 },
      treasureTableId: "shallow_battle_basic",
      dropChance: 45,
      enemies: [
        { enemyId: "enemy_black_slime_proto", label: "粘性体", count: 1, assetId: "black_slime", image: "assets/enemies/lowres/enemy_black_slime.png" },
        { enemyId: "enemy_black_wing_bug_proto", label: "虫型", count: 2, assetId: "black_wing_bug", image: "assets/enemies/lowres/enemy_black_wing_bug.png" }
      ]
    },
    {
      id: "encounter_b1_shallow_test_02",
      floor: "B1F",
      layer: "浅層",
      title: "ENCOUNTER",
      prompt: "敵が現れた。",
      note: "確認用。敵名は仮分類であり正本化しない。EXP/GOLDと暫定戦利品を接続。",
      gold: { min: 12, max: 28 },
      treasureTableId: "shallow_battle_basic",
      dropChance: 55,
      enemies: [
        { enemyId: "enemy_goblin_raider_proto", label: "小型亜人", count: 3, assetId: "goblin_raider", image: "assets/enemies/lowres/enemy_goblin_raider.png" }
      ]
    },
    {
      id: "encounter_b1_shallow_test_03",
      floor: "B1F",
      layer: "浅層",
      title: "ENCOUNTER",
      prompt: "敵が現れた。",
      note: "確認用。戦闘画面の密度、HP表示、敵反撃、EXP/GOLD、暫定戦利品を見るための仮遭遇。",
      gold: { min: 10, max: 24 },
      treasureTableId: "shallow_battle_basic",
      dropChance: 50,
      enemies: [
        { enemyId: "enemy_bone_servant_proto", label: "骨の従者", count: 1, assetId: "bone_servant", image: "assets/enemies/lowres/enemy_bone_servant.png" },
        { enemyId: "enemy_black_slime_proto", label: "粘性体", count: 1, assetId: "black_slime", image: "assets/enemies/lowres/enemy_black_slime.png" }
      ]
    }
  ];

  const map = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,0,1],
    [1,0,1,0,0,0,0,0,1,0,1,1],
    [1,0,1,1,1,2,1,0,1,0,0,1],
    [1,0,0,0,1,0,1,0,0,0,1,1],
    [1,1,1,0,1,0,1,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,1,1,0,1],
    [1,0,1,1,1,1,1,0,3,0,0,1],
    [1,0,0,0,4,0,1,0,1,1,0,1],
    [1,1,1,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  const DUNGEON_OBJECTS = [
    // 配置物は通路中央を塞がず、壁寄せ・床面模様・確認用の大型表示として扱う。
    { id: "chest01", type: "chest", x: 8, z: 10, side: "S", blocking: false, mapChar: "C", treasureTableId: "shallow_chest_basic" },
    { id: "lever01", type: "lever", x: 9, z: 5, side: "E", blocking: false, mapChar: "L", targetDoor: { x: 5, z: 4 } },
    { id: "altar01", type: "altar", x: 4, z: 9, side: "N", blocking: false, mapChar: "A" },
    { id: "statue01", type: "statue", x: 5, z: 10, side: "S", blocking: false, mapChar: "P" },
    { id: "magicCircle01", type: "magicCircle", x: 6, z: 10, side: "FLOOR", blocking: false, mapChar: "M" },
    { id: "trapFloor01", type: "trapFloor", x: 7, z: 10, side: "FLOOR", blocking: false, mapChar: "T" },
  ];

  const SIDE_TO_DIR = { N: 0, E: 1, S: 2, W: 3 };

  const PARTY_MEMBERS = [
    {
      id: "adel", name: "アデル", className: "FIG", level: 1, age: 18, alignment: "GOOD", race: "HUM",
      hp: 34, maxHp: 34, ac: 4, status: "OK", row: "front", gold: 128, xp: 0,
      stats: { str: 12, iq: 8, pie: 7, vit: 11, agi: 9, luc: 8 },
      spells: { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] },
      items: ["LONG SWORD", "LEATHER ARMOR", "SMALL SHIELD"],
    },
    {
      id: "mira", name: "ミラ", className: "THI", level: 1, age: 19, alignment: "NEUT", race: "HOB",
      hp: 28, maxHp: 28, ac: 2, status: "OK", row: "front", gold: 96, xp: 0,
      stats: { str: 9, iq: 10, pie: 6, vit: 9, agi: 14, luc: 12 },
      spells: { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] },
      items: ["SHORT SWORD", "LEATHER ARMOR", "THIEVES TOOLS"],
    },
    {
      id: "gald", name: "ガルド", className: "FIG", level: 1, age: 34, alignment: "GOOD", race: "DWF",
      hp: 41, maxHp: 41, ac: 3, status: "OK", row: "front", gold: 104, xp: 0,
      stats: { str: 13, iq: 7, pie: 9, vit: 13, agi: 7, luc: 6 },
      spells: { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] },
      items: ["MACE", "CHAIN MAIL", "HELM"],
    },
    {
      id: "serin", name: "セリン", className: "PRI", level: 1, age: 28, alignment: "GOOD", race: "GNM",
      hp: 18, maxHp: 18, ac: 6, status: "OK", row: "back", gold: 83, xp: 0,
      stats: { str: 8, iq: 9, pie: 13, vit: 10, agi: 8, luc: 9 },
      spells: { mage: [0,0,0,0,0,0,0], priest: [2,0,0,0,0,0,0] },
      items: ["STAFF", "ROBES", "HOLY SYMBOL"],
    },
    {
      id: "row", name: "ロウ", className: "MAG", level: 1, age: 24, alignment: "NEUT", race: "ELF",
      hp: 12, maxHp: 12, ac: 9, status: "OK", row: "back", gold: 74, xp: 0,
      stats: { str: 6, iq: 14, pie: 8, vit: 7, agi: 10, luc: 9 },
      spells: { mage: [2,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] },
      items: ["DAGGER", "ROBES", "SPELL BOOK"],
    },
    {
      id: "nene", name: "ネネ", className: "BIS", level: 1, age: 27, alignment: "GOOD", race: "ELF",
      hp: 21, maxHp: 21, ac: 7, status: "OK", row: "back", gold: 62, xp: 0,
      stats: { str: 7, iq: 12, pie: 12, vit: 8, agi: 9, luc: 10 },
      spells: { mage: [1,0,0,0,0,0,0], priest: [1,0,0,0,0,0,0] },
      items: ["STAFF", "ROBES", "UNIDENTIFIED SCROLL"],
    },
  ];

  const CHEST_ACTORS = PARTY_MEMBERS.map((member) => member.name);
  const CHEST_SPECIALIST = "ミラ";

  const state = {
    floor: "B1F",
    x: START_POS.x,
    z: START_POS.z,
    dir: START_POS.dir,
    openedDoors: new Set(),
    openedChests: new Set(),
    checkedChestTraps: new Set(),
    disarmedChests: new Set(),
    activatedLevers: new Set(),
    trapDetectionActive: false,
    eventWindowOpen: false,
    showMap: false,
    animation: null,
    message: "",
    encounterIndex: 0,
    randomEncounterSteps: 0,
    currentBattle: null,
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
        // v06: 扉のまだら表示を避けるため、扉面はプロシージャル縞を使わず単色寄りにする。
        tex = vec3(1.0);
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

  function floorObjectAt(x, z) {
    return DUNGEON_OBJECTS.find((obj) => obj.x === x && obj.z === z && obj.side === "FLOOR") || null;
  }

  function objectOnCurrentWall(x, z, dir) {
    return DUNGEON_OBJECTS.find((obj) => obj.x === x && obj.z === z && SIDE_TO_DIR[obj.side] === dir) || null;
  }

  function objectFacingPlayerAt(x, z, dir) {
    const requiredSide = (dir + 2) % 4;
    return DUNGEON_OBJECTS.find((obj) => obj.x === x && obj.z === z && SIDE_TO_DIR[obj.side] === requiredSide) || null;
  }

  function leverOnCurrentWall(x, z, dir) {
    return DUNGEON_OBJECTS.find((obj) => obj.type === "lever" && obj.x === x && obj.z === z && SIDE_TO_DIR[obj.side] === dir) || null;
  }

  function isChestOpen(obj) {
    return state.openedChests.has(objectKey(obj));
  }

  function isChestTrapChecked(obj) {
    return state.checkedChestTraps.has(objectKey(obj));
  }

  function isChestDisarmed(obj) {
    return state.disarmedChests.has(objectKey(obj));
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
    if (state.eventWindowOpen || state.animation) return;
    const d = DIRS[state.dir];
    const nx = state.x + d.x * step;
    const nz = state.z + d.z * step;
    if (isBlocked(nx, nz)) {
      startBumpAnimation(step);
      setMessage("進めない。", true);
      return;
    }
    startMoveAnimation(nx, nz, step);
  }

  function turn(delta) {
    if (state.eventWindowOpen || state.animation) return;
    const ndir = (state.dir + delta + 4) % 4;
    startTurnAnimation(ndir, delta);
  }

  function inspectFront() {
    if (state.eventWindowOpen || state.animation) return;

    const wallLever = leverOnCurrentWall(state.x, state.z, state.dir);
    if (wallLever) {
      const key = objectKey(wallLever);
      const target = wallLever.targetDoor;
      if (state.activatedLevers.has(key)) {
        state.activatedLevers.delete(key);
        if (target) state.openedDoors.delete(doorKey(target.x, target.z));
        scene = buildSceneGeometry();
        setMessage("レバーを上げた。……どこかで音がした。", false);
      } else {
        state.activatedLevers.add(key);
        if (target) state.openedDoors.add(doorKey(target.x, target.z));
        scene = buildSceneGeometry();
        setMessage("レバーを下げた。……どこかで音がした。", false);
      }
      return;
    }

    const currentWallObject = objectOnCurrentWall(state.x, state.z, state.dir);
    if (currentWallObject && currentWallObject.type !== "lever") {
      inspectDungeonObject(currentWallObject);
      return;
    }

    // v12: 宝箱は同一マスにいれば、向きに関係なく調べられる。
    const currentChest = DUNGEON_OBJECTS.find((obj) => obj.type === "chest" && obj.x === state.x && obj.z === state.z);
    if (currentChest) {
      inspectDungeonObject(currentChest);
      return;
    }

    const currentFloorObject = floorObjectAt(state.x, state.z);
    if (currentFloorObject) {
      if (currentFloorObject.type !== "trapFloor" || state.trapDetectionActive) {
        inspectDungeonObject(currentFloorObject);
        return;
      }
    }

    const d = DIRS[state.dir];
    const fx = state.x + d.x;
    const fz = state.z + d.z;
    const frontObject = objectFacingPlayerAt(fx, fz, state.dir);
    if (frontObject) {
      inspectDungeonObject(frontObject);
      return;
    }

    const tile = tileAt(fx, fz);

    if (tile === TILE.DOOR && !isDoorOpen(fx, fz)) {
      state.openedDoors.add(doorKey(fx, fz));
      scene = buildSceneGeometry();
      setMessage("扉を開けた。", false);
      return;
    }

    if (tile === TILE.WALL) {
      setMessage("石壁だ。", false);
      return;
    }

    if (tile === TILE.STAIR) {
      setMessage("下り階段がある。", false);
      return;
    }

    const current = tileAt(state.x, state.z);
    if (current === TILE.EVENT) {
      setMessage("床に紋様がある。", false);
      return;
    }

    setMessage("何も見つからない。", false);
  }

  function inspectDungeonObject(obj) {
    if (obj.type === "chest") {
      openChestWindow(obj);
      return;
    }
    if (obj.type === "altar" || obj.type === "statue" || obj.type === "magicCircle" || obj.type === "trapFloor") {
      openDungeonObjectWindow(obj);
    }
  }

  function openChestWindow(chest, notice = "", mode = "main") {
    state.eventWindowOpen = true;
    renderChestWindow(chest, notice, mode);
  }

  function openDungeonObjectWindow(obj, notice = "") {
    state.eventWindowOpen = true;
    renderDungeonObjectWindow(obj, notice);
  }

  function closeEventWindow() {
    clearBattleLogTimer();
    const overlay = document.getElementById("eventWindowOverlay");
    if (overlay) overlay.remove();
    state.eventWindowOpen = false;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function partyHpText(member) {
    return `${member.hp}/${member.maxHp}`;
  }

  function spellLine(points) {
    const list = Array.isArray(points) ? points.slice(0, 7) : [];
    while (list.length < 7) list.push(0);
    return list.map((value) => Number(value) || 0).join("/");
  }

  function hasSpellPoints(points) {
    return Array.isArray(points) && points.some((value) => Number(value) > 0);
  }

  function renderSpellPointRows(member) {
    const mage = member.spells && member.spells.mage ? member.spells.mage : [];
    const priest = member.spells && member.spells.priest ? member.spells.priest : [];
    if (!hasSpellPoints(mage) && !hasSpellPoints(priest)) {
      return `<div class="spell-none">呪文なし</div>`;
    }
    const rows = [];
    if (hasSpellPoints(mage)) rows.push(`<div><span>MAGE</span><strong>${escapeHtml(spellLine(mage))}</strong></div>`);
    if (hasSpellPoints(priest)) rows.push(`<div><span>PRIEST</span><strong>${escapeHtml(spellLine(priest))}</strong></div>`);
    return rows.join("");
  }

  function renderPartyCards() {
    if (!partyCardGrid) return;
    partyCardGrid.innerHTML = PARTY_MEMBERS.map((member) => `
      <button class="party-card" type="button" data-member-id="${escapeHtml(member.id)}" aria-label="${escapeHtml(member.name)}の詳細">
        <span class="party-card-top">
          <span class="party-card-name">${escapeHtml(member.name)}</span>
          <span class="party-card-class">${escapeHtml(member.className)}</span>
        </span>
        <span class="party-card-line"><span>HP ${escapeHtml(partyHpText(member))}</span><span>AC ${escapeHtml(effectiveMemberAc(member))}</span></span>
        <span class="party-card-line party-card-status"><span>${escapeHtml(member.row === "front" ? "前衛" : "後衛")}</span><span>${escapeHtml(member.status)}</span></span>
      </button>
    `).join("");

    partyCardGrid.querySelectorAll("button[data-member-id]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state.eventWindowOpen || state.animation) return;
        openCharacterWindow(button.dataset.memberId);
      }, { passive: false });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  function renderEventPartyTable(options = {}) {
    const compact = Boolean(options.compact);
    const labels = compact
      ? ["NAME", "CLS", "HITS", "AC", "ST"]
      : ["NAME", "CLASS", "HITS", "AC", "STATUS"];
    return `
      <div class="event-party-head"><span>${labels.map(escapeHtml).join("</span><span>")}</span></div>
      ${PARTY_MEMBERS.map((member) => `
        <div class="event-party-row"><span>${escapeHtml(member.name)}</span><span>${escapeHtml(member.className)}</span><span>${escapeHtml(partyHpText(member))}</span><span>${escapeHtml(effectiveMemberAc(member))}</span><span>${escapeHtml(member.status)}</span></div>
      `).join("")}
    `;
  }

  function getEventOverlay() {
    let overlay = document.getElementById("eventWindowOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "eventWindowOverlay";
      overlay.className = "event-window-overlay";
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function bindWindowActions(overlay, handler) {
    overlay.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        handler(button.dataset.action || "");
      }, { passive: false });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  const DUNGEON_EVENT_DEFS = {
    altar: {
      title: "祭壇",
      glyph: "ALTAR",
      prompt: "祭壇がある。",
      actions: [
        { key: "inspect", label: "調べる", result: "祭壇を調べた。" },
        { key: "pray", label: "祈る", result: "祈った。" },
      ],
    },
    statue: {
      title: "石像",
      glyph: "STATUE",
      prompt: "石像がある。",
      actions: [
        { key: "inspect", label: "調べる", result: "石像を調べた。" },
        { key: "touch", label: "触れる", result: "石像に触れた。" },
      ],
    },
    magicCircle: {
      title: "床の紋様",
      glyph: "SIGIL",
      prompt: "床に紋様がある。",
      actions: [
        { key: "inspect", label: "調べる", result: "床の紋様を調べた。" },
        { key: "step", label: "踏み込む", result: "踏み込んだ。" },
      ],
    },
    trapFloor: {
      title: "青白い床の印",
      glyph: "TRAP",
      prompt: "床が淡く光っている。",
      actions: [
        { key: "inspect", label: "調べる", result: "床を調べた。" },
      ],
    },
  };

  function renderDungeonObjectWindow(obj, notice = "") {
    const def = DUNGEON_EVENT_DEFS[obj.type];
    if (!def) {
      closeEventWindow();
      return;
    }
    const overlay = getEventOverlay();
    const actionButtons = def.actions.map((action) => `<button data-action="event:${escapeHtml(action.key)}">${escapeHtml(action.label)}</button>`).join("");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel object-event-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">${escapeHtml(def.title)}</span>
          <span class="event-prompt">${escapeHtml(notice || def.prompt)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-main-grid object-event-grid">
          <div class="event-art-frame object-art-frame" aria-hidden="true">
            <div class="event-object-glyph ${escapeHtml(obj.type)}">${escapeHtml(def.glyph)}</div>
          </div>
          <div class="event-command-frame">
            <div class="event-command-title">COMMAND</div>
            <div class="event-actions">
              ${actionButtons}
              <button data-action="close">離れる</button>
            </div>
          </div>
        </div>
      </div>`;

    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        setMessage("離れた。", false);
        return;
      }
      if (action.startsWith("event:")) {
        const key = action.slice("event:".length);
        const eventAction = def.actions.find((item) => item.key === key);
        const result = eventAction ? eventAction.result : "調べた。";
        renderDungeonObjectWindow(obj, result);
        setMessage(result, false);
      }
    });
  }

  function normalizeEnemyLabel(displayName) {
    return String(displayName || "敵").replace(/^仮分類:\s*/, "");
  }

  function parseDice(diceText) {
    const match = String(diceText || "1d1").match(/^(\d+)d(\d+)$/i);
    if (!match) return { count: 1, sides: 1 };
    return { count: Math.max(1, Number(match[1])), sides: Math.max(1, Number(match[2])) };
  }

  function rollDice(diceText) {
    const dice = parseDice(diceText);
    let total = 0;
    for (let i = 0; i < dice.count; i += 1) {
      total += 1 + Math.floor(Math.random() * dice.sides);
    }
    return total;
  }

  function rollRange(range) {
    const min = Math.max(0, Number(range && range.min ? range.min : 0));
    const max = Math.max(min, Number(range && range.max ? range.max : min));
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function rollEnemyHp(definition) {
    const hp = definition.hp || { dice: "1d1", fixed: 0 };
    return Math.max(1, rollDice(hp.dice) + Number(hp.fixed || 0));
  }

  function rollPercent(chance) {
    return Math.random() * 100 < Math.max(0, Math.min(100, Number(chance || 0)));
  }

  function rollTreasureItems(tableId, chance = 100) {
    if (!tableId || !rollPercent(chance)) return [];
    const table = TREASURE_TABLES[tableId];
    if (!Array.isArray(table)) return [];
    const results = [];
    table.forEach((entry) => {
      if (entry && entry.item && rollPercent(entry.chance)) results.push(String(entry.item));
    });
    return results;
  }

  function createItemInstance(itemName, equippedSlot = null) {
    return {
      instanceId: `item-${nextItemInstanceSeq++}`,
      name: String(itemName || ""),
      equippedSlot: equippedSlot || null,
    };
  }

  function itemDisplayName(item) {
    if (!item) return "";
    if (typeof item === "string") return item;
    return String(item.name || "");
  }

  function itemDefinition(item) {
    return ITEM_DEFINITIONS[itemDisplayName(item)] || null;
  }

  function itemEquipSlot(item) {
    const definition = itemDefinition(item);
    return definition && definition.slot ? definition.slot : null;
  }

  function isEquipableItem(item) {
    return Boolean(itemEquipSlot(item));
  }

  function isItemEquipped(item) {
    return Boolean(item && typeof item === "object" && item.equippedSlot);
  }

  function equippedItemsForMember(member) {
    return (member && Array.isArray(member.items) ? member.items : []).filter((item) => isItemEquipped(item));
  }

  function equippedItemForSlot(member, slot) {
    return equippedItemsForMember(member).find((item) => item.equippedSlot === slot) || null;
  }

  function equippedItemLabel(member, slot) {
    const item = equippedItemForSlot(member, slot);
    return item ? itemDisplayName(item) : "-";
  }

  function equippedItemSummary(member) {
    return EQUIPMENT_SLOTS.map((slot) => `${slot.label}:${equippedItemLabel(member, slot.key)}`).join(" / ");
  }

  function itemStatusLabel(item) {
    const definition = itemDefinition(item);
    if (isItemEquipped(item)) return "E";
    if (definition && definition.slotLabel) return definition.slotLabel;
    if (isCampUsableItem(item)) return "USE";
    return "-";
  }

  function normalizeMemberItems(member) {
    if (!member) return;
    const sourceItems = Array.isArray(member.items) ? member.items : [];
    member.items = sourceItems.map((item) => {
      if (item && typeof item === "object" && item.name) {
        if (!item.instanceId) item.instanceId = `item-${nextItemInstanceSeq++}`;
        if (item.equippedSlot === undefined) item.equippedSlot = null;
        return item;
      }
      return createItemInstance(item);
    });

    const usedSlots = new Set();
    member.items.forEach((item) => {
      const slot = itemEquipSlot(item);
      if (!slot) {
        item.equippedSlot = null;
        return;
      }
      if (item.equippedSlot && item.equippedSlot !== slot) item.equippedSlot = null;
      if (item.equippedSlot && usedSlots.has(item.equippedSlot)) item.equippedSlot = null;
      if (item.equippedSlot) usedSlots.add(item.equippedSlot);
    });

    member.items.forEach((item) => {
      const slot = itemEquipSlot(item);
      if (!slot || usedSlots.has(slot)) return;
      item.equippedSlot = slot;
      usedSlots.add(slot);
    });

    const equippedAc = member.items.reduce((sum, item) => {
      const definition = itemDefinition(item);
      return sum + (isItemEquipped(item) ? Number(definition && definition.acBonus ? definition.acBonus : 0) : 0);
    }, 0);
    if (!Number.isFinite(Number(member.baseAc))) {
      member.baseAc = Number(member.ac || 10) - equippedAc;
    }
  }

  function normalizePartyEquipment() {
    PARTY_MEMBERS.forEach(normalizeMemberItems);
  }

  function effectiveMemberAc(member) {
    if (!member) return 10;
    const base = Number.isFinite(Number(member.baseAc)) ? Number(member.baseAc) : Number(member.ac || 10);
    return equippedItemsForMember(member).reduce((sum, item) => {
      const definition = itemDefinition(item);
      return sum + Number(definition && definition.acBonus ? definition.acBonus : 0);
    }, base);
  }

  function equipMemberItem(member, itemIndex) {
    const item = itemAtIndex(member, itemIndex);
    const slot = itemEquipSlot(item);
    const itemName = itemDisplayName(item);
    if (!member || !item) return { ok: false, notice: "道具が見つからない。" };
    if (!slot) return { ok: false, notice: `${itemName}は装備できない。` };
    if (isItemEquipped(item)) {
      item.equippedSlot = null;
      renderPartyCards();
      return { ok: true, notice: `${member.name}は${itemName}を外した。` };
    }
    (member.items || []).forEach((candidate) => {
      if (candidate && typeof candidate === "object" && candidate.equippedSlot === slot) candidate.equippedSlot = null;
    });
    item.equippedSlot = slot;
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${itemName}を装備した。` };
  }

  function firstLivingMember() {
    return livingPartyMembers()[0] || PARTY_MEMBERS.find((member) => member.hp > 0) || PARTY_MEMBERS[0] || null;
  }

  function mostWoundedLivingMember() {
    const candidates = livingPartyMembers().filter((member) => Number(member.hp || 0) < Number(member.maxHp || 0));
    if (!candidates.length) return null;
    return candidates.sort((a, b) => ((a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp))))[0];
  }

  function findPartyMember(memberId) {
    return PARTY_MEMBERS.find((member) => member.id === memberId) || null;
  }

  function isLivingMember(member) {
    return Boolean(member && member.status === "OK" && Number(member.hp || 0) > 0);
  }

  function isWoundedLivingMember(member) {
    return Boolean(isLivingMember(member) && Number(member.hp || 0) < Number(member.maxHp || 0));
  }

  function isBattleUsableItem(item) {
    return itemDisplayName(item) === "HEALING HERB";
  }

  function isCampUsableItem(item) {
    return itemDisplayName(item) === "HEALING HERB";
  }

  function itemAtIndex(member, itemIndex) {
    if (!member || !Array.isArray(member.items)) return null;
    const index = Number(itemIndex);
    if (!Number.isInteger(index) || index < 0 || index >= member.items.length) return null;
    return member.items[index];
  }

  function useCampItemOnTarget(member, itemIndex, targetMemberId) {
    const index = Number(itemIndex);
    const item = itemAtIndex(member, index);
    const itemName = itemDisplayName(item);
    if (!item) return { ok: false, notice: "道具が見つからない。" };
    if (!isCampUsableItem(item)) return { ok: false, notice: `${itemName}はまだ使えない。` };
    const target = findPartyMember(targetMemberId);
    if (!isLivingMember(target)) return { ok: false, notice: "対象を回復できない。" };
    if (!isWoundedLivingMember(target)) return { ok: false, notice: `${target.name}に傷はない。` };
    member.items.splice(index, 1);
    const amount = Math.max(1, rollDice("1d6") + 3);
    target.hp = Math.min(Number(target.maxHp || 1), Number(target.hp || 0) + amount);
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${itemName}で${target.name}を${amount}回復した。` };
  }

  function transferItemToMember(member, itemIndex, targetMemberId) {
    const index = Number(itemIndex);
    const item = itemAtIndex(member, index);
    const itemName = itemDisplayName(item);
    const target = findPartyMember(targetMemberId);
    if (!item) return { ok: false, notice: "道具が見つからない。" };
    if (!target) return { ok: false, notice: "渡す相手が見つからない。" };
    if (target.id === member.id) return { ok: false, notice: "同じメンバーには渡せない。" };
    if (item && typeof item === "object") item.equippedSlot = null;
    member.items.splice(index, 1);
    addItemToMember(target, item);
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${target.name}に${itemName}を渡した。` };
  }

  function dropMemberItem(member, itemIndex) {
    const index = Number(itemIndex);
    const item = itemAtIndex(member, index);
    const itemName = itemDisplayName(item);
    if (!item) return { ok: false, notice: "道具が見つからない。" };
    if (item && typeof item === "object") item.equippedSlot = null;
    member.items.splice(index, 1);
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${itemName}を捨てた。` };
  }

  function addItemToMember(member, item) {
    if (!member || !item) return false;
    if (!Array.isArray(member.items)) member.items = [];
    if (item && typeof item === "object" && item.name) {
      item.equippedSlot = null;
      if (!item.instanceId) item.instanceId = `item-${nextItemInstanceSeq++}`;
      member.items.push(item);
      return true;
    }
    member.items.push(createItemInstance(item));
    return true;
  }

  function createBattleReward(groups, encounter) {
    const totalXp = groups.reduce((sum, group) => {
      const xp = Number(group.definition && group.definition.xp ? group.definition.xp : 0);
      return sum + xp * group.instances.length;
    }, 0);
    const totalGold = rollRange(encounter && encounter.gold);
    const items = rollTreasureItems(encounter && encounter.treasureTableId, encounter && encounter.dropChance);
    return {
      totalXp,
      totalGold,
      items,
      applied: false,
      eligibleCount: 0,
      shares: [],
      itemRecipient: null,
    };
  }

  function createBattleFromEncounter(encounter) {
    const groups = encounter.enemies.map((entry, groupIndex) => {
      const definition = ENEMY_DEFINITIONS[entry.enemyId];
      const label = entry.label || normalizeEnemyLabel(definition ? definition.displayName : entry.enemyId);
      const instances = [];
      const count = Math.max(1, Number(entry.count || 1));
      for (let i = 0; i < count; i += 1) {
        const maxHp = definition ? rollEnemyHp(definition) : 1;
        instances.push({
          instanceId: `${entry.enemyId}_${groupIndex}_${i}`,
          enemyId: entry.enemyId,
          currentHp: maxHp,
          maxHp,
          status: "OK",
        });
      }
      return { ...entry, label, definition, instances };
    });
    return {
      id: encounter.id,
      floor: encounter.floor,
      layer: encounter.layer,
      title: encounter.title,
      prompt: encounter.prompt,
      note: encounter.note,
      round: 1,
      groups,
      logHistory: [],
      logCurrent: { text: encounter.prompt, visibleLength: 0, complete: false },
      logQueue: [],
      logPanelOpen: true,
      inputPhase: "character_command",
      inputIndex: 0,
      commandContext: null,
      actionQueue: [],
      finished: false,
      result: null,
      reward: createBattleReward(groups, encounter),
    };
  }

  function isBattleLogActive(battle) {
    if (!battle) return false;
    ensureBattleLogState(battle);
    return Boolean((battle.logCurrent && !battle.logCurrent.complete) || battle.logQueue.length);
  }

  function battleActionableMembers() {
    return PARTY_MEMBERS.map((member, index) => ({ member, index })).filter(({ member }) => member.status === "OK" && member.hp > 0);
  }

  function normalizeBattleInputIndex(battle) {
    if (!battle) return;
    const members = battleActionableMembers();
    if (!members.length) {
      battle.inputIndex = 0;
      battle.inputPhase = "battle_result";
      return;
    }
    battle.inputIndex = Math.max(0, Math.min(Number(battle.inputIndex || 0), members.length - 1));
  }

  function currentBattleMemberEntry(battle) {
    normalizeBattleInputIndex(battle);
    return battleActionableMembers()[battle.inputIndex] || null;
  }

  function canMemberCast(member) {
    if (!member || !member.spells) return false;
    return hasSpellPoints(member.spells.mage) || hasSpellPoints(member.spells.priest);
  }

  function canMemberUseItem(member) {
    return Boolean(member && Array.isArray(member.items) && member.items.some((item) => isBattleUsableItem(item)));
  }

  function resetBattleInputForRound(battle) {
    battle.inputPhase = "character_command";
    battle.inputIndex = 0;
    battle.commandContext = null;
    battle.actionQueue = [];
    normalizeBattleInputIndex(battle);
  }

  function getMemberBattleMark(battle, memberId) {
    if (!battle) return BATTLE_PARTY_ACTION_MARKS.waiting;
    const current = currentBattleMemberEntry(battle);
    if (current && current.member.id === memberId && !battle.finished && battle.inputPhase !== "round_resolving" && battle.inputPhase !== "battle_result") return BATTLE_PARTY_ACTION_MARKS.current;
    if ((battle.actionQueue || []).some((action) => action.characterId === memberId)) return BATTLE_PARTY_ACTION_MARKS.queued;
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member || member.status !== "OK" || member.hp <= 0) return BATTLE_PARTY_ACTION_MARKS.unable;
    return BATTLE_PARTY_ACTION_MARKS.waiting;
  }

  function commitBattleAction(battle, action) {
    if (!battle || !action) return;
    battle.actionQueue = Array.isArray(battle.actionQueue) ? battle.actionQueue : [];
    battle.actionQueue.push(action);
    const actionable = battleActionableMembers();
    if (battle.actionQueue.length >= actionable.length) {
      battle.inputPhase = "round_confirm";
      battle.commandContext = null;
      return;
    }
    battle.inputIndex = Math.min(battle.actionQueue.length, actionable.length - 1);
    battle.inputPhase = "character_command";
    battle.commandContext = null;
  }

  function backToPreviousBattleInput(battle) {
    if (!battle) return;
    if (["target_select", "spell_select", "item_select", "spell_target_enemy", "spell_target_ally", "item_target_ally"].includes(battle.inputPhase)) {
      if (battle.inputPhase === "spell_target_enemy" || battle.inputPhase === "spell_target_ally") {
        battle.inputPhase = "spell_select";
        if (battle.commandContext) {
          battle.commandContext = { command: "spell", characterId: battle.commandContext.characterId };
        }
        return;
      }
      if (battle.inputPhase === "item_target_ally") {
        battle.inputPhase = "item_select";
        if (battle.commandContext) {
          battle.commandContext = { command: "item", characterId: battle.commandContext.characterId };
        }
        return;
      }
      battle.inputPhase = "character_command";
      battle.commandContext = null;
      return;
    }
    if (battle.inputPhase === "round_confirm") {
      const removed = battle.actionQueue.pop();
      const actionable = battleActionableMembers();
      const idx = actionable.findIndex(({ member }) => member.id === (removed && removed.characterId));
      battle.inputIndex = idx >= 0 ? idx : Math.max(0, battle.actionQueue.length - 1);
      battle.inputPhase = "character_command";
      battle.commandContext = null;
      return;
    }
    if (battle.inputPhase === "character_command" && battle.actionQueue.length > 0) {
      const removed = battle.actionQueue.pop();
      const actionable = battleActionableMembers();
      const idx = actionable.findIndex(({ member }) => member.id === (removed && removed.characterId));
      battle.inputIndex = idx >= 0 ? idx : Math.max(0, battle.actionQueue.length);
      battle.commandContext = null;
    }
  }

  function firstAliveEnemyInGroup(battle, groupIndex) {
    const group = battle && battle.groups ? battle.groups[Number(groupIndex)] : null;
    if (!group) return null;
    const instance = group.instances.find((item) => item.currentHp > 0);
    return instance ? { group, instance, groupIndex: Number(groupIndex) } : null;
  }

  function firstAliveEnemy(battle) {
    return getAliveEnemies(battle)[0] || null;
  }

  function clearBattleLogTimer() {
    if (battleLogTimer) {
      window.clearTimeout(battleLogTimer);
      battleLogTimer = 0;
    }
  }

  function ensureBattleLogState(battle) {
    if (!battle) return;
    battle.logHistory = Array.isArray(battle.logHistory) ? battle.logHistory : [];
    battle.logQueue = Array.isArray(battle.logQueue) ? battle.logQueue : [];
    if (typeof battle.logPanelOpen !== "boolean") battle.logPanelOpen = true;
    if (!battle.logCurrent) {
      battle.logCurrent = { text: battle.prompt || "", visibleLength: 0, complete: false };
    }
  }

  function trimBattleLogHistory(battle) {
    battle.logHistory = battle.logHistory.slice(-BATTLE_LOG_HISTORY_LIMIT);
  }

  function pushBattleLog(battle, line) {
    if (!battle || !line) return;
    ensureBattleLogState(battle);
    const text = String(line);
    const current = battle.logCurrent;
    if (current && current.text && !current.complete) {
      battle.logQueue.push(text);
      return;
    }
    if (current && current.text && current.complete) {
      battle.logHistory.push(current.text);
      trimBattleLogHistory(battle);
    }
    battle.logCurrent = { text, visibleLength: 0, complete: false };
  }

  function finishBattleLogTyping(battle) {
    if (!battle) return false;
    ensureBattleLogState(battle);
    const current = battle.logCurrent;
    if (!current || current.complete) return false;
    current.visibleLength = current.text.length;
    current.complete = true;
    clearBattleLogTimer();
    updateBattleLogDom(battle);
    return true;
  }

  function advanceBattleLogQueue(battle) {
    if (!battle) return;
    ensureBattleLogState(battle);
    const current = battle.logCurrent;
    if (current && current.text) {
      battle.logHistory.push(current.text);
      trimBattleLogHistory(battle);
    }
    const next = battle.logQueue.shift();
    if (!next) {
      updateBattleLogDom(battle);
      return;
    }
    battle.logCurrent = { text: next, visibleLength: 0, complete: false };
    updateBattleLogDom(battle);
    startBattleLogTyping(battle);
  }

  function visibleBattleLogText(current) {
    if (!current) return "";
    if (current.complete || BATTLE_LOG_TYPE_SPEED_MS <= 0) return current.text;
    return current.text.slice(0, current.visibleLength);
  }

  function renderBattleLog(battle) {
    ensureBattleLogState(battle);
    const history = battle.logHistory.slice(-BATTLE_LOG_HISTORY_LIMIT);
    const historyHtml = history.map((line) => `<div class="encounter-log-old">${escapeHtml(line)}</div>`).join("");
    const current = battle.logCurrent;
    const currentText = visibleBattleLogText(current);
    const caret = current && !current.complete ? '<span class="log-caret">▌</span>' : '';
    const queueMark = battle.logQueue.length ? `<span class="log-queue-mark">+${escapeHtml(battle.logQueue.length)}</span>` : "";
    return `${historyHtml}<div class="encounter-log-current">${escapeHtml(currentText)}${caret}${queueMark}</div>`;
  }

  function updateBattleLogDom(battle) {
    const logLines = document.querySelector(".encounter-log-lines");
    if (!logLines || !battle) return;
    logLines.innerHTML = renderBattleLog(battle);
  }
  function renderBattleLogPanel(battle) {
    ensureBattleLogState(battle);
    if (!battle.logPanelOpen) {
      return `
        <button class="battle-log-toggle" data-action="battle:log:open" aria-label="ログを開く">LOG</button>
      `;
    }
    return `
      <div class="encounter-log-frame battle-log-float" aria-live="polite" data-log-skip="true">
        <div class="battle-log-title-row">
          <div class="event-command-title">LOG <span class="log-speed-label">TYPE ${escapeHtml(BATTLE_LOG_TYPE_SPEED_MS)}ms</span></div>
          <button class="battle-log-close" data-action="battle:log:close" aria-label="ログを閉じる">×</button>
        </div>
        <div class="encounter-log-lines">
          ${renderBattleLog(battle)}
        </div>
      </div>
    `;
  }


  function startBattleLogTyping(battle) {
    clearBattleLogTimer();
    if (!battle) return;
    ensureBattleLogState(battle);
    const current = battle.logCurrent;
    if (!current || current.complete) {
      if (battle.logQueue.length) {
        battleLogTimer = window.setTimeout(() => advanceBattleLogQueue(battle), BATTLE_LOG_NEXT_DELAY_MS);
      }
      return;
    }
    if (BATTLE_LOG_TYPE_SPEED_MS <= 0) {
      finishBattleLogTyping(battle);
      if (battle.logQueue.length) advanceBattleLogQueue(battle);
      return;
    }
    if (current.visibleLength >= current.text.length) {
      current.complete = true;
      updateBattleLogDom(battle);
      if (battle.logQueue.length) {
        battleLogTimer = window.setTimeout(() => advanceBattleLogQueue(battle), BATTLE_LOG_NEXT_DELAY_MS);
      }
      return;
    }
    battleLogTimer = window.setTimeout(() => {
      current.visibleLength = Math.min(current.text.length, current.visibleLength + 1);
      updateBattleLogDom(battle);
      startBattleLogTyping(battle);
    }, BATTLE_LOG_TYPE_SPEED_MS);
  }

  function getAliveEnemies(battle) {
    return battle.groups.flatMap((group) => group.instances.map((instance) => ({ group, instance }))).filter((item) => item.instance.currentHp > 0);
  }

  function isBattleFinished(battle) {
    return getAliveEnemies(battle).length === 0;
  }

  function livingPartyMembers() {
    return PARTY_MEMBERS.filter((member) => member.status === "OK" && member.hp > 0);
  }

  function isPartyDefeated() {
    return livingPartyMembers().length === 0;
  }

  function hitTargetNumberForAc(ac) {
    // ACは低いほどよい。低ACほど命中に必要な値が高くなるようにする。
    const numericAc = Number.isFinite(Number(ac)) ? Number(ac) : 10;
    return Math.max(5, Math.min(18, 16 - numericAc));
  }

  function memberHitBonus(member) {
    const level = Number(member && member.level ? member.level : 1);
    const stats = (member && member.stats) || {};
    const strBonus = Math.floor((Number(stats.str || 10) - 10) / 4);
    const agiBonus = member && member.className === "THI" ? Math.floor((Number(stats.agi || 10) - 10) / 5) : 0;
    const weapon = equippedItemForSlot(member, "weapon");
    const weaponBonus = Number((itemDefinition(weapon) && itemDefinition(weapon).hitBonus) || 0);
    return level + strBonus + agiBonus + weaponBonus;
  }

  function memberDamageDice(member) {
    const weapon = equippedItemForSlot(member, "weapon");
    const definition = itemDefinition(weapon);
    if (definition && definition.damageDice) return definition.damageDice;
    if (member.className === "FIG") return "1d6";
    if (member.className === "THI") return "1d4";
    if (member.className === "PRI") return "1d4";
    if (member.className === "BIS") return "1d4";
    return "1d3";
  }

  function memberDamageBonus(member) {
    return Math.max(0, Math.floor((((member.stats && member.stats.str) || 10) - 10) / 3));
  }

  function enemyDisplayName(group) {
    return group && group.label ? group.label : "敵";
  }

  function chooseEnemyAttack(definition) {
    const attacks = definition && Array.isArray(definition.attacks) ? definition.attacks : [];
    if (!attacks.length) return { id: "attack", targetRule: "front_single", hitBonus: 0, damageDice: "1d3", damageBonus: 0 };
    const total = attacks.reduce((sum, attack) => sum + Math.max(0, Number(attack.chance || 0)), 0);
    if (total <= 0) return attacks[0];
    let roll = Math.random() * total;
    for (const attack of attacks) {
      roll -= Math.max(0, Number(attack.chance || 0));
      if (roll <= 0) return attack;
    }
    return attacks[0];
  }

  function chooseEnemyTarget() {
    const living = livingPartyMembers();
    const front = living.filter((member) => member.row === "front");
    const candidates = front.length ? front : living;
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function isMemberDefending(actionSet, memberId) {
    return Boolean(actionSet && actionSet.has(memberId));
  }

  function setMemberDown(member) {
    member.hp = 0;
    member.status = "DOWN";
  }

  function distributeRewardAmount(total, recipients) {
    const count = recipients.length;
    if (!count || total <= 0) return new Map();
    const base = Math.floor(total / count);
    let remainder = total % count;
    const result = new Map();
    recipients.forEach((member) => {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      result.set(member.id, share);
    });
    return result;
  }

  function xpForNextLevel(member) {
    const currentLevel = Math.max(1, Number(member && member.level ? member.level : 1));
    return LEVEL_XP_THRESHOLDS[currentLevel] || null;
  }

  function tryApplyLevelUp(member) {
    const lines = [];
    if (!member) return lines;
    let next = xpForNextLevel(member);
    while (next !== null && Number(member.xp || 0) >= next) {
      member.level = Number(member.level || 1) + 1;
      const hpGain = Math.max(2, rollDice(member.className === "FIG" ? "1d8" : member.className === "THI" ? "1d6" : "1d4"));
      member.maxHp = Number(member.maxHp || 1) + hpGain;
      member.hp = member.maxHp;
      if (member.spells && (member.className === "PRI" || member.className === "BIS")) {
        member.spells.priest[0] = Number(member.spells.priest[0] || 0) + 1;
      }
      if (member.spells && (member.className === "MAG" || member.className === "BIS")) {
        member.spells.mage[0] = Number(member.spells.mage[0] || 0) + 1;
      }
      lines.push(`${member.name}はLV ${member.level}になった。`);
      next = xpForNextLevel(member);
    }
    return lines;
  }

  function applyBattleVictoryRewards(battle) {
    if (!battle || !battle.reward || battle.reward.applied) return [];
    const recipients = livingPartyMembers();
    const lines = [];
    battle.reward.applied = true;
    battle.reward.eligibleCount = recipients.length;
    battle.reward.shares = [];
    if (!recipients.length) return ["報酬を受け取れる者がいない。"];

    const xpShares = distributeRewardAmount(Number(battle.reward.totalXp || 0), recipients);
    const goldShares = distributeRewardAmount(Number(battle.reward.totalGold || 0), recipients);
    recipients.forEach((member) => {
      const xpShare = xpShares.get(member.id) || 0;
      const goldShare = goldShares.get(member.id) || 0;
      member.xp = Number(member.xp || 0) + xpShare;
      member.gold = Number(member.gold || 0) + goldShare;
      battle.reward.shares.push({ memberId: member.id, name: member.name, xp: xpShare, gold: goldShare });
      lines.push(...tryApplyLevelUp(member));
    });

    lines.unshift(`${recipients.length}人に配分した。`);
    lines.unshift(`GOLD ${battle.reward.totalGold} を得た。`);
    lines.unshift(`EXP ${battle.reward.totalXp} を得た。`);

    const loot = Array.isArray(battle.reward.items) ? battle.reward.items : [];
    if (loot.length) {
      const recipient = firstLivingMember();
      loot.forEach((itemName) => addItemToMember(recipient, itemName));
      battle.reward.itemRecipient = recipient ? recipient.name : null;
      lines.push(`${recipient ? recipient.name : "隊"}は${loot.join(" / ")}を得た。`);
    } else {
      lines.push("戦利品はなかった。");
    }
    renderPartyCards();
    return lines;
  }

  function resolveQueuedAttack(battle, action, member) {
    const target = action.targetGroupIndex !== null && action.targetGroupIndex !== undefined
      ? firstAliveEnemyInGroup(battle, action.targetGroupIndex)
      : firstAliveEnemy(battle);
    if (!target) return `${member.name}は攻撃した。相手はいなかった。`;
    const enemyAc = target.group.definition ? Number(target.group.definition.ac || 10) : 10;
    const hitRoll = rollDice("1d20") + memberHitBonus(member);
    const targetNumber = hitTargetNumberForAc(enemyAc);
    if (hitRoll < targetNumber) {
      return `${member.name}は${enemyDisplayName(target.group)}を攻撃した。外れた。`;
    }
    const damage = Math.max(1, rollDice(memberDamageDice(member)) + memberDamageBonus(member));
    target.instance.currentHp = Math.max(0, target.instance.currentHp - damage);
    if (target.instance.currentHp <= 0) {
      return `${member.name}は${enemyDisplayName(target.group)}を倒した。`;
    }
    return `${member.name}は${enemyDisplayName(target.group)}に${damage}のダメージ。`;
  }

  function resolveMageSpell(battle, member, targetGroupIndex) {
    if (!member.spells || !member.spells.mage || Number(member.spells.mage[0] || 0) <= 0) {
      return `${member.name}は呪文を唱えようとした。呪文回数がない。`;
    }
    const target = targetGroupIndex !== null && targetGroupIndex !== undefined
      ? (firstAliveEnemyInGroup(battle, targetGroupIndex) || firstAliveEnemy(battle))
      : firstAliveEnemy(battle);
    if (!target) return `${member.name}は呪文を唱えた。相手はいなかった。`;
    member.spells.mage[0] = Math.max(0, Number(member.spells.mage[0] || 0) - 1);
    const iqBonus = Math.max(0, Math.floor((Number((member.stats && member.stats.iq) || 10) - 10) / 3));
    const damage = Math.max(1, rollDice("1d6") + iqBonus);
    target.instance.currentHp = Math.max(0, target.instance.currentHp - damage);
    if (target.instance.currentHp <= 0) {
      return `${member.name}の火花が${enemyDisplayName(target.group)}を倒した。`;
    }
    return `${member.name}の火花が${enemyDisplayName(target.group)}に${damage}のダメージ。`;
  }

  function resolvePriestSpell(member, targetMemberId) {
    if (!member.spells || !member.spells.priest || Number(member.spells.priest[0] || 0) <= 0) {
      return `${member.name}は祈ろうとした。呪文回数がない。`;
    }
    const target = findPartyMember(targetMemberId);
    if (!isLivingMember(target)) return `${member.name}は祈った。対象を回復できない。`;
    if (!isWoundedLivingMember(target)) return `${member.name}は祈った。${target.name}に傷はない。`;
    member.spells.priest[0] = Math.max(0, Number(member.spells.priest[0] || 0) - 1);
    const pieBonus = Math.max(0, Math.floor((Number((member.stats && member.stats.pie) || 10) - 10) / 3));
    const amount = Math.max(1, rollDice("1d8") + 2 + pieBonus);
    target.hp = Math.min(Number(target.maxHp || 1), Number(target.hp || 0) + amount);
    return `${member.name}は${target.name}を${amount}回復した。`;
  }

  function resolveQueuedSpell(battle, action, member) {
    if (action.spellId === "mage1") return resolveMageSpell(battle, member, action.targetGroupIndex);
    if (action.spellId === "priest1") return resolvePriestSpell(member, action.targetMemberId);
    return `${member.name}は呪文を唱えた。効果処理は未定義。`;
  }

  function resolveQueuedItem(action, member) {
    const index = Number(action.itemIndex);
    const items = Array.isArray(member.items) ? member.items : [];
    const item = Number.isFinite(index) ? items[index] : null;
    const itemName = itemDisplayName(item);
    if (!item) return `${member.name}は道具を探した。見つからない。`;
    if (isBattleUsableItem(item)) {
      const target = findPartyMember(action.targetMemberId);
      if (!isLivingMember(target)) return `${member.name}は${itemName}を使えなかった。対象を回復できない。`;
      if (!isWoundedLivingMember(target)) return `${member.name}は${itemName}を使わなかった。${target.name}に傷はない。`;
      items.splice(index, 1);
      const amount = Math.max(1, rollDice("1d6") + 3);
      target.hp = Math.min(Number(target.maxHp || 1), Number(target.hp || 0) + amount);
      return `${member.name}は${itemName}で${target.name}を${amount}回復した。`;
    }
    return `${member.name}は${itemName}を構えた。効果処理はまだ未接続。`;
  }

  function resolveEnemySingleAttack(battle, enemyEntry, defendingMembers) {
    const target = chooseEnemyTarget();
    if (!target) return null;
    const attack = chooseEnemyAttack(enemyEntry.group.definition);
    const enemyLevel = Number((enemyEntry.group.definition && enemyEntry.group.definition.level) || 1);
    const hitBonus = enemyLevel + Number(attack.hitBonus || 0);
    const defending = isMemberDefending(defendingMembers, target.id);
    const hitRoll = rollDice("1d20") + hitBonus;
    const targetNumber = hitTargetNumberForAc(effectiveMemberAc(target)) + (defending ? 2 : 0);
    const enemyName = enemyDisplayName(enemyEntry.group);
    if (hitRoll < targetNumber) {
      return `${enemyName}の攻撃。${target.name}はかわした。`;
    }
    let damage = Math.max(1, rollDice(attack.damageDice || "1d3") + Number(attack.damageBonus || 0));
    if (defending) damage = Math.max(1, Math.ceil(damage / 2));
    target.hp = Math.max(0, Number(target.hp || 0) - damage);
    if (target.hp <= 0) {
      setMemberDown(target);
      return `${enemyName}は${target.name}に${damage}のダメージ。${target.name}は倒れた。`;
    }
    return `${enemyName}は${target.name}に${damage}のダメージ。`;
  }

  function resolveEnemyCounterattacks(battle, defendingMembers) {
    const lines = [];
    const enemies = getAliveEnemies(battle);
    for (const enemyEntry of enemies) {
      if (isPartyDefeated()) break;
      const line = resolveEnemySingleAttack(battle, enemyEntry, defendingMembers);
      if (line) lines.push(line);
    }
    if (isPartyDefeated()) {
      battle.finished = true;
      battle.result = "lost";
      battle.inputPhase = "battle_result";
      battle.commandContext = null;
      lines.push("全員が行動不能になった。");
    }
    renderPartyCards();
    return lines;
  }

  function resolveEscapeAttempt(battle, member) {
    const agi = Number((member && member.stats && member.stats.agi) || 10);
    const aliveEnemyCount = getAliveEnemies(battle).length;
    const chance = Math.max(0.25, Math.min(0.82, BATTLE_ESCAPE_BASE_CHANCE + (agi - 10) * 0.025 - Math.max(0, aliveEnemyCount - 1) * 0.04));
    if (Math.random() < chance) {
      battle.finished = true;
      battle.result = "escaped";
      battle.inputPhase = "battle_result";
      battle.commandContext = null;
      return `${member ? member.name : "隊"}は逃げ切った。`;
    }
    return `${member ? member.name : "隊"}は逃げようとした。逃げられない。`;
  }

  function resolveBattleActionQueue(battle) {
    if (!battle || battle.finished) return ["戦闘は終わっている。"]; 
    const lines = [];
    const queue = Array.isArray(battle.actionQueue) ? battle.actionQueue.slice() : [];
    const defendingMembers = new Set(queue.filter((action) => action.command === "defend").map((action) => action.characterId));
    const runAction = queue.find((action) => action.command === "run");
    if (runAction) {
      const runner = PARTY_MEMBERS.find((item) => item.id === runAction.characterId && item.status === "OK" && item.hp > 0);
      lines.push(resolveEscapeAttempt(battle, runner));
    } else {
      for (const action of queue) {
        if (battle.finished) break;
        const member = PARTY_MEMBERS.find((item) => item.id === action.characterId);
        if (!member || member.status !== "OK" || member.hp <= 0) {
          lines.push("行動できない者がいる。");
          continue;
        }
        if (action.command === "attack") {
          lines.push(resolveQueuedAttack(battle, action, member));
        } else if (action.command === "defend") {
          lines.push(`${member.name}は身を守った。`);
        } else if (action.command === "spell") {
          lines.push(resolveQueuedSpell(battle, action, member));
        } else if (action.command === "item") {
          lines.push(resolveQueuedItem(action, member));
        }
        if (isBattleFinished(battle)) {
          battle.finished = true;
          battle.result = "won";
          lines.push("敵を倒した。");
          lines.push(...applyBattleVictoryRewards(battle));
          break;
        }
      }
    }
    if (!battle.finished) {
      lines.push(...resolveEnemyCounterattacks(battle, defendingMembers));
    }
    if (!battle.finished) {
      battle.round += 1;
      resetBattleInputForRound(battle);
      lines.push(`ROUND ${battle.round}。行動を選ぶ。`);
    } else {
      battle.inputPhase = "battle_result";
      battle.commandContext = null;
      renderPartyCards();
    }
    return lines;
  }

  function buildEnemyCards(battle) {
    return battle.groups.map((group) => {
      const alive = group.instances.filter((instance) => instance.currentHp > 0);
      const firstAlive = alive[0];
      const status = firstAlive ? `HP ${firstAlive.currentHp}/${firstAlive.maxHp}` : "倒れた";
      return `
        <div class="enemy-card ${firstAlive ? "" : "defeated"}" data-enemy-id="${escapeHtml(group.enemyId)}" data-asset-id="${escapeHtml(group.assetId)}">
          <div class="enemy-image-frame">
            <img src="${escapeHtml(group.image)}" alt="" loading="eager" />
          </div>
          <div class="enemy-card-label"><span>${escapeHtml(group.label)}</span><strong>x${escapeHtml(alive.length)}/${escapeHtml(group.instances.length)}</strong></div>
          <div class="enemy-card-status">${escapeHtml(status)}</div>
        </div>
      `;
    }).join("");
  }

  function renderBattlePartyStatus(battle) {
    return PARTY_MEMBERS.map((member) => {
      const mark = getMemberBattleMark(battle, member.id);
      const rowLabel = member.row === "front" ? "前" : "後";
      return `
        <div class="battle-party-row ${mark === BATTLE_PARTY_ACTION_MARKS.current ? "current" : ""} ${mark === BATTLE_PARTY_ACTION_MARKS.queued ? "queued" : ""}">
          <span class="battle-party-mark">${escapeHtml(mark)}</span>
          <span class="battle-party-name">${escapeHtml(member.name)}</span>
          <span class="battle-party-rowpos">${escapeHtml(rowLabel)}</span>
          <span class="battle-party-hp">${escapeHtml(partyHpText(member))}</span>
          <span class="battle-party-ac">AC${escapeHtml(effectiveMemberAc(member))}</span>
          <span class="battle-party-status">${escapeHtml(member.status)}</span>
        </div>
      `;
    }).join("");
  }

  function renderBattleEnemyTargetButtons(battle) {
    return battle.groups.map((group, index) => {
      const alive = group.instances.filter((instance) => instance.currentHp > 0).length;
      if (alive <= 0) return "";
      return `<button data-action="battle:target:${escapeHtml(index)}">${escapeHtml(group.label)} x${escapeHtml(alive)}</button>`;
    }).join("");
  }

  function renderBattleSpellOptions(member) {
    const rows = [];
    if (member.spells && hasSpellPoints(member.spells.mage)) rows.push(`<button data-action="battle:spell:mage1">MAGE 火花 ${escapeHtml(spellLine(member.spells.mage))}</button>`);
    if (member.spells && hasSpellPoints(member.spells.priest)) rows.push(`<button data-action="battle:spell:priest1">PRIEST 治癒 ${escapeHtml(spellLine(member.spells.priest))}</button>`);
    return rows.join("") || `<div class="battle-input-note">使える呪文はない。</div>`;
  }

  function renderBattleItemOptions(member) {
    const items = Array.isArray(member.items) ? member.items : [];
    const rows = items.map((item, index) => {
      const usable = isBattleUsableItem(item);
      const suffix = usable ? "" : " 未接続";
      return `<button data-action="battle:item:${escapeHtml(index)}" ${usable ? "" : "disabled"}>${escapeHtml(itemDisplayName(item))}${escapeHtml(suffix)}</button>`;
    }).join("");
    return rows || `<div class="battle-input-note">使える道具はない。</div>`;
  }

  function renderBattlePartyTargetButtons(actionPrefix, options = {}) {
    const woundedOnly = Boolean(options.woundedOnly);
    const rows = PARTY_MEMBERS.map((partyMember) => {
      const living = isLivingMember(partyMember);
      const wounded = isWoundedLivingMember(partyMember);
      const disabled = !living || (woundedOnly && !wounded);
      const label = `${partyMember.name} ${partyHpText(partyMember)} ${partyMember.status}`;
      return `<button data-action="${escapeHtml(actionPrefix)}:${escapeHtml(partyMember.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
    if (woundedOnly && !PARTY_MEMBERS.some((partyMember) => isWoundedLivingMember(partyMember))) {
      return `<div class="battle-input-note">回復対象はいない。</div>${rows}`;
    }
    return rows;
  }

  function renderBattleRewardSummary(battle) {
    const reward = battle && battle.reward;
    if (!reward || battle.result !== "won") return "";
    const distributed = Number(reward.eligibleCount || 0);
    const loot = Array.isArray(reward.items) && reward.items.length ? reward.items.join(" / ") : "なし";
    return `
      <div class="battle-reward-summary" aria-label="戦闘報酬">
        <div class="battle-reward-totals">
          <div><span>EXP</span><strong>${escapeHtml(reward.totalXp || 0)}</strong></div>
          <div><span>GOLD</span><strong>${escapeHtml(reward.totalGold || 0)}</strong></div>
        </div>
        <div class="battle-reward-note">${escapeHtml(distributed)}人に配分済み。</div>
        <div class="battle-reward-note">ITEM ${escapeHtml(loot)}</div>
      </div>
    `;
  }

  function renderBattleInputPanel(battle) {
    const entry = currentBattleMemberEntry(battle);
    const member = entry && entry.member;
    if (battle.finished || battle.inputPhase === "battle_result") {
      const title = battle.result === "lost" ? "全滅" : battle.result === "escaped" ? "逃走" : "戦闘終了";
      const note = battle.result === "lost" ? "全員が行動不能になった。" : battle.result === "escaped" ? "隊は戦闘から離脱した。" : "敵を倒した。";
      return `
        <div class="battle-input-title">${escapeHtml(title)}</div>
        <div class="battle-input-note">${escapeHtml(note)}</div>
        ${renderBattleRewardSummary(battle)}
        <div class="battle-command-list"><button data-action="close">閉じる</button></div>
      `;
    }
    if (battle.inputPhase === "round_resolving") {
      return `<div class="battle-input-title">ラウンド処理中</div><div class="battle-input-note">ログを確認してください。</div>`;
    }
    if (battle.inputPhase === "round_confirm") {
      return `
        <div class="battle-input-title">行動を開始</div>
        <div class="battle-input-note">${escapeHtml((battle.actionQueue || []).length)}人分の行動を入力済み。</div>
        <div class="battle-command-list battle-command-grid-2">
          <button data-action="battle:round:start">決定</button>
          <button data-action="battle:back">戻る</button>
        </div>
      `;
    }
    if (!member) {
      return `<div class="battle-input-title">入力不能</div><div class="battle-input-note">行動できる者がいない。</div>`;
    }
    const identity = `${member.name} / ${member.className} / ${member.row === "front" ? "前衛" : "後衛"}`;
    if (battle.inputPhase === "target_select") {
      return `
        <div class="battle-input-title">攻撃対象: ${escapeHtml(identity)}</div>
        <div class="battle-command-list battle-scroll-list battle-command-grid-2">
          ${renderBattleEnemyTargetButtons(battle)}
          <button class="battle-wide-button" data-action="battle:target:back">戻る</button>
        </div>
      `;
    }
    if (battle.inputPhase === "spell_select") {
      return `
        <div class="battle-input-title">呪文選択: ${escapeHtml(identity)}</div>
        <div class="battle-command-list battle-scroll-list battle-command-grid-2">
          ${renderBattleSpellOptions(member)}
          <button class="battle-wide-button" data-action="battle:target:back">戻る</button>
        </div>
      `;
    }
    if (battle.inputPhase === "spell_target_enemy") {
      return `
        <div class="battle-input-title">火花の対象: ${escapeHtml(identity)}</div>
        <div class="battle-command-list battle-scroll-list battle-command-grid-2">
          ${battle.groups.map((group, index) => {
            const alive = group.instances.filter((instance) => instance.currentHp > 0).length;
            if (alive <= 0) return "";
            return `<button data-action="battle:spellTargetEnemy:${escapeHtml(index)}">${escapeHtml(group.label)} x${escapeHtml(alive)}</button>`;
          }).join("")}
          <button class="battle-wide-button" data-action="battle:target:back">戻る</button>
        </div>
      `;
    }
    if (battle.inputPhase === "spell_target_ally") {
      return `
        <div class="battle-input-title">治癒の対象: ${escapeHtml(identity)}</div>
        <div class="battle-command-list battle-scroll-list battle-command-grid-2">
          ${renderBattlePartyTargetButtons("battle:spellTargetAlly", { woundedOnly: true })}
          <button class="battle-wide-button" data-action="battle:target:back">戻る</button>
        </div>
      `;
    }
    if (battle.inputPhase === "item_select") {
      return `
        <div class="battle-input-title">道具選択: ${escapeHtml(identity)}</div>
        <div class="battle-command-list battle-scroll-list battle-command-grid-2">
          ${renderBattleItemOptions(member)}
          <button class="battle-wide-button" data-action="battle:target:back">戻る</button>
        </div>
      `;
    }
    if (battle.inputPhase === "item_target_ally") {
      const itemIndex = battle.commandContext ? battle.commandContext.itemIndex : null;
      const itemName = Number.isFinite(Number(itemIndex)) && Array.isArray(member.items) ? itemDisplayName(member.items[Number(itemIndex)]) : "道具";
      return `
        <div class="battle-input-title">${escapeHtml(itemName)}の対象: ${escapeHtml(identity)}</div>
        <div class="battle-command-list battle-scroll-list battle-command-grid-2">
          ${renderBattlePartyTargetButtons("battle:itemTargetAlly", { woundedOnly: true })}
          <button class="battle-wide-button" data-action="battle:target:back">戻る</button>
        </div>
      `;
    }
    return `
      <div class="battle-input-title">入力: ${escapeHtml(identity)}</div>
      <div class="battle-command-list battle-command-grid-2 battle-main-command-pad">
        <button data-action="battle:cmd:attack">攻撃</button>
        <button data-action="battle:cmd:defend">守る</button>
        <button data-action="battle:cmd:spell" ${canMemberCast(member) ? "" : "disabled"}>呪文</button>
        <button data-action="battle:cmd:item" ${canMemberUseItem(member) ? "" : "disabled"}>道具</button>
        <button data-action="battle:cmd:run">逃げる</button>
        <button data-action="battle:back" ${(battle.actionQueue || []).length ? "" : "disabled"}>戻る</button>
      </div>
    `;
  }

  function handleBattleAction(battle, action) {
    if (!battle) return;
    if (action === "battle:log:close") {
      ensureBattleLogState(battle);
      battle.logPanelOpen = false;
      renderEncounterWindow(battle);
      return;
    }
    if (action === "battle:log:open") {
      ensureBattleLogState(battle);
      battle.logPanelOpen = true;
      renderEncounterWindow(battle);
      return;
    }
    if (action === "battle:back" || action === "battle:target:back") {
      backToPreviousBattleInput(battle);
      renderEncounterWindow(battle);
      return;
    }
    const entry = currentBattleMemberEntry(battle);
    const member = entry && entry.member;
    if (action === "battle:cmd:attack") {
      battle.inputPhase = "target_select";
      battle.commandContext = { command: "attack", characterId: member && member.id };
      renderEncounterWindow(battle);
      return;
    }
    if (action === "battle:cmd:defend" && member) {
      commitBattleAction(battle, { characterId: member.id, command: "defend", targetGroupIndex: null });
      renderEncounterWindow(battle);
      return;
    }
    if (action === "battle:cmd:spell" && member) {
      battle.inputPhase = "spell_select";
      battle.commandContext = { command: "spell", characterId: member.id };
      renderEncounterWindow(battle);
      return;
    }
    if (action === "battle:cmd:item" && member) {
      battle.inputPhase = "item_select";
      battle.commandContext = { command: "item", characterId: member.id };
      renderEncounterWindow(battle);
      return;
    }
    if (action === "battle:cmd:run" && member) {
      battle.inputPhase = "round_confirm";
      battle.commandContext = { command: "run", characterId: member.id };
      battle.actionQueue = [{ characterId: member.id, command: "run", targetGroupIndex: null }];
      renderEncounterWindow(battle);
      return;
    }
    if (action.startsWith("battle:target:") && member) {
      const groupIndexText = action.slice("battle:target:".length);
      const groupIndex = Number(groupIndexText);
      if (Number.isFinite(groupIndex)) {
        commitBattleAction(battle, { characterId: member.id, command: "attack", targetGroupIndex: groupIndex });
        renderEncounterWindow(battle);
      }
      return;
    }
    if (action.startsWith("battle:spell:") && member) {
      const spellId = action.slice("battle:spell:".length);
      if (spellId === "mage1") {
        battle.inputPhase = "spell_target_enemy";
        battle.commandContext = { command: "spell", characterId: member.id, spellId };
      } else if (spellId === "priest1") {
        battle.inputPhase = "spell_target_ally";
        battle.commandContext = { command: "spell", characterId: member.id, spellId };
      } else {
        commitBattleAction(battle, { characterId: member.id, command: "spell", spellId, targetGroupIndex: null, targetMemberId: null });
      }
      renderEncounterWindow(battle);
      return;
    }
    if (action.startsWith("battle:spellTargetEnemy:") && member) {
      const groupIndex = Number(action.slice("battle:spellTargetEnemy:".length));
      const spellId = battle.commandContext && battle.commandContext.spellId ? battle.commandContext.spellId : "mage1";
      if (Number.isFinite(groupIndex)) {
        commitBattleAction(battle, { characterId: member.id, command: "spell", spellId, targetGroupIndex: groupIndex, targetMemberId: null });
        renderEncounterWindow(battle);
      }
      return;
    }
    if (action.startsWith("battle:spellTargetAlly:") && member) {
      const targetMemberId = action.slice("battle:spellTargetAlly:".length);
      const spellId = battle.commandContext && battle.commandContext.spellId ? battle.commandContext.spellId : "priest1";
      commitBattleAction(battle, { characterId: member.id, command: "spell", spellId, targetGroupIndex: null, targetMemberId });
      renderEncounterWindow(battle);
      return;
    }
    if (action.startsWith("battle:item:") && member) {
      const itemIndex = Number(action.slice("battle:item:".length));
      const item = Number.isFinite(itemIndex) && Array.isArray(member.items) ? member.items[itemIndex] : null;
      if (isBattleUsableItem(item)) {
        battle.inputPhase = "item_target_ally";
        battle.commandContext = { command: "item", characterId: member.id, itemIndex };
      } else {
        commitBattleAction(battle, { characterId: member.id, command: "item", itemIndex, targetMemberId: null });
      }
      renderEncounterWindow(battle);
      return;
    }
    if (action.startsWith("battle:itemTargetAlly:") && member) {
      const targetMemberId = action.slice("battle:itemTargetAlly:".length);
      const itemIndex = battle.commandContext ? Number(battle.commandContext.itemIndex) : NaN;
      if (Number.isFinite(itemIndex)) {
        commitBattleAction(battle, { characterId: member.id, command: "item", itemIndex, targetMemberId });
        renderEncounterWindow(battle);
      }
      return;
    }
    if (action === "battle:round:start") {
      battle.inputPhase = "round_resolving";
      const lines = resolveBattleActionQueue(battle);
      lines.forEach((line) => pushBattleLog(battle, line));
      renderEncounterWindow(battle);
    }
  }

  function chooseRandomEncounter() {
    return ENCOUNTER_DEMOS[Math.floor(Math.random() * ENCOUNTER_DEMOS.length)] || ENCOUNTER_DEMOS[0];
  }

  function openEncounterWindow(encounter = null) {
    if (state.eventWindowOpen || state.animation) return;
    state.eventWindowOpen = true;
    const selected = encounter || ENCOUNTER_DEMOS[state.encounterIndex % ENCOUNTER_DEMOS.length];
    if (!encounter) state.encounterIndex += 1;
    state.currentBattle = createBattleFromEncounter(selected);
    renderEncounterWindow(state.currentBattle);
  }

  function canRandomEncounterOnCurrentTile() {
    if (state.eventWindowOpen || state.animation || isPartyDefeated()) return false;
    const tile = tileAt(state.x, state.z);
    if (tile !== TILE.EMPTY) return false;
    if (objectAt(state.x, state.z)) return false;
    return true;
  }

  function maybeOpenRandomEncounterAfterMove() {
    if (!canRandomEncounterOnCurrentTile()) return;
    state.randomEncounterSteps += 1;
    if (state.randomEncounterSteps < RANDOM_ENCOUNTER_MIN_STEPS) return;
    if (Math.random() >= RANDOM_ENCOUNTER_STEP_CHANCE) return;
    state.randomEncounterSteps = 0;
    openEncounterWindow(chooseRandomEncounter());
  }

  function renderEncounterWindow(battle) {
    const overlay = getEventOverlay();
    const enemyCards = buildEnemyCards(battle);
    const inputPanel = renderBattleInputPanel(battle);
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel encounter-window-panel battle-window-v29a" role="dialog" aria-modal="true" aria-label="戦闘画面">
        <button class="event-close-btn panel-close-btn encounter-close-btn" data-action="close" aria-label="閉じる">×</button>
        <div class="encounter-body-frame battle-enemy-frame">
          <div class="encounter-round-line">ROUND ${escapeHtml(battle.round)} / ${escapeHtml(BUILD_VERSION)}</div>
          <div class="encounter-enemy-grid">
            ${enemyCards}
          </div>
        </div>
        <div class="event-party-frame encounter-party-frame battle-party-status-frame" aria-label="パーティ状態">
          ${renderBattlePartyStatus(battle)}
        </div>
        <div class="event-command-frame battle-input-frame" aria-label="戦闘入力">
          ${inputPanel}
        </div>
        ${renderBattleLogPanel(battle)}
      </div>
    `;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        clearBattleLogTimer();
        state.currentBattle = null;
        closeEventWindow();
        return;
      }
      if (action === "battle:log:close" || action === "battle:log:open") {
        handleBattleAction(battle, action);
        return;
      }
      if (isBattleLogActive(battle)) {
        if (!finishBattleLogTyping(battle) && battle.logQueue && battle.logQueue.length) {
          advanceBattleLogQueue(battle);
        }
        return;
      }
      handleBattleAction(battle, action);
    });
    const logFrame = overlay.querySelector("[data-log-skip='true']");
    if (logFrame) {
      const skipLog = (event) => {
        if (event.target && event.target.closest && event.target.closest("[data-action]")) return;
        event.preventDefault();
        event.stopPropagation();
        if (!finishBattleLogTyping(battle) && battle.logQueue && battle.logQueue.length) {
          advanceBattleLogQueue(battle);
        }
      };
      logFrame.addEventListener("pointerdown", skipLog, { passive: false });
      logFrame.addEventListener("touchstart", skipLog, { passive: false });
      logFrame.addEventListener("click", skipLog);
    }
    startBattleLogTyping(battle);
  }

  function openCampWindow() {
    if (state.eventWindowOpen || state.animation) return;
    state.eventWindowOpen = true;
    renderCampWindow("");
  }

  function openFormationWindow() {
    if (state.eventWindowOpen || state.animation) return;
    state.eventWindowOpen = true;
    renderFormationWindow("");
  }

  function renderCampWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel camp-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">キャンプ</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "どうしますか"}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-main-grid camp-main-grid">
          <div class="event-art-frame camp-art-frame" aria-hidden="true">
            <div class="character-rune">CAMP</div>
          </div>
          <div class="event-command-frame">
            <div class="event-command-title">COMMAND</div>
            <div class="event-actions">
              <button data-action="members">メンバーを見る</button>
              <button data-action="formation">隊列</button>
              <button data-action="equipAll">装備</button>
              <button data-action="spells">呪文</button>
              <button data-action="items">アイテム</button>
              <button data-action="close">出る</button>
            </div>
          </div>
        </div>
        <div class="camp-note-frame">
          <span>迷宮内で隊を整える。</span>
        </div>
      </div>`;

    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "members") {
        renderCampMemberSelectWindow("detail");
        return;
      }
      if (action === "formation") {
        renderFormationWindow("");
        return;
      }
      if (action === "equipAll") {
        renderEquipAllWindow();
        return;
      }
      if (action === "spells") {
        renderCampMemberSelectWindow("spells");
        return;
      }
      if (action === "items") {
        renderCampMemberSelectWindow("items");
      }
    });
  }

  function renderCampMemberSelectWindow(mode = "detail") {
    const overlay = getEventOverlay();
    const titleByMode = {
      detail: "メンバーを見る",
      spells: "誰の呪文を見ますか",
      items: "誰のアイテムを見ますか",
    };
    const actionPrefix = mode === "spells" ? "spellMember" : mode === "items" ? "itemMember" : "member";
    const memberButtons = PARTY_MEMBERS.map((member) => `
      <button data-action="${actionPrefix}:${escapeHtml(member.id)}">
        ${escapeHtml(member.name)} <span class="inline-muted">${escapeHtml(member.className)} / HP ${escapeHtml(partyHpText(member))} / AC ${escapeHtml(effectiveMemberAc(member))}</span>
      </button>`).join("");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel camp-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">キャンプ</span>
          <span class="event-prompt">${escapeHtml(titleByMode[mode] || titleByMode.detail)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-command-frame camp-member-frame">
          <div class="event-command-title">MEMBER</div>
          <div class="event-actions camp-member-actions">
            ${memberButtons}
            <button data-action="back">戻る</button>
          </div>
        </div>
      </div>`;

    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "back") {
        renderCampWindow("");
        return;
      }
      if (action.startsWith("member:")) {
        openCharacterWindow(action.slice("member:".length), "campMembers");
        return;
      }
      if (action.startsWith("spellMember:")) {
        renderSpellWindow(action.slice("spellMember:".length));
        return;
      }
      if (action.startsWith("itemMember:")) {
        renderItemWindow(action.slice("itemMember:".length));
      }
    });
  }

  function updateRowsFromPartyOrder() {
    PARTY_MEMBERS.forEach((member, index) => {
      member.row = index < 3 ? "front" : "back";
    });
  }

  function movePartyMember(memberId, direction) {
    const index = PARTY_MEMBERS.findIndex((member) => member.id === memberId);
    if (index < 0) return false;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= PARTY_MEMBERS.length) return false;
    const [member] = PARTY_MEMBERS.splice(index, 1);
    PARTY_MEMBERS.splice(nextIndex, 0, member);
    updateRowsFromPartyOrder();
    renderPartyCards();
    return true;
  }

  function renderFormationWindow(notice = "") {
    const overlay = getEventOverlay();
    const rows = PARTY_MEMBERS.map((member, index) => `
      <div class="formation-row ${member.row === "front" ? "front" : "back"}">
        <span class="formation-pos">${index + 1}</span>
        <span class="formation-name">${escapeHtml(member.name)}</span>
        <span class="formation-class">${escapeHtml(member.className)}</span>
        <span class="formation-line">${member.row === "front" ? "前衛" : "後衛"}</span>
        <button data-action="up:${escapeHtml(member.id)}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button data-action="down:${escapeHtml(member.id)}" ${index === PARTY_MEMBERS.length - 1 ? "disabled" : ""}>↓</button>
      </div>`).join("");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel camp-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">隊列</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "並びを変える"}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="formation-frame">
          <div class="formation-head"><span>POS</span><span>NAME</span><span>CLASS</span><span>ROW</span><span></span><span></span></div>
          ${rows}
        </div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="backToCamp">キャンプへ戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;

    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "backToCamp") {
        renderCampWindow("");
        return;
      }
      if (action.startsWith("up:")) {
        const changed = movePartyMember(action.slice("up:".length), -1);
        renderFormationWindow(changed ? "隊列を変えた。" : "これ以上動かせない。");
        return;
      }
      if (action.startsWith("down:")) {
        const changed = movePartyMember(action.slice("down:".length), 1);
        renderFormationWindow(changed ? "隊列を変えた。" : "これ以上動かせない。");
      }
    });
  }

  function renderEquipAllWindow() {
    const overlay = getEventOverlay();
    const rows = PARTY_MEMBERS.map((member) => `
      <button class="equip-row equip-select-row" data-action="equipMember:${escapeHtml(member.id)}">
        <span>${escapeHtml(member.name)}</span>
        <span>${escapeHtml(member.className)}</span>
        <span>AC ${escapeHtml(effectiveMemberAc(member))}</span>
        <strong>${escapeHtml(equippedItemSummary(member))}</strong>
      </button>`).join("");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel camp-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">装備</span>
          <span class="event-prompt">誰の装備を変えますか</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="equip-frame equip-v29-frame">
          <div class="equip-head equip-v29-head"><span>NAME</span><span>CLS</span><span>AC</span><span>EQUIP</span></div>
          ${rows}
        </div>
        <div class="camp-note-frame"><span>装備変更はメンバーの所持品から行う。</span></div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="backToCamp">キャンプへ戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "backToCamp") {
        renderCampWindow("");
        return;
      }
      if (action.startsWith("equipMember:")) {
        renderItemWindow(action.slice("equipMember:".length), "", "equipAll");
      }
    });
  }

  function renderSpellWindow(memberId) {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const overlay = getEventOverlay();
    const mage = spellLine(member.spells && member.spells.mage);
    const priest = spellLine(member.spells && member.spells.priest);
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">SPELL POINTS</span>
          <span class="event-prompt">${escapeHtml(member.name)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="spell-detail-frame">
          <div class="spell-table-head"><span></span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div>
          <div class="spell-table-row"><span>MAGE</span>${mage.split("/").map((value) => `<strong>${escapeHtml(value)}</strong>`).join("")}</div>
          <div class="spell-table-row"><span>PRIEST</span>${priest.split("/").map((value) => `<strong>${escapeHtml(value)}</strong>`).join("")}</div>
        </div>
        <div class="camp-note-frame"><span>呪文使用はまだ行わない。</span></div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="backToMembers">メンバーへ戻る</button>
            <button data-action="backToCamp">キャンプへ戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") closeEventWindow();
      if (action === "backToMembers") renderCampMemberSelectWindow("spells");
      if (action === "backToCamp") renderCampWindow("");
    });
  }

  function renderItemWindow(memberId, notice = "", returnMode = "items") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const overlay = getEventOverlay();
    const backAction = returnMode === "equipAll" ? "backToEquip" : "backToMembers";
    const backLabel = returnMode === "equipAll" ? "装備一覧へ戻る" : "メンバーへ戻る";
    const itemRows = (member.items || []).map((item, index) => {
      const statusLabel = itemStatusLabel(item);
      const equippedClass = isItemEquipped(item) ? " equipped" : "";
      return `
        <button class="item-row item-select-row${equippedClass}" data-action="itemSelect:${escapeHtml(index)}">
          <span>${index + 1}</span><strong>${escapeHtml(itemDisplayName(item))}</strong><em>${escapeHtml(statusLabel)}</em>
        </button>`;
    }).join("") || `<div class="item-row item-empty-row"><span>-</span><strong>なし</strong><em>-</em></div>`;
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">ITEMS</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : escapeHtml(member.name)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="item-detail-frame item-manage-frame">
          ${itemRows}
        </div>
        <div class="camp-note-frame"><span>道具を選択すると、使用・装備/外す・渡す・捨てるを選べる。</span></div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="${escapeHtml(backAction)}">${escapeHtml(backLabel)}</button>
            <button data-action="backToCamp">キャンプへ戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "backToEquip") {
        renderEquipAllWindow();
        return;
      }
      if (action === "backToMembers") {
        renderCampMemberSelectWindow("items");
        return;
      }
      if (action === "backToCamp") {
        renderCampWindow("");
        return;
      }
      if (action.startsWith("itemSelect:")) {
        renderItemActionWindow(member.id, Number(action.slice("itemSelect:".length)), "", returnMode);
      }
    });
  }

  function renderItemActionWindow(memberId, itemIndex, notice = "", returnMode = "items") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const item = itemAtIndex(member, itemIndex);
    const itemName = itemDisplayName(item);
    if (!item) {
      renderItemWindow(memberId, "道具が見つからない。", returnMode);
      return;
    }
    const overlay = getEventOverlay();
    const usable = isCampUsableItem(item);
    const equipable = isEquipableItem(item);
    const equipped = isItemEquipped(item);
    const definition = itemDefinition(item);
    const equipText = equipped ? "外す" : "装備";
    const equipState = equipable ? (equipped ? "装備中" : "装備可能") : "装備不可";
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">ITEM</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : escapeHtml(itemName)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="item-selected-frame">
          <div><span>OWNER</span><strong>${escapeHtml(member.name)}</strong></div>
          <div><span>ITEM</span><strong>${escapeHtml(itemName)}</strong></div>
          <div><span>TYPE</span><strong>${escapeHtml(definition && definition.slotLabel ? definition.slotLabel : "-")}</strong></div>
          <div><span>USE</span><strong>${usable ? "使用可能" : "未接続"}</strong></div>
          <div><span>EQUIP</span><strong>${escapeHtml(equipState)}</strong></div>
        </div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="use" ${usable ? "" : "disabled"}>使う</button>
            <button data-action="equipToggle" ${equipable ? "" : "disabled"}>${escapeHtml(equipText)}</button>
            <button data-action="give">渡す</button>
            <button data-action="drop">捨てる</button>
            <button data-action="backToItems">戻る</button>
            <button data-action="backToCamp">キャンプへ戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "backToItems") {
        renderItemWindow(member.id, "", returnMode);
        return;
      }
      if (action === "backToCamp") {
        renderCampWindow("");
        return;
      }
      if (action === "use") {
        renderItemUseTargetWindow(member.id, itemIndex, "", returnMode);
        return;
      }
      if (action === "equipToggle") {
        const result = equipMemberItem(member, itemIndex);
        renderItemWindow(member.id, result.notice, returnMode);
        return;
      }
      if (action === "give") {
        renderItemTransferTargetWindow(member.id, itemIndex, "", returnMode);
        return;
      }
      if (action === "drop") {
        renderItemDropConfirmWindow(member.id, itemIndex, returnMode);
      }
    });
  }

  function renderItemUseTargetWindow(memberId, itemIndex, notice = "", returnMode = "items") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const item = itemAtIndex(member, itemIndex);
    const itemName = itemDisplayName(item);
    if (!item) {
      renderItemWindow(memberId, "道具が見つからない。", returnMode);
      return;
    }
    const overlay = getEventOverlay();
    const targetButtons = PARTY_MEMBERS.map((target) => {
      const disabled = !isWoundedLivingMember(target);
      const label = `${target.name} HP ${partyHpText(target)} ${target.status}`;
      return `<button data-action="target:${escapeHtml(target.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
    const targetNotice = notice || (PARTY_MEMBERS.some((target) => isWoundedLivingMember(target)) ? "誰に使いますか" : "回復対象はいない。");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">USE ITEM</span>
          <span class="event-prompt">${escapeHtml(targetNotice)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-command-frame camp-member-frame">
          <div class="event-command-title">${escapeHtml(itemName)}</div>
          <div class="event-actions camp-member-actions">
            ${targetButtons}
            <button data-action="back">戻る</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "back") {
        renderItemActionWindow(member.id, itemIndex, "", returnMode);
        return;
      }
      if (action.startsWith("target:")) {
        const result = useCampItemOnTarget(member, itemIndex, action.slice("target:".length));
        renderItemWindow(member.id, result.notice, returnMode);
      }
    });
  }

  function renderItemTransferTargetWindow(memberId, itemIndex, notice = "", returnMode = "items") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const item = itemAtIndex(member, itemIndex);
    const itemName = itemDisplayName(item);
    if (!item) {
      renderItemWindow(memberId, "道具が見つからない。", returnMode);
      return;
    }
    const overlay = getEventOverlay();
    const targetButtons = PARTY_MEMBERS.map((target) => {
      const disabled = target.id === member.id;
      const label = `${target.name} ${target.className}`;
      return `<button data-action="target:${escapeHtml(target.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">GIVE ITEM</span>
          <span class="event-prompt">${escapeHtml(notice || "誰に渡しますか")}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-command-frame camp-member-frame">
          <div class="event-command-title">${escapeHtml(itemName)}</div>
          <div class="event-actions camp-member-actions">
            ${targetButtons}
            <button data-action="back">戻る</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "back") {
        renderItemActionWindow(member.id, itemIndex, "", returnMode);
        return;
      }
      if (action.startsWith("target:")) {
        const result = transferItemToMember(member, itemIndex, action.slice("target:".length));
        renderItemWindow(member.id, result.notice, returnMode);
      }
    });
  }

  function renderItemDropConfirmWindow(memberId, itemIndex, returnMode = "items") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const item = itemAtIndex(member, itemIndex);
    const itemName = itemDisplayName(item);
    if (!item) {
      renderItemWindow(memberId, "道具が見つからない。", returnMode);
      return;
    }
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">DROP ITEM</span>
          <span class="event-prompt">捨てますか</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="item-selected-frame">
          <div><span>OWNER</span><strong>${escapeHtml(member.name)}</strong></div>
          <div><span>ITEM</span><strong>${escapeHtml(itemName)}</strong></div>
        </div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="confirmDrop">捨てる</button>
            <button data-action="cancel">戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "cancel") {
        renderItemActionWindow(member.id, itemIndex, "", returnMode);
        return;
      }
      if (action === "confirmDrop") {
        const result = dropMemberItem(member, itemIndex);
        renderItemWindow(member.id, result.notice, returnMode);
      }
    });
  }

  function openCharacterWindow(memberId, returnMode = "explore") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    state.eventWindowOpen = true;
    const overlay = getEventOverlay();
    const spellRows = renderSpellPointRows(member);
    const itemRows = (member.items || []).map((item) => `<li>${isItemEquipped(item) ? "[E] " : ""}${escapeHtml(itemDisplayName(item))}</li>`).join("") || `<li>なし</li>`;
    const backButton = returnMode === "campMembers" ? `<button data-action="backToCampMembers">戻る</button>` : "";

    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel compact-status-panel status-detail-v23g-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="character-detail-frame compact-status-frame status-detail-v23g-frame">
          <div class="character-detail-title compact-status-title status-detail-v23g-title">
            <span id="eventWindowTitle">${escapeHtml(member.name)}</span>
            <span>LV ${escapeHtml(member.level)}</span>
            <button class="event-close-btn compact-close-btn" data-action="close" aria-label="閉じる">×</button>
          </div>
          <div class="status-detail-v23g-body">
            <div class="status-detail-v23g-left">
              <div class="status-detail-v23g-list status-detail-v23g-identity">
                <div><span>ALIGN</span><strong>${escapeHtml(member.alignment)}</strong></div>
                <div><span>RACE</span><strong>${escapeHtml(member.race)}</strong></div>
                <div><span>CLASS</span><strong>${escapeHtml(member.className)}</strong></div>
                <div><span>AGE</span><strong>${escapeHtml(member.age ?? "-")}</strong></div>
              </div>
              <div class="status-detail-v23g-list status-detail-v23g-basic">
                <div><span>HITS</span><strong>${escapeHtml(partyHpText(member))}</strong></div>
                <div><span>AC</span><strong>${escapeHtml(effectiveMemberAc(member))}</strong></div>
                <div><span>STATUS</span><strong>${escapeHtml(member.status)}</strong></div>
                <div><span>GOLD</span><strong>${escapeHtml(member.gold)}</strong></div>
                <div><span>EXP</span><strong>${escapeHtml(member.xp ?? 0)}</strong></div>
              </div>
              <div class="status-detail-v23g-list status-detail-v23g-attributes" aria-label="能力値">
                <div><span>STR</span><strong>${escapeHtml(member.stats.str)}</strong></div>
                <div><span>VIT</span><strong>${escapeHtml(member.stats.vit)}</strong></div>
                <div><span>I.Q.</span><strong>${escapeHtml(member.stats.iq)}</strong></div>
                <div><span>AGI</span><strong>${escapeHtml(member.stats.agi)}</strong></div>
                <div><span>PIE</span><strong>${escapeHtml(member.stats.pie)}</strong></div>
                <div><span>LUC</span><strong>${escapeHtml(member.stats.luc)}</strong></div>
              </div>
              <div class="character-section-title status-detail-v23g-spell-title">SPELL POINTS</div>
              <div class="character-spell-grid compact-pair-grid status-detail-v23g-spells">
                ${spellRows}
              </div>
            </div>
            <div class="status-detail-v23g-items" aria-label="所持アイテム">
              <div class="character-section-title status-detail-v23g-items-title">ITEMS</div>
              <ul class="character-item-list compact-item-list status-detail-v23g-item-list">${itemRows}</ul>
            </div>
          </div>
        </div>
        <div class="event-command-frame character-detail-actions compact-status-actions status-detail-v23g-actions">
          <div class="event-actions">
            <button data-action="spell:${escapeHtml(member.id)}">呪文</button>
            <button data-action="items:${escapeHtml(member.id)}">アイテム</button>
            ${backButton}
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;

    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "backToCampMembers") {
        renderCampMemberSelectWindow("detail");
        return;
      }
      if (action.startsWith("spell:")) {
        renderSpellWindow(action.slice("spell:".length));
        return;
      }
      if (action.startsWith("items:")) {
        renderItemWindow(action.slice("items:".length));
      }
    });
  }

  function renderChestWindow(chest, notice = "", mode = "main") {
    let overlay = document.getElementById("eventWindowOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "eventWindowOverlay";
      overlay.className = "event-window-overlay";
      document.body.appendChild(overlay);
    }

    const checked = isChestTrapChecked(chest);
    const disarmed = isChestDisarmed(chest);
    const opened = isChestOpen(chest);
    const key = objectKey(chest);

    const actorButtons = CHEST_ACTORS.map((name) => `<button data-action="actor:${name}">${name}</button>`).join("");
    const disarmButtons = CHEST_ACTORS.map((name) => `<button data-action="disarmActor:${name}">${name}</button>`).join("");
    const mainButtons = opened
      ? `<button data-action="close">離れる</button>`
      : `
        <button data-action="check">調べる</button>
        ${checked && !disarmed ? `<button data-action="disarm">罠を解除する</button>` : ""}
        <button data-action="open">開ける</button>
        <button data-action="close">離れる</button>
      `;

    let title = "宝箱";
    let prompt = notice || "どうしますか";
    let actions = mainButtons;

    if (mode === "chooseInspector") {
      title = "宝箱";
      prompt = "誰が調べますか";
      actions = `${actorButtons}<button data-action="back">戻る</button>`;
    } else if (mode === "chooseDisarmer") {
      title = "宝箱";
      prompt = "誰が解除しますか";
      actions = `${disarmButtons}<button data-action="back">戻る</button>`;
    }

    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">${title}</span>
          <span class="event-prompt">${prompt}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-main-grid">
          <div class="event-art-frame" aria-hidden="true">
            <div class="event-chest-visual ${opened ? "opened" : "closed"}">
              <img class="event-chest-image" src="assets/ui/${opened ? "chest_open.svg" : "chest_closed.svg"}" alt="" />
            </div>
          </div>
          <div class="event-command-frame">
            <div class="event-command-title">COMMAND</div>
            <div class="event-actions">
              ${actions}
            </div>
          </div>
        </div>
        <div class="event-party-frame" aria-hidden="true">
          ${renderEventPartyTable()}
        </div>
      </div>`;

    overlay.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        handleChestAction(chest, button.dataset.action, key);
      }, { passive: false });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  function grantChestLoot(chest) {
    const loot = rollTreasureItems(chest && chest.treasureTableId, 100);
    if (!loot.length) return "中は空だった。";
    const recipient = firstLivingMember();
    loot.forEach((itemName) => addItemToMember(recipient, itemName));
    renderPartyCards();
    return `${recipient ? recipient.name : "隊"}は${loot.join(" / ")}を得た。`;
  }

  function handleChestAction(chest, action, key) {
    if (action === "close") {
      closeEventWindow();
      setMessage("離れた。", false);
      return;
    }
    if (action === "back") {
      renderChestWindow(chest, "", "main");
      return;
    }
    if (action === "check") {
      renderChestWindow(chest, "", "chooseInspector");
      return;
    }
    if (action.startsWith("actor:")) {
      state.checkedChestTraps.add(key);
      renderChestWindow(chest, "罠を発見した。", "main");
      setMessage("調べた。", false);
      return;
    }
    if (action === "disarm") {
      renderChestWindow(chest, "", "chooseDisarmer");
      return;
    }
    if (action.startsWith("disarmActor:")) {
      const actor = action.slice("disarmActor:".length);
      if (actor === CHEST_SPECIALIST) {
        state.disarmedChests.add(key);
        renderChestWindow(chest, "解除した。", "main");
        setMessage("解除した。", false);
      } else {
        renderChestWindow(chest, "解除に失敗した。", "main");
        setMessage("解除に失敗した。", true);
      }
      return;
    }
    if (action === "open") {
      if (!state.disarmedChests.has(key)) {
        renderChestWindow(chest, "開かなかった。", "main");
        return;
      }
      state.openedChests.add(key);
      scene = buildSceneGeometry();
      const lootNotice = grantChestLoot(chest);
      renderChestWindow(chest, `開いた。${lootNotice}`, "main");
      setMessage("宝箱を開けた。", false);
    }
  }

  function resetPosition() {
    if (state.eventWindowOpen || state.animation) return;
    state.x = START_POS.x;
    state.z = START_POS.z;
    state.dir = START_POS.dir;
    visual.x = state.x;
    visual.z = state.z;
    visual.dir = state.dir;
    visual.stepBob = 0;
    visual.turnLean = 0;
    setMessage("初期位置に戻った。", false);
    updateHud();
  }

  function toggleMap() {
    if (state.eventWindowOpen) return;
    state.showMap = !state.showMap;
    renderMapOverlay();
  }

  function toggleTrapDetection() {
    if (state.eventWindowOpen || state.animation) return;
    state.trapDetectionActive = !state.trapDetectionActive;
    scene = buildSceneGeometry();
    renderMapOverlay();
    setMessage(state.trapDetectionActive ? "罠検知を有効にした。" : "罠検知を解除した。", false);
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
    if (tile === TILE.STAIR) setMessage("下り階段がある。", false);
    else if (tile === TILE.EVENT) setMessage("床に紋様がある。", false);
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
      const completedType = a.type;
      visual.x = state.x;
      visual.z = state.z;
      visual.dir = state.dir;
      visual.stepBob = 0;
      visual.turnLean = 0;
      state.animation = null;
      if (completedType === "move") maybeOpenRandomEncounterAfterMove();
    }
  }

  function setMessage(text, isWarning) {
    state.message = text;
    if (!statusToast) return;
    if (statusToastTimer) window.clearTimeout(statusToastTimer);
    if (!text) {
      statusToast.hidden = true;
      statusToast.textContent = "";
      statusToastTimer = 0;
      return;
    }
    statusToast.textContent = text;
    statusToast.classList.toggle("warning", Boolean(isWarning));
    statusToast.hidden = false;
    statusToastTimer = window.setTimeout(() => {
      statusToast.hidden = true;
      statusToastTimer = 0;
    }, isWarning ? 1800 : 1200);
  }

  function updateHud() {
    const floorMeta = FLOOR_META[state.floor];
    const floorLabel = floorMeta ? `${state.floor} ${floorMeta.layer}` : state.floor;
    positionText.textContent = `${floorLabel} x${state.x} y${state.z} ${DIRS[state.dir].label}`;
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
    }
    const lines = map.map((row, z) => row.map((tile, x) => {
      if (state.x === x && state.z === z) return ["▲", "▶", "▼", "◀"][state.dir];
      const obj = objectAt(x, z);
      if (obj) {
        if (obj.type === "trapFloor" && !state.trapDetectionActive) {
          // 未検知の罠床は簡易マップにも表示しない。
        } else {
          return obj.mapChar;
        }
      }
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
    const doorColor = [0.30, 0.20, 0.12];
    const stairColor = [0.62, 0.59, 0.46];
    const markColor = [0.82, 0.65, 0.25];

    for (let z = 0; z < map.length; z++) {
      for (let x = 0; x < map[z].length; x++) {
        const tile = map[z][x];
        const wx = x * CELL;
        const wz = z * CELL;
        const hasStandardFloor = tile !== TILE.WALL && tile !== TILE.STAIR;
        const hasCeiling = tile !== TILE.WALL;

        if (hasStandardFloor) {
          addQuad(g,
            [wx, 0, wz], [wx + CELL, 0, wz], [wx + CELL, 0, wz + CELL], [wx, 0, wz + CELL],
            [0, 1, 0], floorColor, SURFACE.FLOOR, CELL * 0.88, CELL * 0.88);
        }

        if (hasCeiling) {
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
      if (obj.type === "chest") addChest(g, obj.x, obj.z, obj.side, isChestOpen(obj));
      if (obj.type === "lever") addWallLever(g, obj.x, obj.z, obj.side, isLeverActive(obj));
      if (obj.type === "altar") addStoneAltar(g, obj.x, obj.z, obj.side);
      if (obj.type === "statue") addWallStatue(g, obj.x, obj.z, obj.side);
      if (obj.type === "magicCircle") addMagicCircle(g, obj.x, obj.z);
      if (obj.type === "trapFloor" && state.trapDetectionActive) addTrapFloor(g, obj.x, obj.z);
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

    // v08: 扉板・左右枠・上枠をセル中心から対称に配置する。
    // 開いた後も「扉が消える」状態にせず、枠と開放済み扉板を残す。
    const centerX = wx + CELL / 2;
    const centerZ = wz + CELL / 2;
    const frameThickness = CELL * 0.105;
    const panelThickness = CELL * 0.058;
    const frameInset = CELL * 0.105;
    const panelHeight = ROOM_HEIGHT * 0.82;
    const frameHeight = ROOM_HEIGHT * 0.90;
    const y = 0.025;
    const darkDoor = [0.17, 0.105, 0.060];

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

      // v08: 両方の扉板を同じ側へ開く。左右で互い違いに見える配置を避ける。
      const leafDepth = Math.max(halfLeaf, CELL * 0.28);
      const openZ0 = centerZ - leafDepth;
      addCube(g, openingX0, y, openZ0, panelThickness, panelHeight, leafDepth, doorColor, darkDoor, SURFACE.DOOR);
      addCube(g, openingX1 - panelThickness, y, openZ0, panelThickness, panelHeight, leafDepth, doorColor, darkDoor, SURFACE.DOOR);
      // 開扉後に中央へ閂のような横長パーツが残らないよう、中央金具は描画しない。
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

      // v08: 両方の扉板を同じ側へ開く。左右で互い違いに見える配置を避ける。
      const leafDepth = Math.max(halfLeaf, CELL * 0.28);
      const openX0 = centerX - leafDepth;
      addCube(g, openX0, y, openingZ0, leafDepth, panelHeight, panelThickness, doorColor, darkDoor, SURFACE.DOOR);
      addCube(g, openX0, y, openingZ1 - panelThickness, leafDepth, panelHeight, panelThickness, doorColor, darkDoor, SURFACE.DOOR);
      // 開扉後に中央へ閂のような横長パーツが残らないよう、中央金具は描画しない。
    }
  }

  function addStaircase(g, gridX, gridZ, color, darkColor) {
    const wx = gridX * CELL;
    const wz = gridZ * CELL;
    const cx = wx + CELL / 2;
    const cz = wz + CELL / 2;
    const westOpen = tileAt(gridX - 1, gridZ) !== TILE.WALL;
    const eastOpen = tileAt(gridX + 1, gridZ) !== TILE.WALL;
    const northOpen = tileAt(gridX, gridZ - 1) !== TILE.WALL;
    const southOpen = tileAt(gridX, gridZ + 1) !== TILE.WALL;
    const horizontal = (westOpen || eastOpen) && !(northOpen || southOpen);
    const length = CELL * 0.84;
    const width = CELL * 0.58;
    const rim = CELL * 0.10;
    const shaftDepth = 0.44;
    const shadow = [0.035, 0.032, 0.030];
    const shadowDark = [0.012, 0.012, 0.014];
    const sideWall = [0.40, 0.39, 0.35];
    const sideWallDark = [0.24, 0.23, 0.22];
    const floorColor = [0.75, 0.70, 0.62];

    const addFloorStrip = (x0, z0, x1, z1) => {
      if (x1 <= x0 || z1 <= z0) return;
      addQuad(g,
        [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1],
        [0, 1, 0], floorColor, SURFACE.FLOOR, Math.max(x1 - x0, 0.1), Math.max(z1 - z0, 0.1));
    };

    const addDarkQuad = (x0, z0, x1, z1, y) => {
      addQuad(g,
        [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1],
        [0, 1, 0], shadow, SURFACE.PROP, 1, 1);
    };

    if (horizontal) {
      const x0 = cx - length / 2;
      const x1 = cx + length / 2;
      const z0 = cz - width / 2;
      const z1 = cz + width / 2;

      // v08: 階段は床上の台ではなく、床に開いた穴として見せる。
      addFloorStrip(wx, wz, wx + CELL, z0 - rim * 0.25);
      addFloorStrip(wx, z1 + rim * 0.25, wx + CELL, wz + CELL);
      addFloorStrip(wx, z0 - rim * 0.25, x0 - rim * 0.20, z1 + rim * 0.25);
      addFloorStrip(x1 + rim * 0.20, z0 - rim * 0.25, wx + CELL, z1 + rim * 0.25);
      addDarkQuad(x0, z0, x1, z1, -shaftDepth);

      // Side walls below floor level.
      addCube(g, x0, -shaftDepth, z0 - rim * 0.45, length, shaftDepth, rim * 0.45, sideWall, sideWallDark, SURFACE.WALL);
      addCube(g, x0, -shaftDepth, z1, length, shaftDepth, rim * 0.45, sideWall, sideWallDark, SURFACE.WALL);

      const stepCount = 6;
      const stepDepth = length / stepCount;
      for (let i = 0; i < stepCount; i++) {
        const drop = 0.035 + i * 0.052;
        const x = x0 + i * stepDepth;
        addCube(g, x, -drop, z0, stepDepth * 0.96, 0.032, width, color, darkColor, SURFACE.PROP);
      }

      // Dark landing at the bottom end.
      addCube(g, x1 - stepDepth * 0.30, -shaftDepth * 0.88, z0, stepDepth * 0.30, shaftDepth * 0.32, width, shadow, shadowDark, SURFACE.PROP);
    } else {
      const z0 = cz - length / 2;
      const z1 = cz + length / 2;
      const x0 = cx - width / 2;
      const x1 = cx + width / 2;

      addFloorStrip(wx, wz, x0 - rim * 0.25, wz + CELL);
      addFloorStrip(x1 + rim * 0.25, wz, wx + CELL, wz + CELL);
      addFloorStrip(x0 - rim * 0.25, wz, x1 + rim * 0.25, z0 - rim * 0.20);
      addFloorStrip(x0 - rim * 0.25, z1 + rim * 0.20, x1 + rim * 0.25, wz + CELL);
      addDarkQuad(x0, z0, x1, z1, -shaftDepth);

      addCube(g, x0 - rim * 0.45, -shaftDepth, z0, rim * 0.45, shaftDepth, length, sideWall, sideWallDark, SURFACE.WALL);
      addCube(g, x1, -shaftDepth, z0, rim * 0.45, shaftDepth, length, sideWall, sideWallDark, SURFACE.WALL);

      const stepCount = 6;
      const stepDepth = length / stepCount;
      for (let i = 0; i < stepCount; i++) {
        const drop = 0.035 + i * 0.052;
        const z = z0 + i * stepDepth;
        addCube(g, x0, -drop, z, width, 0.032, stepDepth * 0.96, color, darkColor, SURFACE.PROP);
      }

      addCube(g, x0, -shaftDepth * 0.88, z1 - stepDepth * 0.30, width, shaftDepth * 0.32, stepDepth * 0.30, shadow, shadowDark, SURFACE.PROP);
    }
  }

  function sideAdjustedCenter(gridX, gridZ, side, offset) {
    const cx = gridX * CELL + CELL / 2;
    const cz = gridZ * CELL + CELL / 2;
    if (side === "N") return { cx, cz: gridZ * CELL + offset };
    if (side === "S") return { cx, cz: gridZ * CELL + CELL - offset };
    if (side === "W") return { cx: gridX * CELL + offset, cz };
    if (side === "E") return { cx: gridX * CELL + CELL - offset, cz };
    return { cx, cz };
  }

  function addChest(g, gridX, gridZ, side, isOpen) {
    // v06: 通路中央を塞がないよう、宝箱は壁際に寄せて小型化する。
    const p = sideAdjustedCenter(gridX, gridZ, side, CELL * 0.20);
    const horizontal = side === "N" || side === "S";
    const w = horizontal ? CELL * 0.46 : CELL * 0.28;
    const d = horizontal ? CELL * 0.28 : CELL * 0.46;
    const y = 0.040;
    const baseH = ROOM_HEIGHT * 0.14;
    const lidH = ROOM_HEIGHT * 0.052;
    const wood = [0.45, 0.25, 0.12];
    const darkWood = [0.25, 0.13, 0.07];
    const metal = [0.13, 0.12, 0.10];
    const x0 = p.cx - w / 2;
    const z0 = p.cz - d / 2;

    addCube(g, x0, y, z0, w, baseH, d, wood, darkWood, SURFACE.PROP);

    if (horizontal) {
      const frontZ = side === "S" ? z0 : z0 + d - CELL * 0.018;
      addCube(g, x0 - CELL * 0.010, y + baseH * 0.42, frontZ, w + CELL * 0.020, CELL * 0.028, CELL * 0.026, metal, [0.08, 0.075, 0.065], SURFACE.PROP);
      addCube(g, p.cx - CELL * 0.026, y + baseH * 0.12, frontZ - (side === "S" ? CELL * 0.010 : 0), CELL * 0.052, baseH * 0.46, CELL * 0.032, metal, [0.08, 0.075, 0.065], SURFACE.PROP);
    } else {
      const frontX = side === "E" ? x0 : x0 + w - CELL * 0.018;
      addCube(g, frontX, y + baseH * 0.42, z0 - CELL * 0.010, CELL * 0.026, CELL * 0.028, d + CELL * 0.020, metal, [0.08, 0.075, 0.065], SURFACE.PROP);
      addCube(g, frontX - (side === "E" ? CELL * 0.010 : 0), y + baseH * 0.12, p.cz - CELL * 0.026, CELL * 0.032, baseH * 0.46, CELL * 0.052, metal, [0.08, 0.075, 0.065], SURFACE.PROP);
    }

    if (isOpen) {
      if (horizontal) {
        const lidZ = side === "S" ? z0 + d - CELL * 0.035 : z0 - CELL * 0.025;
        addCube(g, x0, y + baseH, lidZ, w, lidH * 2.1, CELL * 0.050, wood, darkWood, SURFACE.PROP);
      } else {
        const lidX = side === "E" ? x0 + w - CELL * 0.035 : x0 - CELL * 0.025;
        addCube(g, lidX, y + baseH, z0, CELL * 0.050, lidH * 2.1, d, wood, darkWood, SURFACE.PROP);
      }
      addCube(g, p.cx - w * 0.22, y + baseH + CELL * 0.015, p.cz - d * 0.20, w * 0.44, CELL * 0.020, d * 0.40, [0.18, 0.14, 0.09], [0.10, 0.08, 0.05], SURFACE.PROP);
    } else {
      addCube(g, x0, y + baseH, z0, w, lidH, d, wood, darkWood, SURFACE.PROP);
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

  function addStoneAltar(g, gridX, gridZ, side) {
    // v06: 石祭壇は通路中央ではなく壁際の低い祠として置く。
    const p = sideAdjustedCenter(gridX, gridZ, side, CELL * 0.18);
    const horizontal = side === "N" || side === "S";
    const stone = [0.52, 0.53, 0.55];
    const dark = [0.36, 0.37, 0.39];
    const accent = [0.72, 0.56, 0.25];
    const w = horizontal ? CELL * 0.62 : CELL * 0.28;
    const d = horizontal ? CELL * 0.28 : CELL * 0.62;
    const x0 = p.cx - w / 2;
    const z0 = p.cz - d / 2;

    addCube(g, x0, 0.020, z0, w, ROOM_HEIGHT * 0.12, d, stone, dark, SURFACE.WALL);
    addCube(g, x0 - CELL * 0.035, ROOM_HEIGHT * 0.14, z0 - CELL * 0.030, w + CELL * 0.070, ROOM_HEIGHT * 0.055, d + CELL * 0.060, [0.58,0.59,0.61], dark, SURFACE.WALL);
    addCube(g, p.cx - CELL * 0.060, ROOM_HEIGHT * 0.205, p.cz - CELL * 0.045, CELL * 0.120, ROOM_HEIGHT * 0.090, CELL * 0.090, [0.40,0.41,0.43], dark, SURFACE.WALL);
    addCube(g, p.cx - CELL * 0.032, ROOM_HEIGHT * 0.302, p.cz - CELL * 0.024, CELL * 0.064, ROOM_HEIGHT * 0.028, CELL * 0.048, accent, [0.42,0.32,0.12], SURFACE.PROP);
  }

  function addWallStatue(g, gridX, gridZ, side) {
    const p = sideAdjustedCenter(gridX, gridZ, side, CELL * 0.13);
    const horizontal = side === "N" || side === "S";
    const stone = [0.40, 0.41, 0.43];
    const dark = [0.24, 0.25, 0.27];
    const base = [0.46, 0.47, 0.49];
    const w = horizontal ? CELL * 0.46 : CELL * 0.20;
    const d = horizontal ? CELL * 0.20 : CELL * 0.46;
    const x0 = p.cx - w / 2;
    const z0 = p.cz - d / 2;
    addCube(g, x0, ROOM_HEIGHT * 0.26, z0, w, ROOM_HEIGHT * 0.08, d, base, dark, SURFACE.WALL);
    addCube(g, p.cx - w * 0.22, ROOM_HEIGHT * 0.34, p.cz - d * 0.22, w * 0.44, ROOM_HEIGHT * 0.34, d * 0.44, stone, dark, SURFACE.WALL);
    addCube(g, p.cx - w * 0.14, ROOM_HEIGHT * 0.70, p.cz - d * 0.14, w * 0.28, ROOM_HEIGHT * 0.16, d * 0.28, stone, dark, SURFACE.WALL);
    addCube(g, x0 - w * 0.10, ROOM_HEIGHT * 0.31, z0 - d * 0.10, w * 1.20, ROOM_HEIGHT * 0.03, d * 1.20, base, dark, SURFACE.WALL);
  }

  function addMagicCircle(g, gridX, gridZ) {
    const cx = gridX * CELL + CELL / 2;
    const cz = gridZ * CELL + CELL / 2;
    const color = [0.34, 0.28, 0.12];
    const y = 0.022;
    const r = CELL * 0.36;
    addQuad(g, [cx - r, y, cz], [cx, y, cz - r], [cx + r, y, cz], [cx, y, cz + r], [0,1,0], color, SURFACE.MARK, 1, 1);
    addQuad(g, [cx - r * 0.62, y + 0.002, cz - r * 0.62], [cx + r * 0.62, y + 0.002, cz - r * 0.62], [cx + r * 0.62, y + 0.002, cz + r * 0.62], [cx - r * 0.62, y + 0.002, cz + r * 0.62], [0,1,0], [0.16,0.13,0.07], SURFACE.MARK, 1, 1);
  }

  function addTrapFloor(g, gridX, gridZ) {
    const wx = gridX * CELL;
    const wz = gridZ * CELL;
    const y = 0.028;
    const glow = [0.42, 0.78, 0.90];
    const pale = [0.62, 0.90, 1.00];
    addQuad(g, [wx + CELL * 0.18, y, wz + CELL * 0.18], [wx + CELL * 0.82, y, wz + CELL * 0.18], [wx + CELL * 0.82, y, wz + CELL * 0.82], [wx + CELL * 0.18, y, wz + CELL * 0.82], [0,1,0], [0.08,0.16,0.20], SURFACE.MARK, 1, 1);
    addCube(g, wx + CELL * 0.18, y + 0.002, wz + CELL * 0.46, CELL * 0.58, CELL * 0.006, CELL * 0.040, glow, pale, SURFACE.MARK);
    addCube(g, wx + CELL * 0.46, y + 0.004, wz + CELL * 0.20, CELL * 0.040, CELL * 0.006, CELL * 0.36, glow, pale, SURFACE.MARK);
    addCube(g, wx + CELL * 0.32, y + 0.006, wz + CELL * 0.64, CELL * 0.040, CELL * 0.006, CELL * 0.24, pale, glow, SURFACE.MARK);
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
    if (!el) {
      console.warn(`操作ボタンが見つかりません: ${id}`);
      return;
    }
    if (typeof handler !== "function") {
      console.warn(`操作ハンドラが無効です: ${id}`);
      return;
    }
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
  bindButton("detectTrapBtn", toggleTrapDetection);
  bindButton("campBtn", openCampWindow);
  bindButton("formationBtn", openFormationWindow);
  bindButton("encounterBtn", openEncounterWindow);

  window.addEventListener("keydown", (event) => {
    const key = event.key;
    if (state.eventWindowOpen) {
      if (key === "Escape") closeEventWindow();
      event.preventDefault();
      return;
    }
    const lower = key.length === 1 ? key.toLowerCase() : key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(key)) event.preventDefault();
    if (key === "ArrowUp" || lower === "w") moveForward(1);
    if (key === "ArrowDown" || lower === "s") moveForward(-1);
    if (key === "ArrowLeft" || lower === "a") turn(-1);
    if (key === "ArrowRight" || lower === "d") turn(1);
    if (key === " " || key === "Enter") inspectFront();
  });

  normalizePartyEquipment();
  renderPartyCards();
  if (state.message) setMessage(state.message, false);
  updateHud();
  requestAnimationFrame(render);
})();
