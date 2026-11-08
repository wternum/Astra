import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { promptHistory } from "@/db/schema";
import { analyzePrompt } from "@/lib/optimizer";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(promptHistory).orderBy(desc(promptHistory.createdAt)).limit(200);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "暂时无法读取历史记录" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    const optimized = typeof body?.optimized === "string" ? body.optimized.trim() : "";
    if (!Number.isInteger(id) || id < 1 || !optimized || optimized.length > 16000) {
      return NextResponse.json({ error: "请提供有效的记录和不超过 16000 字的提示词" }, { status: 400 });
    }
    const [existing] = await db.select().from(promptHistory).where(eq(promptHistory.id, id));
    if (!existing) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    const after = analyzePrompt(optimized);
    const oldAnalysis = (existing.analysis && typeof existing.analysis === "object" ? existing.analysis : {}) as Record<string, unknown>;
    const [updated] = await db.update(promptHistory).set({
      optimizedPrompt: optimized,
      scoreAfter: after.score,
      analysis: { ...oldAnalysis, after, rationale: "用户已在工作台中手动修订此版本。" },
    }).where(eq(promptHistory.id, id)).returning();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "保存修订失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("all") === "1") {
      await db.delete(promptHistory);
      return NextResponse.json({ success: true });
    }
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "无效的记录 ID" }, { status: 400 });
    await db.delete(promptHistory).where(eq(promptHistory.id, id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
