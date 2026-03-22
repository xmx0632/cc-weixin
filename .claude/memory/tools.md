# 可用工具记录

## 飞书消息发送

### Shell 脚本方式
```bash
./send-feishu.sh "消息内容"
```

### Python 脚本方式
```bash
python3 /Volumes/macext/code/test/feishu-bot/feishu_send.py --message "消息内容"
```

**位置**: `/Volumes/macext/code/test/feishu-bot/feishu_send.py`
**说明**: 发送消息到默认飞书群（oc_1ef64241cdda64a2249dbc0e494231b8）


## 飞书文件发送

### 方法一：使用 Python 脚本
```bash
cd /Volumes/macext/code/test/feishu-bot
source .env && source venv/bin/activate && python send_file_to_feishu.py /path/to/file.txt
```

### 方法二：使用 Shell 脚本
```bash
cd /Volumes/macext/code/test/feishu-bot
./send_file.sh /path/to/file.txt
```

**位置**: `/Volumes/macext/code/test/feishu-bot/send_file_to_feishu.py`
**说明**: 发送文件到默认飞书群（支持 txt, md, pdf, 图片等格式）


---
*最后更新: 2026-03-22*
