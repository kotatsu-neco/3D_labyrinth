# REPORT_v25

## 概要

v25では、v24で接続した敵反撃・プレイヤーHP減少・HP0時の `DOWN`・暫定逃走判定を維持し、次段階として勝利時の経験値とGOLD報酬を接続した。

アイテム戦利品、レベルアップ、宝テーブルの本接続はまだ行っていない。

## 変更内容

### バージョン・タイトル

- `app.js` の `BUILD_VERSION` を `v25` に変更。
- `index.html` の `<title>` を `暗澹の石櫃 v25` に変更。
- 画面上部HUDを `暗澹の石櫃 v25` に変更。
- キャッシュバスターを `20260612-v25` に変更。
- 戦闘ウィンドウのCSS基準クラスを `battle-window-v25` に更新。

### 勝利報酬

- 敵定義の `xp` を使い、遭遇内の敵インスタンス数から総EXPを計算する処理を追加。
- 遭遇デモに暫定 `gold: { min, max }` を追加。
- 戦闘開始時に、その戦闘の総GOLDを範囲内で決定する処理を追加。
- 勝利時にEXP/GOLDを生存中のメンバーへ整数配分する処理を追加。
- 端数は配分対象の先頭から1ずつ加算する暫定仕様にした。
- 報酬二重付与を防ぐため、`battle.reward.applied` を追加。

### 表示

- 戦闘結果パネルにEXP/GOLD獲得要約を表示。
- 戦闘LOGに `EXP n を得た。` / `GOLD n を得た。` / `n人に配分した。` を追加。
- ステータス詳細画面に `EXP` を追加。

### 維持したこと

- v24の敵反撃、HP減少、DOWN化、暫定逃走判定を維持。
- v23h/v24系の戦闘画面レイアウトを維持。
- LOG小窓は通常段に戻していない。
- コマンドは右カラムに押し込んでいない。
- アイテムはスタックさせていない。
- `quantity` / `weight` は導入していない。

## 変更ファイル

- `app.js`
- `style.css`
- `index.html`
- `README.md`
- `REPORT.md`
- `docs/COMBAT_RULES.md`
- `docs/PARAMETER_DESIGN_RULES.md`
- `docs/reports/REPORT_v25.md`

## 変更していないこと

- アイテム戦利品は未接続。
- レベルアップ処理は未接続。
- 宝テーブルの本接続は未接続。
- 呪文・道具の本効果は未接続。
- ランダム遭遇は未接続。
- 外部JSONの実行時読み込みは未接続。

## 確認済み

- `node --check app.js` 通過。
- `data/*.json` 全件パース成功。
- `BUILD_VERSION` が `v25` であることを確認。
- `index.html` の `<title>` とHUD表示が `暗澹の石櫃 v25` であることを確認。
- `index.html` のキャッシュバスターが `20260612-v25` であることを確認。
- `app.js` に `createBattleReward` / `applyBattleVictoryRewards` / `renderBattleRewardSummary` が存在することを確認。
- `style.css` 内の戦闘ウィンドウ基準クラスが `battle-window-v25` に更新されていることを確認。
- `app.js` / `data` に `quantity` / `weight` を導入していないことを確認。
- zip破損チェック通過。

## 未確認

- iPhone Safari実機表示。
- 戦闘勝利時のEXP/GOLD表示バランス。
- EXP追加後のステータス詳細画面の実機バランス。
- 報酬配分後のGOLD/EXP更新が実機操作上わかりやすいか。
- GitHubへの反映。

## 実機確認で見てほしい点

1. 敵撃破後、戦闘結果パネルにEXP/GOLD要約が収まっているか。
2. LOG小窓で報酬ログが読みづらくなっていないか。
3. ステータス詳細画面の `EXP` 追加で見づらさが戻っていないか。
4. GOLDが戦闘後に増えていることが分かるか。
5. v23h以降でOKとなった画面バランスを崩していないか。
