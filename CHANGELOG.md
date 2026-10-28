# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## v0.0.1 2026-10-28

- Render `mermaid` code blocks with beautiful-mermaid, colored from your current color theme by default; unsupported diagram types fall back to the built-in Mermaid renderer, or to Kroki where the built-in renderer is unavailable.
- Render PlantUML, Graphviz, D2 and other Kroki diagram languages through a configurable Kroki server (`https://kroki.io` by default), inlined as SVG that uses your preview and editor fonts.
- Copy, save or open any diagram as its original SVG from the source menu in its top-right corner.
- Replace `[TOC]` or `[[toc]]` with a table of contents, and show a collapsible outline that tracks the current section.
- Show task list items as checkboxes; click one in the preview to check or uncheck it in the source.
- Render GitHub alerts, footnotes and emoji shortcodes.
- Add opt-in settings for `==highlight==`, `^superscript^` and VitePress-style containers.
