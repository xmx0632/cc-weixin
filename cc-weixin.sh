#!/bin/bash
#
# cc-weixin wrapper - 微信 Claude Code Agent 桥接器
#
# 用法:
#   ./cc-weixin.sh              启动服务（TUI 模式）
#   ./cc-weixin.sh --login      强制重新扫码登录
#   ./cc-weixin.sh --no-tui     纯 CLI 模式
#   ./cc-weixin.sh install      安装依赖
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 显示帮助
show_help() {
    echo "CC-Weixin - 微信 Claude Code Agent 桥接器"
    echo ""
    echo "用法:"
    echo "  cc-weixin              启动服务（TUI 模式）"
    echo "  cc-weixin --login      强制重新扫码登录"
    echo "  cc-weixin --no-tui     纯 CLI 模式"
    echo "  cc-weixin install      安装/更新依赖"
    echo "  cc-weixin --help       显示帮助"
    echo ""
    echo "环境变量:"
    echo "  ANTHROPIC_AUTH_TOKEN   Claude API 密钥（必需）"
    echo "  ANTHROPIC_BASE_URL     自定义 API 地址（可选）"
    echo ""
}

# 检查 Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误: Node.js 未安装${NC}"
        echo "请运行: $SCRIPT_DIR/install.sh"
        exit 1
    fi

    NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo -e "${RED}错误: 需要 Node.js >= 22，当前版本: $(node --version)${NC}"
        echo "请运行: $SCRIPT_DIR/install.sh"
        exit 1
    fi
}

# 检查环境变量
check_env() {
    if [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
        echo -e "${YELLOW}警告: ANTHROPIC_AUTH_TOKEN 未设置${NC}"
        echo "请设置环境变量:"
        echo "  export ANTHROPIC_AUTH_TOKEN=sk-your-api-key"
        echo ""
        read -p "是否继续？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 安装命令
do_install() {
    bash "$SCRIPT_DIR/install.sh"
    exit $?
}

# 主逻辑
case "${1:-}" in
    --help|-h|"")
        if [ "${1:-}" = "" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
            if [ "${1:-}" = "" ]; then
                # 无参数，直接启动
                :
            else
                show_help
                exit 0
            fi
        fi
        ;;
    install)
        do_install
        ;;
esac

# 检查环境
check_node
check_env

# 运行 cc-weixin
echo -e "${GREEN}启动 cc-weixin...${NC}"
exec npx cc-weixin "$@"
