const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 建立 uploads 資料夾
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 檔案上傳設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// 靜態檔案
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SQLite 初始化
const db = new sqlite3.Database('database.db');
db.run(`CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  message TEXT,
  file TEXT,
  reply TEXT
)`);

// 前台上傳
app.post('/upload', upload.single('file'), (req, res) => {
  const { name, message } = req.body;
  const filePath = req.file ? req.file.filename : null;

  db.run(
    `INSERT INTO uploads (name, message, file) VALUES (?, ?, ?)`,
    [name, message, filePath],
    function (err) {
      if (err) return res.status(500).send('資料庫錯誤');
      io.emit('newUpload', { id: this.lastID, name, message, file: filePath });
      res.redirect('/');
    }
  );
});

// 後台資料
app.get('/admin-data', (req, res) => {
  db.all(`SELECT * FROM uploads ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).send('資料庫錯誤');
    res.json(rows);
  });
});

// 後台回覆
app.post('/reply', (req, res) => {
  const { id, reply } = req.body;
  db.run(`UPDATE uploads SET reply = ? WHERE id = ?`, [reply, id], function (err) {
    if (err) return res.status(500).send('資料庫錯誤');
    io.emit('newReply', { id, reply });
    res.send('OK');
  });
});

server.listen(3000, () => {
  console.log('伺服器已啟動：http://localhost:3000');
});
