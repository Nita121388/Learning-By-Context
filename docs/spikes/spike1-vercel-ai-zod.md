# Spike 1：Vercel AI SDK + Zod 结构化输出

## 目的
从字幕文本中抽取固定结构的词汇表，验证 Vercel AI SDK 在不同 OpenAI 兼容网关下的结构化输出能力。

## 前置
- Node.js 18+
- 依赖安装（仓库根目录或 `spikes/spike1-vercel-ai-zod` 内执行）：
  ```bash
  npm install ai zod @ai-sdk/openai dotenv
  ```
  （可替换为 `pnpm` / `yarn` 等等价命令）
- 环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`（可选 `OPENAI_EXTRA_HEADERS`）

## 目标结构示例
```ts
type Glossary = {
  items: Array<{
    word: string;
    pos: string;
    meaning_cn: string;
    example?: string;
  }>;
};
```

## 最小示例
```ts
// 路径：spikes/spike1-vercel-ai-zod/spike1.ts
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
    console.warn("OPENAI_EXTRA_HEADERS 解析失败，已忽略：", error);
  }
}

const client = createOpenAI({
  apiKey,
  baseURL,
  headers: extraHeaders,
});

const GlossarySchema = z.object({
  items: z
    .array(
      z.object({
        word: z.string(),
        pos: z.string(),
        meaning_cn: z.string(),
        example: z.string().optional(),
      })
    )
    .min(5)
    .max(15),
});

async function main() {
  if (!apiKey) {
    console.error("请先在环境变量中设置 OPENAI_API_KEY。");
    process.exit(1);
  }

  const subtitle =
    "I thought we had an agreement. This is not what we discussed.";

  const prompt = `从以下英文字幕中抽取 8 个高价值词/短语，并返回符合 JSON 结构的词汇表：

字幕内容：
${subtitle}

输出要求：
1. 仅输出 JSON 字符串，不要包含多余文字。
2. 结构必须为 { "items": [...] }，其中每个元素包含 word、pos、meaning_cn、example（可选）。
3. word 使用原词或短语；pos 使用中文词性或简写；meaning_cn 给出简洁中文释义；example 若不存在可省略字段。
4. 保证 JSON 可被严格解析。`;

  const response = await generateText({
    model: client.chat(modelName),
    prompt,
    temperature: 0.4,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch (error) {
    console.error("模型输出无法解析为 JSON：", response.text);
    throw error;
  }

  const object = GlossarySchema.parse(parsed);

  console.log("结构化结果：");
  console.log(JSON.stringify(object, null, 2));

  if (response.usage) {
    console.log("提示词消耗 Token：", response.usage);
  }
}

main().catch((error) => {
  console.error("执行失败：", error);
  process.exit(1);
});
```

## 运行
```bash
cd spikes/spike1-vercel-ai-zod
npx tsx spike1.ts
```

## 观察指标
- 一次通过率、重试次数、首包延迟
- 失败样例与 schema 调整策略
- 费用估算（Token 使用量）

## 结论记录（占位）
- 一次通过率：__%
- 平均延迟：__s；P95：__s
- 默认模型推荐：____；备选：____
- 后续改进：提示词优化 / 字段约束细化 / 异常降级策略
