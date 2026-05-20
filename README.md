# 三視圖大挑戰

國中三視圖單元的互動學習遊戲：看正視圖、俯視圖、側視圖，把立方體拼回來。

- **單人闖關**：6 個關卡，難度遞增，即時驗證並指出哪張視圖不符。
- **雙人對戰**：A 出題（建一個秘密立體）、B 只看三視圖還原；換手再來一輪、計分。

## 技術棧

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · React Three Fiber / three.js · Upstash Redis（雙人對戰房間狀態）

## 本機開發

```bash
npm install
npm run dev
```

開 <http://localhost:3000>。沒設 Redis 環境變數時會用記憶體 store（重啟會清空，僅供 dev）。

## 部署（Vercel + Upstash）

1. **建立 Upstash Redis 資料庫**：到 <https://console.upstash.com/redis>，建一個 Free tier 的 Redis（region 選最近的）。複製 `UPSTASH_REDIS_REST_URL` 與 `UPSTASH_REDIS_REST_TOKEN`。
2. **連到 Vercel**：在 Vercel 開新 project import 此 repo。Build 設定維持預設。
3. **設環境變數**：Project Settings → Environment Variables 加上前述兩個 key。
4. **Redeploy**：觸發一次重新部署讓環境變數生效。

無環境變數時雙人對戰會用 in-memory store，**在 serverless 下房間狀態會在多個函式實例間遺失**，務必設好 Redis 再開放給使用者。

## 已知限制

- 雙人對戰用 polling（1.5s），非真正即時。要升級可換 Pusher / Supabase Realtime / SSE。
- 3×3×3 網格上限為 27 個方塊。
- 行動裝置觸控未特別調校。
