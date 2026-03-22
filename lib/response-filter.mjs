/**
 * response-filter.mjs
 *
 * 响应内容过滤器 - 清理 Claude 响应中的非对话内容
 */

// 过滤器动作类型常量
const ACTION_REMOVE = "remove";
const ACTION_REPLACE = "replace";
const ACTION_SUMMARIZE = "summarize";
const ACTION_EXTRACT = "extract";
const ACTION_CUSTOM = "custom";

const DEFAULT_FILTERS = [
  {
    name: "websearch-sources",
    description: "移除 WebSearch 的 Sources 部分",
    priority: 100,
    enabled: true,
    patterns: [
      // 合并所有 Sources/来源 变体到单个正则表达式
      // 匹配：--- 分隔符 + 粗体/普通标题 + 链接列表 + emoji 格式
      /\n\n?(?:---+\n*\n*)?\s*(?:\*\*)?(?:Sources?|来源)(?:\:\s*|\:\*\*\s*)\s*(?:\n(?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*)+|[\s\S]*)?$/i,
      /\n\n?📚\s*(?:参考|来源|Sources?)\:\s*[\s\S]*$/i,
    ],
    action: ACTION_REMOVE,
  },
  {
    name: "tool-outputs",
    description: "处理工具输出（Bash、MCP 等）",
    priority: 90,
    enabled: true,
    patterns: [
      // 工具调用结果块
      /<tool_use>[\s\S]*?<tool_use>/g,
      // 工具响应标记
      /<response>[\s\S]*?<\/response>/g,
      // 代码块（标准或带星号）
      /^\s*```\s*\n[\s\S]*?\n\s*```\s*$/gm,
      /^\s*\*{3}\s*\n[\s\S]*?\n\s*\*{3}\s*$/gm,
    ],
    action: ACTION_SUMMARIZE,
    summarizeLength: 100,
  },
  {
    name: "system-messages",
    description: "移除系统提示和调试信息",
    priority: 80,
    enabled: true,
    patterns: [
      /\n\n?\[DEBUG\][\s\S]*?$/i,
      /\n\n?\[LOG\][\s\S]*?$/i,
      /\n\n?\[INFO\][\s\S]*?$/i,
      /\n\n?⚙️\s*系统提示[\s\S]*?$/i,
      /\n\n?🔧\s*[\s\S]*?$/i,
    ],
    action: ACTION_REMOVE,
  },
  {
    name: "repetitive-references",
    description: "清理重复的历史引用",
    priority: 70,
    enabled: true,
    action: ACTION_CUSTOM,
    handler: function (text, context) {
      // 如果对话历史较长，移除"如前所述"、"之前提到"等冗余引用
      if (context.historyLength > 10) {
        return text
          .replace(/(?:如前所述|之前提到|如上文所述|正如我们讨论的)[，,]?\s*[^\n]*/gi, "")
          .replace(/\n{3,}/g, "\n\n"); // 清理多余空行
      }
      return text;
    },
  },
  {
    name: "formatting-cleanup",
    description: "清理格式问题",
    priority: 10,
    enabled: true,
    action: ACTION_CUSTOM,
    handler: function (text) {
      return text
        .replace(/\n{3,}/g, "\n\n") // 多余空行压缩为两个
        .replace(/[ \t]+$/gm, "") // 移除行尾空格
        .trim();
    },
  },
];

export class FilterContext {
  constructor(options = {}) {
    this.historyLength = options.historyLength || 0;
    this.userId = options.userId || "default";
    this.metadata = options.metadata || {};
  }
}

export class ResponseFilter {
  constructor(config = {}) {
    this.filters = config.filters || [...DEFAULT_FILTERS];
    this.preserveOriginal = config.preserveOriginal !== false; // 默认保留原始响应
    this.debug = config.debug || false;

    // 按优先级排序
    this.filters.sort((a, b) => b.priority - a.priority);
  }

  /**
  filter(response, context = new FilterContext()) {
    let result = response;
    const appliedFilters = [];

    for (const filterConfig of this.filters) {
      if (!filterConfig.enabled) continue;

      try {
        const filteredResult = this._applyFilter(result, filterConfig, context);

        if (filteredResult !== result) {
          appliedFilters.push(filterConfig.name);
          if (this.debug) {
            console.log(`[Filter] Applied: ${filterConfig.name}`);
            console.log(`[Filter] Before length: ${result.length}, After: ${filteredResult.length}`);
          }
        }

        result = filteredResult;
      } catch (error) {
        console.error(`[Filter] Error applying ${filterConfig.name}:`, error.message);
        // 出错时保持原样
      }
    }

    return {
      filtered: result,
      original: this.preserveOriginal ? response : null,
      appliedFilters,
      reductionRate: response.length > 0 ? ((response.length - result.length) / response.length * 100).toFixed(1) + "%" : "0%",
    };
  }

  /**
  _applyFilter(text, filterConfig, context) {
    switch (filterConfig.action) {
      case ACTION_REMOVE:
        return this._applyRemove(text, filterConfig.patterns);

      case ACTION_REPLACE:
        return this._applyReplace(text, filterConfig.patterns, filterConfig.replacement);

      case ACTION_SUMMARIZE:
        return this._applySummarize(text, filterConfig.patterns, filterConfig.summarizeLength);

      case ACTION_EXTRACT:
        return this._applyExtract(text, filterConfig.patterns);

      case ACTION_CUSTOM:
        if (typeof filterConfig.handler === "function") {
          return filterConfig.handler(text, context);
        }
        return text;

      default:
        return text;
    }
  }

  /**
  _applyRemove(text, patterns) {
    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, "");
    }
    return result.trim();
  }

  /**
  _applyReplace(text, patterns, replacement = "") {
    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, replacement);
    }
    return result.trim();
  }

  /**
  _applySummarize(text, patterns, maxLength = 100) {
    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, (match) => {
        // 移除代码块标记（如果有）
        const cleaned = match.replace(/^```\w*\n?|\n?```$/g, "").trim();
        if (cleaned.length <= maxLength) {
          return cleaned; // 已经够短，直接返回
        }
        // 返回摘要
        return `...[已省略工具输出，共 ${cleaned.length} 字符]...`;
      });
    }
    return result.trim();
  }

  /**
  _applyExtract(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return text;
  }

  /**
  setFilterEnabled(name, enabled) {
    const filter = this.filters.find(f => f.name === name);
    if (filter) {
      filter.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
  addFilter(filterConfig) {
    this.filters.push(filterConfig);
    this.filters.sort((a, b) => b.priority - a.priority);
  }

  /**
  removeFilter(name) {
    this.filters = this.filters.filter(f => f.name !== name);
  }

  /**
  getFilters() {
    return this.filters.map(f => ({
      name: f.name,
      description: f.description,
      enabled: f.enabled,
      priority: f.priority,
    }));
  }
}

export function createDefaultFilter(config) {
  return new ResponseFilter(config);
}

export function filterResponse(response, context) {
  const filter = new ResponseFilter();
  return filter.filter(response, context);
}
