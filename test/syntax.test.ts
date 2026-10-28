import { describe, expect, it } from "vitest";
import { ALERT_TYPES } from "../src/features/syntax/alerts";
import { type SyntaxFlags, installSyntax } from "../src/features/syntax/plugins";
import { createPreviewMd } from "./markdown-helpers";

const ALL: SyntaxFlags = {
	alerts: true,
	footnotes: true,
	emoji: true,
	mark: false,
	superscript: false,
	containers: false,
};
const LABELS = {
	note: "Note",
	tip: "Tip",
	important: "Important",
	warning: "Warning",
	caution: "Caution",
	info: "Info",
	danger: "Danger",
	details: "Details",
};

function render(markdown: string, flags: Partial<SyntaxFlags> = {}): string {
	const { md, finish } = createPreviewMd();
	installSyntax(md, { ...ALL, ...flags }, () => LABELS);
	return finish().render(markdown);
}

describe("GitHub 提示块", () => {
	it.each(ALERT_TYPES)("%s 渲染为带图标与标题的提示块", type => {
		const html = render(`> [!${type.toUpperCase()}]\n> Body text.\n`);
		expect(html).toMatch(
			new RegExp(`<div class="markdown-alert markdown-alert-${type} code-line" data-line="0"`)
		);
		expect(html).toContain(`<p class="markdown-alert-title"><svg class="octicon"`);
		expect(html).toContain(`</svg>${LABELS[type]}</p>`);
		expect(html).toContain("Body text.");
		expect(html).not.toContain("[!");
		expect(html).not.toContain("<blockquote");
	});

	it("类型不分大小写, 只有标记时渲染为空提示块", () => {
		const html = render("> [!tip]\n");
		expect(html).toContain("markdown-alert-tip");
		expect(html).toContain("</svg>Tip</p>");
		expect(html).not.toContain("<p></p>");
	});

	it.each(["> [!NOTE] same line\n", "> Text first\n> [!NOTE]\n", "> [!UNKNOWN]\n> body\n"])(
		"不识别: %j",
		source => {
			const html = render(source);
			expect(html).toContain("<blockquote");
			expect(html).not.toContain("markdown-alert");
		}
	);

	it("普通引用块不受影响, 列表中的提示块同样识别", () => {
		expect(render("> plain quote\n")).toContain("<blockquote");
		const html = render("- item\n\n  > [!WARNING]\n  > careful\n");
		expect(html).toContain("markdown-alert-warning");
		expect(html).toContain("careful");
	});

	it("标题文本转义", () => {
		const { md, finish } = createPreviewMd();
		installSyntax(md, ALL, () => ({ ...LABELS, note: "<b>" }));
		expect(finish().render("> [!NOTE]\n> x\n")).toContain("</svg>&lt;b&gt;</p>");
	});
});

describe("脚注与 Emoji", () => {
	it("脚注生成上标链接与文末列表", () => {
		const html = render("Text[^1].\n\n[^1]: The note.\n");
		expect(html).toContain('<sup class="footnote-ref"><a href="#fn1" id="fnref1">');
		expect(html).toContain('<section class="footnotes">');
		expect(html).toContain("The note.");
	});

	it("Emoji 短码转换, 代码与表情符号不转换", () => {
		const html = render("Hi :smile: and `:smile:` and :)\n");
		expect(html).toContain("Hi 😄 and");
		expect(html).toContain("<code>:smile:</code>");
		expect(html).toContain("and :)");
	});
});

describe("开关", () => {
	it("关闭后对应语法保持原文", () => {
		const html = render("> [!NOTE]\n> x\n\nText[^1] :smile:\n\n[^1]: n\n", {
			alerts: false,
			footnotes: false,
			emoji: false,
		});
		expect(html).toContain("<blockquote");
		expect(html).toContain("[!NOTE]");
		expect(html).toContain(":smile:");
		expect(html).not.toContain("footnote-ref");
	});

	it("清单里的开关与解析期开关一一对应", async () => {
		const { readFileSync } = await import("node:fs");
		const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
		const props = pkg.contributes.configuration.properties;
		for (const key of ["alerts.enabled", "footnotes.enabled", "emoji.enabled"]) {
			expect(props[`markdownToolkit.${key}`]?.default).toBe(true);
		}
	});
});

describe("可选语法", () => {
	const ON = { mark: true, superscript: true, containers: true };

	it("关闭时高亮, 上标与容器保持原文", () => {
		const html = render("==hi== x^2^\n\n::: tip\nbody\n:::\n");
		expect(html).toContain("==hi==");
		expect(html).toContain("x^2^");
		expect(html).toContain("::: tip");
		expect(html).not.toContain("<mark>");
	});

	it("开启后输出 mark, sup 与容器结构", () => {
		const html = render("==hi== x^2^\n\n::: tip\nbody\n:::\n", ON);
		expect(html).toContain("<mark>hi</mark>");
		expect(html).toContain("x<sup>2</sup>");
		expect(html).toContain(
			'<div data-line="2" class="code-line mtk-container mtk-container-tip"><p class="mtk-container-title">Tip</p>'
		);
		expect(html).toContain("body");
	});

	it.each(["info", "warning", "danger"])("容器 %s 使用默认标题", name => {
		const html = render(`::: ${name}\nx\n:::\n`, ON);
		expect(html).toContain(`mtk-container-${name}`);
		expect(html).toContain(
			`<p class="mtk-container-title">${name[0]?.toUpperCase()}${name.slice(1)}</p>`
		);
	});

	it("自定义标题被转义, details 输出折叠块", () => {
		expect(render("::: warning <b>Careful</b>\nx\n:::\n", ON)).toContain(
			'<p class="mtk-container-title">&lt;b&gt;Careful&lt;/b&gt;</p>'
		);
		const details = render("::: details Show me\nhidden\n:::\n", ON);
		expect(details).toContain(
			'<details data-line="0" class="code-line mtk-container mtk-container-details"><summary>Show me</summary>'
		);
		expect(details).toContain("</details>");
	});

	it("::: mermaid 不被容器接管", () => {
		expect(render("::: mermaid\ngraph TD\n:::\n", ON)).not.toContain("mtk-container");
	});

	it("脚注与上标在同一段落共存", () => {
		const html = render("Note[^1] and x^2^.\n\n[^1]: n\n", ON);
		expect(html).toContain('class="footnote-ref"');
		expect(html).toContain("x<sup>2</sup>");
	});
});
