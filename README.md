# 灰の目録 3Dダンジョン試作 v11

WebGLで描画する、固定グリッド式の軽量ポリゴン3Dダンジョン試作です。

## 起動方法

`index.html` をブラウザで開いてください。

GitHub Pages等に配置する場合は、フォルダ内のファイル一式をそのまま配置します。

## 操作

- ↑: 前進
- ↓: 後退
- ←: 左旋回
- →: 右旋回
- 調べる: 前方を調べる / イベント対象を開く
- 初期位置: 開始位置に戻る
- 簡易マップ: デバッグ用マップ表示

## v11 変更点

- 宝箱は、同じマスにいれば向きに関係なく `調べる` でイベントウィンドウを開けるように変更。
- 宝箱イベントウィンドウ内の画像を、将来差し替え可能な外部SVGアセットに分離。
  - `assets/ui/chest_closed.svg`
  - `assets/ui/chest_open.svg`
- 確認用オブジェクトを追加。
  - 石像
  - 魔法陣
  - 罠床風の床
  - 敵影
- `docs/VISUAL_AND_LIGHTING_RULES.md` を同梱。
- CSS/JSのキャッシュバスターを `20260609-v11` に更新。

## 設計ルール

- 階段配置・階段描画: `docs/DUNGEON_DESIGN_RULES.md`
- イベントオブジェクト・宝箱イベント: `docs/EVENT_OBJECT_RULES.md`
- UI雰囲気・イベントウィンドウ: `docs/UI_STYLE_RULES.md`
- 表示・明暗・松明/魔法光: `docs/VISUAL_AND_LIGHTING_RULES.md`

## 報告書

- 最新の要約報告: `REPORT.md`
- 詳細報告: `docs/reports/REPORT_v11.md`
- 過去の詳細報告: `docs/reports/`

## 現時点の対象外

- UI全体の再設計
- 戦闘
- 本格的な敵表示
- アイテム/鑑定/目録
- 階層移動
- オートマップ本実装
