# Phase 1実装範囲

## 位置づけ

Phase 1では，Webアプリの基盤UIを作成した．

その後の要件変更により，認証と保存先はSupabase Auth + PostgreSQLへ移行した．

この文書は，現在も維持するUI基盤を整理する．

## 維持するもの

| 領域 | 内容 |
|---|---|
| プロジェクト | Next.js，TypeScript，React |
| レイアウト | スマートフォン向けレスポンシブApp Shell |
| テーマ | システム，ライト，ダークの切替 |
| UI | 月間カレンダーの静的表示 |
| UI | 部位フィルターの静的表示 |
| 設定画面 | テーマ設定 |

## Historical / 過去設計からの置き換え

| 旧項目 | 新項目 |
|---|---|
| Microsoftログイン | Googleログイン |
| Microsoft Graph接続確認 | Supabase Session取得 |
| OneDrive接続診断 | profiles確認 |
| OneDrive JSON保存方針 | Supabase PostgreSQL正本 |

## 受け入れ条件

iPhone幅でレイアウトが破綻しない．

入力欄の文字サイズが16px以上である．

ユーザーのピンチズームを禁止していない．

システム，ライト，ダークのテーマ切替ができる．

Googleログイン画面が表示される．

静的カレンダーが表示される．

ソースコードにsecret，service role key，access tokenを固定していない．
