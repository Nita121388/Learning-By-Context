import { NextResponse } from "next/server";
import { z } from "zod";

import {
  analyzeScenarioBlocks,
  type ScenarioAnalysisInput,
} from "../../../../server/services/scenario-analysis";

export const runtime = "nodejs";

const RequestSchema: z.ZodType<ScenarioAnalysisInput> = z.lazy(() =>
  z.object({
    subtitle_title: z.string().min(1),
    blocks: z.array(
      z.object({
        block_index: z.number().int().min(1),
        block_name: z.string().min(1),
        synopsis: z.string().min(1),
        start_line: z.number().int().min(1),
        end_line: z.number().int().min(1),
        context_tags: z.array(z.string()).optional(),
        exam_alignment: z.array(z.string()).optional(),
        difficulty: z.string().optional(),
        learning_focus: z
          .object({
            vocabulary: z.string().optional(),
            grammar: z.string().optional(),
            listening: z.string().optional(),
            culture: z.string().optional(),
          })
          .optional(),
        dialogues: z
          .array(
            z.object({
              order: z.number().int().min(1),
              speaker: z.string().optional(),
              text: z.string().min(1),
              emotion: z.string().optional(),
              timestamp: z.string().optional(),
            })
          )
          .min(1),
        follow_up_tasks: z.array(z.string()).optional(),
      })
    ),
    block_indexes: z.array(z.number().int().min(1)).optional(),
    config: z
      .object({
        model: z.string().min(1).optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().min(256).max(8192).optional(),
        cacheTTL: z.number().int().min(5).max(720).optional(),
        examTargets: z.array(z.string().min(1)).min(1).optional(),
      })
      .optional(),
  })
);

export async function POST(request: Request) {
  let parsedBody: ScenarioAnalysisInput;

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
    const result = await analyzeScenarioBlocks(parsedBody);
    return NextResponse.json({ blocks: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "情景学习分析失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
