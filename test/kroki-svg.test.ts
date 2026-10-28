import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fontOverrideCss, prepareKrokiSvg } from "../src/features/kroki/svg";
import { extractSvg, labelSvg, sanitizeSvg, scopeSvg } from "../src/markdown/svg";

/** 样本是 2026-10-28 从 https://kroki.io 以 POST /{type}/svg 实际取回的输出。 */
const sample = (name: string) =>
	readFileSync(new URL(`./fixtures/kroki/${name}.svg`, import.meta.url), "utf8");

const PREFIX = "mtk-ktest";
const NAMES = ["graphviz", "plantuml", "svgbob", "d2"];

const display = (name: string) => prepareKrokiSvg(sample(name), PREFIX)?.display ?? "";
const rootOf = (svg: string) => svg.match(/^<svg[^>]*>/)?.[0] ?? "";
/** 注入的覆盖样式紧跟在根元素之后。 */
const injectedCss = (svg: string) => svg.match(/^<svg[^>]*><style>([^<]*)<\/style>/)?.[1] ?? "";

describe("Kroki SVG 显示副本", () => {
	it.each(NAMES)("%s: 去掉前缀内容, 根元素带前缀 id 并限宽", name => {
		const svg = display(name);
		expect(rootOf(svg)).toContain(` id="${PREFIX}"`);
		expect(svg.endsWith("</svg>")).toBe(true);
		expect(svg).not.toContain("<?xml");
		expect(svg).not.toContain("<!DOCTYPE");
		expect(rootOf(svg)).toMatch(/max-width:100%;height:auto;overflow:visible"/);
	});

	it.each(NAMES)("%s: 引擎写的字体, textLength 与内嵌字体原样保留", name => {
		const raw = sample(name);
		const svg = display(name);
		for (const match of raw.matchAll(/font-family="[^"]*"/g)) expect(svg).toContain(match[0]);
		const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
		expect(count(svg, /textLength="/g)).toBe(count(raw, /textLength="/g));
		expect(count(svg, /lengthAdjust="/g)).toBe(count(raw, /lengthAdjust="/g));
		expect(count(svg, /@font-face/g)).toBe(count(raw, /@font-face/g));
	});

	it.each(NAMES)("%s: 注入的 CSS 用 !important 覆盖为预览字体", name => {
		expect(injectedCss(display(name))).toContain(
			`#${PREFIX} text, #${PREFIX} tspan { font-family: var(--markdown-font-family, sans-serif) !important; }`
		);
	});

	it("原本声明为等宽字体的选择器与属性改用编辑器字体", () => {
		const css = injectedCss(display("svgbob"));
		expect(css).toContain(`#${PREFIX}.svgbob text`);
		expect(css).toContain(`#${PREFIX} [font-family*="mono" i] text`);
		expect(css).toContain(
			"{ font-family: var(--vscode-editor-font-family, monospace) !important; }"
		);
	});

	it("原始 SVG 保持引擎输出的完整内容", () => {
		const raw = sample("graphviz");
		expect(prepareKrokiSvg(raw, PREFIX)?.source).toBe(raw.trim());
	});

	it("plantuml 根元素写死的宽高不会覆盖限宽", () => {
		expect(rootOf(display("plantuml"))).toMatch(
			/style="width:119px;height:130px;background:#FFFFFF;max-width:100%;height:auto;overflow:visible"/
		);
	});

	it("svgbob: 以根元素自身 class 开头的选择器挂到根元素上, 样式能匹配", () => {
		expect(display("svgbob")).toContain(`#${PREFIX}.svgbob line, #${PREFIX} .svgbob line`);
	});

	it("svgbob: 隐藏自带的白色背景矩形, 只有宽高时补上 viewBox", () => {
		const svg = display("svgbob");
		expect(injectedCss(svg)).toContain(`#${PREFIX} rect.backdrop{display:none}`);
		expect(rootOf(svg)).toContain('viewBox="0 0 40 64"');
	});

	it("d2: 外层根元素没写宽度时按 viewBox 补上原始尺寸", () => {
		expect(rootOf(display("d2"))).toMatch(/^<svg id="mtk-ktest" width="255" height="455"/);
	});

	it("已写宽度或 viewBox 的根元素不重复补", () => {
		expect(rootOf(display("graphviz")).match(/\swidth="/g)).toHaveLength(1);
		expect(rootOf(display("plantuml")).match(/\sviewBox="/g)).toHaveLength(1);
	});

	it("不是 SVG 时返回 undefined", () => {
		expect(prepareKrokiSvg("<html>proxy error</html>", PREFIX)).toBeUndefined();
	});

	it("样式里声明等宽字体的规则被收进覆盖规则", () => {
		const css = fontOverrideCss(
			'<svg><style>.a text{font-family: "Fira Code"}</style></svg>',
			"p"
		);
		expect(css).toMatch(
			/\.a text \{ font-family: var\(--vscode-editor-font-family, monospace\) !important; \}$/
		);
	});
});

describe("通用 SVG 处理", () => {
	it("提取 svg 本体", () => {
		expect(extractSvg('<?xml version="1.0"?>\n<!-- c -->\n<svg a="1"><g/></svg>\n')).toBe(
			'<svg a="1"><g/></svg>'
		);
		expect(extractSvg("no svg here")).toBeUndefined();
	});

	it("去掉脚本, 事件属性与 javascript 链接", () => {
		const svg = sanitizeSvg(
			'<svg onload="alert(1)"><script>alert(2)</script><script href="x"/><a xlink:href="javascript:alert(3)"><rect onclick=\'x()\'/></a></svg>'
		);
		expect(svg).toBe('<svg><a xlink:href="#"><rect/></a></svg>');
	});

	it("根元素已有 id 时改写它, 并同步改写对它的引用", () => {
		const svg = scopeSvg(
			'<svg id="root" viewBox="0 0 1 1"><use href="#root"/><g id="x"/><use xlink:href="#x"/></svg>',
			"p1"
		);
		expect(svg).toBe(
			'<svg width="1" height="1" id="p1" viewBox="0 0 1 1" style="max-width:100%;height:auto;overflow:visible"><use href="#p1"/><g id="p1-x"/><use xlink:href="#p1-x"/></svg>'
		);
	});

	it("给根元素加上图片语义与名称", () => {
		expect(labelSvg('<svg id="a">x</svg>', 'a "b"')).toBe(
			'<svg role="img" aria-label="a &quot;b&quot;" id="a">x</svg>'
		);
	});
});
