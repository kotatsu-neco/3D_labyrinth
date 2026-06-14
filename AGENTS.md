# AGENTS.md

このリポジトリで作業するAIエージェントは、以下の規律を必ず守ること。

## 1. 最優先原則

このプロジェクトの最優先原則は「データに誠実であれ」である。

以下を混同してはならない。

- 実際に確認したこと
- コードを読んで推測したこと
- 仕様書に書かれているだけのこと
- 実装したつもりのこと
- ブラウザ/実機で未確認のこと

未確認の内容を「確認済み」と書いてはならない。

## 2. 正本仕様

街機能については、ユーザーの最新指示と `docs/TOWN_FUNCTION_SPEC_v01e.md`、および後続の修正指示書を正本とする。

旧仕様、旧REPORT、過去のコメント、既存コードが最新指示と矛盾する場合は、最新指示を優先する。

判断に迷った場合は、勝手に補完せず、REPORTに「未確定」と書くこと。

## 3. 今回の状態異常・街施設ルール

以下を厳守すること。

### ASLEEP / AFRAID

- `ASLEEP` / `AFRAID` は戦闘終了時に `OK` へ戻る。
- 宿屋対象にしてはならない。
- 転職対象にしてはならない。
- 街施設で回復させる前提を書いてはならない。

### POISONED

- `POISONED` は街へ物理帰還した段階で `OK` へ戻る仕様とする。
- 街フォーカスへ戻っただけでは回復してはならない。
- `冒険を中断する` では回復してはならない。
- 全滅後に街フォーカスへ戻っただけでは回復してはならない。
- `CARRIED` 搬送中は回復してはならない。
- 宿屋対象にしてはならない。
- 転職対象にしてはならない。

### 宿屋

- 宿屋対象は `OK` のみ。
- 宿屋で `OUT` を `OK` に戻してはならない。
- 宿屋で `POISONED` を治療してはならない。
- 宿屋で `ASLEEP` / `AFRAID` を扱ってはならない。

### 転職

- 転職可能対象は `OK` のみ。
- `POISONED`、`ASLEEP`、`AFRAID`、`PARALYZED`、`STONED`、`OUT`、`DEAD`、`ASHES`、`LOST` は転職不可。
- `SUSPENDED`、`STRANDED`、`CARRIED` の冒険者は転職不可。

### CARRIED

- `CARRIED` は救助隊が迷宮内で遭難者を同行・搬送している状態である。
- `CARRIED` メンバーを街施設対象に出してはならない。
- `CARRIED` メンバーを中断時に `SUSPENDED` へ上書きしてはならない。
- `CARRIED` メンバーを再開時に `PARTY` へ上書きしてはならない。
- `CARRIED -> RECOVERED` は後続実装である。今回の修正で自動接続してはならない。

## 4. 禁止事項

以下は禁止する。

- 全滅パーティーの自動帰還
- 中断を帰還として扱うこと
- 街フォーカス移動を物理帰還として扱うこと
- 未回収の遭難者を寺院・宿屋・訓練場・商店の対象にすること
- `CARRIED` を自動で `RECOVERED` にすること
- 仕様にない共有財布・暗黙のパーティープール支払いを追加すること
- 指示にない大規模UI刷新をすること
- 動作未確認なのに「実機確認済み」「ブラウザ確認済み」と書くこと

## 5. 作業前の義務

作業前に必ず以下を読むこと。

- `README.md`
- `REPORT.md`
- `docs/TOWN_FUNCTION_SPEC_v01e.md`
- 最新の修正指示書
- 作業対象の `app.js`
- 作業対象の `style.css`
- 作業対象の `index.html`

読んでいないファイルを、読んだものとして扱ってはならない。

## 6. 実装時の義務

実装では、以下を守ること。

1. 変更範囲を今回の指示に限定する。
2. 仕様を曖昧に解釈しない。
3. 既存処理を流用する場合も、状態遷移が正本仕様と一致するか確認する。
4. 便利そうな機能を勝手に追加しない。
5. 関数名・状態名・UI文言が仕様と矛盾しないようにする。
6. `CARRIED` / `SUSPENDED` / `RECOVERED` / `STRANDED` の相互上書きを慎重に扱う。
7. `PARTY_MEMBERS` は互換表示用同期配列であり、正本状態は `state.adventurers` / `state.parties` / `state.strandedRecords` であることを意識する。

## 7. 検査義務

実装後、必ず自身で検査すること。

最低限、以下を実行する。

```bash
node --check app.js
```

さらに、以下の観点をgrep等で確認する。

```bash
grep -n "innCandidates" app.js
grep -n "classChange" app.js
grep -n "ASLEEP\|AFRAID" app.js
grep -n "POISONED" app.js
grep -n "OUT" app.js
grep -n "CARRIED" app.js
grep -n "SUSPENDED" app.js
grep -n "RECOVERED" app.js
```

確認観点:

- 宿屋候補が `OK` のみである。
- 転職候補が `OK` のみである。
- `ASLEEP` / `AFRAID` が宿屋・転職候補に出ない。
- `POISONED` が宿屋・転職候補に出ない。
- `OUT` が宿屋候補に出ない。
- `CARRIED` が中断・再開で保持される。
- `CARRIED -> RECOVERED` が未接続であることがUIとREPORTに明記されている。

可能なら、以下も実行する。

```bash
python3 - <<'PY'
from pathlib import Path
import json

for p in Path('.').rglob('*'):
    if p.is_file() and p.suffix.lower() in {'.js', '.css', '.html', '.md', '.json'}:
        p.read_text(encoding='utf-8')

for p in Path('data').glob('*.json'):
    json.loads(p.read_text(encoding='utf-8'))

print('UTF-8 and JSON checks passed')
PY
```

## 8. REPORT記載義務

作業後、REPORTには必ず以下を記載する。

- 変更したファイル一覧
- 変更した関数一覧
- 実施した検査コマンド
- 検査結果
- 未実行の検査
- 未確認事項
- 既知の未実装事項

Playwrightや実機確認をしていない場合は、必ず「未実行」と書くこと。

「問題なし」「確認済み」「通過」と書く場合は、根拠となるコマンド、ログ、または実際に確認した対象を併記すること。

## 9. 完了報告の書き方

完了報告では、次のように分類すること。

```text
確認済み:
- 実際に読んだ/実行した/検査した内容

未確認:
- ブラウザ未確認、実機未確認、長時間プレイ未確認など

未実装:
- 今回の範囲外として残したもの

変更ファイル:
- 実際に変更したファイル
```

根拠のない安心表現は禁止する。
