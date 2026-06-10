# 灰の目録 3Dダンジョン試作 最新作業報告

## 現在版

- 最新試作: v14
- 主対象: v12/v13で発生した起動停止・入力停止の復旧

## 今回の不具合

ユーザー実機確認で以下が発生しました。

- ダンジョンが表示されない。
- スタート地点から一歩も動けない。
- 左右旋回もできない。

## 原因

`app.js` の起動処理末尾で、以下の未定義関数を参照していました。

```js
bindButton("detectTrapBtn", toggleTrapDetection);
```

`toggleTrapDetection` が未定義だったため、ブラウザ上で `ReferenceError` が発生し、そこで `app.js` の実行が停止していました。

その結果、以下まで到達できませんでした。

- 初期メッセージ設定
- HUD更新
- `requestAnimationFrame(render)` によるWebGL描画開始
- ボタン入力の最終的な利用可能化

## 修正内容

- `toggleTrapDetection()` を実装。
- 罠検知ON/OFF時に `trapDetectionActive` を切り替える。
- 罠検知ON/OFF時に `scene = buildSceneGeometry()` で描画内容を再構築。
- 罠検知ON/OFF時に簡易マップとメッセージを更新。
- `bindButton()` に防御処理を追加。
  - ボタン要素が存在しない場合は警告して処理を中断。
  - ハンドラが関数でない場合も警告して処理を中断。
- キャッシュキーを `20260609-v14` に更新。

## 確認済み

- `node --check app.js` 通過。
- モックDOM/WebGL環境で `app.js` の起動時実行チェック通過。
- モックDOM/WebGL環境で初回描画呼び出しチェック通過。
- モックDOM/WebGL環境で以下ボタンに `pointerdown` リスナーが登録されていることを確認。
  - 前進
  - 後退
  - 左旋回
  - 右旋回
  - 調べる
  - 初期位置
  - 簡易マップ
  - 罠検知

## 未確認

- iPhone Safari実機で3D描画が復旧していること。
- iPhone Safari実機で前進・後退・左右旋回が動作すること。
- GitHub Pages反映後の表示。

## 後続確認対象

- 実機で画面左上が v14 になっているか。
- ダンジョンが表示されるか。
- 前進・後退・左右旋回ができるか。
- 罠検知ボタンで罠床表示が切り替わるか。
