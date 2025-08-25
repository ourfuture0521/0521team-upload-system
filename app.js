// app.js
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// 使用 bodyParser
app.use(bodyParser.urlencoded({ extended: true }));

// ======= MongoDB 連線 =======
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/teamdb';

mongoose.connect('mongodb://127.0.0.1:27017/teamdb')
  .then(() => console.log('✅ MongoDB 連線成功'))
  .catch(err => console.error('❌ MongoDB 連線錯誤:', err));

  // 建立 User Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

// 建立 User Model
const User = mongoose.model('User', userSchema);

// 註冊 API
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();

  res.send('註冊成功！');
});

// 登入 API
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.send('使用者不存在');

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send('密碼錯誤');

  req.session.user = user;
  res.send('登入成功！');
});

// 啟動伺服器
app.listen(3000, () => {
  console.log('✅ 伺服器已啟動：http://localhost:3000');
});

// ======= .env 檢查 =======
const REQUIRED_ENVS = ['GMAIL_USER', 'GMAIL_PASS'];
const missing = REQUIRED_ENVS.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ 缺少必要環境變數：', missing.join(', '));
  console.error('請建立 .env 並設定 GMAIL_USER / GMAIL_PASS');
  process.exit(1);
}

// 管理員預設值（可在 .env 調整）
const ADMIN_DEFAULT_USER  = process.env.ADMIN_DEFAULT_USER  || 'admin';
const ADMIN_DEFAULT_EMAIL = process.env.ADMIN_DEFAULT_EMAIL || 'admin@local';
const ADMIN_DEFAULT_PASS  = process.env.ADMIN_DEFAULT_PASS  || 'admin123';

// ======= 基本設定 =======
app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ======= 檔案與資料 =======
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const membersFile = 'members.json';
const adminsFile  = 'admins.json';
for (const f of [membersFile, adminsFile]) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
}
const loadJSON = (file) => JSON.parse(fs.readFileSync(file));
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ======= SMTP（Gmail）=======
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});
console.log('📧 Gmail SMTP 已啟用');

// ======= 上傳白名單與限制 =======
const allowedExts = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf',
  '.zip', '.rar',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt'
]);
const allowedMimes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
]);
const upload = multer({
  dest: uploadsDir + '/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const extOk  = allowedExts.has(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedMimes.has(file.mimetype);
    if (extOk || mimeOk) cb(null, true);
    else cb(new Error('不允許的檔案類型'));
  }
});

// ======= 工具：頁面樣板 / 驗證連結 =======
function page(title, bodyHtml) {
  const style = `
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial;
             margin: 0; padding: 0; background: #0b1020; color: #e6e8f2; }
      .wrap { max-width: 960px; margin: 40px auto; padding: 24px; }
      .card { background: #121a36; border: 1px solid #2c3a63;
              border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
      h1, h2, h3 { margin: 0 0 12px; line-height: 1.25; }
      h2 { letter-spacing: .3px; }
      p { line-height: 1.6; color: #c9d1ff; }
      a { color: #9bb0ff; text-decoration: none; }
      a:hover { text-decoration: underline; }
      form { display: grid; gap: 14px; margin-top: 8px; }
      input[type="text"], input[type="email"], input[type="password"], input[type="file"] {
        background: #0d1530; color: #e6e8f2; border: 1px solid #2b3a66;
        border-radius: 12px; padding: 12px 14px; outline: none;
      }
      button {
        background: linear-gradient(135deg, #6ea8ff, #9c8bff);
        color: #0b1020; border: none; padding: 12px 16px; border-radius: 12px;
        font-weight: 700; cursor: pointer;
        box-shadow: 0 6px 18px rgba(110,168,255,.35);
      }
      button:hover { filter: brightness(1.05); }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      ul { margin: 0; padding-left: 18px; }
      .muted { color: #a6b0d8; font-size: .95rem; }
      .danger { color: #ffb0b0; }
      hr { border: none; border-top: 1px solid #2c3a63; margin: 18px 0; }
      .topnav { background: #0d1530; border-bottom: 1px solid #2c3a63; }
      .topnav .wrap { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
      .brand { display:flex; gap:10px; align-items:center; font-weight:800; color:#bfcaff; }
      .brand img { height: 26px; width: 26px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #2c3a63; }
      code.k { background:#0d1530;border:1px solid #2b3a66;border-radius:8px;padding:2px 6px }
      .right { text-align:right }
      .danger-btn { background:#ff5c5c; color:white; box-shadow:none }
      .danger-btn:hover { filter:brightness(1.05) }
    </style>
    <link rel="icon" href="/logo.svg" type="image/svg+xml">
  `;
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title>${style}</head><body>
  <div class="topnav"><div class="wrap">
    <div class="brand"><img src="/logo.svg" alt="logo"/><span>Team Upload System</span></div>
  </div></div>
  <div class="wrap"><div class="card">${bodyHtml}</div></div></body></html>`;
}

function buildVerifyUrl(req, pathWithQuery) {
  if (process.env.BASE_URL) {
    return `${process.env.BASE_URL}${pathWithQuery}`;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return `${process.env.RENDER_EXTERNAL_URL}${pathWithQuery}`;
  }
  const host = req.get('host') || 'localhost:3000';
  const isLocalhost = host.includes('localhost') || host.startsWith('127.0.0.1');
  const proto = isLocalhost ? 'http' : 'https';
  return `${proto}://${host}${pathWithQuery}`;
}

// ======= 初始化：建立預設管理員（若不存在） =======
async function ensureDefaultAdmin() {
  const admins = loadJSON(adminsFile);
  const exists = admins.find(a =>
    a.username === ADMIN_DEFAULT_USER || a.email === ADMIN_DEFAULT_EMAIL
  );
  if (exists) return;

  const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASS, 10);
  admins.push({
    username: ADMIN_DEFAULT_USER,
    email: ADMIN_DEFAULT_EMAIL,
    passwordHash
  });
  saveJSON(adminsFile, admins);
  console.log(`👑 已建立初始管理員：${ADMIN_DEFAULT_USER} / ${ADMIN_DEFAULT_EMAIL}`);
}
ensureDefaultAdmin().catch(console.error);

// ======= 記憶體留言（demo） =======
let messages = [];

// ================== 成員系統 ==================

// 註冊頁
app.get('/member/register', (req, res) => {
  res.send(page('成員註冊', `
    <h2>成員註冊</h2>
    <p class="muted">註冊後系統會寄出驗證信，完成驗證才能登入。</p>
    <form method="POST" action="/member/register">
      <input name="username" placeholder="帳號（顯示用）" required />
      <input type="email" name="email" placeholder="Email（登入用）" required />
      <input type="password" name="password" placeholder="密碼" required />
      <button type="submit">註冊</button>
    </form>
    <p class="muted">已有帳號？<a href="/member/login">前往登入</a></p>
  `));
});

// 註冊處理
app.post('/member/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    let members = loadJSON(membersFile);

    if (members.find(m => m.email === email)) {
      return res.send(page('Email 已被註冊', `
        <h2>註冊失敗</h2>
        <p class="danger">Email 已被使用。</p>
        <p><a href="/member/register">返回註冊</a></p>
      `));
    }

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(16).toString('hex');
    const tokenExpiry = Date.now() + 1000 * 60 * 30; // 30 分鐘

    members.push({ username, email, passwordHash: hash, verified: false, token, tokenExpiry });
    saveJSON(membersFile, members);

    const verifyUrl = buildVerifyUrl(req, `/member/verify?token=${token}`);

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: '帳號驗證信',
      html: `<p>您好，請在 30 分鐘內點擊以下連結驗證帳號：</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    });

    res.send(page('註冊成功', `
      <h2>註冊成功</h2>
      <p>驗證信已寄至 <b>${email}</b>。</p>
      <p class="muted">若未收到，請檢查垃圾信匣或前往 <a href="/member/resend">重新寄送驗證信</a>。</p>
      <p><a href="/member/login">回登入</a></p>
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(page('註冊錯誤', `
      <h2>註冊錯誤</h2>
      <p class="danger">伺服器忙碌，請稍後再試。</p>
      <p><a href="/member/register">返回</a></p>
    `));
  }
});

// 驗證
app.get('/member/verify', (req, res) => {
  const { token } = req.query;
  let members = loadJSON(membersFile);

  const m = members.find(x => x.token === token);
  if (!m) {
    return res.send(page('驗證失敗', `
      <h2>驗證失敗</h2>
      <p class="danger">無效的連結或已使用。</p>
      <p><a href="/member/login">回登入</a></p>
    `));
  }

  if (m.tokenExpiry && Date.now() > m.tokenExpiry) {
    return res.send(page('驗證碼過期', `
      <h2>驗證碼已過期</h2>
      <p>請 <a href="/member/resend">重新寄送驗證信</a>。</p>
      <p><a href="/member/login">回登入</a></p>
    `));
  }

  m.verified = true;
  m.token = '';
  m.tokenExpiry = 0;
  saveJSON(membersFile, members);

  res.send(page('驗證成功', `
    <h2>驗證成功！</h2>
    <p><a href="/member/login">前往登入</a></p>
  `));
});

// 重新寄送驗證信（頁面）
app.get('/member/resend', (req, res) => {
  res.send(page('重新寄送驗證信', `
    <h2>重新寄送驗證信</h2>
    <form method="POST" action="/member/resend">
      <input type="email" name="email" placeholder="註冊 Email" required />
      <button type="submit">寄送</button>
    </form>
    <p><a href="/member/login">回登入</a></p>
  `));
});

// 重新寄送驗證信（處理）
app.post('/member/resend', async (req, res) => {
  try {
    const { email } = req.body;
    let members = loadJSON(membersFile);
    const m = members.find(x => x.email === email);

    if (!m) {
      return res.send(page('已寄出', `
        <h2>若該 Email 有註冊，我們已寄出驗證信。</h2>
        <p><a href="/member/login">回登入</a></p>
      `));
    }

    if (m.verified) {
      return res.send(page('已驗證', `
        <h2>此帳號已完成驗證</h2>
        <p><a href="/member/login">直接登入</a></p>
      `));
    }

    m.token = crypto.randomBytes(16).toString('hex');
    m.tokenExpiry = Date.now() + 1000 * 60 * 30;
    saveJSON(membersFile, members);

    const verifyUrl = buildVerifyUrl(req, `/member/verify?token=${m.token}`);
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: '重新寄送帳號驗證信',
      html: `<p>請在 30 分鐘內點擊以下連結完成驗證：</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    });

    res.send(page('已寄出', `
      <h2>驗證信已重新寄出</h2>
      <p class="muted">若收不到請檢查垃圾信匣。</p>
      <p><a href="/member/login">回登入</a></p>
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(page('寄送失敗', `
      <h2>寄送失敗</h2>
      <p class="danger">請稍後再試。</p>
      <p><a href="/member/resend">返回</a></p>
    `));
  }
});

// 登入頁
app.get('/member/login', (req, res) => {
  res.send(page('成員登入', `
    <h2>成員登入</h2>
    <form method="POST" action="/member/login">
      <input type="email" name="email" placeholder="Email" required />
      <input type="password" name="password" placeholder="密碼" required />
      <button type="submit">登入</button>
    </form>
    <p class="muted"><a href="/member/resend">未收到驗證信？重新寄送</a></p>
    <hr />
    <p class="muted">還沒有帳號？<a href="/member/register">前往註冊</a></p>
  `));
});

// 登入處理
app.post('/member/login', async (req, res) => {
  const { email, password } = req.body;
  let members = loadJSON(membersFile);
  const user = members.find(m => m.email === email);
  if (!user) {
    return res.send(page('登入失敗', `
      <h2>登入失敗</h2>
      <p class="danger">Email 或密碼錯誤</p>
      <p><a href="/member/login">返回</a></p>
    `));
  }

  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) {
    return res.send(page('登入失敗', `
      <h2>登入失敗</h2>
      <p class="danger">Email 或密碼錯誤</p>
      <p><a href="/member/login">返回</a></p>
    `));
  }

  if (!user.verified) {
    return res.send(page('尚未驗證', `
      <h2>此帳號尚未驗證</h2>
      <p><a href="/member/resend">重新寄送驗證信</a></p>
      <p><a href="/member/login">回登入</a></p>
    `));
  }

  req.session.member = user.username || user.email;
  res.redirect('/member/dashboard');
});

// 成員主頁
app.get('/member/dashboard', (req, res) => {
  if (!req.session.member) return res.redirect('/member/login');

  let messagesHTML = messages.map(m => `<p><b>${m.user}:</b> ${m.text}</p>`).join('');

  res.send(page('成員介面', `
    <h2>成員介面（${req.session.member}）</h2>
    <form action="/member/upload" method="POST" enctype="multipart/form-data">
      <div class="row">
        <input type="file" name="file" required />
        <button type="submit">上傳檔案</button>
      </div>
      <p class="muted">允許：圖片、PDF、zip/rar、Office（doc/x、xls/x、ppt/x），最大 50MB。</p>
    </form>
    <hr />
    <form id="msgForm">
      <div class="row">
        <input id="message" placeholder="留言內容" required />
        <button type="submit">送出留言</button>
      </div>
    </form>
    <div id="chat">${messagesHTML}</div>
    <hr />
    <p><a href="/member/logout">登出</a></p>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      const form = document.getElementById('msgForm');
      const chat = document.getElementById('chat');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('message');
        const text = input.value.trim();
        if (!text) return;
        socket.emit('chat message', { user: '${req.session.member}', text });
        input.value = '';
      });
      socket.on('chat message', msg => {
        chat.innerHTML += '<p><b>' + msg.user + ':</b> ' + msg.text + '</p>';
      });
    </script>
  `));
});

// 上傳
app.post('/member/upload', (req, res) => {
  if (!req.session.member) return res.redirect('/member/login');
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.send(page('上傳失敗', `
        <h2>上傳失敗</h2>
        <p class="danger">${err.message}</p>
        <p><a href="/member/dashboard">返回</a></p>
      `));
    }
    res.send(page('上傳成功', `
      <h2>檔案上傳成功</h2>
      <p><a href="/member/dashboard">返回</a></p>
    `));
  });
});

// 登出
app.get('/member/logout', (req, res) => {
  req.session.member = null;
  res.redirect('/member/login');
});

// ================== 管理端 ==================

// 管理員登入頁
app.get('/admin/login', (req, res) => {
  res.send(page('管理員登入', `
    <h2>管理員登入</h2>
    <form method="POST" action="/admin/login">
      <input name="username" placeholder="帳號" required />
      <input type="password" name="password" placeholder="密碼" required />
      <button type="submit">登入</button>
    </form>
    <p class="muted">初始帳密：<code class="k">${ADMIN_DEFAULT_USER}</code> / <code class="k">${ADMIN_DEFAULT_PASS}</code></p>
  `));
});

// 管理員登入處理（從 admins.json 比對）
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  let admins = loadJSON(adminsFile);

  const admin = admins.find(a => a.username === username);
  if (!admin) {
    return res.send(page('登入失敗', `
      <h2>登入失敗</h2>
      <p class="danger">帳密錯誤</p>
      <p><a href="/admin/login">返回</a></p>
    `));
  }
  const ok = await bcrypt.compare(password, admin.passwordHash || '');
  if (!ok) {
    return res.send(page('登入失敗', `
      <h2>登入失敗</h2>
      <p class="danger">帳密錯誤</p>
      <p><a href="/admin/login">返回</a></p>
    `));
  }

  req.session.admin = admin.username;
  res.redirect('/admin/dashboard');
});

// 管理員主控台（列成員 + 檔案 + 修改管理員資料 + 刪除成員）
app.get('/admin/dashboard', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');

  const members = loadJSON(membersFile);
  const memberRows = members.map(m => `
    <tr>
      <td>${m.username || ''}</td>
      <td>${m.email}</td>
      <td>${m.verified ? '✅' : '❌'}</td>
      <td class="right">
        <form method="POST" action="/admin/members/delete" onsubmit="return confirm('確定刪除成員：${m.email}？');" style="display:inline">
          <input type="hidden" name="email" value="${m.email}">
          <button type="submit" class="danger-btn">刪除成員</button>
        </form>
      </td>
    </tr>
  `).join('');

  fs.readdir(uploadsDir, (err, files) => {
    if (err) files = [];
    const fileList = files.map(f => `<li>${f} <a href="/admin/download/${encodeURIComponent(f)}">下載</a></li>`).join('') || '<li class="muted">尚無檔案</li>';

    // 取得自己的管理員資訊
    const admins = loadJSON(adminsFile);
    const me = admins.find(a => a.username === req.session.admin);

    res.send(page('管理員介面', `
      <h2>管理員介面（${req.session.admin}）</h2>

      <h3>成員列表</h3>
      <table>
        <thead><tr><th>帳號</th><th>Email</th><th>已驗證</th><th class="right">動作</th></tr></thead>
        <tbody>${memberRows || '<tr><td colspan="4" class="muted">尚無成員</td></tr>'}</tbody>
      </table>

      <hr />
      <h3>檔案列表</h3>
      <ul>${fileList}</ul>

      <hr />
      <h3>管理員資料</h3>
      <form method="POST" action="/admin/profile">
        <div class="row">
          <input name="username" placeholder="新帳號（選填）" value="" />
          <input name="email" type="email" placeholder="新 Email（選填）" value="${me?.email || ''}" />
          <input name="newPassword" type="password" placeholder="新密碼（選填）" />
          <button type="submit">更新</button>
        </div>
        <p class="muted">只填要修改的欄位，留空則不變更。</p>
      </form>

      <hr />
      <p class="muted">標誌：</p>
      <div class="row">
        <img src="/logo.svg" alt="logo" style="height:64px;width:64px;border:1px solid #2c3a63;border-radius:12px;padding:8px;background:#0d1530" />
        <span class="muted">檔案位置：<code class="k">/public/logo.svg</code></span>
      </div>

      <hr />
      <p><a href="/admin/logout">登出</a></p>
    `));
  });
});

// 刪除成員（以 Email 識別）
app.post('/admin/members/delete', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.redirect('/admin/dashboard');

  let members = loadJSON(membersFile);
  const before = members.length;
  members = members.filter(m => (m.email || '').toLowerCase() !== email);
  saveJSON(membersFile, members);

  console.log(`🗑️ 刪除成員：${email}（${before} → ${members.length}）`);
  res.redirect('/admin/dashboard');
});

// 管理員更新資料（修改自己的 username / email / password）
app.post('/admin/profile', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  const { username, email, newPassword } = req.body;

  const admins = loadJSON(adminsFile);
  const me = admins.find(a => a.username === req.session.admin);
  if (!me) return res.redirect('/admin/login');

  // 若要修改 username，需檢查是否被占用
  if (username && username.trim() && username.trim() !== me.username) {
    const duplicated = admins.find(a => a.username === username.trim());
    if (duplicated) {
      return res.send(page('更新失敗', `
        <h2>更新失敗</h2>
        <p class="danger">新帳號已被使用。</p>
        <p><a href="/admin/dashboard">返回管理端</a></p>
      `));
    }
    me.username = username.trim();
    // 更新 session，避免改完帳號導致之後操作找不到自己
    req.session.admin = me.username;
  }
  if (email && email.trim()) me.email = email.trim();
  if (newPassword && newPassword.trim()) {
    me.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  }
  saveJSON(adminsFile, admins);

  res.send(page('更新成功', `
    <h2>管理員資料已更新</h2>
    <p><a href="/admin/dashboard">返回管理端</a></p>
  `));
});

// 檔案下載
app.get('/admin/download/:filename', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');
  const filePath = path.join(__dirname, uploadsDir, req.params.filename);
  res.download(filePath);
});

// 登出
app.get('/admin/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/login');
});

// ======== Socket.IO 留言即時更新 ========
io.on('connection', socket => {
  socket.on('chat message', msg => {
    messages.push(msg);
    io.emit('chat message', msg);
  });
});

// ======== 健康檢查 & 首頁導向 ========
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.redirect('/member/register'));

// ======== 啟動伺服器 ========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 伺服器啟動於 http://localhost:${PORT}`);
});
