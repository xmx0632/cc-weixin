import { query } from "@anthropic-ai/claude-agent-sdk";

/** 调用 Claude Code agent，返回最终文本回复 */
export async function askClaude(userText) {
  async function* messages() {
    yield {
      type: "user",
      session_id: "",
      parent_tool_use_id: null,
      message: { role: "user", content: userText },
    };
  }

  let result = "";
  for await (const msg of query({
    prompt: messages(),
    options: {
      model: "glm-5",
      baseTools: [{ preset: "default" }],
      deniedTools: ["AskUserQuestion"],
      cwd: process.cwd(),
      env: process.env,
      abortController: new AbortController(),
    },
  })) {
    if (msg.type === "result") {
      result = msg.result ?? "";
    }
  }
  return result || "（Claude 无回复）";
}
