# PARAMETER_DESIGN_RULES

この文書は、アイテム、呪文、敵、遭遇、宝、状態異常が持つべきパラメータの設計方針を定義する。
実装前の正本候補であり、名称や文言は後で一覧化してユーザー確認後に正本化する。

## 1. 基本方針

- 表示名と内部IDを分離する。
- マスターデータとインスタンスデータを分離する。
- アイテム名、呪文名、敵名、説明文は仮名扱いとし、AI案だけで正本化しない。
- アイテムはスタックさせない。薬、鍵、文書、財宝を含め、所持欄上ではすべて1個ずつ扱う。
- アイテムに物理的な重さ `weight` は持たせない。所持制限を行う場合は、まず所持枠数で管理する。
- Wizardry風のAC、HP、前衛/後衛、呪文レベル別使用回数との整合を優先する。
- MP制にはしない。
- 敵にも必ずACを持たせる。

## 2. 共通パラメータ

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

`id` は内部処理用の固定IDであり、表示名変更後も変えない。
`displayName` は仮表示名であり、後でユーザー確認後に正本化する。

## 3. アイテム定義

アイテム種別のマスターデータ。

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

採用しない項目: `weight`, `stackable`, `maxStack`, `quantity`。
同じ薬を3つ持つ場合も、同じ `itemId` を参照する所持品インスタンスを3つ作る。

## 4. 所持品インスタンス

プレイヤーが実際に持っている1個のアイテム。

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

鑑定済みか、装備中か、残り使用回数などはインスタンス側で管理する。

## 5. 宝テーブル

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

`dropWeight` は抽選重みであり、物理重量ではない。
アイテムをスタックせず、生成数ぶんの所持品インスタンスを作る。

## 6. 呪文定義

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

呪文は `mage` / `priest` の系統と、1〜7の呪文レベルを持つ。
使用回数は系統×呪文レベルで管理し、MP制にはしない。

## 7. 敵定義

敵種別のマスターデータ。

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
  "xp": 20,
  "assetId": "enemy_asset_0001",
  "tags": [],
  "notes": ""
}
```

敵ACは必須。ACは命中判定用であり、ダメージ軽減値ではない。

## 8. 敵インスタンス

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

## 9. 遭遇テーブル

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

報酬は敵単体ではなく遭遇単位で管理する。

## 10. 状態異常定義

敵攻撃、呪文、アイテムが共通参照する。

候補: `ok`, `poison`, `sleep`, `silence`, `paralyze`, `stone`, `dead`, `ash`, `lost`。
Wizardry風にする場合、死亡、灰、ロストは状態遷移として別途慎重に設計する。

## 11. 禁止事項

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

## v25実装メモ: 戦闘報酬の暫定接続

v25では、既存の敵定義 `xp` と、遭遇側の暫定 `gold: { min, max }` を使い、勝利時のEXP/GOLD報酬だけを接続する。

実装上の扱い:

- EXPは敵定義側の `xp` を、出現インスタンス数ぶん合算する。
- GOLDは遭遇単位の `gold` 範囲から戦闘開始時に決定する。
- 報酬は勝利時点の生存メンバーへ配分する。
- キャラクターには暫定表示用の `xp` を持たせる。

未接続:

- レベルアップしきい値。
- レベルアップ時の能力値・HP・呪文回数変化。
- アイテム戦利品。
- 宝テーブルからのアイテムインスタンス生成。

引き続き、アイテムはスタックしない。`quantity` / `weight` は使用しない。

## v29実装メモ: 装備状態

v29では、既存の文字列所持品を実行時にアイテム個体へ正規化し、装備状態を個体側へ持たせる。

暫定形式:

```js
{ instanceId, name, equippedSlot }
```

- `instanceId` は同名アイテムを区別するための実行時ID。
- `name` は既存の仮アイテム名。
- `equippedSlot` は未装備なら `null`、装備中なら `weapon / armor / shield / head` のいずれか。
- 装備中アイテムは所持品欄から消さない。
- 装備中アイテムを渡す・捨てる場合は、処理内で装備状態を解除する。
- 有効ACは `effectiveMemberAc(member)` で計算する。
