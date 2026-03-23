#!/usr/bin/env node
/**
 * 测试媒体文件发送 - 监听消息后回复文件
 * 用法: node test-media-reply.mjs <file_path>
 *
 * 流程：
 * 1. 启动长轮询监听微信消息
 * 2. 收到消息后，用消息的 context_token 发送文件
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try { require("dotenv").config(); } catch {}

import { loadSession } from "./lib/auth.mjs";
import { getUpdates, sendMessage, extractText } from "./lib/messaging.mjs";
import { sendMediaFile } from "./lib/media.mjs";

const filePath = process.argv[2];

if (!filePath) {
  console.log("用法: node test-media-reply.mjs <file_path>");
  console.log("示例: node test-media-reply.mjs ./demo.png");
  process.exit(1);
}

async function main() {
  console.log("加载登录信息...");
  const session = loadSession();
  if (!session) {
    console.error("❌ 未登录，请先运行 npm start");
    process.exit(1);
  }

  const { token, baseUrl, accountId } = session;
  console.log(`Bot ID: ${accountId}`);
  console.log(`准备发送文件: ${filePath}`);
  console.log("\n📨 等待微信消息（发送任意消息后会收到文件回复）...\n");

  let getUpdatesBuf = "";

  while (true) {
    try {
      const resp = await getUpdates(baseUrl, token, getUpdatesBuf);
      if (resp.get_updates_buf) getUpdatesBuf = resp.get_updates_buf;

      for (const msg of resp.msgs ?? []) {
        if (msg.message_type !== 1) continue;

        const from = msg.from_user_id;
        const text = extractText(msg);
        const ctx = msg.context_token;

        console.log(`📩 [${new Date().toLocaleTimeString()}] ${from}`);
        console.log(`   ${text}`);

        if (!ctx) {
          console.log("   ⚠️  消息没有 context_token，跳过");
          continue;
        }

        // 先发送文本确认
        await sendMessage(baseUrl, token, from, `收到！正在发送文件: ${filePath}`, ctx);
        console.log("   ✅ 已发送确认消息");

        // 发送文件
        try {
          const result = await sendMediaFile({
            filePath,
            toUserId: from,
            baseUrl,
            token,
            contextToken: ctx,
            caption: `📎 文件: ${filePath}`,
          });
          console.log(`   ✅ 文件发送成功! 类型: ${result.mediaType}`);
        } catch (err) {
          console.error(`   ❌ 文件发送失败: ${err.message}`);
          await sendMessage(baseUrl, token, from, `文件发送失败: ${err.message}`, ctx);
        }
      }
    } catch (err) {
      console.error(`⚠️  轮询出错: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
