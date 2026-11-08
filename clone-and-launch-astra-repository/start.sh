#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# 星引 ASTRA · 提示词优化工作台 — 一键启动脚本 (Quick Launch Script)
# 用法 / Usage:
#   ./start.sh            # 启动开发服务器 (默认端口 5173)
#   ./start.sh dev        # 启动开发服务器 (默认端口 5173)
#   ./start.sh preview    # 构建并启动生产预览服务器 (默认端口 4173)
#   ./start.sh build      # 仅执行生产构建 (输出 dist/index.html)
#   ./start.sh status     # 查看当前端口与服务运行状态
#   ./start.sh proxy      # 仅启动本地 AI 代理 (端口 8787)
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-dev}"
HOST="${HOST:-0.0.0.0}"

# 尝试加载 nvm 并切换到推荐的 Node 版本（如果存在 nvm）
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -f ".nvmrc" ]; then
    nvm use --silent || true
  fi
fi

echo "============================================================"
echo "  星引 ASTRA · 提示词优化工作台 (Startup Launcher)"
echo "============================================================"
echo "  目录 (Root) : $ROOT_DIR"
echo "  Node 版本   : $(node -v 2>/dev/null || echo '未安装')"
echo "  npm 版本    : $(npm -v 2>/dev/null || echo '未安装')"
echo "============================================================"

ensure_deps() {
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/lucide-react" ]; then
    echo "[1/2] 正在安装项目依赖 (npm install)..."
    npm install
  else
    echo "[1/2] 依赖已就绪 (node_modules 已存在)"
  fi
}

start_proxy() {
  # Local AI relay: needed when the free tier rejects localhost origins or a custom API lacks CORS.
  if curl -s -o /dev/null -m 1 http://127.0.0.1:${AI_PROXY_PORT:-8787}/health; then
    echo "[AI] 本地 AI 代理已在运行 (:${AI_PROXY_PORT:-8787})"
  else
    nohup node server/ai-proxy.mjs > /tmp/astra-ai-proxy.log 2>&1 &
    echo "[AI] 已启动本地 AI 代理 -> http://127.0.0.1:${AI_PROXY_PORT:-8787}"
  fi
}

case "$MODE" in
  proxy)
    exec node server/ai-proxy.mjs
    ;;
  dev)
    PORT="${PORT:-5173}"
    ensure_deps
    start_proxy
    echo "[2/2] 正在启动开发服务器（含同源 AI 转发） -> http://${HOST}:${PORT}"
    exec npm run dev -- --host "$HOST" --port "$PORT"
    ;;
  preview)
    PORT="${PORT:-4173}"
    ensure_deps
    echo "[2/3] 正在执行生产环境打包 (npm run build)..."
    npm run build
    start_proxy
    echo "[3/3] 正在启动生产预览服务器（含同源 AI 转发） -> http://${HOST}:${PORT}"
    exec npm run preview -- --host "$HOST" --port "$PORT"
    ;;
  build)
    ensure_deps
    echo "[2/2] 正在执行生产环境打包 (npm run build)..."
    npm run build
    echo "构建完成：产物位于 dist/index.html"
    ;;
  status)
    echo "正在检查本地服务状态..."
    if curl -s -o /dev/null http://localhost:5173/; then
      echo "  Dev Server (5173)     : 运行中 (http://localhost:5173)"
    else
      echo "  Dev Server (5173)     : 未运行"
    fi
    if curl -s -o /dev/null http://localhost:4173/; then
      echo "  Preview Server (4173) : 运行中 (http://localhost:4173)"
    else
      echo "  Preview Server (4173) : 未运行"
    fi
    if curl -s -o /dev/null -m 1 http://127.0.0.1:8787/health; then
      echo "  AI Proxy       (8787) : 运行中"
    else
      echo "  AI Proxy       (8787) : 未运行"
    fi
    if curl -s -m 2 http://localhost:5173/__astra/health | grep -q same-origin; then
      echo "  同源转发 (Dev)        : 运行中"
    fi
    if curl -s -m 2 http://localhost:4173/__astra/health | grep -q same-origin; then
      echo "  同源转发 (Preview)    : 运行中"
    fi
    ;;
  *)
    echo "未知模式: $MODE"
    echo "可用命令: ./start.sh [dev|preview|build|status]"
    exit 1
    ;;
esac
