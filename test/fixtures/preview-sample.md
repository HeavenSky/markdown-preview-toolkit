# Preview sample

[TOC]

## Tasks

- [x] Render diagrams
- [ ] Write the release notes
    - [ ] Nested follow-up

## GitHub syntax

> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!CAUTION]
> Advises about risks or negative outcomes.

> [!faq]- Obsidian-style callout with a custom title
> Folded until you click the title.

Footnotes work too[^1], and so do emoji :rocket: :tada:.

[^1]: Rendered by markdown-it-footnote.

## Mermaid

```mermaid
flowchart LR
  A[Write Markdown] --> B{Diagram?}
  B -->|yes| C[Render inline]
  B -->|no| D[Plain text]
```

```mermaid
sequenceDiagram
  Editor->>Preview: update
  Preview-->>Editor: scroll sync
```

```mermaid
pie title Pets
  "Dogs" : 6
  "Cats" : 4
```

## Kroki

```plantuml
@startuml
Alice -> Bob: request
Bob --> Alice: response
@enduml
```

```dot
digraph G { rankdir=LR; editor -> preview -> kroki }
```

```d2
markdown -> kroki: POST
kroki -> preview: SVG
```

```svgbob
+-------+   +--------+
| Edit  |-->| Render |
+-------+   +--------+
```

## Optional syntax

These render only after you turn the `markdownToolkit.syntax.*` settings on: ==highlighted text==, E = mc^2^ and H~2~O.

Definition list
: A term followed by its definition.

::: tip
VitePress-style tip container.
:::

::: warning Custom title
A warning with its own title.
:::

::: details Click to expand
Hidden until opened.
:::

## Math

Inline $e^{i\pi} + 1 = 0$ and a block:

```math
\int_0^1 x^2 \, dx = \frac{1}{3}
```
