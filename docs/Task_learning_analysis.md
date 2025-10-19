# 学习分析能力增强任务

## 背景
- 现有 `server/prompts/scenario-analysis.md` 提示词结构简化，无法达到 `spikes/spike4-scenario-segmentation/prompt.txt` 中的教学深度。
- 学习分析结果以 Markdown 文本呈现，难以在界面按模块、卡片化展示，细节也不够丰富。
- 产品原型 `prototype/P-LEARNING_CONTENT.html` 展示了目标布局，需要结构化数据支持模块化渲染。

## 目标
1. 参考 Spike 提示词优势，重构正式版提示模板，确保输出内容更详尽、考试导向明确。
2. 让模型返回高度结构化的数据（建议 JSON + Markdown 片段），以便前端精准渲染每个模块与子条目。
3. 解析结果需覆盖多个词汇、短语、语法点和练习任务，保证准确性与数量下限。

## 功能需求
- **提示模板升级**
  - 引入 Module 1~5 结构：词汇短语、语法句型、发音听力、文化语境、应用练习。
  - 根据用户设定的考试范围（如四级、六级、雅思等）指导核心词汇的覆盖面与重点说明，提供字段示例（音标、词性、释义、考试标签、双例句等），而非单纯以数量为目标。
  - 要求输出严格 JSON 结构，并可附带格式良好的 Markdown 描述用于富文本展示。

- **服务端结构化解析**
  - 在 `server/services/scenario-analysis.ts` 定义 Zod Schema 校验模型返回值，必要时补缺省字段。
  - 支持将结构化数据与 Markdown 描述并存（例如 `{ data: {...}, markdown?: string }`）。
  - 对模型条目不足或字段缺失提供兜底策略（警告或补全）。

- **前端渲染配合**
  - `/api/scenarios/analyze` 返回结构化字段，前端按模块渲染，匹配 `P-LEARNING_CONTENT.html` 布局。
  - 每类条目可进一步扩展交互（发音按钮、练习入口、词典跳转）。

- **质量保障**
  - 新增单元测试，覆盖结构化解析、数量校验与降级逻辑。
  - 提供至少一份标准响应示例（Mock Data），方便前端调试。

## 交付物
1. 更新后的提示模板 (`server/prompts/scenario-analysis.md`) 与示例说明。
2. 重构后的学习分析服务，包含结构化解析与校验。
3. 对应接口与前端渲染改动（含示例与说明）。
4. 单元测试及 Mock 数据样例。

## 依赖与参考
- `spikes/spike4-scenario-segmentation/prompt.txt`
- `prototype/P-LEARNING_CONTENT.html`
- 现有 `server/services/scenario-analysis.ts` 实现及其测试框架。
