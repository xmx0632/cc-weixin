#!/usr/bin/env python3
"""
Markdown 数学笔记规范化工具

将不规范的 Markdown 文件转换为符合格式规范的标准文件。
"""

import re
import sys
import os
from pathlib import Path


# LaTeX 命令映射（注意：顺序很重要，长的命令要放在前面）
LATEX_COMMANDS = [
    (r'\\llrr(?![a-zA-Z])', r'\\Leftrightarrow'),  # \llrr
    (r'\\lrr(?![a-zA-Z])', r'\\Leftrightarrow'),   # \lrr
    (r'\\bec(?![a-zA-Z])', r'\\begin{cases}'),     # \bec
    (r'\\eec(?![a-zA-Z])', r'\\end{cases}'),       # \eec
    (r'\\thickapprox', r'\\approx'),                # \thickapprox
    (r'\\rr(?![a-zA-Z])', r'\\rightarrow'),        # \rr 但不是 \rrxxx
    (r'\\ep(?![a-zA-Z])', r'\\epsilon'),           # \ep 但不是 \epsilon
    (r'\\geqt(?![a-zA-Z])', r'\\geq'),
    (r'\\leqt(?![a-zA-Z])', r'\\leq'),
    (r'\\Dt(?![a-zA-Z])', r'\\Delta'),             # \Dt
    (r'\\dt(?![a-zA-Z])', r'\\delta'),             # \dt
    (r'\\ds(?![a-zA-Z])', r'\\displaystyle'),     # \ds
    (r'\\bt(?![a-zA-Z])', r'\\beta'),              # \bt
    (r'\\al(?![a-zA-Z])', r'\\alpha'),             # \al 但不是 \alpha
    (r'\\be(?![a-zA-Z])', r'\\beta'),
    (r'\\ga(?![a-zA-Z])', r'\\gamma'),
    (r'\\de(?![a-zA-Z])', r'\\delta'),
]

def normalize_latex_commands(text: str) -> str:
    """替换自定义 LaTeX 命令为标准命令"""
    result = text

    # 替换简单命令（按顺序，长的优先）
    for old, new in LATEX_COMMANDS:
        result = re.sub(old, new, result)

    # 替换 \dc{a}{b} -> \dfrac{a}{b}
    # 匹配 \dc{...}{...}，支持嵌套括号
    def replace_dc(match):
        # 简单情况：不包含嵌套括号
        content = match.group(0)
        # 移除 \dc 前缀
        content = content[3:]
        # 找到两个 {...} 参数
        depth = 0
        first_arg = []
        second_arg = []
        in_first = False
        in_second = False

        for i, char in enumerate(content):
            if char == '{':
                depth += 1
                if depth == 1 and not in_first:
                    in_first = True
                    continue
                elif depth == 1 and not in_second:
                    in_second = True
                    continue
            elif char == '}':
                depth -= 1
                if depth == 0 and in_first:
                    in_first = False
                    continue
                elif depth == 0 and in_second:
                    break

            if in_first and depth >= 1:
                first_arg.append(char)
            elif in_second and depth >= 1:
                second_arg.append(char)

        return f"\\dfrac{{''.join(first_arg)}}{{''.join(second_arg)}}"

    # 简单正则处理 \dc{a}{b}（参数不含括号的情况）
    result = re.sub(r'\\dc\{([^{}]+)\}\{([^{}]+)\}', r'\\dfrac{\1}{\2}', result)

    # 处理参数中含简单括号的情况 \dc{a}{b} 其中 a, b 可能是复合表达式
    result = re.sub(r'\\dc\s+', r'\\dfrac', result)

    # ========== 修复 \dfrac 的不规范格式 ==========
    # Pandoc 转换后 \dfrac{a}{b} 可能变成各种不规范的形式

    # 1. \dfraca 2 -> \dfrac{a}{2} (命令后直接跟字母，没有空格)
    result = re.sub(r'\\dfrac([a-zA-Z])\s+([a-zA-Z0-9+\\-])', r'\\dfrac{\1}{\2}', result)

    # 2. \dfrac 1{n+1} -> \dfrac{1}{n+1} (第一个参数无花括号，第二个有)
    result = re.sub(r'\\dfrac\s+([0-9a-zA-Z])\s*\{', r'\\dfrac{\1}{', result)

    # 3. \dfrac1 2 -> \dfrac{1}{2} (两个参数都没有花括号，用空格分隔)
    result = re.sub(r'\\dfrac([0-9a-zA-Z])\s+([0-9a-zA-Z])([^\s{])', r'\\dfrac{\1}{\2}\3', result)

    # 4. \dfrac1 n -> \dfrac{1}{n} (参数后是空格或等号)
    result = re.sub(r'\\dfrac([0-9a-zA-Z])\s+([0-9a-zA-Z])(?=\s|$|=|\\|\))', r'\\dfrac{\1}{\2}', result)

    # 5. \dfracn n=1 -> \dfrac{n}{n}=1 (第一个参数无花括号，第二个也无，后接等号)
    result = re.sub(r'\\dfrac([a-zA-Z0-9])\s+([a-zA-Z0-9])(?=[^a-zA-Z{])', r'\\dfrac{\1}{\2}', result)

    # 6. \dfracn{n+1} -> \dfrac{n}{n+1} (第一个参数无花括号，第二个有)
    # 已经被规则2覆盖，这里作为保险
    result = re.sub(r'\\dfrac([a-zA-Z0-9]+)\{', r'\\dfrac{\1}{', result)

    # 7. \dfrac 1{n+1} -> \dfrac{1}{n+1} (空格变花括号)
    result = re.sub(r'\\dfrac\s+([0-9a-zA-Z])\s*\{', r'\\dfrac{\1}{', result)

    # 8. 处理更复杂的情况：\dfrac a{b} -> \dfrac{a}{b}
    result = re.sub(r'\\dfrac\s+([a-zA-Z0-9])\{', r'\\dfrac{\1}{', result)

    return result


def remove_pandoc_extensions(text: str) -> str:
    """移除 Pandoc 扩展语法"""
    result = text

    # 移除标题的 {#id .class} 语法
    result = re.sub(r'\s*\{#[^}]+\}', '', result)
    result = re.sub(r'\s*\{\.unnumbered\}', '', result)

    # 移除行内样式 [文本]{style="..."}
    result = re.sub(r'\[([^\]]+)\]\{style="[^"]+"\}', r'\1', result)

    # 修复转义的列表点号 1\. -> 1.
    result = re.sub(r'^(\d+)\\\.(\s)', r'\1.\2', result, flags=re.MULTILINE)

    # ========== 修复数学公式格式问题 ==========

    # 1. 修复不完整的行内公式：$01 -> 可能是 \frac{0}{1} 被破坏
    # 如果 $ 后面只有数字且没有匹配的结束符，尝试修复
    result = re.sub(r'\$([0-9]+)(?=[^\d$]|$)', r'\\frac{\1}{1}', result)

    # 2. 清理公式中多余的换行（在 $$...$$ 和 $...$ 内部）
    # 匹配 $$...$$ 块公式中的换行
    def clean_formula_newlines(match):
        formula = match.group(0)
        # 将公式内的多行换行替换为单个空格，但保留必要的结构
        formula = re.sub(r'\n\s*\n\s*', ' ', formula)  # 多个空行变空格
        formula = re.sub(r'\n\s+', ' ', formula)  # 换行+空格变空格
        return formula

    result = re.sub(r'\$\$[^\$]+?\$\$', clean_formula_newlines, result, flags=re.DOTALL)
    result = re.sub(r'\$[^\$]+?\$', clean_formula_newlines, result)

    # 3. 修复孤立的 $ 符号（不配对的情况）
    # 检测单独的 $ 并尝试补全或移除
    # 这里的策略：如果行尾有单独的 $，可能需要匹配前面或后面的内容

    # 4. 修复公式中多余的分隔符和逗号
    # 例如：$x, $ -> $x$
    result = re.sub(r'\$([^\$]+),\s*\$', r'$\1$', result)
    result = re.sub(r'\$([^\$]+),\s*\n', r'$\1$\n', result)

    # 5. 修复公式末尾的截断问题
    # 例如：$(1\leq n_1 -> $(1\leq n_1)$
    result = re.sub(r'\$([^\$]*[<>=\leq\geq\\infty][^$]*)$(?=[^\s$]|$)', r'$\1$', result)

    return result


def normalize_structure(text: str) -> str:
    """规范化结构标记"""
    result = text
    lines = result.split('\n')
    new_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # 检测定义模式：定义1: 或 定义1：或 定义1.
        def_match = re.match(r'^(定义\s*\d+\s*[：:.])', line)
        if def_match:
            # 转换为标准格式
            line = re.sub(r'^(定义\s*\d+)\s*[：:.]\s*', r'**\1** ', line)
            if not line.startswith('**'):
                line = '**' + line

        # 检测定理模式
        theorem_match = re.match(r'^(定理\s*\d+)', line)
        if theorem_match and not line.startswith('**'):
            line = re.sub(r'^(定理\s*\d+)\s*[：:.]?\s*', r'**\1** ', line)

        # 检测例题模式：例1. 或 例 1.
        example_match = re.match(r'^例\s*(\d+)\s*[\.．]', line)
        if example_match and not line.startswith('**'):
            line = re.sub(r'^例\s*(\d+)\s*[\.．]\s*', r'**例 \1** ', line)

        # 检测证明标记
        if re.match(r'^证明\s*[：:.]?\s*$', line.strip()):
            line = '**证明** '
        if re.match(r'^证毕', line.strip()):
            line = '**证毕** □'

        # 检测解标记
        if re.match(r'^解\s*[：:.]?\s*$', line.strip()):
            line = '**解** '

        # 检测注标记
        if re.match(r'^注\s*[\(（]?\d*[\)）]?\s*[\.．：:.]?\s*', line.strip()):
            line = re.sub(r'^注\s*[\(（]?(\d*)[\)）]?\s*[\.．：:.]?\s*', r'**注** ', line.strip())

        new_lines.append(line)
        i += 1

    return '\n'.join(new_lines)


def normalize_lists(text: str) -> str:
    """规范化列表格式"""
    lines = text.split('\n')
    new_lines = []
    in_list = False
    list_type = None  # 'ordered' or 'unordered'

    for line in lines:
        stripped = line.strip()

        # 检测有序列表
        if re.match(r'^\d+\.\s', stripped):
            if not in_list or list_type != 'ordered':
                in_list = True
                list_type = 'ordered'
            # 确保列表项之间没有空行（可选，根据需要）
            new_lines.append(line)

        # 检测无序列表
        elif stripped.startswith('- ') or stripped.startswith('* '):
            if not in_list or list_type != 'unordered':
                in_list = True
                list_type = 'unordered'
            new_lines.append(line)

        # 空行
        elif stripped == '':
            # 列表结束
            if in_list:
                in_list = False
                list_type = None
            new_lines.append(line)

        else:
            # 普通段落
            in_list = False
            list_type = None
            new_lines.append(line)

    return '\n'.join(new_lines)


def normalize_math_formulas(text: str) -> str:
    """规范化数学公式"""
    result = text

    # 确保独立公式前后有空行
    # 查找 $$...$$ 并确保前后有空行
    def ensure_blank_lines(match):
        formula = match.group(0)
        return f'\n\n{formula}\n\n'

    # 这个正则会破坏已有格式，暂时跳过
    # result = re.sub(r'\$\$[^\$]+\$\$', ensure_blank_lines, result, flags=re.DOTALL)

    return result


def normalize_whitespace(text: str) -> str:
    """规范化空白字符"""
    result = text

    # 移除行尾空白
    lines = [line.rstrip() for line in result.split('\n')]
    result = '\n'.join(lines)

    # 合并多个连续空行为最多两个
    result = re.sub(r'\n{3,}', '\n\n', result)

    # 确保文件末尾有一个换行
    result = result.rstrip() + '\n'

    return result


def normalize_file(input_path: str, output_path: str = None) -> str:
    """规范化单个文件"""
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 按顺序应用规范化规则
    result = content
    result = remove_pandoc_extensions(result)
    result = normalize_latex_commands(result)
    result = normalize_structure(result)
    result = normalize_lists(result)
    result = normalize_math_formulas(result)
    result = normalize_whitespace(result)

    # 确定输出路径
    if output_path is None:
        # 默认输出到原文件（覆盖）
        output_path = input_path

    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result)

    return output_path


def main():
    if len(sys.argv) < 2:
        print("用法: python normalize_md.py <input.md> [output.md]")
        print("      python normalize_md.py <input_dir>")
        sys.exit(1)

    input_arg = sys.argv[1]

    if os.path.isdir(input_arg):
        # 批量处理目录
        input_dir = Path(input_arg)
        md_files = list(input_dir.glob('*.md'))

        if not md_files:
            print(f"目录 {input_dir} 中没有 .md 文件")
            sys.exit(1)

        print(f"找到 {len(md_files)} 个 .md 文件")
        for md_file in md_files:
            # 跳过已经是规范化输出的文件
            if '_normalized' in md_file.name:
                continue

            output_file = md_file.parent / f"{md_file.stem}_normalized{md_file.suffix}"
            normalize_file(str(md_file), str(output_file))
            print(f"  ✓ {md_file.name} -> {output_file.name}")

        print("完成！")

    elif os.path.isfile(input_arg):
        # 处理单个文件
        output_arg = sys.argv[2] if len(sys.argv) > 2 else None
        output_path = normalize_file(input_arg, output_arg)
        print(f"✓ 已规范化: {output_path}")

    else:
        print(f"错误: {input_arg} 不是有效的文件或目录")
        sys.exit(1)


if __name__ == '__main__':
    main()
