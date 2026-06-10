# v22 全件検査レポート v01

## 検査対象

- 対象zip: `/mnt/data/gray_catalog_dungeon_proto_v22.zip`
- 展開先: `/mnt/data/inspect_v22/`
- 検査日時: 2026-06-10

## 検査範囲

- zip構造・破損確認
- 全ファイル一覧確認
- テキストファイルのUTF-8読み込み確認
- `app.js` 構文確認
- モックDOM/WebGL環境での起動確認
- 主要ボタン登録確認
- 主要画面生成確認
- JSON全件読み込み確認
- 敵画像PNG全件確認
- 敵画像・敵定義・遭遇データの参照整合性確認
- HTML/CSS/JSの主要参照確認
- 旧仮題・禁止語・スタック/weight方針の検索確認

## 確認済み結果

### 1. zipとファイル数

- zip破損: なし
- 非ディレクトリファイル数: 110
- zip内エントリ数: 119（ディレクトリ含む）
- テキスト総行数: 8797行

### 2. 起動・構文

- `node --check app.js`: 通過
- モックDOM/WebGL環境での起動: 通過
- 初回描画呼び出し: 通過
- 位置表示: `B1F 浅層 x9 y10 W`
- 主要ボタン登録数: 11件

対象ボタン:

- `forwardBtn`
- `backBtn`
- `turnLeftBtn`
- `turnRightBtn`
- `inspectBtn`
- `resetBtn`
- `mapBtn`
- `detectTrapBtn`
- `campBtn`
- `formationBtn`
- `encounterBtn`

### 3. JSON

以下のJSONは全件パース成功。

- `data/enemies_v20.json`
- `data/treasure_tables_v20.json`
- `data/enemy_assets_v21.json`
- `data/enemy_definitions_v22.json`
- `data/encounters_v22.json`

参照整合性:

- `enemy_assets_v21.json`: records 56件
  - 通常敵画像: 28件
  - シルエット画像: 28件
- `enemy_definitions_v22.json`: records 4件
- `encounters_v22.json`: tables 1件 / demoEncounters 3件
- 敵定義の `assetId` は処理済み敵画像と対応済み
- 遭遇テーブルの `enemyId` は敵定義と対応済み
- `demoEncounters` の `enemyAssets` は処理済み敵画像と対応済み

### 4. 敵画像

- 通常敵画像: 28件
- シルエット画像: 28件
- すべてPNG
- すべて160x160px
- 有効画素のRGB色数: 最大24色
- 透過画素あり
- 通常敵画像とシルエット画像のベース名対応: 一致

### 5. HTML/CSS/JS参照

- `index.html` からの参照:
  - `style.css?v=20260610-v22`: 存在確認済み
  - `app.js?v=20260610-v22`: 存在確認済み
- `app.js` 内の敵画像参照: 存在確認済み
- 宝箱SVGは `assets/ui/${...}` の動的参照で存在確認済み
- v22用CSSクラス:
  - `encounter-window-panel`
  - `encounter-enemy-grid`
  - `enemy-card`
  - `enemy-image-frame`
  - `debug-row four`
  いずれも定義確認済み

## 検出事項

### A. ブロッキング不具合

現時点の静的検査・モック検査では、起動停止級の不具合は検出していない。

### B. 報告表現の不一致

直前のチャット報告では「使用画像4件」と表現したが、v22の初回 `遭遇確認` ウィンドウに表示される敵画像枠は2件。

実態は以下。

- アプリ内の確認用遭遇データは3件ある。
- 3件全体で使用されるユニーク敵画像は4種類。
- `遭遇確認` ボタン1回目の表示画像は2件。
- `REPORT.md` の「敵画像枠が2件生成されることを確認」は正しい。

結論: 実装不具合ではないが、報告文の書き方を次回修正する。

### C. データJSONとアプリ内デモデータの二重管理

v22では `data/enemy_definitions_v22.json` と `data/encounters_v22.json` を追加しているが、アプリ本体はまだ外部JSONを読み込まず、`app.js` 内の `ENCOUNTER_DEMOS` を直接使用している。

現状では確認用として許容できる。ただし、v23以降で戦闘本実装へ進む場合は、データJSONを読み込むか、コード内デモデータを明確に撤去する必要がある。

### D. マップサイズはまだ12x12

`docs/LAYER_DESIGN_RULES.md` では標準フロア20x20方針を記録済みだが、v22本体のテストマップはまだ12x12。

これはREADMEの「20x20本番B1Fマップ未実装」と一致するため、現時点では不具合ではない。
次工程で20x20化する場合は、イベント配置・初期位置・描画負荷・簡易マップの同時調整が必要。

### E. 過去報告書内の旧仮題

`docs/reports/REPORT_v01.md` 〜 `REPORT_v18.md` などの過去報告書には旧仮題「灰の目録」が残っている。

履歴文書として残っているため、現時点では不具合扱いにしない。アクティブ文書・画面タイトル・READMEでは旧仮題は外れている。

### F. ゲーム内文言は引き続き仮

以下の文言は実装確認用としては成立しているが、正本文言ではない。

- `粘性体`
- `虫型`
- `小型亜人`
- `骨の従者`
- `戦う`
- `身を守る`
- `逃げる`
- `祈る`
- `触れる`
- `踏み込む`

名称・文言は後で一覧化して確認する必要がある。

## 次に必要な修正・作業

優先度順:

1. v23で `data/enemy_definitions_v22.json` / `data/encounters_v22.json` を実際の画面データ源にする、またはデモ用であることをコード側により明確化する。
2. 次回報告では「初回遭遇で2画像」「全デモで4種類」のように表現を分ける。
3. 20x20本番B1Fマップに入る前に、現在の12x12テストマップを維持する期間を明記する。
4. 敵遭遇ウィンドウの実機確認後、画像が暗すぎる敵を個別調整する。
5. 戦闘本実装前に、敵名・アイテム名・呪文名・状態名をすべて仮名リストとして分離する。

## 未確認

- iPhone Safari実機表示
- 実WebGL/GPU上での描画
- 実タップ操作の当たり判定
- 敵遭遇ウィンドウの縦画面サイズ感
- 低解像度敵画像の実機上の視認性
- 戦闘コマンド文言の最終妥当性
