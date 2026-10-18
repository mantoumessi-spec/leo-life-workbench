# 下载个人工作台 · 0.3.0 群友试用版

**选择电脑版本 → 解压打开 → 填个昵称 → 开始使用。** 无需安装 Node.js，无需登录 ChatGPT。各自记录、各自保存，一起反馈和迭代。

| 你的电脑 | 下载 |
| --- | --- |
| Windows，Intel / AMD 64 位 | [下载 Windows 版](https://github.com/mantoumessi-spec/leo-life-workbench/releases/download/v0.3.0-preview.1/Leo-Workbench-0.3.0-Windows-x64.zip) |
| Mac，Apple 芯片（M 系列） | [下载 Mac Apple 芯片版](https://github.com/mantoumessi-spec/leo-life-workbench/releases/download/v0.3.0-preview.1/Leo-Workbench-0.3.0-Mac-Apple.zip) |
| Mac，Intel 芯片 | [下载 Mac Intel 版](https://github.com/mantoumessi-spec/leo-life-workbench/releases/download/v0.3.0-preview.1/Leo-Workbench-0.3.0-Mac-Intel.zip) |

不确定 Mac 类型：苹果菜单 → 关于本机，看“芯片”或“处理器”。Windows ARM 尚未验证。请在电脑浏览器打开此页面，微信内无法下载时选择“在浏览器打开”。

## 第一次打开

- Windows：完整解压 ZIP，双击 `LeoWorkbench.exe`。不要在压缩包里运行，也不要单独拖出 exe。
- Mac：解压 ZIP，把 `Leo Workbench.app` 放入“应用程序”，然后打开。
- 首次启动可选择默认数据文件夹，或指定自己的专用文件夹。随后填昵称，到“项目”给通用项目取名，再记一件事。
- 输入会自动保存；退出前确认显示已保存。先用几条测试记录验证保存、退出重开和备份，再正式使用。

**这是未签名、未公证的小范围测试包。** 系统可能阻止首次打开；遇到时把提示发给维护者，不要关闭安全软件或执行绕过安全检查的命令。下载后的系统放行体验仍需要不同电脑的反馈。三个包均做内容检查；Windows / Intel Mac 尚未完成实机验收，不能视为稳定版。

## 可以做什么

项目表格与进展时间线、每日重点、08:00—22:00 的计划和实际、连续时段合并、日记全屏写作、每周回顾、自动保存、备份与恢复。

新用户只有六个可改名的项目位置，其他记录为空；不包含作者的业务、日记、目标、公司授权或私人站点地址。示例截图中的记录为虚构测试内容。

## 数据保存在什么地方

默认保存位置（首次启动可改选专用目录）：

- Mac：`~/Library/Application Support/Leo Workbench/`
- Windows：`%APPDATA%/Leo Workbench/`

“文件 → 打开数据和备份文件夹”可直接找到。`workbench.sqlite` 保存行动数据；`日记/`、`周记/` 保存 Markdown 原文；`backups/` 保存备份。系统浏览器缓存中还可能保留尚未提交的输入草稿。

**Obsidian 是可选项。** 在“更多 → 导出与备份 → 数据位置与 Obsidian”中，分别选自己的日记和周记文件夹。不用 Obsidian 就保持默认。只识别所选目录顶层的 `.md` 文件；新日记按 `YYYY-MM-DD.md`，新周记按 `YYYY-MM-DD至YYYY-MM-DD.md` 命名。旧周记可在周回顾中手动关联原文件。

关联不会搬动已有文件；后续网页编辑会直接保存原文件。检测到其他窗口修改时会暂停覆盖，要求核对合并。切换文件夹前先完成保存。

## 备份、更新和隐私

“备份全部本地内容”包含数据库、日记周记和目录关联，保存到本机 `backups/`；“下载行动数据备份”只导出项目、计划等结构化数据，不含 Markdown 原文。完整快照目前由维护者协助恢复，恢复前先解包到新目录核对，不直接覆盖日记。

每个新版本首次打开前自动保留数据库副本；日记每次修改前也保留旧文。升级前仍建议手动做一次完整备份，退出旧版后替换程序，**不要删除数据文件夹**。不提供自动更新；不要同时运行两个版本。

软件没有遥测或云同步，不开放本地网络端口，不连接付费 AI，不连接钉钉。系统听写可用于输入，其联网行为由系统设置决定；桌面版不启用浏览器语音识别。需要 AI 时，自行选择要复制到自己的 AI 对话中的内容。系统云盘或备份工具可能另外同步所选文件夹。

数据没有额外密码或加密，共用电脑请使用独立系统账号。电脑关机后不能通过手机访问。群友之间不会自动共享项目和记录。

## 反馈

直接在交流群反馈，或 [提交问题](https://github.com/mantoumessi-spec/leo-life-workbench/issues/new)。请说明：电脑系统、版本、操作步骤、预期和实际结果。截图遮住个人内容，**不要发数据库、完整备份或日记**。

[本次发布与校验文件](https://github.com/mantoumessi-spec/leo-life-workbench/releases/tag/v0.3.0-preview.1) · [源代码](../community/) · [隐私检查](privacy-check.md)
