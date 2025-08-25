# Team Upload System

功能：
- 成員註冊 → 寄驗證信（可重新寄送）
- Email 驗證成功才能登入
- 密碼 **bcrypt** 雜湊儲存
- 檔案上傳（白名單：圖片、PDF、Office、zip/rar…，最大 50MB）
- 即時留言（Socket.IO）
- 管理端：登入、成員列表、刪除成員、修改管理員資料（Email/密碼/帳號）、下載檔案
- 版頭標誌（`public/logo.svg`）

## 使用
1. `cp .env.example .env` 並填入 `GMAIL_USER` / `GMAIL_PASS`
2. `npm install`
3. `npm start`
4. 瀏覽：
   - 前台：`http://localhost:3000`（預設導向註冊）
   - 管理端：`http://localhost:3000/admin/login`
   - 初始管理員：`ADMIN_DEFAULT_USER` / `ADMIN_DEFAULT_PASS`

> 若你變更「管理員帳號」後，記得用 **新帳號** 重新登入。
