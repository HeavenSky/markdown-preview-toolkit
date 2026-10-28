import { describe, expect, it } from "vitest";
import { type MermaidSettings, createMermaidRenderer } from "../src/features/mermaid/render";
import { type FenceRenderer, installFenceRouter } from "../src/markdown/fence";
import { createPreviewMd } from "./markdown-helpers";

const fallback: FenceRenderer = block =>
	`<div class="fallback">${block.source.split("\n")[0]}</div>\n`;
const fence = (lang: string, source: string) => `\`\`\`${lang}\n${source}\n\`\`\`\n`;
const PIE = 'pie title Pets\n  "Dogs": 3';

function render(settings: MermaidSettings, markdown: string, withFallback = true): string {
	const { md, finish } = createPreviewMd();
	installFenceRouter(md, [
		createMermaidRenderer(() => settings, withFallback ? fallback : undefined),
	]);
	return finish().render(markdown);
}

describe("mermaid 交给内置渲染或 Kroki 兜底", () => {
	it("内置可用时交还原始 fence 规则, 不走兜底", () => {
		const html = render({ builtinAvailable: true }, fence("mermaid", PIE));
		expect(html).toContain('<code data-line="0" class="code-line language-mermaid">');
		expect(html).not.toContain("fallback");
	});

	it("内置不可用时交给兜底", () => {
		const html = render({ builtinAvailable: false }, fence("mermaid", PIE));
		expect(html).toContain('<div class="fallback">pie title Pets</div>');
	});

	it("没有兜底时退回原始代码块", () => {
		const html = render({ builtinAvailable: false }, fence("mermaid", PIE), false);
		expect(html).toContain("language-mermaid");
	});

	it("其他语言不接管", () => {
		const html = render({ builtinAvailable: false }, fence("plantuml", "@startuml\n@enduml"));
		expect(html).toContain("language-plantuml");
		expect(html).not.toContain("fallback");
	});
});
