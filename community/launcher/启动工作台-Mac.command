#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "请先从 https://nodejs.org/ 安装 Node.js 24 LTS，再打开此文件。"
else
  node scripts/local-launcher.mjs start
fi
read -r -p "按回车关闭窗口……" _reply
