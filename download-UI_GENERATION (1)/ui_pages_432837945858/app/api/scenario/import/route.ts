"use server";

import { NextResponse } from "next/server";
import { z } from "zod";

import { deserializeScenarioSegmentation } from "../../../../server/services/scenario-io";

const ImportSchema = z.object({
  content: z.string().min(1, "需要提供导入的 JSON 内容"),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof ImportSchema>;
  try {
    const body = await request.json();
    payload = ImportSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: "导入请求体解析失败，请检查数据格式。",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  try {
    const scenario = deserializeScenarioSegmentation(payload.content);
    return NextResponse.json(
      {
        scenario,
        importedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "导入情景分块结果失败。",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}
