import "dotenv/config";

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

const DialogueSchema = z.object({
  order: z.number().int().min(1),
  speaker: z.string().optional(),
  text: z.string(),
  emotion: z.string().optional(),
  timestamp: z.string().optional(),
});

const BlockSchema = z.object({
  block_index: z.number().int().min(1),
  block_name: z.string(),
  synopsis: z.string(),
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
  dialogues: z.array(DialogueSchema),
  follow_up_tasks: z.array(z.string()).optional(),
});

const ScenarioSchema = z.object({
  subtitle_title: z.string(),
  segmentation_strategy: z.string(),
  total_blocks: z.number().int().min(1),
  blocks: z.array(BlockSchema).min(1),
});

const defaultScenarioPath = path.resolve(
  __dirname,
  "../spike4-scenario-segmentation/scenario.txt"
);

const promptTemplatePath = path.resolve(
  __dirname,
  "../spike4-scenario-segmentation/prompt.txt"
);

interface AnalysisResult {
  block_index: number;
  block_name: string;
  synopsis: string;
  markdown: string;
}

async function main() {
  if (!apiKey) {
    console.error("请先在环境变量中设置 OPENAI_API_KEY。");
    process.exit(1);
  }

  const scenarioPath =
    process.argv[2] ?? process.env.SCENARIO_FILE ?? defaultScenarioPath;
  const outputDir =
    process.env.SPIKE5_OUTPUT_DIR ??
    path.resolve(__dirname, "./analysis-output");

  const promptTemplate = readPromptTemplate();
  const scenario = loadScenario(scenarioPath);

  const analyses: AnalysisResult[] = [];

  for (const block of scenario.blocks) {
    console.log(
      `正在分析情景模块 #${block.block_index} - ${block.block_name}...`
    );
    const prompt = buildPrompt(promptTemplate, scenario.subtitle_title, block);
    const markdown = await callModel(prompt);
    analyses.push({
      block_index: block.block_index,
      block_name: block.block_name,
      synopsis: block.synopsis,
      markdown,
    });
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  analyses.forEach((analysis) => {
    const fileName = `block-${analysis.block_index
      .toString()
      .padStart(2, "0")}-${slugify(analysis.block_name)}.md`;
    const filePath = path.join(outputDir, fileName);
    writeFileSync(
      filePath,
      `# 情景模块分析：${analysis.block_name}\n\n` +
        `> 概要：${analysis.synopsis}\n\n` +
        analysis.markdown,
      "utf-8"
    );
  });

  console.log("\n情景模块教学分析已完成，输出路径：", outputDir);
  analyses.forEach((analysis) => {
    console.log(
      `- 模块 #${analysis.block_index}：${analysis.block_name} -> ${slugify(
        analysis.block_name
      )}.md`
    );
  });
}

function readPromptTemplate(): string {
  try {
    return readFileSync(promptTemplatePath, "utf-8").trim();
  } catch (error) {
    console.error("读取 prompt 模板失败：", promptTemplatePath, error);
    process.exit(1);
  }
}

function loadScenario(filePath: string) {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error("读取情景分块文件失败：", filePath, error);
    process.exit(1);
  }

  const sanitized = sanitizeJsonBlock(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(sanitized));
    } catch (error) {
      console.error("解析情景分块 JSON 失败：", error);
      process.exit(1);
    }
  }

  if (Array.isArray(parsed)) {
    const candidate = parsed.find(
      (item) =>
        item &&
        typeof item === "object" &&
        "subtitle_title" in item &&
        "blocks" in item
    );
    if (!candidate) {
      console.error("情景分块文件未找到有效的场景对象。");
      process.exit(1);
    }
    parsed = candidate;
  }

  return ScenarioSchema.parse(parsed);
}

function sanitizeJsonBlock(text: string): string {
  const trimmed = text.trim();
  const firstIndex = trimmed.indexOf("{");
  const lastIndex = trimmed.lastIndexOf("}");
  if (firstIndex === -1 || lastIndex === -1) {
    return trimmed;
  }
  return trimmed.slice(firstIndex, lastIndex + 1);
}

function buildPrompt(
  promptTemplate: string,
  subtitleTitle: string,
  block: z.infer<typeof BlockSchema>
): string {
  const dialogues = block.dialogues
    .map((line) => {
      const speaker = line.speaker && line.speaker.length > 0
        ? line.speaker
        : "Unknown";
      const timestamp = line.timestamp ? `[${line.timestamp}] ` : "";
      const emotion = line.emotion ? ` （情绪：${line.emotion}）` : "";
      return `${line.order}. ${timestamp}${speaker}: ${line.text}${emotion}`;
    })
    .join("\n");

  const contextSections = [
    `字幕标题：${subtitleTitle}`,
    `情景模块编号：${block.block_index}`,
    `情景模块标题：${block.block_name}`,
    `情景概要：${block.synopsis}`,
    `字幕行号范围：${block.start_line}-${block.end_line}`,
    `语境标签：${(block.context_tags ?? []).join("，") || "无"}`,
    `考试导向：${(block.exam_alignment ?? []).join("，") || "未指定"}`,
    `难度系数：${block.difficulty ?? "未指定"}`,
    `学习聚焦提示：${
      block.learning_focus
        ? [
            `词汇：${block.learning_focus.vocabulary ?? "未提供"}`,
            `语法：${block.learning_focus.grammar ?? "未提供"}`,
            `听力：${block.learning_focus.listening ?? "未提供"}`,
            `文化：${block.learning_focus.culture ?? "未提供"}`,
          ].join("； ")
        : "未提供"
    }`,
    `建议的后续任务：${
      (block.follow_up_tasks ?? []).length > 0
        ? block.follow_up_tasks?.join("； ")
        : "暂无，请适度补充"
    }`,
    "字幕台词：",
    dialogues,
  ].join("\n");

  return `${promptTemplate}

---
# Context
${contextSections}

---
请严格按照模板结构完成教学分析，所有模块标题按顺序输出，并在关键知识点后用中文快速总结难点。若原数据缺少任务或学习提示，请合理补充。`;
}

async function callModel(prompt: string): Promise<string> {
  const response = await generateText({
    model: client.chat(modelName),
    prompt,
    temperature: 0.2,
  });
  return response.text.trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

main().catch((error) => {
  console.error("执行失败：", error);
  process.exit(1);
});
