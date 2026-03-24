#!/bin/bash
# Feishu Send Skill - Wrapper script for cc-weixin
# Usage: ./feishu_send.sh --message "message" [--file file] [--chat-id chat_id]
#
# 配置: 在 feishu-bot 项目目录下创建 .env 文件
#       或设置 FEISHU_BOT_DIR 环境变量指向 feishu-bot 目录

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 本地 venv 目录
VENV_DIR="$SCRIPT_DIR/venv"

# 检查并创建 venv
if [ ! -d "$VENV_DIR" ]; then
    echo "首次运行，正在创建虚拟环境..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install -q requests python-dotenv requests-toolbelt
    echo "虚拟环境创建完成"
else
    source "$VENV_DIR/bin/activate"
fi

# 查找 .env 文件（优先使用 feishu-bot 目录下的）
ENV_FILE=""
if [ -n "$FEISHU_BOT_DIR" ] && [ -f "$FEISHU_BOT_DIR/.env" ]; then
    ENV_FILE="$FEISHU_BOT_DIR/.env"
elif [ -f "$SCRIPT_DIR/../../../feishu-bot/.env" ]; then
    ENV_FILE="$SCRIPT_DIR/../../../feishu-bot/.env"
elif [ -f "$SCRIPT_DIR/.env" ]; then
    ENV_FILE="$SCRIPT_DIR/.env"
fi

if [ -z "$ENV_FILE" ]; then
    echo "错误: 未找到 .env 文件"
    echo "请在以下位置之一创建 .env 文件:"
    echo "  1. feishu-bot 项目目录 (推荐)"
    echo "  2. 当前 skill 目录: $SCRIPT_DIR"
    echo "或者设置 FEISHU_BOT_DIR 环境变量"
    exit 1
fi

# 导出环境变量
set -a
source "$ENV_FILE"
set +a

# 运行 Python 脚本
python "$SCRIPT_DIR/feishu_send.py" "$@"
