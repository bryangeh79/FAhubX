# FAhubX 项目记忆

## 项目概述
FAhubX 是一个 Facebook 多账号自动化 SaaS 平台。支持两种部署模式：
- **Cloud 模式**：VPS 部署，管理员控制多租户
- **Local 模式**：租户在自己电脑上运行，通过 License Server 心跳控制

## 关键提醒

### VPS 部署必须用 PM2 保持后端常驻运行
**优先级：最高** — 用户特别强调此点。
定时任务依赖后端的 `@Cron(EVERY_30_SECONDS)` 轮询机制。后端停了定时任务就不会触发。
检查命令：`pm2 status` / `pm2 logs fahubx-backend`

---

## 当前部署状态

### VPS 生产环境（已部署 ✅）
- **服务器**：Vultr 2GB / Singapore / `45.77.242.18`
- **域名**：`https://fahubx.starbright-solutions.com`
- **Cloudflare SSL**：Flexible 模式
- **后端**：PM2 常驻 + 开机自启（`pm2 start dist/main.js --name fahubx-backend`）
- **前端**：Nginx 托管 `/opt/fahubx/Facebook Auto Bot/frontend/dist`
- **数据库**：PostgreSQL（user=fahubx, password=FahubX2026Prod, db=fbautobot）
- **管理员**：`admin@fbautobot.com` / `Admin123!`（role=admin）
- **VPS 登录**：`root@45.77.242.18` / `)A5z$T)5u?j#FqjL`
- **VPS 项目路径**：`/opt/fahubx/Facebook Auto Bot/`
- **注意**：前端 api.ts 的 fallback 已改为空字符串（不是 localhost:3000），Nginx 反向代理 /api/ 到 localhost:3000

### VPS 更新流程
```bash
ssh root@45.77.242.18
cd /opt/fahubx/Facebook\ Auto\ Bot
git pull origin main
cd backend && npm install && npx nest build
cd ../frontend && npm install && npx vite build
pm2 restart fahubx-backend
```

### License Server（已部署 ✅）
- **地址**：`https://license.starbright-solutions.com`
- **平台**：Cloudflare Workers + D1 数据库
- **Admin API Key**：`fahubx-admin-31113e2921a335cf79ed3021ec048616`
- **DNS**：`license` AAAA 记录指向 `100::`，Cloudflare 代理
- **项目路径**：`C:\AI_WORKSPACE\Facebook Auto Bot\license-server\`
- **D1 数据库 ID**：`4e794335-0db3-47a2-9a48-f7521ec22ecc`
- **部署命令**：`cd license-server && npx wrangler deploy`
- **测试 License Key**：`FAH-R4SD-7F4E-V9AW`（Pro, 30 账号, 到期 2026-12-31）

### License Server API
```
POST /activate          — 激活 license key + 绑定机器
POST /heartbeat         — 30分钟心跳
GET  /admin/licenses    — 列出所有 license
POST /admin/licenses    — 创建新 license
PATCH /admin/licenses/:id — 修改/续期/停用
POST /admin/licenses/:id/unbind — 解绑机器
GET  /admin/dashboard   — 统计概览
```

---

## 技术栈
- **后端**：NestJS + TypeORM + PostgreSQL
- **前端**：React + Ant Design + Vite
- **浏览器自动化**：Puppeteer（headless / 显示窗口）
- **License Server**：Cloudflare Workers + D1
- **进程管理**：PM2
- **反向代理**：Nginx
- **GitHub**：https://github.com/bryangeh79/FAhubX（分支：main）

## 关键技术约定
- Facebook 页面按钮交互必须用 `getBoundingClientRect()` + `page.mouse.click(x,y)`（React 不响应 JS `.click()`）
- 所有方法统一 try/catch/finally 确保 browser session 关闭
- 所有截图调试文件保存到 `C:\AI_WORKSPACE\*.png`
- 部署模式通过 `DEPLOY_MODE` 环境变量区分（`cloud` / `local`）

## 已完成的功能
- 批量任务创建（batchId / batchGroup 分批执行）
- Headless 无头模式开关（VPS 友好）
- 失败任务显示错误原因（result.error 写入 DB）
- 自动聊天（双账号 A↔B 剧本/AI 对话）
- 自动发图/视频（完整登录流程 + 真实鼠标点击）
- 自动加好友 / 接受好友申请 / 自动留言 / 自动 Follow / 组合任务
- 模拟真人操作（账号暖化）
- 查看窗口（独立调试浏览器，任务完成后自动关闭）
- 多租户配套系统（Basic 10 账号 / Pro 30 账号）
- 订阅过期校验（SubscriptionGuard，冻结操作数据保留）
- 账号/任务数量配额校验
- 浏览器并发按用户隔离
- License Server 心跳系统（激活、心跳、24 小时离线宽限）
- 创建租户时自动生成 License Key
- 前端激活页面（Local 模式首次启动）
- VPS 部署到 fahubx.starbright-solutions.com

## 暂时隐藏的功能
- **自动拨号（auto_call）**— Puppeteer popup 处理逻辑尚未稳定，已从前端下拉框隐藏，后端代码保留

## 已修复的 Bug（上一轮）
- ExecutionLogModal setInterval 内存泄漏
- CORS 按环境区分配置
- 空 .catch(() => {}) 替换为错误日志
- 任务执行竞态条件修复
- 浏览器事件监听累积修复
- 前端编译错误修复（图标/import/方法）
- 生产环境启动校验默认密钥
- 内存日志上限（500 tasks, 1000 entries）
- saveTaskResult 统一调用 persistLogsToDb
- SSL 证书验证生产环境开启
- 查看窗口任务完成后自动关闭
- 日志完成后闪跳修复（onStatusChange useRef）
- 登录页移除测试账号信息

---

## 下一步待做：本地版安装包打包

### 目标
制作一个 Windows 安装包（.exe），租户双击安装后即可在本地电脑运行 FAhubX。

### 安装包需要包含
1. **Node.js 运行时**（或用 pkg 打包成单文件 .exe）
2. **PostgreSQL 便携版**（免安装）
3. **FAhubX 后端代码**（混淆后）
4. **FAhubX 前端静态文件**（已编译）
5. **初始化脚本**（创建数据库、初始化表）
6. **启动脚本**（start.bat / 桌面快捷方式）
7. **安装向导**（选择 Cloud/Local 模式）

### 安装流程
```
双击 FAhubX-Installer.exe
  → 选择部署模式（VPS / 本地）
  → 安装 PostgreSQL + Node.js + FAhubX
  → 初始化数据库
  → 创建桌面快捷方式
  → 首次启动
    → Local 模式：显示激活页，输入 License Key
    → Cloud 模式：直接进入登录页
```

### 代码混淆方案
- 用 `javascript-obfuscator` 混淆 `backend/dist/` 中的关键文件
- 用 `pkg` 打包成单文件 .exe（可选）
- 用 Inno Setup 或 NSIS 制作安装向导

### 关键文件路径
```
后端核心：
  backend/src/modules/license/license.service.ts    — 心跳客户端
  backend/src/modules/license/machine-id.util.ts    — 机器指纹
  backend/src/common/guards/subscription.guard.ts   — 双模式守卫
  backend/src/modules/simple-tasks/task-auto-runner.service.ts — 定时任务
  backend/src/modules/facebook-accounts/browser-session.service.ts — 浏览器管理

前端：
  frontend/src/App.tsx — License 状态检查 + 激活页路由
  frontend/src/pages/ActivationPage.tsx — 激活页面
  frontend/src/services/api.ts — API baseURL（注意 fallback 已改为空字符串）

License Server：
  license-server/ — Cloudflare Workers 项目（独立部署）
```

### 配套配额映射
```
Basic:  maxAccounts=10,  maxTasks=50,  maxScripts=10
Pro:    maxAccounts=30,  maxTasks=200, maxScripts=50
Admin:  maxAccounts=9999, maxTasks=9999, maxScripts=9999
```

### License Key 格式
`FAH-XXXX-XXXX-XXXX`（去除了 I/O/0/1 避免混淆）

### 心跳参数
- 间隔：30 分钟
- 离线宽限：24 小时
- 绑定：1 台电脑，换机器需管理员解绑
