# 更新日志

[English](../CHANGELOG.md) · **简体中文**

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
