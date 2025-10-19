import { NextResponse } from "next/server";
import { z } from "zod";

import { segmentSubtitle } from "../../../../server/services/subtitle-segmentation";

export const runtime = "nodejs";

const RequestSchema = z.object({
  subtitle: z.string().min(1, "字幕内容不能为空"),
  title: z.string().optional(),
});

export async function POST(request: Request) {
  let parsedBody: z.infer<typeof RequestSchema>;

  try {
    const body = await request.json();
    parsedBody = RequestSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: "请求体解析失败，请确认 JSON 格式和必填字段。",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  try {
    const result = await segmentSubtitle(parsedBody);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "情景分块失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
