# dsh-balance

把 **DeepSeek 账户余额** 固定在 DeepSeek Harness（DSH）侧边栏底部——账号头像的**正上方一行**。

> A slim, always-visible balance row for the DeepSeek Harness sidebar.

![余额行预览](preview.png)

## 功能

- 显示账户充值余额；有赠金时在金额后追加 `+¥x.xx`。
- 页面可见时每 15 秒刷新；窗口重新获得焦点、从后台返回、账号登录状态变化、点击该行时都会立即刷新。
- 未登录显示「未登录」，读取失败显示「点击重试」；悬停可查看充值余额 / 赠金 / 更新时间。
- 收起侧边栏时按 DSH 的布局规则隐藏，不挤压头像行。
- 余额通过本机 DSH Host 的 `account` Remote 读取（Platform `get_user_summary`），**账户 token 不会进入页面**。

## 要求

- DeepSeek Harness **0.2.x**（Desktop 或 Web 界面均可）
- 已登录 DeepSeek 账户（设置 → 账户）

## 安装

### 方式一：在 DSH 插件页安装（推荐）

1. 打开侧边栏的 **插件** 页。
2. 在安装入口填入仓库地址：`https://github.com/yang-zhenchen/dsh-balance`
   （也接受 `github:yang-zhenchen/dsh-balance` 这种 pnpm 写法。）
3. 安装完成后确认 `dsh-plugin-balance` 已启用（安装默认启用）。
4. 侧边栏底部就会出现余额行。

### 方式二：手动 link（适合改代码）

```powershell
git clone https://github.com/yang-zhenchen/dsh-balance.git
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm add link:<克隆目录的绝对路径>
```

然后把 `"dsh-plugin-balance"` 追加到该 profile `package.json` 的 `dsh.profile.bundles` 数组，DSH 会热重组配置，无需重启。

## 卸载

在插件页禁用或移除该 bundle；手动安装时执行：

```powershell
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm remove dsh-plugin-balance
```

并从 `dsh.profile.bundles` 中删除 `dsh-plugin-balance`。

## 实现

| 文件 | 作用 |
| --- | --- |
| [`cordis.patch.yml`](cordis.patch.yml) | 作为 bundle 向 profile 插入一个 `ui-balance` Loader 行 |
| [`lib/index.js`](lib/index.js) | 宿主侧空插件（浏览器插件才做事） |
| [`lib/client.js`](lib/client.js) | 浏览器插件，注册到 `sidebar.footer.action` 列表槽位 |

`sidebar.footer.action` 由 `@deepseek-ai/dsh-client-ui-sidebar` 渲染在 `sidebar.settings`（账号/头像行）的正上方，所以插件不需要改 DSH 源码，也不会和头像行抢位置。组件同时订阅账户状态流，在登录 / 登出时立即同步。

## 开发

没有构建步骤：`lib/client.js` 本身就是 DSH Client Modules 可直接加载的 lazy-CJS 包。

```powershell
node test/smoke.mjs
```

修改 `lib/client.js` 后由 DSH 的 Client HMR 自动热更新（必要时刷新页面）。

## 已知限制

- 余额行跟随 DSH 侧边栏；侧边栏折叠时不显示。
- 轮询间隔目前固定为 15 秒（`lib/client.js` 顶部的 `POLL_MS`），尚未做成可配置项。
- 只显示账户余额，不统计 token 用量。

## License

[MIT](LICENSE)
