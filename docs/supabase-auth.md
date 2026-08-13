# Supabase Auth

## 方針

認証にはSupabase Authを使用する．

初期版のログインProviderはGoogleのみとする．

利用者はGoogleアカウントでログインするだけでアプリを利用できる．

## Next.js構成

Next.js App RouterでSupabase公式のSSR構成を使用する．

ブラウザ側では `createBrowserClient` を使う．

Route HandlerとServer Component側では `createServerClient` を使う．

SessionはCookieで扱い，`proxy.ts` で期限切れSessionを更新する．

## OAuth Flow

ログイン時は `supabase.auth.signInWithOAuth` でGoogleログインへ遷移する．

Supabaseのcallback後，アプリ側の `/auth/callback` で `exchangeCodeForSession` を実行し，SessionをCookieへ保存する．

```text
Googleログイン
↓
Supabase Auth callback
↓
/auth/callback
↓
Session保存
↓
ホーム表示
```

## 環境変数

フロントエンドで使う公開環境変数は以下に限定する．

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Google OAuth Client SecretはSupabase Dashboardにのみ保存する．

Service Role Keyはブラウザへ渡さない．

## Supabase設定

Supabase Dashboardで以下を設定する．

```text
Authentication > Providers > Google:
Enabled
Client ID
Client Secret

Authentication > URL Configuration:
Site URL
Redirect URLs
```

本番URLが `https://kochifit.vercel.app` の場合は，以下を登録する．

```text
Site URL:
https://kochifit.vercel.app

Redirect URLs:
https://kochifit.vercel.app/auth/callback
```

ローカル開発も行う場合は，Redirect URLsに以下を追加する．

```text
http://localhost:3000/auth/callback
```

## Google Cloud設定

Google CloudのOAuth ClientはWeb applicationとして作成する．

Authorized JavaScript originsには，アプリの公開URLを登録する．

Authorized redirect URIsには，Supabase DashboardのGoogle Provider画面に表示されるcallback URLを登録する．

Next.jsの `/auth/callback` はGoogle Cloudのredirect URIではなく，Supabaseからアプリへ戻るためのURLである．
