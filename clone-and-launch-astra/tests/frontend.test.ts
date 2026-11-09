import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frontendKind, isDesignOnlyRequest, isFrontendRequest } from "../src/ai/frontend";
import { localAnalysis, normalizeAnalysis } from "../src/ai/engine";
import { createBlueprint, blueprintContext } from "../src/ai/blueprint";
import { pickCases, PROMPT_CASES } from "../src/ai/cases";
import { enforceGrounding, evaluatePrompt } from "../src/ai/quality";

describe("frontend request routing", () => {
  const examples = [
    ["I want to make a beautiful website", "site"],
    ["给摄影师做一个安静的作品集，重点展示人像和风景照片", "portfolio"],
    ["为我的手作陶瓷店做一个温暖的网店，能筛选产品和加入购物车", "storefront"],
    ["Build a landing page for an analytics SaaS", "landing"],
    ["Design a dashboard for customer support", "product-ui"],
    ["帮我优化现有网站的布局和导航", "redesign"],
    ["做一个可访问的筛选组件", "component"],
  ] as const;
  for (const [text, kind] of examples) {
    it(`routes ${text}`, () => {
      assert.equal(isFrontendRequest(text), true);
      assert.equal(frontendKind(text), kind);
    });
  }
  for (const text of [
    "写一篇关于网站设计的文章",
    "帮我分析网站访问量为什么下降",
    "Write an article about website design",
    "写个脚本批量改照片名，重名的别覆盖",
  ]) {
    it(`does not mistake ${text} for a website build`, () => {
      assert.equal(isFrontendRequest(text), false);
    });
  }
  it("does not mistake a cafe brochure site for an online store", () => {
    assert.equal(frontendKind("给咖啡店做个官网"), "landing");
  });
  it("allows an explicitly requested design brief without forcing a code deliverable", () => {
    const text = "写一份网站设计规范，包含字体、颜色和网格";
    assert.equal(isFrontendRequest(text), true);
    assert.equal(isDesignOnlyRequest(text), true);
  });
});

describe("adaptive design brief", () => {
  it("keeps unspecified product facts open for a one-line website request", () => {
    const text = "I want to make a beautiful website";
    const analysis = localAnalysis(text);
    assert.equal(analysis.category, "coding");
    assert.equal(analysis.frontend?.kind, "site");
    assert.equal(analysis.frontend?.source, "guided");
    assert.ok(analysis.frontend?.openDecisions.some(item => item.includes("No brand or subject supplied")));
    assert.ok(!JSON.stringify(analysis.frontend).includes("这是一家真实的"));
    assert.equal(pickCases(analysis.category, text, 1)[0].id, "web-open-english");
  });
  it("prioritizes explicit shop features and stack without imposing another theme", () => {
    const text = "用 React 做一个手作陶瓷网店，能筛选商品和加入购物车，不要滚动动画";
    const analysis = localAnalysis(text);
    const brief = analysis.frontend!;
    assert.equal(brief.kind, "storefront");
    assert.ok(brief.explicitSignals.some(item => item.includes("React")));
    assert.ok(brief.explicitSignals.some(item => item.includes("购物车") || item.includes("筛选")));
    assert.ok(!brief.openDecisions.some(item => item.includes("未指定技术栈")));
    assert.equal(pickCases(analysis.category, text, 1)[0].id, "web-shop");
    assert.notEqual(pickCases(analysis.category, text, 1)[0].id, "photo-rename");
  });
  it("uses model-proposed decisions but keeps them labelled as suggestions", () => {
    const text = "给摄影师做一个安静的作品集";
    const raw = {
      category: "general",
      domain: "摄影师作品集网站",
      frontendDesign: {
        visualDirection: "画册式的安静影像陈列",
        typography: "克制的展示衬线字与易读的正文字体",
        colorRoles: "画布米白、正文深墨、行动色极少",
      },
    };
    const analysis = normalizeAnalysis(raw, text);
    assert.equal(analysis.frontend?.kind, "portfolio");
    assert.equal(analysis.frontend?.source, "ai");
    assert.equal(analysis.frontend?.visualDirection, "画册式的安静影像陈列");
    assert.equal(analysis.frontend?.typography, raw.frontendDesign.typography);
    assert.equal(pickCases(analysis.category, text, 1)[0].id, "web-photography");
  });
  it("uses the frontend blueprint even if the model classifies a landing page as marketing", () => {
    const text = "给我的咖啡品牌做一个官网，能预约到店";
    const analysis = normalizeAnalysis({ category: "marketing", domain: "咖啡品牌营销网站" }, text);
    assert.equal(analysis.category, "coding");
    assert.equal(analysis.frontend?.kind, "landing");
    assert.ok(createBlueprint(analysis).steps.some(step => step.includes("构图")));
  });
  it("does not inject a marketing hero into a dashboard brief", () => {
    const analysis = localAnalysis("做一个给运营看的数据分析后台，支持日期筛选与空状态");
    const blueprint = createBlueprint(analysis);
    assert.equal(analysis.frontend?.kind, "product-ui");
    assert.ok(blueprint.steps.join(" ").includes("工作区") || blueprint.steps.join(" ").includes("页面"));
    assert.ok(!analysis.frontend?.composition.includes("满幅"));
    assert.ok(blueprintContext(analysis, blueprint, analysis.text).frontendBrief);
  });
});

describe("examples and prompt validation", () => {
  it("does not send a photo script as a website few-shot example", () => {
    assert.ok(pickCases("coding", "帮我做一个优美的网页", 2).every(item => item.webKind));
    assert.equal(pickCases("coding", "写个脚本批量改照片名", 1)[0].id, "photo-rename");
    assert.equal(pickCases("coding", "Create a warm online shop for my ceramics with product filters and a working cart", 1)[0].id, "web-store-english");
    assert.equal(pickCases("coding", "Build an operations dashboard with date filters and useful empty states", 1)[0].id, "web-dashboard-english");
  });
  it("validates Chinese website prompts against actual instructions, not the quoted input", () => {
    const example = PROMPT_CASES.find(item => item.id === "web-shop")!;
    const analysis = localAnalysis(example.input);
    const checked = evaluatePrompt(example.optimized, example.input, analysis);
    assert.equal(checked.checks.find(item => item.id === "source")?.passed, true);
    assert.ok(checked.checks.some(item => item.id === "frontend-direction"));
    assert.ok(checked.checks.some(item => item.id === "frontend-delivery"));
  });
  it("catches a constraint copied only inside the user-request tag", () => {
    const input = "做一个可运行的网店，购物车别丢数据";
    const analysis = localAnalysis(input);
    analysis.constraints = ["购物车别丢数据"];
    const prompt = `## 目标与交付\n构建网店。\n## 原始需求与已知信息\n<user_request>${input}</user_request>\n## 执行步骤\n实现网站。\n## 输出契约\n交付可运行代码及文件。\n## 质量检查\n检查代码；不要编造数据。`;
    assert.equal(evaluatePrompt(prompt, input, analysis).checks.find(item => item.id === "constraints")?.passed, false);
  });
  it("requires an explicitly requested stack outside the quoted request", () => {
    const input = "用 React 做一个可筛选商品的网店";
    const example = PROMPT_CASES.find(item => item.id === "web-shop")!;
    const draft = example.optimized.replace(example.input, input);
    const check = evaluatePrompt(draft, input, localAnalysis(input)).checks.find(item => item.id === "frontend-user");
    assert.equal(check?.passed, false);
    assert.match(check?.detail || "", /React/);
  });
  it("accepts English headings and enforces grounding in English", () => {
    const example = PROMPT_CASES.find(item => item.id === "web-open-english")!;
    const analysis = localAnalysis(example.input);
    const quality = evaluatePrompt(example.optimized, example.input, analysis);
    assert.equal(quality.checks.find(item => item.id === "structure")?.passed, true);
    assert.equal(quality.checks.find(item => item.id === "grounding")?.passed, true);
    assert.equal(enforceGrounding(example.optimized), example.optimized);
  });
  it("rejects an implementation request answered only with a design specification", () => {
    const example = PROMPT_CASES.find(item => item.id === "web-open-english")!;
    const analysis = localAnalysis(example.input);
    const specOnly = example.optimized
      .replace("Build a distinctive, working website rather than a mockup.", "Create a design specification and mockup outline for a website.")
      .replace("Ship a working page in the existing project stack", "Ship a design specification in the existing project stack");
    assert.equal(evaluatePrompt(specOnly, example.input, analysis).checks.find(item => item.id === "frontend-build")?.passed, false);
  });
  it("recognizes a fully functional website and ready-to-deploy HTML/CSS/JS as code delivery", () => {
    const example = PROMPT_CASES.find(item => item.id === "web-open-english")!;
    const analysis = localAnalysis(example.input);
    const working = example.optimized
      .replace("Build a distinctive, working website rather than a mockup.", "Create a fully functional, visually elegant single-page website. Deliver ready-to-deploy HTML, CSS and JavaScript files.");
    assert.equal(evaluatePrompt(working, example.input, analysis).checks.find(item => item.id === "frontend-build")?.passed, true);
  });
});