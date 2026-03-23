---
name: cc-weixin
description: 在微信里使用 Claude Code Agent。通过腾讯官方 iLink Bot API 连接微信和 Claude，让用户可以在微信中与 Claude Code Agent 交互。支持完整的工具调用能力（Bash、文件读写、Web 搜索等）。当用户想要启用微信渠道、在微信中使用 Claude、或启动微信机器人时使用此技能。
---

# CC-Weixin - 微信 Claude Code Agent 桥接器

这是一个将微信消息连接到 Claude Code Agent 的桥接服务，基于腾讯官方 iLink Bot API。

## 功能特性

- 通过微信发送消息给 Claude Code Agent
- Claude 可以执行完整的工具调用（Bash、Read、Write、WebSearch 等）
- 支持多用户会话管理
- TUI 界面或纯 CLI 模式运行

## 快速启动（推荐）

**本 Skill 包含安装脚本和启动脚本，可一键安装运行：**

```bash
# 1. 进入 skill 目录
cd /path/to/cc-weixin-skill

# 2. 运行安装脚本（自动安装 Node.js 和依赖）
./install.sh

# 3. 设置 API Key
export ANTHROPIC_AUTH_TOKEN=sk-your-api-key

# 4. 启动服务
./cc-weixin.sh
```

## 命令行选项

| 命令 | 说明 |
|------|------|
| `./cc-weixin.sh` | 启动服务（TUI 模式，推荐） |
| `./cc-weixin.sh --login` | 强制重新扫码登录 |
| `./cc-weixin.sh --no-tui` | 纯 CLI 模式 |
| `./cc-weixin.sh install` | 安装/更新依赖 |

## 手动安装（备选）

如果已安装 Node.js >= 22，可直接使用 npx：

```bash
# 设置环境变量
export ANTHROPIC_AUTH_TOKEN=sk-your-api-key

# 启动服务
npx cc-weixin
```

## 环境变量配置

创建 `.env` 文件或设置环境变量：

```env
ANTHROPIC_AUTH_TOKEN=sk-your-api-key
# 可选：自定义 API 地址
# ANTHROPIC_BASE_URL=https://api.anthropic.com
```

## 运行模式

| 命令 | 说明 |
|------|------|
| `npx cc-weixin` | TUI 界面（默认，推荐） |
| `npx cc-weixin --no-tui` | 纯 CLI 模式 |
| `npx cc-weixin --login` | 强制重新扫码登录 |

## 首次使用

1. 运行 `npx cc-weixin`
2. 终端会显示二维码
3. 用微信扫码授权
4. 登录信息会保存到 `~/.cc-weixin/token.json`
5. 下次启动自动复用登录状态

## TUI 快捷键

| 按键 | 功能 |
|------|------|
| `L` | Logout - 清除登录信息并退出 |
| `R` | Reconnect - 重连 |
| `Q` | Quit - 退出 |

## 工作原理

```
微信用户 ──发消息──> cc-weixin ──askClaude──> Claude Code Agent
    │                  │                        │
    │                  │                        ├── 执行 Bash
    │                  │                        ├── 读写文件
    │                  │                        └── Web 搜索
    │                  │                        │
    └──收到回复────────└──返回结果──────────────┘
```

## 微信中的斜杠命令

用户可以在微信中发送以下命令：

- `/clear` - 清除聊天历史
- `/compact` - 压缩上下文并保存摘要
- `/sessions` - 列出历史会话
- `/filters` - 显示响应过滤器
- `/filter <name>` - 切换过滤器开关
- `/help` - 显示帮助

## 注意事项

1. **权限模式**：服务运行在 `bypassPermissions` 模式，因为微信无法交互权限提示
2. **会话隔离**：每个微信用户有独立的会话，通过 `from_user_id` 区分
3. **官方 API**：使用腾讯官方 iLink Bot API，域名 `ilinkai.weixin.qq.com`

## 故障排除

**Session 过期**：
```
❌ Session 已过期，请重新运行: npx cc-weixin --login
```

**Node 版本不足**：
```
# 使用 nvm 升级
nvm install 22
nvm use 22
```

## 相关链接

- npm: https://www.npmjs.com/package/cc-weixin
- GitHub: https://github.com/hao-ji-xing/cc-weixin
- iLink 协议文档: https://docs.openclaw.ai
