#!/bin/bash
#
# cc-weixin 安装脚本
# 自动检测并安装 Node.js，然后安装 cc-weixin
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CC-Weixin 安装脚本 ===${NC}"
echo ""

# 检测操作系统
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *)      echo -e "${RED}不支持的操作系统: $OS${NC}"; exit 1 ;;
esac

case "$ARCH" in
    x86_64|amd64)   ARCH="x64" ;;
    arm64|aarch64)  ARCH="arm64" ;;
    *)              echo -e "${RED}不支持的架构: $ARCH${NC}"; exit 1 ;;
esac

echo "检测到系统: $OS ($ARCH)"

# 检查 Node.js 版本
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1) || NODE_VERSION=0

if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${YELLOW}需要 Node.js >= 22，当前版本: ${NODE_VERSION:-未安装}${NC}"
    echo ""

    # 尝试使用 nvm 安装
    if [ -d "$HOME/.nvm" ]; then
        echo "检测到 nvm，正在安装 Node.js 22..."
        source "$HOME/.nvm/nvm.sh"
        nvm install 22
        nvm use 22
        nvm alias default 22
    elif [ -d "$HOME/.fnm" ]; then
        echo "检测到 fnm，正在安装 Node.js 22..."
        eval "$(fnm env --shell bash)"
        fnm install 22
        fnm use 22
        fnm default 22
    elif command -v brew &> /dev/null && [ "$OS" = "macos" ]; then
        echo "使用 Homebrew 安装 Node.js..."
        brew install node@22 || brew install node
    else
        echo -e "${YELLOW}请手动安装 Node.js >= 22:${NC}"
        echo "  macOS:  brew install node"
        echo "  Linux:  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs"
        echo "  或使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        exit 1
    fi
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm 未找到，请检查 Node.js 安装${NC}"
    exit 1
fi

# 安装 cc-weixin
echo ""
echo "正在安装 cc-weixin..."
npm install -g cc-weixin

echo ""
echo -e "${GREEN}✓ cc-weixin 安装完成！${NC}"
echo ""
echo "使用方法:"
echo "  cc-weixin              # 启动服务（TUI 模式）"
echo "  cc-weixin --login      # 强制重新扫码登录"
echo "  cc-weixin --no-tui     # 纯 CLI 模式"
echo ""
echo "首次使用请设置环境变量:"
echo "  export ANTHROPIC_AUTH_TOKEN=sk-your-api-key"
echo ""
