# cc-weixin 项目记忆索引

本文件是 Claude Code 自动记忆的索引，记录项目重要信息。

## 项目概述

**cc-weixin** - 微信 Claude Code Agent 桥接器

- 通过腾讯官方 iLink Bot API 接收微信消息
- 转发给 Claude Code Agent 执行（带完整工具能力）
- 将回复发回微信

## 技术栈

- Node.js >= 22
- `@anthropic-ai/claude-agent-sdk` - Claude Agent SDK
- GLM API（智谱）- 通过 Claude 兼容接口

## 关键文件

| 文件 | 说明 |
|------|------|
| `cc-weixin.mjs` | 主入口，支持 TUI 和 CLI 模式 |
| `lib/claude.mjs` | Claude SDK 调用，会话管理 |
| `lib/session.mjs` | 对话历史管理 |
| `lib/claude-session.mjs` | Claude Code 会话集成 |
| `lib/messaging.mjs` | 微信消息收发 |
| `lib/auth.mjs` | 微信扫码登录 |

## 可用命令（微信中发送）

| 命令 | 功能 |
|------|------|
| `/clear` | 清除对话历史 |
| `/compact` | 压缩上下文并保存摘要 |
| `/sessions` | 查看历史会话列表 |
| `/help` | 显示帮助信息 |

## 外部工具

### 飞书消息发送
```bash
# 使用项目相对路径（推荐）
./send-feishu.sh "消息内容"

# 或设置环境变量
# export FEISHU_BOT_PATH=/path/to/feishu-bot
python3 "$FEISHU_BOT_PATH/feishu_send.py" --message "消息内容"
```

## 环境配置

- `.env` - API 密钥配置
  - `ANTHROPIC_AUTH_TOKEN` - GLM API Key
  - `ANTHROPIC_BASE_URL` - https://open.bigmodel.cn/api/anthropic

---
*最后更新: 2026-03-22*
