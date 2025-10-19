# Spike 4：AI 情景分块结构化输出

## 目的
验证使用 OpenAI 兼容模型对英文字幕进行情景分块的可行性，确保输出满足情景模块化、考试导向以及后续知识解析的结构化需求，并能兼容缺失时间戳或说话人的字幕格式。

## 前置
- Node.js 18+
- 依赖：`npm install ai @ai-sdk/openai zod dotenv`
- 环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`（可选）、`OPENAI_MODEL`（可选）、`OPENAI_EXTRA_HEADERS`（可选）

## 目标结构
```ts
export interface DialogueLine {
  order: number;              // 字幕行号（从 1 开始）
  timestamp?: string;         // 时间戳，可缺省
  speaker: string;            // 角色名称；缺省时使用 "Unknown"
  text: string;               // 原始台词
  emotion?: string;           // 情绪或语气提示
}

export interface LearningFocus {
  vocabulary: string;         // 词汇训练提示
  grammar: string;            // 语法训练提示
  listening: string;          // 听力/语音关注点
  culture?: string;           // 文化背景拓展
}

export interface ScenarioBlock {
  block_index: number;        // 模块序号
  block_name: string;         // 模块标题（中文）
  synopsis: string;           // 模块概述（中文）
  start_line: number;         // 起始行号
  end_line: number;           // 结束行号
  context_tags: string[];     // 语境标签
  exam_alignment: string[];   // 考试导向提示
  difficulty: "入门" | "进阶" | "冲刺";
  learning_focus: LearningFocus;
  dialogues: DialogueLine[];  // 模块包含的台词
  follow_up_tasks: string[];  // 后续学习建议
}

export interface ScenarioSegmentation {
  subtitle_title: string;         // 字幕标题
  segmentation_strategy: string;  // 分块策略说明
  total_blocks: number;           // 模块总数（需与数组长度一致）
  blocks: ScenarioBlock[];
}
```

## 最小示例
```ts
// 路径：spikes/spike4-scenario-segmentation/spike4.ts
// 功能：调用模型生成情景分块 JSON，并通过 Zod 校验结构
```

## 运行
```bash
cd spikes/spike4-scenario-segmentation
npx tsx spike4.ts                 # 默认读取当前目录 subtitle.txt
npx tsx spike4.ts ./my.srt        # 可指定外部字幕文件
```

> 可选环境变量：
> - `SUBTITLE_FILE`：覆盖字幕文件路径；
> - `SUBTITLE_TITLE`：自定义分块结果中的字幕标题（默认使用文件名）。

脚本会自动解析每行字幕的时间戳与说话人（若存在），缺失信息时会填充 `Unknown`，并在提示词中使用带行号的文本，方便模型对齐参考。

## 观察指标
- 分块准确性：台词行号覆盖是否完整且无重叠。
- 主题聚焦度：block_name 与 synopsis 能否准确传达场景核心。
- 考试导向性：exam_alignment、learning_focus 是否贴合 CET/IELTS/TOEFL/考研等备考需求。
- 可扩展性：follow_up_tasks 的建议能否成为后续练习模块的输入。
- 鲁棒性：在无时间戳/无说话人场景下的成功率及必要的重试策略。
