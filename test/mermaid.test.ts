import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	MERMAID_THEMES,
	type MermaidSettings,
	createMermaidRenderer,
	resolveTheme,
} from "../src/features/mermaid/render";
import { installFenceRouter } from "../src/markdown/fence";
import { createPreviewMd } from "./markdown-helpers";

const SUPPORTED = {
	flowchart: "flowchart LR\n  A[Start] --> B{OK?}\n  B -->|yes| C",
	state: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy",
	sequence: "sequenceDiagram\n  Alice->>Bob: hi\n  Bob-->>Alice: hello",
	class: "classDiagram\n  Animal <|-- Duck",
	er: "erDiagram\n  CUSTOMER ||--o{ ORDER : places",
	xychart: "xychart-beta\n  x-axis [a, b]\n  bar [1, 2]",
};

function render(
	markdown: string,
	settings: MermaidSettings = {
		enabled: true,
		theme: "github-dark",
		dark: true,
		builtinAvailable: true,
	}
): string {
	const { md, finish } = createPreviewMd();
	installFenceRouter(md, [createMermaidRenderer(() => settings).render]);
	return finish().render(markdown);
}

const fence = (source: string) => `\`\`\`mermaid\n${source}\n\`\`\`\n`;

describe("mermaid 渲染", () => {
	it.each(Object.entries(SUPPORTED))("支持的图类型 %s 渲染为内联 SVG", (_name, source) => {
		const html = render(fence(source));
		expect(html).toMatch(
			/<div data-line="0" class="code-line mtk-mermaid"><svg id="mtk-m[0-9a-f]{8}"/
		);
		expect(html).not.toContain("<pre");
	});

	it.each([
		'pie title Pets\n  "Dogs": 3',
		"gantt\n  title T\n  section A\n  t1 :a1, 2024-01-01, 3d",
	])("不支持的图类型交还原始 fence 规则: %s", source => {
		const html = render(fence(source));
		expect(html).toContain('<code data-line="0" class="code-line language-mermaid">');
		expect(html).not.toContain("<svg");
	});

	it("关闭开关时不接管", () => {
		const html = render(fence(SUPPORTED.flowchart), {
			enabled: false,
			theme: "github-dark",
			dark: true,
			builtinAvailable: true,
		});
		expect(html).toContain("language-mermaid");
	});

	it("根元素只有一个 style, 保留主题变量并限宽", () => {
		const html = render(fence(SUPPORTED.flowchart));
		const root = html.match(/<svg[^>]*>/)?.[0] ?? "";
		expect(root.match(/\sstyle="/g)).toHaveLength(1);
		expect(root).toMatch(/style="--bg:[^"]*;max-width:100%;height:auto;overflow:visible"/);
	});

	it("不联网取字体, 改用预览字体", () => {
		const html = render(fence(SUPPORTED.class));
		expect(html).not.toContain("fonts.googleapis.com");
		expect(html).not.toContain("@import");
		expect(html).toContain("var(--markdown-font-family, system-ui)");
	});

	it("样式选择器全部限定在本图根元素之下", () => {
		const html = render(fence(SUPPORTED.class));
		const id = html.match(/<svg id="([^"]+)"/)?.[1];
		const css = html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
		const selectors = [...css.matchAll(/(?:^|[{}])\s*([^{}]+?)\s*\{/g)].flatMap(match =>
			(match[1] ?? "").split(",").map(selector => selector.trim())
		);
		expect(selectors.length).toBeGreaterThan(0);
		for (const selector of selectors) expect(selector.startsWith(`#${id}`)).toBe(true);
	});

	it("同一文档内两张图的 id 互不相交, 引用都指向本图", () => {
		const html = render(
			fence(SUPPORTED.sequence) +
				"\n" +
				fence(SUPPORTED.sequence) +
				"\n" +
				fence(SUPPORTED.state)
		);
		const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(match => match[0]);
		expect(svgs).toHaveLength(3);
		const idSets = svgs.map(
			svg => new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]))
		);
		for (let i = 0; i < idSets.length; i++) {
			for (let j = i + 1; j < idSets.length; j++) {
				for (const id of idSets[i] ?? []) expect(idSets[j]?.has(id)).toBe(false);
			}
			for (const match of svgs[i]?.matchAll(/url\(#([^)]+)\)/g) ?? []) {
				expect(idSets[i]?.has(match[1])).toBe(true);
			}
		}
	});
});

describe("主题", () => {
	it("未知主题名回退到默认值", () => {
		expect(resolveTheme("dracula", "github-light")).toBe("dracula");
		expect(resolveTheme("no-such-theme", "github-light")).toBe("github-light");
		expect(resolveTheme(undefined, "github-dark")).toBe("github-dark");
	});

	it("不同主题输出不同配色", () => {
		const light = render(fence(SUPPORTED.flowchart), {
			enabled: true,
			theme: "github-light",
			dark: true,
			builtinAvailable: true,
		});
		const dark = render(fence(SUPPORTED.flowchart), {
			enabled: true,
			theme: "github-dark",
			dark: true,
			builtinAvailable: true,
		});
		expect(light).not.toBe(dark);
	});

	it("清单里的主题枚举与 beautiful-mermaid 的主题表一致", () => {
		const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
		const properties = pkg.contributes.configuration.properties;
		expect(properties["markdownToolkit.mermaid.lightTheme"].enum).toEqual(MERMAID_THEMES);
		expect(properties["markdownToolkit.mermaid.darkTheme"].enum).toEqual(MERMAID_THEMES);
	});
});

describe("内置 mermaid 不可用时的兜底", () => {
	const fallback = (block: { source: string }) =>
		`<div class="fallback">${block.source.split("\n")[0]}</div>\n`;
	const PIE = 'pie title Pets\n  "Dogs": 3';

	function renderWith(settings: MermaidSettings, source: string): string {
		const { md, finish } = createPreviewMd();
		installFenceRouter(md, [createMermaidRenderer(() => settings, fallback).render]);
		return finish().render(fence(source));
	}

	it("内置可用时, 不支持的图交还内置而不是兜底", () => {
		const html = renderWith(
			{ enabled: true, theme: "github-dark", dark: true, builtinAvailable: true },
			PIE
		);
		expect(html).toContain("language-mermaid");
		expect(html).not.toContain("fallback");
	});

	it("内置不可用时, 不支持的图交给兜底", () => {
		const html = renderWith(
			{ enabled: true, theme: "github-dark", dark: true, builtinAvailable: false },
			PIE
		);
		expect(html).toContain('<div class="fallback">pie title Pets</div>');
	});

	it("内置不可用且关闭 beautiful-mermaid 时, 全部交给兜底", () => {
		const html = renderWith(
			{ enabled: false, theme: "github-dark", dark: true, builtinAvailable: false },
			SUPPORTED.flowchart
		);
		expect(html).toContain('<div class="fallback">flowchart LR</div>');
	});

	it("支持的图仍由 beautiful-mermaid 渲染, 不走兜底", () => {
		const html = renderWith(
			{ enabled: true, theme: "github-dark", dark: true, builtinAvailable: false },
			SUPPORTED.flowchart
		);
		expect(html).toContain("mtk-mermaid");
		expect(html).not.toContain("fallback");
	});

	it("没有兜底时退回原始代码块", () => {
		const { md, finish } = createPreviewMd();
		const settings = {
			enabled: true,
			theme: "github-dark",
			dark: true,
			builtinAvailable: false,
		};
		installFenceRouter(md, [createMermaidRenderer(() => settings).render]);
		expect(finish().render(fence(PIE))).toContain("language-mermaid");
	});
});

describe("vscode 主题", () => {
	it("默认主题取编辑器配色变量, 不写死颜色", () => {
		const html = render(fence(SUPPORTED.flowchart), {
			enabled: true,
			theme: "vscode",
			dark: true,
			builtinAvailable: true,
		});
		expect(html).toContain("--bg:var(--vscode-editor-background, #0d1117)");
		expect(html).toContain("--fg:var(--vscode-editor-foreground, #e6edf3)");
		expect(resolveTheme("vscode", "github-dark")).toBe("vscode");
	});
});

describe("mermaid 的 </> 菜单", () => {
	it("登记 beautiful-mermaid 的原始输出, vscode 主题的颜色变量带兜底色", () => {
		const registered: Array<{ id: string; type: string; svg: string }> = [];
		const { md, finish } = createPreviewMd();
		const settings = { enabled: true, theme: "vscode", dark: false, builtinAvailable: true };
		installFenceRouter(md, [
			createMermaidRenderer(
				() => settings,
				undefined,
				source => {
					registered.push(source);
					return "<details>menu</details>";
				}
			).render,
		]);
		const html = finish().render(fence(SUPPORTED.flowchart));
		expect(html).toMatch(/class="code-line mtk-mermaid"><details>menu<\/details><svg/);
		expect(registered[0]?.type).toBe("mermaid");
		expect(registered[0]?.svg).toContain("fonts.googleapis.com");
		expect(registered[0]?.svg).toContain("var(--vscode-editor-background, #ffffff)");
	});
});
