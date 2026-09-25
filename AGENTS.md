# AGENTS.md

このリポジトリでは，スマートフォンを主対象としたWeb完結型トレーニング記録アプリを開発する．

作業者は，以下の方針を守ること．

## 役割

画像センシング，コンピュータビジョン，電磁気学，信号処理の研究支援者としての観点も持つ．

ただし，本リポジトリの主題はWebアプリ設計と実装であるため，実装判断ではユーザーの利用目的，Supabase PostgreSQL正本方針，iPhoneでの操作性を優先する．

## 日本語出力

日本語本文では，句読点として全角の「，」と「．」を使う．

「、」と「。」は使わない．

一文ごとに改行する．

長い説明では，Markdownの見出し，箇条書き，表を使って構造化する．

## 中心思想

トレーニング記録の正本はSupabase PostgreSQLとする．

認証はSupabase Authを使用し，初期版のProviderはGoogleのみとする．

利用者はGoogleアカウントでログインするだけで利用できる．

開発者は，Supabase DashboardへGitHubアカウント `https://github.com/koseiyamauchii` でサインインしている前提でよい．

Excelは正本ではなく，将来の分析用エクスポート形式としてのみ扱う．

初期版では，ブラウザlocalStorageをトレーニング記録の正本として使わない．

## セキュリティ

Service Role Keyをフロントエンドへ渡さない．

Google OAuth Client Secretをフロントエンドへ渡さない．

access token，refresh token，秘密情報をソースコードへ書かない．

`.env.local` や秘密情報をGit管理しない．

ブラウザに公開してよいSupabase keyは，publishableまたはanon keyのみである．

RLSを必ず有効化し，ユーザーAからユーザーBのデータへアクセスできないことを最重要条件とする．

Supabase Data APIでは，RLSだけでなくPostgreSQL GRANTも明示する．

`Automatically expose new tables = OFF` のProjectを前提に，authenticated roleへのテーブルGRANTをmigrationで管理する．

anonへ筋トレDBのテーブル権限を付与しない．

## DB設計

主キーはUUIDを使用する．

Supabase Authの `auth.users` と `profiles` は1対1対応とする．

`profiles.id` は `auth.users.id` と同一UUIDを使用する．

初期部位は全ユーザー共通マスタとして `body_parts` に保存する．

種目，Workout，Workout内種目，セット，種目設定はユーザー所有データとして扱う．

以下のユーザー所有テーブルには，RLSを単純にするため `user_id` を直接持たせる．

* `exercises`
* `workouts`
* `workout_exercises`
* `sets`
* `exercise_settings`

親子関係では，複合外部キーにより `user_id` の不一致を防ぐ．

過去記録が存在する種目は物理削除せず，`active = false` と `archived_at` で扱う．

重量はkg基準で `weight_kg` に保存する．

距離はkm基準で `distance_km` に保存する．

時間は秒基準で `duration_sec` に保存する．

## RLS

ユーザー所有データの基本policyは以下である．

```sql
auth.uid() = user_id
```

`profiles` は以下で制御する．

```sql
auth.uid() = id
```

`body_parts` は全ユーザー共通マスタであり，authenticated userはSELECTのみ可能とする．

`profiles` は初期版ではDELETE GRANTとDELETE policyを置かない．

アカウント削除は，将来server-side処理として安全に設計する．

## 初期データ

初期部位はmigrationで投入する．

新規ユーザーごとの初期種目はDB triggerを第一候補とする．

アプリ起動後にも冪等RPCを呼び，途中失敗や既存ユーザーを補完できるようにする．

初期種目には安定した `seed_key` を持たせ，`user_id, seed_key` のpartial unique indexで重複を防ぐ．

ユーザー追加種目は `seed_key = null` とし，同名種目作成を不必要に制限しない．

## UI / UX

iPhone Safariを最優先する．

`<meta name="viewport" content="width=device-width, initial-scale=1">` を設定する．

`user-scalable=no` は使わない．

`input`，`textarea`，`select` は16px以上の文字サイズにする．

ダークモードを必須とする．

テーマは，システム，ライト，ダークを選択可能にする．

トレーニング中の操作では，大きいタップ領域，大きい入力欄，前回メモの即時表示を重視する．

## 実装方針

Phase単位で小さく進める．

現行実装はGoogle認証，Workout CRUD，履歴，下書き，目標と振り返りを含む．

変更範囲は各依頼に従い，既存の保存・編集・履歴操作との互換性を確認する．

UIやドメインロジックからSupabaseの生レスポンスを直接広げすぎない．

Workoutの新規作成・編集は `save_workout` RPCで一括保存する．
部分的な削除や書き込みへフォールバックしない．
全件集計には `readAll` / `readByIds` を使用し，必ず一意なIDまで指定して並べ替える．
DB変更は既存migrationを書き換えず，新しいmigrationとして追加する．
新しいRPCを必要とするUIは，DB migration適用後に配信する．

推定1RMは `lib/domain/one-rep-max.ts` を使用し，表示時に丸める．
左右別の最大量は片側の重量と左右回数の合計から求める．
純粋な入力変換は `lib/workouts/entry-draft.ts`，フォーム表示は `components/calendar/workout-entry-form.tsx` に分離する．

Excel出力は一方向エクスポートとして設計する．

Excelインポートや双方向同期は初期版では実装しない．

## 検証方針

最低限，以下を実行する．

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

テストは保存失敗時のロールバック，RLS，1,000件超の取得，期間境界も含める．
GitHub Actionsの必須チェックを成功させてから取り込む．

実環境では，Googleログイン，Supabase Session取得，profiles確認，初期種目作成，ログアウトを確認する．

RLSでは，user Aからuser BのデータへSELECT，INSERT，UPDATE，DELETEできないことを確認する．

## レビュー成果物

レビュー用ZIPは `review_packages/` に置く．

今後生成するレビューZIPのファイル名は，必ず `YYYYMMDDHHMM_` から始める．

timestampは生成時の日本時間を基準にし，形式は `yyyyMMddHHmm` とする．

レビューZIPは，原則として `pnpm run review:package` で生成する．

レビューZIPには，README，`AGENTS.md`，`AGENT.md`，`docs/`，`supabase/migrations/`，`supabase/verification/`，実装ソース，設定ファイル，lockfileを含める．

依存パッケージ，ビルド成果物，秘密情報，`.env`，`.env.local`，Google Client Secret，Supabase service role key，access token，一時ファイル，ログはレビューZIPに含めない．
