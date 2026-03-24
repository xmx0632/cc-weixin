#!/usr/bin/env python3
"""
飞书文件/消息发送 CLI 工具

使用方法:
    feishu_send.py "消息内容" --chat-id <群聊ID>
    feishu_send.py --file <文件路径> --chat-id <群聊ID>
    feishu_send.py --file <文件1> <文件2> --message "消息" --chat-id <群聊ID>
"""

import os
import sys
import argparse
import requests
from requests_toolbelt import MultipartEncoder
import json
from pathlib import Path
from dotenv import load_dotenv


def find_and_load_env():
    """查找并加载 .env 文件"""
    env_paths = [
        Path.cwd() / ".env",
        Path(sys.executable).parent / ".env" if getattr(sys, 'frozen', False) else None,
        Path(__file__).parent / ".env",
        # 查找 feishu-bot 目录（cc-weixin 的同级目录）
        Path(__file__).parent.parent.parent.parent / "feishu-bot" / ".env",
    ]
    env_paths = [p for p in env_paths if p is not None]

    for env_path in env_paths:
        if env_path.exists():
            load_dotenv(env_path)
            return

    load_dotenv()


# 飞书 API 配置
API_BASE = "https://open.feishu.cn/open-apis"


class FeishuSender:
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.tenant_access_token = None

    def get_tenant_access_token(self):
        """获取 tenant_access_token（用于应用级操作）"""
        if self.tenant_access_token:
            return self.tenant_access_token

        url = f"{API_BASE}/auth/v3/tenant_access_token/internal"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        data = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }

        response = requests.post(url, headers=headers, json=data)

        if response.status_code != 200:
            raise Exception(f"API 请求失败: HTTP {response.status_code}\n响应: {response.text[:200]}")

        try:
            result = response.json()
        except json.JSONDecodeError as e:
            raise Exception(f"API 返回非 JSON 格式\n原始响应: {response.text[:300]}")

        if result.get("code") != 0:
            raise Exception(f"获取 tenant_access_token 失败: {result}")

        self.tenant_access_token = result.get("tenant_access_token")
        return self.tenant_access_token

    def _detect_chat_id_type(self, chat_id):
        """自动检测 chat_id 类型"""
        if chat_id.startswith("oc_"):
            return "chat_id"
        elif chat_id.startswith("ou_"):
            return "open_id"
        elif chat_id.startswith("on_"):
            return "open_id"
        else:
            return "chat_id"

    def upload_file(self, file_path):
        """上传文件到飞书 IM，返回 file_key"""
        url = f"{API_BASE}/im/v1/files"

        file_name = os.path.basename(file_path)
        content_type = self._get_mime_type(file_path)

        # 打开文件
        with open(file_path, 'rb') as f:
            file_content = f.read()

        # 使用 MultipartEncoder 构造请求体
        form = {
            'file_type': 'doc',  # 文件类型：opus, mp4, pdf, doc, xls, stream 等
            'file_name': file_name,
            'file': (file_name, file_content, content_type)
        }

        multi_form = MultipartEncoder(form)

        headers = {
            "Authorization": f"Bearer {self.get_tenant_access_token()}",
            "Content-Type": multi_form.content_type
        }

        response = requests.post(url, headers=headers, data=multi_form)
        result = response.json()

        if result.get("code") != 0:
            raise Exception(f"上传文件失败: {result}")

        return result["data"]["file_key"]

    def send_file_message(self, file_key, chat_id):
        """发送文件消息"""
        receive_id_type = self._detect_chat_id_type(chat_id)
        url = f"{API_BASE}/im/v1/messages?receive_id_type={receive_id_type}"
        headers = {
            "Authorization": f"Bearer {self.get_tenant_access_token()}",
            "Content-Type": "application/json; charset=utf-8",
        }

        data = {
            "receive_id": chat_id,
            "msg_type": "file",
            "content": json.dumps({"file_key": file_key})
        }

        print(f"发送文件消息，receive_id_type: {receive_id_type}")
        response = requests.post(url, headers=headers, json=data)
        result = response.json()

        if result.get("code") != 0:
            raise Exception(f"发送文件消息失败: {result}")

        return result

    def send_text_message(self, content, chat_id):
        """发送文本消息"""
        receive_id_type = self._detect_chat_id_type(chat_id)
        url = f"{API_BASE}/im/v1/messages?receive_id_type={receive_id_type}"
        headers = {
            "Authorization": f"Bearer {self.get_tenant_access_token()}",
            "Content-Type": "application/json; charset=utf-8",
        }

        data = {
            "receive_id": chat_id,
            "msg_type": "text",
            "content": json.dumps({"text": content})
        }

        print(f"发送文本消息，receive_id_type: {receive_id_type}")
        response = requests.post(url, headers=headers, json=data)
        result = response.json()

        if result.get("code") != 0:
            raise Exception(f"发送文本消息失败: {result}")

        return result

    def _get_mime_type(self, file_path):
        """根据文件扩展名获取 MIME 类型"""
        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.wav': 'audio/x-wav',
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.py': 'text/x-python',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.html': 'text/html',
            '.htm': 'text/html',
        }
        return mime_types.get(ext, 'application/octet-stream')


def main():
    # 加载环境变量
    find_and_load_env()

    app_id = os.getenv('FEISHU_APP_ID')
    app_secret = os.getenv('FEISHU_APP_SECRET')
    default_chat_id = os.getenv('FEISHU_DEFAULT_CHAT_ID')

    if not app_id or not app_secret:
        print("错误: 未找到 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量")
        print("请在 .env 文件中配置飞书应用凭证")
        sys.exit(1)

    parser = argparse.ArgumentParser(
        description='飞书文件/消息发送 CLI 工具',
        epilog='''
使用示例:
  # 发送文本消息（使用默认群聊）
  feishu_send.py --message "你好，这是测试消息"

  # 发送文本消息（指定群聊）
  feishu_send.py --message "你好" --chat-id oc_xxx

  # 发送单个文件
  feishu_send.py --file audio.wav

  # 发送多个文件
  feishu_send.py --file file1.wav file2.mp3

  # 同时发送文件和消息
  feishu_send.py --file result.pdf --message "报告已生成"
        '''
    )

    parser.add_argument('--message', '-m', help='要发送的文本消息')
    parser.add_argument('--file', '-f', nargs='+', help='要发送的文件路径')
    parser.add_argument('--chat-id', '-c', nargs='?', const='default',
                        help='目标群聊 ID (不传或传 "default" 使用 .env 中的默认配置)')
    parser.add_argument('--list-chats', action='store_true', help='列出所有可用的群聊')

    args = parser.parse_args()

    # 处理 --list-chats
    if args.list_chats:
        print("获取群聊列表功能暂未实现，请使用 feishu-bot/get_chats.py 查看")
        return

    # 确定目标 chat_id
    chat_id = args.chat_id if args.chat_id and args.chat_id != 'default' else default_chat_id
    if not chat_id:
        print("错误: 未指定 chat_id，且 .env 中未配置 FEISHU_DEFAULT_CHAT_ID")
        sys.exit(1)

    # 创建发送器
    sender = FeishuSender(app_id, app_secret)

    # 初始化 token
    print("正在连接飞书 API...")
    sender.get_tenant_access_token()
    print("✓ 连接成功\n")

    # 发送文件
    if args.file:
        print(f"准备发送 {len(args.file)} 个文件...\n")
        for file_path in args.file:
            if not os.path.exists(file_path):
                print(f"✗ 文件不存在: {file_path}")
                continue

            file_name = os.path.basename(file_path)
            print(f"[{file_name}] 上传中...")
            try:
                file_key = sender.upload_file(file_path)
                sender.send_file_message(file_key, chat_id)
                print(f"  ✓ 发送成功\n")
            except Exception as e:
                print(f"  ✗ 发送失败: {e}\n")

    # 发送文本消息
    if args.message:
        print(f"发送消息...")
        try:
            sender.send_text_message(args.message, chat_id)
            print("✓ 消息发送成功\n")
        except Exception as e:
            print(f"✗ 发送失败: {e}\n")

    print("完成!")


if __name__ == "__main__":
    main()
