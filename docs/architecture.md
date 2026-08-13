# 推奨アーキテクチャ

## 全体構成

```text
iPhone / PC
    ↓
Vercel
└─ Next.js App Router
    ↓
Supabase
├─ Auth
│  └─ Google OAuth
└─ PostgreSQL
   ├─ profiles
   ├─ body_parts
   ├─ body_part_preferences
   ├─ exercises
   ├─ workouts
   ├─ workout_exercises
   ├─ sets
   └─ exercise_settings
```

## 採用技術

| 領域 | 採用案 | 理由 |
|---|---|---|
| Webフレームワーク | Next.js App Router | ReactとTypeScriptで段階的に実装しやすいため |
| Hosting | Vercel | Next.jsとの相性がよく，少人数利用の初期運用に向くため |
| 認証 | Supabase Auth | Google OAuthとPostgreSQL/RLSを統合しやすいため |
| Auth Provider | Google OAuth | ユーザーの利用開始が簡単であるため |
| DB | Supabase PostgreSQL | RLSと外部キーを利用できるため |
| Supabase package | `@supabase/ssr`，`@supabase/supabase-js` | Next.js App RouterでCookie sessionを扱うため |
| UI | Tailwind CSS | モバイル優先の密度調整とダークモードを実装しやすいため |
| 状態管理 | React stateとContext | 初期版では大きな状態管理ライブラリが不要であるため |

## ディレクトリ構成

```text
work_out_app/
  app/
    auth/
      callback/
        route.ts
      auth-code-error/
        page.tsx
    settings/
      page.tsx
    layout.tsx
    page.tsx
    globals.css
  components/
    app-shell.tsx
    auth/
      auth-gate.tsx
      auth-provider.tsx
      account-menu.tsx
    calendar/
      workout-calendar.tsx
      body-part-filter.tsx
    settings/
      supabase-account-card.tsx
      theme-provider.tsx
      theme-selector.tsx
  lib/
    domain/
      one-rep-max.ts
    supabase/
      client.ts
      server.ts
      proxy.ts
      env.ts
      database.types.ts
  supabase/
    migrations/
      20260812180000_initial_supabase_schema.sql
  proxy.ts
```

## 認証フロー

```text
未ログイン画面
  ↓
Googleでログイン
  ↓
Supabase Auth OAuth
  ↓
/auth/callback
  ↓
exchangeCodeForSession
  ↓
Cookie session
  ↓
initialize_current_user()
  ↓
カレンダー
```

## 初期化方針

新規ユーザー作成時には，DB triggerで `profiles` と初期 `exercises` を作成する．

アプリ起動後にも `initialize_current_user()` を呼び，既存ユーザーや途中失敗を冪等に補完する．

この方式により，Service Role Keyをブラウザへ渡さず，初期化処理をDB側に閉じ込める．

## 層構造

Workout CRUDでは，UIからRepository層を経由してSupabase PostgreSQLへアクセスする．

```text
UI
 ↓
Application Service
 ↓
Domain Model
 ↓
WorkoutRepository
 ↓
SupabaseWorkoutRepository
 ↓
Supabase PostgreSQL
```

UIはSupabaseの生レスポンスを無制限に扱わない．

Repository層でDB行とドメイン型の変換を行う．

## キャッシュとsession

Supabase SSRではCookieにsessionを保存する．

`proxy.ts` でsession更新を行う．

認証済みページを将来server-renderする場合は，ユーザーごとのsessionが混ざらないよう，ISRや共有cacheに注意する．

## 将来のExcel出力

Excelは保存正本ではない．

将来，Supabase PostgreSQLのデータから一方向にエクスポートする．

インポートや双方向同期は初期版では扱わない．
