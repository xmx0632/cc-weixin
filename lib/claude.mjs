import { query } from "@anthropic-ai/claude-agent-sdk";
import { getFormattedHistory, addMessage, clearUserHistory } from "./session.mjs";
import {
  getOrCreateSession,
  getCurrentSession,
  updateSession,
  markSessionCleared,
  updateSessionSummary,
  appendSessionSummary,
  listSessions,
} from "./claude-session.mjs";

/**
 * 将 content 转换为 SDK 期望的数组格式
 */
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

  // 获取历史对话
  const history = getFormattedHistory(userId);

  // 先保存用户消息到历史
  addMessage(userId, "user", userText);

  // 构建消息生成器（包含历史 + 当前消息）
  async function* messages() {
    // 发送历史消息
    for (const msg of history) {
      yield {
        type: msg.role === "assistant" ? "assistant" : "user",
        session_id: session.claudeSessionId || "",
        parent_tool_use_id: null,
        message: {
          role: msg.role,
          content: toArrayContent(msg.content)
        },
      };
    }
    // 发送当前用户消息
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
        cwd: process.cwd(),
        env: process.env,
        abortController: new AbortController(),
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

  // 更新会话的 Claude Session ID
  if (claudeSessionId && session.claudeSessionId !== claudeSessionId) {
    updateSession(session.id, { claudeSessionId });
  }

  // 保存助手回复到历史
  addMessage(userId, "assistant", result);

  return result || "（Claude 无回复）";
}

/**
 * 清除指定用户的对话历史
 * @param {string} userId - 用户ID
 */
export function clearChatHistory(userId) {
  clearUserHistory(userId);

  // 标记会话已清除
  const session = getOrCreateSession(userId);
  markSessionCleared(session.id);
}

/**
 * 压缩会话上下文（生成摘要）
 * @param {string} userId - 用户ID
 * @returns {string} 摘要内容
 */
export function compactSession(userId) {
  const history = getFormattedHistory(userId);
  const session = getOrCreateSession(userId);

  if (history.length === 0) {
    return "当前对话为空，无需压缩";
  }

  // 生成简单摘要（取最近几条消息的关键信息）
  const recentMessages = history.slice(-10);
  const summary = recentMessages
    .map((msg) => `${msg.role === "user" ? "用户" : "Claude"}: ${msg.content.slice(0, 100)}...`)
    .join("\n");

  // 更新会话摘要
  updateSessionSummary(session.id, summary);
  appendSessionSummary(session.id, session.title, summary);

  // 清除历史但保留摘要
  clearUserHistory(userId);

  return `✅ 上下文已压缩，摘要已保存（${recentMessages.length} 条消息）`;
}

/**
 * 获取会话列表
 * @returns {string} 格式化的会话列表
 */
export function listSessionsFormatted() {
  const sessions = listSessions();

  if (sessions.length === 0) {
    return "暂无历史会话";
  }

  return sessions
    .map((s, i) => `${i + 1}. ${s.title} (${s.lastActive})`)
    .join("\n");
}

/**
 * 处理命令
 * @param {string} text - 用户输入
 * @param {string} userId - 用户ID
 * @returns {{ handled: boolean, reply?: string }} 处理结果
 */
export function handleCommand(text, userId) {
  const trimmed = text.trim();

  switch (trimmed) {
    case "/clear":
      clearChatHistory(userId);
      return { handled: true, reply: "✅ 对话历史已清除" };

    case "/compact":
      const reply = compactSession(userId);
      return { handled: true, reply };

    case "/sessions":
      const sessionsReply = listSessionsFormatted();
      return { handled: true, reply: sessionsReply };

    case "/help":
      return {
        handled: true,
        reply: `可用命令：
/clear    - 清除对话历史
/compact  - 压缩上下文并保存摘要
/sessions - 查看历史会话列表
/help     - 显示帮助信息`,
      };

    default:
      return { handled: false };
  }
}
