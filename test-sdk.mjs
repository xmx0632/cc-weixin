import { query } from "@anthropic-ai/claude-agent-sdk";

const test = async () => {
  console.log("Testing Claude Agent SDK...");

  try {
    for await (const msg of query({
      prompt: (async function* () {
        yield {
          type: "user",
          session_id: "",
          parent_tool_use_id: null,
          message: { role: "user", content: "hello" },
        };
      })(),
      options: {
        model: "glm-4.7",
        baseTools: [{ preset: "default" }],
        deniedTools: ["AskUserQuestion"],
        cwd: process.cwd(),
      },
    })) {
      console.log("Msg type:", msg.type);
      if (msg.type === "result") {
        console.log("Result:", msg.result);
      }
      if (msg.type === "error") {
        console.log("Error:", msg);
      }
    }
  } catch (e) {
    console.error("Error:", e.message);
    console.error(e.stack);
  }
};

test();
