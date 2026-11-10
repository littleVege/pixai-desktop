# PixAI Desktop

用于 macOS 的 PixAI 创作工作台。每件作品有独立的会话时间线。底部 Composer 共享 Prompt、模型、LoRA、Recipe、参考图和 3D 场景。选择「交给 Agent」可让助手按额度生成候选、检查原图并继续调整，选择「直接生成」可按当前配置提交。

首次使用时在「设置」中填写 PixAI API Key，再选择 ChatGPT 套餐或填写兼容 OpenAI 的模型服务配置。看图可共用语言模型，或单独配置视觉服务。设置界面提供结构化输出、工具调用和图像识别检测。

## 本地运行

本项目在 macOS Apple Silicon 和 Node.js 26 上完成开发验证。安装依赖后启动 Electron。

```sh
npm ci
npm run dev
```

开发环境也可以在项目根目录的 `.env` 中配置 `PIXAI_API_KEY`、`LLM_MODEL_BASE_URL`、`LLM_MODEL_NAME`、`LLM_MODEL_API_KEY`。独立视觉配置使用 `VISION_MODEL_BASE_URL`、`VISION_MODEL_NAME`、`VISION_MODEL_API_KEY`。

## 验证与打包

```sh
npm test
npm run build
npm run test:runtime
npm run test:recovery
npm run package -- --arm64
```

Apple Silicon 应用位于 `release/mac-arm64/PixAI Desktop.app`。在没有 Developer ID 证书的环境中构建的是本机测试包。

作品、会话、执行记录和生成版本保存在应用数据目录的 `studio/studio.sqlite`，原图在同级 `assets` 目录。关闭窗口后队列可继续工作。退出应用并重新打开会恢复已提交任务的查询与下载，原 Agent 执行由用户点击「继续」恢复。

开发者可查看[设计说明](docs/design.md)、[架构](docs/architecture.md)和[验收表](docs/acceptance.md)。

本项目面向本地、非商业使用。PixAI Desktop 自有代码采用 [MIT 许可证](LICENSE)。随附的 OpenAI Sign-in with ChatGPT DevKit 及其修改遵循[原始非商业许可证](electron/vendor/siwc/LICENSE)，其他第三方组件保留各自许可证。

在「设置 → 模型服务 → 语言模型」选择「ChatGPT 套餐」，点击 Continue with ChatGPT，在浏览器授权套餐用量后选择模型并保存。可在同一位置管理用量、断开连接或切回 API Key。图像生成仍需 PixAI API Key。
