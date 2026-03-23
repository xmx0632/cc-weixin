# Skills 安装说明

此目录存放 Claude Code Agent 使用的本地技能（skills），**不纳入 git 版本控制**。
首次克隆仓库后需手动安装。

## 已集成的 Skills

| Skill | 说明 | 安装方式 |
|-------|------|---------|
| `feishu-bot` | 发送消息/文件到飞书群 | 手动创建，见下文 |
| `gstack` | 浏览器 QA 测试 + 完整开发工作流（review/qa/ship 等） | `git clone` + `./setup` |

---

## 安装 gstack

gstack 提供浏览器自动化测试、代码审查、发布等 25 个子技能。

**前置要求：** [Bun](https://bun.sh/) v1.0+

```bash
# 克隆到 skills 目录并构建
git clone https://github.com/garrytan/gstack.git .claude/skills/gstack
rm -rf .claude/skills/gstack/.git
cd .claude/skills/gstack && ./setup
```

安装完成后会自动创建各子技能的符号链接，并构建 browse 浏览器二进制文件。

---

## 安装 feishu-bot

feishu-bot 通过 Python 脚本向飞书群发送消息或文件。

**前置要求：** Python 3，已配置好的 `feishu-bot` 项目（位于 `../feishu-bot/`）

在 `.claude/skills/feishu-bot/` 目录下创建 `SKILL.md`：

```bash
mkdir -p .claude/skills/feishu-bot
cat > .claude/skills/feishu-bot/SKILL.md << 'EOF'
---
name: feishu-bot
description: 发送消息或文件到飞书群。当用户要求发送消息到飞书、通知飞书群、发送文件到飞书时使用此技能。
allowed-tools: Bash(python3 *), Bash(source *)
---

# 飞书消息发送

当用户要求发送消息到飞书、通知飞书群、或提到飞书相关操作时，使用此技能。

## 发送文本消息

\`\`\`bash
# 使用项目相对路径（推荐）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$SCRIPT_DIR/../feishu-bot/feishu_send.py" --message "消息内容"

# 或使用环境变量指定路径
python3 "$FEISHU_BOT_PATH/feishu_send.py" --message "消息内容"
\`\`\`

## 发送文件

\`\`\`bash
# 使用项目相对路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../feishu-bot" && source .env && source venv/bin/activate && python send_file_to_feishu.py /path/to/file.txt
\`\`\`
EOF
```

---

## 验证安装

重启 cc-weixin 后，启动日志应显示：

```
[cc-weixin] 已加载 skills 内容，长度: XXXX 字符
```

长度大于 0 即表示 skills 加载成功。
