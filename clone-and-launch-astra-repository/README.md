# 星引 ASTRA · 提示词优化工作台

把想法打磨成更清晰的提示词。支持实时诊断、本地结构化优化、AI 模型接入、知识库辅助构建与版本迭代。

> **品牌标识交互**：左上角流星徽标默认呈现粒子汇聚的 V 形；鼠标悬停（或移动端轻触）时整个星群会倒转 180°，随后粒子从星核向外散射；点击可触发一次流星爆发与冲击波光环，移开后自动重新汇聚。采用 Galaxy × Meteor 配色，并适配浅色 / 深色主题与 `prefers-reduced-motion`。

## AI 工作流程（需求判定 → 结构蓝图 → 生成 → 校验）

1. **AI 判定需求**：一句话即可。AI 识别具体领域、真实目标、受众、交付物、原文事实与约束，并先定义可检查的成功标准；过程在输入框下方原位显示，不需要阅读侧边分析卡。
2. **生成结构蓝图**：系统按任务类型选择专业步骤和验收项，组成「目标与交付 → 原始需求与已知信息 → 执行步骤 → 输出契约 → 质量检查」五段结构。结构是骨架，任务内容由 AI 生成，不是固定话术。
3. **AI 编译提示词**：参考同领域案例进行 few-shot 校准，原文独立保留；缺失信息采用明确标注的默认假设，不让执行模型停下来等待回答。
4. **工程校验与返修**：对原文、约束、结构、输出契约、可执行性和事实边界做确定性检查，关键项失败自动返修。优化后的提示词直接出现在输入框下方；校验详情折叠收纳，分数不代表最终回答一定优秀。

完整设计依据与官方参考链接见 [`PROMPT_ENGINEERING.md`](./PROMPT_ENGINEERING.md)。

连接模型后，工作台不再显示顶部引导卡片，输入框直接置顶；断开模型后恢复引导。快捷操作中的入口、侧边导航与页面标题统一改为「知识库」。

**知识库**：可新建、编辑、停用、删除和搜索知识条目（品牌事实、写作规范、项目约定等）。生成提示词时，系统按当前输入自动筛选已启用的相关条目，把内容作为独立 `<knowledge_base>` 资料块交给 AI；内置示例提示词不会作为事实注入。输入框下方可一键开关「知识库参与构建」，结果区会显示本次引用了哪些知识。

建站请求另有自适应设计技能：从用户原话判断页面类型、视觉重点与关键交互，把 [Recent](https://recent.design/websites) 的用途分类、[Refero Styles](https://styles.refero.design/design-md/design-md-template) 的视觉规则和 [Scrolltide](https://www.scrolltide.co/academy/build-an-animated-website-from-one-prompt) 的动效说明转成可执行的设计决策，而不是照搬任一网站。输入「I want to make a beautiful website」即可试用；更具体的品牌、用途、风格或技术栈会覆盖暂定的设计假设。

### 支持的 AI 通道
| 通道 | 说明 |
| :--- | :--- |
| 免费 AI（Pollinations · GPT-OSS 20B） | 无需注册。官方限制：同一 IP 每 45 秒 1 次回复，ASTRA 自动排队并显示倒计时。点击「让 AI 判定需求」或直接「AI 判定并优化」。 |
| 自定义接口 | 任意 OpenAI 兼容地址 + Key + 模型（如 DeepSeek / OpenAI / 自建服务），可「探测可用模型」。点击优化时自动判定需求并构建提示词。Key 仅保存在当前标签页会话中。 |

> 免费通道会拒绝 `localhost` 来源；部分自定义接口的 CORS 预检也会拒绝带 `Authorization` 的探测请求。Vite 会优先读取 `vite.config.js`，因此 `./start.sh dev`、`./start.sh preview` 以及直接运行的 `npm run dev` / `npm run preview` 都会挂载同源转发（`/__astra/forward`），并保留端口 8787 的独立代理作为备用。模型探测优先走同源转发，无需暴露额外端口，也不会受 HTTPS 混合内容限制。只有纯静态托管且 8787 也不可用时才需要手动填写模型 ID。

---

## 快速启动流程 (Quick Startup Process)

### 方式一：一键脚本启动（推荐）
在项目根目录直接运行 `./start.sh`：

```bash
chmod +x start.sh
./start.sh          # 启动开发服务器 (http://localhost:5173)
```

其他常用命令：
```bash
./start.sh preview  # 构建并启动生产预览服务 (http://localhost:4173)
./start.sh build    # 仅执行生产构建 (生成 dist/index.html)
./start.sh status   # 检查本地端口与服务状态
```

### 方式二：标准 npm 命令启动

1. **环境准备**：推荐 Node 22（兼容 Node `>= 20.9`），如使用 `nvm` 可执行 `nvm use`
2. **安装依赖**：
   ```bash
   npm install
   ```
3. **启动开发服务**：
   ```bash
   npm run dev -- --host 0.0.0.0 --port 5173
   ```
4. **生产构建与预览**：
   ```bash
   npm run build
   npm run preview -- --host 0.0.0.0 --port 4173
   ```

详细说明、目录结构与常见问题排查请参阅根目录下的 [`STARTUP.md`](./STARTUP.md)。
