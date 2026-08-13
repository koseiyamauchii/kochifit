# Work Out

スマートフォンで使いやすい，Web完結型のトレーニング記録アプリです．

公開URL: https://work-out-sepia.vercel.app/

## 使い方

1. 公開URLを開く．
2. Googleアカウントでログインする．
3. ホームでカレンダーとトレーニング状況を確認する．
4. 日付または追加ボタンからトレーニングを記録する．
5. 履歴，種目マスタ，部位マスタ，プロフィールを必要に応じて編集する．

## 主な機能

- カレンダーによるトレーニング日の確認
- 日付ごとのトレーニング記録と編集
- 種目，重量，回数，セット，メモの記録
- 前セットや前回記録からのコピー
- 自重トレーニングの記録
- 推定消費カロリーの表示
- 推定RMと最高重量の表示
- 部位別トレーニング日数とグラフ表示
- 種目マスタと部位マスタの編集
- テーマとアクセントカラーの変更

## データ管理

認証にはGoogle OAuthとSupabase Authを使用しています．

トレーニング記録，プロフィール，種目マスタ，部位マスタはSupabase PostgreSQLで管理します．

ユーザーごとのデータはSupabaseのRow Level Securityで分離します．

## 推奨環境

- iPhone Safari
- iPhone Chrome
- PC版Chrome，Edge，Safari

スマートフォンからローカル開発環境へ接続する場合は，PCとスマートフォンが同じネットワークに接続されている必要があります．

## 公開URLの設定

現在の公開URLは以下です．

```text
https://work-out-sepia.vercel.app/
```

VercelのProject名やCustom Domainを変更すると，利用するURLを変更できます．

独自ドメインを使う場合は，VercelのProject SettingsからDomainsを開き，使用したいドメインを追加します．

## Vercel環境変数

公開URLでアプリを動かすには，VercelのProject SettingsからEnvironment Variablesを開き，Production環境へ以下を設定します．

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

これらはGitHubリポジトリには書きません．

環境変数を追加または変更した後は，再デプロイが必要です．

## ログイン設定

公開URLでGoogleログインを使うには，SupabaseのAuthentication設定に公開URLを登録します．

Supabase Dashboardで以下を設定します．

```text
Site URL:
https://work-out-sepia.vercel.app

Redirect URLs:
https://work-out-sepia.vercel.app/auth/callback
```

ローカル開発も行う場合は，Redirect URLsに以下も追加します．

```text
http://localhost:3000/auth/callback
```

Google Cloud側のOAuth redirect URIには，Supabase DashboardのGoogle Provider画面に表示されるcallback URLを登録します．

## 開発

ローカルで開発する場合は，依存関係をインストールして開発サーバーを起動します．

```bash
pnpm install
pnpm run dev
```

ローカル開発用の環境変数は `.env.local` に設定します．

`.env.local` はGit管理しません．

## 検証

変更後は以下を実行して確認します．

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```
