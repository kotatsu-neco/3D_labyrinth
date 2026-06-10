# タイトル未定 地下方舟3Dダンジョン試作 v23

WebGLで描画する、固定グリッド式の軽量ポリゴン3Dダンジョン試作です。
タイトルは未確定です。v23では、敵遭遇ウィンドウに最小限の敵HP生成と前衛攻撃によるHP減少を接続しました。

## 起動方法

`index.html` をブラウザで開いてください。
GitHub Pages等に配置する場合は、フォルダ内のファイル一式をそのまま配置します。

## 操作

- ↑: 前進
- ↓: 後退
- ←: 左旋回
- →: 右旋回
- 調べる: 前方または現在マスの配置物を調べる / 閉じた扉を開く / 壁レバーを操作する
- キャンプ: キャンプ専用ウィンドウを開く
- 隊列: 隊列専用ウィンドウを開く
- パーティカード: キャラクター詳細ウィンドウを開く
- 初期位置: 開始位置に戻る
- 簡易マップ: デバッグ用マップ表示
- 罠検知: テスト用。検知状態のときだけ罠床を淡く表示する
- 戦闘確認: 敵遭遇ウィンドウを開き、最小戦闘挙動を確認する

## v23 変更点

- 敵遭遇ウィンドウに敵HPを生成する処理を追加。
- `戦う` を押すと、前衛3人が最初に残っている敵へ攻撃する処理を追加。
- 命中時、敵HPが減るようにした。
- 敵HPが0になると、その敵グループの残数表示が減る。
- 全敵のHPが0になると `戦う` / `身を守る` / `逃げる` を無効化する。
- `data/enemy_definitions_v23.json` を追加。
- `data/encounters_v23.json` を追加。
- キャッシュバスターを `20260610-v23` に更新。

## v23で変更していないこと

- 3D描画ロジック
- マップ構造
- 起動位置
- 宝箱、レバー、祭壇、石像、床の紋様、罠床の配置
- キャンプ、隊列、呪文、アイテム、キャラクター詳細の基本挙動
- 罠検知ロジック
- 宝箱イベントロジック
- 敵画像そのものの処理内容

## v23ではまだ未実装

- 外部JSONからの敵定義・遭遇定義の実行時読み込み
- ランダム敵遭遇
- 敵からの反撃
- プレイヤーHPの戦闘中減少
- 逃走判定
- 経験値
- 戦利品
- 宝テーブル接続
- アイテム/呪文の戦闘使用
- 敵名・アイテム名・魔法名の正本化
- 敵画像の最終採用可否
- 階層移動
- 20x20本番B1Fマップ

## 設計ルール

- 物語核: `docs/STORY_CORE.md`
- 階層設計ルール: `docs/LAYER_DESIGN_RULES.md`
- パラメータ設計ルール: `docs/PARAMETER_DESIGN_RULES.md`
- 敵・宝設計ルール: `docs/ENEMY_AND_TREASURE_RULES.md`
- 敵画像処理ルール: `docs/ENEMY_IMAGE_PROCESSING_RULES.md`
- 敵画像確認リスト: `docs/ENEMY_ASSET_REVIEW_LIST.md`
- 宝テーブル確認リスト: `docs/TREASURE_TABLE_REVIEW_LIST.md`
- アイテム名確認リスト: `docs/ITEM_NAME_REVIEW_LIST.md`
- 階段配置・上下階整合性の約束事: `docs/DUNGEON_DESIGN_RULES.md`
- 宝箱・石像・祭壇などのイベントオブジェクト設計ルール: `docs/EVENT_OBJECT_RULES.md`
- 表示・明暗・松明/魔法光の設計ルール: `docs/VISUAL_AND_LIGHTING_RULES.md`
- UI雰囲気・イベントウィンドウの方向性: `docs/UI_STYLE_RULES.md`
- 画面遷移・専用ウィンドウ設計ルール: `docs/SCREEN_FLOW_RULES.md`
- 戦闘・AC命中判定の基本ルール: `docs/COMBAT_RULES.md`
- Wizardry I〜III系の参考調査メモ: `docs/WIZARDRY_REFERENCE_NOTES.md`

## 報告書

- 最新の要約報告: `REPORT.md`
- 詳細報告: `docs/reports/REPORT_v23.md`
- v22全件検査: `docs/reports/INSPECT_v22_v01.md`
