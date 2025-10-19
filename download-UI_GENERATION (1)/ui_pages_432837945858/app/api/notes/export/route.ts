import { NextResponse } from "next/server";
import { z } from "zod";

import { exportNotesMarkdown } from "../../../../server/services/notes";
import type { NoteItem, ScenarioSegmentation } from "../../../../schema";

const ExportRequestSchema = z.object({
  scenario: z.custom<ScenarioSegmentation>(),
  analyses: z.record(z.number().int().min(1), z.string()),
  notes: z.array(
    z.object({
      id: z.string(),
      block_index: z.number().int().min(1),
      order: z.number().int().min(1),
      title: z.string(),
      content: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
  ),
  template: z.union([z.literal("standard"), z.literal("concise")]).optional(),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof ExportRequestSchema>;
  try {
    const body = await request.json();
    payload = ExportRequestSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      {
        error: "导出请求体解析失败，请检查数据格式。",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }

  try {
    const markdown = exportNotesMarkdown({
      scenario: payload.scenario,
      analyses: payload.analyses,
      notes: payload.notes,
      template: payload.template,
    });
    return NextResponse.json({ markdown }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "导出 Markdown 失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
