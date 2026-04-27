# rakuten-price-proxy

Node.js + Express + Playwright で楽天市場検索ページから商品候補を取得する最小APIです。

## エンドポイント

- `GET /rakuten?q=検索語`
- 例: `http://localhost:3000/rakuten?q=月風魔伝%20ファミコン`

### 成功時レスポンス

```json
{
  "status": "found",
  "query": "月風魔伝 ファミコン",
  "items": [
    {
      "title": "...",
      "price": 1234,
      "url": "https://item.rakuten.co.jp/...",
      "image": "https://..."
    }
  ]
}
```

### 失敗時レスポンス

```json
{
  "status": "not_found",
  "items": []
}
```

## 仕様

- Playwright の `chromium` で楽天検索ページを描画
- 検索URL: `https://search.rakuten.co.jp/search/mall/{q}/`
- 取得件数: 最大10件
- `item.rakuten.co.jp` のURLのみ採用
- 価格が数値化できない候補は除外
- User-Agent は通常のChrome風
- タイムアウト 15秒
- 自動リトライは最大1回
- 失敗時もサーバーは落とさず `not_found` を返却
- `console.log` で以下を出力
  - 検索URL
  - 取得件数
  - 先頭3件の商品名と価格

## ローカル実行

```bash
npm install
npm start
```

ブラウザまたは `curl` で確認:

```bash
curl "http://localhost:3000/rakuten?q=月風魔伝%20ファミコン"
```

## Docker 実行

```bash
docker build -t rakuten-price-proxy .
docker run --rm -p 3000:3000 rakuten-price-proxy
```

## Render / Railway デプロイ

このリポジトリは以下の構成でそのままデプロイ可能です。

- `Dockerfile` あり
- ポートは `PORT` 環境変数に対応（未指定時 `3000`）
- 起動コマンドは `npm start`

### Render

- New + > Web Service > このリポジトリを指定
- Environment: `Docker`
- 必要に応じて `PORT` を設定

### Railway

- New Project > Deploy from GitHub Repo
- Dockerfile を自動検出
- 必要に応じて Variables で `PORT` を設定
