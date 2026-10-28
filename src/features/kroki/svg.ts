import { extractSvg, sanitizeSvg, scopeSvg } from "../../markdown/svg";
import { cacheKey } from "./resultCache";

const TEXT_FONT = "var(--markdown-font-family, sans-serif)";
const MONO_FONT = "var(--vscode-editor-font-family, monospace)";

/** 字体族名里带这些词的视为等宽字体, 改用编辑器字体, 以保住字符画与代码的对齐。 */
const MONO_HINTS = ["mono", "courier", "consol", "fixed", "code"];
const MONO_HINT = new RegExp(MONO_HINTS.join("|"), "i");

/** 同一张图在任意渲染里的基础前缀; 与缓存键同源, 源码或服务器变化时随之变化。 */
export function krokiPrefix(server: string, type: string, source: string): string {
	return `mtk-k${cacheKey(server, type, source).slice(0, 8)}`;
}

/** 预览显示用的副本与引擎输出的原始 SVG。 */
export interface PreparedKrokiSvg {
	readonly display: string;
	readonly source: string;
}

/** 已限定作用域的 `<style>` 中声明了等宽字体的选择器, 例: svgbob 的 `.svgbob text`。 */
function monoSelectors(svg: string): string[] {
	const selectors: string[] = [];
	for (const [, css = ""] of svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
		for (const [, selector = "", body = ""] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
			const family = body.match(/font-family\s*:\s*([^;}]+)/i)?.[1];
			if (family && MONO_HINT.test(family)) selectors.push(selector.trim());
		}
	}
	return selectors;
}

/**
 * 只用 CSS 覆盖字体, 不改写原图的任何属性: 普通文字用预览字体, 原本声明为等宽字体的文字用编辑器字体。
 *
 * 加 `!important` 才能压过 `style` 属性里的字体; 等宽规则的选择器特异性高于 `#前缀 text`, 因此优先生效。
 * `textLength` 与 `lengthAdjust` 是属性, CSS 改不了, 换字体后带这两个属性的文字(例: plantuml)会被压缩。
 */
export function fontOverrideCss(svg: string, prefix: string): string {
	const scope = `#${prefix}`;
	const byAttribute = MONO_HINTS.flatMap(hint => [
		`${scope} [font-family*="${hint}" i]`,
		`${scope} [font-family*="${hint}" i] text`,
		`${scope} [style*="${hint}" i]`,
		`${scope} [style*="${hint}" i] text`,
	]);
	const mono = [...byAttribute, ...monoSelectors(svg)].join(", ");
	return (
		`${scope} text, ${scope} tspan { font-family: ${TEXT_FONT} !important; }` +
		`${mono} { font-family: ${MONO_FONT} !important; }`
	);
}

/**
 * 把 Kroki 返回的 SVG 变成可以内联进预览的显示副本, 同时保留原始 SVG 供 `</>` 菜单使用。
 *
 * 显示副本只做必需的改动: 去掉脚本, 限定样式与 id 的作用域, 让图形随卡片缩放, 再注入覆盖字体的 CSS;
 * 引擎写的字体, `textLength`, 内嵌字体等全部原样保留。
 */
export function prepareKrokiSvg(text: string, prefix: string): PreparedKrokiSvg | undefined {
	const extracted = extractSvg(text);
	if (extracted === undefined) return undefined;
	const scoped = scopeSvg(sanitizeSvg(extracted), prefix);
	// 根元素允许溢出(编辑器字体可能比引擎排版时假设的略宽), svgbob 自带的白色背景矩形比画布更宽,
	// 溢出后会露出卡片之外; 卡片本身就是白底, 一并隐藏它。
	const backdrop = /\sclass="[^"]*\bbackdrop\b/.test(scoped)
		? `#${prefix} rect.backdrop{display:none}`
		: "";
	const display = scoped.replace(
		/^<svg\b[^>]*>/,
		root => `${root}<style>${fontOverrideCss(scoped, prefix)}${backdrop}</style>`
	);
	return { display, source: text.trim() };
}
