# KochiFit

KochiFitは，スマートフォンで日々の筋力トレーニングを記録するためのWebアプリです．

公開URL: https://kochifit.vercel.app/

## アプリ概要

KochiFitでは，カレンダーから日付を選び，種目，重量，回数，セット，メモを記録できます．

前回の記録を見ながら入力できるため，同じ種目の重量や回数を確認しながらトレーニング内容を更新できます．

履歴画面では，種目ごとの最高重量，最大ボリューム，最終実施日を確認できます．

プロフィール，目標，種目マスタ，部位マスタ，テーマ，アクセントカラーはアプリ内の設定から変更できます．

## 使い方

1. 公開URLを開く．
2. Googleアカウントでログインする．
3. ホームでカレンダーとトレーニング状況を確認する．
4. 日付または追加ボタンからトレーニングを記録する．
5. 履歴や設定を必要に応じて確認，編集する．

## 主な機能

- カレンダーによるトレーニング日の確認
- 日付ごとのトレーニング記録と編集
- 種目，重量，回数，セット，メモの記録
- セットごとのメモ記録
- 前セットや前回記録からのコピー
- 自重トレーニングの記録
- 推定消費カロリーの表示
- 推定1RMと最高重量の表示
- 部位別トレーニング日数とグラフ表示
- 種目マスタと部位マスタの編集，並べ替え
- プロフィールと目標の管理
- ライトモード，ダークモード，アクセントカラーの変更

## 推奨環境

- iPhone Safari
- iPhone Chrome
- PC版Chrome，Edge，Safari

スマートフォンからローカル開発環境へ接続する場合は，PCとスマートフォンが同じネットワークに接続されている必要があります．

## データ管理

認証にはGoogle OAuthとSupabase Authを使用しています．

トレーニング記録，プロフィール，種目マスタ，部位マスタはSupabase PostgreSQLで管理します．

ユーザーごとのデータはSupabaseのRow Level Securityで分離します．

Microsoft認証，Microsoft Graph，OneDrive，Excel正本方式は現行仕様では使用していません．

## 設定情報

公開URLは以下です．

```text
https://kochifit.vercel.app/
```

VercelのProduction環境には以下の環境変数を設定します．

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

これらはGitHubリポジトリには書きません．

Googleログインを使うには，Supabase Authenticationに以下を登録します．

```text
Site URL:
https://kochifit.vercel.app

Redirect URLs:
https://kochifit.vercel.app/auth/callback
http://localhost:3000/auth/callback
http://192.168.11.3:3000/auth/callback
```

Google Cloud側のOAuth redirect URIには，Supabase DashboardのGoogle Provider画面に表示されるcallback URLを登録します．

## 開発者向け

通常のローカル起動は以下です．

```bash
pnpm install
pnpm run dev
```

LAN内のスマートフォンから確認する場合は以下で起動します．

```bash
pnpm run dev:lan -- --port 3000
```

PCでは `http://localhost:3000/` を開きます．

スマートフォンでは `http://192.168.11.3:3000/` のようにPCのLAN IPアドレスを使います．

Windows PowerShellで `pnpm` や `corepack` が見つからない場合は，Node.jsのLTS版をインストールし，新しいPowerShellを開き直してから以下を確認します．

```powershell
node -v
corepack -v
pnpm -v
```

`corepack` が使える場合は，以下でpnpmを有効化します．

```powershell
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
pnpm run dev:lan -- --port 3000
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
