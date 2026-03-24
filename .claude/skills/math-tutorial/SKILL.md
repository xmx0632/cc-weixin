---
name: math-tutorial
description: 将 Markdown 数学笔记转换为精美的 HTML 教程页面。智能识别定义、定理、例题、证明等结构，应用不同的视觉样式，使用 KaTeX 渲染 LaTeX 公式。Use when generating math tutorial HTML or converting math notes.
argument-hint: <input.md> [output.html]
allowed-tools:
  - Read
  - Write
  - Bash
---

# 数学教程 HTML 生成器

将 Markdown 格式的数学笔记转换为精美的 HTML 教程页面。

## 支持文件

- [template.html](template.html) - HTML 样式模板
- [math_tutorial.py](math_tutorial.py) - Python 转换脚本

## 设计风格

参考高等数学教程项目的设计规范：
- 定义框：蓝色渐变背景
- 定理框：绿色渐变背景
- 例题框：黄色渐变背景
- 注释：浅黄色背景
- 思考题：灰色虚线边框
- 作业：紫色虚线边框

## 使用方式

```
/math-tutorial <input.md> [output.html]
```

## 内容识别规则

### 1. 定义识别
- 以 "定义" 开头的段落
- 格式：`定义1: ...` 或 `定义 1.1（名称）...`
- 样式： `.definition` 蓝色框

### 2. 定理识别
- 以 "定理"、"性质"、"引理"、"推论" 开头
- 样式: `.theorem` 绿色框

### 3. 例题识别
- 以 "例" 开头
- 格式：`例1.` 或 `例 1.1`
- 样式: `.example` 黄色框

### 4. 证明识别
- 以 "证明"、"证" 开头
- 样式: `.proof` 灰色框

### 5. 注释识别
- 以 "注"、"注意"、"说明" 开头
- 样式: `.note` 浅黄色框

### 6. 思考题识别
- 以 "Q:"、"思考"、"分析" 开头
- 样式: `.question` 虚线框

### 7. 作业识别
- 以 "作业"、"练习"、"习题" 开头
- 样式: `.homework` 紫色框

## LaTeX 公式处理

- 行内公式：`$...$`
- 块级公式：`$$...$$`
- 使用 KaTeX 自动渲染

## 自定义 LaTeX 命令

转换时自动替换：
- `\ep` → `\epsilon`
- `\rr` → `\rightarrow`
- `\dc` → `\dfrac`
- `\al` → `\alpha`
- `\geqt` → `\geq`
- `\leqt` → `\leq`

## 执行步骤

1. 读取输入的 Markdown 文件
2. 识别内容结构（定义、定理、例题等）
3. 应用对应的 HTML 样式
4. 替换自定义 LaTeX 命令
5. 生成完整的 HTML 文件
6. 输出到指定路径

## 执行命令

使用 Python 脚本转换：

```bash
cd "${CLAUDE_SKILL_DIR}"
python math_tutorial.py "$ARGUMENTS"
```

或使用项目中的 md2html.py：

```bash
python /path/to/project/md2html.py "$ARGUMENTS"
```
