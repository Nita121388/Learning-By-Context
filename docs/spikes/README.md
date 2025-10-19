# 可行性验证（Spikes）说明

## 目标
- 以最小成本验证关键能力可行性与开发体验（结构化输出、tRPC/RSC 通道、异步队列、UI 选型等）。
- 沉淀可复用的代码片段与最佳实践备忘，降低后续实现不确定性。

## 目录
- `spike1-vercel-ai-zod.md`：Vercel AI SDK + Zod 结构化输出（脚本：`spikes/spike1-vercel-ai-zod/spike1.ts`）
- `spike2-python-instructor.md`：Instructor + Pydantic 结构化输出（脚本：`spikes/spike2-python-instructor/spike2.py`）
- `spike3-typechat.md`：TypeChat 类型驱动输出（脚本：`spikes/spike3-typechat/`）

## 通用前置
- Node.js 18+（TS/Next.js 场景）
- Python 3.10+（可选，Python Worker 场景）
- 在仓库根目录执行一次依赖安装：
  ```bash
  npm install ai @ai-sdk/openai openai typechat zod dotenv
  npm install -D tsx @types/node typescript
  ```
- 配置 `.env`（示例）：
  ```
  OPENAI_API_KEY=sk-your-api-key
  OPENAI_BASE_URL=https://api.openai.com/v1
  OPENAI_MODEL=gpt-4o-mini
  # OPENAI_EXTRA_HEADERS={}
  ```

  若切换到 88code 或 DeepSeek 等兼容网关，可参考 `.env.example` 中的配置样例修改。

## 使用方式（建议）
- 每个 Spike 独立一个最小脚本/页面，聚焦“能跑通 + 看结果”，示例代码存放于 `spikes/` 目录。
- 在各自 README 记录：目的、依赖、运行方式、预期结构、结论（成功率/延迟/成本备注），验证后更新“结论记录”区。
- 验证完成后，在 `docs/implementation-roadmap.md` 标记对应 Spike 状态并沉淀经验。
