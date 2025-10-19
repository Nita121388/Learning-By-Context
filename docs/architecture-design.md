# 幕学语境平台项目架构设计文档

## 1. 文档目的
- 明确项目整体技术选型与分层结构，为后续迭代和团队协作提供统一依据。
- 描述核心业务模块在前后端、数据层与 AI 调度间的交互关系，降低跨模块沟通成本。
- 明确非功能性指标、风险点与实施路线，便于制订阶段性目标与验收标准。

## 2. 产品与业务概览
- **产品定位**：基于影视字幕的多模态英语学习平台，结合 AI 编排词汇、语法、情境练习。
- **核心业务域**：
  - 学习内容域：视频片段、字幕、词汇本体与语法点。
  - 学习记录域：进度追踪、能力评估、可视化仪表盘。
  - 练习与测评域：词汇测验、听写、情景对话自评。
  - 学习笔记域：用户自定义标注、摘录、重点整理。
  - AI 协调域：字幕解析、拆词、推荐策略、任务分发。
- **目标用户**：准备语言考试/提升职场英语的学习者、外语教师、内容运营人员。

## 3. 关键需求总结
- **功能需求**：
  - 多角色鉴权（学习者、教师/运营、管理员）。
  - 首页概览个人目标、学习进度、推荐任务。
  - 学习内容浏览＋字幕分解＋ AI 拆词解释。
  - 练习生成、答题反馈、错题回放。
  - 学习记录与计划管理、笔记与收藏同步。
  - 字幕/音视频上传，后台队列异步处理。
- **非功能需求**：
  - Page TTFB < 200ms（桌面端），首屏数据直出。
  - 队列任务平均延迟 < 5 秒，失败自动重试。
  - 数据与配置可横向扩展，支持多租户。
  - 安全符合 OWASP Top 10，敏感信息加密存储。

## 4. 总体架构
- **形态**：基于 Turborepo 的单仓多应用结构，前后端分别封装在 `apps/web` 与 `apps/api`，共享组件与工具位于 `packages/*`。
- **交互链路**：前端通过 tRPC/REST 与后端通信；后端连接 PostgreSQL/Redis 负责数据与任务，外部 AI 服务通过 Provider 统一封装。
- **部署思路**：前端构建产物托管到 Vercel/Netlify；后端容器化部署到 Railway/Render/K8s；数据库使用托管 PostgreSQL，队列使用托管 Redis。

### 4.1 架构示意
```
┌──────────────────────────────────────────────────────────────┐
│                          Turborepo Monorepo                  │
│                                                              │
│  apps/web (Next.js 14)  ── tRPC/REST ──  apps/api (NestJS)   │
│          │                                   │               │
│          │                                   │               │
│          ▼                                   ▼               │
│   用户浏览器                         Prisma / Service Layer   │
│          │                                   │               │
│          │            ┌──────────┬──────────┴───────────┐   │
│          │            │ PostgreSQL│   Redis/BullMQ      │   │
│          │            │   数据库  │   异步任务           │   │
│          │            └──────┬───┴─────────┬────────────┘   │
│          │                   │             │                │
│          ▼                   ▼             ▼                │
│  CDN / Edge Cache     AI Provider SDK   对象存储(S3)        │
└──────────────────────────────────────────────────────────────┘
```

## 5. 前端架构设计（apps/web）
- **技术栈**：Next.js 14 App Router、TypeScript、Tailwind CSS、shadcn/ui、TanStack Query、Zustand。
- **目录分层**：
  - `app/`：Server Component 驱动的页面与路由，结合 Route Handler 暴露 server action。
  - `features/`：按业务域拆分（Home、LearningContent、Practice、Notes、Settings），集中页面逻辑。
  - `entities/`：常用实体状态（User、Content、Record 等）以及类型定义。
  - `shared/`：基础 UI、表单封装、hooks、工具函数、常量。
  - `widgets/`：跨页面复用的组合组件（仪表盘、练习面板、字幕播放器等）。
- **状态与数据**：
  - Server Component 获取首屏数据，客户端用 TanStack Query 维护交互态。
  - Zustand 存储轻量 UI 状态（抽屉、浮层、播放进度等）。
  - tRPC 客户端统一封装请求，支持 API 日志与异常捕获。
- **鉴权机制**：
  - NextAuth.js 结合 Credential Provider（账号密码）+ OAuth 扩展能力。
  - 中间件保护受限路由，RSC 端获取 session，客户端下发含角色的页面模型。
- **可访问性与多语言**：
  - 使用 shadcn/ui + Tailwind 组合控件，遵循 WAI-ARIA。
  - 利用 Next.js 内置国际化支持，未来可扩展多语种界面。

## 6. 后端架构设计（apps/api）
- **技术栈**：NestJS、TypeScript、Prisma、class-validator、BullMQ。
- **模块划分**：
  - `AuthModule`：注册、登录、Token 管理、社交登录。
  - `UserModule`：用户档案、学习目标、偏好设置。
  - `LearningContentModule`：内容上架、标签、元数据、字幕存储。
  - `LearningRecordModule`：学习进度、能力评估、仪表盘数据聚合。
  - `PracticeModule`：题目生成、作答记录、反馈打分。
  - `NoteModule`：用户笔记、收藏夹、摘录同步。
  - `SubtitleModule`：字幕上传、解析任务、时间轴对齐。
  - `AIOrchestrationModule`：AI Provider 抽象、Prompt 模板管理、任务编排。
  - `NotificationModule`：SSE/WebSocket 推送、站内消息。
- **接口协议**：
  - 默认 RESTful（OpenAPI 说明），关键交互提供 `/trpc` 端点。
  - SSE/WebSocket 用于处理字幕解析与练习评估的实时反馈。
- **安全策略**：
  - JWT + Refresh Token 双令牌；角色权限（Role + Scope）守卫。
  - 参数校验、速率限制（RateLimiter）、审计日志（Winston + Elastic/S3）。
  - 敏感配置通过环境变量管理，生产环境引入 Secrets Manager。
- **后台任务**：
  - BullMQ 处理字幕解析、AI 请求、定时推荐、数据清洗。
  - 可扩展 Worker 单独部署，支持横向扩容。

## 7. 数据与存储设计
- **关系数据库（PostgreSQL）**：
  - 核心实体示例：`User`、`LearningContent`、`LearningRecord`、`PracticeSession`、`PracticeQuestion`、`Note`、`SubtitleAsset`、`AiPromptTemplate`、`AiTaskRun`。
  - Prisma Schema 作为单一事实来源，生成类型并驱动迁移。
  - 关键索引：用户与内容组合索引、任务状态索引、时间序列索引（用于统计）。
- **缓存与队列（Redis）**：
  - BullMQ 队列：字幕处理、AI 任务、通知推送、定时作业。
  - 缓存：热门内容、推荐列表、用户配置、AI 结果缓存（防止重复扣费）。
- **对象存储**：
  - 存放视频片段、音频、字幕文件、练习附件。
  - 推荐使用 S3 兼容服务（AWS S3、Cloudflare R2、阿里云 OSS）。
- **日志与监控**：
  - 请求日志：Winston -> Loki/ELK。
  - 指标：OpenTelemetry + Prometheus/Grafana。
  - 错误：Sentry/LogRocket。

## 8. AI 能力编排
- **Provider 抽象层** (`packages/ai-providers`)：
  - 提供统一接口：`generateGlossary`、`summarizeSegment`、`recommendPractice`。
  - 封装 OpenAI、DeepSeek、Azure OpenAI 等具体实现，可根据额度动态切换。
- **Prompt 管理**：
  - `AiPromptTemplate` 表存储版本化模板与变量定义。
  - 使用 Prompt 语义命名（如 `subtitle_glossary_v1`），引入缓存与灰度机制。
- **任务流水线**：
  1. 用户上传媒体 -> 生成 `SubtitleTask`。
  2. BullMQ Worker 拉取任务 -> AI Provider 完成拆词/分类。
  3. 结果落库 -> 通知模块推送进度。
  4. 失败重试 + 人工兜底。
- **成本与风控**：
  - 统一计量 Token 消耗，设置额度预警。
  - 对敏感内容做过滤（借助内容安全 API 或自建规则）。

## 9. DevOps 与工程规范
- **代码规范**：ESLint + Prettier + Stylelint；Husky + lint-staged 阻断违规提交。
- **提交约定**：Conventional Commits，配合 Changeset 做版本迭代。
- **测试体系**：
  - 单元测试：Vitest（前端）、Jest（后端）。
  - 集成测试：NestJS E2E + Playwright UI 自动化。
  - 合约测试：tRPC/REST Schema 校验 + MSW 伪装服务。
- **CI/CD 流程**（GitHub Actions）：
  1. Install & Lint。
  2. Test（前端、后端、E2E 可并行）。
  3. Build（Next.js、NestJS）。
  4. Deploy（Vercel Preview / Render Preview）。
- **环境管理**：
  - 开发：Docker Compose 启动 Next.js、NestJS、PostgreSQL、Redis。
  - 测试：自动触发临时环境，跑集成测试。
  - 生产：基础设施即代码（Terraform/ Pulumi）管理资源。

## 10. 非功能性指标与监控
- **性能目标**：
  - 首屏渲染 < 2s（联网良好）；Lighthouse Performance ≥ 90。
  - API 95 分位响应 < 300ms；AI 任务平均等待 < 5s。
- **可用性目标**：
  - 后端服务 SLA ≥ 99.5%；数据库每日备份，多区域容灾。
  - 队列任务失败率 < 1%，自动重试 3 次。
- **安全目标**：
  - 全站 HTTPS；密码哈希使用 Argon2。
  - 输入校验、防止 SQL/NoSQL 注入、XSS、CSRF。
  - 数据脱敏日志；管理员操作审计。

## 11. 迭代实施路线
1. **环境搭建阶段**：创建 Turborepo、配置 ESLint/Prettier、Docker Compose、CI 管道。
2. **基础认证阶段**：实现注册/登录、Session 管理、用户档案 API 与页面。
3. **学习内容阶段**：接入内容列表、详情、基础学习记录统计。
4. **AI 字幕阶段**：实现字幕上传、队列消费、AI 拆词、结果展示。
5. **练习体系阶段**：构建练习生成、答题流程、错题本。
6. **可视化与推荐阶段**：实现仪表盘、学习计划、AI 推荐策略。
7. **性能与运维阶段**：优化监控、日志、成本控制、灰度发布策略。

## 12. 风险评估与对策
- **AI 服务不可用**：预置备用 Provider、降级为缓存结果或模板解释。
- **学习曲线陡峭**：编写内部开发手册，进行 Next.js/NestJS 培训。
- **数据合规风险**：对字幕/用户内容进行脱敏，遵守隐私政策，记录用户授权。
- **成本失控**：建立 Token 监控面板，设置调用额度预警与限流。
- **队列积压**：监控 Redis 指标，提供手动干预工具与自动扩容策略。

## 13. 后续工作项
- 细化 ER 图与 API 契约文档。
- 规划 UI 组件库 Storybook 与设计令牌体系。
- 明确日志指标与报警阈值。
- 制定运维值班与事故响应流程。

---
本文档将随迭代持续更新，新的模块和依赖需及时补充到架构说明中，确保团队始终共享同一张“系统地图”。 
