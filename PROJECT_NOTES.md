# dsh-balance 项目上下文

给接手的 Agent（或未来的自己）看的速查。最后更新 2026-10-28，版本 **0.3.0**。

## 是什么

DeepSeek Harness（DSH）插件：把 **DeepSeek 账户余额**固定在侧边栏底部、账号头像的**正上方一行**；再往上一行是 **Token 用量**，点开是 GitHub 贡献图样式的 53 周热力图（每天 / 每周 / 累计总量），可在 **本机 / 账号** 两个数据源之间切换。浏览器端只拿余额数字和聚合后的用量，账户 token 与原始会话日志都留在 Host。

- 仓库：https://github.com/yang-zhenchen/dsh-balance
- 本地：`D:\dshwork\dsh-balance`（工作区「DSH 余额」）
- 许可：MIT

## 当前本机状态（重要）

DSH 的 `desktop` profile 用 **link 方式**挂这个插件，不是从 npm 装的：

- `~/.dsh/profiles/desktop/package.json`：
  `"dsh-plugin-balance": "link:D:/dshwork/dsh-balance"`
- `~/.dsh/profiles/desktop/node_modules/dsh-plugin-balance` → 指向 `D:\dshwork\dsh-balance` 的 Junction
- 移动前备份：`~/.dsh/profiles/desktop/package.json.bak-before-move`

改完代码后不需要重新安装；`lib/client.js` 可由 Client HMR 热更新，**改 `lib/index.js` / `lib/usage.js` / `lib/account.js` 必须重启 DSH**。

## 功能

- 余额行：显示充值余额；有赠金时追加 `+¥x.xx`；页面可见时每 15 秒刷新；窗口聚焦、从后台返回、登录状态变化、点击该行都会立即刷新
- 未登录显示「未登录」，失败显示「点击重试」；悬停看充值/赠金/更新时间
- 用量行：今日 token 总数（输入+输出+缓存读写），点击展开「Token 活动」面板
  - 53×7 日历热力图（quartile 分 4 档着色），月份刻度 + 图例
  - 视图：每天 / 每周（按列着色）/ 累计总量（从范围起点累加）
  - 数据源：**本机**（会话日志，精确到请求、含小时）/ **账号**（平台账号级用量，跨机器、只有按天 UTC、带 ¥ 费用）
  - 本机：今日 24 小时条带、今日输入/输出/缓存/请求/会话、近 7 / 30 天与总计
  - 账号：今日（UTC）/ 本月用量、今日与本月费用、输入/输出/缓存/请求、近 7 / 30 天与近 12 个月
  - 悬停格子看单日/单小时；`Esc`、点击外部、再次点击该行关闭
- 侧边栏收起时两行都按 DSH 布局规则隐藏
- 数据来源：本机用 `ctx.sessionQuery`；账号用 `ctx.credentials` 里的账户 grant

## 两个数据源（实现要点）

- 本机：每个会话在 Host 进程内只读一次，之后由 `session/event` 增量维护；按浏览器 offset 分本地日/小时。
- 账号：`readRecord("deepseek-account-platform/default")` → `payload.token` + `payload.issuer`（要求 https origin），
  带 `x-dsh-auth-token: <token>` 请求 `https://platform.deepseek.com/api/v0/usage/amount?month=&year=` 与 `/cost`。
  **注意：`Authorization: Bearer` 会被平台拒（40003），只有 `x-dsh-auth-token` 认 DSH 的 grant。**
  按自然月取数（371 天 → 13 个月），当月缓存 5 分钟、历史月 6 小时；`days[]` 是 UTC 日，`PROMPT_TOKEN` 恒为 0，
  输入 = `PROMPT_CACHE_MISS_TOKEN`、缓存读 = `PROMPT_CACHE_HIT_TOKEN`、输出 = `RESPONSE_TOKEN`、请求 = `REQUEST`。
  这组接口未公开，平台改版会失效；失败时路由返回 502 `{error:'account-unavailable', reason}`（`missing|auth|network`）。

## 结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 插件清单：`dsh.bundle.patch`、`dsh.client.platform=web`、peer `@deepseek-ai/cordis` |
| `cordis.patch.yml` | 插入 `ui-balance` 这一行 Loader |
| `lib/index.js` | Host 侧：`/dsh-balance/usage` 路由、会话索引、账号月份缓存（`ctx.inject(['webServer','connection','sessionQuery'])` + 嵌套 `credentials`） |
| `lib/usage.js` | 纯函数：本机样本折叠、按日/小时聚合、`summarizeUsage`（Host 与测试共用，不依赖 DOM/Node） |
| `lib/account.js` | 纯函数：平台 `usage/amount`+`cost` 解析、UTC 日聚合、自然月窗口、`AccountError` |
| `lib/client.js` | 浏览器侧：`sidebar.footer.action` 的一个槽位项里竖向排列 usage + balance 两行，用量面板用 fixed + portal；带 本机/账号 切换 |
| `scripts/enable-bundle.mjs` | 开发用：把依赖和 `dsh.profile.bundles` 写进 profile（2 空格、无 BOM、自动备份） |
| `scripts/repair-profile.mjs` | 修复 profile package.json 的 UTF-8 BOM |
| `test/smoke.mjs` | 浏览器 bundle 冒烟：槽位注册、两行渲染、纯函数 |
| `test/usage.mjs` | 本机折叠与聚合：替换/重试/压缩/inherited、日/小时分桶、时区偏移、窗口合计 |
| `test/account.mjs` | 账号解析：类型映射、坏行容错、自然月窗口、UTC 分桶、费用 |
| `test/host.mjs` | Host：路由注册、401/405、参数钳制、索引与 `session/event` 增量、坏会话不致命、账号源（缺凭据/成功/失效 + 月份缓存） |

## 开发 / 测试

```powershell
# Node 和 pnpm 不在 PATH，用 DSH 自带的：
$node = "D:\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
& $node test/smoke.mjs
& $node test/usage.mjs
& $node test/account.mjs
& $node test/host.mjs

# 从 GitHub 安装（用户在插件页填仓库地址）：
#   https://github.com/yang-zhenchen/dsh-balance

# 手动 link（改代码用）：
node scripts/enable-bundle.mjs
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm install
```

## 实现要点 / 坑

- **主机侧 API 形状**（都已对照 `app.asar` 里的源码确认）：
  - `ctx.inject([...], (cap) => { ... })` 注册可选能力；`cap.webServer.register({kind:'exact', path, handler})`
  - `cap.connection.requestRejection(req)` 返回 `undefined` 或 401/403
  - `cap.sessionQuery.listSessions()` / `readSession(id)` → `{ events, inheritedEventCount }`
  - `cap.on("session/event", (session, event) => ...)`
  - 嵌套 `cap.inject(["credentials"], ...)` 拿 `cap.credentials.readRecord(...)`；账号记录键是 `deepseek-account-platform/default`
- 用量样本的语义照抄 `@deepseek-ai/dsh-token-meter` 的 `tokenUsage` 投影：同一 turn/step 的最终样本替换流式样本，`llm/retry-started` 重开槽位；`compaction/summary` 额外计入。差异：我们保留了每条样本的时间戳用于按日/小时分桶，所以**没有**复用投影（投影只给全量累计）。
- Fork/子代理会话要跳过 `inheritedEventCount`，否则父会话的用量会被重复计算。
- 账号源：平台用量接口只认 `x-dsh-auth-token`（Bearer 会 40003）；口径是 UTC 日 vs 本地日，所以面板明确标「今日（UTC）」且账号视图不显示小时图。
- 浏览器端 `fetch("dsh-balance/usage?days=371&offset=...&source=local|account")` 用相对路径（和 `host-open-in-app` 同款），相对页面根解析；cookie 由 `credentials: "same-origin"` 带上。
- Client HMR 只在 `pnpm run dev:web` 运行时才会自动重建；普通桌面安装重启 DSH 最稳。
- **千万不要**用 `ConvertTo-Json | Set-Content` 改 profile 的 `package.json`：Windows PowerShell 会写 BOM，DSH 启动时 `JSON.parse` 直接失败、界面打不开。用 `.NET` 的 `UTF8Encoding($false)` 或 `scripts/repair-profile.mjs`。
- 改 profile 后要 `pnpm install`（或手工维护 junction），否则依赖解析不到。
- 重启 DSH 后如果行消失，先看 `~/.dsh/profiles/desktop/package.json` 是否可解析、`node_modules/dsh-plugin-balance` 是否指向正确目录。

## 网络

本机代理 `127.0.0.1:7890`；gh / git 需要时带上 `HTTPS_PROXY`。

## 待办

- 没有明确的待办；启动相关的问题汇总在 [issue #1](https://github.com/yang-zhenchen/dsh-balance/issues/1)。
- 用量索引目前每次 DSH 启动后重建（读一遍全部会话，然后实时增量）；数据量大时可以缓存到 `ctx.storage`，按会话 revision 失效。
- 账号源可继续增强：用 `/api/v0/usage/export` 的窗口导出把 UTC 日换算成本地「今日」；按模型拆分（amount 的 `total[]` 已经有模型维度）；近 30 天费用（目前只取当月 cost）。
