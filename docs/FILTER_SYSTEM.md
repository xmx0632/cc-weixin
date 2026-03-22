# 响应过滤器系统

## 概述

响应过滤器系统用于清理 Claude 响应中的非对话内容，防止上下文污染。

### 解决的问题

1. **WebSearch Sources 污染** - 搜索结果的来源链接混入后续对话
2. **工具输出冗余** - Bash、MCP 工具的冗长输出占用 token
3. **系统信息干扰** - 调试信息、进度信息等影响对话体验
4. **重复引用** - AI 重复引用之前对话中的无关信息

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                         用户输入                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Claude API                            │
│                    (返回原始响应)                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   响应过滤器系统                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  websearch-sources (优先级: 100)                     │  │
│  │  tool-outputs (优先级: 90)                           │  │
│  │  system-messages (优先级: 80)                        │  │
│  │  repetitive-references (优先级: 70)                 │  │
│  │  formatting-cleanup (优先级: 10)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     清理后的响应                              │
│              (保存到历史，发送给用户)                          │
└─────────────────────────────────────────────────────────────┘
```

## 内置过滤器

### 1. websearch-sources (优先级: 100)

移除 WebSearch 的 Sources 部分。

**支持格式：**
- `**Sources:**` (Markdown 粗体)
- `**来源:**`
- `Sources:`
- `来源:`
- 带 `---` 分隔符的格式

### 2. tool-outputs (优先级: 90)

摘要处理工具输出。

**处理内容：**
- Bash 命令输出
- MCP 工具响应
- 代码块内容

**配置参数：**
- `summarizeLength`: 摘要长度（默认 100 字符）

### 3. system-messages (优先级: 80)

移除系统提示和调试信息。

**移除内容：**
- `[DEBUG]` 消息
- `[LOG]` 消息
- `[INFO]` 消息
- 系统提示标记

### 4. repetitive-references (优先级: 70)

清理重复的历史引用。

**处理内容：**
- "如前所述"
- "之前提到"
- "如上文所述"

**配置参数：**
- `historyThreshold`: 启用阈值（默认 10 条历史消息）

### 5. formatting-cleanup (优先级: 10)

清理格式问题。

**处理内容：**
- 多余空行（压缩为两个）
- 行尾空格

## 用户命令

### /filters

查看所有响应过滤器的状态。

```
/filters
```

### /filter <name>

启用或禁用指定过滤器。

```
/filter websearch-sources    # 切换 websearch-sources 过滤器
/filter tool-outputs         # 切换 tool-outputs 过滤器
```

## 配置文件

配置文件位置：`~/.cc-weixin/filter-config.json`

### 预设模式

```json
{
  "mode": "balanced"
}
```

可用模式：
- `strict` - 严格模式，最大化清理
- `balanced` - 平衡模式（默认）
- `relaxed` - 宽松模式，保留更多信息

### 自定义配置

```json
{
  "filters": {
    "websearch-sources": {
      "enabled": true
    },
    "tool-outputs": {
      "enabled": true,
      "summarizeLength": 50
    }
  }
}
```

## 扩展开发

### 添加自定义过滤器

```javascript
import { ResponseFilter } from "./lib/response-filter.mjs";

const filter = new ResponseFilter();

// 添加自定义过滤器
filter.addFilter({
  name: "my-custom-filter",
  description: "我的自定义过滤器",
  priority: 50,
  enabled: true,
  action: "custom",
  handler: function (text, context) {
    // 自定义处理逻辑
    return text.replace(/pattern/, "replacement");
  },
});
```

### 过滤器动作类型

| 动作 | 描述 |
|------|------|
| `remove` | 移除匹配的内容 |
| `replace` | 替换匹配的内容 |
| `summarize` | 摘要匹配的内容 |
| `extract` | 只提取匹配的内容 |
| `custom` | 自定义处理函数 |

## 调试

启用调试模式：

```bash
export DEBUG_FILTER=1
npm start
```

调试输出：
```
[Filter] Applied: websearch-sources
[Filter] Before length: 500, After: 200
[Filter] Applied filters: websearch-sources, tool-outputs
[Filter] Reduction: 60.0%
```

## 测试

运行测试：

```bash
node test-filter.mjs
```

测试覆盖：
- WebSearch Sources 清理（中英文）
- 工具输出摘要
- 系统消息清理
- 格式问题修复
- 复杂场景处理
- 过滤器管理（启用/禁用）
