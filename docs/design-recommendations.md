# 設計改善提案

## 1．Supabase PostgreSQLを正本にする

3〜5人程度に使ってもらう予定があるため，個人ファイル保存よりSupabase PostgreSQLを正本にする方針が妥当である．

理由は，ユーザーごとのデータ分離，RLS，バックアップ，複数端末利用を自然に扱えるためである．

## 2．ユーザー向け認証はGoogleだけにする

利用者はGoogleアカウントでログインするだけで利用できる．

開発者がSupabaseへGitHubでサインインすることと，アプリ利用者の認証要件は分けて扱う．

## 3．初期種目はDB triggerで作成する

初期種目は新規ユーザーごとの `exercises` として作成する．

第一候補はDB triggerである．

理由は，新規 `auth.users` 作成と近い場所で初期化でき，クライアントに特別な権限を持たせずに済むためである．

ただし，既存ユーザーや途中失敗を補うため，アプリ起動時に冪等RPC `initialize_current_user()` も呼ぶ．

並行実行時の重複を避けるため，初期種目には `seed_key` を付与する．

`user_id, seed_key` のpartial unique indexで初期種目だけを一意にし，ユーザー追加種目の同名作成は制限しない．

## 4．PostgreSQL GRANTとRLSを分けて管理する

Supabase Projectは `Automatically expose new tables = OFF` を前提にする．

そのため，Data API用にauthenticated roleへのGRANTをmigrationで明示する．

GRANTはroleがテーブルへアクセス可能かを制御し，RLSはアクセス可能な行を制御する．

anonへ筋トレDBのテーブル権限は付与しない．

## 5．profiles DELETEは初期版で公開しない

`profiles` は関連データ削除の起点になるため，初期版ではDELETEを公開しない．

アカウント削除は，将来server-side処理として確認UI付きで設計する．

## 6．user_idの冗長性を許容する

`workout_exercises` や `sets` は親を辿ればユーザーを推定できる．

しかしRLSを単純かつ安全にするため，ユーザー所有テーブルには `user_id` を直接持たせる．

複合外部キーで親子の `user_id` 不一致を防ぐ．

## 7．Workoutの日付設計

初期版で1日1Workoutに固定しないことを推奨する．

同じ日に朝と夜，ジムと有酸素などを分けたい可能性があるためである．

UI上は1日1件に見せることもできるが，DB制約では複数Workoutを許容する．

## 8．今回のPhaseではCRUDへ進まない

今回の目的は，Googleログイン，Supabase Session，profiles確認，logout，migration，RLS設計までである．

Workout CRUD，種目管理，PR，Excelエクスポートは次Phase以降に分ける．
