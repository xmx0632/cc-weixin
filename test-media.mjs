#!/usr/bin/env node
/**
 * 测试媒体文件发送功能
 * 用法: node test-media.mjs <file_path> <user_id>
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try { require("dotenv").config(); } catch {}

import { loadSession } from "./lib/auth.mjs";
import { sendMediaFile } from "./lib/media.mjs";

const filePath = process.argv[2];
const toUserId = process.argv[3];

if (!filePath || !toUserId) {
  console.log("用法: node test-media.mjs <file_path> <user_id>");
  console.log("示例: node test-media.mjs ./demo.png xxx@im.wechat");
  process.exit(1);
}

async function main() {
  console.log("加载登录信息...");
  const session = loadSession();
  if (!session) {
    console.error("❌ 未登录，请先运行 npm start");
    process.exit(1);
  }

  const { token, baseUrl } = session;

  console.log(`发送文件: ${filePath}`);
  console.log(`目标用户: ${toUserId}`);

  // 注意：测试时需要一个有效的 context_token
  // 实际使用中，context_token 从收到的消息中获取
  console.log("\n⚠️  注意: 此测试脚本需要有效的 context_token");
  console.log("在实际使用中，context_token 从收到的微信消息中获取\n");

  // 模拟一个 context_token（实际使用时需要从消息中获取）
  const mockContextToken = "TEST_CONTEXT_TOKEN";

  try {
    const result = await sendMediaFile({
      filePath,
      toUserId,
      baseUrl,
      token,
      contextToken: mockContextToken,
      caption: `发送测试文件: ${filePath}`,
    });

    console.log(`✅ 发送成功!`);
    console.log(`   消息ID: ${result.messageId}`);
    console.log(`   媒体类型: ${result.mediaType}`);
  } catch (err) {
    console.error(`❌ 发送失败: ${err.message}`);
    process.exit(1);
  }
}

main();
