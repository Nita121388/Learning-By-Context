# Spike 5：情景模块教学分析

## 目的
在 Spike 4 产出的情景分块基础上，进一步调用大模型生成面向考试的教学分析，包括词汇分级、语法讲解、发音提示、文化背景和练习建议，为后续产品化的学习内容提供验证样例。

## 前置
- Node.js 18+
- 依赖：`npm install`
- 环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`（可选）、`OPENAI_MODEL`（可选）、`OPENAI_EXTRA_HEADERS`（可选）

## 数据输入
- 默认读取 `spikes/spike4-scenario-segmentation/scenario.txt`，如需替换，可使用命令行参数或设置 `SCENARIO_FILE`。
- 提示词模板引用 `spikes/spike4-scenario-segmentation/prompt.txt`，可按需调整。

## 运行
```bash
cd spikes/spike5-dialogue-analysis
npx tsx spike5.ts                      # 默认读取上一轮生成的 scenario.txt
npx tsx spike5.ts ../spike4-scenario-segmentation/scenario.txt
```

> 可选环境变量：  
> - `SPIKE5_OUTPUT_DIR`：自定义输出目录，默认写入 `spikes/spike5-dialogue-analysis/analysis-output`。

## 输出
- 每个情景模块会生成一份 Markdown 教学分析，文件命名示例：`block-01-反抗联盟会议.md`。
- Markdown 中包含完整的 Module 1~5 教学内容，并附有中文难点提示。

## 观察指标
- 模块讲解完整度：是否覆盖词汇、语法、发音、文化与练习。
- 应试导向准确度：词汇、语法标签是否符合 CET/IELTS/TOEFL 等考试要求。
- 结构稳定性：是否严格遵循 prompt 模板，输出 Markdown 是否可直接渲染。
- 模型响应延迟与成本：分析长对话的平均响应时间、Token 消耗情况。*** End Patch
