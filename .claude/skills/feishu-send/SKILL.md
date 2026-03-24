---
name: feishu-send
description: Send messages and files to Feishu (Lark) group chats. Supports sending text messages and files of any type.
license: MIT
---

# Feishu Send Skill

Send messages and files to Feishu (Lark) group chats directly from Claude Code.

## Purpose

Quickly send:
- Text messages to Feishu group chats
- Files (documents, images, audio, code, etc.) to Feishu
- Both files and messages in one command

## When to Use

Use this skill when you want to:
- Send generated code/files to a Feishu group chat
- Share analysis results with your team
- Send notifications or reports
- Deliver documents for review

## Setup

### 1. Environment Configuration

The skill uses the feishu-bot project. Set the `FEISHU_BOT_DIR` environment variable to point to your feishu-bot directory, or place it as a sibling to cc-weixin.

Create a `.env` file in the feishu-bot directory:

```bash
cd <your-feishu-bot-directory>
cp release/.env.example .env
# Edit .env with your credentials
```

Required environment variables:
```bash
FEISHU_APP_ID=cli_xxxxx
FEISHU_APP_SECRET=xxxxx
FEISHU_DEFAULT_CHAT_ID=oc_xxxxx  # Optional default group chat
```

### 2. Get Credentials

1. Visit [Feishu Open Platform](https://open.feishu.cn/)
2. Create an app and get `App ID` and `App Secret`

### 3. Find Chat ID

```bash
cd <your-feishu-bot-directory>
source venv/bin/activate
python get_chats.py
```

This will list all available group chats and their chat IDs.

## Tool Location

**Skill directory**: `.claude/skills/feishu-send/`
- `SKILL.md` - This file
- `feishu_send.sh` - Main script wrapper

**Core module**: feishu-bot project
- `feishu_send.py` - CLI tool for sending messages/files
- `feishu_file_sender.py` - Core sender class

## Usage Workflow

### Send Text Message

```bash
cd <your-feishu-bot-directory>
source venv/bin/activate
python feishu_send.py --message "你好，这是测试消息"
```

### Send File

```bash
python feishu_send.py --file /path/to/file.pdf
```

### Send Multiple Files

```bash
python feishu_send.py --file file1.pdf file2.png file3.md
```

### Send File with Message

```bash
python feishu_send.py --file report.pdf --message "报告已生成，请查收"
```

### Specify Chat ID

```bash
python feishu_send.py --message "消息" --chat-id oc_xxx
```

## Command Reference

| Parameter | Short | Description | Example |
|-----------|-------|-------------|---------|
| `--message` | `-m` | Text message to send | `--message "Hello"` |
| `--file` | `-f` | File path(s) to send | `--file doc.pdf` |
| `--chat-id` | `-c` | Target group chat ID | `--chat-id oc_xxx` |

## Supported File Types

- **Documents**: PDF, TXT, MD, HTML, JSON, etc.
- **Images**: PNG, JPG, JPEG
- **Audio**: WAV, MP3, M4A
- **Code**: Python, JavaScript, etc.
- **Archives**: ZIP, etc.

## Examples

### Example 1: Send Generated Code

After generating a Python script, send it to your team:

```bash
python feishu_send.py --file script.py --message "这是新生成的自动化脚本"
```

### Example 2: Send Analysis Report

```bash
python feishu_send.py --file analysis_report.md --message "数据分析报告已完成"
```

### Example 3: Send Multiple Images

```bash
python feishu_send.py --file screenshot1.png screenshot2.png --message "测试结果截图"
```

### Example 4: Quick Notification

```bash
python feishu_send.py --message "部署已完成，请验证"
```

## Error Handling

If you see `未找到 FEISHU_APP_ID 或 FEISHU_APP_SECRET`:
- Check that `.env` file exists with proper credentials

If you see `未指定 chat_id`:
- Use `--chat-id` parameter
- Or set `FEISHU_DEFAULT_CHAT_ID` in `.env`

## Tips

1. **Use Default Chat ID**: Set `FEISHU_DEFAULT_CHAT_ID` to avoid specifying `--chat-id` every time
2. **Absolute Paths**: Use absolute paths for files to avoid path issues
3. **Combine Messages**: Send files and messages together for context
4. **Find Chat ID**: Use `get_chats.py` to list all available group chats

## API Reference

The skill uses Feishu's Open API:
- **Upload**: `POST /open-apis/im/v1/files`
- **Send Message**: `POST /open-apis/im/v1/messages`

For more details, see [Feishu API Documentation](https://open.feishu.cn/document)

## License

MIT License
