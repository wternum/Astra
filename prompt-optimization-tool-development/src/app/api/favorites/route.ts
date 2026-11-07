import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { favorites } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(favorites)
      .orderBy(desc(favorites.createdAt))
      .limit(200);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("获取收藏失败:", e);
    return NextResponse.json({ error: "获取收藏失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, prompt, category, note } = body;
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "提示词不能为空" }, { status: 400 });
    }
    const [row] = await db
      .insert(favorites)
      .values({
        title: title?.trim() || "未命名提示词",
        prompt,
        category: category || "通用",
        note: note || "",
      })
      .returning();
    return NextResponse.json(row);
  } catch (e) {
    console.error("收藏失败:", e);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    await db.delete(favorites).where(eq(favorites.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除收藏失败:", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
