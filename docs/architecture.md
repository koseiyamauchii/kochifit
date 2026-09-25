# 現行アーキテクチャ

## 全体構成

```text
 iPhone / PC
      ↓
 Next.js App Router / Vercel
      ↓
 Supabase Auth（Google OAuth） / PostgreSQL
```

Next.js，React，TypeScript，Tailwind CSSを使用する．
認証とCookie sessionは `@supabase/ssr` で管理し，`proxy.ts` で更新する．
Google認証のcallback後に `initialize_current_user()` でプロフィールと初期種目を冪等に補完する．
確定記録はPostgreSQLへ保存し，端末内のlocalStorageは下書きと表示設定に限定する．

## 画面

| URL | 内容 |
|---|---|
| `/` | ホーム，カレンダー，目標，集計ページへのリンク |
| `/stats` | 期間別集計と部位別円グラフ |
| `/today` | 選択日の記録と編集 |
| `/today/add` | 記録入力 |
| `/history` | 全期間の種目別記録概要 |
| `/history/exercise` | 種目別履歴の追加読み込み |
| `/settings` | プロフィール，目標，マスタ，表示設定 |
| `/auth/callback` | OAuth codeの交換 |

## 保存先

`profiles`，`body_parts`，`body_part_preferences`，`exercises`，`workouts`，`workout_exercises`，`sets`，`exercise_settings`，`goal_reviews` を管理する．
共通部位マスタを除くユーザーデータはRLSで分離する．
親子の所有者の一致は複合外部キーでも保証する．
Data API権限はmigrationのGRANTで管理する．

## 実装の境界

UIは `lib/workouts/repository.ts` の関数を経由してWorkoutを操作する．
記録保存は `save_workout`，目標の振り返りと繰り越しは `complete_goal_review` によりDB内で一括実行する．
フォーム表示と純粋な下書き変換・計算を画面の状態制御から分離する．
詳しくは [Repository設計](repository-design.md) を参照する．

## 検証と反映

lint，型検査，Vitest，Next.js buildをGitHub Actionsでも実行する．
Vitestはmigration，保存失敗時のロールバック，RLS，集計の取得上限を含む．
OAuthの実環境動作とiPhone操作は別途確認する．
新しいDB関数が必要な更新は，migration適用後にアプリを配信する．

Excelは将来の一方向エクスポート先であり，保存正本や双方向同期先にはしない．
