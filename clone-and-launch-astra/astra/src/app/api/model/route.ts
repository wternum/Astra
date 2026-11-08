import { NextRequest, NextResponse } from "next/server";
import { callModel, discoverModels, freeModelCatalog, providerStatus, publicQueueStatus } from "@/lib/model";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("catalog") === "openrouter") {
    return NextResponse.json(await freeModelCatalog());
  }
  return NextResponse.json({ providers: providerStatus(), publicQueue: publicQueueStatus() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === "discover") return NextResponse.json(await discoverModels(body?.modelConfig));
    const response = await callModel(body?.modelConfig, [
      { role: "system", content: "这是一条连接测试。请只回复两个汉字：可用。" },
      { role: "user", content: "测试连接" },
    ]);
    return NextResponse.json({ connected: true, model: response.model, publicQueue: publicQueueStatus() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "连接测试失败" }, { status: 400 });
  }
}
