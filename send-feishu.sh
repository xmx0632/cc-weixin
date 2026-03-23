#!/bin/bash
# 飞书消息发送脚本

MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "用法: $0 \"消息内容\""
    exit 1
fi

python3 /Volumes/macext/code/test/cc-weixin/feishu-bot/feishu_send.py --message "$MESSAGE"
