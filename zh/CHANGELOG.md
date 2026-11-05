# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## v0.0.3 2026-11-05

- 安全修复：任务回写链接改为用会话内随机密钥对具体任务行签发操作标识。伪造的链接、跨文档复制的链接和过期预览遗留的链接都会被拒绝，点击回写时还会重新读取开关设置；过期链接再也无法误勾选恰好排在同一行上的另一条任务。
- 新增 `markdownToolkit.kroki.darkMode` 设置：深色主题下反相显示图表配色，让图表融入编辑器而不是白底卡片。彩色元素会略微偏色。
- 修复：同一预览里超过 200 张不同的 Kroki 图表时，图表不再在缓存里互相淘汰并导致持续重新请求。
- 修复：Kroki 的暂时性失败（HTTP 429 与 5xx、网络错误和超时）在 30 秒后允许重试，不再缓存到重启扩展为止；HTTP 400 之类的图源错误保持原有行为。
- 修复：SVG 里以元素 id 为目标的样式（例如 `#node { fill: red }`）在 id 加作用域后仍然匹配，预览副本与原图保持一致。

## v0.0.2 2026-10-28

- 破坏性变更：`mermaid` 代码块不再由 beautiful-mermaid 渲染，改为交给 VS Code 内置的 Mermaid 渲染器，内置渲染器不可用时改由 Kroki 渲染。移除 `markdownToolkit.mermaid.enabled`、`markdownToolkit.mermaid.lightTheme` 和 `markdownToolkit.mermaid.darkTheme` 三个设置；需要选择 Mermaid 主题时，改用内置的 `markdown-mermaid.lightModeTheme` 和 `markdown-mermaid.darkModeTheme`。
- 插件安装包从 533 KB 缩小到 68 KB。
- 提示块支持 Obsidian 风格的 callout：标记后可写自定义标题，可用 `-` 或 `+` 折叠，并支持 `info`、`bug`、`example` 等其他类型。
- 新增 `H~2~O` 下标（`markdownToolkit.syntax.subscript`）与定义列表（`markdownToolkit.syntax.definitionLists`）的可选开关，默认关闭。

## v0.0.1 2026-10-28

- `mermaid` 代码块改由 beautiful-mermaid 渲染，默认取当前配色主题的颜色；不支持的图类型交回内置 Mermaid 渲染，没有内置渲染器时改由 Kroki 渲染。
- 通过可配置的 Kroki 服务器（默认 `https://kroki.io`）渲染 PlantUML、Graphviz、D2 等 Kroki 图表语言，以内联 SVG 输出并使用预览与编辑器字体。
- 图表右上角的源码菜单可以复制、另存或单独打开原始 SVG。
- `[TOC]` 或 `[[toc]]` 渲染为目录，并显示可折叠、随阅读位置高亮的悬浮目录栏。
- 任务列表显示为勾选框，在预览里点击即可勾选或取消源码中的任务。
- 渲染 GitHub 提示块、脚注与 Emoji 短码。
- 新增 `==高亮==`、`^上标^` 与 VitePress 风格容器的可选开关，默认关闭。
