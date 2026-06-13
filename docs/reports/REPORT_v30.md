# REPORT_v30

## 概要

- 対象: 暗澹の石櫃 / Stone Casket of Gloom
- バージョン: v30
- ベース: v29b
- 主目的: キャンプ内で `PRIEST 治癒` を使用可能にする。

## 変更内容

v30では、v29bまでのキャンプ・装備・アイテム操作を維持し、ロードマップ上の次項目である戦闘外呪文を最小範囲で接続した。

### 実装内容

- `app.js`
  - `BUILD_VERSION` を `v30` に更新。
  - 戦闘ウィンドウ基準クラスを `battle-window-v30` に更新。
  - `canCastCampPriestHeal(member)` を追加。
  - `hasCampPriestHealTarget()` を追加。
  - `campPriestHealTargetNotice()` を追加。
  - `useCampPriestHeal(caster, targetMemberId)` を追加。
  - `renderSpellWindow(memberId, notice)` を拡張し、キャンプ内呪文使用行を追加。
  - `renderCampSpellTargetWindow(memberId, notice)` を追加。
- `style.css`
  - `battle-window-v30` へ基準クラス更新。
  - キャンプ内呪文使用行 `.spell-cast-*` を追加。
- `index.html`
  - `<title>`、HUD、キャッシュバスターをv30へ更新。
- `README.md` / `REPORT.md` / `docs/reports/REPORT_v30.md`
  - v30内容へ更新。

### 戦闘外呪文仕様

- キャンプ内で使用可能にしたのは `PRIEST 治癒` のみ。
- `MAGE 火花` は一覧には出すが、戦闘中のみ扱いとしてキャンプ内では使用不可。
- 術者は `status === "OK"` かつ `hp > 0` が必要。
- 対象は生存中かつ負傷中の味方のみ。
- `DOWN` は対象外。
- 対象がいない場合は使用ボタンを無効化し、呪文回数を消費しない。
- 不正な対象、全快対象、DOWN対象では呪文回数を消費しない。
- 使用成功時だけ `spells.priest[0]` を1消費する。
- 回復量は戦闘中の `PRIEST 治癒` と同じ `1d8+2+PIE補正`。

## 検査

### 実施済み

- `node --check app.js`: 通過
- `data/*.json` 全7件パース: 成功
- HTMLバージョン表記確認: 成功
- キャッシュバスター確認: 成功
- `BUILD_VERSION = "v30"`: 確認
- `battle-window-v30` のJS/CSS整合確認: 成功
- CSS波括弧バランス確認: 成功
- `quantity` / `weight` 未導入確認: 検出なし
- VM上のキャンプ内 `PRIEST 治癒` ロジック/画面生成テスト: 通過
- zip破損チェック: 通過

### VMテストで確認したこと

- 負傷者がいる場合、呪文画面に `PRIEST 1 / 治癒 / 使用可能` が出る。
- 治癒対象画面に負傷者が表示される。
- 使用成功時、術者の `PRIEST` レベル1使用回数が1減る。
- 使用成功時、対象HPが最大HPを超えずに回復する。
- 全快対象では失敗し、呪文回数を消費しない。
- `DOWN` 対象では失敗し、呪文回数を消費しない。

### 未確認

- iPhone Safari実機表示。
- 実機でのキャンプ内呪文操作のタップ感。
- 呪文画面・治癒対象選択画面の視認性。
- GitHub Pages反映状態。

## 判定

静的検査、構文検査、VM上のロジック/画面生成テストの範囲では、v30の変更による実行破綻は検出していない。実機表示確認は未実施。
