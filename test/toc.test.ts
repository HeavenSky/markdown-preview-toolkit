import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import {
	type PreviewConfig,
	type TocSettings,
	buildTocList,
	collectHeadings,
	githubSlug,
	installToc,
	levelRange,
} from "../src/features/toc/build";
import { createPreviewMd } from "./markdown-helpers";

const LABELS = { title: "Contents", toggle: "Toggle" };

function render(
	markdown: string,
	settings: Partial<TocSettings> = {},
	config: PreviewConfig = { tocSidebar: true }
): string {
	const { md, finish } = createPreviewMd();
	installToc(
		md,
		() => ({ minLevel: 1, maxLevel: 3, sidebar: true, ...settings }),
		() => LABELS,
		() => config
	);
	return finish().render(markdown);
}

const DOC = [
	"# Title",
	"",
	"[TOC]",
	"",
	"## Install",
	"",
	"### From `<source>`",
	"",
	"## Use",
	"",
].join("\n");

describe("[TOC] 标记", () => {
	it.each(["[TOC]", "[[toc]]", "[toc]", "[[TOC]]"])("独占一段的 %s 被替换为目录", marker => {
		const html = render(`# A\n\n${marker}\n\n## B\n`);
		expect(html).toContain(
			'<div data-line="2" class="code-line mtk-toc"><ul><li><a href="#core-a">A</a>'
		);
		expect(html).not.toContain(marker);
	});

	it.each(["Intro [TOC] here", "[TOC]\nfollowed by text", "    [TOC]", "[TOC]]"])(
		"不识别: %s",
		source => {
			const html = render(`# A\n\n${source}\n\n## B\n`);
			expect(html).not.toContain('mtk-toc"');
		}
	);
});

describe("目录生成", () => {
	it("链接 id 取核心写入的值, 标题文本转义", () => {
		const html = render(DOC);
		expect(html).toContain('<a href="#core-install">Install</a>');
		expect(html).toContain("From &lt;source&gt;</a>");
		expect(html).not.toContain("<source>");
	});

	it("按层级生成嵌套列表", () => {
		const list = buildTocList(
			[
				{ level: 1, text: "A", id: "a" },
				{ level: 2, text: "B", id: "b" },
				{ level: 3, text: "C", id: "c" },
				{ level: 2, text: "D", id: "d" },
			],
			[1, 3]
		);
		expect(list).toBe(
			'<ul><li><a href="#a">A</a><ul><li><a href="#b">B</a><ul><li><a href="#c">C</a></li></ul></li><li><a href="#d">D</a></li></ul></li></ul>'
		);
	});

	it("层级跳跃与首个标题较深时仍是合法嵌套", () => {
		const jump = buildTocList(
			[
				{ level: 1, text: "A", id: "a" },
				{ level: 3, text: "B", id: "b" },
				{ level: 2, text: "C", id: "c" },
			],
			[1, 3]
		);
		expect(jump).toBe(
			'<ul><li><a href="#a">A</a><ul><li><a href="#b">B</a></li><li><a href="#c">C</a></li></ul></li></ul>'
		);
		const deepFirst = buildTocList(
			[
				{ level: 3, text: "A", id: "a" },
				{ level: 2, text: "B", id: "b" },
				{ level: 3, text: "C", id: "c" },
			],
			[1, 3]
		);
		expect(deepFirst).toBe(
			'<ul><li><a href="#a">A</a></li><li><a href="#b">B</a><ul><li><a href="#c">C</a></li></ul></li></ul>'
		);
	});

	it("层级范围过滤, 上下界写反时交换并夹到 1-6", () => {
		const html = render(DOC, { minLevel: 3, maxLevel: 2 });
		expect(html).toContain("Install");
		expect(html).not.toContain('href="#core-title"');
		expect(levelRange({ minLevel: 0, maxLevel: 9, sidebar: true })).toEqual([1, 6]);
	});

	it("没有核心 id 时用 GitHub 风格 slug 兜底, 重复标题追加序号", () => {
		const md = new MarkdownIt();
		const headings = collectHeadings(
			md.parse("# Hello, World!\n\n# Hello, World!\n\n# `code` 中文", {})
		);
		expect(headings.map(heading => heading.id)).toEqual([
			"hello-world",
			"hello-world-1",
			"code-中文",
		]);
		const used = new Map<string, number>();
		expect(githubSlug("A b", used)).toBe("a-b");
	});
});

describe("悬浮目录栏与配置桥", () => {
	it("标题不少于 2 个时追加目录栏", () => {
		const html = render(DOC);
		expect(html).toContain('<nav class="mtk-toc-sidebar" aria-label="Contents">');
		expect(html).toContain('<a href="#core-use">Use</a>');
	});

	it("标题少于 2 个或关闭时不追加", () => {
		expect(render("# Only\n")).not.toContain("mtk-toc-sidebar");
		expect(render(DOC, { sidebar: false })).not.toContain("mtk-toc-sidebar");
	});

	it("配置桥是合法的转义 JSON", () => {
		const html = render(DOC, {}, { tocSidebar: true, codeCopy: false });
		const raw =
			html.match(/<div id="mtk-preview-config" hidden data-config="([^"]*)">/)?.[1] ?? "";
		const json = raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
		expect(JSON.parse(json)).toEqual({ tocSidebar: true, codeCopy: false });
	});

	it("重复渲染同一批 token 输出一致", () => {
		const { md, finish } = createPreviewMd();
		installToc(
			md,
			() => ({ minLevel: 1, maxLevel: 3, sidebar: true }),
			() => LABELS,
			() => ({ tocSidebar: true })
		);
		finish();
		const tokens = md.parse(DOC, {});
		expect(md.renderer.render(tokens, md.options, {})).toBe(
			md.renderer.render(tokens, md.options, {})
		);
	});
});
