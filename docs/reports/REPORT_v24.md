# REPORT_v24

## 概要

v24では、v23hで概ねOKとなった戦闘画面・ステータス詳細画面の構成を維持し、次段階として戦闘の往復処理を接続した。

主な追加は、敵からの反撃、プレイヤーHP減少、HP0時の `DOWN`、暫定逃走判定である。

## 変更内容

### バージョン・タイトル

- `app.js` の `BUILD_VERSION` を `v24` に変更。
- `index.html` の `<title>` を `暗澹の石櫃 v24` に変更。
- 画面上部HUDを `暗澹の石櫃 v24` に変更。
- キャッシュバスターを `20260612-v24` に変更。

### 戦闘処理

- 敵からプレイヤーへの反撃を追加。
- 敵攻撃により `PARTY_MEMBERS` のHPが減るようにした。
- HPが0になったキャラクターは `DOWN` に変更。
- 行動可能メンバー判定は従来どおり `status === "OK"` かつ `hp > 0`。
- 敵の攻撃対象は、前衛が生存している間は前衛から選び、前衛全滅後のみ後衛から選ぶ。
- `守る` を選んだキャラクターは、そのラウンド中だけ敵命中判定に防御補正を得る。
- `守る` 中に命中した場合、受けるダメージを半減寄りにする。
- `逃げる` を即時成功から暫定判定に変更。
- 逃走判定は、AGIと生存敵数を見た暫定式にした。

### AC処理

- ACは低いほどよいという既存ルールに合わせ、低ACほど命中に必要な値が高くなるように `hitTargetNumberForAc(ac)` を追加。
- プレイヤー攻撃時は敵ACを参照。
- 敵攻撃時はプレイヤーACを参照。

### 画面・レイアウト

- 戦闘画面の基本レイアウトはv23hのまま維持。
- LOG小窓の通常段戻しはしていない。
- 下部2列コマンドパッドを維持。
- ステータス詳細画面の2カラム構成、AGE表示、所持品上寄せを維持。

### 正本文書

- `docs/COMBAT_RULES.md` にv24暫定戦闘処理を追記。
- `docs/STORY_CORE.md` にタイトル表記を反映。
- `docs/DUNGEON_DESIGN_RULES.md` / `docs/UI_STYLE_RULES.md` / `docs/VISUAL_AND_LIGHTING_RULES.md` の仮タイトル表記を更新。
- `docs/LAYER_DESIGN_RULES.md` のタイトル仮置き記述を更新。

## 変更ファイル

- `app.js`
- `style.css`
- `index.html`
- `README.md`
- `REPORT.md`
- `docs/COMBAT_RULES.md`
- `docs/STORY_CORE.md`
- `docs/DUNGEON_DESIGN_RULES.md`
- `docs/UI_STYLE_RULES.md`
- `docs/VISUAL_AND_LIGHTING_RULES.md`
- `docs/LAYER_DESIGN_RULES.md`
- `docs/reports/REPORT_v24.md`

## 変更していないこと

- 呪文・道具の本効果は未接続。
- 経験値・戦利品は未接続。
- 宝テーブル接続は未接続。
- ランダム遭遇は未接続。
- 外部JSONの実行時読み込みは未接続。
- アイテムのスタック、`quantity`、`weight` は未導入。

## 確認済み

- `node --check app.js` 通過。
- `data/*.json` 全件パース成功。
- `BUILD_VERSION` が `v24` であることを確認。
- `index.html` の `<title>` とHUD表示が `暗澹の石櫃 v24` であることを確認。
- `index.html` のキャッシュバスターが `20260612-v24` であることを確認。
- `app.js` 内に `resolveEnemyCounterattacks` / `resolveEscapeAttempt` / `hitTargetNumberForAc` が存在することを確認。
- `style.css` 内の戦闘ウィンドウ基準クラスが `battle-window-v24` に更新されていることを確認。
- `app.js` / `data` に `quantity` / `weight` を導入していないことを確認。
- zip破損チェック通過。

## 未確認

- iPhone Safari実機表示。
- 敵反撃、HP減少、DOWN表示、逃走判定の実機体感。
- LOG小窓で複数ログが流れるときの読みやすさ。
- GitHubへの反映。

## 実機確認で見てほしい点

1. 攻撃決定後、敵の反撃ログが読めるか。
2. 敵反撃でパーティHPが減っていることが分かるか。
3. HPが0になったキャラクターが `DOWN` になり、次ラウンドの入力対象から外れるか。
4. `守る` が体感上、被害軽減として機能しているか。
5. `逃げる` が即時成功ではなく、成功/失敗のログとして自然に見えるか。
6. v23hでOKだった画面バランスが崩れていないか。
