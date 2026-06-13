# REPORT town_impl_v01

## Summary

Wizardry 風スマホWeb RPG『暗澹の石櫃』の街機能を `town_func_spec_v01e` に沿って最小実装した。

## Scope of work

- 街状態モデルとして `adventurers` / `parties` / `strandedRecords` を追加。
- `PARTY_MEMBERS` は現在操作中パーティーの互換表示用として同期。
- 戦闘勝利時のレベルアップを撤去し、宿屋宿泊後のみに移管。
- 酒場、訓練場、宿屋、寺院、商店の最小実処理を接続。
- `冒険を中断する`、休止中パーティー再開、全滅時遭難記録、キャンプ周辺探索による救助を接続。

## Files changed

- `app.js`
- `index.html`
- `README.md`
- `REPORT.md`
- `docs/TOWN_FUNCTION_SPEC_v01e.md`
- `docs/reports/REPORT_town_impl_v01e.md`

## Implementation details

- `state.strandedParties` は使わず、`state.strandedRecords` に統一した。
- `suspendedParties` はParty ID配列として扱い、表示は `state.parties` から派生する。
- 全滅時はメンバーを `STRANDED` にし、街へ物理帰還させない。
- 中断時はPartyを `SUSPENDED`、メンバーを `SUSPENDED` にし、位置・HP・状態・所持品・金・呪文回数を保持する。
- 救助時は空き枠がある場合だけ、遭難記録の対象を `CARRIED` として救助隊に追加する。
- 宿屋は本人支払い、寺院は処置対象と別の支払者、商店は対象者本人の金と所持品だけを処理対象にした。

## Verification performed

- `node --check app.js`: 通過。
- `python3` による `data/*.json` 全7件パース: 通過。
- `python3` による `.js` / `.css` / `.html` / `.md` / `.json` UTF-8読み込み: 通過。
- `style.css` 波括弧バランス確認: `0`。
- Playwrightブラウザスモーク: 未実行。`playwright` パッケージが未導入で `ERR_MODULE_NOT_FOUND`。

## Confirmed items

- `BUILD_VERSION = "town_impl_v01"`。
- `index.html` のタイトル、HUD、キャッシュバスターを `town_impl_v01` 用に更新。
- `strandedParties` 参照は残していない。
- 戦闘勝利時の `tryApplyLevelUp(member)` 呼び出しは撤去済み。
- 宿屋からのみ `tryApplyLevelUp()` を呼ぶ。

## Not confirmed items

- iPhone Safari実機表示。
- Playwright等によるブラウザ操作確認。
- 長時間プレイでの複数パーティー状態遷移。
- 救助した `CARRIED` メンバーの街への物理帰還処理。v01仕様どおり帰還手段自体は未実装。

## Assumptions

- 商店の買う/売る/鑑定/解呪は、v01の最小実装として簡易価格表と簡易処理で接続した。
- 既存コードに呪文最大回数の別管理がないため、宿屋の呪文回復は職業・レベルからの簡易再計算値と現在値の大きい方を採用する。
- 訓練場の新規作成は、最小プリセット冒険者を作成する方式にした。

## Inferences

- 既存の探索・戦闘・キャンプ処理は `PARTY_MEMBERS` 直接参照が多いため、全面置換ではなく現在操作中パーティーへの同期で互換性を保った。
- v01ではキャンプから街への物理帰還手段がないため、`CARRIED` から `RECOVERED` への遷移は将来処理として残した。

## Known risks

- `PARTY_MEMBERS` 直接参照はまだ残っている。正本配列ではなく同期先として扱う実装だが、将来の保存/ロード実装時には全面的な補助関数化が必要。
- ブラウザ実行を確認できていないため、画面遷移上のランタイム例外は未確認。
- 商店・転職・呪文回復は簡易仕様であり、完全なWizardry互換ではない。

## Follow-up required

- Playwrightまたは実機Safariで、街トップ、各施設、迷宮出発、中断、再開、全滅、周辺探索の画面遷移を確認する。
- 将来の帰還手段実装時に、`CARRIED` を `RECOVERED` にする物理帰還処理を追加する。
- 保存/ロード仕様導入時に、`state.adventurers` / `state.parties` / `state.strandedRecords` を永続化対象にする。

## User real-device check steps

1. `index.html` をiPhone Safariで開く。
2. 街トップに `酒場` / `訓練場` / `宿屋` / `寺院` / `商店` / `冒険を再開する` / `遭難記録` / `迷宮へ` が見えることを確認する。
3. 酒場でメンバーを外し、加入候補へ戻ることを確認する。
4. 訓練場に入る前に街パーティー解散確認が出ることを確認する。
5. 宿屋で1人を選び、部屋ランク宿泊後に本人の所持金と年齢が変わることを確認する。
6. 迷宮で `冒険を中断する` を選び、街の `冒険を再開する` から同じ位置へ戻ることを確認する。
7. 全滅時に自動帰還扱いにならず、遭難記録に残ることを確認する。
