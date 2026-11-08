import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const url = process.env.ASTRA_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await mkdir("artifacts", { recursive: true });
const search = async text => { await page.getByRole("combobox", { name: "搜索知识" }).fill(text); await page.getByRole("option").first().click(); };
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("astra:preview:templates:v1") || "[]"));
const waitNodes = count => page.waitForFunction(expected => document.querySelectorAll(".react-flow__node").length === expected, count, { timeout: 15000 });
try {
  await page.goto(url); await page.getByRole("button", { name: "知识库", exact: true }).click();
  await page.locator(".kg-flow-library").first().waitFor(); await page.waitForTimeout(700);

  // 中心图谱：四个大知识库
  await waitNodes(4);
  assert.equal(await page.locator(".kg-flow-library").count(), 4);
  assert.equal(await page.locator(".kg-hub-list button").count(), 4);
  await page.screenshot({ path: "artifacts/knowledge-hub.png", fullPage: true });

  // 点击「前端」进入子库：星座轨道 + 星座核
  await page.locator(".kg-flow-library", { hasText: "前端" }).click();
  await page.locator(".kg-flow-core").waitFor();
  assert.equal(await page.locator(".kg-orbit-decor").count(), 1);
  assert.equal(await page.locator(".react-flow__node").count(), 4); // 星座核 + 开发类目 + 2 条知识
  assert.ok((await page.locator(".kg-library-current").innerText()).includes("前端"));
  await page.screenshot({ path: "artifacts/knowledge-sublibrary.png", fullPage: true });

  // 点击星座核返回中心图谱
  await page.locator(".kg-flow-core").click();
  await waitNodes(4);
  assert.equal(await page.locator(".kg-flow-library").count(), 4);

  // 查看全部知识 → 12 条条目
  await page.getByRole("button", { name: /查看全部知识/ }).click();
  await waitNodes(12);

  await page.locator(".react-flow__node").first().focus(); await page.keyboard.press("Enter");
  await page.locator(".react-flow__edge").first().dispatchEvent("click");
  await page.locator(".kg-inspector").getByText("关系详情", { exact: true }).waitFor();
  await page.locator(".kg-inspector").getByRole("button", { name: "关闭关系详情" }).click();
  await page.locator(".react-flow__node").first().click();
  await page.mouse.move(0, 0); await page.waitForTimeout(450);
  await page.screenshot({ path: "artifacts/knowledge-desktop.png", fullPage: true });

  // 新建知识（默认按分类 → 中心知识域）
  await page.getByRole("button", { name: "新建知识", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/知识标题/).fill("测试知识·交互验证");
  await dialog.getByLabel(/知识内容/).fill("这是交互测试的参考内容。所有按钮和来源均应可追溯。");
  await dialog.getByLabel("添加关键词").fill("交互"); await dialog.getByLabel("添加关键词").press("Enter");
  await dialog.getByLabel(/来源链接/).fill("https://example.com/spec");
  await dialog.getByLabel("关联知识").selectOption("101"); await dialog.getByRole("button", { name: "添加关系", exact: true }).click();
  await dialog.getByRole("button", { name: "保存知识", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  let rows = await stored(); const first = rows.find(row => row.name === "测试知识·交互验证");
  assert.ok(first); assert.equal(first.sourceUrl, "https://example.com/spec"); assert.deepEqual(first.relations, [{ targetId: 101, kind: "references" }]);
  assert.ok((await page.locator(".kg-library-current").innerText()).includes("中心"), "保存后应跳到该知识所在的知识域");

  await page.reload(); await page.getByRole("button", { name: "知识库", exact: true }).click();
  await page.locator(".kg-flow-library").first().waitFor();
  await search("测试知识·交互验证");
  await page.locator(".kg-inspector").getByRole("heading", { name: "测试知识·交互验证" }).waitFor();
  await page.getByRole("button", { name: "聚焦关联知识", exact: true }).click();
  await page.locator(".kg-focus-banner").waitFor();
  await page.getByRole("button", { name: /返回全图/ }).click();
  await search("测试知识·交互验证");
  await page.getByRole("button", { name: "新建知识", exact: true }).click(); dialog = page.getByRole("dialog");
  await dialog.getByLabel(/知识标题/).fill("测试知识·引用方"); await dialog.getByLabel(/知识内容/).fill("引用另一条测试知识。");
  await dialog.getByLabel("关联知识").selectOption(String(first.id)); await dialog.getByRole("button", { name: "添加关系", exact: true }).click();
  await dialog.getByRole("button", { name: "保存知识", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
  await search("测试知识·交互验证"); await page.getByRole("button", { name: "删除当前知识", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认删除", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  rows = await stored(); assert.ok(!rows.some(row => row.id === first.id));
  assert.ok(rows.find(row => row.name === "测试知识·引用方").relations.every(relation => relation.targetId !== first.id));

  // 切换到「创作」子库（6 条），再按分类筛选
  await page.locator(".kg-library-chips button", { hasText: "创作" }).click();
  await waitNodes(6 + 4 + 1); // 核 + 4 类目 + 6 条目
  assert.ok((await page.locator(".kg-library-current").innerText()).includes("创作"));
  await page.getByRole("combobox", { name: "筛选知识分类" }).selectOption("品牌");
  await waitNodes(1 + 1 + 2); // 核 + 品牌类目 + 2 条
  await page.getByRole("combobox", { name: "搜索知识" }).fill("");
  await page.getByRole("combobox", { name: "筛选知识分类" }).selectOption("全部");
  await waitNodes(11);

  await page.getByRole("button", { name: "卡片", exact: true }).click();
  assert.ok(await page.locator(".kg-knowledge-card").count() > 0);
  await page.locator(".kg-card-title").first().click(); await page.getByRole("dialog").getByRole("tab", { name: "原文", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "关闭弹窗" }).click();
  await page.getByRole("button", { name: "图谱", exact: true }).click();
  await page.getByRole("button", { name: "分类结构", exact: true }).click();
  assert.ok(await page.locator(".kg-flow-category").count() > 0);
  await page.getByRole("button", { name: "关联网络", exact: true }).click();
  await page.getByRole("checkbox", { name: "显示共享关键词" }).check();
  await page.locator(".kg-flow-topic").first().waitFor();
  assert.ok(await page.locator(".kg-flow-topic").count() > 0);
  await page.getByRole("checkbox", { name: "显示共享关键词" }).uncheck();
  await page.getByRole("button", { name: "切换为暗色模式" }).click(); await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/knowledge-dark.png", fullPage: true });
  await page.getByRole("button", { name: "切换为白色模式" }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
  await page.screenshot({ path: "artifacts/knowledge-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const mobileZoom = parseInt(await page.locator(".kg-canvas-controls > span").innerText(), 10);
  assert.ok(mobileZoom >= 70, `mobile graph should stay readable, got ${mobileZoom}%`);
  await page.getByRole("button", { name: "新建知识", exact: true }).click();
  await page.getByRole("dialog").getByLabel(/知识标题/).fill("手机编辑测试");
  await page.screenshot({ path: "artifacts/knowledge-mobile-editor.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: hub, sub-library orbit, back navigation, all-view, relations, persistence, focus, delete cleanup, filters, cards, layouts, topics, dark mode, mobile; no browser errors.");
} finally { await browser.close(); }
