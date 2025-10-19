"use server";

import { NextResponse } from "next/server";
import { z } from "zod";

import { importNotesMarkdown } from "../../../../server/services/notes";

const ImportRequestSchema = z.object({
  markdown: z.string().min(1, "需要提供导入的 Markdown 内容"),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof ImportRequestSchema>;
  try {
    const body = await request.json();
    payload = ImportRequestSchema.parse(body);
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
    const result = importNotesMarkdown(payload.markdown);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "导入 Markdown 失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
