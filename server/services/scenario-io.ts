import { z } from "zod";

import type { ScenarioSegmentation } from "../../schema";

const DialogueLineSchema = z.object({
  order: z.number().int().min(1),
  speaker: z.string().optional(),
  text: z.string().min(1),
  emotion: z.string().optional(),
  timestamp: z.string().optional(),
});

const LearningFocusSchema = z
  .object({
    vocabulary: z.string().optional(),
    grammar: z.string().optional(),
    listening: z.string().optional(),
    culture: z.string().optional(),
  })
  .partial()
  .refine(
    (value) =>
      Object.values(value).some(
        (entry) => typeof entry === "string" && entry.trim().length > 0
      ),
    {
      message: "learning_focus 至少需要包含一个非空字段",
      path: [],
    }
  )
  .optional();

const ScenarioBlockSchema = z.object({
  block_index: z.number().int().min(1),
  block_name: z.string().min(1),
  synopsis: z.string().min(1),
  start_line: z.number().int().min(1),
  end_line: z.number().int().min(1),
  context_tags: z.array(z.string()).optional(),
  exam_alignment: z.array(z.string()).optional(),
  difficulty: z.string().optional(),
  learning_focus: LearningFocusSchema,
  dialogues: z.array(DialogueLineSchema).min(1),
  follow_up_tasks: z.array(z.string()).optional(),
});

export const ScenarioSegmentationSchema = z.object({
  subtitle_title: z.string().min(1),
  segmentation_strategy: z.string().min(1),
  total_blocks: z.number().int().min(1),
  blocks: z.array(ScenarioBlockSchema).min(1),
});

export function normalizeScenarioSegmentation(
  scenario: ScenarioSegmentation
): ScenarioSegmentation {
  const blocks = [...scenario.blocks]
    .sort((a, b) => a.block_index - b.block_index)
    .map((block) => {
      const dialogues = [...block.dialogues]
        .filter((line) => line.text.trim().length > 0)
        .sort((a, b) => a.order - b.order)
        .map((line) => ({
          order: line.order,
          speaker: line.speaker,
          text: line.text,
          emotion: line.emotion,
          timestamp: line.timestamp,
        }));

      const nextBlock: typeof block = {
        block_index: block.block_index,
        block_name: block.block_name,
        synopsis: block.synopsis,
        start_line: block.start_line,
        end_line: block.end_line,
        dialogues,
      };

      if (block.context_tags?.length) {
        nextBlock.context_tags = [...block.context_tags];
      }
      if (block.exam_alignment?.length) {
        nextBlock.exam_alignment = [...block.exam_alignment];
      }
      if (block.difficulty?.trim().length) {
        nextBlock.difficulty = block.difficulty;
      }
      if (block.learning_focus) {
        const focusEntries = Object.entries(block.learning_focus).filter(
          ([, value]) => typeof value === "string" && value.trim().length > 0
        );
        if (focusEntries.length) {
          nextBlock.learning_focus = Object.fromEntries(focusEntries) as ScenarioSegmentation["blocks"][number]["learning_focus"];
        }
      }
      if (block.follow_up_tasks?.length) {
        nextBlock.follow_up_tasks = [...block.follow_up_tasks];
      }

      return nextBlock;
    });

  return {
    subtitle_title: scenario.subtitle_title,
    segmentation_strategy: scenario.segmentation_strategy,
    total_blocks: blocks.length,
    blocks,
  };
}

export function parseScenarioSegmentation(
  raw: unknown
): ScenarioSegmentation {
  const parsed = ScenarioSegmentationSchema.parse(raw);
  return normalizeScenarioSegmentation(parsed as ScenarioSegmentation);
}

export function safeParseScenarioSegmentation(
  raw: unknown
): ScenarioSegmentation | undefined {
  const parsed = ScenarioSegmentationSchema.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  return normalizeScenarioSegmentation(parsed.data as ScenarioSegmentation);
}

export function serializeScenarioSegmentation(
  scenario: ScenarioSegmentation,
  pretty = true
): string {
  const normalized = normalizeScenarioSegmentation(scenario);
  return JSON.stringify(normalized, null, pretty ? 2 : undefined);
}

export function deserializeScenarioSegmentation(json: string): ScenarioSegmentation {
  const parsed = JSON.parse(json);
  return parseScenarioSegmentation(parsed);
}
