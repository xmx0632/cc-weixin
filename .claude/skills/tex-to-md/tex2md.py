#!/usr/bin/env python3
"""
TeX to Markdown Converter
使用 pypandoc 将 LaTeX 文件转换为 Markdown 格式
支持自动检测和转换 GBK/其他编码到 UTF-8
"""

import argparse
import os
import sys
import tempfile
from pathlib import Path

import pypandoc

try:
    import chardet
    HAS_CHARDET = True
except ImportError:
    HAS_CHARDET = False


def detect_encoding(file_path: str) -> str:
    """
    检测文件编码

    Returns:
        检测到的编码名称
    """
    if not HAS_CHARDET:
        # 尝试常见中文编码
        for encoding in ['utf-8', 'gbk', 'gb18030', 'gb2312']:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    f.read(4096)  # 读取一部分测试
                return encoding
            except UnicodeDecodeError:
                continue
        return 'utf-8'  # 默认

    # 使用 chardet 检测
    with open(file_path, 'rb') as f:
        raw_data = f.read()
        result = chardet.detect(raw_data)
        encoding = result['encoding']
        confidence = result['confidence']

    # chardet 有时会误判，对中文编码做特殊处理
    if encoding and encoding.lower() in ['iso-8859-1', 'iso-8859-2', 'latin-1', 'latin1']:
        # 尝试 GBK
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                f.read()
            return 'gbk'
        except UnicodeDecodeError:
            pass
        # 尝试 GB18030
        try:
            with open(file_path, 'r', encoding='gb18030') as f:
                f.read()
            return 'gb18030'
        except UnicodeDecodeError:
            pass

    return encoding or 'utf-8'


def convert_to_utf8(input_path: str) -> tuple:
    """
    将文件转换为 UTF-8 编码

    Returns:
        (临时文件路径, 原始编码) 或 (原文件路径, 'utf-8')
    """
    encoding = detect_encoding(input_path)

    if encoding.lower() == 'utf-8':
        return input_path, 'utf-8'

    # 需要转换编码
    try:
        with open(input_path, 'r', encoding=encoding) as f:
            content = f.read()

        # 创建临时文件
        temp_file = tempfile.NamedTemporaryFile(
            mode='w',
            encoding='utf-8',
            suffix='.tex',
            delete=False
        )
        temp_file.write(content)
        temp_file.close()

        return temp_file.name, encoding
    except Exception as e:
        print(f"警告: 编码转换失败 ({encoding} -> utf-8): {e}")
        return input_path, encoding


def convert_tex_to_md(input_path: str, output_path: str = None, wrap: bool = True) -> dict:
    """
    将 TeX 文件转换为 Markdown

    Args:
        input_path: 输入的 .tex 文件路径
        output_path: 输出的 .md 文件路径（可选）
        wrap: 是否启用文本换行

    Returns:
        包含转换结果的字典
    """
    input_file = Path(input_path)

    if not input_file.exists():
        return {"success": False, "error": f"文件不存在: {input_path}"}

    if not input_file.suffix == '.tex':
        return {"success": False, "error": f"不是 .tex 文件: {input_path}"}

    # 确定输出路径
    if output_path:
        output_file = Path(output_path)
    else:
        output_file = input_file.with_suffix('.md')

    # 确保输出目录存在
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # 获取输入文件大小
    input_size = input_file.stat().st_size

    # 检测并转换编码
    working_file, original_encoding = convert_to_utf8(str(input_file))
    is_temp_file = working_file != str(input_file)

    try:
        # Pandoc 转换参数
        extra_args = [
            '--mathjax',  # 保留数学公式
        ]

        if not wrap:
            extra_args.append('--wrap=none')

        # 执行转换
        output = pypandoc.convert_file(
            working_file,
            'md',
            outputfile=str(output_file),
            extra_args=extra_args
        )

        # 获取输出文件大小
        output_size = output_file.stat().st_size

        return {
            "success": True,
            "input_path": str(input_file),
            "output_path": str(output_file),
            "input_size": input_size,
            "output_size": output_size,
            "encoding": original_encoding,
        }

    except Exception as e:
        return {"success": False, "error": str(e), "input_path": str(input_file), "encoding": original_encoding}

    finally:
        # 清理临时文件
        if is_temp_file and os.path.exists(working_file):
            os.unlink(working_file)


def convert_directory(dir_path: str, wrap: bool = True) -> list:
    """
    转换目录下所有 .tex 文件

    Args:
        dir_path: 目录路径
        wrap: 是否启用文本换行

    Returns:
        转换结果列表
    """
    dir_path = Path(dir_path)

    if not dir_path.is_dir():
        return [{"success": False, "error": f"不是目录: {dir_path}"}]

    tex_files = list(dir_path.glob('**/*.tex'))

    if not tex_files:
        return [{"success": False, "error": f"目录中没有 .tex 文件: {dir_path}"}]

    results = []
    for tex_file in tex_files:
        result = convert_tex_to_md(str(tex_file), wrap=wrap)
        results.append(result)

    return results


def print_result(result: dict):
    """打印转换结果"""
    encoding_info = f" (编码: {result.get('encoding', 'N/A')})" if result.get('encoding') else ""

    if result["success"]:
        print(f"✓ 转换成功{encoding_info}")
        print(f"  输入: {result['input_path']}")
        print(f"  输出: {result['output_path']}")
        print(f"  大小: {result['input_size']} → {result['output_size']} bytes")
    else:
        print(f"✗ 转换失败{encoding_info}")
        print(f"  文件: {result.get('input_path', 'N/A')}")
        print(f"  错误: {result['error']}")


def main():
    parser = argparse.ArgumentParser(
        description='将 LaTeX (.tex) 文件转换为 Markdown 格式'
    )
    parser.add_argument(
        'input',
        help='输入的 .tex 文件或包含 .tex 文件的目录'
    )
    parser.add_argument(
        'output',
        nargs='?',
        help='输出的 .md 文件（仅对单文件有效）'
    )
    parser.add_argument(
        '--no-wrap',
        action='store_true',
        help='禁用文本自动换行'
    )

    args = parser.parse_args()

    input_path = Path(args.input)

    if input_path.is_dir():
        print(f"批量转换目录: {input_path}")
        print("-" * 40)
        results = convert_directory(args.input, wrap=not args.no_wrap)

        success_count = sum(1 for r in results if r["success"])
        fail_count = len(results) - success_count

        for result in results:
            print_result(result)
            print()

        print("-" * 40)
        print(f"总计: {success_count} 成功, {fail_count} 失败")

        sys.exit(0 if fail_count == 0 else 1)

    else:
        result = convert_tex_to_md(
            args.input,
            args.output,
            wrap=not args.no_wrap
        )
        print_result(result)
        sys.exit(0 if result["success"] else 1)


if __name__ == '__main__':
    main()
