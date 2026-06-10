# PARAMETER_DESIGN_RULES

この文書は、アイテム、呪文、敵、遭遇、宝、状態異常が持つべきパラメータの設計方針を定義する。
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
- マスターデータとインスタンスデータを分離する。
- まずは最小戦闘ループに必要な項目を優先し、過度に細かい属性や例外処理は後段へ回す。
- Wizardry風のAC、HP、職業、前衛/後衛、呪文レベル別使用回数との整合を優先する。
- アイテムはスタックさせない。薬、鍵、文書、財宝を含め、所持欄上ではすべて1個ずつ扱う。
- アイテムに物理的な重さ `weight` は持たせない。所持制限を行う場合は、まず所持枠数で管理する。

## 2. 共通パラメータ

各マスターデータに共通して持たせる基本項目。

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

## 3. マスターデータとインスタンスデータの分離

同じ種類のアイテムや敵でも、ゲーム内で実際に存在している個体とは分けて扱う。

### マスターデータ

- アイテム種別、呪文種別、敵種別の固定定義。
- 基礎性能、分類、装備可否、効果、画像参照などを持つ。
- 表示名の修正やバランス調整はマスター側で行う。

### インスタンスデータ

- プレイヤーが所持している1個のアイテム。
- 戦闘中に出現している1体の敵。
- 鑑定済みか、装備中か、残り使用回数、現在HPなど、状態を持つ。

## 4. アイテム定義

### 4.1 基本構造

```json
{
  "id": "item_short_sword",
  "displayName": "仮アイテム名",
  "unknownName": "仮未鑑定名",
  "category": "weapon",
  "subtype": "blade",
  "rarity": "common",
  "tier": 1,
  "slot": "weapon",
  "equippableBy": ["FIG", "THI", "BIS"],
  "price": 20,
  "sellPrice": 10,
  "unique": false,
  "sellable": true,
  "droppable": true,
  "questItem": false,
  "curseType": "none",
  "chargesMax": null,
  "combat": {},
  "useEffect": null,
  "keyEffect": null,
  "usableIn": ["camp"],
  "sourceLayer": "shallow",
  "tags": [],
  "notes": ""
}
```

### 4.2 category

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

### 4.3 subtype

分類内の詳細種別。

例:

- 武器: `blade`, `mace`, `staff`, `bow`, `dagger`
- 防具: `light_armor`, `heavy_armor`, `robe`
- 消耗品: `healing`, `cure_status`, `light`, `trap_detection`
- 文書: `record`, `map`, `sealed_note`

### 4.4 rarity

希少度。

- `common`
- `uncommon`
- `rare`
- `unique`
- `story`

希少度は強さだけではなく、入手頻度、売却価値、物語上の重要度にも関わる。

### 4.5 tier

階層進行に応じた段階。

- 浅層: `1`
- 中層: `2`
- 深層: `3`
- 最深層: `4`
- 例外的な物語重要品: `0` または個別指定

### 4.6 unknownName

未鑑定時の表示名。

- 正式な名称とは別に持つ。
- 未鑑定状態はアイテムインスタンス側で管理する。
- 名称そのものは後でユーザー確認後に正本化する。

### 4.7 slot

装備部位。

- `weapon`
- `armor`
- `shield`
- `head`
- `hands`
- `accessory`
- `none`

初期実装では、`weapon`, `armor`, `shield`, `accessory` 程度に絞ってよい。

### 4.8 equippableBy

装備可能な職業略称。

- `FIG`
- `MAG`
- `PRI`
- `THI`
- `BIS`
- 今後職業追加がある場合は追加定義する。

### 4.9 unique / sellable / droppable / questItem

- `unique`: 一品物かどうか。
- `sellable`: 店などで売却できるか。
- `droppable`: 捨てられるか。
- `questItem`: 進行に関わる重要品か。

重要品は `sellable: false`, `droppable: false` を原則とする。

### 4.10 curseType

呪いの種類。

- `none`
- `equip_lock`: 装備解除不可
- `stat_penalty`: 能力値やACなどに悪影響
- `event`: 特定イベントに関係

呪われているかどうかをプレイヤーが知っているかは、アイテムインスタンス側で管理する。

### 4.11 chargesMax

使用回数の最大値。

- 杖、巻物、特殊道具などに使う。
- 使用回数を持たないアイテムは `null`。
- 残り使用回数はアイテムインスタンス側で管理する。

### 4.12 combat

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

- `hitBonus`: 命中補正。
- `damageDice`: 武器ダメージの基礎ダイス。
- `damageBonus`: 固定ダメージ補正。
- `acBonus`: AC補正。ACは低いほど良いので、良い防具は負の補正を持つ場合がある。
- `attacksBonus`: 複数回攻撃に関わる将来拡張用。
- `criticalBonus`: クリティカル補正。
- `specialVs`: 特効対象。

初期実装では `attacksBonus`, `criticalBonus`, `specialVs` は未使用でもよい。

### 4.13 useEffect

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

### 4.14 keyEffect

鍵・証・進行アイテムとしての効果。

```json
{
  "opens": ["door_b1_05"],
  "requiredFor": ["stairs_b2"],
  "consumed": false
}
```

### 4.15 usableIn

使用できる場面。

- `combat`
- `camp`
- `explore`
- `event`

装備品のように使用しないものは空配列でもよい。

### 4.16 採用しない項目

以下は初期設計では採用しない。

- `weight`: 物理重量。
- `stackable`: スタック可否。
- `maxStack`: 最大スタック数。
- `quantity`: アイテム定義側の個数。

アイテムはすべて1個ずつのインスタンスとして扱う。薬を3つ持つ場合も、同じ `itemId` を参照する所持品インスタンスが3つ存在する。

## 5. 所持品インスタンス

プレイヤーが実際に持っている1個のアイテムを表す。

```json
{
  "instanceId": "inv_000001",
  "itemId": "item_short_sword",
  "ownerCharacterId": "adel",
  "identified": true,
  "equipped": true,
  "knownCursed": false,
  "chargesRemaining": null,
  "createdFrom": "treasure_shallow_common"
}
```

### instanceId

- 所持品1個ごとの固有ID。
- 同じアイテムを複数持つ場合でも、インスタンスIDは別にする。

### itemId

- 参照するアイテム定義ID。

### ownerCharacterId

- 誰が持っているか。
- パーティ共有所持品を採用する場合は、`party` などの特別値を使う。

### identified

- その個体を鑑定済みかどうか。

### equipped

- 装備中かどうか。

### knownCursed

- プレイヤーが呪いを認識しているか。
- 実際の呪い種別はアイテム定義側の `curseType` に置く。

### chargesRemaining

- 残り使用回数。
- 使用回数を持たないアイテムは `null`。

## 6. 宝テーブル

宝箱や戦闘報酬は、アイテム定義ではなく宝テーブルで管理する。

```json
{
  "id": "treasure_shallow_common",
  "layerBand": "shallow",
  "gold": { "min": 0, "max": 20 },
  "entries": [
    {
      "itemId": "item_heal_small",
      "dropWeight": 40,
      "minInstances": 1,
      "maxInstances": 2
    }
  ]
}
```

### dropWeight

- 抽選重み。
- 物理重量ではない。
- `weight` という名称は使わない。

### minInstances / maxInstances

- 生成するアイテムインスタンス数。
- 薬が2個出た場合は、同じ `itemId` のインスタンスを2つ作る。
- アイテムをスタックして `quantity: 2` にはしない。

## 7. 呪文定義

### 7.1 基本構造

```json
{
  "id": "spell_mage_light_01",
  "displayName": "仮呪文名",
  "school": "mage",
  "spellLevel": 1,
  "learnedBy": ["MAG", "BIS"],
  "targetRule": "party",
  "timing": "camp_or_explore",
  "effect": {},
  "combatUse": false,
  "exploreUse": true,
  "campUse": true,
  "usesSpellSlot": true,
  "resistType": "none",
  "resistModifier": 0,
  "element": "none",
  "duration": 0,
  "messageKey": "spell_light_01",
  "tags": [],
  "notes": ""
}
```

### 7.2 school

呪文系統。

- `mage`: 魔術師系
- `priest`: 僧侶・祈祷系

表示名は後で決める。内部処理では `mage` / `priest` を固定する。

### 7.3 spellLevel

呪文レベル。

- 1〜7

Wizardry風の7レベル別使用回数と対応させる。MP制にはしない。

### 7.4 learnedBy

その呪文を覚えられる職業。

例:

- `MAG`
- `PRI`
- `BIS`

### 7.5 targetRule

対象ルール。

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

### 7.6 timing / combatUse / exploreUse / campUse

使用場面を定義する。

- `combat`: 戦闘中
- `camp`: キャンプ中
- `explore`: 探索中
- `camp_or_explore`: キャンプまたは探索中
- `any`: 場面を問わない

個別の真偽値も持たせ、UI側で判定しやすくする。

### 7.7 effect

呪文効果。

```json
{
  "type": "heal_hp",
  "value": "1d8",
  "status": null
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

### 7.8 usesSpellSlot

呪文使用回数を消費するか。

初期設計では、通常呪文はすべて使用回数を消費する。
イベント専用効果は例外的に `false` にできる。

### 7.9 resistType / resistModifier

敵の抵抗判定に使う。

- `none`
- `sleep`
- `silence`
- `poison`
- `death`
- `spell`

初期実装では簡易化してよい。

### 7.10 element

属性。

- `none`
- `physical`
- `fire`
- `cold`
- `poison`
- `holy`
- `dark`

初期実装では `none` と `physical` 中心でよい。

### 7.11 duration

持続ターンまたは探索中の持続単位。

- 即時効果は `0`。
- 持続効果は数値を入れる。

### 7.12 messageKey

表示文をコードから分離するためのキー。

- 呪文名や本文をコード内に直書きしない。
- 実際の表示文は後で文言リストとして管理する。

## 8. 敵定義

### 8.1 基本構造

```json
{
  "id": "enemy_shallow_beast_01",
  "displayName": "仮敵名",
  "layerBand": "shallow",
  "family": "beast",
  "rank": 1,
  "level": 1,
  "alignment": "neutral",
  "size": "small",
  "intelligence": 1,
  "behaviorType": "beast",
  "initiative": 0,
  "hp": { "dice": "1d8", "fixed": 0 },
  "ac": 8,
  "attacks": [],
  "spellcasting": null,
  "resistances": {},
  "weaknesses": [],
  "statusImmunities": [],
  "turnResistance": 0,
  "specialActions": [],
  "xp": 20,
  "assetId": "enemy_asset_0001",
  "isBoss": false,
  "isFixedEnemy": false,
  "tags": [],
  "notes": ""
}
```

### 8.2 layerBand

主な出現階層帯。

- `shallow`
- `middle`
- `deep`
- `core`
- `special`

`docs/LAYER_DESIGN_RULES.md` と対応させる。

### 8.3 family

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

### 8.4 rank / level

- `rank`: 同一階層内での強さ・希少度。
- `level`: 戦闘計算用レベル。

### 8.5 alignment

敵の性質。

- `good`
- `neutral`
- `evil`
- `holy`
- `cursed`
- `none`

初期実装では戦闘式に使わなくてもよい。

### 8.6 size

敵の大きさ。

- `small`
- `medium`
- `large`
- `huge`

出現数、画像表示、攻撃対象範囲に使える。

### 8.7 intelligence

知性の目安。

- 0: ほぼ本能
- 1: 低知性
- 2: 群れ・道具使用
- 3: 言語・戦術
- 4: 魔術・信仰・社会構造
- 5: 管理者・ボス級

浅層から深層への階層勾配と接続する。

### 8.8 behaviorType

行動傾向。

- `beast`
- `guard`
- `caster`
- `priest`
- `swarm`
- `ambush`
- `boss`

### 8.9 initiative

先制・奇襲に関わる補正。

### 8.10 hp

HP。

```json
{
  "dice": "2d8",
  "fixed": 4
}
```

ダイス式を基本とし、固定値補正を持てるようにする。

### 8.11 ac

敵のAC。

- `docs/COMBAT_RULES.md` に従い、ACは低いほど良い。
- 敵もACを必ず持つ。
- ACはダメージ軽減ではなく、命中判定に使う。

### 8.12 attacks

敵の攻撃リスト。

```json
[
  {
    "id": "attack_1",
    "targetRule": "front_single",
    "hitBonus": 0,
    "damageDice": "1d6",
    "damageBonus": 0,
    "element": "physical",
    "statusEffect": null,
    "chance": 100,
    "messageKey": "enemy_attack_default"
  }
]
```

### 8.13 spellcasting

敵が呪文を使う場合の設定。

```json
{
  "school": "mage",
  "spellLevelMax": 2,
  "spellIds": ["spell_mage_sleep_01"],
  "chance": 30
}
```

初期実装では未使用でもよい。

### 8.14 resistances / weaknesses / statusImmunities

耐性、弱点、状態異常無効。

初期実装では空でよいが、睡眠・毒・沈黙・不死者・精霊などの処理に必要になる。

### 8.15 turnResistance

不死者退散系の処理を将来入れる場合の抵抗値。
初期実装では `0` 固定でよい。

### 8.16 xp

経験値。

敵定義側の基礎値として持つ。
最終的な戦闘報酬は遭遇グループ側で補正してよい。

### 8.17 assetId

敵画像アセット参照ID。

敵画像は高解像度のまま使わない。
本作では、あえて十分に劣化させた低解像度・減色版を戦闘画面に使う。

画像劣化方針は別途 `docs/ENEMY_IMAGE_PROCESSING_RULES.md` で定義する。

## 9. 敵インスタンス

戦闘中に実際に出現している1体の敵。

```json
{
  "instanceId": "enemy_inst_000001",
  "enemyId": "enemy_shallow_beast_01",
  "currentHp": 6,
  "statusEffects": [],
  "positionGroup": 0
}
```

## 10. 遭遇テーブル

敵定義と、どこで何体出るかを分離する。

```json
{
  "id": "encounter_b1_shallow_common",
  "floorId": "B1F",
  "layerBand": "shallow",
  "entries": [
    {
      "enemyId": "enemy_shallow_beast_01",
      "dropWeight": 100,
      "minInstances": 1,
      "maxInstances": 4,
      "groupType": "same"
    }
  ],
  "treasureTableId": "treasure_shallow_common",
  "gold": { "min": 0, "max": 10 }
}
```

### groupType

- `same`: 同種群れ
- `mixed`: 混成
- `single`: 単体
- `boss`: 固定ボス

### treasureTableId / gold

戦闘後の報酬。
敵単体ではなく遭遇単位で管理する。

## 11. 状態異常定義

敵攻撃、呪文、アイテムが共通参照する。

```json
{
  "id": "poison",
  "displayName": "仮状態名",
  "type": "bad",
  "durationType": "until_cured",
  "combatEffect": {},
  "exploreEffect": {},
  "curableBy": ["spell_priest_cure_poison_01", "item_cure_poison_01"]
}
```

候補:

- `ok`
- `poison`
- `sleep`
- `silence`
- `paralyze`
- `stone`
- `dead`
- `ash`
- `lost`

Wizardry風にする場合、死亡、灰、ロストは状態遷移として別途慎重に設計する。

## 12. 初期実装で最低限必要な項目

### アイテム定義

- `id`
- `displayName`
- `unknownName`
- `category`
- `subtype`
- `rarity`
- `tier`
- `slot`
- `equippableBy`
- `price`
- `sellPrice`
- `unique`
- `sellable`
- `droppable`
- `questItem`
- `curseType`
- `chargesMax`
- `combat`
- `useEffect`
- `keyEffect`
- `usableIn`

### 所持品インスタンス

- `instanceId`
- `itemId`
- `ownerCharacterId`
- `identified`
- `equipped`
- `knownCursed`
- `chargesRemaining`

### 呪文定義

- `id`
- `displayName`
- `school`
- `spellLevel`
- `learnedBy`
- `targetRule`
- `timing`
- `effect`
- `combatUse`
- `exploreUse`
- `campUse`
- `usesSpellSlot`
- `messageKey`

### 敵定義

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
- `assetId`

### 遭遇テーブル

- `id`
- `floorId`
- `layerBand`
- `entries`
- `treasureTableId`
- `gold`

## 13. 後回しにする項目

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
- 物理重量や装備重量
- アイテムスタック

## 14. 禁止事項

- 表示名を内部IDとして使わない。
- アイテム名、呪文名、敵名をAI案だけで正本化しない。
- 敵ACを省略しない。
- ACをダメージ軽減値として扱わない。
- MP制にしない。
- 呪文使用回数を単一MPに置き換えない。
- アイテムをスタック管理しない。
- アイテムの所持数を `quantity` で管理しない。
- アイテムに物理重量 `weight` を持たせない。
- 敵画像を高解像度のまま戦闘画面に直接使わない。
- 戦闘本実装前に、敵・アイテム・呪文データをコード内へ散らさない。
