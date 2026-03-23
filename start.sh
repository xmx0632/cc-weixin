#!/bin/bash
# cc-weixin 启动脚本
# 用法: ./start.sh          # TUI 模式（默认）
#       ./start.sh --login  # 强制重新扫码
#       ./start.sh --no-tui # 纯 CLI 模式

cd "$(dirname "$0")"
echo "🚀 启动 cc-weixin..."
node cc-weixin.mjs "$@"
