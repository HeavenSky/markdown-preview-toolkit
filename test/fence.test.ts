import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { type FenceRenderer, fenceLang, installFenceRouter } from "../src/markdown/fence";
import { containerAttrs, escapeHtml, renderErrorBlock } from "../src/markdown/html";
import { createPreviewMd } from "./markdown-helpers";

const SAMPLE = [
	"# Title",
	"",
	"```js",
	"const a = 1;",
	"```",
	"",
	"```demo extra args",
	"x -> y",
	"```",
	"",
].join("\n");

const demoRenderer: FenceRenderer = block =>
	block.lang === "demo"
		? `<div${containerAttrs(block.token, "mtk-demo")}>${escapeHtml(block.source)}</div>`
		: undefined;

function render(renderers: FenceRenderer[] | undefined, source = SAMPLE): string {
	const { md, finish } = createPreviewMd();
	if (renderers) installFenceRouter(md, renderers);
	return finish().render(source);
}

describe("fenceLang", () => {
	it("取 info 首词并转小写", () => {
		expect(fenceLang("PlantUML title")).toBe("plantuml");
		expect(fenceLang("  dot  ")).toBe("dot");
		expect(fenceLang("")).toBe("");
	});
});

describe("installFenceRouter", () => {
	it("没有渲染器接管时输出与未安装路由完全一致", () => {
		expect(render([])).toBe(render(undefined));
		expect(render([() => undefined])).toBe(render(undefined));
	});

	it("按首词匹配接管, 保留 data-line 与 code-line", () => {
		const html = render([demoRenderer]);
		expect(html).toContain('<div data-line="6" class="code-line mtk-demo">x -&gt; y\n</div>');
		expect(html).toContain('<code data-line="2" class="code-line language-js">');
	});

	it("前一个渲染器放弃时询问下一个", () => {
		const calls: string[] = [];
		const html = render([
			block => {
				calls.push(`first:${block.lang}`);
				return undefined;
			},
			demoRenderer,
		]);
		expect(calls).toEqual(["first:js", "first:demo"]);
		expect(html).toContain("mtk-demo");
	});

	it("同一实例重复安装不会二次包装", () => {
		const { md, finish } = createPreviewMd();
		let count = 0;
		const counting: FenceRenderer = () => {
			count += 1;
			return undefined;
		};
		installFenceRouter(md, [counting]);
		installFenceRouter(md, [counting]);
		finish().render(SAMPLE);
		expect(count).toBe(2);
	});

	it("渲染器抛错时退回原始代码块", () => {
		const html = render([
			() => {
				throw new Error("boom");
			},
		]);
		expect(html).toBe(render(undefined));
	});

	it("重复渲染同一批 token 时不累积 class", () => {
		const { md, finish } = createPreviewMd();
		installFenceRouter(md, [demoRenderer]);
		finish();
		const tokens = md.parse(SAMPLE, {});
		const first = md.renderer.render(tokens, md.options, {});
		const second = md.renderer.render(tokens, md.options, {});
		expect(second).toBe(first);
	});
});

describe("renderErrorBlock", () => {
	it("转义摘要与源码, 超长摘要截断", () => {
		const md = new MarkdownIt();
		const token = md.parse("```x\n<b>\n```", {})[0];
		if (!token) throw new Error("expected a fence token");
		const html = renderErrorBlock(token, `<script>${"e".repeat(600)}`, "<b>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("…</p>");
		expect(html).toContain("<code>&lt;b&gt;</code>");
		expect(html).not.toContain("<script>");
	});
});

describe("renderToolsMenu", () => {
	it("输出可展开的菜单与三个转义后的链接", async () => {
		const { renderToolsMenu } = await import("../src/markdown/tools");
		const html = renderToolsMenu(
			{ copy: "vscode://x/diagram-source?action=copy&id=a", save: "s", open: "o" },
			{ title: "Source", copy: "Copy SVG", save: "Save SVG…", open: "<Open>" }
		);
		expect(html).toMatch(
			/<summary title="Source" aria-label="Source"><svg class="mtk-diagram-tools-icon"[^>]*aria-hidden="true">(<path d="[^"]+"\/>){3}<\/svg><\/summary>/
		);
		expect(html).toContain(
			'href="vscode://x/diagram-source?action=copy&amp;id=a">Copy SVG</a>'
		);
		expect(html).toContain("&lt;Open&gt;</a>");
	});
});
