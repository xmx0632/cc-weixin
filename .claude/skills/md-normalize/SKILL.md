---
name: md-normalize
description: 将不规范的 Markdown 数学笔记文件规范化。处理 Pandoc 转换残留、自定义 LaTeX 命令、列表格式、结构标记等问题，输出符合 math-tutorial 格式规范的 Markdown 文件。Use when normalizing markdown files or preprocessing math notes.
argument-hint: <input.md|directory> [output.md]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Bash
---

# Markdown 数学笔记规范化工具

将不规范的 Markdown 文件转换为符合格式规范的标准文件。

## 支持文件

- [WORKFLOW.md](WORKFLOW.md) - 完整工作流程文档
- [FORMAT_SPEC.md](FORMAT_SPEC.md) - Markdown 格式规范

## 输入文件常见问题

### 1. Pandoc 转换残留
- 标题附加 `{#id .class}` 语法
- 列表项使用 `1\.` 转义点号
- 行内样式 `[文本]{style="..."}`

### 2. 自定义 LaTeX 命令
- `\rr` → `\rightarrow`
- `\ep` / `\epsilon` → `\epsilon`
- `\dc{a}{b}` → `\dfrac{a}{b}`
- `\geqt` → `\geq`
- `\leqt` → `\leq`

### 3. 结构标记不统一
- 定义、定理、例题没有统一格式
- 证明、解等没有明确标记

## 使用方式

- `/md-normalize input.md` - 规范化单个文件
- `/md-normalize input.md output.md` - 指定输出文件
- `/md-normalize input_dir/` - 批量处理目录

## 输出格式规范

### 标题格式
```markdown
# 章节标题

## 一、一级节标题

### 1.1 二级节标题
```

### 定义格式
```markdown
**定义 1.1（定义名称）** 设 $D$ 是非空数集，若...，则称...

**注** 补充说明（可选）
```

### 定理格式
```markdown
**定理 1.1（定理名称）** 设 $f(x)$ 在 $[a,b]$ 上连续，则...

**证明** 由已知条件...

**证毕** □
```

### 例题格式
```markdown
**例 1.1** 求下列极限：

（1）$\lim_{n \to \infty} \frac{1}{n}$

**解** 由定义...

**注** 本题的关键是...（可选）
```

### 列表格式
```markdown
1. 第一项
2. 第二项
   - 子项用短横线
3. 第三项
```

### 数学公式
- 行内公式：`$...$`
- 独立公式：`$$...$$`（单独成行）
- 使用标准 LaTeX 命令（KaTeX 兼容）

## 执行步骤

1. 读取原始 Markdown 文件
2. 清理 Pandoc 残留语法
3. 替换自定义 LaTeX 命令
4. 规范化结构标记
5. 统一列表和段落格式
6. 输出规范化后的文件

## LaTeX 命令映射表

| 原命令 | 标准命令 | 说明 |
|--------|----------|------|
| `\rr` | `\rightarrow` 或 `\to` | 右箭头 |
| `\ep` | `\epsilon` | ε |
| `\dc{a}{b}` | `\dfrac{a}{b}` | 分数 |
| `\geqt` | `\geq` | 大于等于 |
| `\leqt` | `\leq` | 小于等于 |
| `\al` | `\alpha` | α |
| `\be` | `\beta` | β |
