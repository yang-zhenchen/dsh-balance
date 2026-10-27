# dsh-balance 项目上下文

给接手的 Agent（或未来的自己）看的速查。最后更新 2026-10-27，版本 **0.1.1**。

## 是什么

DeepSeek Harness（DSH）插件：把 **DeepSeek 账户余额**固定在侧边栏底部、账号头像的**正上方一行**。浏览器端只拿余额数字，账户 token 留在 Host。

- 仓库：https://github.com/yang-zhenchen/dsh-balance
- 本地：`D:\dshwork\dsh-balance`（工作区「DSH 余额」）
- 许可：MIT

## 当前本机状态（重要）

DSH 的 `desktop` profile 用 **link 方式**挂这个插件，不是从 npm 装的：

- `~/.dsh/profiles/desktop/package.json`：
  `"dsh-plugin-balance": "link:D:/dshwork/dsh-balance"`
- `~/.dsh/profiles/desktop/node_modules/dsh-plugin-balance` → 指向 `D:\dshwork\dsh-balance` 的 Junction
- 移动前备份：`~/.dsh/profiles/desktop/package.json.bak-before-move`

改完代码后不需要重新安装；但**重启 DSH** 才会重新加载插件。

## 功能

- 显示充值余额；有赠金时追加 `+¥x.xx`
- 页面可见时每 15 秒刷新；窗口重新聚焦、从后台返回、登录状态变化、点击该行都会立即刷新
- 未登录显示「未登录」，失败显示「点击重试」；悬停看充值/赠金/更新时间
- 侧边栏收起时按 DSH 布局规则隐藏，不挤压头像行

## 结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 插件清单：`dsh.bundle.patch`、`dsh.client.platform=web`、peer `@deepseek-ai/cordis` |
| `cordis.patch.yml` | 插入 `ui-balance` 这一行 Loader |
| `lib/index.js` | Host 侧入口（注册 Remote 能力） |
| `lib/client.js` | 浏览器侧，注册到 `sidebar.footer.action`（头像上方那一行） |
| `scripts/enable-bundle.mjs` | 开发用：把依赖和 `dsh.profile.bundles` 写进 profile（2 空格、无 BOM、自动备份） |
| `scripts/repair-profile.mjs` | 修复 profile package.json 的 UTF-8 BOM |
| `test/smoke.mjs` | 冒烟测试 |

## 开发 / 测试

```powershell
# Node 和 pnpm 不在 PATH，用 DSH 自带的：
$node = "D:\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
& $node test/smoke.mjs

# 从 GitHub 安装（用户在插件页填仓库地址）：
#   https://github.com/yang-zhenchen/dsh-balance

# 手动 link（改代码用）：
node scripts/enable-bundle.mjs
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm install
```

## 坑

- **千万不要**用 `ConvertTo-Json | Set-Content` 改 profile 的 `package.json`：Windows PowerShell 会写 BOM，DSH 启动时 `JSON.parse` 直接失败、界面打不开。用 `.NET` 的 `UTF8Encoding($false)` 或 `scripts/repair-profile.mjs`。
- 改 profile 后要 `pnpm install`（或手工维护 junction），否则依赖解析不到。
- 重启 DSH 后如果余额行消失，先看 `~/.dsh/profiles/desktop/package.json` 是否可解析、`node_modules/dsh-plugin-balance` 是否指向正确目录。

## 网络

本机代理 `127.0.0.1:7890`；gh / git 需要时带上 `HTTPS_PROXY`。

## 待办

- 没有明确的待办；启动相关的问题汇总在 [issue #1](https://github.com/yang-zhenchen/dsh-balance/issues/1)。
