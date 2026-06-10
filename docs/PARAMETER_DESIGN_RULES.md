# PARAMETER_DESIGN_RULES

この文書は、アイテム、呪文、敵が持つべきパラメータの設計方針を定義する。
実装前の正本候補であり、名称や文言は後で一覧化してユーザー確認後に正本化する。

関連文書:

- `docs/STORY_CORE.md`
- `docs/LAYER_DESIGN_RULES.md`
- `docs/COMBAT_RULES.md`
- `docs/WIZARDRY_REFERENCE_NOTES.md`

## 1. 基本方針

- データは後から差し替えやすいJSON形式を前提に設計する。
- アイテム名、呪文名、敵名、説明文、碑文、イベント本文は仮名扱いとし、AI案だけで正本化しない。
- 表示用名称と内部IDを分離する。
- 画像・音・演出はパラメータ本体から分離し、参照IDで結びつける。
- まずは最小戦闘ループに必要な項目を優先し、過度に細かい属性や例外処理は後段へ回す。
- Wizardry風のAC、HP、職業、前衛/後衛、呪文レベル別使用回数との整合を優先する。

## 2. 共通パラメータ

アイテム、呪文、敵に共通して持たせる基本項目。

```json
{
  "id": "internal_id",
  "displayName": "仮表示名",
  "sortKey": 100,
  "tags": [],
  "isImplemented": false,
  "notes": ""
}
```

### id

- 内部処理用の固定ID。
- 英小文字、数字、アンダースコアで構成する。
- 表示名変更後も変えない。
- 例: `enemy_low_goblin_01`, `item_short_sword`, `spell_light_01`

### displayName

- ゲーム画面に出す仮表示名。
- 後でユーザーがまとめて修正する。
- 正本化前の名称は採用名ではない。

### sortKey

- 一覧表示やデバッグ表示での並び順。
- 階層、種類、重要度に応じて設定する。

### tags

- 分類、検索、デバッグ、将来のフィルタ用。
- 例: `shallow`, `beast`, `weapon`, `priest_spell`, `locked_chest_reward`

### isImplemented

- 実装済みかどうか。
- データだけ先に作る場合は `false`。

### notes

- 設計メモ。
- 表示用本文として使わない。

## 3. アイテムパラメータ

### 3.1 基本構造

```json
{
  "id": "item_short_sword",
  "displayName": "短剣",
  "category": "weapon",
  "subtype": "blade",
  "rarity": "common",
  "tier": 1,
  "identified": true,
  "cursed": false,
  "equippableBy": ["FIG", "THI", "BIS"],
  "slot": "weapon",
  "price": 20,
  "weight": 1,
  "combat": {},
  "useEffect": null,
  "keyEffect": null,
  "sourceLayer": "shallow",
  "tags": [],
  "notes": ""
}
```

### 3.2 category

アイテムの大分類。

- `weapon`: 武器
- `armor`: 防具
- `shield`: 盾
- `accessory`: 指輪・護符など
- `consumable`: 消耗品
- `key`: 鍵・通行具・証
- `treasure`: 換金品・財宝
- `document`: 記録片・文書・地図
- `quest`: 進行上重要な品
- `unknown`: 未分類・仮分類

### 3.3 subtype

分類内の詳細種別。

例:

- 武器: `blade`, `mace`, `staff`, `bow`, `dagger`
- 防具: `light_armor`, `heavy_armor`, `robe`
- 消耗品: `healing`, `cure_status`, `light`, `trap_detection`
- 文書: `record`, `map`, `sealed_note`

### 3.4 rarity

希少度。

- `common`
- `uncommon`
- `rare`
- `unique`
- `story`

希少度は強さだけではなく、入手頻度・売却価値・物語上の重要度にも関わる。

### 3.5 tier

階層進行に応じた段階。

- 浅層: `1`
- 中層: `2`
- 深層: `3`
- 最深層: `4`
- 例外的な物語重要品: `0` または個別指定

### 3.6 identified

鑑定済みかどうか。

- `true`: 表示名・性能が明らか。
- `false`: 未鑑定。仮名や曖昧表示にする。

未鑑定システムを入れる場合、表示名と真名を分ける。

```json
{
  "displayName": "古びた剣",
  "trueName": "後で決める正式名",
  "identified": false
}
```

### 3.7 cursed

呪われたアイテムかどうか。

- 装備解除不可
- ACや命中に悪影響
- 特殊イベント発生

などに接続する。

### 3.8 equippableBy

装備可能な職業略称。

- `FIG`
- `MAG`
- `PRI`
- `THI`
- `BIS`
- 今後職業追加がある場合は追加定義する。

### 3.9 slot

装備部位。

- `weapon`
- `armor`
- `shield`
- `head`
- `hands`
- `accessory`
- `none`

初期実装では、`weapon`, `armor`, `shield`, `accessory` 程度に絞ってよい。

### 3.10 combat

戦闘に関わるアイテム性能。

```json
{
  "hitBonus": 0,
  "damageDice": "1d6",
  "damageBonus": 0,
  "acBonus": 0,
  "attacksBonus": 0,
  "criticalBonus": 0,
  "specialVs": []
}
```

#### hitBonus

命中補正。

#### damageDice

武器ダメージの基礎ダイス。

例:

- `1d4`
- `1d6`
- `1d8`
- `2d4`

#### damageBonus

固定ダメージ補正。

#### acBonus

AC補正。
ACは低いほど良いので、良い防具は負の補正を持つ場合がある。
例: `-1`, `-2`

#### attacksBonus

複数回攻撃に関わる将来拡張用。
初期実装では `0` 固定でよい。

#### criticalBonus

クリティカル補正。
初期実装では `0` 固定でよい。

#### specialVs

特効対象。

例:

- `undead`
- `beast`
- `spirit`
- `humanoid`

初期実装では未使用でもよい。

### 3.11 useEffect

アイテム使用時効果。

```json
{
  "type": "heal_hp",
  "value": "1d8",
  "target": "ally_single",
  "consumed": true
}
```

候補:

- `heal_hp`
- `cure_status`
- `light`
- `detect_trap`
- `escape`
- `damage_enemy`
- `none`

初期実装では、使用処理を入れない場合もデータ項目だけ用意する。

### 3.12 keyEffect

鍵・証・進行アイテムとしての効果。

```json
{
  "opens": ["door_b1_05"],
  "requiredFor": ["stairs_b2"],
  "consumed": false
}
```

## 4. 呪文パラメータ

### 4.1 基本構造

```json
{
  "id": "spell_mage_light_01",
  "displayName": "仮呪文名",
  "school": "mage",
  "spellLevel": 1,
  "target": "party",
  "timing": "camp_or_explore",
  "effect": {},
  "combatUse": false,
  "exploreUse": true,
  "campUse": true,
  "tags": [],
  "notes": ""
}
```

### 4.2 school

呪文系統。

- `mage`: 魔術師系
- `priest`: 僧侶・祈祷系

表示名は後で決める。
内部処理では `mage` / `priest` を固定する。

### 4.3 spellLevel

呪文レベル。

- 1〜7

Wizardry風の7レベル別使用回数と対応させる。
MP制にはしない。

### 4.4 target

対象。

- `self`
- `ally_single`
- `ally_all`
- `enemy_single`
- `enemy_group`
- `enemy_all`
- `party`
- `floor`
- `door`
- `chest`
- `none`

### 4.5 timing

使用できる場面。

- `combat`
- `camp`
- `explore`
- `camp_or_explore`
- `any`

### 4.6 effect

呪文効果。

```json
{
  "type": "heal_hp",
  "value": "1d8",
  "duration": 0,
  "status": null,
  "element": null
}
```

候補:

- `heal_hp`
- `damage`
- `sleep`
- `silence`
- `cure_status`
- `light`
- `detect_trap`
- `identify_trap`
- `protect_ac`
- `escape`
- `map_hint`
- `unlock`
- `none`

### 4.7 combatUse / exploreUse / campUse

各場面で使用できるかを明示する。

- 戦闘呪文は `combatUse: true`
- 探索補助呪文は `exploreUse: true`
- 回復・解呪系は `campUse: true`

### 4.8 usesSpellSlot

呪文使用回数を消費するか。

```json
{
  "usesSpellSlot": true
}
```

初期設計では、通常呪文はすべて使用回数を消費する。
イベント専用効果は例外的に `false` にできる。

### 4.9 powerScale

レベル・職業・能力値による効果量補正。

```json
{
  "base": "1d8",
  "perCasterLevel": 0,
  "stat": "PIE"
}
```

初期実装では、固定値または固定ダイスでよい。
複雑な補正は後段へ回す。

## 5. 敵パラメータ

### 5.1 基本構造

```json
{
  "id": "enemy_shallow_beast_01",
  "displayName": "仮敵名",
  "layerBand": "shallow",
  "family": "beast",
  "rank": 1,
  "level": 1,
  "hp": { "dice": "1d8", "fixed": 0 },
  "ac": 8,
  "attacks": [],
  "morale": 50,
  "resistances": {},
  "weaknesses": [],
  "specialActions": [],
  "xp": 20,
  "gold": { "min": 0, "max": 5 },
  "dropTableId": "treasure_shallow_common",
  "assetId": "enemy_asset_0001",
  "encounter": {},
  "tags": [],
  "notes": ""
}
```

### 5.2 layerBand

主な出現階層帯。

- `shallow`
- `middle`
- `deep`
- `core`
- `special`

`docs/LAYER_DESIGN_RULES.md` と対応させる。

### 5.3 family

敵の生態・分類。

候補:

- `beast`
- `insect`
- `slime`
- `humanoid`
- `goblin`
- `orc`
- `troll`
- `undead`
- `spirit`
- `construct`
- `mage`
- `priest`
- `guardian`
- `aberration`
- `boss`

### 5.4 rank

同一階層内での強さ・希少度。

- `1`: 雑魚
- `2`: やや強い
- `3`: 危険敵
- `4`: 固定敵・階層主級
- `5`: ボス級

### 5.5 level

戦闘計算用レベル。

- 命中力
- 抵抗判定
- 経験値
- 出現階層

の基礎値になる。

### 5.6 hp

HP。

```json
{
  "dice": "2d8",
  "fixed": 4
}
```

ダイス式を基本とし、固定値補正を持てるようにする。

### 5.7 ac

敵のAC。

- `docs/COMBAT_RULES.md` に従い、ACは低いほど良い。
- 敵もACを必ず持つ。
- ACはダメージ軽減ではなく、命中判定に使う。

### 5.8 attacks

敵の攻撃リスト。

```json
[
  {
    "name": "attack_1",
    "target": "front_single",
    "hitBonus": 0,
    "damageDice": "1d6",
    "damageBonus": 0,
    "element": "physical",
    "statusEffect": null,
    "chance": 100
  }
]
```

#### target

- `front_single`: 前衛単体
- `any_single`: 単体
- `front_group`: 前衛複数
- `party_all`: パーティ全体

初期実装では `front_single` 中心でよい。

#### element

- `physical`
- `fire`
- `cold`
- `poison`
- `holy`
- `dark`
- `none`

初期実装では `physical` と `none` 程度に絞ってよい。

#### statusEffect

状態異常。

候補:

- `poison`
- `sleep`
- `silence`
- `paralyze`
- `fear`
- `none`

初期実装では未使用でもよい。

### 5.9 morale

逃走・行動継続の基準値。

- 0〜100
- 高いほど逃げにくい。

初期実装では未使用でもよいが、将来の逃走・降伏・撤退判定用に持つ。

### 5.10 resistances / weaknesses

耐性と弱点。

```json
{
  "resistances": {
    "sleep": 50,
    "poison": 100
  },
  "weaknesses": ["holy"]
}
```

値は抵抗率または補正値として扱う。
初期実装では空でよい。

### 5.11 specialActions

特殊行動。

候補:

- `cast_spell`
- `call_allies`
- `breath`
- `drain_level`
- `poison_attack`
- `guard`
- `flee`

初期実装では未使用でも、データ項目だけ用意する。

### 5.12 xp / gold / dropTableId

報酬。

- `xp`: 経験値
- `gold`: 金銭範囲
- `dropTableId`: 宝テーブル参照

階層が深いほど報酬は上がるが、単なるゲーム都合ではなく、階層用途・保管物・敵の社会性と接続する。

### 5.13 assetId

敵画像アセット参照ID。

敵画像は高解像度のまま使わない。
本作では、あえて十分に劣化させた低解像度・減色版を戦闘画面に使う。

画像劣化方針は別途 `docs/ENEMY_IMAGE_PROCESSING_RULES.md` で定義する。

### 5.14 encounter

遭遇制御。

```json
{
  "minCount": 1,
  "maxCount": 4,
  "groupType": "same",
  "weight": 100,
  "allowedFloors": ["B1F"],
  "fixedOnly": false
}
```

#### minCount / maxCount

出現数。

#### groupType

- `same`: 同種群れ
- `mixed`: 混成
- `single`: 単体
- `boss`: 固定ボス

#### weight

ランダム遭遇時の出現重み。

#### allowedFloors

出現可能フロア。

#### fixedOnly

固定配置専用かどうか。

## 6. 初期実装で最低限必要な項目

### アイテム

- `id`
- `displayName`
- `category`
- `rarity`
- `tier`
- `identified`
- `cursed`
- `slot`
- `equippableBy`
- `combat`
- `useEffect`
- `keyEffect`

### 呪文

- `id`
- `displayName`
- `school`
- `spellLevel`
- `target`
- `timing`
- `effect`
- `combatUse`
- `exploreUse`
- `campUse`
- `usesSpellSlot`

### 敵

- `id`
- `displayName`
- `layerBand`
- `family`
- `rank`
- `level`
- `hp`
- `ac`
- `attacks`
- `xp`
- `gold`
- `dropTableId`
- `assetId`
- `encounter`

## 7. 後回しにする項目

以下はデータ項目を用意してもよいが、初期実装では処理しない。

- クリティカル
- 複数回攻撃
- レベルドレイン
- 高度な属性耐性
- 混成敵グループ
- 敵の逃走・士気
- アイテムの耐久度
- 鑑定失敗
- 呪文反射
- 召喚
- 交渉

## 8. 禁止事項

- 表示名を内部IDとして使わない。
- アイテム名、呪文名、敵名をAI案だけで正本化しない。
- 敵ACを省略しない。
- ACをダメージ軽減値として扱わない。
- MP制にしない。
- 呪文使用回数を単一MPに置き換えない。
- 敵画像を高解像度のまま戦闘画面に直接使わない。
- 戦闘本実装前に、敵・アイテム・呪文データをコード内へ散らさない。
