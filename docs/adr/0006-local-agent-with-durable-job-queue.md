---
status: accepted
---

# 用独立本地 Agent 配合持久任务队列

一个主 Agent 在独立本地 Node 进程内决定下一步，尝试采用 Vercel AI SDK 的 Agent API 承接语言／视觉模型及工具循环，首版接入 OpenAI-compatible BYOK 服务。作品状态、执行限额、工具记录和远程任务由应用领域层持久化；普通队列负责生图等待与下载，完成事件再唤醒 Agent。这样生图等待不消耗持续模型决策，应用可以独立恢复状态，SDK 的内存消息与内部循环不成为创作历史或扣费操作的唯一依据。
