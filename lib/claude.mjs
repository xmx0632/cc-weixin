import { query } from "@anthropic-ai/claude-agent-sdk";
import { getFormattedHistory, getHistoryLength, addMessage, clearUserHistory } from "./session.mjs";

// 命令常量
const CMD_CLEAR = "/clear";
const CMD_COMPACT = "/compact";
const CMD_SESSIONS = "/sessions";
const CMD_HELP = "/help";
const CMD_FILTERS = "/filters";
const CMD_FILTER_PREFIX = "/filter ";
import { ResponseFilter, FilterContext } from "./response-filter.mjs";
import {
  getOrCreateSession,
  getCurrentSession,
  updateSession,
  markSessionCleared,
  updateSessionSummary,
  appendSessionSummary,
  listSessions,
} from "./claude-session.mjs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";

// 获取项目根目录
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const MEMORY_DIR = join(PROJECT_ROOT, ".claude", "memory");
const SKILLS_DIR = join(PROJECT_ROOT, ".claude", "skills");

/**
 * 从 SKILL.md frontmatter 中提取 description 字段
 * 支持 YAML 块标量 (|) 和折叠标量 (>) 语法
 */
function extractSkillDescription(skillContent) {
  const match = skillContent.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return "";
  const frontmatter = match[1];
  // 提取 description（支持多行）
  const descMatch = frontmatter.match(/description:\s*[|>]?\s*\n?([\s\S]*?)(?=\n\w|\n---\n|$)/);
  if (!descMatch) return "";
  return descMatch[1].replace(/^\s+/gm, "").trim();
}

function loadSkillsContent() {
  let content = "";
  try {
    if (existsSync(SKILLS_DIR)) {
      const entries = readdirSync(SKILLS_DIR).sort();
      for (const entry of entries) {
        const skillPath = join(SKILLS_DIR, entry);
        const skillFile = join(skillPath, "SKILL.md");
        if (statSync(skillPath).isDirectory() && existsSync(skillFile)) {
          const skillContent = readFileSync(skillFile, "utf-8");
          const description = extractSkillDescription(skillContent) || entry;
          content += `\n- **${entry}**: ${description}`;
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }
  return content ? `以下技能可用（调用时执行 SKILL.md 中的指令）：\n${content}` : "";
}

const skillsContent = loadSkillsContent();

// 创建响应过滤器
const responseFilter = new ResponseFilter({
  preserveOriginal: true, // 保留原始响应用于调试
  debug: process.env.DEBUG_FILTER === "1",
});

function toArrayContent(content) {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  return content;
}

/**
 * 调用 Claude Code agent，返回最终文本回复
 * @param {string} userText - 用户输入
 * @param {string} userId - 用户ID（用于区分不同用户的对话历史）
 */
export async function askClaude(userText, userId = "default") {
  // 获取或创建会话
  const session = getOrCreateSession(userId);

  const isFirstMessage = !session.claudeSessionId;

  async function* messages() {
    if (isFirstMessage && skillsContent) {
      const enhancedText = `${userText}

---
# 系统提示：你有以下可用技能
${skillsContent}`;
      yield {
        type: "user",
        session_id: session.claudeSessionId || "",
        parent_tool_use_id: null,
        message: {
          role: "user",
          content: toArrayContent(enhancedText)
        },
      };
    } else {
      yield {
        type: "user",
        session_id: session.claudeSessionId || "",
        parent_tool_use_id: null,
        message: {
          role: "user",
          content: toArrayContent(userText)
        },
      };
    }
  }

  addMessage(userId, "user", userText);

  let result = "";
  let claudeSessionId = null;

  try {
    for await (const msg of query({
      prompt: messages(),
      options: {
        model: "glm-4.7",
        baseTools: [{ preset: "default" }],
        deniedTools: ["AskUserQuestion"],
        // 绕过所有权限检查（微信环境无法交互确认）
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        cwd: PROJECT_ROOT,
        env: process.env,
        abortController: new AbortController(),
        // 启用自动记忆，加载项目记忆文件
        autoMemoryEnabled: true,
        autoMemoryDirectory: MEMORY_DIR,
        // 通过 systemPrompt preset 注入 skills 内容
        systemPrompt: skillsContent ? { type: "preset", append: `# 可用技能\n\n${skillsContent}` } : undefined,
        // 额外的权限设置
        settings: {
          permissions: {
            allow: [
              "Read(**)",
              "Edit(**)",
              "Write(**)",
              "Bash(**)",
            ],
          },
        },
      },
    })) {
      // 捕获 Claude Code 分配的 session_id
      if (msg.session_id && !claudeSessionId) {
        claudeSessionId = msg.session_id;
      }
      if (msg.type === "result" && msg.result) {
        result = msg.result;
      }
      // 检查 assistant 消息
      if (msg.type === "assistant" && msg.message?.content) {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              result += block.text;
            }
          }
        } else if (typeof content === "string") {
          result += content;
        }
      }
    }
  } catch (e) {
    result = `错误: ${e.message}`;
  }

  if (claudeSessionId && session.claudeSessionId !== claudeSessionId) {
    updateSession(session.id, { claudeSessionId });
  }

  const filterContext = new FilterContext({
    historyLength: getHistoryLength(userId),
    userId: userId,
  });
  const filterResult = responseFilter.filter(result, filterContext);

  addMessage(userId, "assistant", filterResult.filtered);

  if (filterResult.appliedFilters.length > 0 && process.env.DEBUG_FILTER === "1") {
    console.log(`[Filter] Applied filters: ${filterResult.appliedFilters.join(", ")}`);
    console.log(`[Filter] Reduction: ${filterResult.reductionRate}`);
  }

  return filterResult.filtered || "（Claude 无回复）";
}

export function clearChatHistory(userId) {
  clearUserHistory(userId);

  const session = getOrCreateSession(userId);
  markSessionCleared(session.id);
}

export function compactSession(userId) {
  const history = getFormattedHistory(userId);
  const session = getOrCreateSession(userId);

  if (history.length === 0) {
    return "当前对话为空，无需压缩";
  }

  const recentMessages = history.slice(-10);
  const summary = recentMessages
    .map((msg) => `${msg.role === "user" ? "用户" : "Claude"}: ${msg.content.slice(0, 100)}...`)
    .join("\n");

  updateSessionSummary(session.id, summary);
  appendSessionSummary(session.id, session.title, summary);

  clearUserHistory(userId);

  return `✅ 上下文已压缩，摘要已保存（${recentMessages.length} 条消息）`;
}

export function listSessionsFormatted() {
  const sessions = listSessions();

  if (sessions.length === 0) {
    return "暂无历史会话";
  }

  return sessions
    .map((s, i) => `${i + 1}. ${s.title} (${s.lastActive})`)
    .join("\n");
}

export function handleCommand(text, userId) {
  const trimmed = text.trim();

  switch (trimmed) {
    case CMD_CLEAR:
      clearChatHistory(userId);
      return { handled: true, reply: "✅ 对话历史已清除" };

    case CMD_COMPACT:
      const reply = compactSession(userId);
      return { handled: true, reply };

    case CMD_SESSIONS:
      const sessionsReply = listSessionsFormatted();
      return { handled: true, reply: sessionsReply };

    case CMD_HELP:
      return {
        handled: true,
        reply: `可用命令：
/clear      - 清除对话历史
/compact    - 压缩上下文并保存摘要
/sessions   - 查看历史会话列表
/filters    - 查看响应过滤器列表
/filter <name> - 启用/禁用指定过滤器（如：/filter websearch-sources）
/help       - 显示帮助信息`,
      };

    case CMD_FILTERS:
      const filters = responseFilter.getFilters();
      const filterList = filters
        .map(f => `${f.enabled ? "✅" : "❌"} ${f.name} (优先级: ${f.priority})\n   ${f.description}`)
        .join("\n\n");
      return {
        handled: true,
        reply: `📋 响应过滤器列表\n\n${filterList}`,
      };

    default:
      if (trimmed.startsWith(CMD_FILTER_PREFIX)) {
        const filterName = trimmed.slice(CMD_FILTER_PREFIX.length).trim();
        if (!filterName) {
          return { handled: true, reply: "用法: /filter <name>\n例如: /filter websearch-sources" };
        }

        // 查找过滤器
        const filter = responseFilter.getFilters().find(f => f.name === filterName);
        if (!filter) {
          return { handled: true, reply: `❌ 未找到过滤器: ${filterName}\n使用 /filters 查看可用过滤器` };
        }

        // 切换启用状态
        const newState = !filter.enabled;
        responseFilter.setFilterEnabled(filterName, newState);
        return {
          handled: true,
          reply: `✅ 过滤器 "${filterName}" 已${newState ? "启用" : "禁用"}`,
        };
      }

      return { handled: false };
  }
}
