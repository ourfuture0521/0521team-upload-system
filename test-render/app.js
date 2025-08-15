const express = require('express');
const app = express();

// 精簡 /member/register 路由
app.get('/member/register', (req, res) => {
  res.send(`
    <h2>成員註冊 (測試版)</h2>
    <form method="POST" action="/member/register">
      <input name="username" placeholder="帳號" required /><br>
      <input type="password" name="password" placeholder="密碼" required /><br>
      <input type="email" name="email" placeholder="Email" required /><br>
      <button type="submit">註冊</button>
    </form>
  `);
});

// 健康檢查
app.get('/healthz', (req, res) => res.send('ok'));

// 首頁導向
app.get('/', (req, res) => res.redirect('/member/register'));

// 啟動 Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
