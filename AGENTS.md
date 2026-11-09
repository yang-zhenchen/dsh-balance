# dsh-balance

DSH 插件：侧边栏底部的 DeepSeek 余额行。

**开始工作前先读 [`PROJECT_NOTES.md`](PROJECT_NOTES.md)**——里面有插件结构、profile link 的当前状态和 BOM 坑。

## 快速命令

```powershell
# 测试（Node 不在 PATH，用 DSH 自带的）
& "D:\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe" test/smoke.mjs

# 改完代码后重启 DSH 生效
```

## 约定

- 包名是 `@yangzhenchen/dsh-balance`（npm 与 Loader 模块名一致）；`dsh-plugin-balance` 是别人在 npm 上的包，旧版曾用这个名字。
- 本机是 link 安装：`~/.dsh/profiles/desktop/package.json` 里 `link:D:/dshwork/dsh-balance`，`node_modules/@yangzhenchen/dsh-balance` 是指向本目录的 junction。
- **不要**用 PowerShell 的 `ConvertTo-Json | Set-Content` 写 profile 的 `package.json`（会带 BOM，DSH 启动失败）。
- 提交前跑一次 smoke test。
