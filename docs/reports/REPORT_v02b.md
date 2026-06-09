# 灰の目録 3Dダンジョン試作 v02b 作業報告

## 目的

v02の内容は維持しつつ、GitHub Pages / iPhone Safari 等で旧CSS・旧JSが残るリスクを下げるため、静的ファイル読み込みにキャッシュバスターを付与した。

## 変更内容

- `index.html` のCSS読み込みを `style.css?v=20260609-v02b` に変更。
- `index.html` のJS読み込みを `app.js?v=20260609-v02b` に変更。
- 画面上のHUDタイトルを `v02b` 表示に変更。
- 初期メッセージを `v02b: キャッシュバスター適用済み...` に変更。
- HTML metaに `Cache-Control` / `Pragma` / `Expires` を追加。

## 確認済み

- `index.html` 内で `style.css` / `app.js` がバージョン付きURLで参照されていること。
- `node --check app.js` が通過したこと。

## 未確認

- iPhone Safari実機での旧キャッシュ完全排除。
- GitHub Pages CDN側の反映タイミング。

## 注意

HTML本体が強くキャッシュされている場合、クエリ付きCSS/JSへの参照自体が読み込まれない可能性がある。その場合は、GitHub Pages側の更新反映を待つ、Safariで再読み込みする、またはURL末尾に `?v=20260609-v02b` を付けて開く。
