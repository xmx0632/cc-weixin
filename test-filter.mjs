#!/usr/bin/env node
/**
 * test-filter.mjs
 *
 * 响应过滤器测试
 * 验证各种过滤场景
 */

import { ResponseFilter, FilterContext } from "./lib/response-filter.mjs";

// 测试用例
const testCases = [
  {
    name: "WebSearch Sources (中文)",
    input: `## 📋 我可用的技能

### 🔧 系统/配置类
| 技能 | 描述 |
|------|------|
| \`update-config\` | 配置 settings.json |

---

**Sources:**
- [世卫组织 - 中东地区卫生危机](https://www.who.int/zh/news/item/11-03-2026-conflict-deepens-health-crisis-across-middle-east--who-says)
- [联合国 - 人道主义援助](https://un.org/humanitarian-aid)`,
    expectedRemoved: ["Sources:", "世卫组织", "联合国"],
  },
  {
    name: "WebSearch Sources (英文)",
    input: `Here is the information you requested about climate change.

Sources:
- [IPCC Report](https://ipcc.ch/report/)
- [NASA Climate](https://climate.nasa.gov/)`,
    expectedRemoved: ["Sources:", "IPCC", "NASA"],
  },
  {
    name: "工具输出摘要",
    input: `运行结果：
\`\`\`
[1] Compiling src/main.ts
[2] Building bundle
[3] Optimizing...
[4] Done in 3.2s
\`\`\`

构建完成！`,
    expectedSummarized: true,
  },
  {
    name: "系统消息清理",
    input: `这是回复内容。

[DEBUG] Processing request...
[LOG] User action recorded

继续回复...`,
    expectedRemoved: ["[DEBUG]", "[LOG]"],
  },
  {
    name: "格式清理",
    input: `第一段内容



第二段内容
   第三段内容   `,
    expectedFixed: "多余空行被压缩，行尾空格被移除",
  },
  {
    name: "复杂场景",
    input: `回答你的问题：

以下是一些信息...

---

**来源:**
- [参考文档1](https://example.com/doc1)
- [参考文档2](https://example.com/doc2)

\`\`\`
Tool output with lots of details...
Line 1
Line 2
Line 3
Line 4
Line 5
\`\`\`

[INFO] Operation completed

希望这有帮助！`,
    expectedCleaned: true,
  },
];

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  log("\n" + "─".repeat(60) + "\n", "cyan");
}

// 测试函数
async function runTests() {
  log("🧪 响应过滤器测试\n", "blue");

  const filter = new ResponseFilter({ debug: false });
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    separator();
    log(`测试 ${i + 1}/${testCases.length}: ${testCase.name}`, "yellow");

    log("输入:", "cyan");
    log(testCase.input, "reset");

    const context = new FilterContext({ historyLength: 5 });
    const result = filter.filter(testCase.input, context);

    log("\n输出:", "green");
    log(result.filtered, "reset");

    log(`\n统计:`, "blue");
    log(`  - 原始长度: ${testCase.input.length} 字符`, "reset");
    log(`  - 过滤后: ${result.filtered.length} 字符`, "reset");
    log(`  - 压缩率: ${result.reductionRate}`, "reset");
    log(`  - 应用过滤器: ${result.appliedFilters.join(", ") || "无"}`, "reset");

    // 验证
    let testPassed = true;
    if (testCase.expectedRemoved) {
      for (const keyword of testCase.expectedRemoved) {
        if (result.filtered.includes(keyword)) {
          log(`  ❌ 应该移除但仍在: "${keyword}"`, "red");
          testPassed = false;
        }
      }
    }
    if (testCase.expectedSummarized) {
      if (result.filtered.includes("Tool output")) {
        log(`  ❌ 工具输出应该被摘要`, "red");
        testPassed = false;
      } else {
        log(`  ✅ 工具输出已摘要`, "green");
      }
    }
    if (testCase.expectedCleaned) {
      const hasSources = result.filtered.includes("来源:") || result.filtered.includes("Sources:");
      const hasToolOutput = result.filtered.includes("Line 1") && result.filtered.includes("Line 5");
      const hasSystemMsg = result.filtered.includes("[INFO]");
      if (!hasSources && !hasToolOutput && !hasSystemMsg) {
        log(`  ✅ 复杂场景清理成功`, "green");
      } else {
        log(`  ❌ 复杂场景清理不完全`, "red");
        testPassed = false;
      }
    }
    if (testCase.expectedFixed) {
      const hasExtraNewlines = result.filtered.includes("\n\n\n");
      const hasTrailingSpaces = /^[^\n]* +$/m.test(result.filtered);
      if (!hasExtraNewlines && !hasTrailingSpaces) {
        log(`  ✅ 格式问题已修复`, "green");
      } else {
        log(`  ❌ 格式问题未完全修复`, "red");
        testPassed = false;
      }
    }

    if (testPassed) {
      passed++;
      log(`\n✅ 测试通过`, "green");
    } else {
      failed++;
      log(`\n❌ 测试失败`, "red");
    }
  }

  separator();
  log("📊 测试总结", "blue");
  log(`  总计: ${testCases.length}`, "reset");
  log(`  通过: ${passed}`, "green");
  log(`  失败: ${failed}`, failed > 0 ? "red" : "green");

  // 测试过滤器管理
  separator();
  log("🔧 过滤器管理测试", "blue");

  log("\n当前过滤器列表:", "cyan");
  const filters = filter.getFilters();
  filters.forEach(f => {
    const status = f.enabled ? "✅" : "❌";
    log(`  ${status} ${f.name} (优先级: ${f.priority})`, f.enabled ? "green" : "red");
  });

  // 测试禁用/启用
  log("\n测试禁用 websearch-sources:", "cyan");
  filter.setFilterEnabled("websearch-sources", false);
  const updatedFilters = filter.getFilters();
  const wsFilter = updatedFilters.find(f => f.name === "websearch-sources");
  if (wsFilter && !wsFilter.enabled) {
    log(`  ✅ 成功禁用 websearch-sources`, "green");
  } else {
    log(`  ❌ 禁用失败`, "red");
  }

  // 测试重新启用
  log("\n测试重新启用 websearch-sources:", "cyan");
  filter.setFilterEnabled("websearch-sources", true);
  const reEnabledFilters = filter.getFilters();
  const reWsFilter = reEnabledFilters.find(f => f.name === "websearch-sources");
  if (reWsFilter && reWsFilter.enabled) {
    log(`  ✅ 成功启用 websearch-sources`, "green");
  } else {
    log(`  ❌ 启用失败`, "red");
  }

  separator();
  log("✨ 测试完成！", "blue");
}

// 运行测试
runTests().catch(console.error);
