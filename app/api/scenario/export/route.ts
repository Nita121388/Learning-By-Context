import { NextResponse } from "next/server";
import { z } from "zod";

import {
  normalizeScenarioSegmentation,
  serializeScenarioSegmentation,
} from "../../../../server/services/scenario-io";
import type { ScenarioSegmentation } from "../../../../schema";

const ExportSchema = z.object({
  scenario: z.custom<ScenarioSegmentation>(),
  pretty: z.boolean().optional(),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof ExportSchema>;
  try {
    const body = await request.json();
    payload = ExportSchema.parse(body);
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
    const snapshot = normalizeScenarioSegmentation(payload.scenario);
    const content = serializeScenarioSegmentation(snapshot, payload.pretty ?? true);
    const filename =
      (snapshot.subtitle_title || "scenario-segmentation")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-_]/g, "")
        .toLowerCase() + `-${Date.now()}.json`;

    return NextResponse.json(
      {
        scenario: snapshot,
        content,
        filename,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "导出情景分块结果失败。",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
