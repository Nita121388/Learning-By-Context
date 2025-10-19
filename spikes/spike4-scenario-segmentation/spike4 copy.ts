import "dotenv/config";

import { z } from "zod";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

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

// 逐行对话结构，用于记录角色与台词
const DialogueLineSchema = z.object({
  order: z.number().int().min(1),
  speaker: z.string().min(1),
  text: z.string().min(1),
  emotion: z.string().min(1).optional(),
});

// 学习聚焦点，提示后续知识点生成方向
const LearningFocusSchema = z.object({
  vocabulary: z.string().min(1),
  grammar: z.string().min(1),
  listening: z.string().min(1),
  culture: z.string().min(1).optional(),
});

// 情景分块结构化约束
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
    follow_up_tasks: z.array(z.string().min(1)).min(1).max(3),
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

const ScenarioSegmentationSchema = z
  .object({
    subtitle_title: z.string().min(1),
    segmentation_strategy: z.string().min(1),
    total_blocks: z.number().int().min(1),
    blocks: z.array(ScenarioBlockSchema).min(1),
  })
  .superRefine((result, ctx) => {
    if (result.total_blocks !== result.blocks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "total_blocks 必须与 blocks 数量一致",
        path: ["total_blocks"],
      });
    }
  });

async function main() {
  if (!apiKey) {
    console.error("请先在环境变量中设置 OPENAI_API_KEY。");
    process.exit(1);
  }

  const subtitleTitle = "City Talk Show - Opening Monologue";
  const subtitle = [
    "[00:00:01] Host: Welcome back to City Talk, where we unpack the stories behind the skyline.",
    "[00:00:05] Guest: Thanks for inviting me, it’s an honor to represent the community council tonight.",
    "[00:00:10] Host: Everyone is buzzing about the riverfront redevelopment; what milestones should residents know?",
    "[00:00:16] Guest: The first phase opens next month with a public arts walk and new study spaces for students.",
    "[00:00:22] Host: That sounds ambitious—how are you addressing concerns about rising rents in nearby blocks?",
    "[00:00:28] Guest: We’re launching rent consultation clinics, plus scholarships to help long-term residents stay rooted.",
  ].join("\n");

  const prompt = `你是“字幕智析”项目的AI情景分块助手，需要将英文字幕拆解为可学习的情景模块，并给出结构化JSON。
字段要求如下：
- subtitle_title: 字符串，保留原字幕标题。
- segmentation_strategy: 字符串，用1-2句中文说明如何划分场景。
- total_blocks: 数字，等于情景模块数量。
- blocks: 情景模块数组，每个模块包含：
  - block_index: 数字，从1开始递增。
  - block_name: 中文标题，突出场景主题。
  - synopsis: 中文概述，说明场景发生的关键事件。
  - start_line / end_line: 数字，对应下面字幕原文的行号（从1开始）。
  - context_tags: 1-5个中文标签，概括场景语境（如“社区规划”“公共政策”）。
  - exam_alignment: 1-4个中文描述，提示与CET/IELTS/TOEFL/考研相关的训练角度。
  - difficulty: 只能取“入门”“进阶”“冲刺”之一。
  - learning_focus: 对象，包含 vocabulary / grammar / listening / culture 字段，全部中文描述（culture 可缺省）。
  - dialogues: 对象数组，记录本模块内的字幕台词，字段为 order（行号）、speaker、text、emotion（可缺省）。
  - follow_up_tasks: 1-3条中文建议，指导后续学习或练习。

字幕标题：${subtitleTitle}
字幕原文（行号按出现顺序，从1开始）：
${subtitle}

生成规则：
1. 如果字幕没有明显分场景，可按话题转折或提问-回答对拆分，避免过多细碎分块。
2. 保证 block_index 递增且覆盖所有台词，不缺行也不重复。
3. 只输出合法 JSON 字符串，不要包含 Markdown、解释或额外文本。`;

  const response = await generateText({
    model: client.chat(modelName),
    prompt,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch (error) {
    console.error("模型输出不是合法 JSON：", response.text);
    throw error;
  }

  const result = ScenarioSegmentationSchema.parse(parsed);

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
