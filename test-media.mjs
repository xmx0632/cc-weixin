#!/usr/bin/env node
/**
 * 测试媒体文件上传功能（不发送）
 * 用法: node test-media.mjs <file_path>
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try { require("dotenv").config(); } catch {}

import { loadSession } from "./lib/auth.mjs";
import { uploadFile, getMimeType, getMediaTypeFromMime, MediaType } from "./lib/media.mjs";

const filePath = process.argv[2];

if (!filePath) {
  console.log("用法: node test-media.mjs <file_path>");
  console.log("示例: node test-media.mjs ./demo.png");
  process.exit(1);
}

async function main() {
  console.log("加载登录信息...");
  const session = loadSession();
  if (!session) {
    console.error("❌ 未登录，请先运行 npm start");
    process.exit(1);
  }

  const { token, baseUrl, userId } = session;
  const toUserId = userId; // 发送给自己

  console.log(`\n文件: ${filePath}`);
  console.log(`MIME类型: ${getMimeType(filePath)}`);
  console.log(`媒体类型: ${["", "IMAGE", "VIDEO", "FILE"][getMediaTypeFromMime(getMimeType(filePath))]}`);
  console.log(`目标用户: ${toUserId}\n`);

  try {
    console.log("开始上传...");
    const uploaded = await uploadFile({ filePath, toUserId, baseUrl, token });

    console.log(`\n✅ 上传成功!`);
    console.log(`   filekey: ${uploaded.filekey}`);
    console.log(`   文件大小: ${uploaded.fileSize} bytes`);
    console.log(`   密文大小: ${uploaded.fileSizeCiphertext} bytes`);
    console.log(`   AES key: ${uploaded.aeskey.slice(0, 16)}...`);
    console.log(`   downloadParam: ${uploaded.downloadEncryptedQueryParam.slice(0, 50)}...`);
  } catch (err) {
    console.error(`\n❌ 上传失败: ${err.message}`);
    if (err.cause) console.error(`   原因: ${err.cause}`);
    process.exit(1);
  }
}

main();
