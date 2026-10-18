# 桌面版开发说明

用户入口：[下载页面](../../docs/download.md)。本目录为 Electron 桌面版，不部署到私人 Sites 网站。

开发者需 Node.js 24；在 community 目录安装原项目依赖，并在 desktop 目录安装打包工具：

```sh
npm ci
npm --prefix desktop ci
npm run desktop:build
npm run desktop:test
node desktop/privacy-check.mjs
node desktop/privacy-check.mjs --history
node desktop/package.mjs darwin arm64
node desktop/package.mjs darwin x64
node desktop/package.mjs win32 x64
node desktop/verify-packages.mjs
```

Electron 版本固定 44.7.2。默认从官方 Electron Release 下载；若设置 `LEO_ELECTRON_ZIP_DIR` 使用本地运行环境，必须先与官方 `SHASUMS256.txt` 校验。跨系统生成包不代表已在目标系统实测。当前未签名/公证。

`build.mjs` 只产出指定程序文件，禁止从工作目录整体复制。打包前执行扫描，打包后解出 `resources/app.asar`（Mac 为 `Contents/Resources/app.asar`），再次运行 `privacy-check.mjs <解包目录>`，并核对载荷与已审核构建一致。`dist/`、运行数据、安装后的用户目录一律不进 Git。

运行方式：Vite 构建静态 React 界面；Electron 主进程注册内部 HTTPS 协议，复用既有保存/复盘接口；SQLite 提供本地事务和乐观并发检查。没有监听网络端口，桌面身份固定为当前系统用户的本地工作台。没有启用 MCP/钉钉路由。外部导航禁止进入应用，特定用户点击链接在外部浏览器打开。

安全设置使用 sandbox、contextIsolation、关闭 nodeIntegration、CSP、限制网络请求和默认拒绝权限。桌面 Origin 桥仅用于内部协议的同源请求；网页版原有来源校验不变。参考 [Electron 安全文档](https://www.electronjs.org/docs/latest/tutorial/security/)。

首次启动可选择数据目录；既有用户沿用原目录。默认目录由稳定应用名 `Leo Workbench` 的 userData 决定，与应用程序目录分离。日记/周记目录可单独选择，外部修改通过文件版本检测冲突。启动前每日备份，升级前额外快照；数据库迁移带事务及版本记录。`LEO_DESKTOP_TEST_DATA` 仅用于隔离测试目录，不应在给用户的启动流程中设置。测试只用虚构数据。

Drizzle ORM 0.45.2 的包未包含 LICENSE，因此保留官方标签的 Apache-2.0 许可证副本：`https://github.com/drizzle-team/drizzle-orm/blob/0.45.2/LICENSE`。构建同时收集实际客户端依赖及服务端运行依赖的许可证。
