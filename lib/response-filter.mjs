/**
 * response-filter.mjs
 *
 * 响应内容过滤器 - 清理 Claude 响应中的非对话内容
 *
 * 设计目标：
 * 1. 防止上下文污染（如 Sources 混入后续对话）
 * 2. 保持对话内容简洁相关
 * 3. 可配置、可扩展的过滤规则
 * 4. 保留原始响应用于调试
 */

/**
 * 过滤器配置
 * 每个过滤器包含：
 * - name: 过滤器名称
 * - pattern: 匹配模式（正则或函数）
 * - action: 'remove' | 'replace' | 'extract' | 'summarize'
 * - priority: 优先级（数字越大越先执行）
 * - enabled: 是否启用
 */
const DEFAULT_FILTERS = [
  {
    name: "websearch-sources",
    description: "移除 WebSearch 的 Sources 部分",
    priority: 100,
    enabled: true,
    patterns: [
      // Markdown 粗体格式：**Sources:** 或 **来源:**
      /\n\n?---+\n*\n*\*\*Sources?\:\*\*\s*\n[\s\S]*$/i,
      /\n\n?---+\n*\n*\*\*来源\:\*\*\s*\n[\s\S]*$/i,
      // 普通 Sources: 格式（带 --- 分隔）
      /\n\n?---+\n*\n*Sources?\:\s*\n[\s\S]*$/i,
      /\n\n?---+\n*\n*来源\:\s*\n[\s\S]*$/i,
      // 无分隔符的 Sources: 格式（后跟链接列表）
      /\n\n?\*\*Sources?\:\*\*\s*\n(?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*\n?)+[\s\S]*$/i,
      /\n\n?\*\*来源\:\*\*\s*\n(?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*\n?)+[\s\S]*$/i,
      /\n\n?Sources?\:\s*\n(?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*\n?)+[\s\S]*$/i,
      /\n\n?来源\:\s*\n(?:\s*-\s*\[[^\]]+\]\([^\)]+\)\s*\n?)+[\s\S]*$/i,
      // emoji 格式
      /\n\n?📚\s*(?:参考|来源|Sources?)\:\s*[\s\S]*$/i,
    ],
    action: "remove",
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
    action: "summarize",
    summarizeLength: 100, // 摘要长度
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
    action: "remove",
  },
  {
    name: "repetitive-references",
    description: "清理重复的历史引用",
    priority: 70,
    enabled: true,
    action: "custom",
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
    action: "custom",
    handler: function (text) {
      return text
        .replace(/\n{3,}/g, "\n\n") // 多余空行压缩为两个
        .replace(/[ \t]+$/gm, "") // 移除行尾空格
        .trim();
    },
  },
];

/**
 * 过滤器上下文
 */
export class FilterContext {
  constructor(options = {}) {
    this.historyLength = options.historyLength || 0;
    this.userId = options.userId || "default";
    this.metadata = options.metadata || {};
  }
}

/**
 * 响应过滤器类
 */
export class ResponseFilter {
  constructor(config = {}) {
    this.filters = config.filters || [...DEFAULT_FILTERS];
    this.preserveOriginal = config.preserveOriginal !== false; // 默认保留原始响应
    this.debug = config.debug || false;

    // 按优先级排序
    this.filters.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 应用所有过滤器
   * @param {string} response - 原始响应
   * @param {FilterContext} context - 过滤器上下文
   * @returns {Object} { filtered: string, original: string, appliedFilters: string[] }
   */
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
   * 应用单个过滤器
   */
  _applyFilter(text, filterConfig, context) {
    switch (filterConfig.action) {
      case "remove":
        return this._applyRemove(text, filterConfig.patterns);

      case "replace":
        return this._applyReplace(text, filterConfig.patterns, filterConfig.replacement);

      case "summarize":
        return this._applySummarize(text, filterConfig.patterns, filterConfig.summarizeLength);

      case "extract":
        return this._applyExtract(text, filterConfig.patterns);

      case "custom":
        if (typeof filterConfig.handler === "function") {
          return filterConfig.handler(text, context);
        }
        return text;

      default:
        return text;
    }
  }

  /**
   * 移除匹配的内容
   */
  _applyRemove(text, patterns) {
    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, "");
    }
    return result.trim();
  }

  /**
   * 替换匹配的内容
   */
  _applyReplace(text, patterns, replacement = "") {
    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, replacement);
    }
    return result.trim();
  }

  /**
   * 摘要匹配的内容
   */
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
   * 只提取匹配的内容
   */
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
   * 启用/禁用过滤器
   */
  setFilterEnabled(name, enabled) {
    const filter = this.filters.find(f => f.name === name);
    if (filter) {
      filter.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 添加自定义过滤器
   */
  addFilter(filterConfig) {
    this.filters.push(filterConfig);
    this.filters.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 移除过滤器
   */
  removeFilter(name) {
    this.filters = this.filters.filter(f => f.name !== name);
  }

  /**
   * 获取过滤器列表
   */
  getFilters() {
    return this.filters.map(f => ({
      name: f.name,
      description: f.description,
      enabled: f.enabled,
      priority: f.priority,
    }));
  }
}

/**
 * 创建默认过滤器实例
 */
export function createDefaultFilter(config) {
  return new ResponseFilter(config);
}

/**
 * 快捷函数：过滤响应
 */
export function filterResponse(response, context) {
  const filter = new ResponseFilter();
  return filter.filter(response, context);
}
