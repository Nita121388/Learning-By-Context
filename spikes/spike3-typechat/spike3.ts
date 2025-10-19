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
