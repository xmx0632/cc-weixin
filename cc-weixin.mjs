#!/usr/bin/env node
/**
 * cc-weixin
 * 微信 ← iLink Bot API → Claude Code Agent
 *
 * 用法: npm start              # TUI 界面（默认）
 *       npm start -- --no-tui  # 纯 CLI 模式
 *       npm start -- --login   # 强制重新扫码
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try { require("dotenv").config(); } catch {}

const forceLogin = process.argv.includes("--login");
const noTui = process.argv.includes("--no-tui");

if (noTui) {
  // ─── 纯 CLI 模式（原有逻辑） ─────────────────────────────────────
  const { loadSession, login } = await import("./lib/auth.mjs");
  const { getUpdates, sendMessage, extractText } = await import("./lib/messaging.mjs");
  const { askClaude, handleCommand } = await import("./lib/claude.mjs");
  const { clearAllHistoryOnStartup } = await import("./lib/session.mjs");
  const { sendMediaFile } = await import("./lib/media.mjs");

  // 启动时清除历史记录，避免响应错乱
  clearAllHistoryOnStartup();

  async function main() {
    let session = forceLogin ? null : loadSession();
    if (session) {
      console.log(`✅ 已连接（Bot: ${session.accountId}）\n`);
    } else {
      session = await login();
    }

    const { token, baseUrl } = session;

    let running = true;
    process.on("SIGINT", () => {
      console.log("\n\n👋 正在退出...");
      running = false;
    });

    console.log("🚀 开始长轮询收消息（Ctrl+C 退出）...\n");
    let buf = "";

    while (running) {
      try {
        const resp = await getUpdates(baseUrl, token, buf);
        if (resp.get_updates_buf) buf = resp.get_updates_buf;

        for (const msg of resp.msgs ?? []) {
          if (msg.message_type !== 1) continue;

          const from = msg.from_user_id;
          const text = extractText(msg);
          const ctx = msg.context_token;

          console.log(`📩 [${new Date().toLocaleTimeString()}] ${from}`);
          console.log(`   ${text}`);

          // 处理命令
          const cmdResult = handleCommand(text, from);
          if (cmdResult.handled) {
            // 处理 /send 命令
            if (cmdResult.sendFile) {
              try {
                console.log(`   📤 发送文件: ${cmdResult.sendFile}`);
                const result = await sendMediaFile({
                  filePath: cmdResult.sendFile,
                  toUserId: from,
                  baseUrl,
                  token,
                  contextToken: ctx,
                });
                console.log(`   ✅ 文件已发送 (${result.mediaType})\n`);
              } catch (err) {
                console.log(`   ❌ 文件发送失败: ${err.message}\n`);
                await sendMessage(baseUrl, token, from, `文件发送失败: ${err.message}`, ctx);
              }
              continue;
            }

            await sendMessage(baseUrl, token, from, cmdResult.reply, ctx);
            console.log(`   ✅ ${cmdResult.reply}\n`);
            continue;
          }

          process.stdout.write("   🤔 Claude 思考中...");
          const claudeResult = await askClaude(text, from);
          process.stdout.write(" 完成\n");

          // 处理 Claude 返回的文件发送标记
          if (claudeResult.files && claudeResult.files.length > 0) {
            for (const filePath of claudeResult.files) {
              try {
                console.log(`   📤 发送文件: ${filePath}`);
                const result = await sendMediaFile({
                  filePath,
                  toUserId: from,
                  baseUrl,
                  token,
                  contextToken: ctx,
                });
                console.log(`   ✅ 文件已发送 (${result.mediaType})`);
              } catch (err) {
                console.log(`   ❌ 文件发送失败: ${err.message}`);
                await sendMessage(baseUrl, token, from, `文件发送失败: ${err.message}`, ctx);
              }
            }
          }

          // 发送文本回复
          await sendMessage(baseUrl, token, from, claudeResult.text, ctx);
          console.log(`   ✅ ${claudeResult.text.slice(0, 80)}${claudeResult.text.length > 80 ? "…" : ""}\n`);
        }
      } catch (err) {
        if (err.message?.includes("session timeout") || err.message?.includes("-14")) {
          console.error("❌ Session 已过期，请重新运行: npm start -- --login");
          process.exit(1);
        }
        console.error(`⚠️  轮询出错: ${err.message}，3s 后重试...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    console.log("✅ 已退出");
  }

  main().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
} else {
  // ─── TUI 模式 ────────────────────────────────────────────────────
  const { startTUI } = await import("./lib/tui/index.mjs");
  startTUI({ forceLogin });
}
