# 服务层说明

该目录用于封装后端服务能力，逐步把 Spike4/Spike5 中的字幕情景分块与教学分析逻辑迁移至可复用的 API 服务。

## 规划

- `segmentSubtitle.ts`：封装字幕分块流程（Spike4）。
- `analyzeScenario.ts`：封装情景教学分析流程（Spike5）。
- `notes.ts`：负责笔记的导入导出与关联。

> 所有服务需保持纯函数特性，方便单元测试，并可被 Next.js Route Handlers 或其他脚本直接调用。
