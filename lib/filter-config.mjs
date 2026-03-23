/**
 * filter-config.mjs
 *
 * 过滤器配置支持
 * 允许用户通过配置文件自定义过滤器行为
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = join(homedir(), ".cc-weixin", "filter-config.json");

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  // 全局开关
  enabled: true,

  // 调试模式
  debug: false,

  // 保留原始响应
  preserveOriginal: true,

  // 各过滤器配置
  filters: {
    "websearch-sources": {
      enabled: true,
      customPatterns: [], // 用户可以添加自定义正则
    },
    "tool-outputs": {
      enabled: true,
      summarizeLength: 100,
    },
    "system-messages": {
      enabled: true,
    },
    "repetitive-references": {
      enabled: true,
      historyThreshold: 10, // 历史消息超过此数量时启用
    },
    "formatting-cleanup": {
      enabled: true,
    },
  },

  // 用户自定义过滤器
  customFilters: [],

  // 过滤器模式：strict（严格）, balanced（平衡）, relaxed（宽松）
  mode: "balanced",

  // 模式预设
  presets: {
    strict: {
      description: "严格模式 - 最大化清理，最简洁的对话",
      filters: {
        "websearch-sources": { enabled: true },
        "tool-outputs": { enabled: true, summarizeLength: 50 },
        "system-messages": { enabled: true },
        "repetitive-references": { enabled: true, historyThreshold: 5 },
        "formatting-cleanup": { enabled: true },
      },
    },
    balanced: {
      description: "平衡模式 - 平衡简洁性和信息保留（默认）",
      filters: {
        "websearch-sources": { enabled: true },
        "tool-outputs": { enabled: true, summarizeLength: 100 },
        "system-messages": { enabled: true },
        "repetitive-references": { enabled: true, historyThreshold: 10 },
        "formatting-cleanup": { enabled: true },
      },
    },
    relaxed: {
      description: "宽松模式 - 保留更多信息，较少清理",
      filters: {
        "websearch-sources": { enabled: true },
        "tool-outputs": { enabled: false }, // 保留完整工具输出
        "system-messages": { enabled: false },
        "repetitive-references": { enabled: false },
        "formatting-cleanup": { enabled: true },
      },
    },
  },
};

/**
 * 配置管理器
 */
export class FilterConfigManager {
  constructor(configPath = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  /**
   * 加载配置
   */
  loadConfig() {
    if (existsSync(this.configPath)) {
      try {
        const userConfig = JSON.parse(readFileSync(this.configPath, "utf-8"));
        return this.mergeConfig(DEFAULT_CONFIG, userConfig);
      } catch (error) {
        console.error(`[FilterConfig] 加载配置失败: ${error.message}`);
        return { ...DEFAULT_CONFIG };
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * 保存配置
   */
  saveConfig() {
    try {
      const configDir = dirname(this.configPath);
      require("node:fs").mkdirSync(configDir, { recursive: true });
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error(`[FilterConfig] 保存配置失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 合并配置
   */
  mergeConfig(base, override) {
    const result = { ...base };

    for (const key in override) {
      if (typeof override[key] === "object" && !Array.isArray(override[key])) {
        result[key] = this.mergeConfig(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  /**
   * 应用预设模式
   */
  applyPreset(mode) {
    if (!this.config.presets[mode]) {
      throw new Error(`未知的预设模式: ${mode}`);
    }

    const preset = this.config.presets[mode];
    this.config.mode = mode;

    // 应用预设的过滤器配置
    for (const [filterName, filterConfig] of Object.entries(preset.filters)) {
      if (this.config.filters[filterName]) {
        this.config.filters[filterName] = { ...this.config.filters[filterName], ...filterConfig };
      }
    }

    this.saveConfig();
    return preset.description;
  }

  /**
   * 获取过滤器配置
   */
  getFilterConfig(filterName) {
    return this.config.filters[filterName];
  }

  /**
   * 更新过滤器配置
   */
  updateFilterConfig(filterName, updates) {
    if (!this.config.filters[filterName]) {
      this.config.filters[filterName] = {};
    }
    this.config.filters[filterName] = {
      ...this.config.filters[filterName],
      ...updates,
    };
    return this.saveConfig();
  }

  /**
   * 添加自定义过滤器
   */
  addCustomFilter(filterConfig) {
    this.config.customFilters.push(filterConfig);
    return this.saveConfig();
  }

  /**
   * 获取当前模式
   */
  getMode() {
    return this.config.mode;
  }

  /**
   * 是否启用
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * 切换全局开关
   */
  toggleEnabled() {
    this.config.enabled = !this.config.enabled;
    this.saveConfig();
    return this.config.enabled;
  }

  /**
   * 获取配置摘要
   */
  getSummary() {
    return {
      mode: this.config.mode,
      enabled: this.config.enabled,
      debug: this.config.debug,
      activeFilters: Object.entries(this.config.filters)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name, _]) => name),
      customFiltersCount: this.config.customFilters.length,
    };
  }

  /**
   * 导出配置
   */
  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(configJson) {
    try {
      const imported = JSON.parse(configJson);
      this.config = this.mergeConfig(DEFAULT_CONFIG, imported);
      this.saveConfig();
      return true;
    } catch (error) {
      console.error(`[FilterConfig] 导入配置失败: ${error.message}`);
      return false;
    }
  }
}

/**
 * 创建默认配置管理器实例
 */
export const filterConfig = new FilterConfigManager();

/**
 * 初始化配置（如果不存在）
 */
export function initConfig() {
  if (existsSync(filterConfig.configPath)) {
    return;
  }
  filterConfig.saveConfig();
  console.log(`[FilterConfig] 已创建默认配置: ${filterConfig.configPath}`);
}
