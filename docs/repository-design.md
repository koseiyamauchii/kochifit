# Repository設計

## 現在の実装

`lib/workouts/repository.ts` の関数が，UIとSupabase PostgreSQLの変換境界を担当する．
保存正本はSupabase PostgreSQLであり，ブラウザにはpublishable keyと本人のsessionのみを渡す．
Repositoryクラスや独立したApplication Serviceは，現時点では導入していない．

## 責務

| 場所 | 責務 |
|---|---|
| `components/calendar/workout-calendar.tsx` | カレンダー，画面状態，ロードと保存の制御 |
| `components/calendar/workout-entry-form.tsx` | 入力フォームと前回・保存済み記録の表示 |
| `lib/workouts/entry-draft.ts` | 入力変換，下書き型，表示用フォーマット |
| `lib/workouts/repository.ts` | Workout，種目，部位，履歴・集計のDB操作 |
| `lib/goals/repository.ts` | 振り返り期間の実績集計 |
| `lib/supabase/read-all.ts` | 上限を超える取得と親IDの分割 |
| `lib/domain/` | 推定1RMと左右別ボリュームの計算 |

## 保存

`createWorkout` と `updateWorkout` は `save_workout` RPCを呼ぶ．
ユーザーIDはDB側の `auth.uid()` から決定し，所有者と親子関係を検証する．
Workout，Workout内種目，セットは同一トランザクションで保存する．
編集時は親をロックするが，バージョンによる楽観ロックは行わず，後の保存が優先される．
APIの失敗を成功として扱ったり，列を捨てて保存したりしない．
新規作成に対する通信再送の重複排除は未実装である．

## 読み込み

全件取得には `readAll` を使い，終了は空ページで判定する．
並び順の最後に一意なIDを含める．
親IDによる取得には `readByIds` を使い，100件ずつに分ける．
種目別詳細は5件ずつ取得し，次ページの存在だけを追加1件で調べる．
ホームの期間条件はDBクエリにも適用する．

## 検証

`repository-regression.test.ts` は取得上限，期間境界のクエリ，左右別集計，RPC失敗時に別の書き込みへ戻らないことを検証する．
`transactions.test.ts` は実際のmigrationをPGliteへ適用し，ロールバックとRLSを検証する．
本番反映は [更新手順](update-20260925.md) に従う．
