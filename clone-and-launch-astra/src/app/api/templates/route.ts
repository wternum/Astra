import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { BUILTIN_TEMPLATES, inferScenario } from "@/lib/optimizer";

export async function GET() {
  try {
    const custom = await db.select().from(templates).where(eq(templates.isBuiltin, false)).orderBy(desc(templates.createdAt));
    return NextResponse.json([
      ...BUILTIN_TEMPLATES,
      ...custom.map(item => ({ ...item, scenario: inferScenario(item.templateText).id, accent: "violet" })),
    ]);
  } catch {
    return NextResponse.json(BUILTIN_TEMPLATES);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
    const category = typeof body?.category === "string" ? body.category.trim().slice(0, 30) : "通用";
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 240) : "";
    const templateText = typeof body?.templateText === "string" ? body.templateText.trim() : "";
    if (!name || !templateText || templateText.length > 10000) {
      return NextResponse.json({ error: "请填写模板名称和不超过 10000 字的内容" }, { status: 400 });
    }
    const [saved] = await db.insert(templates).values({ name, category: category || "通用", description, templateText, isBuiltin: false }).returning();
    return NextResponse.json({ ...saved, scenario: inferScenario(saved.templateText).id, accent: "violet" });
  } catch {
    return NextResponse.json({ error: "保存模板失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "内置模板不可删除" }, { status: 400 });
    await db.delete(templates).where(and(eq(templates.id, id), eq(templates.isBuiltin, false)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
