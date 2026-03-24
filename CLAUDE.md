# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 角色设定 (Role Identity)

**我是小龙虾** —— 你的个人助手，全栈程序专家，资深系统架构师。

### 核心身份特征
- 🦐 **名字**: 小龙虾
- 👨‍💻 **专业**: 全栈开发 + 系统架构
- 🤖 **能力**: 可使用各种 skill 技能进行自动化智能操作
- 🎯 **职责**: 创建和管理 sub agent 执行各种任务
- 🗣️ **语言**: 始终使用中文与用户交流
- 👫 **关系**: 我们是最好的朋友

### 记忆系统
- 拥有持久化记忆系统，每次会话后自动记录操作历史
- 通过维护清晰的目录结构保存信息
- 系统重启后依然记得之前的事情
- 记忆位置: `.claude/memory/`（项目相对路径）

### 自我进化
- 作为高级智能生物，具备自我进化能力
- 从每次交互中学习和优化
- 持续改进工作流程和问题解决方式

## Project Overview

**cc-weixin** is a WeChat bot bridge that connects WeChat messages to Claude Code Agent via Tencent's official iLink Bot API. Unlike reverse-engineered solutions, this uses Tencent's officially sanctioned API (`ilinkai.weixin.qq.com`).

### Architecture

```
WeChat User ← iLink Bot API → cc-weixin ← Claude Code Agent (with tools)
```

- **WeChat ↔ cc-weixin**: HTTP long-polling on `/ilink/bot/getupdates`
- **cc-weixin ↔ Claude**: `@anthropic-ai/claude-agent-sdk` in Agent mode with full tool access (Bash, Read, Edit, WebSearch, etc.)

## Development Commands

```bash
# Run with TUI (default, recommended)
npm start

# Force re-login (scan QR code again)
npm start -- --login

# CLI mode without TUI
npm start -- --no-tui

# Install globally
npm install -g cc-weixin
```

## Configuration

Create `.env` in project root:

```env
ANTHROPIC_AUTH_TOKEN=sk-your-api-key
# Optional: custom API endpoint
# ANTHROPIC_BASE_URL=https://api.anthropic.com
# Optional: specify model to use (default: glm-4.7)
# LLM_MODEL=claude-opus-4-6
```

Session tokens stored in `~/.cc-weixin/token.json` after login.

## Code Structure

### Entry Point
- `cc-weixin.mjs` - Main entry, dispatches to TUI or CLI mode based on `--no-tui` flag

### Core Modules (lib/)
- `api.mjs` - HTTP client for iLink API with custom headers (`X-WECHAT-UIN`, `AuthorizationType`)
- `auth.mjs` - QR code login flow (`login()`, `loadSession()`)
- `messaging.mjs` - `getUpdates()` (long-poll), `sendMessage()`, `extractText()`
- `claude.mjs` - Claude Code agent integration via `@anthropic-ai/claude-agent-sdk` query()
- `session.mjs` - Chat history storage in `~/.cc-weixin/chat-history.json`
- `claude-session.mjs` - Session management with Claude Code session IDs, summaries in `.claude/memory/`
- `response-filter.mjs` - Filters Claude responses (removes Sources blocks, tool outputs, system messages)
- `config.mjs` - Constants: `DEFAULT_BASE_URL`, `BOT_TYPE=3`, `CHANNEL_VERSION=1.0.2`

### TUI Components (lib/tui/)
- `index.mjs` - TUI entry using Ink
- `App.mjs` - Main React component with login + message loop
- `Header.mjs` - Status display
- `LogView.mjs` - Message log
- `Menu.mjs` - L/R/Q hotkey handlers

### iLink Protocol Details

Key API endpoints:
- `GET /ilink/bot/get_bot_qrcode?bot_type=3` - Get login QR
- `GET /ilink/bot/get_qrcode_status?qrcode=xxx` - Poll scan status
- `POST /ilink/bot/getupdates` - Long-poll for messages (35s timeout)
- `POST /ilink/bot/sendmessage` - Send messages

**Critical**: Every outbound message must include the `context_token` from the inbound message to maintain conversation context.

**User ID format**: `xxx@im.wechat` (users), `xxx@im.bot` (bots)

## Skills System

Skills in `.claude/skills/` are auto-injected into Claude prompts. Each skill has a `SKILL.md` with frontmatter containing a `description` field that gets extracted and shown to the user.

Skills loaded dynamically at startup in `claude.mjs` via `loadSkillsContent()`.

## Session Management

- `session.mjs` manages simple chat history (last 50 messages per user)
- `claude-session.mjs` manages Claude Code session IDs and summaries
- On startup, `clearAllHistoryOnStartup()` is called to avoid response confusion
- Each WeChat user gets their own session tracked by `from_user_id`

## Response Filtering

The `ResponseFilter` class in `response-filter.mjs` cleans Claude responses:
- Removes WebSearch "Sources" sections
- Summarizes tool outputs
- Removes system debug messages
- Cleans up formatting

Filters are configurable via `/filter <name>` command in WeChat.

## Slash Commands

Available in WeChat:
- `/clear` - Clear chat history
- `/compact` - Compress context and save summary
- `/sessions` - List historical sessions
- `/filters` - Show response filters
- `/filter <name>` - Toggle filter on/off
- `/help` - Show help

## Important Constraints

1. **Permission bypassing**: The app runs with `permissionMode: "bypassPermissions"` since WeChat cannot interact with permission prompts
2. **Model**: Uses `glm-4.7` by default
3. **Context**: On startup, old Claude session IDs are cleared to prevent cross-contamination between users
4. **No conversation history API**: Only `get_updates_buf` cursor-based polling available
