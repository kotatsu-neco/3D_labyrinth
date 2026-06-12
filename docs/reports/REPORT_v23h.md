# REPORT_v23h

## 概要

v23hでは、ユーザー指定のゲームタイトルを反映し、v23gのiPhone Safari実機スクリーンショット確認結果に基づいて戦闘LOG小窓を少しだけ縮小した。

タイトル表記は以下。

- 日本語タイトル: 暗澹の石櫃
- 読み: あんたんのせきひつ
- 英語表記: Stone Casket of Gloom

## 変更内容

### タイトル反映

- `index.html` の `<title>` を `暗澹の石櫃 v23h` に変更。
- 画面上部HUDを `暗澹の石櫃 v23h` に変更。
- `app.js` の `BUILD_VERSION` を `v23h` に変更。
- `app.js` の `PROTOTYPE_TITLE` を `暗澹の石櫃` に変更。
- `app.js` の `PROTOTYPE_SUBTITLE` を `Stone Casket of Gloom` に変更。
- キャッシュバスターを `20260612-v23h` に変更。

### 戦闘画面

- v23gで広げたLOG小窓を、スクリーンショット上のバランスに合わせて少し縮小。
- 通常幅ではLOG小窓を `min(46%, 292px)`、高さ `104px` に調整。
- iPhone SE相当の幅ではLOG小窓を `46%`、高さ `98px` に調整。
- LOG本文領域も縮小後の小窓に合わせて調整。
- 下部2列コマンドパッドはv23gの大きさを維持。
- LOG小窓の `×` と再表示用 `LOG` ボタンは維持。
- LOGは通常レイアウト内の段には戻していない。

### ステータス詳細画面

- v23gで追加した `AGE` 表示は維持。
- 所持アイテム欄の上寄せ表示は維持。
- `ATTRIBUTES` ラベルは復活させていない。

## 変更ファイル

- `app.js`
- `style.css`
- `index.html`
- `README.md`
- `REPORT.md`
- `docs/reports/REPORT_v23h.md`

## 変更していないこと

- 敵からの反撃は未実装。
- プレイヤーHPの戦闘中減少は未実装。
- 本式の逃走判定は未実装。
- 経験値・戦利品は未実装。
- 呪文・道具の本効果は未実装。
- 外部JSONの実行時読み込みは未実装。
- アイテムのスタック、`quantity`、`weight` は未導入。

## 確認済み

- `node --check app.js` 通過。
- `data/*.json` 全件パース成功。
- `BUILD_VERSION` が `v23h` であることを確認。
- `index.html` の `<title>` とHUD表示が `暗澹の石櫃 v23h` であることを確認。
- `index.html` のキャッシュバスターが `20260612-v23h` であることを確認。
- `app.js` の `PROTOTYPE_TITLE` / `PROTOTYPE_SUBTITLE` が指定タイトル表記であることを確認。
- `style.css` 内で `.battle-log-float` が `position: absolute` 指定であることを確認。
- `style.css` 末尾にv23hのLOG小窓縮小指定があることを確認。
- `app.js` の通常コマンド表示に `quantity` / `weight` を導入していないことを確認。
- zip破損チェック通過。

## 未確認

- iPhone Safari実機表示。
- LOG小窓縮小後の実機バランス。
- LOG小窓の閉じる/再表示がiPhone Safari実機で期待通り動くか。
- GitHubへの反映。

## 実機確認で見てほしい点

1. 画面上部タイトルが `暗澹の石櫃 v23h` として表示されるか。
2. 戦闘LOG小窓がv23gより少しだけ小さくなり、敵表示とのバランスがよいか。
3. 下部コマンドパッドがv23g同等に押しやすいか。
4. LOG小窓の閉じる/再表示が維持されているか。
5. ステータス詳細画面のAGE表示・所持アイテム上寄せが維持されているか。
