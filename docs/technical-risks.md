# 技術リスク

この文書は，公開リポジトリに残してよい範囲で，現行アプリの主要な技術リスクを整理する．

## 認証設定

本アプリはSupabase AuthとGoogle OAuthを使用する．

Vercelへデプロイする場合は，Vercel側のProduction環境変数と，Supabase側のURL Configurationを一致させる必要がある．

公開URLで「アプリの認証設定が完了していません」と表示される場合は，VercelのProduction環境変数が未設定，または設定後の再デプロイが未実施である可能性が高い．

## Redirect URL

SupabaseのSite URLとRedirect URLsには，実際にブラウザでアクセスするURLを登録する．

本番環境では以下の形式を使う．

```text
https://<domain>
https://<domain>/auth/callback
```

ローカル開発では以下を使う．

```text
http://localhost:3000
http://localhost:3000/auth/callback
```

`0.0.0.0` は開発サーバーの待受アドレスであり，ブラウザのアクセス先やOAuth redirect URLとして使わない．

## RLS

ユーザー所有データはSupabase Row Level Securityで分離する．

基本方針は，ユーザー所有テーブルで `auth.uid() = user_id` を満たす行だけを操作可能にすることである．

`profiles` は `auth.uid() = id` で制御する．

共通マスタである `body_parts` は，ログイン済みユーザーが参照できる読み取り専用データとして扱う．

## 秘密情報

以下はフロントエンドやGitリポジトリに含めない．

- Supabase service role key
- Google OAuth Client Secret
- Supabase database password
- access token
- refresh token
- `.env.local`

ブラウザへ公開してよい値は，Supabase Project URLとpublishable keyに限定する．

## Account切り替え

ユーザーがGoogleアカウントを切り替えた場合，テーマやアクセントカラーなどのユーザー別設定は，新しいログインユーザーの設定を読み込む．

未設定のユーザーでは，テーマはシステム，アクセントカラーはデフォルトとして扱う．

## データ移行

トレーニング記録はSupabase PostgreSQLを正本として扱う．

将来的にバックアップやエクスポートを追加する場合は，ユーザー本人の操作としてCSV，JSON，Excelなどへ一方向に出力する設計を基本とする．
