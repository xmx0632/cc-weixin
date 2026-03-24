# 高等数学讲义补全工作流程

## 项目概述

- **内容**：高等数学讲义，共 11 章，约 500+ 页
- **现状**：框架已写好，例题已列出，但具体内容需要补全
- **目标**：通过 AI 辅助补全内容，减少手动输入工作量

## 核心任务（必须完成）

1. **理论知识填充** - 补全定义、定理、性质等理论内容
2. **例题补全分析解答** - 为已有例题补充完整的分析过程和解答步骤

## 扩展任务（锦上添花）

3. **典型错误标注** - 将文件末尾的"典型错误分析"标注到相应题目下
4. **知识图谱** - 复习部分以图谱形式呈现

## 工作流程

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────────┐   ┌─────────────┐
│  原始 LaTeX  │ → │ tex-to-md    │ → │ md-normalize │ → │ Claude 补全  │ → │ math-tutorial│
│   (.tex)    │   │ 转 Markdown   │   │   规范化      │   │（约定格式）   │   │  生成 HTML   │
└─────────────┘   └──────────────┘   └──────────────┘   └─────────────┘   └─────────────┘
                                                               ↓
                                                        ┌─────────────┐
                                                        │ 可选: LaTeX  │
                                                        └─────────────┘
```

## 各步骤说明

### 步骤 1：LaTeX → Markdown

| 项目 | 说明 |
|-----|------|
| 输入 | 原始 .tex 文件（可能含 GBK 编码） |
| 输出 | .md 文件（UTF-8 编码） |
| 工具 | `/tex-to-md` skill 或 `tex2md.py` |
| 注意 | 需处理编码转换和保留数学公式 |

### 步骤 2：Markdown 规范化

| 项目 | 说明 |
|-----|------|
| 输入 | 转换后的 .md 文件（可能有 Pandoc 残留） |
| 输出 | 规范化的 .md 文件 |
| 工具 | `/md-normalize` skill 或 `normalize_md.py` |
| 处理 | 清理 Pandoc 残留、替换自定义 LaTeX 命令、统一格式 |

### 步骤 3：AI 补全内容

| 项目 | 说明 |
|-----|------|
| 输入 | 规范化的 .md 文件（框架，内容不完整） |
| 输出 | 完整的 .md 文件（符合格式规范） |
| 工具 | Claude（需要大模型理解语义） |
| 规范 | 参见 `FORMAT_SPEC.md` |

**补全内容：**

| 类型 | 说明 |
|-----|------|
| 理论知识 | 定义、定理、性质、证明等 |
| 例题解答 | 分析过程、解题步骤、关键点 |
| 典型错误 | 标注到相应题目下（可选） |
| 知识图谱 | 复习部分以图谱形式呈现（可选） |

### 步骤 4：Markdown → HTML

| 项目 | 说明 |
|-----|------|
| 输入 | 补全后的 .md 文件 |
| 输出 | .html 文件 |
| 工具 | `/math-tutorial` skill 或 `md2html.py` |
| 特点 | 使用 KaTeX 渲染数学公式 |

### 步骤 5：Markdown → LaTeX（可选）

| 项目 | 说明 |
|-----|------|
| 输入 | 补全后的 .md 文件 |
| 输出 | .tex 文件 |
| 用途 | 方便后续手动修改和排版 |

## 文件命名约定

```
原始文件：    chapter1.tex
转换后：      chapter1.md
规范化后：    chapter1-normalized.md
补全后：      chapter1-complete.md
HTML 输出：   chapter1-complete.html
LaTeX 输出：  chapter1-complete.tex（可选）
```

## 相关 Skills

| Skill | 功能 | 调用方式 |
|-------|------|----------|
| `tex-to-md` | LaTeX → Markdown | `/tex-to-md input.tex` |
| `md-normalize` | Markdown 规范化 | `/md-normalize input.md` |
| `math-tutorial` | Markdown → HTML | `/math-tutorial input.md` |

## 相关文件

- `FORMAT_SPEC.md` - Markdown 格式规范
- `normalize_md.py` - Markdown 规范化工具
- `md2html.py` - Markdown 转 HTML 工具
- `tex2md.py` - LaTeX 转 Markdown 工具

## Subagent

使用 `math-tutorial-converter` subagent 可自动执行完整工作流程：

```
Use the math-tutorial-converter agent to process chapter1.tex
```

## 注意事项

1. **第一步必须用大模型**：输入文件格式不可预期，需要语义理解
2. **规范化步骤重要**：清理 Pandoc 残留，统一格式，便于后续处理
3. **人工校对必不可少**：AI 补全的内容需要人工审核
4. **保留原始文件**：所有转换生成新文件，不覆盖原始文件
