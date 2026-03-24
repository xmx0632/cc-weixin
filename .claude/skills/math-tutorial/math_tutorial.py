#!/usr/bin/env python3
"""
数学教程 HTML 生成器
将 Markdown 数学笔记转换为精美的 HTML 教程页面

使用方法:
    python math_tutorial.py <input.md> [output.html]
    python math_tutorial.py <directory>  # 转换目录下所有 .md 文件
"""

import re
import sys
from pathlib import Path


# 自定义 LaTeX 命令替换（注意：顺序很重要，长的命令要放在前面）
LATEX_COMMANDS = [
    (r'\\rr(?![a-zA-Z])', r'\\rightarrow'),  # \rr 但不是 \rrxxx
    (r'\\ep(?![a-zA-Z])', r'\\epsilon'),     # \ep 但不是 \epsilon
    (r'\\dc(?![a-zA-Z])', r'\\dfrac'),
    (r'\\al(?![a-zA-Z])', r'\\alpha'),       # \al 但不是 \alpha
    (r'\\be(?![a-zA-Z])', r'\\beta'),
    (r'\\ga(?![a-zA-Z])', r'\\gamma'),
    (r'\\de(?![a-zA-Z])', r'\\delta'),
    (r'\\geqt(?![a-zA-Z])', r'\\geq'),
    (r'\\leqt(?![a-zA-Z])', r'\\leq'),
    (r'\\neqt(?![a-zA-Z])', r'\\neq'),
    (r'\\cd(?![a-zA-Z])', r'\\cdot'),
]


def replace_custom_latex(content: str) -> str:
    """替换自定义 LaTeX 命令"""
    for old, new in LATEX_COMMANDS:
        content = re.sub(old, new, content)
    return content


def clean_text(text: str) -> str:
    """清理文本中的 Markdown 标记"""
    text = re.sub(r'\s*\{#[^}]+\}', '', text)
    text = re.sub(r'\s*\{[^}]*\.unnumbered[^}]*\}', '', text)
    text = re.sub(r'\s*style="[^"]*"', '', text)
    text = text.replace(r'\.', '.')
    return text.strip()


def process_inline(text: str) -> str:
    """处理行内元素"""
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return text


class MathTutorialGenerator:
    def __init__(self, template_path: str = None):
        if template_path is None:
            template_path = Path(__file__).parent / 'template.html'
        with open(template_path, 'r', encoding='utf-8') as f:
            self.template = f.read()

        self.content_lines = []
        self.pending_list = []

        # 当前打开的块类型
        self.current_block = None  # 'definition', 'theorem', 'example', 'proof', 'homework', 'review'

    def flush_list(self):
        """输出待处理的列表"""
        if self.pending_list:
            self.content_lines.append('<ul>')
            for item in self.pending_list:
                self.content_lines.append(f'<li>{item}</li>')
            self.content_lines.append('</ul>')
            self.pending_list = []

    def close_current_block(self):
        """关闭当前打开的块"""
        if self.current_block:
            self.content_lines.append('</div>')
            self.current_block = None

    def add_line(self, line: str):
        """添加一行内容"""
        self.content_lines.append(line)

    def add_paragraph(self, text: str):
        """添加段落（如果在块内则直接添加，否则包装成 p）"""
        if self.current_block:
            self.add_line(f'<p>{text}</p>')
        else:
            self.add_line(f'<p>{text}</p>')

    def parse_markdown(self, md_content: str) -> str:
        """解析 Markdown 内容"""
        md_content = replace_custom_latex(md_content)
        lines = md_content.split('\n')

        title = "数学笔记"

        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # 空行 - 跳过
            if not stripped:
                i += 1
                continue

            # 水平分隔线 - 关闭当前块
            if stripped == '---' or stripped == '***' or stripped == '___':
                self.close_current_block()
                self.add_line('<hr>')
                i += 1
                continue

            # H1 标题
            if stripped.startswith('# ') and not stripped.startswith('## '):
                self.flush_list()
                self.close_current_block()
                title = clean_text(stripped[2:])
                self.add_line(f'<h1>{title}</h1>')
                i += 1
                continue

            # H2 标题
            if stripped.startswith('## ') and not stripped.startswith('### '):
                self.flush_list()
                self.close_current_block()
                text = clean_text(stripped[3:])
                self.add_line(f'<h2>{text}</h2>')
                i += 1
                continue

            # H3 标题
            if stripped.startswith('### '):
                self.flush_list()
                self.close_current_block()
                text = clean_text(stripped[4:])
                self.add_line(f'<h3>{text}</h3>')
                i += 1
                continue

            # 列表项
            list_match = re.match(r'^(\d+)\\\.\s+(.*)$', stripped)
            if list_match:
                self.close_current_block()
                self.pending_list.append(process_inline(list_match.group(2)))
                i += 1
                continue

            if stripped.startswith('- ') or stripped.startswith('* '):
                self.close_current_block()
                self.pending_list.append(process_inline(stripped[2:]))
                i += 1
                continue

            # 非列表项，先输出列表
            self.flush_list()

            # 定义
            def_match = re.match(r'^(定义\s*\d*(?:\.\d*)?(?:[\'′]*)?\s*(?:（[^）]+）)?)[：:]\s*(.*)$', stripped)
            if def_match:
                self.close_current_block()
                title_part = def_match.group(1)
                content_part = def_match.group(2)
                self.add_line('<div class="definition">')
                self.add_line(f'<div class="definition-title">{title_part}</div>')
                self.current_block = 'definition'
                if content_part:
                    self.add_paragraph(process_inline(content_part))
                i += 1
                continue

            # 定理
            thm_match = re.match(r'^(定理|引理|性质|推论)\s*\d*(?:\.\d*)?\s*(?:（[^）]+）)?[：:]?\s*(.*)$', stripped)
            if thm_match:
                self.close_current_block()
                title_part = thm_match.group(1)
                content_part = thm_match.group(2)
                self.add_line('<div class="theorem">')
                self.add_line(f'<div class="theorem-title">{title_part}</div>')
                self.current_block = 'theorem'
                if content_part:
                    self.add_paragraph(process_inline(content_part))
                i += 1
                continue

            # 例题
            ex_match = re.match(r'^(例\s*\d+(?:\.\d*)?)\s*[\.、．]\s*(.*)$', stripped)
            if ex_match:
                self.close_current_block()
                title_part = ex_match.group(1)
                content_part = ex_match.group(2)
                self.add_line('<div class="example">')
                self.add_line(f'<div class="example-title">{title_part}</div>')
                self.current_block = 'example'
                if content_part:
                    self.add_paragraph(process_inline(content_part))
                i += 1
                continue

            # 注释 - 独立块
            if re.match(r'^注[\(（]?\d*[\)）]?[\.．：:]', stripped):
                self.close_current_block()
                text = process_inline(stripped)
                self.add_line(f'<div class="note"><span class="note-title">💡 注</span>：{text}</div>')
                i += 1
                continue

            # 思考/分析/Q: - 独立块
            if re.match(r'^(Q:|思考|分析)[：:?\s]', stripped):
                self.close_current_block()
                text = process_inline(re.sub(r'^(Q:|思考|分析)[：:?\s]*', '', stripped))
                self.add_line(f'<div class="question"><div class="question-title">🤔 思考</div><p>{text}</p></div>')
                i += 1
                continue

            # 作业
            if re.match(r'^(作业|练习|习题)[：:]', stripped):
                self.close_current_block()
                text = process_inline(stripped)
                self.add_line('<div class="homework">')
                self.add_line(f'<div class="homework-title">📝 {text}</div>')
                self.current_block = 'homework'
                i += 1
                continue

            # 典型错误 - 作为块处理（支持多种格式）
            # 格式1: **典型错误** 或 **典型错误：**
            # 格式2: 典型错误： 或 典型错误:
            # 格式3: **典型错误：** content
            error_match = re.match(r'^(?:\*\*)?典型错误[：:](?:\s*\*\*)?\s*(.*)$', stripped)
            if error_match:
                self.close_current_block()
                extra = error_match.group(1).strip()
                self.add_line('<div class="warning">')
                self.add_line('<div class="warning-title">⚠️ 典型错误</div>')
                if extra:
                    self.add_line(f'<p>{process_inline(extra)}</p>')
                self.current_block = 'warning'
                i += 1
                continue

            # 典型问题 - 作为块处理（支持多种格式）
            problem_match = re.match(r'^(?:\*\*)?典型问题[：:](?:\s*\*\*)?\s*(.*)$', stripped)
            if problem_match:
                self.close_current_block()
                extra = problem_match.group(1).strip()
                self.add_line('<div class="note">')
                self.add_line('<div class="note-title">💡 典型问题</div>')
                if extra:
                    self.add_line(f'<p>{process_inline(extra)}</p>')
                self.current_block = 'note'
                i += 1
                continue

            # 学习建议 - 作为块处理
            advice_match = re.match(r'^(?:\*\*)?学习建议[：:](?:\s*\*\*)?\s*(.*)$', stripped)
            if advice_match:
                self.close_current_block()
                extra = advice_match.group(1).strip()
                self.add_line('<div class="review">')
                self.add_line('<div class="review-title">📚 学习建议</div>')
                if extra:
                    self.add_line(f'<p>{process_inline(extra)}</p>')
                self.current_block = 'review'
                i += 1
                continue

            # 警告/注意 - 独立块
            if re.match(r'^(注意|警告)[：:]', stripped):
                self.close_current_block()
                text = process_inline(stripped)
                self.add_line(f'<div class="warning"><span class="warning-title">⚠️ {text}</span></div>')
                i += 1
                continue

            # 证明
            if re.match(r'^(证明|证)[：:]', stripped):
                self.close_current_block()
                text = process_inline(stripped)
                self.add_line('<div class="proof">')
                self.add_line(f'<div class="proof-title">{text}</div>')
                self.current_block = 'proof'
                i += 1
                continue

            # 证毕符号
            if stripped in ['□', '证毕', 'Q.E.D.']:
                self.add_line('<div class="qed">□</div>')
                self.close_current_block()
                i += 1
                continue

            # 知识回顾
            if '知识回顾' in stripped or '内容回顾' in stripped or stripped == '大班知识回顾':
                self.close_current_block()
                self.add_line('<div class="review">')
                self.add_line(f'<div class="review-title">📚 {stripped}</div>')
                self.current_block = 'review'
                i += 1
                continue

            # 普通段落
            text = process_inline(stripped)
            self.add_paragraph(text)
            i += 1

        # 结束处理
        self.flush_list()
        self.close_current_block()

        # 生成最终 HTML
        content = '\n'.join(self.content_lines)
        html = self.template.replace('{{TITLE}}', title.split('（')[0].strip())
        html = html.replace('{{CONTENT}}', content)

        return html


def convert_file(input_path: Path, output_path: Path = None):
    """转换单个文件"""
    if output_path is None:
        output_path = input_path.with_suffix('.html')

    print(f"转换: {input_path.name} -> {output_path.name}")

    with open(input_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    generator = MathTutorialGenerator()
    html_content = generator.parse_markdown(md_content)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"  ✓ 已生成 {output_path}")


def main():
    if len(sys.argv) < 2:
        print("用法:")
        print("  python math_tutorial.py <input.md> [output.html]")
        print("  python math_tutorial.py <directory>")
        sys.exit(1)

    input_path = Path(sys.argv[1])

    if input_path.is_dir():
        md_files = list(input_path.glob("*.md"))
        if not md_files:
            print(f"目录 {input_path} 下没有 .md 文件")
            sys.exit(1)
        for md_file in md_files:
            convert_file(md_file)
        print(f"\n完成！共转换 {len(md_files)} 个文件")
    else:
        output_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else None
        convert_file(input_path, output_path)


if __name__ == '__main__':
    main()
