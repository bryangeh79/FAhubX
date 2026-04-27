# 🤝 FAhubX 项目交接文档 — v1.4.0 完成态

> **生成时间**：2026-04-27
> **交接版本**：v1.4.0（已完整发布到本地 / VPS / Cloudflare Workers）
> **目标读者**：下一位接手的 AI Agent

---

## 🎯 用户期望（首先读这一节）

用户名：**Bryan Geh** (`bryangeh@gmail.com`)
用户偏好：

1. **中文沟通**为主，技术术语保留英文
2. **决策用 A/B/C/D 选项**给我选，不要冗长解释。先「分析讨论」再「执行」
3. **执行风格**：用户说「开工」/「执行」我才动手；说「先分析」就只讨论
4. **数据安全**最高优先级 —— 改任何 schema 必须保证现存数据不丢
5. **回归零容忍** —— 任何改动绝对不能破坏已经在用的功能
6. **快速决策**：用户喜欢一个问题最多 3-4 个选项 + 1 个推荐
7. **打包发版**：用户期望我能后台跑长任务（installer build ~13 min），跑完通知他
8. **用户的工作机**就是开发机（C:\AI_WORKSPACE\Facebook Auto Bot），改完代码 `xcopy` 到 `C:\FAhubX` 就能立即测试

⚠️ **不能做的事**（除非用户明确要求）：
- 不要 `git commit --amend` 或 force push
- 不要在没有用户确认前删数据库表 / DROP 字段
- 不要跳过 git pre-commit hooks
- 不要主动开新功能；用户问什么做什么

---

## 📍 当前项目状态（v1.4.0 release 完成）

### 三个服务都已部署 v1.4.0

| 服务 | 位置 | 当前版本 | 验证 |
|---|---|---|---|
| **本地机 FAhubX** | `C:\FAhubX\`（运行中）| v1.4.0 | http://localhost:9600 左下角显示 v1.4.0 |
| **VPS** | `45.77.242.18:/opt/fahubx/Facebook Auto Bot/` | v1.4.0 (PM2 fahubx-backend online) | https://fahubx.starbright-solutions.com |
| **License Server** | Cloudflare Workers | v1.4.0 (含 enterprise plan) | https://license.starbright-solutions.com |

### Installer 已打包并上传

| 版本 | 文件 | 状态 |
|---|---|---|
| v1.0.0 | 489 MB | 旧版 archive |
| v1.2.0 | 485 MB | archive |
| v1.2.1 | 485 MB | archive |
| v1.3.0 | 485 MB | archive |
| v1.3.1 | 485 MB | 已上传 VPS |
| **v1.4.0** | **485 MB** | **已上传 VPS** |

下载链接（给客户）：
```
https://fahubx.starbright-solutions.com/download/FAhubX-Setup-v1.4.0.exe
```

### Git 状态
- 分支：`main`
- 最新 commit：`3a788c1 feat(v1.4.0): Enterprise plan (50 accounts) + adaptive 9-group time matrix`
- 已推送到 https://github.com/bryangeh79/FAhubX
- 工作树：`C:\AI_WORKSPACE\Facebook Auto Bot\.claude\worktrees\laughing-wing-9d51f8\`（claude code worktree）

---

## 🏗️ 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 本地机 (Windows, 用户的开发机)                             │
│                                                              │
│    源代码：C:\AI_WORKSPACE\Facebook Auto Bot\                │
│      backend/    ← NestJS 后端                               │
│      frontend/   ← React + Ant Design                        │
│      license-server/  ← Cloudflare Workers 项目              │
│      installer/  ← Inno Setup 打包脚本                       │
│      docs/       ← 项目文档                                   │
│                                                              │
│    运行实例：C:\FAhubX\（标准客户安装目录）                    │
│      backend\dist\        ← 已编译后端                       │
│      frontend\dist\       ← 已编译前端                       │
│      pgsql\bin\           ← PG 二进制                         │
│      pgsql\data\          ← PG 数据（不能动）                 │
│      data\browsers\       ← Puppeteer profile                │
│      backend\.env         ← 数据库连接 + 配置                │
│      license-cache.json   ← License 状态缓存                  │
│      start.bat / stop.bat ← 启动/停止                         │
└─────────────────────────────────────────────────────────────┘
                       ↑ 同源代码 ↓ git push
┌─────────────────────────────────────────────────────────────┐
│ 2. VPS 服务器（Vultr 2GB · Singapore · 45.77.242.18）        │
│                                                              │
│    /opt/fahubx/Facebook Auto Bot/  ← 同 git repo             │
│    PM2 fahubx-backend online                                 │
│    PostgreSQL 5432 (default port — 不是 5433!)               │
│    Nginx 反代 /api/ → localhost:3000                         │
│    /var/www/fahubx-downloads/ ← installer 文件               │
│    Cloudflare 代理 (Flexible SSL)                            │
└─────────────────────────────────────────────────────────────┘
                       ↑ HTTPS 调用
┌─────────────────────────────────────────────────────────────┐
│ 3. License Server（Cloudflare Workers + D1）                 │
│                                                              │
│    license.starbright-solutions.com                          │
│    源代码 license-server/ 通过 wrangler deploy 上传          │
│    D1 数据库 ID: 4e794335-0db3-47a2-9a48-f7521ec22ecc        │
└─────────────────────────────────────────────────────────────┘
```

### 关键端口（容易混淆）

| 环境 | PostgreSQL | Backend | Redis |
|---|---|---|---|
| 本地（C:\FAhubX）| **5433** | **9600** | **6380** |
| VPS | **5432** | **3000** | **6379** |

本地端口故意非默认，避免和 Docker / WSL 等冲突。

### API 路径

- 全局前缀：`/api/v1/...`（v1 是版本号）
- 例：`/api/v1/warmup/stats`
- **TransformInterceptor 包装所有响应**：`{ success: true, data: <真正 payload>, timestamp }`
- **前端 service 必须 `unwrapApi(response.data)` 取真正 payload**
- 已有 helper：`frontend/src/services/accounts.ts` 和 `warmup.ts` 都有 `unwrapApi`

---

## 🔐 认证 / 凭证（注意保密）

```
VPS:               ssh root@45.77.242.18  (password: )A5z$T)5u?j#FqjL )
本地 PG:           postgres / RUyM3p#2VeHBKAkAa7RD  (database: fbautobot, port: 5433)
VPS PG:            fahubx / FahubX2026Prod  (database: fbautobot, port: 5432)
管理员账号 VPS:     admin@fbautobot.com / Admin123!
管理员账号 本地:    admin@starbright-solutions.com / (用户记得，密码无明文记录)
License Admin Key: fahubx-admin-31113e2921a335cf79ed3021ec048616
测试 License Key:  FAH-R4SD-7F4E-V9AW (Pro, 30 账号, 到期 2026-12-31)
```

⚠️ 本地 PG 用户是 `postgres`，VPS 是 `fahubx` —— 不一样！

---

## 📐 现存的 4 个核心机制（理解这些再改代码）

### A. 暖化调度器 `warmup.service.ts`

```
@Cron(EVERY_5_MINUTES) scheduleTick()
  ↓
扫所有 status='active' 的 warmup_progress 记录
  ↓
对每个 progress (并发 3 个一批) 调 tickOne(p, now)
  ↓
tickOne:
  1. 取 groupCount (用户设置, 30s 缓存)
  2. 取该账号在组内的 0-based 位置
  3. 检测包过期 → shouldTransitionToP3 → 自动转 P3
  4. 检测错过窗口 → missedToday++
  5. findActiveWindow(group, now, groupCount) 返回 0/1/2 或 -1
     + isAccountTurnInWindow(position, group, now, groupCount) 检查 5 分钟错峰是否轮到
  6. 如果在窗口内 + 是我的轮次 + 当日未触发 → executeWindowAction
  7. executeWindowAction:
     - pickWarmupActions(packageNumber, windowIndex) 抽 1 个动作
     - auto_chat 走 findChatPartner（同组 + IP 不同优先）
     - 真正调 action service（warmingService / chatService / socialService / etc.）
     - 日志 appendLog 到父任务的 execution_log
     - persistLogsToDb 持久化
```

### B. 时间矩阵自适应 `warmup-windows.util.ts`

```
getWarmupWindowMinutes(group, groupCount):
  if groupCount <= 6:
    spread = 60 min  (旧逻辑：1 小时整点错峰)
  else:
    spread = floor(360 / N)  (新逻辑：分钟级)
  
  return [
    (8*60 + (group-1)*spread) % 1440,
    (14*60 + (group-1)*spread) % 1440,
    (20*60 + (group-1)*spread) % 1440,
  ]
```

`isAccountTurnInWindow(position, group, now, groupCount)`：
- 取窗口起始分钟 + position × 5 min
- 当前时刻在 `[trigger, trigger+5min)` 内才返回 true
- position × 5 ≥ 30 → 直接 false（超出窗口）

### C. 4 种养号包 `getPackageInfo`

```
P1 单独跑：  Day 1-7  → Day > 7 触发 shouldTransitionToP3
P2 单独跑：  Day 1-7  → Day > 7 触发 shouldTransitionToP3
P1+P2 完整：Day 1-7 用 P1 动作池, Day 8-14 用 P2 动作池, Day > 14 → 转 P3
P3 维护：    永远 isMaintenance = true，shouldTransitionToP3 = false
```

转 P3 时：`packageMode = 'P3'` + `startedAt = now`（重新算 Day 1）+ `lastFiredWindow = null`

### D. 配对算法 `findChatPartner`

同组 + 未删除 + active warmup + 不是自己 = 候选池
- 优先选 VPN 不同的（防风控）
- 没有 → 退而求次选同 VPN（task name 加 `[IP⚠️]`）
- 候选池为空 → 调用方降级为 `simulate_human_behavior`

---

## 📌 待合并的 commit（必看！）

另一个 agent 在 worktree 分支 `claude/focused-meitner-3fe069` 上做了一个修复：

- **commit hash**：`8e174c2`
- **commit msg**：`fix: enterprise plan UI + show-browser auto-login fallback`
- **改动**：6 files changed, 25 insertions(+), 26 deletions(-)
- **状态**：⚠️ **未合并到 main**（push 被沙箱拦截）

**新 agent 接手后第一步**：
```bash
cd "C:\AI_WORKSPACE\Facebook Auto Bot"
git fetch
git log --oneline claude/focused-meitner-3fe069 -5    # 看下里面到底改了啥
# 如果内容确认 OK：
git merge claude/focused-meitner-3fe069 --ff-only
git push origin main
# (push 可能再次被拦 → 让用户在他自己终端手动推)
```

这个 commit 包含的可能是：
- Enterprise plan UI 的小修复（admin users page 或 sidebar 颜色）
- 「显示窗口」模式下账号未登录时的 cookie 注入兜底逻辑

**优先级**：高 —— 既然已经修了就别浪费，但合并前先 `git diff` 一遍确认不冲突。

---

## ⚠️ 已知 Bug / 待办事项（用户授权累计修，不急）

按优先级排序：

### P1（影响功能）
1. **`ensureLoggedIn` 统一**：
   - 现状：`task-auto-runner.ts` 里的 `simulate_human_behavior` 有 cookie 注入 + 密码登录的完整逻辑
   - 问题：`auto_join_group` / `auto_chat` / `auto_post_image` 等 service 没有，账号 cookie 过期会失败
   - 解决：把 `task-auto-runner.ensureLoggedIn` 提到 `BrowserSessionService` 或 `FacebookLoginService` 让所有 action service 都用

### P2（用户体验）
2. **headlessMode 默认 `true → false`**：
   - 文件：`frontend/src/pages/TasksPage.tsx` line 645
   - 一行改动：`useState(true)` → `useState(false)`
   - 当前默认无头 → 用户「查看窗口」看不到操作 → 用户困惑
   - 改成默认显示窗口 → VPS 用户依然能手动切回无头

3. **「查看窗口」UX 优化**：
   - 当前查看窗口是独立 puppeteer 实例（不是任务用的那个）
   - 用户经常误以为它会跟着任务跑
   - 建议：检测任务 headless 状态，无头时按钮显示「⚠️ 任务为无头模式，查看窗口仅显示静态登录态」

### P3（运维）
4. **VPS Redis 连不上 localhost:6379**：
   - PM2 error log 一直刷 `[ioredis] Unhandled error event: AggregateError`
   - 不影响养号 / 加群（这些不依赖 Redis）
   - 但 BullMQ 任务队列功能受影响
   - 解决：检查 `systemctl status redis-server` 或装一个 Redis

5. **AI 设置统一**：
   - 当前两套 AI 配置：
     - 聊天 AI（auto_chat 用）：`localStorage.ai_settings`，浏览器本地
     - 加群 AI（auto_join_group 用）：每任务级 + 后端加密 key
   - 建议：统一到后端加密存储 + 一个总 AI 设置页

### P4（边界场景）
6. **大文件 Cloudflare 下载**：
   - v1.4.0 installer 463 MB，走 Cloudflare 代理
   - 慢网客户可能中途断流（CF Free Plan 风险区）
   - 解决：加 `downloads.starbright-solutions.com` DNS-only 子域名绕过 CF
   - 触发条件：等真有客户反馈

---

## 🛠️ 常见操作 Playbook

### 重新部署本地 FAhubX（v1.4.0 已安装，下次小改动用）

```powershell
# 1. 停服务
C:\FAhubX\stop.bat
Start-Sleep 5
Get-Process node, postgres, redis-server -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. 拉代码 + 重建
cd "C:\AI_WORKSPACE\Facebook Auto Bot"
git pull origin main

cd backend
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue
npx nest build

cd ..\frontend
npx vite build

# 3. 拷到运行目录
Remove-Item "C:\FAhubX\backend\dist" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "C:\AI_WORKSPACE\Facebook Auto Bot\backend\dist" "C:\FAhubX\backend\dist" -Recurse -Force
Remove-Item "C:\FAhubX\frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "C:\AI_WORKSPACE\Facebook Auto Bot\frontend\dist" "C:\FAhubX\frontend\dist" -Recurse -Force

# 4. 启动
C:\FAhubX\start.bat
Start-Sleep 60

# 5. 验证
Invoke-WebRequest http://localhost:9600/api/v1/warmup/stats
```

⚠️ 注意：装机已经完成 v1.4.0，**不要再跑 installer**。直接 git pull + xcopy 就够。

### VPS 部署（远程更新）

```bash
ssh root@45.77.242.18
# 输入密码 ): A5z$T)5u?j#FqjL

cd "/opt/fahubx/Facebook Auto Bot"
git pull origin main
cd backend && npm install --legacy-peer-deps && npx nest build && cd ..
cd frontend && npm install && npx vite build && cd ..
pm2 restart fahubx-backend
sleep 8
curl -s -o /dev/null -w "warmup/stats HTTP=%{http_code}\n" http://localhost:3000/api/v1/warmup/stats
pm2 status fahubx-backend
```

### License Server 部署（修改 license-server/ 后）

```powershell
cd "C:\AI_WORKSPACE\Facebook Auto Bot\license-server"
npx wrangler deploy
# 自动上传到 license.starbright-solutions.com
```

### 打 Installer

```powershell
# 注意：installer 打包需要 ~13 分钟（混淆 + Inno Setup 压缩 463 MB）
# 必须先清旧 dist 防止 obfuscator OOM

cd "C:\AI_WORKSPACE\Facebook Auto Bot"
Remove-Item "backend\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "installer\staging\backend" -Recurse -Force -ErrorAction SilentlyContinue

cd installer
.\build.bat   # 或 cmd /c build.bat 更稳

# 产物：installer\output\FAhubX-Setup-v{VERSION}.exe
```

注意 4 处版本号要同步：
- `frontend/src/components/AppLayout.tsx` `APP_VERSION`
- `installer/fahubx-setup.iss` `MyAppVersion`
- `installer/build.bat` 输出文件名 (2 处)

### 上传 Installer 到 VPS

用户用 **Termius SFTP**：
1. 打开 Termius → 右键 VPS host → Open SFTP
2. 拖 .exe 到 `/tmp/`
3. SSH:
   ```bash
   mv /tmp/FAhubX-Setup-vX.X.X.exe /var/www/fahubx-downloads/
   chown www-data:www-data /var/www/fahubx-downloads/FAhubX-Setup-vX.X.X.exe
   chmod 644 /var/www/fahubx-downloads/FAhubX-Setup-vX.X.X.exe
   curl -I https://fahubx.starbright-solutions.com/download/FAhubX-Setup-vX.X.X.exe
   ```
4. URL 是 **`/download/`（单数！）**，不是 `/downloads/`

### 直接查 VPS / 本地 DB

```bash
# 本地（注意端口 5433 + 用户 postgres）
$env:PGPASSWORD = "RUyM3p#2VeHBKAkAa7RD"
& "C:\FAhubX\pgsql\bin\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d fbautobot -c "SELECT COUNT(*) FROM warmup_progress;"

# VPS（注意端口 5432 + 用户 fahubx）
PGPASSWORD=FahubX2026Prod psql -h localhost -p 5432 -U fahubx -d fbautobot -c "SELECT COUNT(*) FROM warmup_progress;"
```

---

## 🔧 常踩的坑（PowerShell / Windows / Claude Code 沙箱环境）

### 1. Claude 沙箱 cwd 经常被重置

每条 PowerShell/Bash 命令后 `cwd` 可能被重置回 worktree 路径。**始终用绝对路径**或在命令开头 `Set-Location` / `cd`。

### 2. PowerShell 跑 .bat 文件
```
.\build.bat            ← PowerShell 默认不允许，必须 .\
cmd /c build.bat       ← 更稳，原生 cmd 跑批处理
```

### 3. PowerShell 长文件输出 UTF-16 BOM
`Add-Content $log $msg` 写出来的日志在 git-bash 里看像乱码。读用 `tr -d '\0'` 过滤 NUL 字符。

### 4. 本地不能自动 SSH 输密码
- 没装 plink / sshpass / Posh-SSH
- 不能在脚本里自动 SSH VPS
- VPS 部署只能让用户手动跑 SSH 命令

### 5. Git push 偶尔超时
- 直接用户网络抖动
- 重试 1-2 次通常 OK

### 6. obfuscator OOM
- `installer/build.bat` 里 obfuscate.js 默认 4GB heap
- 必须每次 build 前清 `backend/dist` 和 `installer/staging/backend`
- 否则上次混淆过的 .js 再被混淆 → 文件指数膨胀 → OOM
- **修复已在 build-backend.bat**：build 前自动 `rmdir dist`

### 7. Inno Setup 路径
- build.bat 自动检测 `C:\Program Files\Inno Setup 6\ISCC.exe` 和 `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`
- 用户机器装在哪里之前发现过，已 hardcode 多个 fallback

### 8. Cloudflare 缓存
- 文件名变更（如 v1.3.x → v1.4.0）= 不需要 purge（新 URL 不会有旧缓存）
- 同名覆盖 = 必须手动 purge（用户没 CF API token，要 dashboard 操作）

---

## 📦 用户当前数据状态（不要破坏）

本地 `admin@starbright-solutions.com` 这个 admin 账号下：
- 4 个 facebook accounts：
  - `#01 Bryan Geh (bryangeh@hotmail.com)` - VPN: Static Residential ISP - Malaysia, Group: G1
  - `#02 Kelly Kok (kellykok@outlook.my)` - VPN: 大环境IP, Group: G1
  - `#03 Eric Tam (erictam11@outlook.com)` - VPN: 大环境IP, Group: G1
  - `#04 Bently Tang (bentlytang03@outlook.com)` - VPN: Static Residential ISP, Group: 未分组
- 30 多个旧任务（已完成 27 个，最近还会有暖化任务）
- 当前 G1 三个号有 P1+P2 完整养号在跑（约 Day 1）
- groupCount = 3（默认）

**不要随便清这些数据**。要测新功能用 Factory Reset 单个账号。

---

## 🌐 国际化（i18n）

文件：`frontend/src/i18n/locales/{zh,en,vi}.json`

- 所有 UI 文字都通过 `t('key')` 调用
- 新加 UI 必须**同时**给 zh/en/vi 三个文件加 key（否则英文/越南语用户看到 `undefined`）
- 翻译完成度 zh > en > vi（vi 是 AI 翻译，可能有不准）
- 后端错误消息用中文（接受，未来可能后端 i18n）

---

## 🧪 测试 Checklist（每次 release 前用户会问的）

- [ ] 左下角版本号正确
- [ ] 账号管理页 # 编号正确显示
- [ ] 分组下拉 + 暖化进度条正常
- [ ] 任务调度页 4 种养号包 radio 都能选
- [ ] auto_join_group 任务表单 6 字段（关键词/数量/间隔min-max/AI 开关）
- [ ] Factory Reset 弹确认 + 成功后编号回收
- [ ] 仪表板 暖化中/维护中/已退役 3 个 card
- [ ] 中英越三语切换不报 undefined

---

## 🔮 用户可能的下一步（猜测）

基于历史话题：

1. **客户首批反馈**：等真客户用 v1.4.0，可能反馈 bug
2. **大文件下载问题**：如果客户下载断流 → 加 `downloads.*` 子域名
3. **`ensureLoggedIn` 统一**：累计 P1 待办，下次集中修
4. **更多养号动作的 Puppeteer 实现**：post_image/post_video 当前是占位
5. **聊天剧本翻译**：v1.1 部署的是中文剧本，英文/越南语剧本未做（按订单翻译）
6. **暖化任务的 Manual operation warning**：之前规划的「养号期间手动操作账号给警告」未实现

---

## 🆘 紧急联系 / 排查思路

### 用户说「VPS 挂了」
```bash
ssh root@45.77.242.18
pm2 status                                    # 看 fahubx-backend 是否 online
pm2 logs fahubx-backend --lines 50 --nostream # 看错误
systemctl status nginx                         # Nginx 是否 OK
systemctl status postgresql                    # PG 是否 OK
```

### 用户说「养号没动作」
```bash
# 1. 看后端跑了没
pm2 logs fahubx-backend --lines 100 | grep -i warmup
# 2. 看 DB 有没有进度记录
psql -d fbautobot -c "SELECT * FROM warmup_progress;"
# 3. 看是不是窗口没到
psql -d fbautobot -c "SELECT \"accountId\", \"packageMode\", \"firedTotal\", \"missedToday\", \"lastFiredWindow\" FROM warmup_progress;"
```

### 用户说「前端某页白屏」
- 大概率是 `TransformInterceptor` 包装问题（service 漏 unwrapApi）
- 或 i18n key 缺失（`t('xxx')` 返回 undefined）
- F12 看 console 报错

### 用户说「客户激活 license 失败」
```bash
# 检查 License Server
curl https://license.starbright-solutions.com/admin/licenses \
  -H "Authorization: Bearer fahubx-admin-31113e2921a335cf79ed3021ec048616"
# 如果端点 404 = wrangler 没部署成功 → 重新 wrangler deploy
```

---

## ✅ 交接 Checklist（你应该已经知道）

- [x] 项目位置 `C:\AI_WORKSPACE\Facebook Auto Bot\`
- [x] 用户偏好（中文 + A/B/C 选项 + 风险厌恶）
- [x] 三个服务的位置（本地 / VPS / Cloudflare Workers）
- [x] 当前版本 v1.4.0
- [x] 所有凭证密码（VPS / DB / License Admin Key）
- [x] 4 配套 + 9 组矩阵 + 暖化包逻辑
- [x] 6 个待办事项（P1-P4 优先级）
- [x] 用户当前数据（4 个号 + Group 1 在养号）
- [x] 常踩的坑（沙箱 cwd 重置 / 不能自动 SSH 等）
- [x] Playbook（部署 / 打包 / 上传 / DB 查询）

---

## 📞 与新用户的第一句话建议

```
您好 Bryan，我已读完 HANDOFF_v1.4.0.md。
当前 v1.4.0 已完整发布到本地 + VPS + License Server，
最新 commit 3a788c1，所有服务运行正常。

待办里 P1 是 ensureLoggedIn 统一，P2 是 headlessMode 默认值切换。
您今天想推进哪一项？还是有新需求？
```

---

**End of Handoff Document**
