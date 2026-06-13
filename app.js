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
  // v29bではキャンプ系ウィンドウのフォントサイズをステータス詳細画面のサイズ感に寄せる。
  // v30ではキャンプ内でPRIEST 治癒を使用できるようにする。
  // v31では所持品上限、全状態異常の基盤、宝箱の罠種別選択を接続する。
  // v32では戦闘勝利後の戦利品を宝箱・罠処理へ接続する。
  // v33aではキャンプ機能を整理し、ASLEEP/AFRAIDは戦闘終了時回復に寄せる。
  // town_impl_v01では街機能仕様v01eに合わせ、街施設の最小実処理と中断/遭難/救助状態を接続する。
  // ENCOUNTER_DEMOS は実機確認用の一時的なUIデモデータであり、正本の遭遇テーブルではない。
  // データファイル data/encounters_v23.json / data/enemy_definitions_v23.json は参照用として同梱しているが、
  // v28時点の画面表示は外部JSON読み込みではなく、このローカル定数を使う。
  const START_POS = { x: 9, z: 10, dir: 3 };

  const BUILD_VERSION = "town_impl_v01";
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
  const ITEM_CAPACITY_PER_MEMBER = 10;
  const RANDOM_ENCOUNTER_MIN_STEPS = 4;
  const RANDOM_ENCOUNTER_STEP_CHANCE = 0.16;
  const LEVEL_XP_THRESHOLDS = [0, 60, 160, 320, 560, 900];
  const MAX_PARTY_SIZE = 6;
  const RACE_MIN_STATS = {
    HUM: { str: 8, iq: 8, pie: 5, vit: 8, agi: 8, luc: 9 },
    ELF: { str: 7, iq: 10, pie: 10, vit: 6, agi: 9, luc: 6 },
    DWF: { str: 10, iq: 7, pie: 10, vit: 10, agi: 5, luc: 6 },
    GNM: { str: 7, iq: 7, pie: 10, vit: 8, agi: 10, luc: 7 },
    HOB: { str: 5, iq: 7, pie: 7, vit: 6, agi: 10, luc: 15 },
  };
  const INN_ROOMS = [
    { id: "stable", name: "馬小屋", hpPerWeek: 0, costPerWeek: 0, term: "1週固定" },
    { id: "barracks", name: "大部屋", hpPerWeek: 1, costPerWeek: 10, term: "必要週数" },
    { id: "double", name: "二人部屋", hpPerWeek: 3, costPerWeek: 50, term: "必要週数" },
    { id: "private", name: "個室", hpPerWeek: 7, costPerWeek: 200, term: "必要週数" },
    { id: "royal", name: "王室", hpPerWeek: 10, costPerWeek: 500, term: "必要週数" },
  ];
  const SHOP_CATALOG = [
    { item: "HEALING HERB", price: 20 },
    { item: "DAGGER", price: 35 },
    { item: "SMALL KNIFE", price: 45 },
    { item: "LEATHER ARMOR", price: 80 },
  ];
  const BATTLE_PARTY_ACTION_MARKS = { current: "▶", queued: "✓", waiting: "-", unable: "×" };
  const STATUS_DEFINITIONS = {
    OK: { label: "OK", alive: true, canAct: true, canTarget: true, canHealHp: true, canReceiveReward: true, stepDamage: 0 },
    POISONED: { label: "POISON", alive: true, canAct: true, canTarget: true, canHealHp: true, canReceiveReward: true, stepDamage: 1 },
    ASLEEP: { label: "SLEEP", alive: true, canAct: false, canTarget: true, canHealHp: true, canReceiveReward: false, stepDamage: 0 },
    AFRAID: { label: "AFRAID", alive: true, canAct: false, canTarget: true, canHealHp: true, canReceiveReward: false, stepDamage: 0 },
    PARALYZED: { label: "PARALYZE", alive: true, canAct: false, canTarget: true, canHealHp: false, canReceiveReward: false, stepDamage: 0 },
    STONED: { label: "STONE", alive: true, canAct: false, canTarget: true, canHealHp: false, canReceiveReward: false, stepDamage: 0 },
    OUT: { label: "OUT", alive: false, canAct: false, canTarget: false, canHealHp: false, canReceiveReward: false, stepDamage: 0 },
    DEAD: { label: "DEAD", alive: false, canAct: false, canTarget: false, canHealHp: false, canReceiveReward: false, stepDamage: 0 },
    ASHES: { label: "ASHES", alive: false, canAct: false, canTarget: false, canHealHp: false, canReceiveReward: false, stepDamage: 0 },
    LOST: { label: "LOST", alive: false, canAct: false, canTarget: false, canHealHp: false, canReceiveReward: false, stepDamage: 0 },
  };
  const STATUS_ORDER = ["OK", "POISONED", "ASLEEP", "AFRAID", "PARALYZED", "STONED", "OUT", "DEAD", "ASHES", "LOST"];
  const TEMPORARY_STATUS_KEYS = ["ASLEEP", "AFRAID"];
  const CAMP_PRIEST_SPELLS = [
    { id: "heal", levelIndex: 0, levelLabel: "PRIEST 1", name: "治癒", kind: "hp", targetStatus: null, note: "負傷を回復する。" },
    { id: "curePoison", levelIndex: 1, levelLabel: "PRIEST 2", name: "毒消し", kind: "status", targetStatus: "POISONED", note: "毒を取り除く。" },
    { id: "cureParalysis", levelIndex: 2, levelLabel: "PRIEST 3", name: "麻痺回復", kind: "status", targetStatus: "PARALYZED", note: "麻痺を解く。" },
    { id: "cureStone", levelIndex: 3, levelLabel: "PRIEST 4", name: "石化解除", kind: "status", targetStatus: "STONED", note: "石化を解く。" },
    { id: "reviveOut", levelIndex: 4, levelLabel: "PRIEST 5", name: "気付け", kind: "revive", targetStatus: "OUT", successRate: 100, failureStatus: "OUT", note: "OUTから復帰させる。" },
    { id: "raiseDead", levelIndex: 4, levelLabel: "PRIEST 5", name: "蘇生", kind: "revive", targetStatus: "DEAD", successRate: 70, failureStatus: "ASHES", note: "失敗すると灰化する。" },
    { id: "raiseAshes", levelIndex: 6, levelLabel: "PRIEST 7", name: "灰から蘇生", kind: "revive", targetStatus: "ASHES", successRate: 55, failureStatus: "LOST", note: "失敗するとロストする。" },
  ];
  const DUNGEON_TRAPS = [
    { id: "poison_needle", label: "毒針", difficulty: 48, effect: "poison_actor", description: "解除者または開封者を毒にする。" },
    { id: "poison_gas", label: "毒煙", difficulty: 54, effect: "poison_party", description: "生存者を毒にする。" },
    { id: "needle_volley", label: "針の雨", difficulty: 56, effect: "needle_party", description: "生存者全体に小ダメージ。" },
    { id: "paralysis_wire", label: "麻痺針", difficulty: 58, effect: "paralyze_actor", description: "解除者または開封者を麻痺させる。" },
    { id: "stone_mist", label: "石化の霧", difficulty: 66, effect: "stone_actor", description: "解除者または開封者を石化させる。" },
    { id: "crossbow_bolt", label: "石弓", difficulty: 44, effect: "bolt_actor", description: "解除者または開封者にダメージ。" },
    { id: "explosion", label: "爆発", difficulty: 62, effect: "blast_party", description: "パーティ全体にダメージ。" },
    { id: "ashes_curse", label: "灰化の呪い", difficulty: 72, effect: "ashes_actor", description: "解除者または開封者を灰にする。" },
    { id: "lost_seal", label: "喪失の封印", difficulty: 84, effect: "lost_actor", description: "解除者または開封者をロストさせる。" },
  ];
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
  let nextBattleInstanceSeq = 1;

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
    { id: "chest01", type: "chest", x: 8, z: 10, side: "S", blocking: false, mapChar: "C", treasureTableId: "shallow_chest_basic", trapId: "poison_needle" },
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
    chestStates: new Map(),
    activatedLevers: new Set(),
    trapDetectionActive: false,
    eventWindowOpen: false,
    showMap: false,
    animation: null,
    message: "",
    encounterIndex: 0,
    randomEncounterSteps: 0,
    currentBattle: null,
    focus: "town",
    adventurers: PARTY_MEMBERS.slice(),
    parties: [{
      id: "party-town-1",
      name: "第1パーティー",
      memberIds: PARTY_MEMBERS.map((member) => member.id),
      status: "IN_TOWN",
      floor: null,
      x: null,
      z: null,
      dir: null,
      objective: "NORMAL",
    }],
    activePartyId: null,
    currentTownPartyId: "party-town-1",
    suspendedParties: [],
    strandedRecords: [],
    nextAdventurerSeq: 1,
    nextPartySeq: 2,
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
    if (!ensurePartyCanActOrShow("全員が行動不能で、移動できない。")) return;
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
    if (!ensurePartyCanActOrShow("全員が行動不能で、向きを変えられない。")) return;
    const ndir = (state.dir + delta + 4) % 4;
    startTurnAnimation(ndir, delta);
  }

  function inspectFront() {
    if (state.eventWindowOpen || state.animation) return;
    if (!ensurePartyCanActOrShow("全員が行動不能で、調べられない。")) return;

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

  function clampNumber(min, max, value) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }

  function randomChoice(items) {
    const list = Array.isArray(items) ? items : [];
    return list[Math.floor(Math.random() * list.length)];
  }

  function initializeTownState() {
    state.adventurers.forEach((member) => {
      if (!member.location) member.location = { type: "PARTY", partyId: state.currentTownPartyId };
      if (!Number.isFinite(Number(member.ageDays))) member.ageDays = Math.max(0, Number(member.age || 18)) * 365;
      if (!member.knownSpells) member.knownSpells = { mage: [], priest: [] };
      if (!member.carriedFromStrandedId) member.carriedFromStrandedId = null;
    });
    syncPartyMembersToCurrentTownParty();
  }

  function getAdventurerById(id) {
    return state.adventurers.find((member) => member.id === id) || null;
  }

  function getPartyById(id) {
    return state.parties.find((party) => party.id === id) || null;
  }

  function activeParty() {
    const party = getPartyById(state.activePartyId);
    return party && party.status === "ACTIVE" ? party : null;
  }

  function activePartyMembers() {
    const party = activeParty();
    return party ? party.memberIds.map(getAdventurerById).filter(Boolean) : PARTY_MEMBERS;
  }

  function currentTownParty() {
    let party = getPartyById(state.currentTownPartyId);
    if (!party || party.status !== "IN_TOWN") {
      party = state.parties.find((item) => item.status === "IN_TOWN") || createTownParty();
      state.currentTownPartyId = party.id;
    }
    return party;
  }

  function currentTownPartyMembers() {
    const party = currentTownParty();
    return party.memberIds.map(getAdventurerById).filter(Boolean);
  }

  function syncPartyMembersToParty(party) {
    const members = party ? party.memberIds.map(getAdventurerById).filter(Boolean) : [];
    PARTY_MEMBERS.splice(0, PARTY_MEMBERS.length, ...members);
    updateRowsFromPartyOrder();
    renderPartyCards();
  }

  function syncPartyMembersToActiveParty() {
    syncPartyMembersToParty(activeParty());
  }

  function syncPartyMembersToCurrentTownParty() {
    syncPartyMembersToParty(currentTownParty());
  }

  function createTownParty(objective = state.strandedRecords.length ? "RESCUE" : "NORMAL") {
    const party = {
      id: `party-${state.nextPartySeq++}`,
      name: `街パーティー${state.nextPartySeq - 1}`,
      memberIds: [],
      status: "IN_TOWN",
      floor: null,
      x: null,
      z: null,
      dir: null,
      objective,
    };
    state.parties.push(party);
    state.currentTownPartyId = party.id;
    return party;
  }

  function createEmptyTownPartyAndFocus(objective = state.strandedRecords.length ? "RESCUE" : "NORMAL") {
    const existing = state.parties.find((party) => party.status === "IN_TOWN");
    const party = existing || createTownParty(objective);
    state.currentTownPartyId = party.id;
    state.activePartyId = null;
    state.focus = "town";
    syncPartyMembersToParty(party);
    return party;
  }

  function townAdventurers() {
    return state.adventurers.filter((member) => member.location && member.location.type === "TOWN" && normalizeStatusKey(member.status) !== "LOST");
  }

  function isTownPartyMember(member) {
    const party = currentTownParty();
    return Boolean(member && party.memberIds.includes(member.id));
  }

  function isInTownFacilityLocation(member, includeRecovered = true) {
    if (!member || !member.location) return false;
    if (member.location.type === "TOWN") return true;
    if (member.location.type === "PARTY" && isTownPartyMember(member)) return true;
    return includeRecovered && member.location.type === "RECOVERED";
  }

  function tavernAddCandidates() {
    return townAdventurers();
  }

  function innCandidates() {
    const allowed = new Set(["OK", "POISONED", "AFRAID", "ASLEEP", "OUT"]);
    return state.adventurers.filter((member) => isInTownFacilityLocation(member, true) && allowed.has(normalizeStatusKey(member.status)));
  }

  function templeCandidates() {
    const allowed = new Set(["PARALYZED", "STONED", "DEAD", "ASHES"]);
    return state.adventurers.filter((member) => isInTownFacilityLocation(member, true) && allowed.has(normalizeStatusKey(member.status)));
  }

  function payerCandidates() {
    const allowed = new Set(["OK", "POISONED"]);
    return currentTownPartyMembers().filter((member) => allowed.has(normalizeStatusKey(member.status)) && normalizeStatusKey(member.status) !== "LOST");
  }

  function shopCandidates() {
    return payerCandidates();
  }

  function memberAgeText(member) {
    const days = Number.isFinite(Number(member && member.ageDays)) ? Number(member.ageDays) : Number(member && member.age || 0) * 365;
    const years = Math.floor(days / 365);
    const weeks = Math.floor((days % 365) / 7);
    return `${years}歳 ${weeks}週`;
  }

  function ageMemberDays(member, days) {
    if (!member) return;
    member.ageDays = Math.max(0, Number(member.ageDays || 0) + Math.max(0, Number(days || 0)));
    member.age = Math.floor(member.ageDays / 365);
  }

  function setMemberLocation(member, location) {
    if (!member) return;
    member.location = location;
    if (location.type === "LOST") {
      member.carriedFromStrandedId = null;
      setMemberStatus(member, "LOST");
    }
  }

  function distributeTownPartyGoldEvenly() {
    const members = currentTownPartyMembers();
    if (!members.length) return { ok: false, notice: "分配する街パーティーがありません。" };
    const total = members.reduce((sum, member) => sum + Number(member.gold || 0), 0);
    const base = Math.floor(total / members.length);
    let rest = total % members.length;
    members.forEach((member) => {
      member.gold = base + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
    });
    return { ok: true, notice: `${members.length}人に ${total}G を均等配分した。` };
  }

  function gatherTownPartyGoldTo(memberId) {
    const members = currentTownPartyMembers();
    const receiver = members.find((member) => member.id === memberId);
    if (!receiver) return { ok: false, notice: "受取先が現在街パーティーにいません。" };
    const total = members.reduce((sum, member) => sum + Number(member.gold || 0), 0);
    members.forEach((member) => { member.gold = member.id === receiver.id ? total : 0; });
    return { ok: true, notice: `${receiver.name}に ${total}G を集めた。` };
  }

  function addMemberToTownParty(memberId) {
    const party = currentTownParty();
    const member = getAdventurerById(memberId);
    if (!member || !tavernAddCandidates().includes(member)) return { ok: false, notice: "加えられる冒険者ではありません。" };
    if (party.memberIds.length >= MAX_PARTY_SIZE) return { ok: false, notice: "パーティーは6人までです。" };
    party.memberIds.push(member.id);
    setMemberLocation(member, { type: "PARTY", partyId: party.id });
    syncPartyMembersToParty(party);
    return { ok: true, notice: `${member.name}を加えた。` };
  }

  function removeMemberFromTownParty(memberId) {
    const party = currentTownParty();
    const member = getAdventurerById(memberId);
    if (!member || !party.memberIds.includes(member.id)) return { ok: false, notice: "外せるメンバーではありません。" };
    party.memberIds = party.memberIds.filter((id) => id !== member.id);
    setMemberLocation(member, { type: "TOWN" });
    syncPartyMembersToParty(party);
    return { ok: true, notice: `${member.name}を外した。` };
  }

  function disbandCurrentTownParty() {
    const party = currentTownParty();
    party.memberIds.forEach((id) => setMemberLocation(getAdventurerById(id), { type: "TOWN" }));
    party.memberIds = [];
    party.status = "DISBANDED";
    const next = createTownParty();
    syncPartyMembersToParty(next);
    return { ok: true, notice: "街パーティーを解散した。" };
  }

  function normalizeStatusKey(status) {
    const key = String(status || "OK").toUpperCase();
    if (key === "DOWN") return "DEAD";
    return STATUS_DEFINITIONS[key] ? key : "OK";
  }

  function statusDefinition(status) {
    return STATUS_DEFINITIONS[normalizeStatusKey(status)] || STATUS_DEFINITIONS.OK;
  }

  function statusLabel(memberOrStatus) {
    const status = typeof memberOrStatus === "string" ? memberOrStatus : memberOrStatus && memberOrStatus.status;
    return statusDefinition(status).label;
  }

  function setMemberStatus(member, status) {
    if (!member) return;
    member.status = normalizeStatusKey(status);
    if (!statusDefinition(member.status).alive) member.hp = 0;
  }

  function isMemberAlive(member) {
    return Boolean(member && statusDefinition(member.status).alive && Number(member.hp || 0) > 0);
  }

  function canMemberAct(member) {
    return Boolean(isMemberAlive(member) && statusDefinition(member.status).canAct);
  }

  function canMemberBeTargeted(member) {
    return Boolean(member && statusDefinition(member.status).canTarget && Number(member.hp || 0) > 0);
  }

  function canMemberReceiveHpHealing(member) {
    return Boolean(isMemberAlive(member) && statusDefinition(member.status).canHealHp);
  }

  function canMemberReceiveReward(member) {
    return Boolean(isMemberAlive(member) && statusDefinition(member.status).canReceiveReward);
  }

  function normalizePartyStatuses() {
    PARTY_MEMBERS.forEach((member) => {
      member.status = normalizeStatusKey(member.status);
      if (!statusDefinition(member.status).alive) member.hp = 0;
    });
  }

  function applyDamageToMember(member, amount, defeatStatus = "DEAD") {
    if (!member || !canMemberBeTargeted(member)) return 0;
    const damage = Math.max(0, Number(amount || 0));
    member.hp = Math.max(0, Number(member.hp || 0) - damage);
    if (member.hp <= 0) setMemberStatus(member, defeatStatus);
    return damage;
  }

  function applyStatusToMember(member, status) {
    if (!member || !status) return false;
    const key = normalizeStatusKey(status);
    if (key === "OK") {
      member.status = "OK";
      if (Number(member.hp || 0) <= 0) member.hp = 1;
      return true;
    }
    if (!statusDefinition(key).alive || isMemberAlive(member)) {
      setMemberStatus(member, key);
      return true;
    }
    return false;
  }

  function memberItemCount(member) {
    return Array.isArray(member && member.items) ? member.items.length : 0;
  }

  function memberFreeItemSlots(member) {
    return Math.max(0, ITEM_CAPACITY_PER_MEMBER - memberItemCount(member));
  }

  function hasItemCapacity(member, count = 1) {
    return Boolean(member && memberFreeItemSlots(member) >= Math.max(1, Number(count || 1)));
  }

  function livingOrRecoverablePartyMembers() {
    return PARTY_MEMBERS.filter((member) => statusDefinition(member.status).alive && Number(member.hp || 0) > 0);
  }

  function actionablePartyMembers() {
    return PARTY_MEMBERS.filter((member) => canMemberAct(member));
  }

  function targetablePartyMembers() {
    return PARTY_MEMBERS.filter((member) => canMemberBeTargeted(member));
  }

  function applyDungeonStepStatusEffects() {
    const lines = [];
    PARTY_MEMBERS.forEach((member) => {
      const def = statusDefinition(member.status);
      const damage = Number(def.stepDamage || 0);
      if (damage > 0 && isMemberAlive(member)) {
        applyDamageToMember(member, damage, "DEAD");
        if (member.status === "DEAD") lines.push(`${member.name}は毒で倒れた。`);
        else lines.push(`${member.name}は毒で${damage}のダメージ。`);
      }
    });
    if (lines.length) renderPartyCards();
    return lines;
  }

  function trapById(trapId) {
    return DUNGEON_TRAPS.find((trap) => trap.id === trapId) || DUNGEON_TRAPS[0];
  }

  function trapLabel(trapId) {
    const trap = trapById(trapId);
    return trap ? trap.label : "不明な罠";
  }

  function randomTrapId(exceptId = "") {
    const candidates = DUNGEON_TRAPS.filter((trap) => trap.id !== exceptId);
    const table = candidates.length ? candidates : DUNGEON_TRAPS;
    return table[Math.floor(Math.random() * table.length)].id;
  }

  function memberTrapSkill(member) {
    if (!member) return 0;
    const agi = Number((member.stats && member.stats.agi) || 10);
    const luc = Number((member.stats && member.stats.luc) || 10);
    let bonus = Math.floor((agi + luc) / 2);
    if (member.className === "THI") bonus += 35;
    else if (member.className === "NIN") bonus += 28;
    else if (member.className === "BIS") bonus += 10;
    else bonus += 2;
    return bonus;
  }

  function trapCheckRoll(member, difficulty) {
    const roll = rollRange(1, 100);
    const score = roll + memberTrapSkill(member);
    return { roll, score, ok: score >= Number(difficulty || 50) };
  }

  function getChestRuntimeState(chest, key = objectKey(chest)) {
    if (!state.chestStates.has(key)) {
      state.chestStates.set(key, {
        key,
        trapId: chest && chest.trapId ? chest.trapId : randomTrapId(),
        checked: state.checkedChestTraps.has(key),
        disarmed: state.disarmedChests.has(key),
        opened: state.openedChests.has(key),
        suspectedTrapId: null,
        pendingDisarmerId: null,
        pendingLoot: null,
        trapTriggered: false,
      });
    }
    const chestState = state.chestStates.get(key);
    chestState.opened = chestState.opened || state.openedChests.has(key);
    chestState.disarmed = chestState.disarmed || state.disarmedChests.has(key);
    chestState.checked = chestState.checked || state.checkedChestTraps.has(key);
    return chestState;
  }

  function setChestChecked(key, chestState) {
    chestState.checked = true;
    state.checkedChestTraps.add(key);
  }

  function setChestDisarmed(key, chestState) {
    chestState.disarmed = true;
    state.disarmedChests.add(key);
  }

  function setChestOpened(key, chestState) {
    chestState.opened = true;
    state.openedChests.add(key);
  }

  function applyTrapEffect(trapId, actor, context = "trap") {
    const trap = trapById(trapId);
    const lines = [];
    const activeTargets = targetablePartyMembers();
    const chosenActor = actor && canMemberBeTargeted(actor) ? actor : (activeTargets[0] || null);
    if (!trap) return ["罠が作動した。"];
    lines.push(`${trap.label}が作動した。`);
    if (trap.effect === "poison_actor") {
      if (chosenActor) { applyStatusToMember(chosenActor, "POISONED"); lines.push(`${chosenActor.name}は毒を受けた。`); }
    } else if (trap.effect === "poison_party") {
      activeTargets.forEach((member) => { applyStatusToMember(member, "POISONED"); lines.push(`${member.name}は毒を受けた。`); });
    } else if (trap.effect === "needle_party") {
      activeTargets.forEach((member) => {
        const damage = Math.max(1, rollDice("1d3") + 1);
        applyDamageToMember(member, damage, "DEAD");
        lines.push(`${member.name}は${damage}のダメージ。`);
      });
    } else if (trap.effect === "paralyze_actor") {
      if (chosenActor) { applyStatusToMember(chosenActor, "PARALYZED"); lines.push(`${chosenActor.name}は麻痺した。`); }
    } else if (trap.effect === "stone_actor") {
      if (chosenActor) { applyStatusToMember(chosenActor, "STONED"); lines.push(`${chosenActor.name}は石化した。`); }
    } else if (trap.effect === "bolt_actor") {
      if (chosenActor) {
        const damage = Math.max(1, rollDice("1d8") + 2);
        applyDamageToMember(chosenActor, damage, "DEAD");
        lines.push(`${chosenActor.name}は${damage}のダメージ。`);
      }
    } else if (trap.effect === "blast_party") {
      activeTargets.forEach((member) => {
        const damage = Math.max(1, rollDice("1d6") + 1);
        applyDamageToMember(member, damage, "DEAD");
        lines.push(`${member.name}は${damage}のダメージ。`);
      });
    } else if (trap.effect === "ashes_actor") {
      if (chosenActor) { applyStatusToMember(chosenActor, "ASHES"); lines.push(`${chosenActor.name}は灰になった。`); }
    } else if (trap.effect === "lost_actor") {
      if (chosenActor) { applyStatusToMember(chosenActor, "LOST"); lines.push(`${chosenActor.name}は失われた。`); }
    }
    renderPartyCards();
    if (actionablePartyMembers().length === 0) {
      lines.push("パーティは全員行動不能になった。");
    }
    return lines;
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
        <span class="party-card-line party-card-status"><span>${escapeHtml(member.row === "front" ? "前衛" : "後衛")}</span><span>${escapeHtml(statusLabel(member))}</span></span>
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
        <div class="event-party-row"><span>${escapeHtml(member.name)}</span><span>${escapeHtml(member.className)}</span><span>${escapeHtml(partyHpText(member))}</span><span>${escapeHtml(effectiveMemberAc(member))}</span><span>${escapeHtml(statusLabel(member))}</span></div>
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

  function rollRange(range, maxArg = null) {
    if (Number.isFinite(Number(range)) && Number.isFinite(Number(maxArg))) {
      const min = Math.floor(Number(range));
      const max = Math.max(min, Math.floor(Number(maxArg)));
      return min + Math.floor(Math.random() * (max - min + 1));
    }
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
    return isMemberAlive(member);
  }

  function isWoundedLivingMember(member) {
    return Boolean(canMemberReceiveHpHealing(member) && Number(member.hp || 0) < Number(member.maxHp || 0));
  }

  function isBattleUsableItem(item) {
    return itemDisplayName(item) === "HEALING HERB";
  }

  function isCampUsableItem(item) {
    return itemDisplayName(item) === "HEALING HERB";
  }

  function campPriestSpellById(spellId) {
    return CAMP_PRIEST_SPELLS.find((spell) => spell.id === spellId) || null;
  }

  function priestSpellPoints(member) {
    return member && member.spells && Array.isArray(member.spells.priest) ? member.spells.priest : [];
  }

  function canSpendPriestSpellPoint(member, levelIndex) {
    const points = priestSpellPoints(member);
    return Number(points[levelIndex] || 0) > 0;
  }

  function spendPriestSpellPoint(member, levelIndex) {
    const points = priestSpellPoints(member);
    points[levelIndex] = Math.max(0, Number(points[levelIndex] || 0) - 1);
  }

  function memberMatchesCampSpellTarget(member, spell) {
    if (!member || !spell) return false;
    const status = normalizeStatusKey(member.status);
    if (spell.kind === "hp") return isWoundedLivingMember(member);
    if (spell.kind === "status") {
      if (status !== spell.targetStatus) return false;
      return statusDefinition(status).alive ? Number(member.hp || 0) > 0 : true;
    }
    if (spell.kind === "statusAny") {
      if (!Array.isArray(spell.targetStatuses) || !spell.targetStatuses.includes(status)) return false;
      return statusDefinition(status).alive ? Number(member.hp || 0) > 0 : true;
    }
    if (spell.kind === "revive") return status === spell.targetStatus;
    return false;
  }

  function campSpellTargets(spell) {
    return PARTY_MEMBERS.filter((member) => memberMatchesCampSpellTarget(member, spell));
  }

  function canCastCampPriestSpell(member, spell) {
    return Boolean(canMemberAct(member) && spell && canSpendPriestSpellPoint(member, spell.levelIndex));
  }

  function campPriestSpellStatus(member, spell) {
    if (!spell) return "未定義";
    if (!canMemberAct(member)) return "術者行動不可";
    if (!canSpendPriestSpellPoint(member, spell.levelIndex)) return "回数なし";
    if (!campSpellTargets(spell).length) return "対象なし";
    return "使用可能";
  }

  function canCastCampPriestHeal(member) {
    return canCastCampPriestSpell(member, campPriestSpellById("heal"));
  }

  function hasCampPriestHealTarget() {
    return PARTY_MEMBERS.some((member) => isWoundedLivingMember(member));
  }

  function campPriestHealTargetNotice() {
    return hasCampPriestHealTarget() ? "誰を治癒しますか" : "回復対象はいない。";
  }

  function useCampPriestSpell(caster, spellId, targetMemberId) {
    const spell = campPriestSpellById(spellId);
    if (!caster) return { ok: false, notice: "術者が見つからない。" };
    if (!spell) return { ok: false, notice: "呪文が見つからない。" };
    if (!canMemberAct(caster)) return { ok: false, notice: `${caster.name}は呪文を使えない。` };
    if (!canSpendPriestSpellPoint(caster, spell.levelIndex)) return { ok: false, notice: `${caster.name}は${spell.levelLabel} ${spell.name}を使えない。` };
    const target = findPartyMember(targetMemberId);
    if (!memberMatchesCampSpellTarget(target, spell)) return { ok: false, notice: "対象を回復できない。" };

    spendPriestSpellPoint(caster, spell.levelIndex);
    let notice = "";
    if (spell.kind === "hp") {
      const pieBonus = Math.max(0, Math.floor((Number((caster.stats && caster.stats.pie) || 10) - 10) / 3));
      const amount = Math.max(1, rollDice("1d8") + 2 + pieBonus);
      target.hp = Math.min(Number(target.maxHp || 1), Number(target.hp || 0) + amount);
      notice = `${caster.name}は${target.name}を${amount}回復した。`;
    } else if (spell.kind === "status" || spell.kind === "statusAny") {
      const beforeStatus = normalizeStatusKey(target.status);
      applyStatusToMember(target, "OK");
      notice = `${caster.name}は${target.name}の${statusLabel(spell.targetStatus || beforeStatus)}を解いた。`;
    } else if (spell.kind === "revive") {
      const rate = Math.max(0, Math.min(100, Number(spell.successRate || 0)));
      const success = rate >= 100 || rollRange(1, 100) <= rate;
      if (success) {
        applyStatusToMember(target, "OK");
        target.hp = Math.max(1, Math.min(Number(target.maxHp || 1), Math.floor(Number(target.maxHp || 1) / 2) || 1));
        notice = `${caster.name}は${target.name}を復帰させた。`;
      } else {
        applyStatusToMember(target, spell.failureStatus || target.status);
        notice = `${caster.name}は${target.name}の復帰に失敗した。${target.name}は${statusLabel(target)}になった。`;
      }
    }
    renderPartyCards();
    return { ok: true, notice };
  }

  function useCampPriestHeal(caster, targetMemberId) {
    return useCampPriestSpell(caster, "heal", targetMemberId);
  }

  function recoverTemporaryStatusesAfterBattle() {
    const recovered = [];
    PARTY_MEMBERS.forEach((member) => {
      const status = normalizeStatusKey(member.status);
      if (TEMPORARY_STATUS_KEYS.includes(status) && Number(member.hp || 0) > 0) {
        applyStatusToMember(member, "OK");
        recovered.push(member.name);
      }
    });
    if (recovered.length) renderPartyCards();
    return recovered.length ? [`${recovered.join(" / ")}は戦闘終了で行動可能になった。`] : [];
  }

  function partyStatusSummaryRows() {
    return PARTY_MEMBERS.map((member) => `
      <div class="return-party-row"><span>${escapeHtml(member.name)}</span><span>HP ${escapeHtml(partyHpText(member))}</span><strong>${escapeHtml(statusLabel(member))}</strong></div>
    `).join("");
  }

  function currentPartyLocationSnapshot() {
    return {
      floor: state.floor,
      x: state.x,
      z: state.z,
      dir: state.dir,
      memberIds: PARTY_MEMBERS.map((member) => member.id),
      memberNames: PARTY_MEMBERS.map((member) => member.name),
      memberStatuses: PARTY_MEMBERS.map((member) => ({ id: member.id, name: member.name, status: normalizeStatusKey(member.status), hp: Number(member.hp || 0) })),
    };
  }

  function currentPartyStrandedKey(snapshot) {
    const base = snapshot || currentPartyLocationSnapshot();
    return `${base.floor}:${base.x}:${base.z}:${base.memberIds.join("|")}`;
  }

  function recordCurrentPartyStranded(reason = "全員行動不能") {
    if (actionablePartyMembers().length) return null;
    const party = activeParty() || getPartyById(state.activePartyId);
    const snapshot = currentPartyLocationSnapshot();
    const key = currentPartyStrandedKey(snapshot);
    const existing = state.strandedRecords.find((record) => record.key === key);
    if (existing) {
      existing.reason = existing.reason || reason;
      existing.status = existing.status || "未回収";
      return existing;
    }
    const record = {
      id: `stranded-${Date.now()}`,
      key,
      floor: snapshot.floor,
      x: snapshot.x,
      z: snapshot.z,
      dir: snapshot.dir,
      memberIds: snapshot.memberIds,
      memberNames: snapshot.memberNames,
      memberStatuses: snapshot.memberStatuses,
      remainingMemberIds: snapshot.memberIds.slice(),
      carriedMemberIds: [],
      status: "未回収",
      reason,
    };
    state.strandedRecords.push(record);
    if (party) {
      party.status = "STRANDED";
      party.floor = snapshot.floor;
      party.x = snapshot.x;
      party.z = snapshot.z;
      party.dir = snapshot.dir;
      party.memberIds.forEach((id) => setMemberLocation(getAdventurerById(id), { type: "STRANDED", strandedId: record.id }));
    }
    state.activePartyId = null;
    return record;
  }

  function partyReturnAssessment() {
    const lost = PARTY_MEMBERS.filter((member) => normalizeStatusKey(member.status) === "LOST");
    return {
      canReturn: false,
      lostCount: lost.length,
      recoverableCount: PARTY_MEMBERS.length - lost.length,
      summary: lost.length ? `${lost.length}人はLOST。街機能実装後に回収可否を扱う。` : "街機能実装後に救出・寺院処理へ接続する。",
    };
  }

  function renderPartyIncapacitatedWindow(notice = "") {
    recordCurrentPartyStranded(notice || "全員行動不能");
    state.eventWindowOpen = true;
    const overlay = getEventOverlay();
    const assessment = partyReturnAssessment();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel return-window-panel party-incapacitated-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">全員行動不能</span>
          <span class="event-prompt">${escapeHtml(notice || "パーティはこれ以上行動できない。")}</span>
        </div>
        <div class="return-summary-frame">
          <div class="return-summary-line">${escapeHtml(assessment.summary)}</div>
          <div class="return-party-list">${partyStatusSummaryRows()}</div>
        </div>
        <div class="camp-note-frame"><span>全滅時の自動帰還は行わない。救助隊がキャンプの周辺探索で発見する。</span></div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions"><button data-action="close">閉じる</button></div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        createEmptyTownPartyAndFocus("RESCUE");
        openTownWindow("パーティーは迷宮内に残された。救助隊を編成してください。");
      }
    });
  }

  function ensurePartyCanActOrShow(notice = "パーティは行動できない。") {
    if (actionablePartyMembers().length) return true;
    renderPartyIncapacitatedWindow(notice);
    return false;
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
    if (!canMemberReceiveHpHealing(target)) return { ok: false, notice: "対象を回復できない。" };
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
    if (!hasItemCapacity(target, 1)) return { ok: false, notice: `${target.name}はこれ以上持てない。` };
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
    if (!hasItemCapacity(member, 1)) return false;
    if (item && typeof item === "object" && item.name) {
      item.equippedSlot = null;
      if (!item.instanceId) item.instanceId = `item-${nextItemInstanceSeq++}`;
      member.items.push(item);
      return true;
    }
    member.items.push(createItemInstance(item));
    return true;
  }

  function addItemsToMember(member, items) {
    const list = Array.isArray(items) ? items : [];
    if (!member || !hasItemCapacity(member, list.length)) return { ok: false, accepted: [], rejected: list.slice() };
    const accepted = [];
    list.forEach((itemName) => {
      if (addItemToMember(member, itemName)) accepted.push(itemName);
    });
    return { ok: accepted.length === list.length, accepted, rejected: list.slice(accepted.length) };
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
      instanceId: `battle-${nextBattleInstanceSeq++}`,
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
    return PARTY_MEMBERS.map((member, index) => ({ member, index })).filter(({ member }) => canMemberAct(member));
  }

  function normalizeBattleInputIndex(battle) {
    if (!battle) return;
    const members = battleActionableMembers();
    if (!members.length) {
      battle.inputIndex = 0;
      battle.inputPhase = "battle_result";
      battle.finished = true;
      battle.result = battle.result || "lost";
      return;
    }
    battle.inputIndex = Math.max(0, Math.min(Number(battle.inputIndex || 0), members.length - 1));
  }

  function currentBattleMemberEntry(battle) {
    normalizeBattleInputIndex(battle);
    return battleActionableMembers()[battle.inputIndex] || null;
  }

  function canMemberCast(member) {
    if (!member || !canMemberAct(member) || !member.spells) return false;
    return hasSpellPoints(member.spells.mage) || hasSpellPoints(member.spells.priest);
  }

  function canMemberUseItem(member) {
    return Boolean(member && canMemberAct(member) && Array.isArray(member.items) && member.items.some((item) => isBattleUsableItem(item)));
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
    if (!member || !canMemberAct(member)) return BATTLE_PARTY_ACTION_MARKS.unable;
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
    return PARTY_MEMBERS.filter((member) => canMemberReceiveReward(member));
  }

  function isPartyDefeated() {
    return actionablePartyMembers().length === 0;
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
    const living = targetablePartyMembers();
    const front = living.filter((member) => member.row === "front");
    const candidates = front.length ? front : living;
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function isMemberDefending(actionSet, memberId) {
    return Boolean(actionSet && actionSet.has(memberId));
  }

  function setMemberDown(member) {
    setMemberStatus(member, "DEAD");
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

  function spellSlotsForMember(member, school) {
    if (!member) return [0,0,0,0,0,0,0];
    const level = Math.max(1, Number(member.level || 1));
    const slots = [0,0,0,0,0,0,0];
    const className = member.className;
    const canUse = school === "mage"
      ? className === "MAG" || className === "BIS"
      : className === "PRI" || className === "BIS";
    if (!canUse) return slots;
    slots[0] = Math.max(1, Math.min(9, Math.ceil(level / 2)));
    if (level >= 5) slots[1] = Math.max(1, Math.floor((level - 3) / 3));
    if (level >= 9) slots[2] = 1;
    return slots;
  }

  function restoreMemberSpellUses(member) {
    if (!member) return;
    if (!member.spells) member.spells = { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] };
    const currentMage = Array.isArray(member.spells.mage) ? member.spells.mage : [];
    const currentPriest = Array.isArray(member.spells.priest) ? member.spells.priest : [];
    member.spells.mage = spellSlotsForMember(member, "mage").map((value, index) => Math.max(value, Number(currentMage[index] || 0)));
    member.spells.priest = spellSlotsForMember(member, "priest").map((value, index) => Math.max(value, Number(currentPriest[index] || 0)));
  }

  function tryApplyLevelUp(member) {
    const lines = [];
    if (!member) return lines;
    const next = xpForNextLevel(member);
    if (next !== null && Number(member.xp || 0) >= next) {
      member.level = Number(member.level || 1) + 1;
      const hpGain = Math.max(2, rollDice(member.className === "FIG" ? "1d8" : member.className === "THI" ? "1d6" : "1d4"));
      member.maxHp = Number(member.maxHp || 1) + hpGain;
      member.hp = member.maxHp;
      if (!member.spells) member.spells = { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] };
      if (member.className === "PRI" || member.className === "BIS") {
        member.spells.priest[0] = Number(member.spells.priest[0] || 0) + 1;
      }
      if (member.className === "MAG" || member.className === "BIS") {
        member.spells.mage[0] = Number(member.spells.mage[0] || 0) + 1;
      }
      restoreMemberSpellUses(member);
      lines.push(`${member.name}はLV ${member.level}になった。`);
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
    });

    lines.unshift(`${recipients.length}人に配分した。`);
    lines.unshift(`GOLD ${battle.reward.totalGold} を得た。`);
    lines.unshift(`EXP ${battle.reward.totalXp} を得た。`);

    const loot = Array.isArray(battle.reward.items) ? battle.reward.items : [];
    battle.reward.hasTreasureChest = loot.length > 0;
    if (loot.length) {
      lines.push("宝箱が残されている。罠を調べてから開けるべきだ。");
    } else {
      lines.push("宝箱は見つからなかった。");
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
    applyDamageToMember(target, damage, "DEAD");
    if (target.hp <= 0 || target.status === "DEAD") {
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
      const runner = PARTY_MEMBERS.find((item) => item.id === runAction.characterId && canMemberAct(item));
      lines.push(resolveEscapeAttempt(battle, runner));
    } else {
      for (const action of queue) {
        if (battle.finished) break;
        const member = PARTY_MEMBERS.find((item) => item.id === action.characterId);
        if (!member || !canMemberAct(member)) {
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
          lines.push(...recoverTemporaryStatusesAfterBattle());
          lines.push(...applyBattleVictoryRewards(battle));
          break;
        }
      }
    }
    if (battle.finished && battle.result !== "won") {
      lines.push(...recoverTemporaryStatusesAfterBattle());
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
          <span class="battle-party-status">${escapeHtml(statusLabel(member))}</span>
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
      const label = `${partyMember.name} ${partyHpText(partyMember)} ${statusLabel(partyMember)}`;
      return `<button data-action="${escapeHtml(actionPrefix)}:${escapeHtml(partyMember.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
    if (woundedOnly && !PARTY_MEMBERS.some((partyMember) => isWoundedLivingMember(partyMember))) {
      return `<div class="battle-input-note">回復対象はいない。</div>${rows}`;
    }
    return rows;
  }

  function createPostBattleChest(battle) {
    if (!battle || !battle.reward || !Array.isArray(battle.reward.items) || !battle.reward.items.length) return null;
    if (battle.reward.postBattleChest) return battle.reward.postBattleChest;
    battle.reward.postBattleChest = {
      id: `${battle.instanceId || battle.id || "battle"}-treasure`,
      type: "battleChest",
      source: "battle",
      treasureTableId: null,
      trapId: battle.reward.trapId || randomTrapId(),
      fixedLoot: battle.reward.items.slice(),
    };
    return battle.reward.postBattleChest;
  }

  function postBattleChestState(battle) {
    const chest = createPostBattleChest(battle);
    if (!chest) return null;
    return getChestRuntimeState(chest, objectKey(chest));
  }

  function isPostBattleChestPending(battle) {
    const chestState = postBattleChestState(battle);
    return Boolean(chestState && !chestState.opened);
  }

  function openPostBattleChest(battle) {
    const chest = createPostBattleChest(battle);
    if (!chest) return false;
    const chestState = getChestRuntimeState(chest, objectKey(chest));
    if (!Array.isArray(chestState.pendingLoot)) chestState.pendingLoot = chest.fixedLoot.slice();
    renderChestWindow(chest, "戦闘後の宝箱だ。どうしますか", "main");
    return true;
  }

  function renderBattleRewardSummary(battle) {
    const reward = battle && battle.reward;
    if (!reward || battle.result !== "won") return "";
    const distributed = Number(reward.eligibleCount || 0);
    const loot = Array.isArray(reward.items) && reward.items.length ? reward.items.join(" / ") : "なし";
    let chestStatus = "なし";
    const chestState = postBattleChestState(battle);
    if (chestState) {
      chestStatus = chestState.opened ? "開封済み" : chestState.disarmed ? "解除済み" : chestState.checked ? "調査済み" : "未開封";
    }
    return `
      <div class="battle-reward-summary" aria-label="戦闘報酬">
        <div class="battle-reward-totals">
          <div><span>EXP</span><strong>${escapeHtml(reward.totalXp || 0)}</strong></div>
          <div><span>GOLD</span><strong>${escapeHtml(reward.totalGold || 0)}</strong></div>
        </div>
        <div class="battle-reward-note">${escapeHtml(distributed)}人に配分済み。</div>
        <div class="battle-reward-note">CHEST ${escapeHtml(chestStatus)}</div>
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
      const pendingChest = battle.result === "won" && isPostBattleChestPending(battle);
      const resultButtons = battle.result === "lost"
        ? `<button data-action="close">その場に残る</button>`
        : pendingChest
          ? `<button data-action="battle:postChest">宝箱へ</button><button data-action="close">立ち去る</button>`
          : `<button data-action="close">探索へ戻る</button>`;
      return `
        <div class="battle-input-title">${escapeHtml(title)}</div>
        <div class="battle-input-note">${escapeHtml(note)}</div>
        ${renderBattleRewardSummary(battle)}
        <div class="battle-command-list">${resultButtons}</div>
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
    if (action === "battle:postChest") {
      openPostBattleChest(battle);
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
    if (!ensurePartyCanActOrShow("全員が行動不能で、戦闘できない。")) return;
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
      <div class="event-window-panel wizardry-event-panel encounter-window-panel battle-window-v34b" role="dialog" aria-modal="true" aria-label="戦闘画面">
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
        if (battle && battle.finished && battle.result === "lost") {
          renderPartyIncapacitatedWindow("パーティは迷宮内に残された。救出隊が必要になる。");
          return;
        }
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


  function currentDungeonPositionText() {
    return `${state.floor} x${state.x} y${state.z} ${DIRS[state.dir].label}`;
  }

  function townPartyRows(options = {}) {
    const compact = Boolean(options.compact);
    const members = currentTownPartyMembers();
    if (!members.length) return `<div class="town-empty-row">編成中のメンバーはいません。</div>`;
    return members.map((member, index) => `
      <div class="town-party-row">
        <span>${escapeHtml(index + 1)}</span>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.className)}</span>
        <span>HP ${escapeHtml(partyHpText(member))}</span>
        <span>${escapeHtml(statusLabel(member))}</span>
        ${compact ? "" : `<span>${escapeHtml(member.row === "front" ? "前" : "後")}</span>`}
      </div>`).join("");
  }

  function townRosterRows() {
    return state.adventurers.map((member) => `
      <button class="town-roster-row" data-action="trainingDetail:${escapeHtml(member.id)}">
        <span>${escapeHtml(member.name)}</span>
        <span>${escapeHtml(member.race)} ${escapeHtml(member.className)}</span>
        <span>LV ${escapeHtml(member.level)}</span>
        <strong>${escapeHtml(statusLabel(member))} / ${escapeHtml(member.location ? member.location.type : "TOWN")}</strong>
      </button>`).join("");
  }


  function suspendedPartyRows() {
    const parties = state.parties.filter((party) => party.status === "SUSPENDED");
    if (!parties.length) {
      return `<div class="town-empty-row">休止中の冒険はありません。</div>`;
    }
    return parties.map((party) => `
      <button class="town-list-row" data-action="resumeParty:${escapeHtml(party.id)}">
        <span>${escapeHtml(party.floor)} x${escapeHtml(party.x)} y${escapeHtml(party.z)} ${escapeHtml(DIRS[party.dir].label)}</span>
        <strong>${escapeHtml(party.memberIds.map((id) => getAdventurerById(id)).filter(Boolean).map((member) => member.name).join("・"))}</strong>
        <em>再開</em>
      </button>`).join("");
  }

  function strandedPartyRows() {
    if (!state.strandedRecords.length) {
      return `<div class="town-empty-row">迷宮内に記録された全滅・遭難パーティーはありません。</div>`;
    }
    return state.strandedRecords.map((party) => `
      <div class="town-static-row">
        <span>${escapeHtml(party.floor)} x${escapeHtml(party.x)} y${escapeHtml(party.z)}</span>
        <strong>${escapeHtml((party.remainingMemberIds || []).map((id) => getAdventurerById(id)).filter(Boolean).map((member) => member.name).join("・") || party.memberNames.join("・"))}</strong>
        <em>${escapeHtml(party.status || "未回収")} / 搬送中 ${escapeHtml((party.carriedMemberIds || []).length)}</em>
      </div>`).join("");
  }

  function openTownWindow(notice = "") {
    state.eventWindowOpen = true;
    state.focus = "town";
    renderTownWindow(notice);
  }

  function enterDungeonFromTown(notice = "迷宮へ入った。") {
    const party = currentTownParty();
    if (!party.memberIds.length) {
      renderTownWindow("迷宮へ入るには街パーティーに1人以上必要です。");
      return;
    }
    party.status = "ACTIVE";
    party.floor = party.floor || "B1F";
    party.x = Number.isFinite(Number(party.x)) ? party.x : START_POS.x;
    party.z = Number.isFinite(Number(party.z)) ? party.z : START_POS.z;
    party.dir = Number.isFinite(Number(party.dir)) ? party.dir : START_POS.dir;
    party.memberIds.forEach((id) => setMemberLocation(getAdventurerById(id), { type: "PARTY", partyId: party.id }));
    state.activePartyId = party.id;
    state.currentTownPartyId = null;
    state.floor = party.floor;
    state.x = party.x;
    state.z = party.z;
    state.dir = party.dir;
    visual.x = state.x;
    visual.z = state.z;
    visual.dir = state.dir;
    syncPartyMembersToParty(party);
    state.focus = "dungeon";
    closeEventWindow();
    setMessage(notice, true);
    updateHud();
    renderPartyCards();
  }

  function suspendCurrentAdventure() {
    const party = activeParty();
    if (!party) {
      openTownWindow("中断できる迷宮内パーティーがありません。");
      return;
    }
    party.status = "SUSPENDED";
    party.floor = state.floor;
    party.x = state.x;
    party.z = state.z;
    party.dir = state.dir;
    party.memberIds.forEach((id) => setMemberLocation(getAdventurerById(id), { type: "SUSPENDED", partyId: party.id }));
    if (!state.suspendedParties.includes(party.id)) state.suspendedParties.push(party.id);
    state.activePartyId = null;
    createEmptyTownPartyAndFocus(state.strandedRecords.length ? "RESCUE" : "NORMAL");
    openTownWindow("冒険を中断した。パーティーは迷宮内の現在位置に留まっている。");
  }

  function resumeSuspendedParty(partyId) {
    const party = getPartyById(partyId);
    if (!party || party.status !== "SUSPENDED") {
      renderResumeAdventureWindow("再開できる冒険が見つからない。");
      return;
    }
    party.status = "ACTIVE";
    party.memberIds.forEach((id) => setMemberLocation(getAdventurerById(id), { type: "PARTY", partyId: party.id }));
    state.activePartyId = party.id;
    state.currentTownPartyId = null;
    state.floor = party.floor;
    state.x = party.x;
    state.z = party.z;
    state.dir = party.dir;
    visual.x = state.x;
    visual.z = state.z;
    visual.dir = state.dir;
    state.suspendedParties = state.suspendedParties.filter((id) => id !== partyId);
    syncPartyMembersToParty(party);
    state.focus = "dungeon";
    closeEventWindow();
    setMessage("冒険を再開した。", true);
    updateHud();
    renderPartyCards();
  }

  function townSelectableMemberRows(actionPrefix, options = {}) {
    const showGold = options.showGold !== false;
    const showStatus = options.showStatus !== false;
    const members = options.members || currentTownPartyMembers();
    if (!members.length) return `<div class="town-empty-row">対象者がいません。</div>`;
    return members.map((member) => `
      <button class="town-roster-row" data-action="${escapeHtml(actionPrefix)}:${escapeHtml(member.id)}">
        <span>${escapeHtml(member.name)}</span>
        <span>${escapeHtml(member.className)} LV ${escapeHtml(member.level)}</span>
        ${showStatus ? `<span>${escapeHtml(statusLabel(member))}</span>` : ""}
        ${showGold ? `<strong>${escapeHtml(member.gold || 0)} G</strong>` : ""}
      </button>`).join("");
  }

  function renderTownWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">街</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "どこへ行きますか"}</span>
        </div>
        <div class="event-main-grid camp-main-grid town-main-grid">
          <div class="event-art-frame camp-art-frame town-art-frame" aria-hidden="true">
            <div class="character-rune">TOWN</div>
          </div>
          <div class="event-command-frame">
            <div class="event-command-title">FACILITY</div>
            <div class="event-actions">
              <button data-action="tavern">酒場</button>
              <button data-action="training">訓練場</button>
              <button data-action="inn">宿屋</button>
              <button data-action="temple">寺院</button>
              <button data-action="shop">商店</button>
              <button data-action="resume">冒険を再開する</button>
              <button data-action="stranded">遭難記録</button>
              <button data-action="enterDungeon">迷宮へ</button>
            </div>
          </div>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">CURRENT PARTY</div>
          <div class="town-party-head"><span>#</span><span>NAME</span><span>CLS</span><span>HITS</span><span>ST</span><span>ROW</span></div>
          ${townPartyRows()}
        </div>
        <div class="camp-note-frame town-note-frame"><span>街は操作フォーカスの拠点であり、全滅パーティーを自動回収しない。酒場は編成、訓練場は個人管理。宿屋・商店は個人単位、寺院は処置対象と支払者を分ける。</span></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "tavern") { renderTavernWindow(); return; }
      if (action === "training") {
        if (currentTownPartyMembers().length) renderTrainingGroundDisbandConfirmWindow();
        else renderTrainingGroundWindow();
        return;
      }
      if (action === "inn") { renderInnWindow(); return; }
      if (action === "temple") { renderTempleWindow(); return; }
      if (action === "shop") { renderShopWindow(); return; }
      if (action === "resume") { renderResumeAdventureWindow(); return; }
      if (action === "stranded") { renderStrandedRecordWindow(); return; }
      if (action === "enterDungeon") {
        const members = currentTownPartyMembers();
        if (members.length >= MAX_PARTY_SIZE && state.strandedRecords.some((record) => (record.remainingMemberIds || []).length)) {
          enterDungeonFromTown("救助対象を連れ帰る空き枠がありません。通常探索として迷宮へ入った。");
          return;
        }
        enterDungeonFromTown();
      }
    });
  }

  function renderTavernWindow(notice = "") {
    const overlay = getEventOverlay();
    const addRows = tavernAddCandidates().map((member) => `
      <button class="town-roster-row" data-action="tavernAddMember:${escapeHtml(member.id)}">
        <span>${escapeHtml(member.name)}</span><span>${escapeHtml(member.race)} ${escapeHtml(member.className)}</span><span>LV ${escapeHtml(member.level)}</span><strong>${escapeHtml(member.gold || 0)}G</strong>
      </button>`).join("") || `<div class="town-empty-row">街で待機中の加入候補はいません。</div>`;
    const removeRows = currentTownPartyMembers().map((member) => `
      <button class="town-roster-row" data-action="tavernRemoveMember:${escapeHtml(member.id)}">
        <span>${escapeHtml(member.name)}</span><span>${escapeHtml(member.className)}</span><span>HP ${escapeHtml(partyHpText(member))}</span><strong>外す</strong>
      </button>`).join("") || `<div class="town-empty-row">外せるメンバーはいません。</div>`;
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">酒場</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "パーティーを編成する"}</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">CURRENT PARTY</div>
          <div class="town-party-head"><span>#</span><span>NAME</span><span>CLS</span><span>HITS</span><span>ST</span><span>ROW</span></div>
          ${townPartyRows()}
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">ADVENTURERS IN TOWN</div>
          <div class="town-roster-list">${addRows}</div>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">REMOVE FROM PARTY</div>
          <div class="town-roster-list">${removeRows}</div>
        </div>
        <div class="event-command-frame character-detail-actions town-actions-frame">
          <div class="event-actions">
            <button data-action="tavernAdd">加える</button>
            <button data-action="tavernRemove">外す</button>
            <button data-action="tavernGold">金を分配する</button>
            <button data-action="tavernDisband">パーティーを解散する</button>
            <button data-action="backToTown">街へ戻る</button>
          </div>
        </div>
        <div class="camp-note-frame town-note-frame"><span>酒場は編成施設。金を分配するは均等配分。訓練場の新規作成・転職・削除とは混同しない。</span></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action === "tavernAdd") { renderTavernWindow("下の加入候補から冒険者を選んでください。"); return; }
      if (action === "tavernRemove") { renderTavernWindow("下のCURRENT PARTYから外す相手を選んでください。"); return; }
      if (action === "tavernGold") { const result = distributeTownPartyGoldEvenly(); renderTavernWindow(result.notice); return; }
      if (action === "tavernDisband") { const result = disbandCurrentTownParty(); renderTavernWindow(result.notice); return; }
      if (action.startsWith("tavernAddMember:")) { const result = addMemberToTownParty(action.slice("tavernAddMember:".length)); renderTavernWindow(result.notice); return; }
      if (action.startsWith("tavernRemoveMember:")) { const result = removeMemberFromTownParty(action.slice("tavernRemoveMember:".length)); renderTavernWindow(result.notice); return; }
    });
  }

  function createTrainingAdventurer() {
    const seq = state.nextAdventurerSeq++;
    const member = {
      id: `adventurer-${Date.now()}-${seq}`,
      name: `新米${seq}`,
      className: "FIG",
      level: 1,
      age: 18,
      ageDays: 18 * 365,
      alignment: "GOOD",
      race: "HUM",
      hp: 24,
      maxHp: 24,
      ac: 8,
      status: "OK",
      row: "back",
      gold: 100,
      xp: 0,
      stats: { ...RACE_MIN_STATS.HUM },
      spells: { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] },
      knownSpells: { mage: [], priest: [] },
      items: ["DAGGER", "LEATHER ARMOR"],
      location: { type: "TOWN" },
      carriedFromStrandedId: null,
    };
    state.adventurers.push(member);
    normalizeMemberItems(member);
    return member;
  }

  function trainingCandidates() {
    return state.adventurers.filter((member) => {
      const location = member.location && member.location.type;
      return location === "TOWN" || location === "RECOVERED";
    });
  }

  function classChangeMember(memberId) {
    const member = getAdventurerById(memberId);
    if (!member || !trainingCandidates().includes(member) || normalizeStatusKey(member.status) === "LOST") {
      return { ok: false, notice: "転職できる対象ではありません。" };
    }
    member.className = member.className === "FIG" ? "THI" : "FIG";
    member.level = 1;
    member.xp = 0;
    member.stats = { ...(RACE_MIN_STATS[member.race] || RACE_MIN_STATS.HUM) };
    (member.items || []).forEach((item) => { if (item && typeof item === "object") item.equippedSlot = null; });
    ageMemberDays(member, randomChoice([252, 304, 356]) * 7);
    restoreMemberSpellUses(member);
    return { ok: true, notice: `${member.name}は${member.className}へ転職した。LV1、経験値0、装備解除、加齢を適用した。` };
  }

  function retireMember(memberId) {
    const member = getAdventurerById(memberId);
    if (!member || !trainingCandidates().includes(member)) return { ok: false, notice: "削除できる対象ではありません。" };
    state.parties.forEach((party) => { party.memberIds = party.memberIds.filter((id) => id !== member.id); });
    const index = state.adventurers.findIndex((item) => item.id === member.id);
    if (index >= 0) state.adventurers.splice(index, 1);
    syncPartyMembersToCurrentTownParty();
    return { ok: true, notice: `${member.name}を名簿から削除した。` };
  }

  function renderTrainingGroundDisbandConfirmWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">訓練場</span>
          <span class="event-prompt">${escapeHtml(notice || "訓練場に入る前に、街の編成中パーティーを解散しますか")}</span>
        </div>
        <div class="camp-note-frame town-note-frame"><span>訓練場は冒険者個人管理施設です。パーティー編成は酒場で行います。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame">
          <div class="event-actions">
            <button data-action="confirmDisband">解散して入る</button>
            <button data-action="backToTown">街へ戻る</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action === "confirmDisband") {
        disbandCurrentTownParty();
        renderTrainingGroundWindow("街パーティーを解散して訓練場に入った。");
      }
    });
  }

  function renderTrainingSelectWindow(mode, notice = "") {
    const title = mode === "classChange" ? "転職する冒険者" : "引退/削除する冒険者";
    const prefix = mode === "classChange" ? "classChangeMember" : "retireMember";
    const rows = trainingCandidates().map((member) => `
      <button class="town-roster-row" data-action="${prefix}:${escapeHtml(member.id)}">
        <span>${escapeHtml(member.name)}</span><span>${escapeHtml(member.race)} ${escapeHtml(member.className)}</span><span>LV ${escapeHtml(member.level)}</span><strong>${escapeHtml(member.location.type)}</strong>
      </button>`).join("") || `<div class="town-empty-row">対象者がいません。</div>`;
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">訓練場 / ${escapeHtml(title)}</span>
          <span class="event-prompt">${escapeHtml(notice || "対象者を選ぶ")}</span>
        </div>
        <div class="town-status-frame"><div class="town-frame-title">ROSTER</div><div class="town-roster-list">${rows}</div></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToTraining">訓練場へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTraining") { renderTrainingGroundWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("classChangeMember:")) { const result = classChangeMember(action.slice("classChangeMember:".length)); renderTrainingGroundWindow(result.notice); return; }
      if (action.startsWith("retireMember:")) { renderRetireConfirmWindow(action.slice("retireMember:".length)); }
    });
  }

  function renderRetireConfirmWindow(memberId, notice = "") {
    const member = getAdventurerById(memberId);
    if (!member) { renderTrainingGroundWindow("対象者が見つからない。"); return; }
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">引退/削除 確認</span>
          <span class="event-prompt">${escapeHtml(notice || `${member.name}を本当に削除しますか`)}</span>
        </div>
        <div class="camp-note-frame town-note-frame"><span>2段階確認です。この操作は現在の名簿から対象者を外します。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="confirmRetire">削除する</button><button data-action="cancel">戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "cancel") { renderTrainingSelectWindow("retire"); return; }
      if (action === "confirmRetire") { const result = retireMember(member.id); renderTrainingGroundWindow(result.notice); }
    });
  }

  function renderTrainingGroundWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">訓練場</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "冒険者を管理する"}</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">ROSTER</div>
          <div class="town-roster-list">${townRosterRows()}</div>
        </div>
        <div class="event-command-frame character-detail-actions town-actions-frame">
          <div class="event-actions">
            <button data-action="create">新規作成</button>
            <button data-action="classChange">転職</button>
            <button data-action="retire">引退/削除</button>
            <button data-action="backToTown">街へ戻る</button>
          </div>
        </div>
        <div class="camp-note-frame town-note-frame"><span>訓練場は個人管理施設。街の編成中パーティーがある場合は入場前に解散確認を行う。</span></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action === "create") { const member = createTrainingAdventurer(); renderTrainingGroundWindow(`${member.name}を作成した。`); return; }
      if (action === "classChange") { renderTrainingSelectWindow("classChange"); return; }
      if (action === "retire") { renderTrainingSelectWindow("retire"); return; }
      if (action.startsWith("trainingDetail:")) { openCharacterWindow(action.slice("trainingDetail:".length), "trainingGround"); }
    });
  }

  function innRoomById(roomId) {
    return INN_ROOMS.find((room) => room.id === roomId) || INN_ROOMS[0];
  }

  function innWeeksToStay(member, room) {
    if (room.id === "stable") return 1;
    const missingHp = Math.max(0, Number(member.maxHp || 0) - Number(member.hp || 0));
    return Math.max(1, Math.ceil(missingHp / Math.max(1, Number(room.hpPerWeek || 1))));
  }

  function stayAtInn(memberId, roomId) {
    const member = getAdventurerById(memberId);
    const room = innRoomById(roomId);
    if (!member || !innCandidates().includes(member)) return { ok: false, notice: "宿泊できる対象ではありません。" };
    const plannedWeeks = innWeeksToStay(member, room);
    let processedWeeks = 0;
    for (let week = 0; week < plannedWeeks; week += 1) {
      if (room.costPerWeek > 0 && Number(member.gold || 0) < room.costPerWeek) break;
      member.gold = Math.max(0, Number(member.gold || 0) - room.costPerWeek);
      member.hp = Math.min(Number(member.maxHp || 1), Number(member.hp || 0) + room.hpPerWeek);
      ageMemberDays(member, 7);
      processedWeeks += 1;
    }
    if (!processedWeeks) return { ok: false, notice: `${member.name}は宿泊費が足りない。` };
    restoreMemberSpellUses(member);
    const levelLines = tryApplyLevelUp(member);
    renderPartyCards();
    const levelText = levelLines.length ? ` ${levelLines.join(" ")}` : " レベルアップはなかった。";
    return { ok: true, notice: `${member.name}は${room.name}に${processedWeeks}週泊まった。${levelText}` };
  }

  function renderInnWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">宿屋</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "誰を泊めますか"}</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">LODGING TARGET</div>
          <div class="town-roster-list">${townSelectableMemberRows("innMember", { members: innCandidates() })}</div>
        </div>
        <div class="camp-note-frame town-note-frame"><span>宿屋は個人単位。宿泊対象本人の所持金で支払い、宿泊後にHP/呪文回復とレベルアップ判定を行う。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("innMember:")) { renderInnRoomWindow(action.slice("innMember:".length)); return; }
    });
  }

  function renderInnRoomWindow(memberId, notice = "") {
    const member = getAdventurerById(memberId);
    if (!member) { renderInnWindow("対象者が見つからない。"); return; }
    const rooms = INN_ROOMS.map((room) => `
      <button class="town-roster-row" data-action="innRoom:${escapeHtml(room.id)}">
        <span>${escapeHtml(room.name)}</span><span>HP ${escapeHtml(room.hpPerWeek)}/週</span><span>${escapeHtml(room.costPerWeek)}G/週</span><strong>${escapeHtml(room.term)} / ${escapeHtml(innWeeksToStay(member, room))}週</strong>
      </button>`).join("");
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">宿屋 / ${escapeHtml(member.name)}</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "部屋を選ぶ"}</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">ROOM RANK</div>
          <div class="town-roster-list">${rooms}</div>
        </div>
        <div class="camp-note-frame town-note-frame"><span>宿泊費は${escapeHtml(member.name)}本人の所持金から支払う。POISONEDは宿泊しても治療されない。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToInn">宿屋へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToInn") { renderInnWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("innRoom:")) { const result = stayAtInn(member.id, action.slice("innRoom:".length)); renderInnRoomWindow(member.id, result.notice); return; }
    });
  }

  function templeServiceForStatus(status) {
    const key = normalizeStatusKey(status);
    if (key === "PARALYZED") return { id: "cureParalysis", label: "麻痺治療", costFactor: 100, success: 100 };
    if (key === "STONED") return { id: "cureStone", label: "石化解除", costFactor: 200, success: 100 };
    if (key === "DEAD") return { id: "raiseDead", label: "蘇生", costFactor: 250, success: null };
    if (key === "ASHES") return { id: "raiseAshes", label: "灰から蘇生", costFactor: 500, success: null };
    return null;
  }

  function templeSuccessPercent(member, service) {
    if (!service) return 0;
    if (service.success === 100) return 100;
    const vit = Number(member && member.stats && member.stats.vit ? member.stats.vit : 0);
    if (service.id === "raiseDead") return clampNumber(0, 100, 50 + 3 * vit);
    if (service.id === "raiseAshes") return clampNumber(0, 100, 40 + 3 * vit);
    return 0;
  }

  function templeServiceCost(member, service) {
    return Math.max(0, Number(service && service.costFactor || 0) * Math.max(1, Number(member && member.level || 1)));
  }

  function templeAgeCostDays() {
    return rollRange(1, 52) * 7;
  }

  function performTempleService(targetId, payerId) {
    const target = getAdventurerById(targetId);
    const payer = getAdventurerById(payerId);
    const service = templeServiceForStatus(target && target.status);
    if (!target || !templeCandidates().includes(target) || !service) return { ok: false, notice: "処置できる対象ではありません。" };
    if (!payer || !payerCandidates().includes(payer)) return { ok: false, notice: "支払者を選べません。" };
    if (payer.id === target.id) return { ok: false, notice: "寺院では処置対象本人を支払者にしません。" };
    const cost = templeServiceCost(target, service);
    if (Number(payer.gold || 0) < cost) return { ok: false, notice: `${payer.name}の所持金が足りない。必要 ${cost}G。` };
    payer.gold = Number(payer.gold || 0) - cost;
    const ageDays = templeAgeCostDays();
    ageMemberDays(target, ageDays);
    const rate = templeSuccessPercent(target, service);
    const success = rate >= 100 || rollRange(1, 100) <= rate;
    const before = normalizeStatusKey(target.status);
    if (success) {
      applyStatusToMember(target, "OK");
      if (before === "DEAD") target.hp = 1;
      if (before === "ASHES") target.hp = Number(target.maxHp || 1);
    } else if (before === "DEAD") {
      setMemberStatus(target, "ASHES");
    } else if (before === "ASHES") {
      setMemberLocation(target, { type: "LOST" });
    }
    renderPartyCards();
    return { ok: success, notice: `${payer.name}が${cost}Gを支払った。${target.name}の${service.label}は${success ? "成功" : "失敗"}。${Math.floor(ageDays / 7)}週加齢した。` };
  }

  function renderTempleWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">寺院</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "誰を処置しますか"}</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">TEMPLE TARGET</div>
          <div class="town-roster-list">${townSelectableMemberRows("templeTarget", { members: templeCandidates() })}</div>
        </div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="templeGatherGold">お金を集める</button><button data-action="backToTown">街へ戻る</button></div></div>
        <div class="camp-note-frame town-note-frame"><span>寺院は回収済み対象のみ処置する。処置対象本人から支払わず、別に支払者を選ぶ。寺院サービスの加齢は1d52週。</span></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action === "templeGatherGold") { renderTempleMoneyGatherWindow(); return; }
      if (action.startsWith("templeTarget:")) { renderTemplePayerWindow(action.slice("templeTarget:".length)); return; }
    });
  }

  function renderTemplePayerWindow(targetId, notice = "") {
    const target = getAdventurerById(targetId);
    if (!target) { renderTempleWindow("処置対象が見つからない。"); return; }
    const service = templeServiceForStatus(target.status);
    const cost = templeServiceCost(target, service);
    const payerRows = payerCandidates().map((member) => `
      <button class="town-roster-row" data-action="templePayer:${escapeHtml(member.id)}" ${member.id === target.id ? "disabled" : ""}>
        <span>${escapeHtml(member.name)}</span><span>${escapeHtml(statusLabel(member))}</span><span>${escapeHtml(member.gold || 0)}G</span><strong>${Number(member.gold || 0) >= cost ? "支払可" : "不足"}</strong>
      </button>`).join("") || `<div class="town-empty-row">支払者候補がいません。</div>`;
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">寺院 / 支払者選択</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : `${escapeHtml(target.name)}の${escapeHtml(service ? service.label : "処置")} ${escapeHtml(cost)}Gを誰が払いますか`}</span>
        </div>
        <div class="town-status-frame"><div class="town-frame-title">PAYER</div><div class="town-roster-list">${payerRows}</div></div>
        <div class="camp-note-frame town-note-frame"><span>支払者は現在街パーティー内のOK/POISONEDのみ。処置対象本人の所持金は直接使わない。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToTemple">寺院へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTemple") { renderTempleWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("templePayer:")) { const result = performTempleService(target.id, action.slice("templePayer:".length)); renderTempleWindow(result.notice); return; }
    });
  }

  function renderTempleMoneyGatherWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">寺院 / お金を集める</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "誰に集めますか"}</span>
        </div>
        <div class="town-status-frame"><div class="town-frame-title">RECEIVER</div><div class="town-roster-list">${townSelectableMemberRows("templeGoldTo", { members: payerCandidates() })}</div></div>
        <div class="camp-note-frame town-note-frame"><span>寺院のお金を集めるは、現在街パーティーの金を選択した1人へ集中する機能。酒場の均等配分とは別。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToTemple">寺院へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTemple") { renderTempleWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("templeGoldTo:")) { const result = gatherTownPartyGoldTo(action.slice("templeGoldTo:".length)); renderTempleMoneyGatherWindow(result.notice); return; }
    });
  }

  function itemBaseValue(item) {
    const name = itemDisplayName(item);
    const catalog = SHOP_CATALOG.find((entry) => entry.item === name);
    if (catalog) return catalog.price;
    if (ITEM_DEFINITIONS[name]) return 60;
    if (name.includes("UNIDENTIFIED")) return 25;
    return 20;
  }

  function buyShopItem(memberId, itemName) {
    const member = getAdventurerById(memberId);
    const entry = SHOP_CATALOG.find((item) => item.item === itemName);
    if (!member || !shopCandidates().includes(member)) return { ok: false, notice: "商店の対象者ではありません。" };
    if (!entry) return { ok: false, notice: "商品が見つかりません。" };
    if (!hasItemCapacity(member, 1)) return { ok: false, notice: `${member.name}はこれ以上持てない。` };
    if (Number(member.gold || 0) < entry.price) return { ok: false, notice: `${member.name}の所持金が足りない。` };
    member.gold = Number(member.gold || 0) - entry.price;
    addItemToMember(member, entry.item);
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${entry.item}を買った。` };
  }

  function sellShopItem(memberId, itemIndex) {
    const member = getAdventurerById(memberId);
    const item = itemAtIndex(member, itemIndex);
    if (!member || !shopCandidates().includes(member)) return { ok: false, notice: "商店の対象者ではありません。" };
    if (!item) return { ok: false, notice: "売る品が見つかりません。" };
    if (item && typeof item === "object" && item.equippedSlot) item.equippedSlot = null;
    const price = Math.max(1, Math.floor(itemBaseValue(item) / 2));
    const name = itemDisplayName(item);
    member.items.splice(Number(itemIndex), 1);
    member.gold = Number(member.gold || 0) + price;
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${name}を${price}Gで売った。` };
  }

  function identifyShopItem(memberId, itemIndex) {
    const member = getAdventurerById(memberId);
    const item = itemAtIndex(member, itemIndex);
    if (!member || !shopCandidates().includes(member)) return { ok: false, notice: "商店の対象者ではありません。" };
    if (!item) return { ok: false, notice: "鑑定対象が見つかりません。" };
    const cost = 20 * Math.max(1, Number(member.level || 1));
    if (Number(member.gold || 0) < cost) return { ok: false, notice: `${member.name}の所持金が足りない。` };
    member.gold = Number(member.gold || 0) - cost;
    if (item && typeof item === "object") item.identified = true;
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${itemDisplayName(item)}を鑑定した。` };
  }

  function uncurseShopItem(memberId, itemIndex) {
    const member = getAdventurerById(memberId);
    const item = itemAtIndex(member, itemIndex);
    if (!member || !shopCandidates().includes(member)) return { ok: false, notice: "商店の対象者ではありません。" };
    if (!item) return { ok: false, notice: "解呪対象が見つかりません。" };
    const cost = 50 * Math.max(1, Number(member.level || 1));
    if (Number(member.gold || 0) < cost) return { ok: false, notice: `${member.name}の所持金が足りない。` };
    member.gold = Number(member.gold || 0) - cost;
    if (item && typeof item === "object") {
      item.cursed = false;
      item.equippedSlot = null;
    }
    renderPartyCards();
    return { ok: true, notice: `${member.name}は${itemDisplayName(item)}を解呪した。` };
  }

  function renderShopWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">商店</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "何をしますか"}</span>
        </div>
        <div class="event-command-frame character-detail-actions town-actions-frame">
          <div class="event-actions">
            <button data-action="shopBuy">買う</button>
            <button data-action="shopSell">売る</button>
            <button data-action="shopIdentify">鑑定</button>
            <button data-action="shopUncurse">解呪</button>
            <button data-action="shopGatherGold">お金を集める</button>
            <button data-action="backToTown">街へ戻る</button>
          </div>
        </div>
        <div class="camp-note-frame town-note-frame"><span>商店は個人単位。買う/売る/鑑定/解呪は対象キャラクターを選び、その人物の所持金・所持品だけを処理する。</span></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action === "shopGatherGold") { renderShopMoneyGatherWindow(); return; }
      if (["shopBuy", "shopSell", "shopIdentify", "shopUncurse"].includes(action)) { renderShopMemberSelectWindow(action); return; }
    });
  }

  function shopActionLabel(action) {
    return { shopBuy: "買う", shopSell: "売る", shopIdentify: "鑑定", shopUncurse: "解呪" }[action] || "商店";
  }

  function renderShopMemberSelectWindow(shopAction, notice = "") {
    const label = shopActionLabel(shopAction);
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">商店 / ${escapeHtml(label)}</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "対象者を選ぶ"}</span>
        </div>
        <div class="town-status-frame"><div class="town-frame-title">CUSTOMER</div><div class="town-roster-list">${townSelectableMemberRows("shopMember", { members: shopCandidates() })}</div></div>
        <div class="camp-note-frame town-note-frame"><span>${escapeHtml(label)}は対象者個人の所持金・所持品を処理対象にする。暗黙の共有財布は使わない。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToShop">商店へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToShop") { renderShopWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("shopMember:")) { renderShopTransactionWindow(shopAction, action.slice("shopMember:".length)); return; }
    });
  }

  function renderShopTransactionWindow(shopAction, memberId, notice = "") {
    const member = getAdventurerById(memberId);
    if (!member) { renderShopMemberSelectWindow(shopAction, "対象者が見つからない。"); return; }
    const label = shopActionLabel(shopAction);
    let rows = "";
    if (shopAction === "shopBuy") {
      rows = SHOP_CATALOG.map((entry) => `
        <button class="town-roster-row" data-action="shopBuyItem:${escapeHtml(entry.item)}">
          <span>${escapeHtml(entry.item)}</span><span>${escapeHtml(entry.price)}G</span><span>所持 ${escapeHtml(memberItemCount(member))}/${escapeHtml(ITEM_CAPACITY_PER_MEMBER)}</span><strong>買う</strong>
        </button>`).join("");
    } else {
      rows = (member.items || []).map((item, index) => {
        const value = shopAction === "shopSell" ? `${Math.max(1, Math.floor(itemBaseValue(item) / 2))}G` : shopAction === "shopIdentify" ? `${20 * Math.max(1, Number(member.level || 1))}G` : `${50 * Math.max(1, Number(member.level || 1))}G`;
        return `
          <button class="town-roster-row" data-action="shopItem:${escapeHtml(index)}">
            <span>${escapeHtml(itemDisplayName(item))}</span><span>${escapeHtml(itemStatusLabel(item))}</span><span>${escapeHtml(value)}</span><strong>${escapeHtml(label)}</strong>
          </button>`;
      }).join("") || `<div class="town-empty-row">${escapeHtml(member.name)}の所持品はありません。</div>`;
    }
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">商店 / ${escapeHtml(label)} / ${escapeHtml(member.name)}</span>
          <span class="event-prompt">${escapeHtml(notice || `${member.gold || 0}G 所持`)}</span>
        </div>
        <div class="town-status-frame"><div class="town-frame-title">${escapeHtml(label)}</div><div class="town-roster-list">${rows}</div></div>
        <div class="camp-note-frame town-note-frame"><span>この画面の支払い・所持品処理は${escapeHtml(member.name)}本人だけを対象にする。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToMembers">対象者選択へ戻る</button><button data-action="backToShop">商店へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToMembers") { renderShopMemberSelectWindow(shopAction); return; }
      if (action === "backToShop") { renderShopWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("shopBuyItem:")) { const result = buyShopItem(member.id, action.slice("shopBuyItem:".length)); renderShopTransactionWindow(shopAction, member.id, result.notice); return; }
      if (action.startsWith("shopItem:")) {
        const index = Number(action.slice("shopItem:".length));
        const result = shopAction === "shopSell" ? sellShopItem(member.id, index) : shopAction === "shopIdentify" ? identifyShopItem(member.id, index) : uncurseShopItem(member.id, index);
        renderShopTransactionWindow(shopAction, member.id, result.notice);
      }
    });
  }

  function renderShopMoneyGatherWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">商店 / お金を集める</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "誰に集めますか"}</span>
        </div>
        <div class="town-status-frame"><div class="town-frame-title">RECEIVER</div><div class="town-roster-list">${townSelectableMemberRows("shopGoldTo", { members: shopCandidates() })}</div></div>
        <div class="camp-note-frame town-note-frame"><span>商店のお金を集めるは買い物担当者へ金を集中する補助機能。購入・鑑定・解呪はその人物本人の所持金から支払う。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame"><div class="event-actions"><button data-action="backToShop">商店へ戻る</button><button data-action="backToTown">街へ戻る</button></div></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToShop") { renderShopWindow(""); return; }
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("shopGoldTo:")) { const result = gatherTownPartyGoldTo(action.slice("shopGoldTo:".length)); renderShopMoneyGatherWindow(result.notice); return; }
    });
  }

  function renderResumeAdventureWindow(notice = "") {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">冒険を再開する</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "休止中パーティーを選ぶ"}</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">SUSPENDED PARTIES</div>
          <div class="town-list-frame">${suspendedPartyRows()}</div>
        </div>
        <div class="event-command-frame character-detail-actions town-actions-frame">
          <div class="event-actions"><button data-action="backToTown">街へ戻る</button></div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") { renderTownWindow(""); return; }
      if (action.startsWith("resumeParty:")) { resumeSuspendedParty(action.slice("resumeParty:".length)); }
    });
  }

  function renderStrandedRecordWindow() {
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel town-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box town-message-box" aria-live="polite">
          <span id="eventWindowTitle">遭難記録</span>
          <span class="event-prompt">迷宮内に残された者</span>
        </div>
        <div class="town-status-frame">
          <div class="town-frame-title">STRANDED / LOST PARTIES</div>
          <div class="town-list-frame">${strandedPartyRows()}</div>
        </div>
        <div class="camp-note-frame town-note-frame"><span>発見・回収は街で自動処理しない。救助隊が迷宮でキャンプを開き、「周辺を探索する」ことで発見する。</span></div>
        <div class="event-command-frame character-detail-actions town-actions-frame">
          <div class="event-actions"><button data-action="backToTown">街へ戻る</button></div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "backToTown") renderTownWindow("");
    });
  }

  function nearbyStrandedRecords() {
    return state.strandedRecords.filter((record) => {
      if (!(record.remainingMemberIds || []).length) return false;
      if (record.floor !== state.floor) return false;
      return Math.abs(Number(record.x) - Number(state.x)) + Math.abs(Number(record.z) - Number(state.z)) <= 1;
    });
  }

  function rescueStrandedMember(recordId, memberId) {
    const party = activeParty();
    const record = state.strandedRecords.find((item) => item.id === recordId);
    const member = getAdventurerById(memberId);
    if (!party) return { ok: false, notice: "救助隊が迷宮内にいません。" };
    if (party.memberIds.length >= MAX_PARTY_SIZE) return { ok: false, notice: "6人満員のため、誰も連れ帰れません。" };
    if (!record || !(record.remainingMemberIds || []).includes(memberId) || !member) return { ok: false, notice: "救助対象が見つかりません。" };
    record.remainingMemberIds = record.remainingMemberIds.filter((id) => id !== memberId);
    if (!record.carriedMemberIds) record.carriedMemberIds = [];
    record.carriedMemberIds.push(memberId);
    record.status = record.remainingMemberIds.length ? "一部搬送中" : "全員搬送中";
    party.memberIds.push(memberId);
    setMemberLocation(member, { type: "CARRIED", partyId: party.id, strandedId: record.id });
    member.carriedFromStrandedId = record.id;
    syncPartyMembersToParty(party);
    return { ok: true, notice: `${member.name}を発見し、搬送に加えた。` };
  }

  function renderCampSearchWindow(notice = "") {
    const records = nearbyStrandedRecords();
    const party = activeParty();
    const freeSlots = party ? Math.max(0, MAX_PARTY_SIZE - party.memberIds.length) : 0;
    const resultRows = records.length ? records.map((record) => {
      const memberRows = (record.remainingMemberIds || []).map((id) => {
        const member = getAdventurerById(id);
        if (!member) return "";
        return `<button class="town-roster-row" data-action="rescue:${escapeHtml(record.id)}:${escapeHtml(member.id)}" ${freeSlots <= 0 ? "disabled" : ""}>
          <span>${escapeHtml(member.name)}</span><span>${escapeHtml(statusLabel(member))}</span><span>${escapeHtml(record.floor)} x${escapeHtml(record.x)} y${escapeHtml(record.z)}</span><strong>${freeSlots <= 0 ? "満員" : "搬送"}</strong>
        </button>`;
      }).join("");
      return memberRows;
    }).join("") : `<div class="town-empty-row">この周辺に目立つ痕跡はない。</div>`;
    const overlay = getEventOverlay();
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel camp-window-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">周辺を探索する</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : "周囲の痕跡を調べる"}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="camp-note-frame"><span>同一階層かつマンハッタン距離1以内の遭難記録を確定発見する。空き枠: ${escapeHtml(freeSlots)}。</span></div>
        <div class="town-status-frame">
          <div class="town-frame-title">SEARCH RESULT</div>
          <div class="town-roster-list">${resultRows}</div>
        </div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="searchAgain">もう一度調べる</button>
            <button data-action="backToCamp">キャンプへ戻る</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") { closeEventWindow(); return; }
      if (action === "backToCamp") { renderCampWindow(""); return; }
      if (action === "searchAgain") { renderCampSearchWindow("今は何も見つからない。"); }
      if (action.startsWith("rescue:")) {
        const [, recordId, memberId] = action.split(":");
        const result = rescueStrandedMember(recordId, memberId);
        renderCampSearchWindow(result.notice);
      }
    });
  }

  function openCampWindow() {
    if (state.eventWindowOpen || state.animation) return;
    if (!ensurePartyCanActOrShow("全員が行動不能で、キャンプを開けない。")) return;
    state.eventWindowOpen = true;
    renderCampWindow("");
  }

  function openFormationWindow() {
    if (state.eventWindowOpen || state.animation) return;
    if (!ensurePartyCanActOrShow("全員が行動不能で、隊列を変えられない。")) return;
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
              <button data-action="searchArea">周辺を探索する</button>
              <button data-action="suspendAdventure">冒険を中断する</button>
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
        return;
      }
      if (action === "searchArea") {
        renderCampSearchWindow();
        return;
      }
      if (action === "suspendAdventure") {
        suspendCurrentAdventure();
        return;
      }
      return;
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
    const party = activeParty() || getPartyById(state.currentTownPartyId);
    if (party) party.memberIds = PARTY_MEMBERS.map((item) => item.id);
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

  function renderSpellWindow(memberId, notice = "") {
    const member = PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    const overlay = getEventOverlay();
    const mage = spellLine(member.spells && member.spells.mage);
    const priest = spellLine(member.spells && member.spells.priest);
    const spellRows = CAMP_PRIEST_SPELLS.map((spell) => {
      const status = campPriestSpellStatus(member, spell);
      const disabled = status === "使用可能" ? "" : "disabled";
      return `
        <button class="spell-cast-row" data-action="castCampSpell:${escapeHtml(spell.id)}" ${disabled}>
          <span>${escapeHtml(spell.levelLabel)}</span>
          <strong>${escapeHtml(spell.name)}</strong>
          <em>${escapeHtml(status)}</em>
        </button>`;
    }).join("");
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">SPELL POINTS</span>
          <span class="event-prompt">${notice ? escapeHtml(notice) : escapeHtml(member.name)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="spell-detail-frame">
          <div class="spell-table-head"><span></span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div>
          <div class="spell-table-row"><span>MAGE</span>${mage.split("/").map((value) => `<strong>${escapeHtml(value)}</strong>`).join("")}</div>
          <div class="spell-table-row"><span>PRIEST</span>${priest.split("/").map((value) => `<strong>${escapeHtml(value)}</strong>`).join("")}</div>
        </div>
        <div class="spell-cast-frame spell-camp-v30-frame spell-camp-v34b-frame">
          ${spellRows}
          <div class="spell-cast-row spell-cast-row-disabled" aria-disabled="true">
            <span>MAGE 1</span>
            <strong>火花</strong>
            <em>戦闘中のみ</em>
          </div>
        </div>
        <div class="camp-note-frame"><span>迷宮内PRIEST呪文でHP・毒・麻痺・石化・OUT・死亡・灰化を処置する。ASLEEP/AFRAIDは戦闘終了で回復し、LOSTは迷宮内回復不可。</span></div>
        <div class="event-command-frame character-detail-actions">
          <div class="event-actions">
            <button data-action="backToMembers">メンバーへ戻る</button>
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
      if (action === "backToMembers") {
        renderCampMemberSelectWindow("spells");
        return;
      }
      if (action === "backToCamp") {
        renderCampWindow("");
        return;
      }
      if (action.startsWith("castCampSpell:")) {
        const spellId = action.slice("castCampSpell:".length);
        const spell = campPriestSpellById(spellId);
        if (!spell) {
          renderSpellWindow(member.id, "呪文が見つからない。");
          return;
        }
        const status = campPriestSpellStatus(member, spell);
        if (status !== "使用可能") {
          renderSpellWindow(member.id, `${spell.name}: ${status}`);
          return;
        }
        renderCampSpellTargetWindow(member.id, spell.id);
      }
    });
  }

  function renderCampSpellTargetWindow(memberId, spellId = "heal", notice = "") {
    const caster = PARTY_MEMBERS.find((item) => item.id === memberId);
    const spell = campPriestSpellById(spellId);
    if (!caster || !spell) return;
    const overlay = getEventOverlay();
    const targetButtons = PARTY_MEMBERS.map((target) => {
      const disabled = !memberMatchesCampSpellTarget(target, spell);
      const label = `${target.name} HP ${partyHpText(target)} ${statusLabel(target)}`;
      return `<button data-action="target:${escapeHtml(target.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
    const prompt = notice || (campSpellTargets(spell).length ? `${spell.name}: 誰を対象にしますか` : `${spell.name}: 対象はいない。`);
    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel character-detail-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">${escapeHtml(spell.levelLabel)} ${escapeHtml(spell.name)}</span>
          <span class="event-prompt">${escapeHtml(prompt)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-command-frame camp-member-frame">
          <div class="event-command-title">TARGET / ${escapeHtml(caster.name)} ${escapeHtml(spellLine(caster.spells && caster.spells.priest))}</div>
          <div class="event-actions camp-member-actions">
            ${targetButtons}
            <button data-action="back">戻る</button>
          </div>
        </div>
        <div class="camp-note-frame"><span>${escapeHtml(spell.note || "対象がない場合は消費しない。")}</span></div>
      </div>`;
    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        closeEventWindow();
        return;
      }
      if (action === "back") {
        renderSpellWindow(caster.id);
        return;
      }
      if (action.startsWith("target:")) {
        const result = useCampPriestSpell(caster, spell.id, action.slice("target:".length));
        renderSpellWindow(caster.id, result.notice);
      }
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
        <div class="camp-note-frame"><span>所持 ${escapeHtml(memberItemCount(member))}/${escapeHtml(ITEM_CAPACITY_PER_MEMBER)}。道具を選択すると、使用・装備/外す・渡す・捨てるを選べる。</span></div>
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
      const label = `${target.name} HP ${partyHpText(target)} ${statusLabel(target)}`;
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
      const disabled = target.id === member.id || !hasItemCapacity(target, 1);
      const label = `${target.name} ${target.className} ${memberItemCount(target)}/${ITEM_CAPACITY_PER_MEMBER}`;
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
    const member = getAdventurerById(memberId) || PARTY_MEMBERS.find((item) => item.id === memberId);
    if (!member) return;
    state.eventWindowOpen = true;
    const overlay = getEventOverlay();
    const spellRows = renderSpellPointRows(member);
    const itemRows = (member.items || []).map((item) => `<li>${isItemEquipped(item) ? "[E] " : ""}${escapeHtml(itemDisplayName(item))}</li>`).join("") || `<li>なし</li>`;
    let backButton = "";
    if (returnMode === "campMembers") backButton = `<button data-action="backToCampMembers">戻る</button>`;
    if (returnMode === "trainingGround") backButton = `<button data-action="backToTraining">訓練場へ戻る</button>`;
    if (returnMode === "tavern") backButton = `<button data-action="backToTavern">酒場へ戻る</button>`;
    const townDetailMode = returnMode === "trainingGround" || returnMode === "tavern";
    const characterActionButtons = townDetailMode
      ? `${backButton}<button data-action="close">閉じる</button>`
      : `<button data-action="spell:${escapeHtml(member.id)}">呪文</button><button data-action="items:${escapeHtml(member.id)}">アイテム</button>${backButton}<button data-action="close">閉じる</button>`;

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
                <div><span>AGE</span><strong>${escapeHtml(memberAgeText(member))}</strong></div>
              </div>
              <div class="status-detail-v23g-list status-detail-v23g-basic">
                <div><span>HITS</span><strong>${escapeHtml(partyHpText(member))}</strong></div>
                <div><span>AC</span><strong>${escapeHtml(effectiveMemberAc(member))}</strong></div>
                <div><span>STATUS</span><strong>${escapeHtml(statusLabel(member))}</strong></div>
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
            ${characterActionButtons}
          </div>
        </div>
      </div>`;

    bindWindowActions(overlay, (action) => {
      if (action === "close") {
        if (returnMode === "trainingGround") { renderTrainingGroundWindow(""); return; }
        if (returnMode === "tavern") { renderTavernWindow(""); return; }
        closeEventWindow();
        return;
      }
      if (action === "backToCampMembers") {
        renderCampMemberSelectWindow("detail");
        return;
      }
      if (action === "backToTraining") {
        renderTrainingGroundWindow("");
        return;
      }
      if (action === "backToTavern") {
        renderTavernWindow("");
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

  function chestActorButtons(actionPrefix, disabledWhenUnable = false) {
    return PARTY_MEMBERS.map((member) => {
      const disabled = disabledWhenUnable && !canMemberAct(member);
      const label = `${member.name} ${member.className} ${statusLabel(member)}`;
      return `<button data-action="${escapeHtml(actionPrefix)}:${escapeHtml(member.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
  }

  function chestTrapChoiceButtons() {
    return DUNGEON_TRAPS.map((trap) => `<button data-action="trapType:${escapeHtml(trap.id)}">${escapeHtml(trap.label)}</button>`).join("");
  }

  function chestRecipientButtons(pendingLoot) {
    const itemCount = Array.isArray(pendingLoot) ? pendingLoot.length : 0;
    return PARTY_MEMBERS.map((member) => {
      const disabled = !canMemberReceiveReward(member) || !hasItemCapacity(member, itemCount);
      const label = `${member.name} ${statusLabel(member)} / ${memberItemCount(member)}/${ITEM_CAPACITY_PER_MEMBER}`;
      return `<button data-action="recipient:${escapeHtml(member.id)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
    }).join("");
  }

  function renderChestWindow(chest, notice = "", mode = "main") {
    let overlay = document.getElementById("eventWindowOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "eventWindowOverlay";
      overlay.className = "event-window-overlay";
      document.body.appendChild(overlay);
    }

    const key = objectKey(chest);
    const chestState = getChestRuntimeState(chest, key);
    const opened = chestState.opened;
    const checked = chestState.checked;
    const disarmed = chestState.disarmed;
    const trap = trapById(chestState.trapId);
    const suspected = checked && chestState.suspectedTrapId ? trapLabel(chestState.suspectedTrapId) : "未調査";
    const pendingLoot = Array.isArray(chestState.pendingLoot) ? chestState.pendingLoot : [];

    const mainButtons = opened
      ? `<button data-action="close">離れる</button>`
      : `
        <button data-action="check">調べる</button>
        ${checked && !disarmed ? `<button data-action="disarm">罠を解除する</button>` : ""}
        <button data-action="open">開ける</button>
        <button data-action="close">離れる</button>
      `;

    let title = chest && chest.source === "battle" ? "戦闘後の宝箱" : "宝箱";
    let prompt = notice || "どうしますか";
    let actions = mainButtons;
    let commandTitle = "COMMAND";

    if (mode === "chooseInspector") {
      prompt = "誰が調べますか";
      commandTitle = "INSPECT";
      actions = `${chestActorButtons("actor", true)}<button data-action="back">戻る</button>`;
    } else if (mode === "chooseDisarmer") {
      prompt = "誰が解除しますか";
      commandTitle = "DISARMER";
      actions = `${chestActorButtons("disarmActor", true)}<button data-action="back">戻る</button>`;
    } else if (mode === "chooseTrapType") {
      const disarmer = findPartyMember(chestState.pendingDisarmerId);
      prompt = `${disarmer ? disarmer.name : "解除者"}：どの罠を外しますか`;
      commandTitle = "TRAP TYPE";
      actions = `${chestTrapChoiceButtons()}<button data-action="backDisarm">解除者へ戻る</button>`;
    } else if (mode === "chooseRecipient") {
      title = "戦利品";
      prompt = pendingLoot.length ? `${pendingLoot.join(" / ")} を誰が持ちますか` : "中は空だった。";
      commandTitle = "RECIPIENT";
      actions = pendingLoot.length
        ? `${chestRecipientButtons(pendingLoot)}<button data-action="leaveLoot">受け取らない</button>`
        : `<button data-action="finishOpen">閉じる</button>`;
    }

    const trapStatus = opened
      ? "開封済み"
      : disarmed
        ? `解除済み: ${trap.label}`
        : checked
          ? `罠推定: ${suspected}`
          : "罠: 未調査";
    const inventoryStatus = `所持上限: 1人${ITEM_CAPACITY_PER_MEMBER}個`;

    overlay.innerHTML = `
      <div class="event-window-panel wizardry-event-panel" role="dialog" aria-modal="true" aria-labelledby="eventWindowTitle">
        <div class="event-message-box" aria-live="polite">
          <span id="eventWindowTitle">${escapeHtml(title)}</span>
          <span class="event-prompt">${escapeHtml(prompt)}</span>
          <button class="event-close-btn" data-action="close" aria-label="閉じる">×</button>
        </div>
        <div class="event-main-grid">
          <div class="event-art-frame" aria-hidden="true">
            <div class="event-chest-visual ${opened ? "opened" : "closed"}">
              <img class="event-chest-image" src="assets/ui/${opened ? "chest_open.svg" : "chest_closed.svg"}" alt="" />
            </div>
            <div class="event-object-caption">${escapeHtml(trapStatus)}</div>
            <div class="event-object-caption">${escapeHtml(inventoryStatus)}</div>
          </div>
          <div class="event-command-frame">
            <div class="event-command-title">${escapeHtml(commandTitle)}</div>
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

  function rollChestLoot(chest, chestState) {
    if (Array.isArray(chestState.pendingLoot)) return chestState.pendingLoot;
    if (chest && Array.isArray(chest.fixedLoot)) {
      chestState.pendingLoot = chest.fixedLoot.slice();
      return chestState.pendingLoot;
    }
    chestState.pendingLoot = rollTreasureItems(chest && chest.treasureTableId, 100);
    return chestState.pendingLoot;
  }

  function finishChestWithoutLoot(chest, key, chestState, notice = "宝箱を閉じた。") {
    setChestOpened(key, chestState);
    scene = buildSceneGeometry();
    renderChestWindow(chest, notice, "main");
    setMessage(notice, false);
  }

  function openChestAfterTrapCheck(chest, key, chestState, actor = null) {
    let trapNotice = "";
    if (!chestState.disarmed && !chestState.trapTriggered) {
      chestState.trapTriggered = true;
      const lines = applyTrapEffect(chestState.trapId, actor, "open");
      if (chest && chest.source === "battle") lines.push(...recoverTemporaryStatusesAfterBattle());
      trapNotice = lines.join(" ");
      if (isPartyDefeated()) {
        renderChestWindow(chest, `${trapNotice} 隊は行動不能になった。`, "main");
        setMessage("隊は行動不能になった。", true);
        return;
      }
    }
    const loot = rollChestLoot(chest, chestState);
    if (!loot.length) {
      finishChestWithoutLoot(chest, key, chestState, `${trapNotice ? trapNotice + " " : ""}開いた。中は空だった。`);
      return;
    }
    renderChestWindow(chest, `${trapNotice ? trapNotice + " " : ""}開いた。中身を誰が持つか選ぶ。`, "chooseRecipient");
  }

  function inspectChestTrap(chest, key, chestState, member) {
    const trap = trapById(chestState.trapId);
    const check = trapCheckRoll(member, Number(trap.difficulty || 50) - 10);
    setChestChecked(key, chestState);
    chestState.suspectedTrapId = check.ok ? trap.id : randomTrapId(trap.id);
    const guessed = trapLabel(chestState.suspectedTrapId);
    return `${member.name}は調べた。${guessed}の気配がある。`;
  }

  function attemptDisarmChestTrap(chest, key, chestState, trapTypeId) {
    const member = findPartyMember(chestState.pendingDisarmerId);
    const trap = trapById(chestState.trapId);
    if (!member || !canMemberAct(member)) {
      chestState.pendingDisarmerId = null;
      return { mode: "main", notice: "解除できる者がいない。", warning: true };
    }
    const selectedTrap = trapById(trapTypeId);
    if (!selectedTrap || selectedTrap.id !== trap.id) {
      chestState.trapTriggered = true;
      const lines = applyTrapEffect(trap.id, member, "wrongDisarm");
      chestState.pendingDisarmerId = null;
      return { mode: "main", notice: `${member.name}は${selectedTrap ? selectedTrap.label : "不明な罠"}を外そうとした。${lines.join(" ")}`, warning: true };
    }
    const check = trapCheckRoll(member, trap.difficulty);
    chestState.pendingDisarmerId = null;
    if (check.ok) {
      setChestDisarmed(key, chestState);
      return { mode: "main", notice: `${member.name}は${trap.label}を解除した。`, warning: false };
    }
    chestState.trapTriggered = true;
    const lines = applyTrapEffect(trap.id, member, "failedDisarm");
    return { mode: "main", notice: `${member.name}は解除に失敗した。${lines.join(" ")}`, warning: true };
  }

  function handleChestAction(chest, action, key) {
    const chestState = getChestRuntimeState(chest, key);
    if (action === "close") {
      closeEventWindow();
      if (chest && chest.source === "battle") state.currentBattle = null;
      setMessage(chest && chest.source === "battle" ? "探索へ戻った。" : "離れた。", false);
      return;
    }
    if (action === "back") {
      renderChestWindow(chest, "", "main");
      return;
    }
    if (action === "backDisarm") {
      chestState.pendingDisarmerId = null;
      renderChestWindow(chest, "", "chooseDisarmer");
      return;
    }
    if (action === "check") {
      renderChestWindow(chest, "", "chooseInspector");
      return;
    }
    if (action.startsWith("actor:")) {
      const member = findPartyMember(action.slice("actor:".length));
      if (!member || !canMemberAct(member)) {
        renderChestWindow(chest, "その者は調べられない。", "chooseInspector");
        return;
      }
      const notice = inspectChestTrap(chest, key, chestState, member);
      renderChestWindow(chest, notice, "main");
      setMessage("調べた。", false);
      return;
    }
    if (action === "disarm") {
      renderChestWindow(chest, "", "chooseDisarmer");
      return;
    }
    if (action.startsWith("disarmActor:")) {
      const member = findPartyMember(action.slice("disarmActor:".length));
      if (!member || !canMemberAct(member)) {
        renderChestWindow(chest, "その者は解除できない。", "chooseDisarmer");
        return;
      }
      chestState.pendingDisarmerId = member.id;
      renderChestWindow(chest, "罠の種類を選ぶ。", "chooseTrapType");
      return;
    }
    if (action.startsWith("trapType:")) {
      const result = attemptDisarmChestTrap(chest, key, chestState, action.slice("trapType:".length));
      if (chest && chest.source === "battle") {
        const recovered = recoverTemporaryStatusesAfterBattle();
        if (recovered.length) result.notice = `${result.notice} ${recovered.join(" ")}`;
      }
      renderChestWindow(chest, result.notice, result.mode || "main");
      setMessage(result.warning ? "罠が作動した。" : "解除した。", Boolean(result.warning));
      return;
    }
    if (action === "open") {
      const opener = firstLivingMember();
      openChestAfterTrapCheck(chest, key, chestState, opener);
      return;
    }
    if (action.startsWith("recipient:")) {
      const member = findPartyMember(action.slice("recipient:".length));
      const loot = rollChestLoot(chest, chestState);
      if (!member || !canMemberReceiveReward(member)) {
        renderChestWindow(chest, "受け取れない。", "chooseRecipient");
        return;
      }
      if (!hasItemCapacity(member, loot.length)) {
        renderChestWindow(chest, `${member.name}は持ちきれない。`, "chooseRecipient");
        return;
      }
      const result = addItemsToMember(member, loot);
      if (!result.ok) {
        renderChestWindow(chest, `${member.name}は持ちきれない。`, "chooseRecipient");
        return;
      }
      chestState.pendingLoot = [];
      setChestOpened(key, chestState);
      scene = buildSceneGeometry();
      renderPartyCards();
      renderChestWindow(chest, `${member.name}は${result.accepted.join(" / ")}を得た。`, "main");
      setMessage("宝箱を開けた。", false);
      return;
    }
    if (action === "leaveLoot" || action === "finishOpen") {
      chestState.pendingLoot = [];
      finishChestWithoutLoot(chest, key, chestState, "宝箱を閉じた。");
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
    if (!ensurePartyCanActOrShow("全員が行動不能で、罠検知を切り替えられない。")) return;
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
      if (completedType === "move") {
        const statusLines = applyDungeonStepStatusEffects();
        if (statusLines.length) setMessage(statusLines.join(" / "), isPartyDefeated());
        if (isPartyDefeated()) {
          ensurePartyCanActOrShow("毒や状態異常により全員が行動不能になった。");
        } else {
          maybeOpenRandomEncounterAfterMove();
        }
      }
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
      if (key === "Escape" && state.focus !== "town") closeEventWindow();
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

  initializeTownState();
  normalizePartyStatuses();
  normalizePartyEquipment();
  renderPartyCards();
  if (state.message) setMessage(state.message, false);
  updateHud();
  openTownWindow("街で準備する。");
  requestAnimationFrame(render);
})();
