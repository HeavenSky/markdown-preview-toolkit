# Markdown Preview Toolkit

[English](../README.md) · **简体中文**

> 插件市场页只显示英文版 README；插件界面会跟随 VS Code 的显示语言切换为中文。

图表、目录和 GitHub 风格的 Markdown 直接在 VS Code 内置预览里渲染，不必另装预览插件。

[![VS Marketplace](https://vsmarketplacebadges.dev/version-short/HeavenSky.markdown-preview-toolkit.svg?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.markdown-preview-toolkit)
[![Installs](https://vsmarketplacebadges.dev/installs-short/HeavenSky.markdown-preview-toolkit.svg)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.markdown-preview-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](../LICENSE.txt)

![Markdown 文件与右侧预览：目录、任务勾选框和 GitHub 提示块](../media/screenshots/preview.png)

## 开始使用

1. 从 [VS Code 插件市场](https://marketplace.visualstudio.com/items?itemName=HeavenSky.markdown-preview-toolkit)安装。需要 VS Code 1.101 或更高版本。
2. 打开一个 Markdown 文件，执行 **Markdown: Open Preview to the Side**。
3. 预览会渲染下文介绍的各类内容，其余部分与原来完全一样。

## 用 beautiful-mermaid 渲染 Mermaid

`mermaid` 代码块由 [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) 渲染成清晰的内联 SVG，支持流程图、状态图、时序图、类图、ER 图和 XY 图表。图表默认直接取当前配色主题的颜色，浅色和深色模式下都与预览背景融为一体；也可以为两种模式分别从 beautiful-mermaid 的 15 套主题中挑选。

beautiful-mermaid 不支持的图类型（如 `pie`、`gantt`、`mindmap`）交给 VS Code 内置的 Mermaid 渲染器，所以每张图都能显示。没有内置渲染器的 VS Code 版本（1.121 之前），或内置渲染器被禁用时，改由 Kroki 渲染。关闭 `markdownToolkit.mermaid.enabled` 后，全部 Mermaid 代码块都交回内置渲染。

## 用 Kroki 渲染 PlantUML、Graphviz、D2 等图表

凡是用 [Kroki 支持的图表语言](https://kroki.io/#support)写的代码块，都会渲染成内联 SVG 并显示在白底卡片上：`plantuml`、`graphviz` 或 `dot`、`d2`、`bpmn`、`excalidraw`、`nomnoml`、`wavedrom` 等。预览时用 CSS 把文字换成预览字体、等宽文字换成编辑器字体，SVG 本身保持 Kroki 返回的原样；固定了文字宽度的图（如 PlantUML）文字可能略显拥挤。首次渲染先显示占位，图表返回后预览立即刷新；源码不变就一直使用缓存。

![预览中由 Kroki 渲染的 PlantUML、Graphviz 和 D2 图表](../media/screenshots/preview-scrolled.png)

**默认会把图表源码发送到公共服务器 `https://kroki.io`。** 想让图表留在本机，就在本地运行 Kroki，并把 `markdownToolkit.kroki.server` 指向它：

```bash
docker run -d --name kroki -p 8000:8000 yuzutech/kroki
```

```json
{ "markdownToolkit.kroki.server": "http://localhost:8000" }
```

BPMN、Excalidraw 和 diagrams.net 还需要 Kroki 的配套容器（`yuzutech/kroki-bpmn`、`yuzutech/kroki-excalidraw`、`yuzutech/kroki-diagramsnet`），见 [Kroki 安装文档](https://docs.kroki.io/kroki/setup/use-docker-or-podman/)。用 `markdownToolkit.kroki.languages` 可以映射更多语言名；Kroki 服务器的渲染结果有变化时（例如升级或更换服务器），执行 **Markdown Preview Toolkit: 清空图表缓存并刷新预览**。

## 把图表复制、另存或单独打开为 SVG

鼠标悬停在图表上，点击右上角的源码图标，可以复制 SVG 源码、另存为 `.svg` 文件，或在 VS Code 的图片查看器中单独打开。拿到的始终是 beautiful-mermaid 或 Kroki 输出的原始 SVG，而不是预览里改过样式的副本。第一次使用时，VS Code 会询问是否允许插件打开 `vscode://` 链接，勾选 **Do not ask me again for this extension** 后不再询问。

![PlantUML 图表上的源码菜单：复制、另存与单独查看 SVG](../media/screenshots/source-menu.png)

## 用目录浏览长文档

在单独一行写 `[TOC]` 或 `[[toc]]`，预览会把它换成带链接的嵌套目录。预览右上角还有一个悬浮目录栏：它高亮你正在阅读的章节，在较窄的预览里收起成一个按钮，点击条目即可跳到对应标题。

用 `markdownToolkit.toc.minLevel` 和 `markdownToolkit.toc.maxLevel` 选择收录的标题级别（默认 1 到 3），或用 `markdownToolkit.toc.sidebar` 关掉悬浮目录栏。Markdown 源文件不会被修改。

## 在预览里勾选任务

以 `[ ]` 或 `[x]` 开头的列表项会显示为勾选框。在预览里点击勾选框，Markdown 文件中对应的 `[ ]` 或 `[x]` 就会切换；改动写入文件但不自动保存，可以像普通编辑一样撤销。

第一次点击时，VS Code 会询问是否允许插件打开一个 `vscode://` 链接，因为预览正是通过这个链接通知插件的。勾选 **Do not ask me again for this extension** 后就不再询问。关闭 `markdownToolkit.taskList.clickToToggle` 后，勾选框变为只读。

![在预览里点击勾选框后，源码中的任务随之勾选](../media/screenshots/task.png)

## 写出与 GitHub 渲染一致的 Markdown

提示块、脚注和 Emoji 短码按 GitHub 的效果渲染，内置预览只会把它们显示成普通文字：

- 提示块：`> [!NOTE]`、`> [!TIP]`、`> [!IMPORTANT]`、`> [!WARNING]` 和 `> [!CAUTION]` 变成带图标的彩色提示框。
- 脚注：`[^1]` 变成带链接的上标，脚注内容汇总在文末。
- Emoji 短码：`:rocket:` 变成 🚀。`:)` 这类表情符号保持原样。

每项各有一个设置（`markdownToolkit.alerts.enabled`、`markdownToolkit.footnotes.enabled`、`markdownToolkit.emoji.enabled`），修改后已打开的预览立即更新。

## 按需开启更多语法

三种不属于 GitHub 的扩展语法默认关闭，以免文件换个地方就渲染不出来。文档用到它们时再在设置中开启：

- `markdownToolkit.syntax.mark`：`==高亮文字==`
- `markdownToolkit.syntax.superscript`：`E = mc^2^`
- `markdownToolkit.syntax.containers`：VitePress 风格的 `::: tip`、`::: info`、`::: warning`、`::: danger` 和 `::: details`，名字后可以跟自定义标题，例如 `::: warning 先看这里`

![预览中的高亮文字、上标，以及 tip、warning、details 容器](../media/screenshots/optional.png)

## 不适合的场景

本插件只扩展内置预览。需要独立的预览窗口和导出功能时，请改用 Markdown Preview Enhanced 这类专门插件。

## 了解更多

命令与设置列在插件市场页的 **Feature Contributions** 标签里。每个版本的改动见[更新日志](./CHANGELOG.md)。

## 许可证

[MIT](../LICENSE.txt)
