# VibeDrop 🎯

**跨网络文件快传工具** — 无需同一局域网，网页端即用即走。

发送端拖入文件 → 生成 4 位提取码 → 接收端输入提取码即可下载。

## 技术架构

- **Next.js 16 (App Router)** — 全栈框架
- **Tailwind CSS 4** — 深色毛玻璃 UI
- **纯内存中转** — 文件流经服务器内存即时转发，零硬盘落盘，传输完成即销毁

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build && npm start
```

## 部署到 Render

1. 将代码推送到 GitHub 仓库
2. 在 [render.com](https://render.com) 用 GitHub 登录
3. 新建 **Web Service**，选择本仓库
4. 配置：
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`
5. 部署完成后访问 `https://你的应用.onrender.com`

## 传输流程

```
发送端                     Render 服务器                  接收端
  │                           │                            │
  ├─ 拖入文件 ──────────────► │                            │
  │   POST /api/upload        │                            │
  │   (返回 4位提取码)  ◄─────┤                            │
  │                           │                            │
  ├─ 流式上传 ──────────────► │  ◄─── GET /api/download ───┤
  │   POST /api/upload?code=XX│      (输入提取码)          │
  │                           │                            │
  │                           ├── 内存 Map 即时中转 ──────► │
  │                           │    完成即销毁               │
```

## 技术细节

- **提取码**：4 位数字，5 分钟无人领取自动过期
- **传输机制**：HTTP Chunked Streaming，上传流一边进入内存，下载流一边从内存读取
- **数据安全**：纯内存转发，不写入硬盘，下载完成或超时后立即从内存清除
- **单文件限制**：最大 500MB（受限于服务器可用内存）
