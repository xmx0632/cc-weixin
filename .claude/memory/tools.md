# 可用工具记录

## 飞书消息发送

### Shell 脚本方式（推荐）
```bash
./send-feishu.sh "消息内容"
```

### Python 脚本方式
```bash
# 使用项目相对路径
python3 "$(dirname "$0")/../feishu-bot/feishu_send.py" --message "消息内容"

# 或设置环境变量
# export FEISHU_BOT_PATH=/path/to/feishu-bot
python3 "$FEISHU_BOT_PATH/feishu_send.py" --message "消息内容"
```

**位置**: `feishu-bot/feishu_send.py`（项目相对路径）
**说明**: 发送消息到默认飞书群


## 飞书文件发送

### 方法一：使用 Shell 脚本（推荐）
```bash
./send-feishu.sh /path/to/file.txt
```

### 方法二：使用 Python 脚本
```bash
cd feishu-bot
source .env && source venv/bin/activate
python send_file_to_feishu.py /path/to/file.txt
```

**位置**: `feishu-bot/send_file_to_feishu.py`（项目相对路径）
**说明**: 发送文件到飞书群（支持 txt, md, pdf, 图片等格式）


---
*最后更新: 2026-03-23*
