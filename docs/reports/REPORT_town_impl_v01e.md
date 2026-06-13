# REPORT town_impl_v01e

## Summary

`town_func_spec_v01e` を正本として、街機能の最小実処理を `app.js` に接続した。

## Scope of work

- 状態モデル: `adventurers` / `parties` / `strandedRecords` を追加。
- 中断/再開: `SUSPENDED` Partyとして位置・状態を保持。
- 全滅/遭難: `STRANDED` Partyと `StrandedRecord` を作成。
- 救助: キャンプの `周辺を探索する` で近接遭難者を発見し、空き枠分だけ `CARRIED` にする。
- 街施設: 酒場、訓練場、宿屋、寺院、商店の最小実処理を接続。
- レベルアップ: 戦闘勝利時から撤去し、宿屋宿泊後のみに移管。

## Files changed

- `app.js`
- `index.html`
- `README.md`
- `REPORT.md`
- `docs/TOWN_FUNCTION_SPEC_v01e.md`
- `docs/reports/REPORT_town_impl_v01e.md`

## Implementation details

- `PARTY_MEMBERS` は固定正本ではなく、現在操作中パーティー用の互換配列として同期する。
- `state.strandedParties` は使用せず、`state.strandedRecords` に統一した。
- 酒場の `金を分配する` は均等配分。
- 寺院/商店の `お金を集める` は選択した1人への集中。
- 寺院処置は、処置対象本人ではなく選択した支払者の所持金から支払う。
- 商店処理は、選択した対象キャラクター本人の `gold` と `items` だけを対象にする。

## Verification performed

- `node --check app.js`: 通過。
- `python3` による `data/*.json` 全7件パース: 通過。
- `python3` による `.js` / `.css` / `.html` / `.md` / `.json` UTF-8読み込み: 通過。
- `style.css` 波括弧バランス確認: `0`。
- Playwrightブラウザスモーク: 未実行。`playwright` パッケージ未導入のため `ERR_MODULE_NOT_FOUND`。

## Confirmed items

- `BUILD_VERSION` は `town_impl_v01`。
- `index.html` は `town_impl_v01` 表示と `20260613-town-impl-v01` キャッシュバスターに更新済み。
- `strandedParties` 参照は残っていない。
- 戦闘勝利時に `tryApplyLevelUp(member)` を呼ばない。
- 宿屋宿泊後にだけ `tryApplyLevelUp()` を呼ぶ。

## Not confirmed items

- iPhone Safari実機表示。
- ブラウザ上の全画面遷移。
- 救助対象を街へ物理帰還させて `RECOVERED` にする処理。v01では帰還手段自体を未実装。

## Assumptions

- 商店の価格、鑑定、解呪は最小確認用の簡易処理。
- 呪文最大回数は既存データに最大値フィールドがないため、職業・レベルからの簡易再計算値と現在値の大きい方を採用。
- 訓練場の新規作成はプリセット冒険者作成。

## Inferences

- 既存コードの `PARTY_MEMBERS` 直接参照が多いため、全面移行ではなく同期方式が低リスクと判断した。
- v01仕様ではキャンプからの帰還手段がないため、`CARRIED` から `RECOVERED` への遷移は後続実装対象とした。

## Known risks

- ブラウザ実行確認ができていない。
- `PARTY_MEMBERS` 直接参照は互換用として残っている。
- 複数パーティーの長期運用、保存/ロード、帰還処理は未整備。

## Follow-up required

- 実機またはPlaywrightで、街トップ、全施設、迷宮出発、中断、再開、全滅、周辺探索を確認する。
- 帰還手段実装時に `CARRIED` から `RECOVERED` への変換を追加する。

## User real-device check steps

1. `index.html` をiPhone Safariで開く。
2. 街トップの施設ボタン一式を確認する。
3. 酒場で外す/加える/金を分配するを確認する。
4. 訓練場入場前の解散確認を確認する。
5. 宿屋、寺院、商店が個人単位で処理されることを確認する。
6. 迷宮内キャンプで中断し、街から再開できることを確認する。
7. 全滅後に自動帰還せず、遭難記録と周辺探索で救助導線があることを確認する。
