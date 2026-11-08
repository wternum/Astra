import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/lib/model";

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const original = typeof body?.original === "string" ? body.original.trim() : "";
    const optimized = typeof body?.optimized === "string" ? body.optimized.trim() : "";
    if (!original || !optimized) return NextResponse.json({ error: "需要原始提示词和优化版提示词" }, { status: 400 });
    if (original.length > 12000 || optimized.length > 16000) return NextResponse.json({ error: "提示词过长，无法试跑" }, { status: 400 });
    const system = { role: "system" as const, content: "请直接完成用户请求，尽可能给出有用、准确的回答；缺失的关键信息不要编造。" };
    const isPublic = body?.modelConfig?.provider === "pollinations";
    // The public free tier allows only one request per IP and requires a 30s gap.
    // callModel serializes these requests through the same server-side queue.
    const before = await callModel(body?.modelConfig, [system, { role: "user", content: original }]);
    const after = await callModel(body?.modelConfig, [system, { role: "user", content: optimized }]);
    return NextResponse.json({ originalResponse: before.text, optimizedResponse: after.text, model: after.model, sequential: isPublic });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "试跑失败，请稍后再试" }, { status: 500 });
  }
}
