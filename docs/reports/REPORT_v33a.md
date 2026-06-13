# REPORT v33a

## 実装概要

v33aでは、v33で追加されたキャンプ内の暫定要素を撤回した。
`休ませる` と `帰還` はキャンプから削除し、`ASLEEP / AFRAID` は戦闘終了時に回復する一時状態へ戻した。

## 反映内容

- キャンプメニューから `休ませる` を削除。
- キャンプメニューから `帰還` を削除。
- キャンプ内PRIEST呪文から `覚醒` を削除。
- `ASLEEP / AFRAID` を戦闘終了時に `OK` へ戻す処理を追加。
- 全員行動不能画面から `救出扱いで街へ戻る` を削除。
- `BUILD_VERSION` / `<title>` / HUD / キャッシュバスターを `v33a` に更新。
- `battle-window-v33a` / `spell-camp-v33a-frame` のJS/CSS整合を更新。

## 検査

- `node --check app.js`: 通過。
- `data/*.json` 全7件パース: 通過。
- 全テキストファイルUTF-8読み込み: 通過。
- CSS波括弧バランス: 通過。
- `BUILD_VERSION = "v33a"`: 確認。
- `index.html` の `暗澹の石櫃 v33a`: 確認。
- `20260612-v33a`: 確認。
- `battle-window-v33a`: JS/CSS整合確認。
- `spell-camp-v33a-frame`: JS/CSS整合確認。
- キャンプ内コマンドに `休ませる` / `帰還` が残っていないことを確認。
- キャンプ呪文に `覚醒` が残っていないことを確認。
- zip破損チェック: 通過。

## 未確認

- iPhone Safari実機表示。
- 実機での戦闘終了時ASLEEP/AFRAID回復ログ。
- GitHub Pages反映状態。
