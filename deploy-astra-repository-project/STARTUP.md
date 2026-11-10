# 星引 ASTRA (Prompt Optimization Studio) — 快速启动指南 / Startup Guide

本文档记录项目在根目录下的完整环境配置与快速启动流程，方便一键拉起开发预览或生产构建服务。

---

## 1. 一键快速启动 (Quick Launch)

在项目根目录下直接执行启动脚本即可自动检测环境、安装缺失依赖并启动服务：

```bash
chmod +x start.sh
./start.sh
```

支持的参数模式：

| 命令 | 说明 | 默认端口 |
| :--- | :--- | :--- |
| `./start.sh` 或 `./start.sh dev` | 启动 Vite 热更新开发服务器（默认模式） | `5173` |
| `./start.sh preview` | 执行生产构建并启动静态预览服务器 | `4173` |
| `./start.sh build` | 仅执行生产环境单文件打包（输出至 `dist/index.html`） | — |
| `./start.sh status` | 检查当前端口监听与服务运行状态 | — |
| `./start.sh proxy` | 仅启动本地 AI 代理 | `8787` |

也可以通过环境变量自定义主机与端口：

```bash
PORT=3000 HOST=0.0.0.0 ./start.sh dev
```

---

## 2. 环境要求与配置 (Environment Setup)

- **Node.js**: 推荐使用 **Node 22**（最低兼容 Node `>= 20.9.0`）
- **包管理器**: `npm >= 10`

如果使用 `nvm` 管理 Node 版本，根目录已内置 `.nvmrc`，可直接执行：

```bash
nvm install 22
nvm use
node -v && npm -v
```

---

## 3. 标准分步启动流程 (Step-by-Step Startup Process)

### 第一步：安装项目依赖
在根目录下执行：

```bash
npm install
```

### 第二步：启动开发环境（端口 5173）
启动带热重载的本地开发服务器并监听所有网络接口：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

启动成功后访问：
- 本地访问：`http://localhost:5173/`

### 第三步：生产环境构建与预览（端口 4173）
如果需要打包生产产物并验证构建结果：

```bash
# 1. 生成生产构建产物 (dist/index.html)
npm run build

# 2. 启动生产预览服务
npm run preview -- --host 0.0.0.0 --port 4173
```

启动成功后访问：
- 生产预览：`http://localhost:4173/`

---

## 4. 项目架构与运行机制说明 (Architecture & Runtime)

本项目代码直接拉取自 `wternum/Astra` (`prompt-optimization-tool-development`) 并放置于根目录：

```text
.
├── index.html               # 应用入口 HTML（含主题初始化脚本）
├── package.json             # 依赖与启动脚本配置
├── vite.config.ts           # Vite + React + Tailwind v4 构建配置（npm run build 使用）
├── vite.config.js           # Vite 优先读取：挂载同源 AI 转发，原 TS 配置保持不变
├── start.sh                 # 一键启动脚本（启动同源转发与备用本地 AI 代理）
├── server/astra-relay.mjs   # 同源 AI 转发（/__astra/forward，解决模型探测 CORS 预检）
├── server/ai-proxy.mjs      # 独立 AI 代理（端口 8787，静态托管时的备用通道）
├── STARTUP.md               # 启动流程说明文档
├── .nvmrc                   # Node 版本配置 (Node 22)
└── src/
    ├── main.tsx             # React 挂载入口（引入全局样式与品牌样式）
    ├── App.tsx              # 应用根组件（注册浏览器端 API 适配器并加载主页面）
    ├── brand.css            # ASTRA 品牌标识样式（Galaxy / Meteor 配色与响应式布局）
    ├── semantic.css         # 单列输入、原位生成进度与结果展示样式
    ├── ai/
    │   ├── client.ts        # AI 客户端：免费 AI / 自定义接口、45 秒排队、代理回退
    │   ├── engine.ts        # 提示词工程：通用（判定 → 构建 → 返修）与 Arena（一次规格调用）
    │   ├── targets.ts       # 目标平台与 Arena 默认决策（技术栈、内容政策、追问）
    │   ├── arena.ts         # Arena 规格：模型消息、清洗、类型默认值、七段渲染、追问
    │   ├── arena-cases.ts   # Arena 规格示例（7 类 × 中英）
    │   ├── arena-quality.ts # Arena 确定性校验与代码补齐
    │   ├── json.ts          # 小模型 JSON 容错解析
    │   ├── blueprint.ts     # 按领域生成五段提示词结构蓝图与官方参考链接
    │   ├── quality.ts       # 8 项确定性工程校验与事实边界补齐
    │   └── cases.ts         # 案例提示词库（按领域选取作为 few-shot 示范）
    ├── lib/
    │   ├── semantic.ts      # 离线本地预判与离线构建（未连接 AI 时的兜底）
    │   └── knowledge.ts     # 知识库条目的规范化、相关性检索与资料块格式
    ├── preview/
    │   └── backend.ts       # 浏览器端 API 适配器（/api/knowledge、/api/optimize 等）
    ├── app/                 # 原仓库页面、全局样式 (globals.css / refinement.css) 与 API 路由
    ├── components/          # 工作台、知识库、历史、手册、模型弹窗等 UI 组件
    ├── lib/                 # 原仓库核心优化引擎 (optimizer.ts) 与模型调用模块 (model.ts)
    └── db/                  # 原仓库 Drizzle PostgreSQL Schema 定义
```

### 运行机制说明
- **零侵入源码保留**：`src/app/`、`src/components/`、`src/lib/`、`src/db/` 均与原仓库保持一致。
- **开箱即用免数据库配置**：`src/preview/backend.ts` 在浏览器端拦截 `/api/*` 请求（`/api/optimize`、`/api/templates`、`/api/history`、`/api/favorites`、`/api/model`、`/api/try`、`/api/health`），直接调用原仓库自带的 `src/lib/optimizer.ts` 引擎并使用 `localStorage` 持久化历史、收藏与自定义模板，无需安装配置 PostgreSQL 即可完整运行所有功能。
- **模型探测转发**：带 `Authorization` 的模型列表请求会触发浏览器 CORS 预检，部分服务商的预检返回 403。Vite 优先读取 `vite.config.js`，`./start.sh dev` / `preview` 及直接运行的 `npm run dev` / `npm run preview` 都会挂载同源 `/__astra/forward`，前端优先经它转发；`/__astra/health` 可用于检查。独立端口 8787 的代理作为备用，但远程 HTTPS 预览应优先使用同源通道。

---

## 5. 常见问题排查 (Troubleshooting)

1. **端口被占用 (`Port 5173 is in use`)**
   - 可指定其他端口启动：`PORT=5174 ./start.sh dev`
   - 或检查并停止已有进程：`pkill -f "vite"`
2. **依赖缺失或模块未找到**
   - 重新执行 `npm install` 确保 `lucide-react`、Tailwind 与 Vite 插件安装完整。
3. **清理本地缓存数据**
   - 在浏览器开发者工具 Console 中执行 `localStorage.clear()` 即可重置本地历史记录、收藏夹与自定义模板。
4. **模型探测失败，但接口本身可用**
   - 多数是服务商不允许浏览器携带 `Authorization` 进行跨域预检。Vite 默认读取 `vite.config.js`，因此 `npm run dev` / `npm run preview` 和 `./start.sh` 都提供同源转发；访问 `http://localhost:5173/__astra/health`（或 `4173`）可检查。
   - 只有纯静态托管且端口 8787 的备用代理也不可用时才没有转发；请改用上述服务，或手动填写模型 ID。
   - 探测返回 401/403 表示转发已成功、但服务商拒绝了 Key，请检查 Key 与 API 地址。
5. **模型可以探测，但「验证并使用」或生成时失败**
   - 已兼容推理型接口常见的 `content: ""` + `reasoning_content`、结构化 content blocks、嵌套模型列表和不同模型 ID 字段；连接测试的 `max_tokens` 从 400 提升到 1200，避免推理 token 占满额度。
   - 若仍提示输出被截断或为空，请换用轻量模型或在服务商侧提高 `max_tokens`；若提示 401/404/429，按服务商返回的状态检查 Key、模型 ID 与额度。
   - 完整链路可用 `node tests/connect-models.mjs` 复测；`SKIP_FREE_AI=1` 可跳过免费通道的排队。

## 6. 连接模型与知识库
- 首次访问不自动连接模型：顶部 Hero 保留「连接模型」入口。用户验证并连接后，Hero 与工作区标题隐藏，输入框直接置顶；刷新页面时会恢复已保存的连接状态，断开后恢复引导卡片。
- 知识库数据保存在浏览器 `localStorage`（`astra:preview:templates:v1`），通过 `/api/knowledge` 管理；`/api/templates` 保留为兼容入口。
- 首次访问会写入 `src/lib/knowledge-seed.ts` 中的 12 条示例知识（可编辑/删除），保证知识网与卡片立即有内容。
- 知识库 UI（`src/components/KnowledgePanel.tsx` + `src/knowledge.css`）包含：分类导航、交互式知识关系网络（`src/components/KnowledgeNetwork.tsx`）、以及每张卡片的「效果预览 / 构建代码」双视图与五色配色卡（`src/lib/knowledge-palette.ts`）。
- 默认显示「我的知识」；用户可新建、编辑、停用、删除、搜索条目，「内置示例」放在独立标签，不会挤占用户知识。
- 启用的条目会按当前输入自动匹配（至少两个不同关键词命中，或标题 / 标签被点名），最多注入 3 条、约 2400 字。通用模式作为独立 `<knowledge_base>` 资料块使用，质量检查会确认引用，缺失时由代码补齐；Arena 模式写成「参考资料」段，且不使用初始示例知识。内置示例和停用条目不参与构建；改写过的示例条目会转为用户知识，不会被后续示例升级覆盖。
- 单元测试：`npm test`（含 Arena、知识库、路由与预览后端）；类型检查：`npm run typecheck`。浏览器脚本 `tests/*.mjs` 需要先启动开发服务器并另行安装 `playwright`。
