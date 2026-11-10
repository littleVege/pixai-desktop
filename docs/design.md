# PixAI 本地客户端设计

状态：产品、架构及 PixAI 传输策略已确认。运行细节见 [架构设计](architecture.md)。

## 产品范围

- 首版面向熟悉 PixAI 的创作者，重点是生图与高质量 Prompt Helper。
- 仅支持 macOS，采用 Electron；Windows 不在当前范围内。
- 本地保存创作状态，允许云端推理，见 [ADR 0001](adr/0001-local-workspace-cloud-inference.md)。
- 首版包含受限的自动生成、检查与调整循环，见 [ADR 0002](adr/0002-bounded-creative-agent.md)。
- 仅支持 BYOK，见 [ADR 0003](adr/0003-byok-only.md)。
- 首版保留 Composer 的参考图和 3D 场景能力，按目标模型支持情况启用；新增遮罩重绘与扩图留待后续。

## Prompt Helper

已确认支持两类输入：简短的中文创作想法，以及熟练用户已有的完整 Prompt。

明确要求必须保留。未指定的光线、构图和环境细节可以补充；人物身份、服装和关键动作的明显变化作为备选方案。用户可以锁定内容，后续强化和自动修正均遵守锁定。

强化依据包含模型规则、LoRA 触发词和用户认可的历史方案。当前作品的反馈立即用于后续调整；跨作品偏好经用户明确确认后保存。用户喜欢的 Prompt、模型和参数组合可以保存为生成预设（Preset）复用。

术语沿用现有 Composer 的 `GLOSSARY.md`：生成预设（Preset）保存用户的完整设置，配方（Recipe）是可以按顺序叠加到生成中的素材组合。此前访谈将前者笼统称为“创作配方”，此处纠正名称，已确认的复用能力不变。桌面端保存包含 LoRA、Recipe、Reference 和可编辑场景的完整预设。

手动强化提供修改预览与撤销；Agent 的尝试保存为候选版本。首版优先二次元人物与插画，用户确认自有模型针对二次元做了特殊优化；知识与评估应围绕这些模型建立，不能将通用模型的写法直接当作最佳实践。按相同模型和图像预算比较强化前后结果，以要求保留、改动可解释和实际采纳评价效果。

## 模型服务配置

用户自行配置 PixAI API Key，以及语言／视觉模型的服务地址、Key 和模型名称。文本与视觉模型可以分别选择，也可以共用一个具备所需能力的模型。接口格式相同不等于能力相同，接入时需要验证工具调用、结构化输出与图像输入能力。

## Composer 与工作台

用户指定复用 `pixai-composer-next/` 作为 Composer，并委托设计其余界面安排。

左栏用于切换作品。每件作品有独立的持久会话。主视图按时间显示用户发言、Agent 回复、工具活动、提交的生成版本和结果图。图片视图用于浏览和比较版本。底部 Composer 提供「直接生成」与「交给 Agent」两种方式，共用编辑框、模型、参考素材和锁定要求。额度在 Composer 中设置。每轮的额度消耗、停止和继续操作随消息显示。后续发言可以引用此前的对话、版本及结果图。

拷贝前的 playground 集成条件：

- `src/components/composer/Composer.tsx` 已有 `onSubmit`、`promptHistory` 等组件边界，提交类型位于 `src/types.ts`。
- 当前仍是私有 Vite 应用，存在单例草稿状态和静态目录数据，尚不是可直接发布的组件包。
- `server/` 已有 PixAI 接入；`server/taskParams.ts` 已显式关闭服务端 Prompt Helper。源码事实优先于 README 中过时的 mock 描述。
- 编辑文档由文本和参考素材提及组成；语义锁定、Prompt 版本与差异记录尚未实现。现有生成历史持久化会移除 `promptDoc`，不能直接承担完整作品存档。
- 当前无 AI Prompt Helper 或 Agent 实现。
- 已实现最多 3 张参考图、拖拽/粘贴/上传，以及可再次编辑并渲染为参考图的 3D Reference Scene；已确认保留这些能力。
- 演示服务采用 PixAI GraphQL，并通过有序 Recipe ID 使用平台配方；公开 REST 创建接口尚未找到对应的 Recipe 契约。

已确认一次性拷贝所需 Composer 源码到桌面项目，后续在桌面项目内维护，原项目保留为 playground；不维护独立发布包或跨仓库同步。作品、版本、锁定约束和 Agent 状态由桌面领域层管理，编辑器通过明确接口接入；详见 [ADR 0004](adr/0004-copy-playground-composer.md)。

## 模型与 LoRA

用户已指定时沿用其选择。用户未指定且明确要求生成时，Agent 可以查找、推荐并在既定预算内自主采用模型和 LoRA，同时展示理由；用户只要求推荐时，展示方案。

## 用户编辑与 Agent 接管

用户在旧目标生成过程中修改 Composer 时，保留当前生成的结果并暂停旧目标的后续自动生成。用户草稿保持原样；用户选择“按当前草稿继续”后，Agent 再围绕新目标执行。Agent 的内部候选修改与用户主动编辑需要区分，不能互相误触发接管逻辑。

## 已核实的外部接口约束

以下为公开文档事实，不代表已经用真实账号验证权限与效果；核对日期为 2026-11-07。

- [模型与 LoRA 搜索](https://platform.pixai.art/en/docs/api-v2/model/searchGenerationModels)支持关键词和兼容基础模型等过滤；实际生成使用版本 ID，LoRA 结果可提供触发词。
- [生图接口](https://platform.pixai.art/en/docs/api-v2/image/createImage)采用异步任务，`batchSize` 只接受 1 或 4。因此默认首轮 2 张对应两个单图任务；不能把任务数等同于图片数。
- 同一生图接口的 `promptHelper` 默认启用，可以显式关闭。桌面方案延续现有代码的关闭行为，使客户端强化后的提交内容可追踪。
- 生图接口公开了 Tsubaki.3 的参考图能力；[重绘接口](https://platform.pixai.art/en/docs/api-v2/image/createInpaint)公开了遮罩重绘、扩图与整图重绘。首版采用前者，新增遮罩重绘与扩图已确定后置。
- 提交前报价、主动取消和幂等提交的契约尚未完成验证；不能依赖其存在设计自动重试，也不能把张数上限显示成准确金额上限。

## 已确认的架构

- **作品与历史**：一个作品包含当前草稿、多份不可变版本、生成任务、图片和多次 Agent 执行。每次生成关联完整版本快照；从旧结果继续创作时派生新版本。SQLite 保存结构化记录，文件系统保存原始图片、参考素材和 3D 场景文件。
- **Agent 运行边界**：一个主 Agent 在独立 Node 进程中决定下一步；应用业务服务执行工具并持久化状态。工具覆盖读取作品、搜索模型、强化 Prompt、创建候选、提交生成、检查结果和保存已认可预设。普通队列负责等待生成与下载，完成事件唤醒 Agent。
- **模型接入**：尝试采用 Vercel AI SDK 的 Agent API，首版验证 OpenAI-compatible 接入协议；PixAI 由独立适配层接入。持久状态和预算由应用管理。实际传输策略见架构设计。
- **失败与消耗**：图像预算按已提交的请求张数消耗；失败和提交结果不明也占用额度，查询与下载重试不重复计数。提交结果不明时暂停，避免自动重复生成；每次 Agent 执行另设总模型调用上限，默认 20 次并计入重试与视觉调用。
- **重启恢复**：重新打开客户端后自动恢复已知任务的查询和下载；新的付费生成等待用户继续。关闭窗口可留在后台处理；明确退出应用后不在本机继续执行。用户主动接管的执行保持暂停。
- **Prompt Helper 验收**：围绕二次元人物与插画建立短想法、完整 Prompt、锁定约束和冲突输入样例；按相同模型与图像预算比较强化前后结果，结合要求保留、改动可解释和用户采纳来评价。

运行架构的能力依据：[Electron utility process](https://www.electronjs.org/docs/latest/tutorial/process-model#the-utility-process) 提供独立 Node 进程；[AI SDK 工具调用](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)支持由应用接管工具执行；[兼容 Provider](https://ai-sdk.dev/providers/openai-compatible-providers)支持自定义模型服务配置。项目取舍见 [ADR 0005](adr/0005-immutable-work-revisions.md) 与 [ADR 0006](adr/0006-local-agent-with-durable-job-queue.md)。

## 最后的接口取舍

现有源码 `server/taskParams.ts` 将 `recipeIds` 传给 GraphQL `createGenerationTask`，没有在本地展开配方。Recipe 元数据也不包含完整素材内容；公开 REST 生图文档尚未列出 `recipeIds` 或 Recipe 解析契约。因此，仅改用公开 REST 不能视为与现有 Composer 等价。

建议首版保留现有 GraphQL 生成路径，在 `PixAIAdapter` 中统一封装；模型与 LoRA 搜索使用公开 REST 能力。原始请求、任务 ID 及所用传输方式一起记录，提交失败或结果不明时不跨协议自动重提。GraphQL 与 Recipe 的当前线上可用性须在正式联调中验证。

## 决策树

- 产品人群与平台：已确认。
  - Composer：已指定现有 pixai-composer-next 项目；其余界面委托设计。
    - 一次性拷贝到桌面项目维护：已确认；草稿同步边界见架构设计。
  - PixAI 账号接入：仅 BYOK；生成能力：已确定保留参考图与现有 3D 场景，新增遮罩重绘和扩图后置。
- 本地与云端边界：已确认。
  - 语言与视觉模型的配置方式：BYOK，可分开或共用模型。
    - 首版 OpenAI-compatible、尝试 Vercel AI SDK Agent API：已确认。
  - 作品、不可变版本、任务与图片模型，SQLite 与文件系统存储：已确认。
- 受限的自动创作循环：已确认。
  - 用户接管：用户编辑后暂停旧目标后续生成，保留已提交任务结果。
  - 一个主 Agent、独立本地进程、业务工具与持久队列：已确认。
  - 默认生成上限与正常停止条件：已确认，见 ADR 0002。
    - 失败及提交结果不明占额度、重启恢复查询下载而暂停新生成：已确认。
  - 模型与 LoRA：已有选择时沿用，未指定且明确要求生成时可自主选用；只要求推荐时展示方案。
- 高质量 Prompt Helper：已确认为重点。
  - 输入：两类均支持；保留要求、允许补充范围与锁定规则：已确认。
  - 手动强化：预览修改与撤销；Agent 尝试：候选版本。
  - 复用认可方案、结合模型规则和 LoRA 触发词、跨作品偏好需明确确认：已确认。
    - 与现有 Recipe、Preset 的术语映射：已校准；认可的完整组合保存为 Preset。
  - 优先二次元人物与插画、按目标模型适配、同预算比较效果：已确认。
- PixAI 生成传输策略：GraphQL 保留现有配方能力，REST 提供搜索。

## 设计依据

- [PixAI 客户端功能规划](chatgpt-conversation://6adac83c-9b40-83ee-ac51-67659eb8b4bf)：作为背景与候选方案来源；此前助手提出的技术栈和接口能力不自动视为已确认。
- 2026-11-06 本轮访谈：用户确认目标人群、本地边界、受限 Agent 循环，强调 Prompt Helper 质量，并指定仅支持 macOS、采用 Electron。
- 2026-11-07 本轮访谈：用户确认两类 Prompt Helper 输入及内容保留规则，指定现有 Composer、委托其余界面设计，允许未指定模型时查找推荐，并接受默认生成上限与停止条件。
- 2026-11-07 后续访谈：用户确认生成请求可自主选用推荐模型、仅 BYOK、认可方案复用与显式偏好保存、保留参考图和 3D 场景、用户编辑后暂停旧目标后续生成。
- 2026-11-07 架构访谈：用户指定一次性拷贝 playground，确认完整版本、单 Agent、尝试 Vercel AI SDK、失败计额度及关闭恢复行为，并说明自有模型对二次元有特殊优化。

桌面端工作区从空目录开始，Composer 的现有实现构成集成依据。当前实现和实测范围见 [验收记录](implementation-progress.md)。
