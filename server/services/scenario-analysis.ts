import { readFileSync } from "node:fs";
import path from "node:path";

import { jsonrepair } from "jsonrepair";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import type { AnalysisModules, ScenarioBlock } from "../../schema";

const normalizedFocusField = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .transform((value) => (Array.isArray(value) ? value.join("，") : value));

const AnalysisRequestSchema = z.object({
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
          vocabulary: normalizedFocusField.optional(),
          grammar: normalizedFocusField.optional(),
          listening: normalizedFocusField.optional(),
          culture: normalizedFocusField.optional(),
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
});

export type ScenarioAnalysisInput = z.infer<typeof AnalysisRequestSchema>;

const ExampleSchema = z
  .object({
    sentence: z.string().min(1),
    translation: z.string().optional().default(""),
  })
  .strict();

const VocabularyCoreSchema = z
  .object({
    term: z.string().min(1),
    phonetic: z.string().optional().default(""),
    part_of_speech: z.string().optional().default(""),
    meaning_cn: z.string().optional().default(""),
    meaning_en: z.string().optional().default(""),
    exam_tags: z.array(z.string()).optional().default([]),
    subtitle_example: ExampleSchema.optional(),
    exam_example: ExampleSchema.optional(),
    notes: z.string().optional().default(""),
  })
  .strict();

const VocabularyPhraseSchema = z
  .object({
    phrase: z.string().min(1),
    meaning_cn: z.string().optional().default(""),
    meaning_en: z.string().optional().default(""),
    exam_tags: z.array(z.string()).optional().default([]),
    example: ExampleSchema.optional(),
    usage_tip: z.string().optional().default(""),
  })
  .strict();

const VocabularyExtensionSchema = z
  .object({
    term: z.string().min(1),
    meaning_cn: z.string().optional().default(""),
    usage_tip: z.string().optional().default(""),
  })
  .strict();

const GrammarPointSchema = z
  .object({
    title: z.string().min(1),
    explanation: z.string().optional().default(""),
    structure: z.string().optional().default(""),
    examples: z.array(ExampleSchema).optional().default([]),
    exam_focus: z.string().optional().default(""),
  })
  .strict();

const PronunciationEntrySchema = z
  .object({
    term: z.string().min(1),
    ipa: z.string().optional().default(""),
    stress: z.string().optional().default(""),
    tip: z.string().optional().default(""),
  })
  .strict();

const ConnectedSpeechSchema = z
  .object({
    phenomenon: z.string().min(1),
    example: z.string().optional().default(""),
    explanation: z.string().optional().default(""),
  })
  .strict();

const SlangSchema = z
  .object({
    expression: z.string().min(1),
    meaning: z.string().optional().default(""),
    usage: z.string().optional().default(""),
    exam_warning: z.string().optional().default(""),
  })
  .strict();

const ComprehensionCheckSchema = z
  .object({
    question: z.string().min(1),
    answer: z.string().optional().default(""),
    explanation: z.string().optional().default(""),
  })
  .strict();

const RewritingTaskSchema = z
  .object({
    instruction: z.string().min(1),
    reference: z.string().optional().default(""),
    target_words: z.array(z.string()).optional().default([]),
  })
  .strict();

const VocabularyModuleSchema = z
  .object({
    focus_exams: z.array(z.string()).optional().default([]),
    core: z.array(VocabularyCoreSchema).optional().default([]),
    phrases: z.array(VocabularyPhraseSchema).optional().default([]),
    extension: z.array(VocabularyExtensionSchema).optional().default([]),
  })
  .strict();

const GrammarModuleSchema = z
  .object({
    sentence_breakdown: z.array(z.string()).optional().default([]),
    grammar_points: z.array(GrammarPointSchema).optional().default([]),
    application: z.array(z.string()).optional().default([]),
  })
  .strict();

const ListeningModuleSchema = z
  .object({
    keyword_pronunciations: z.array(PronunciationEntrySchema).optional().default([]),
    connected_speech: z.array(ConnectedSpeechSchema).optional().default([]),
    listening_strategies: z.array(z.string()).optional().default([]),
  })
  .strict();

const CultureModuleSchema = z
  .object({
    slang_or_register: z.array(SlangSchema).optional().default([]),
    cultural_notes: z.array(z.string()).optional().default([]),
    pragmatic_functions: z.array(z.string()).optional().default([]),
  })
  .strict();

const PracticeModuleSchema = z
  .object({
    comprehension_checks: z.array(ComprehensionCheckSchema).optional().default([]),
    rewriting_tasks: z.array(RewritingTaskSchema).optional().default([]),
    speaking_prompts: z.array(z.string()).optional().default([]),
  })
  .strict();

const ModulesSchema = z
  .object({
    vocabulary: VocabularyModuleSchema,
    grammar: GrammarModuleSchema,
    listening_pronunciation: ListeningModuleSchema,
    culture_context: CultureModuleSchema,
    practice: PracticeModuleSchema,
  })
  .strict();

const ModelAnalysisSchema = z
  .object({
    block_index: z.number().int().optional(),
    block_name: z.string().optional(),
    modules: ModulesSchema,
    summary_markdown: z.string().optional().default(""),
  })
  .strict();

export interface ScenarioAnalysisResult {
  block_index: number;
  block_name: string;
  structured: AnalysisModules;
  markdown: string;
}

const promptTemplatePath = path.resolve(
  process.cwd(),
  "server",
  "prompts",
  "scenario-analysis.md"
);

let cachedPromptTemplate: string | null = null;

const openAIClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  headers: parseExtraHeaders(process.env.OPENAI_EXTRA_HEADERS),
});

const defaultModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

interface CacheEntry {
  result: ScenarioAnalysisResult;
  expiresAt: number;
}

const ANALYSIS_CACHE = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

export async function analyzeScenarioBlocks(
  input: ScenarioAnalysisInput
): Promise<ScenarioAnalysisResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY 配置，无法执行学习分析。");
  }

  const payload = AnalysisRequestSchema.parse(input);
  const examTargets = payload.config?.examTargets?.length
    ? payload.config.examTargets
    : ["CET-4", "CET-6", "IELTS", "TOEFL"];
  const promptTemplate = readPromptTemplate();

  const config = payload.config ?? {};
  const model = config.model ?? defaultModel;
  const temperature = config.temperature ?? 0.2;
  const maxTokens = config.maxTokens ?? 2048;
  const cacheTTLMinutes = config.cacheTTL ?? 60;
  const cacheTTL = Math.max(cacheTTLMinutes, 5) * 60 * 1000;

  const targetBlocks = selectBlocks(payload.blocks, payload.block_indexes);
  const results: ScenarioAnalysisResult[] = [];

  for (const block of targetBlocks) {
    const cacheKey = hashBlock(
      payload.subtitle_title,
      block,
      model,
      temperature,
      maxTokens,
      examTargets
    );
    const cached = ANALYSIS_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      results.push(cached.result);
      continue;
    }

    const prompt = buildPrompt(promptTemplate, payload.subtitle_title, block, examTargets);
    const response = await generateText({
      model: openAIClient.chat(model),
      prompt,
      temperature,
      ...(maxTokens ? { maxTokens } : {}),
    });

    const analysis = parseModelAnalysis(response.text, block, examTargets);
    ANALYSIS_CACHE.set(cacheKey, {
      result: analysis,
      expiresAt: Date.now() + cacheTTL,
    });

    results.push(analysis);
  }

  return results;
}

function readPromptTemplate(): string {
  if (cachedPromptTemplate) {
    return cachedPromptTemplate;
  }
  try {
    const data = readFileSync(promptTemplatePath, "utf-8");
    cachedPromptTemplate = data.trim();
    return cachedPromptTemplate;
  } catch (error) {
    throw new Error(`读取教学分析模板失败：${String(error)}`);
  }
}

function selectBlocks(
  blocks: ScenarioBlock[],
  blockIndexes?: number[]
): ScenarioBlock[] {
  if (!blockIndexes || blockIndexes.length === 0) {
    return blocks;
  }
  const indexSet = new Set(blockIndexes);
  const filtered = blocks.filter((block) => indexSet.has(block.block_index));
  if (filtered.length === 0) {
    throw new Error("未找到指定的情景模块，请检查 block_indexes 参数。");
  }
  return filtered;
}

function buildPrompt(
  template: string,
  subtitleTitle: string,
  block: ScenarioBlock,
  examTargets: string[]
): string {
  const exams = examTargets.length ? examTargets.join("、") : "CET-4、CET-6、IELTS、TOEFL";
  const promptWithTargets = template.replace("{{exam_targets}}", exams);

  const contextSections = [
    `字幕标题：${subtitleTitle}`,
    `情景模块编号：${block.block_index}`,
    `情景模块标题：${block.block_name}`,
    `情景概要：${block.synopsis}`,
    `字幕行号范围：${block.start_line}-${block.end_line}`,
    `语境标签：${(block.context_tags ?? []).join("、") || "未提供"}`,
    `考试导向：${(block.exam_alignment ?? []).join("、") || "未指定"}`,
    `难度系数：${block.difficulty ?? "未指定"}`,
    `学习聚焦：${
      block.learning_focus
        ? [
            `词汇：${block.learning_focus.vocabulary ?? "未提供"}`,
            `语法：${block.learning_focus.grammar ?? "未提供"}`,
            `听力：${block.learning_focus.listening ?? "未提供"}`,
            `文化：${block.learning_focus.culture ?? "未提供"}`,
          ].join("；")
        : "未提供"
    }`,
    "字幕台词：",
    block.dialogues
      .map((line) => {
        const timestamp = line.timestamp ? `[${line.timestamp}] ` : "";
        const speaker =
          line.speaker && line.speaker.length > 0 ? line.speaker : "Unknown";
        const emotion = line.emotion ? `（情绪：${line.emotion}）` : "";
        return `${line.order}. ${timestamp}${speaker}: ${line.text}${emotion}`;
      })
      .join("\n"),
  ].join("\n");

  return `${promptWithTargets}

---
# Context
${contextSections}

---
请按照约定输出 JSON。`;
}

function parseModelAnalysis(
  rawText: string,
  block: ScenarioBlock,
  examTargets: string[]
): ScenarioAnalysisResult {
  const jsonPayload = extractJson(rawText);
  const parsed = ModelAnalysisSchema.safeParse(jsonPayload);
  if (!parsed.success) {
    throw new Error(`模型返回内容无法解析：${parsed.error.message}`);
  }

  const modules = parsed.data.modules;
  const markdown =
    parsed.data.summary_markdown?.trim().length
      ? parsed.data.summary_markdown.trim()
      : renderFallbackMarkdown(block, modules, examTargets);

  return {
    block_index: parsed.data.block_index ?? block.block_index,
    block_name: parsed.data.block_name ?? block.block_name,
    structured: modules,
    markdown,
  };
}

function extractJson(raw: string): unknown {
  let trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("模型返回为空，无法解析学习分析。");
  }
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```[a-zA-Z]*\s*/i, "").replace(/```$/, "").trim();
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(jsonrepair(trimmed));
    } catch (error) {
      throw new Error(`模型返回的 JSON 无法解析：${String(error)}`);
    }
  }
}

function renderFallbackMarkdown(
  block: ScenarioBlock,
  modules: AnalysisModules,
  examTargets: string[]
): string {
  const lines: string[] = [];
  lines.push(`# 情景学习分析概览 · ${block.block_name}`);
  lines.push("");
  lines.push(`> 适配考试：${examTargets.join("、")}`);
  lines.push("");

  lines.push("## Module 1 · 词汇与短语");
  if (modules.vocabulary.core.length) {
    lines.push("### 核心考试词汇");
    modules.vocabulary.core.forEach((item) => {
      lines.push(
        `- **${item.term}** ${item.phonetic ? `/${item.phonetic}/` : ""} · ${item.meaning_cn || item.meaning_en || "解释缺失"}`
      );
      if (item.exam_tags?.length) {
        lines.push(`  - 考试标签：${item.exam_tags.join(" / ")}`);
      }
      if (item.subtitle_example) {
        lines.push(`  - 字幕例句：${item.subtitle_example.sentence}`);
      }
      if (item.exam_example) {
        lines.push(`  - 考试例句：${item.exam_example.sentence}`);
      }
    });
  }
  if (modules.vocabulary.phrases.length) {
    lines.push("");
    lines.push("### 高频短语");
    modules.vocabulary.phrases.forEach((phrase) => {
      lines.push(
        `- **${phrase.phrase}** · ${phrase.meaning_cn || phrase.meaning_en || "释义缺失"}`
      );
      if (phrase.example) {
        lines.push(`  - 例句：${phrase.example.sentence}`);
      }
      if (phrase.usage_tip) {
        lines.push(`  - 用法提示：${phrase.usage_tip}`);
      }
    });
  }

  lines.push("");
  lines.push("## Module 2 · 语法与句型");
  if (modules.grammar.sentence_breakdown.length) {
    lines.push("### 句子结构拆解");
    modules.grammar.sentence_breakdown.forEach((item) => lines.push(`- ${item}`));
  }
  if (modules.grammar.grammar_points.length) {
    lines.push("");
    lines.push("### 重点语法");
    modules.grammar.grammar_points.forEach((point) => {
      lines.push(`- **${point.title}**：${point.explanation}`);
      if (point.structure) {
        lines.push(`  - 结构：${point.structure}`);
      }
    });
  }

  lines.push("");
  lines.push("## Module 3 · 听力与发音");
  if (modules.listening_pronunciation.keyword_pronunciations.length) {
    lines.push("### 核心词汇发音");
    modules.listening_pronunciation.keyword_pronunciations.forEach((entry) => {
      lines.push(`- ${entry.term} ${entry.ipa ? `/${entry.ipa}/` : ""} ${entry.tip ?? ""}`);
    });
  }

  lines.push("");
  lines.push("## Module 4 · 文化与语境");
  if (modules.culture_context.slang_or_register.length) {
    lines.push("### 俚语与语域");
    modules.culture_context.slang_or_register.forEach((item) => {
      lines.push(`- **${item.expression}**：${item.meaning}`);
      if (item.exam_warning) {
        lines.push(`  - 考试提醒：${item.exam_warning}`);
      }
    });
  }

  lines.push("");
  lines.push("## Module 5 · 应试实践");
  if (modules.practice.comprehension_checks.length) {
    lines.push("### 理解检核");
    modules.practice.comprehension_checks.forEach((question, index) => {
      lines.push(`- Q${index + 1}：${question.question}`);
      if (question.answer) {
        lines.push(`  - 答案：${question.answer}`);
      }
    });
  }
  if (modules.practice.speaking_prompts.length) {
    lines.push("");
    lines.push("### 口语拓展");
    modules.practice.speaking_prompts.forEach((prompt) => lines.push(`- ${prompt}`));
  }

  return lines.join("\n").trim();
}

function parseExtraHeaders(raw?: string | null) {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function hashBlock(
  title: string,
  block: ScenarioBlock,
  model: string,
  temperature: number,
  maxTokens: number,
  examTargets: string[]
): string {
  const payload = JSON.stringify({
    title,
    model,
    temperature,
    maxTokens,
    examTargets,
    block_index: block.block_index,
    block_name: block.block_name,
    synopsis: block.synopsis,
    dialogues: block.dialogues.map((d) => ({
      order: d.order,
      speaker: d.speaker,
      text: d.text,
      emotion: d.emotion,
      timestamp: d.timestamp,
    })),
    learning_focus: block.learning_focus,
  });
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    const charCode = payload.charCodeAt(i);
    hash = (hash << 5) - hash + charCode;
    hash |= 0;
  }
  return `${hash}`;
}
