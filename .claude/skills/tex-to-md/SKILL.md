---
name: tex-to-md
description: 将 LaTeX (.tex) 文件转换为 Markdown 格式。使用 Python venv 环境和 pypandoc 进行转换。支持批量转换单个文件或整个目录。自动保留数学公式格式。Use when converting tex files to markdown.
argument-hint: <input.tex|directory> [output.md]
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
---

# TeX to Markdown 转换器

将 LaTeX 文件转换为 Markdown 格式，保留数学公式。

## 前置检查

1. 检查系统是否安装了 Pandoc：
   ```bash
   pandoc --version
   ```
   如果未安装，提示用户安装：
   - macOS: `brew install pandoc`
   - Ubuntu/Debian: `sudo apt install pandoc`
   - Windows: `choco install pandoc`

2. 确保 venv 环境已创建（首次使用时自动创建）

## 使用方式

- `/tex-to-md input.tex` - 转换单个文件
- `/tex-to-md input.tex output.md` - 指定输出文件
- `/tex-to-md input_dir/` - 转换目录下所有 .tex 文件
- `/tex-to-md input.tex --no-wrap` - 禁用文本换行

## 执行步骤

### 单文件转换

1. 确认输入文件存在
2. 激活 venv 环境并运行转换：
   ```bash
   cd "${CLAUDE_SKILL_DIR}"
   source .venv/bin/activate
   python tex2md.py "$ARGUMENTS"
   ```

### 目录批量转换

1. 查找目录下所有 .tex 文件
2. 逐个转换，保持原文件名，扩展名改为 .md
3. 报告转换结果

## 转换参数

默认使用的 Pandoc 参数：
- `--wrap=none` - 不自动换行（可选）
- `--mathjax` - 保留 LaTeX 数学公式
- `--extract-media=.` - 提取图片到当前目录

## 输出报告

转换完成后报告：
- 输入文件路径
- 输出文件路径
- 文件大小变化
- 是否成功

## 错误处理

- 文件不存在：提示用户检查路径
- Pandoc 未安装：提示安装命令
- 转换失败：显示错误信息，建议检查 tex 语法

## 示例

**输入** (LaTeX):
```latex
\documentclass{article}
\begin{document}

\section{Introduction}

The equation $E = mc^2$ is famous.

\begin{equation}
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
\end{equation}

\end{document}
```

**输出** (Markdown):
```markdown
# Introduction

The equation $E = mc^2$ is famous.

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```
