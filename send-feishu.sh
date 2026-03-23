#!/bin/bash
# 飞书消息发送脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "用法: $0 \"消息内容\""
    exit 1
fi

python3 "$SCRIPT_DIR/feishu-bot/feishu_send.py" --message "$MESSAGE"
