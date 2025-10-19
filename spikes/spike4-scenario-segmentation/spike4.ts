import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { jsonrepair } from "jsonrepair";

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;
const modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let extraHeaders: Record<string, string> | undefined;
if (process.env.OPENAI_EXTRA_HEADERS) {
  try {
    extraHeaders = JSON.parse(process.env.OPENAI_EXTRA_HEADERS);
  } catch (error) {
    console.warn("OPENAI_EXTRA_HEADERS 解析失败，已忽略。", error);
  }
}

const client = createOpenAI({
  apiKey,
  baseURL,
  headers: extraHeaders,
});

interface ParsedLine {
  order: number;
  timestamp?: string;
  speaker?: string;
  text: string;
}

// 逐行台词结构，兼容缺失说话人或时间戳的字幕
const DialogueLineSchema = z.object({
  order: z.number().int().min(1),
  timestamp: z.string().min(1).optional(),
  speaker: z.string().min(1).optional().default("Unknown"),
  text: z.string().min(1),
  emotion: z.string().min(1).optional(),
});

const normalizedTextField = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .transform((value) => (Array.isArray(value) ? value.join("；") : value));

const LearningFocusSchema = z.object({
  vocabulary: normalizedTextField,
  grammar: normalizedTextField,
  listening: normalizedTextField,
  culture: normalizedTextField.optional(),
});

const normalizedTasks = z
  .union([z.array(z.string().min(1)).max(3), z.string().min(1)])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .refine((value) => value.length <= 3, {
    message: "follow_up_tasks 不可超过 3 条",
  });

const ScenarioBlockSchema = z
  .object({
    block_index: z.number().int().min(1),
    block_name: z.string().min(1),
    synopsis: z.string().min(1),
    start_line: z.number().int().min(1),
    end_line: z.number().int().min(1),
    context_tags: z.array(z.string().min(1)).min(1).max(5),
    exam_alignment: z.array(z.string().min(1)).min(1).max(4),
    difficulty: z.enum(["入门", "进阶", "冲刺"]),
    learning_focus: LearningFocusSchema,
    dialogues: z.array(DialogueLineSchema).min(1),
    follow_up_tasks: normalizedTasks.optional().default([]),
  })
  .refine((block) => block.start_line <= block.end_line, {
    message: "start_line 必须小于等于 end_line",
    path: ["start_line"],
  })
  .refine(
    (block) =>
      block.dialogues.every(
        (line) => line.order >= block.start_line && line.order <= block.end_line
      ),
    {
      message: "dialogues 中的 order 必须落在 start_line 和 end_line 区间内",
      path: ["dialogues"],
    }
  );

const ScenarioSegmentationSchema = z.object({
  subtitle_title: z.string().min(1),
  segmentation_strategy: z.string().min(1),
  total_blocks: z.number().int().min(1),
  blocks: z.array(ScenarioBlockSchema).min(1),
});

async function main() {
  if (!apiKey) {
    console.error("请先在环境变量中设置 OPENAI_API_KEY。");
    process.exit(1);
  }

  const subtitlePath =
    process.argv[2] ??
    process.env.SUBTITLE_FILE ??
    path.resolve(__dirname, "subtitle.txt");

  const subtitleTitle =
    process.env.SUBTITLE_TITLE ??
    (path.basename(subtitlePath, path.extname(subtitlePath)) || "未命名字幕");

  const parsedLines = loadSubtitleLines(subtitlePath);
  if (parsedLines.length === 0) {
    console.error("字幕文件为空或无法解析有效台词。");
    process.exit(1);
  }

  const formattedTranscript = parsedLines
    .map((line) => {
      const parts: string[] = [];
      if (line.timestamp) {
        parts.push(`[${line.timestamp}]`);
      }
      if (line.speaker && line.speaker !== "Unknown") {
        parts.push(`${line.speaker}:`);
      }
      parts.push(line.text);
      return `${line.order}. ${parts.join(" ").trim()}`;
    })
    .join("\n");

  const prompt = `你是“字幕智析”项目的 AI 情景分块助手，需要将英文字幕拆解为可学习的情景模块，并返回严格的 JSON。
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

字幕标题：${subtitleTitle}
字幕原文（按出现顺序，行号从 1 开始）：
${formattedTranscript}

生成规则：
1. 若字幕缺少时间戳或说话人，可做合理推断或使用占位值（如 "Unknown"）。
2. 保证 block_index 递增且覆盖所有台词，行号不缺失、不重复。
3. 仅输出合法 JSON 字符串，不要包含 Markdown、额外说明或注释。`;

  const response = await generateText({
    model: client.chat(modelName),
    prompt,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitizeJsonText(response.text));
  } catch (error) {
    const repaired = tryRepairJson(response.text);
    if (!repaired) {
      console.error("模型输出不是合法 JSON：", response.text);
      throw error;
    }
    parsed = repaired;
  }

  const result = ScenarioSegmentationSchema.parse(parsed);
  if (result.total_blocks !== result.blocks.length) {
    console.warn(
      `total_blocks (${result.total_blocks}) 与 blocks 数量 (${result.blocks.length}) 不一致，已自动校正。`
    );
    result.total_blocks = result.blocks.length;
  }

  console.log("情景分块结构化结果：");
  console.log(JSON.stringify(result, null, 2));

  if (response.usage) {
    console.log("Token 统计：", response.usage);
  }
}

main().catch((error) => {
  console.error("执行失败：", error);
  process.exit(1);
});

function loadSubtitleLines(filePath: string): ParsedLine[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`读取字幕文件失败：${filePath}`, error);
    process.exit(1);
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, index) => {
    const match =
      line.match(
        /^\s*(?:\[(?<timestamp>[^\]]+)\])?\s*(?:(?<speaker>[^:]+):)?\s*(?<text>.+)$/
      ) ?? undefined;

    const timestamp = match?.groups?.timestamp?.trim();
    const speaker = match?.groups?.speaker?.trim();
    const text = match?.groups?.text?.trim() ?? line;

    return {
      order: index + 1,
      timestamp: timestamp && timestamp.length > 0 ? timestamp : undefined,
      speaker: speaker && speaker.length > 0 ? speaker : undefined,
      text,
    };
  });
}

function sanitizeJsonText(text: string): string {
  let trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/i, "");
    trimmed = trimmed.replace(/```$/, "").trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    trimmed = trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function tryRepairJson(originalText: string): unknown | null {
  const sanitized = sanitizeJsonText(originalText);
  try {
    return JSON.parse(jsonrepair(sanitized));
  } catch {
    return null;
  }
}
