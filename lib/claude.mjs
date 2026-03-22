import { query } from "@anthropic-ai/claude-agent-sdk";
import { getFormattedHistory, addMessage } from "./session.mjs";

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
        session_id: "",
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
      session_id: "",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: toArrayContent(userText)
      },
    };
  }

  let result = "";

  try {
    for await (const msg of query({
      prompt: messages(),
      options: {
        model: "glm-4.7",
        baseTools: [{ preset: "default" }],
        deniedTools: ["AskUserQuestion"],
        // 绕过所有权限检查（微信环境无法交互确认）
        permissionMode: "bypassPermissions",
        cwd: process.cwd(),
        env: process.env,
        abortController: new AbortController(),
      },
    })) {
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

  // 保存助手回复到历史
  addMessage(userId, "assistant", result);

  return result || "（Claude 无回复）";
}

/**
 * 清除指定用户的对话历史
 * @param {string} userId - 用户ID
 */
export async function clearChatHistory(userId) {
  const { clearUserHistory } = await import("./session.mjs");
  clearUserHistory(userId);
}
