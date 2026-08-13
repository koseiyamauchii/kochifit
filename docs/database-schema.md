# Supabase PostgreSQL schema

## 方針

トレーニング記録の正本は Supabase PostgreSQL とする．

主キーは UUID を使用する．

ユーザー所有データには `user_id` を持たせ，RLS でログインユーザー自身の行だけを操作できるようにする．

## テーブル一覧

| テーブル | 役割 |
|---|---|
| `profiles` | Supabase Auth ユーザーに対応するプロフィール，表示設定，目標 |
| `body_parts` | 全ユーザー共通の部位マスタ |
| `body_part_preferences` | ユーザーごとの部位表示順 |
| `exercises` | ユーザーごとの種目マスタ |
| `workouts` | 日付単位のトレーニング |
| `workout_exercises` | Workout 内の種目 |
| `sets` | セット記録 |
| `exercise_settings` | 種目ごとのラック位置，メモ，マシン設定 |

## profiles

`profiles.id` は `auth.users.id` と同じ UUID にする．

Google Auth から取得できる表示名と avatar URL を初回作成時に反映する．

```text
id uuid primary key references auth.users(id)
display_name text
avatar_url text
height_cm numeric(5, 1)
body_weight_kg numeric(5, 1)
age integer
sex text
training_split text
default_set_count integer
training_purpose text
final_goal text
one_month_goal_date date
one_month_goal_text text
three_month_goal_date date
three_month_goal_text text
one_year_goal_date date
one_year_goal_text text
created_at timestamptz
updated_at timestamptz
```

`training_purpose` は目的，`final_goal` は最終目標を表す．

`one_month_goal_date`，`three_month_goal_date`，`one_year_goal_date` は，それぞれの目標期限を日付で保持する．

`one_month_goal_text`，`three_month_goal_text`，`one_year_goal_text` は，期限付き目標の内容を保持する．

期限付き目標は内容が空ならホームには表示しない．

## body_parts

`body_parts` は全ユーザー共通の部位マスタである．

初期部位は以下とする．

* 胸
* 背中
* 脚
* 肩
* 腕
* 腹筋
* 有酸素運動

## body_part_preferences

`body_part_preferences` は，ユーザーごとの部位表示順を保持する．

`body_parts` は共有マスタとして固定し，個別ユーザーの並び替えはこのテーブルで管理する．

```text
id uuid primary key
user_id uuid references profiles(id)
body_part_id uuid references body_parts(id)
display_order integer
color_key text
created_at timestamptz
updated_at timestamptz
```

`user_id` と `body_part_id` の組み合わせは一意にする．

`color_key` は，カレンダーの日付下ドットとホームの部位別グラフに使うユーザーごとの部位カラーを保持する．

## exercises

種目はユーザーごとに管理する．

過去記録が存在する種目は物理削除せず，`active = false` と `archived_at` で扱う．

```text
id uuid primary key
user_id uuid references profiles(id)
body_part_id uuid references body_parts(id)
seed_key text
name text
display_order integer
active boolean
archived_at timestamptz
created_at timestamptz
updated_at timestamptz
```

## workouts

初期版では，1日に複数 Workout を登録できる余地を残す．

そのため，`user_id, workout_date` の unique 制約は置かない．

```text
id uuid primary key
user_id uuid references profiles(id)
workout_date date
note text
created_at timestamptz
updated_at timestamptz
```

## workout_exercises

Workout 内の種目を表す．

`workout_id, user_id` と `exercise_id, user_id` の複合外部キーにより，別ユーザーの Workout と種目を混ぜない．

```text
id uuid primary key
user_id uuid references profiles(id)
workout_id uuid
exercise_id uuid
display_order integer
note text
created_at timestamptz
updated_at timestamptz
```

## sets

重量，回数，RPE，ウォームアップ，時間，距離を扱えるようにする．

カロリー推定では，重量系種目は有効な回数が入力されたセットのみを計算対象とする．

```text
id uuid primary key
user_id uuid references profiles(id)
workout_exercise_id uuid
set_number integer
weight_kg numeric
reps integer
rir numeric
rpe numeric
is_warmup boolean
duration_sec integer
distance_km numeric
created_at timestamptz
updated_at timestamptz
```

## exercise_settings

種目ごとのラック位置，セーフティ，マシン設定，メモを自由形式で管理する．

```text
id uuid primary key
user_id uuid references profiles(id)
exercise_id uuid
setting_key text
setting_label text
setting_value text
display_order integer
created_at timestamptz
updated_at timestamptz
```

## 初期種目作成

初期種目作成は DB trigger と RPC を併用する．

新規ユーザー作成時に `profiles` と初期 `exercises` を作成する．

アプリ起動後にも `initialize_current_user()` を呼び，既存ユーザーや途中失敗を補完する．

初期種目には `seed_key` を付与する．

`seed_key` はアプリが投入した初期種目だけに使う安定識別子である．

以下の partial unique index で，trigger とアプリ起動時 RPC が並行しても初期種目が重複しないようにする．

```sql
create unique index exercises_user_seed_key_unique_idx
on public.exercises(user_id, seed_key)
where seed_key is not null;
```

## GRANT と RLS

Supabase Data API では，PostgreSQL GRANT と RLS の両方が必要である．

anon には筋トレデータ用 table の権限を与えない．

`body_parts` は authenticated role へ SELECT のみを許可する．

`profiles` は authenticated role へ SELECT，INSERT，UPDATE のみを許可する．

`body_part_preferences`，`exercises`，`workouts`，`workout_exercises`，`sets`，`exercise_settings` は authenticated role へ SELECT，INSERT，UPDATE，DELETE を許可する．

実際に触れる行は RLS でユーザー自身の行へ限定する．

ユーザー所有データの基本条件は以下である．

```sql
auth.uid() = user_id
```

`profiles` は以下で判定する．

```sql
auth.uid() = id
```
