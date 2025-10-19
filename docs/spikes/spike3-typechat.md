# Spike 3：TypeChat（TypeScript 类型驱动）

## 目的
利用 TypeScript 接口定义目标 JSON 结构，验证 TypeChat 对 OpenAI 兼容网关的适配能力，并评估其自动纠错与类型约束效果。

## 前置
- Node.js 18+
- 依赖：`npm install typechat openai dotenv`
- 环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`（可选）、`OPENAI_MODEL`（可选）

## 类型定义示例
```ts
// 路径：spikes/spike3-typechat/schema.ts
export interface GlossaryItem {
  word: string;
  pos: string;
  meaning_cn: string;
  example?: string;
}

export interface Glossary {
  items: GlossaryItem[];
}
```

## 最小示例
```ts
// 路径：spikes/spike3-typechat/spike3.ts
import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { createJsonTranslator, createOpenAILanguageModel } from "typechat";
import { createTypeScriptJsonValidator } from "typechat/ts";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("请在环境变量中设置 OPENAI_API_KEY。");
    process.exit(1);
  }

  const baseURL = process.env.OPENAI_BASE_URL;
  const modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const model = createOpenAILanguageModel(apiKey, modelName, baseURL);

  const schemaPath = path.resolve(__dirname, "schema.ts");
  const schemaSource = readFileSync(schemaPath, "utf-8");
  const validator = createTypeScriptJsonValidator(schemaSource, "Glossary");
  const translator = createJsonTranslator(model, validator);

  const subtitle =
    "I thought we had an agreement. This is not what we discussed.";

  const prompt = `从以下英文字幕中抽取 8 个词/短语，返回 Glossary JSON：
${subtitle}

字段要求：
- word: 原词/短语
- pos: 词性（名/动/形/副/短语等）
- meaning_cn: 中文释义
- example: 可选示例句`;

  const result = await translator.translate(prompt);

  if (!result.success) {
    console.error("TypeChat 转换失败：", result.message);
    process.exit(1);
  }

  console.log("转换结果：");
  console.log(JSON.stringify(result.data, null, 2));
}

main().catch((error) => {
  console.error("执行失败：", error);
  process.exit(1);
});
```

## 运行
```bash
cd spikes/spike3-typechat
npm install typechat openai
npx tsx spike3.ts
```

## 观察指标
- 修复回合数、延迟及复杂结构（嵌套/联合类型）命中率
- 类型变更时的维护成本（只需更新 TS 接口）
- 与 Spike 1/2 的成功率、开发心智负担对比

## 结论记录（占位）
- 平均修复回合：__ 次
- 一次通过率：__%
- 适用场景：____；注意事项：____
