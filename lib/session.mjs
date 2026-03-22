import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const DATA_DIR = join(homedir(), ".cc-weixin");
const HISTORY_FILE = join(DATA_DIR, "chat-history.json");
const MAX_HISTORY_PER_USER = 50; // 每个用户最多保留的历史消息数

// 确保数据目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// 内存中的历史记录缓存
let historyCache = {};

// 加载历史记录
function loadHistory() {
  try {
    if (existsSync(HISTORY_FILE)) {
      historyCache = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    }
  } catch (e) {
    historyCache = {};
  }
  return historyCache;
}

// 保存历史记录
function saveHistory() {
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(historyCache, null, 2));
  } catch (e) {
    console.error("保存历史记录失败:", e.message);
  }
}

// 初始化加载
loadHistory();

/**
 * 获取用户的对话历史
 * @param {string} userId - 用户ID
 * @returns {Array} 对话历史数组
 */
export function getUserHistory(userId) {
  if (!historyCache[userId]) {
    historyCache[userId] = [];
  }
  return historyCache[userId];
}

/**
 * 添加消息到用户历史
 * @param {string} userId - 用户ID
 * @param {string} role - 'user' 或 'assistant'
 * @param {string} content - 消息内容
 */
export function addMessage(userId, role, content) {
  if (!historyCache[userId]) {
    historyCache[userId] = [];
  }

  historyCache[userId].push({
    role,
    content,
    timestamp: Date.now()
  });

  // 限制历史长度，保留最近的消息
  if (historyCache[userId].length > MAX_HISTORY_PER_USER) {
    historyCache[userId] = historyCache[userId].slice(-MAX_HISTORY_PER_USER);
  }

  saveHistory();
}

/**
 * 清除用户的对话历史
 * @param {string} userId - 用户ID
 */
export function clearUserHistory(userId) {
  historyCache[userId] = [];
  saveHistory();
}

/**
 * 清除所有历史记录
 */
export function clearAllHistory() {
  historyCache = {};
  saveHistory();
}

/**
 * 获取格式化的历史消息（用于 Claude API）
 * @param {string} userId - 用户ID
 * @returns {Array} 格式化的消息数组
 */
export function getFormattedHistory(userId) {
  const history = getUserHistory(userId);
  return history.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}
