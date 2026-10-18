# Leo 个人工作台 · 开源共创

把重要的事，向前推进一点。一个从真实日常使用中迭代的个人行动与复盘工具。

**2026-10-18：0.3.0 群友试用版。** [选择 Windows / Mac 下载](docs/download.md)，无需开发环境、无需登录。项目表格、日记与周复盘、本地自动保存；可选关联自己的 Obsidian 文件夹。Windows / Intel Mac 待实机验证，未签名/公证，先小范围试用。

[下载桌面版](docs/download.md) · [源码启动指南](docs/local-start.md) · [隐私检查](docs/privacy-check.md) · [查看源码](community/README.md) · [参加朋友试用](docs/community-pilot.md) · [反馈问题](https://github.com/mantoumessi-spec/leo-life-workbench/issues) · [贡献指南](CONTRIBUTING.md) · [更新记录](CHANGELOG.md)

![群友版项目表格，虚构测试昵称](docs/images/community-preview-2026-10-18.png)

*本地测试预览，非已开放的线上试用站。*

## 它能帮你做什么

- 今天的重要事项、08:00—22:00 的计划与实际并排记录，连续时段可合并。
- 按项目归类时间，区分投资、消费和负债。
- 项目进展按日期连续积累，未完成事项可继续安排、完成或关闭。
- 小结可以全屏写作，有效输入自动保存，保存失败和冲突会提示。
- 行动 JSON 备份/恢复、Markdown 日记、每周回顾和完整本地快照；可手动复制内容给自己的 AI。

新用户没有作者的业务和日记数据。各自使用自己的工作台，共同迭代代码；不提供群内共享项目。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 通用应用源码 | `community/`，MIT 开源，含本地运行步骤 |
| 个人原型 | 作者继续使用，未开放给他人 |
| 朋友版在线试用 | 暂不推进，先验证本地使用体验 |
| 本地验证 | 87 项业务测试、3 项桌面集成测试、类型检查与构建通过 |
| AI 接入 | 桌面版不启用 MCP；可手动复制给自己的 AI |
| 钉钉 | 朋友版前后端关闭，不复用公司应用 |

桌面版使用本机数据库，无需账号登录。未来云端托管才依赖 Sites 登录和 D1 存储，并非下载代码后自动获得免费云服务。网站不另外调用收费 AI API，现有 AI 产品和托管仍有各自额度。本地记录由自己的电脑保存，不提供本地密码保护；共享电脑建议使用独立系统账号。默认上海时区，六个可改名项目位置；新版日记使用本地 Markdown 原文。

## 开发者快速开始

```sh
git clone https://github.com/mantoumessi-spec/leo-life-workbench.git
cd leo-life-workbench/community
npm ci
npm --prefix desktop ci
npm run desktop:build
npm run desktop:test
```

桌面开发需要 Node.js 24。打包步骤见 [桌面开发说明](community/desktop/README.md)。旧 Wrangler 网页开发入口保留供开发者参考，尚未适配新版本地 Markdown 文件接口，不是群友试用入口。

[本次更新记录](docs/build-log/2026-10-18-local-community-preview.md)

## 一起迭代

先邀请几位朋友用两周，关注三个问题：哪里看不懂、哪里不好用、哪里真的帮到了你。反馈不需要附个人记录或数据备份。

- [这次为什么开放源码](docs/build-log/2026-10-14-community-edition.md)
- [项目进展时间线](docs/build-log/2026-10-09-project-continuity.md)
- [之前的私人原型介绍](docs/private-prototype-overview.md)

本项目代码按 [MIT](LICENSE) 开源，第三方代码保留原许可证。保护隐私的方法见 [SECURITY.md](SECURITY.md)。
