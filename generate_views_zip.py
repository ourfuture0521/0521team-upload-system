import os
import zipfile

# 要建立的檔案清單： {路徑: 內容}
files = {
    "views/layout.ejs": """<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <h1>團隊上傳系統</h1>
    <nav>
      <a href="/">首頁</a> |
      <a href="/member/register">註冊</a> |
      <a href="/member/login">登入</a> |
      <a href="/admin/login">管理端</a>
    </nav>
  </header>
  <main>
    <%- body %>
  </main>
  <footer>© 2025 Team Upload System</footer>
</body>
</html>""",

    "views/index.ejs": """<% layout('layout') -%>
<h2>歡迎使用團隊上傳系統</h2>
<p>請先註冊或登入後開始使用。</p>""",

    "views/member-register.ejs": """<% layout('layout') -%>
<h2>會員註冊</h2>
<form method="POST" action="/member/register">
  <label>電子郵件：<input type="email" name="email" required></label><br>
  <label>密碼：<input type="password" name="password" required></label><br>
  <button type="submit">註冊</button>
</form>""",

    "views/member-login.ejs": """<% layout('layout') -%>
<h2>會員登入</h2>
<form method="POST" action="/member/login">
  <label>電子郵件：<input type="email" name="email" required></label><br>
  <label>密碼：<input type="password" name="password" required></label><br>
  <button type="submit">登入</button>
</form>""",

    "views/admin-login.ejs": """<% layout('layout') -%>
<h2>管理員登入</h2>
<form method="POST" action="/admin/login">
  <label>帳號：<input type="text" name="username" required></label><br>
  <label>密碼：<input type="password" name="password" required></label><br>
  <button type="submit">登入</button>
</form>""",

    "views/admin-dashboard.ejs": """<% layout('layout') -%>
<h2>管理員後台</h2>
<p>歡迎，<%= admin.username %></p>
<h3>成員清單</h3>
<ul>
  <% members.forEach(function(member){ %>
    <li><%= member.email %>
      <form method="POST" action="/admin/delete/<%= member.id %>" style="display:inline">
        <button type="submit">刪除</button>
      </form>
    </li>
  <% }) %>
</ul>""",

    "public/css/style.css": """body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  background: #f9f9f9;
}
header {
  background: #333;
  color: #fff;
  padding: 10px;
}
header h1 {
  margin: 0;
}
nav a {
  color: #fff;
  margin: 0 10px;
  text-decoration: none;
}
main {
  padding: 20px;
}
footer {
  background: #eee;
  text-align: center;
  padding: 10px;
  margin-top: 20px;
}"""
}

def ensure_dirs():
    """建立必要資料夾"""
    for path in files.keys():
        folder = os.path.dirname(path)
        os.makedirs(folder, exist_ok=True)

def write_files():
    """寫入檔案"""
    for path, content in files.items():
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

def make_zip():
    """壓縮成 views_package.zip"""
    with zipfile.ZipFile("views_package.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for path in files.keys():
            z.write(path)

if __name__ == "__main__":
    ensure_dirs()
    write_files()
    make_zip()
    print("✅ 已建立 views/、public/css/，並打包成 views_package.zip")
