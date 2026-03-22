/**
 * Claude Code 会话与记忆管理
 *
 * 负责管理会话索引和记忆文件，与 Claude Code 原生机制集成
 */

import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

// 项目根目录的 .claude 目录
const PROJECT_CLAUDE_DIR = ".claude";
const SESSIONS_FILE = "sessions.json";
const MEMORY_DIR = "memory";
const SESSION_SUMMARY_FILE = "SESSION_SUMMARY.md";

// 内存缓存
let sessionsCache = null;
let projectRoot = null;
let isStartup = true; // 标记是否刚启动

/**
 * 获取项目根目录（查找 .git 或 package.json）
 */
function findProjectRoot() {
  if (projectRoot) return projectRoot;

  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, "package.json"))) {
      projectRoot = dir;
      return dir;
    }
    dir = dirname(dir);
  }
  projectRoot = process.cwd();
  return projectRoot;
}

/**
 * 获取 .claude 目录路径
 */
function getClaudeDir() {
  return join(findProjectRoot(), PROJECT_CLAUDE_DIR);
}

/**
 * 获取 sessions.json 路径
 */
function getSessionsFilePath() {
  return join(getClaudeDir(), SESSIONS_FILE);
}

/**
 * 获取记忆目录路径
 */
function getMemoryDir() {
  return join(getClaudeDir(), MEMORY_DIR);
}

/**
 * 确保 .claude 目录结构存在
 */
export function ensureClaudeDir() {
  const claudeDir = getClaudeDir();
  const memoryDir = getMemoryDir();

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }
}

/**
 * 加载会话索引
 */
export function loadSessions() {
  if (sessionsCache) return sessionsCache;

  const filePath = getSessionsFilePath();
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf-8");
      sessionsCache = JSON.parse(data);
    } else {
      sessionsCache = { sessions: {}, currentSession: null };
    }
  } catch (e) {
    sessionsCache = { sessions: {}, currentSession: null };
  }
  return sessionsCache;
}

/**
 * 保存会话索引
 */
export function saveSessions() {
  ensureClaudeDir();
  const filePath = getSessionsFilePath();
  writeFileSync(filePath, JSON.stringify(sessionsCache, null, 2), "utf-8");
}

/**
 * 生成会话 ID
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `session_${timestamp}_${random}`;
}

/**
 * 创建新会话
 * @param {string} title - 会话标题
 * @param {string} userId - 微信用户 ID
 * @returns {object} 新会话对象
 */
export function createSession(title = "新会话", userId = "default") {
  ensureClaudeDir();
  const sessions = loadSessions();

  const session = {
    id: generateSessionId(),
    claudeSessionId: null, // 将在首次对话时由 Claude Code 分配
    userId,
    title,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    summary: "",
  };

  sessions.sessions[session.id] = session;
  sessions.currentSession = session.id;
  saveSessions();

  return session;
}

/**
 * 获取当前会话
 * @returns {object|null} 当前会话对象
 */
export function getCurrentSession() {
  const sessions = loadSessions();
  if (!sessions.currentSession) return null;
  return sessions.sessions[sessions.currentSession] || null;
}

/**
 * 获取用户关联的会话
 * @param {string} userId - 微信用户 ID
 * @returns {object|null} 会话对象
 */
export function getSessionByUserId(userId) {
  const sessions = loadSessions();
  for (const id in sessions.sessions) {
    if (sessions.sessions[id].userId === userId) {
      return sessions.sessions[id];
    }
  }
  return null;
}

/**
 * 获取或创建用户会话
 * @param {string} userId - 微信用户 ID
 * @returns {object} 会话对象
 */
export function getOrCreateSession(userId) {
  let session = getSessionByUserId(userId);

  // 如果是启动后第一次获取会话，清除旧的 claudeSessionId
  // 这样可以避免使用失效的会话 ID 导致响应错乱
  if (isStartup && session && session.claudeSessionId) {
    updateSession(session.id, { claudeSessionId: null });
    session.claudeSessionId = null;
    isStartup = false;
  }

  if (!session) {
    session = createSession(`微信用户 ${userId.slice(0, 8)}`, userId);
    isStartup = false;
  }
  return session;
}

/**
 * 更新会话
 * @param {string} sessionId - 会话 ID
 * @param {object} updates - 要更新的字段
 */
export function updateSession(sessionId, updates) {
  const sessions = loadSessions();
  if (sessions.sessions[sessionId]) {
    sessions.sessions[sessionId] = {
      ...sessions.sessions[sessionId],
      ...updates,
      lastActive: new Date().toISOString(),
    };
    saveSessions();
  }
}

/**
 * 设置会话的 Claude Code Session ID
 * @param {string} sessionId - 我们的会话 ID
 * @param {string} claudeSessionId - Claude Code 分配的会话 ID
 */
export function setClaudeSessionId(sessionId, claudeSessionId) {
  updateSession(sessionId, { claudeSessionId });
}

/**
 * 列出所有会话
 * @returns {Array} 会话列表
 */
export function listSessions() {
  const sessions = loadSessions();
  return Object.values(sessions.sessions).sort(
    (a, b) => new Date(b.lastActive) - new Date(a.lastActive)
  );
}

/**
 * 切换到指定会话
 * @param {string} sessionId - 会话 ID
 * @returns {object|null} 会话对象
 */
export function switchToSession(sessionId) {
  const sessions = loadSessions();
  if (sessions.sessions[sessionId]) {
    sessions.currentSession = sessionId;
    saveSessions();
    return sessions.sessions[sessionId];
  }
  return null;
}

/**
 * 标记会话已清除
 * @param {string} sessionId - 会话 ID
 */
export function markSessionCleared(sessionId) {
  updateSession(sessionId, {
    claudeSessionId: null,
    summary: "会话已清除",
  });
}

/**
 * 更新会话摘要
 * @param {string} sessionId - 会话 ID
 * @param {string} summary - 摘要内容
 */
export function updateSessionSummary(sessionId, summary) {
  updateSession(sessionId, { summary });
}

// ========== 记忆管理 ==========

/**
 * 获取会话摘要文件路径
 */
function getSummaryFilePath() {
  return join(getMemoryDir(), SESSION_SUMMARY_FILE);
}

/**
 * 初始化会话摘要文件
 */
function initSummaryFile() {
  const filePath = getSummaryFilePath();
  if (!existsSync(filePath)) {
    const header = `# 会话摘要索引

此文件记录各会话的摘要信息，便于快速回顾。

---
`;
    writeFileSync(filePath, header, "utf-8");
  }
}

/**
 * 追加会话摘要
 * @param {string} sessionId - 会话 ID
 * @param {string} title - 会话标题
 * @param {string} summary - 摘要内容
 */
export function appendSessionSummary(sessionId, title, summary) {
  ensureClaudeDir();
  initSummaryFile();

  const filePath = getSummaryFilePath();
  const timestamp = new Date().toLocaleString("zh-CN");
  const entry = `
## ${title}
- **会话 ID**: ${sessionId}
- **时间**: ${timestamp}
- **摘要**: ${summary}

---
`;
  writeFileSync(filePath, entry, { flag: "a", encoding: "utf-8" });
}

/**
 * 读取会话摘要
 * @returns {string} 摘要文件内容
 */
export function readSessionSummaries() {
  const filePath = getSummaryFilePath();
  if (existsSync(filePath)) {
    return readFileSync(filePath, "utf-8");
  }
  return "";
}
