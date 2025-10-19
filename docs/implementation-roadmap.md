# 幕学语境平台实施路线与任务拆解（初版）

## 1. 文档目标
- 将架构设计中的阶段性目标拆解为可执行任务，明确优先级与预期产出。
- 为项目管理提供进度追踪依据，可作为迭代计划/看板初始化参考。
- 在后续需求变更或新增模块时，作为同步更新的基线文档。

## 2. 阶段划分概览
| 阶段 | 目标焦点 | 关键成果 |
|------|----------|----------|
| Phase 0 | 项目基础设施搭建 | Turborepo、开发环境、CI 初始流程 |
| Phase 1 | 认证与用户基础 | 注册/登录、Session、用户档案 |
| Phase 2 | 学习内容与记录 | 内容展示、记录统计、首页数据 |
| Phase 3 | AI 字幕工作流 | 字幕上传、队列处理、AI 拆词反馈 |
| Phase 4 | 练习与测评体系 | 练习生成、答题闭环、错题本 |
| Phase 5 | 可视化与推荐 | 仪表盘、学习计划、AI 推荐策略 |
| Phase 6 | 运维与优化 | 性能调优、监控、灰度发布 |

> 注：各阶段可根据资源并行或交错执行，此表用于说明主线依赖关系。

## 3. 任务拆解详情

### 前置实验（Spikes）
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| Spike 1：Vercel AI SDK + Zod | 结构化输出（字幕→词汇表），失败重试与校验 | `docs/spikes/spike1-vercel-ai-zod.md`、最小脚本 | 待定 | 待办 |
| Spike 2：Python Instructor | Pydantic 严格校验，作为 Worker 备选路径 | `docs/spikes/spike2-python-instructor.md`、最小脚本 | 待定 | 待办 |
| Spike 3：TypeChat | TS 类型即契约，自动纠错至目标结构 | `docs/spikes/spike3-typechat.md`、最小脚本 | 待定 | 待办 |
| 对比与结论 | 记录成功率/延迟/复杂度与推荐组合 | `docs/spikes/README.md` 更新结论区 | 待定 | 待办 |

### Phase 0：基础设施与工程规范
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 初始化 Turborepo 仓库 | 建立 `apps/web`、`apps/api`、`packages/*` 基础结构 | Turborepo 工程骨架 | 待定 | 待办 |
| 配置 ESLint/Prettier/Husky | 前后端统一代码规范，加入提交钩子 | `.eslintrc`、`.prettierrc`、Husky 脚本 | 待定 | 待办 |
| Docker Compose 本地环境 | 定义 Next.js、NestJS、PostgreSQL、Redis 服务编排 | `docker-compose.yml` | 待定 | 待办 |
| GitHub Actions 基线 | 配置 lint → test → build 流水线 | `.github/workflows/ci.yml` | 待定 | 待办 |
| 敏感配置管理方案 | 规范 `.env`、Secrets、示例配置 | `docs/env-guide.md` | 待定 | 待办 |

### Phase 1：认证与用户基础
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 数据模型：User/Auth | 定义 Prisma Schema（User、Session、Role） | `prisma/schema.prisma` 更新 | 待定 | 待办 |
| NestJS Auth 模块 | 实现注册、登录、JWT、刷新令牌 | `apps/api/src/modules/auth` | 待定 | 待办 |
| NextAuth 集成 | 前端接入 Session，封装登录流程 | `apps/web/app/(auth)` 页面与 hooks | 待定 | 待办 |
| 权限中间件 | 前后端路由守卫、角色控制 | 中间件/Guard 实现 | 待定 | 待办 |
| 用户档案页面 | 用户资料、学习目标基本信息 | `apps/web/features/user-profile` | 待定 | 待办 |

### Phase 2：学习内容与记录
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 学习内容模型 | 内容、标签、字幕元数据表设计 | Prisma 模型、迁移脚本 | 待定 | 待办 |
| 学习记录模型 | 进度、评价、统计字段建模 | Prisma 模型、迁移脚本 | 待定 | 待办 |
| NestJS 内容模块 | 列表、详情 API；内容维护接口 | `apps/api/src/modules/learning-content` | 待定 | 待办 |
| NestJS 记录模块 | 记录写入、统计聚合 API | `apps/api/src/modules/learning-record` | 待定 | 待办 |
| 首页 Server Component | 首页仪表盘首屏数据获取 | `apps/web/app/(dashboard)/page.tsx` | 待定 | 待办 |
| 内容详情页面 | 视频+字幕展示、AI 解释占位 | `apps/web/features/learning-content` | 待定 | 待办 |

### Phase 3：AI 字幕工作流
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 字幕任务数据模型 | `SubtitleTask`、`SubtitleAsset` 结构设计 | Prisma 模型 | 待定 | 待办 |
| 文件上传与存储 | 对象存储适配、签名生成 | 上传 API、S3 工具 | 待定 | 待办 |
| BullMQ 队列配置 | 队列初始化、重试策略、监控 | 队列配置与 Worker 基类 | 待定 | 待办 |
| AI Provider 抽象 | `generateGlossary` 等接口封装（结合 Spike 结论选择默认方案与兜底方案） | `packages/ai-providers` | 待定 | 待办 |
| 字幕 Worker 实现 | 消费任务、调用 AI、结果入库 | `apps/api/workers/subtitle-worker.ts` | 待定 | 待办 |
| 前端处理流程 | 上传进度、任务状态轮询/SSE | `apps/web/features/subtitle-processing` | 待定 | 待办 |

### Phase 4：练习与测评体系
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 练习模型设计 | Practice、Question、Answer 表结构 | Prisma 模型 | 待定 | 待办 |
| 练习生成策略 | 静态题库 + AI 生成策略接口 | 策略服务实现 | 待定 | 待办 |
| 作答与反馈 API | NestJS 记录作答、生成反馈 | `apps/api/src/modules/practice` | 待定 | 待办 |
| 前端练习组件 | 题目渲染、答题流程、结果展示 | `apps/web/features/practice` | 待定 | 待办 |
| 错题本与回顾 | 错题列表、复习节奏提醒 | 错题模块 UI + API | 待定 | 待办 |

### Phase 5：可视化与智能推荐
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 仪表盘数据聚合 | 多维度统计指标接口 | 聚合服务 + 缓存策略 | 待定 | 待办 |
| 学习计划模块 | 计划 CRUD、系统推荐逻辑 | `PlanningModule` + 前端页面 | 待定 | 待办 |
| AI 推荐策略 | 接入 AI 推荐、可解释输出 | 推荐服务实现 | 待定 | 待办 |
| 数据可视化组件 | 进度图表、热度图、趋势图 | `apps/web/widgets/charts/*` | 待定 | 待办 |
| 通知与提醒 | SSE/WebSocket 推送、站内信 | Notification 模块完善 | 待定 | 待办 |

### Phase 6：运维与性能优化
| 任务 | 描述 | 产出物 | 负责人 | 状态 |
|------|------|--------|--------|------|
| 监控与日志方案 | OpenTelemetry、Sentry 接入 | Monitoring 指南 | 待定 | 待办 |
| 性能调优 | Lighthouse 优化、API Profiling | 优化报告 | 待定 | 待办 |
| 灰度与回滚策略 | 部署策略、版本回滚预案 | 运维手册 | 待定 | 待办 |
| 成本监控面板 | AI Token 消耗、存储/带宽统计 | 成本看板 | 待定 | 待办 |
| 安全与合规审查 | OWASP 检查、数据脱敏策略 | 安全审计报告 | 待定 | 待办 |

## 4. 任务管理建议
- 可将文档内容导入项目管理工具（Jira、Linear、Trello、飞书多维表格等），按阶段设立 Epic，任务导出为 Story/Task。
- 建议在文档中追加字段：预估工时/故事点、开始/截止日期、状态说明（待办、进行中、阻塞、完成）。
- 每次迭代结束复盘时更新文档，记录新增需求、风险与实际完成情况。

## 5. 后续维护
- 架构或需求变更时，同步更新 `docs/architecture-design.md` 与本路线文档，确保信息一致。
- 鼓励在提交中引用任务编号，保持设计-实现-测试的闭环追踪。
- 若后续引入更多团队成员，可在此文档增加 onboarding checklist。

---
此文档为初版，可在项目看板建立后同步维护为“单一事实来源”，持续迭代。 
