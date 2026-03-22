# Claude Code 会话与记忆集成方案

## 1. 概述

### 1.1 目标
将我们的程序与 Claude Code 的原生会话和记忆机制深度集成，避免重复造轮子，实现：
- 透传 Claude Code 原生命令（`/clear`、`/compact`、`/resume`）
- 会话 ID 与 Claude Code 会话绑定
- 利用 Claude Code 的记忆系统持久化上下文

### 1.2 核心原则
1. **命令透传**：不包装，直接调用 Claude Code 原生命令
2. **记忆复用**：使用 Claude Code 的记忆文件，不额外维护上下文
3. **最小侵入**：只维护项目级 `.claude/` 目录信息

### 1.3 核心设计要点

| 方面 | 策略 |
|------|------|
| **命令** | `/clear`、`/compact`、`/resume` 全部透传给 Claude Code |
| **会话绑定** | 用 `sessions.json` 做索引，存储会话 ID 映射 |
| **记忆** | 复用 Claude Code 自动记忆，额外维护 `SESSION_SUMMARY.md` |
| **最小存储** | 只在 `.claude/` 目录下维护必要文件 |

### 1.4 最小文件结构
```
.claude/
├── sessions.json         # 会话索引（我们维护）
├── memory/               # 补充记忆（我们维护）
│   └── SESSION_SUMMARY.md
└── ... (Claude Code 原生文件)
```

### 1.5 实现阶段概览
1. **Phase 1**: 基础集成（目录结构 + 透传命令）
2. **Phase 2**: 会话管理（列表/恢复/摘要）
3. **Phase 3**: 记忆增强（自动关联知识）

---

## 2. Claude Code 原生机制

### 2.1 项目级目录结构

```
.claude/
├── CLAUDE.md              # 项目指令（每个会话加载）
├── settings.json          # 项目设置（可提交到 git）
├── settings.local.json    # 本地设置（不提交）
└── rules/                 # 规则文件（按需加载）
    ├── code-style.md
    └── testing.md
```

### 2.2 原生命令

| 命令 | 作用 | 我们的策略 |
|------|------|-----------|
| `/clear` | 清除当前会话 | **透传**，不重新实现 |
| `/compact` | 压缩上下文，提取摘要 | **透传**，不重新实现 |
| `/resume` | 恢复历史会话 | **透传**，利用会话列表 |
| `/memory` | 查看/编辑记忆 | **透传** |

### 2.3 记忆加载机制

```
会话启动
    │
    ▼
读取 CLAUDE.md（完整加载）
    │
    ▼
读取 ~/.claude/projects/<project>/memory/MEMORY.md（前200行）
    │
    ▼
按需加载主题文件（debugging.md 等）
```

---

## 3. 集成方案设计

### 3.1 会话绑定策略

#### 会话 ID 映射
```
我们的 SessionID  ←→  Claude Code Session
         │
         └── 绑定信息存储在 .claude/sessions.json
```

#### sessions.json 结构
```json
{
  "sessions": {
    "session_abc123": {
      "claude_session_id": "uuid-xxx",
      "created_at": "2024-03-22T10:00:00Z",
      "last_active": "2024-03-22T11:30:00Z",
      "title": "修复登录bug",
      "summary": "讨论了用户认证流程的修复方案..."
    }
  },
  "current_session": "session_abc123"
}
```

### 3.2 记忆管理

#### 利用 Claude Code 自动记忆
- Claude 会自动在 `~/.claude/projects/<project>/memory/` 保存学习内容
- 我们只需读取和展示，不主动写入

#### 项目级补充记忆
在 `.claude/memory/` 维护项目特定的上下文：
```
.claude/memory/
├── SESSION_SUMMARY.md    # 会话摘要索引
├── decisions.md          # 架构决策记录
└── patterns.md           # 发现的代码模式
```

### 3.3 命令实现方案

#### `/clear` - 清除会话
```
用户输入 /clear
    │
    ▼
1. 调用 Claude Code 原生 /clear
2. 更新 sessions.json（标记会话已清除）
3. 保留记忆文件不变
```

#### `/compact` - 压缩上下文
```
用户输入 /compact
    │
    ▼
1. 调用 Claude Code 原生 /compact
2. Claude 自动：
   - 压缩对话历史
   - 重新加载 CLAUDE.md
   - 更新自动记忆
3. 可选：我们提取摘要存入 SESSION_SUMMARY.md
```

#### `/resume` - 恢复会话
```
用户输入 /resume [session_id]
    │
    ▼
1. 无参数时：展示 sessions.json 中的会话列表
2. 有参数时：
   a. 从 sessions.json 获取 claude_session_id
   b. 调用 Claude Code 原生 /resume
   c. 更新 current_session
```

---

## 4. 文件结构

### 4.1 完整的 .claude 目录
```
.claude/
├── CLAUDE.md                    # 项目指令
├── settings.json                # 项目设置
├── settings.local.json          # 本地设置（gitignore）
├── sessions.json                # 会话索引（我们的）
├── memory/                      # 补充记忆（我们的）
│   ├── SESSION_SUMMARY.md       # 会话摘要
│   ├── decisions.md             # 决策记录
│   └── patterns.md              # 代码模式
└── rules/                       # 规则文件
    └── *.md
```

### 4.2 .gitignore 建议
```gitignore
.claude/settings.local.json
.claude/sessions.json
```

---

## 5. 实现清单

### 5.1 Phase 1: 基础集成 ✅
- [x] 创建 `.claude/` 目录结构
- [x] 实现 `sessions.json` 读写
- [x] 透传 `/clear` 命令
- [x] 透传 `/compact` 命令
- [x] 创建 `lib/claude-session.mjs` 会话管理模块
- [x] 更新 `lib/claude.mjs` 集成会话管理
- [x] 更新 TUI 和 CLI 模式支持新命令

### 5.2 Phase 2: 会话管理
- [x] 实现会话列表展示 (`/sessions`)
- [ ] 透传 `/resume` 命令
- [ ] 会话标题自动生成/更新
- [x] 会话摘要提取 (`/compact` 时保存)

### 5.3 Phase 3: 记忆增强
- [ ] 读取 Claude Code 自动记忆
- [x] 维护 SESSION_SUMMARY.md
- [ ] 会话恢复时加载相关记忆
- [ ] 决策和模式记录

---

## 6. API 设计

### 6.1 会话管理 API
```typescript
interface SessionManager {
  // 创建新会话
  createSession(title?: string): Session;

  // 获取当前会话
  getCurrentSession(): Session | null;

  // 列出所有会话
  listSessions(): Session[];

  // 恢复会话（透传给 Claude Code）
  resumeSession(sessionId: string): void;

  // 清除当前会话（透传给 Claude Code）
  clearSession(): void;

  // 压缩上下文（透传给 Claude Code）
  compactSession(): void;
}

interface Session {
  id: string;
  claudeSessionId: string;
  title: string;
  createdAt: string;
  lastActive: string;
  summary?: string;
}
```

### 6.2 记忆管理 API
```typescript
interface MemoryManager {
  // 读取会话摘要
  getSessionSummaries(): SessionSummary[];

  // 追加会话摘要
  appendSessionSummary(summary: SessionSummary): void;

  // 读取决策记录
  getDecisions(): Decision[];

  // 记录决策
  recordDecision(decision: Decision): void;
}
```

---

## 7. 与 Claude Code 的交互

### 7.1 命令透传方式
```typescript
// 方式1: 直接字符串传递
function executeCommand(command: string) {
  // 将命令字符串发送给 Claude Code
  sendToClaudeCode(command); // "/clear", "/compact", "/resume xxx"
}

// 方式2: 通过 stdin/stdout 或 IPC
function forwardCommand(command: string) {
  claudeCodeProcess.stdin.write(command + '\n');
}
```

### 7.2 会话状态同步
```typescript
// 监听 Claude Code 的会话变化
function watchSessionChanges() {
  // 监听 ~/.claude/projects/<project>/memory/ 目录
  // 同步更新 sessions.json
}
```

---

## 8. 注意事项

1. **不要与 Claude Code 竞争**：让它管理它擅长的（上下文、记忆）
2. **只做索引和展示**：我们维护 `sessions.json` 只是为了快速检索
3. **尊重原生命令**：`/clear`、`/compact`、`/resume` 完全透传
4. **记忆文件是 markdown**：可以直接让用户/开发者查看和编辑
5. **200 行限制**：`MEMORY.md` 保持简洁，详细内容放主题文件

---

## 9. 后续优化

- [ ] 会话搜索功能
- [ ] 跨会话知识关联
- [ ] 自动生成项目文档
- [ ] 与 Git 提交关联
