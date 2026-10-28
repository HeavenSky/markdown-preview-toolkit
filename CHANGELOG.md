# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## v0.0.2 2026-10-28

- Breaking: `mermaid` code blocks are no longer rendered by beautiful-mermaid; they go to VS Code's built-in Mermaid renderer, or to Kroki when it is unavailable. The `markdownToolkit.mermaid.enabled`, `markdownToolkit.mermaid.lightTheme` and `markdownToolkit.mermaid.darkTheme` settings are removed; to pick a Mermaid theme, use the built-in `markdown-mermaid.lightModeTheme` and `markdown-mermaid.darkModeTheme` settings instead.
- The extension package shrinks from 533 KB to 68 KB.
- Alerts now accept Obsidian-style callouts: a custom title after the marker, folding with `-` or `+`, and other types such as `info`, `bug` and `example`.
- Add opt-in settings for `H~2~O` subscript (`markdownToolkit.syntax.subscript`) and definition lists (`markdownToolkit.syntax.definitionLists`).

## v0.0.1 2026-10-28

- Render `mermaid` code blocks with beautiful-mermaid, colored from your current color theme by default; unsupported diagram types fall back to the built-in Mermaid renderer, or to Kroki where the built-in renderer is unavailable.
- Render PlantUML, Graphviz, D2 and other Kroki diagram languages through a configurable Kroki server (`https://kroki.io` by default), inlined as SVG that uses your preview and editor fonts.
- Copy, save or open any diagram as its original SVG from the source menu in its top-right corner.
- Replace `[TOC]` or `[[toc]]` with a table of contents, and show a collapsible outline that tracks the current section.
- Show task list items as checkboxes; click one in the preview to check or uncheck it in the source.
- Render GitHub alerts, footnotes and emoji shortcodes.
- Add opt-in settings for `==highlight==`, `^superscript^` and VitePress-style containers.
