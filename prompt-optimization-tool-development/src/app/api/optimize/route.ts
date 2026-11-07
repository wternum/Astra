import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { promptHistory } from "@/db/schema";
import { callModel } from "@/lib/model";
import {
  analyzePrompt,
  analyzeBrief,
  buildLocalPrompt,
  normalizeOptions,
  resolveScenario,
  type OptimizeResult,
} from "@/lib/optimizer";

export const maxDuration = 120;

const SYSTEM_INSTRUCTION = `你是一名严谨而有创造力的提示词架构师。你的工作是重写用户的提示词，而不是执行用户的任务。
目标：在不改变原始意图的前提下，让指令更准确、可执行、有上下文，并能帮助模型充分运用其正常可用的能力。
规则：
1. 阅读原始任务、补充背景和用户的每项设置，再重组提示词。不要只添加固定套话；用与实际任务紧密相关的要求替代空泛描述。
2. 保留所有原始约束与事实，绝不捏造品牌、受众、数据或参考示例；缺少关键事实时，用简洁的澄清或假设规则处理。
3. 优先清晰、实用、信息密度。不要无限拉长提示词；精简模式应该真正更短，深入模式才展开。
4. 可以要求模型检验事实、考虑替代方案和边界情况，但不要要求输出内部的完整思维链。不要许诺绕过模型自身的安全限制。
5. 如果提供了上一版和修改反馈，要基于上一版做实质修改，而不是简单把反馈追加到末尾。
6. 只返回一个合法 JSON 对象，不要使用 Markdown 代码围栏。结构为 {"optimized":"可直接复制使用的完整提示词","changes":["相对原文的具体改动1","改动2","改动3"],"rationale":"一两句话说明本次优化取舍"}。optimized 不要包含虚构的示例或【待填写】占位符。`;

function parseModelResult(text: string): { optimized: string; changes: string[]; rationale: string } {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let parsed: unknown = null;
  try { parsed = JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch { /* Model returned plain text. */ }
    }
  }
  if (parsed && typeof parsed === "object" && typeof (parsed as { optimized?: unknown }).optimized === "string") {
    const data = parsed as { optimized: string; changes?: unknown; rationale?: unknown };
    const optimized = data.optimized.trim();
    if (optimized.length < 12) throw new Error("模型生成的提示词过短，请重试");
    return {
      optimized,
      changes: Array.isArray(data.changes) ? data.changes.flatMap(x => typeof x === "string" ? x.split(/\n+/) : []).map(x => x.trim().replace(/^\d+[.、]\s*/, "").replace(/[；;]$/, "")).filter(Boolean).slice(0, 6) : ["由模型结合任务语义重新组织指令"],
      rationale: typeof data.rationale === "string" ? data.rationale.slice(0, 500) : "已根据任务与工作台设置重写提示词。",
    };
  }
  if (cleaned.length < 12) throw new Error("模型未能生成可用的提示词，请重试");
  return { optimized: cleaned, changes: ["由模型结合任务语义重新组织指令"], rationale: "模型返回了纯文本优化稿，可在工作台中继续编辑。" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "请先输入想要优化的提示词" }, { status: 400 });
    if (prompt.length > 12000) return NextResponse.json({ error: "提示词不能超过 12000 字" }, { status: 400 });
    const options = normalizeOptions(body?.options);
    const mode = body?.mode === "ai" ? "ai" : "local";
    const feedback = typeof body?.feedback === "string" ? body.feedback.trim().slice(0, 600) : "";
    const previousPrompt = typeof body?.previousPrompt === "string" ? body.previousPrompt.trim().slice(0, 16000) : "";
    const scenario = resolveScenario(prompt, options.scenario);
    let result: OptimizeResult;

    if (mode === "ai") {
      const startingDraft = buildLocalPrompt(prompt, options, feedback);
      const context = {
        originalPrompt: prompt,
        taskType: scenario.label,
        settings: options,
        revisionFeedback: feedback || undefined,
        previousVersion: previousPrompt || undefined,
        referenceDraft: previousPrompt ? undefined : startingDraft.optimized,
      };
      const response = await callModel(body?.modelConfig, [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `请根据以下资料生成优化后的提示词。只输出 JSON 对象：\n${JSON.stringify(context)}` },
      ]);
      const generated = parseModelResult(response.text);
      result = {
        optimized: generated.optimized,
        before: analyzeBrief(prompt, options),
        after: analyzePrompt(generated.optimized),
        changes: generated.changes,
        rationale: generated.rationale,
        engine: "ai",
        model: response.model,
        createdAt: new Date().toISOString(),
      };
    } else {
      result = buildLocalPrompt(prompt, options, feedback);
    }

    try {
      const [saved] = await db.insert(promptHistory).values({
        originalPrompt: prompt,
        optimizedPrompt: result.optimized,
        scenario: scenario.id,
        settings: {
          options,
          engine: result.engine,
          model: result.model || null,
          feedback: feedback || null,
          parentHistoryId: Number.isInteger(body?.parentHistoryId) ? body.parentHistoryId : null,
        },
        scoreBefore: result.before.score,
        scoreAfter: result.after.score,
        analysis: { before: result.before, after: result.after, changes: result.changes, rationale: result.rationale },
      }).returning({ id: promptHistory.id });
      result.historyId = saved.id;
    } catch (error) {
      console.error("无法保存优化历史:", error);
      // The optimizer remains useful even if history storage is temporarily unavailable.
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "优化失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
