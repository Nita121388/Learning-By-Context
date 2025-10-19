import { jsonrepair } from "jsonrepair";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import type { ScenarioSegmentation } from "../../schema";

const SubtitleInputSchema = z.object({
  subtitle: z.string().min(1, "字幕内容不能为空"),
  title: z.string().optional(),
});

const DialogueLineSchema = z.object({
  order: z.number().int().min(1),
  speaker: z.string().optional(),
  text: z.string().min(1),
  timestamp: z.string().optional(),
  emotion: z.string().optional(),
});

const normalizedFocusField = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .transform((value) => (Array.isArray(value) ? value.join("；") : value));

const ScenarioBlockSchema = z.object({
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
      vocabulary: normalizedFocusField.optional(),
      grammar: normalizedFocusField.optional(),
      listening: normalizedFocusField.optional(),
      culture: normalizedFocusField.optional(),
    })
    .optional(),
  dialogues: z.array(DialogueLineSchema).min(1),
  follow_up_tasks: z.array(z.string()).optional(),
});

const ScenarioSegmentationSchema = z.object({
  subtitle_title: z.string().min(1),
  segmentation_strategy: z.string().min(1),
  total_blocks: z.number().int().min(1),
  blocks: z.array(ScenarioBlockSchema).min(1),
});

interface ParsedLine {
  order: number;
  speaker?: string;
  text: string;
  timestamp?: string;
}

const openAIClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  headers: parseExtraHeaders(process.env.OPENAI_EXTRA_HEADERS),
});

const defaultModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type SegmentSubtitleInput = z.infer<typeof SubtitleInputSchema>;

export async function segmentSubtitle(
  input: SegmentSubtitleInput
): Promise<ScenarioSegmentation> {
  const payload = SubtitleInputSchema.parse(input);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY 配置，无法执行情景分块。");
  }

  const parsedLines = parseSubtitle(payload.subtitle);
  if (parsedLines.length === 0) {
    throw new Error("未能解析出有效字幕内容，请检查字幕格式。");
  }

  const subtitleTitle =
    payload.title ?? deriveSubtitleTitle(parsedLines) ?? "未命名字幕";

  const formattedTranscript = renderTranscript(parsedLines);
  const prompt = buildSegmentationPrompt(subtitleTitle, formattedTranscript);

  const response = await generateText({
    model: openAIClient.chat(defaultModel),
    prompt,
    temperature: 0.3,
  });

  const parsed = parseModelOutput(response.text);
  const segmentation = ScenarioSegmentationSchema.parse(parsed);

  if (segmentation.total_blocks !== segmentation.blocks.length) {
    return {
      ...segmentation,
      total_blocks: segmentation.blocks.length,
    };
  }

  return segmentation;
}

function parseSubtitle(raw: string): ParsedLine[] {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const parsed: ParsedLine[] = [];
  let pendingTimestamp: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      pendingTimestamp = undefined;
      continue;
    }

    if (/^\d{1,4}$/.test(trimmed)) {
      continue;
    }

    if (trimmed.includes("-->")) {
      pendingTimestamp = trimmed;
      continue;
    }

    const speakerMatch = trimmed.match(
      /^(?<speaker>[\p{L}\p{N} .,'"()\-]{1,40}):\s*(?<text>.+)$/u
    );

    const speaker = speakerMatch?.groups?.speaker?.trim();
    const text = (speakerMatch?.groups?.text ?? trimmed).trim();

    parsed.push({
      order: parsed.length + 1,
      speaker,
      text,
      timestamp: pendingTimestamp,
    });
  }

  return parsed;
}

function deriveSubtitleTitle(lines: ParsedLine[]): string | undefined {
  const firstText = lines.find((item) => item.text.length > 0)?.text;
  if (!firstText) {
    return undefined;
  }
  return firstText.length > 48 ? `${firstText.slice(0, 48)}…` : firstText;
}

function renderTranscript(lines: ParsedLine[]): string {
  return lines
    .map((line) => {
      const segments = [];
      if (line.timestamp) {
        segments.push(`[${line.timestamp}]`);
      }
      if (line.speaker) {
        segments.push(`${line.speaker}:`);
      }
      segments.push(line.text);
      return `${line.order}. ${segments.join(" ").trim()}`;
    })
    .join("\n");
}

function buildSegmentationPrompt(
  title: string,
  formattedTranscript: string
): string {
  return `你是“字幕智析”项目的 AI 情景分块助手，需要将英文字幕拆解为可学习的情景模块，并返回严格的 JSON。
字段说明：
- subtitle_title: 字符串，保留原字幕标题。
- segmentation_strategy: 字符串，用 1-2 句中文说明划分依据。
- total_blocks: 数字，等于情景模块数量。
- blocks: 情景模块数组，每个元素包含：
  - block_index: 数字，从 1 开始递增。
  - block_name: 中文标题，凸显场景主题。
  - synopsis: 中文概述，描述场景核心事件。
  - start_line / end_line: 数字，对应下方字幕行号（从 1 开始）。
  - context_tags: 1-5 个中文语境标签，例如“社区规划”“公共政策”。
  - exam_alignment: 1-4 个中文描述，指明与 CET/IELTS/TOEFL/考研的关联训练角度。
  - difficulty: 只能取“入门”“进阶”“冲刺”之一。
  - learning_focus: 对象，包含 vocabulary / grammar / listening / culture（culture 可缺省，其余必填）。
  - dialogues: 台词数组，字段说明：
    * order: 必填，字幕行号。
    * timestamp: 若原文含时间戳请保留，缺省可省略。
    * speaker: 若原文缺失，请输出 "Unknown"。
    * text: 必填，字幕原文。
    * emotion: 可选，描述语气或情绪。
  - follow_up_tasks: 1-3 条中文建议，指导后续学习或练习。

字幕标题：${title}
字幕原文（按出现顺序，行号从 1 开始）：
${formattedTranscript}

生成规则：
1. 若字幕缺少时间戳或说话人，可做合理推断或使用占位值（如 "Unknown"）。
2. 保证 block_index 递增且覆盖所有台词，行号不缺失、不重复。
3. 仅输出合法 JSON 字符串，不要包含 Markdown、额外说明或注释。`;
}

function parseModelOutput(text: string): unknown {
  const sanitized = sanitizeJsonBlock(text);
  try {
    return JSON.parse(sanitized);
  } catch {
    return JSON.parse(jsonrepair(sanitized));
  }
}

function sanitizeJsonBlock(text: string): string {
  let trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/i, "");
    trimmed = trimmed.replace(/```$/, "").trim();
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1) {
    return trimmed;
  }
  return trimmed.slice(first, last + 1);
}

function parseExtraHeaders(headersRaw?: string | null) {
  if (!headersRaw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(headersRaw);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}
