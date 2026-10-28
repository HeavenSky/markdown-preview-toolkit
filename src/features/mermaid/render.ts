import { createHash } from "node:crypto";
import { THEMES, renderMermaidSVG } from "beautiful-mermaid";
import type { FenceRenderer } from "../../markdown/fence";
import { containerAttrs } from "../../markdown/html";
import { PrefixCounter, scopeSvg, withPrefix } from "../../markdown/svg";
import type { DiagramTools } from "../../markdown/tools";
import { LruCache } from "../../shared/lru";

/**
 * `vscode` 主题直接取编辑器的配色变量, 节点底色由 beautiful-mermaid 按前景与背景混出,
 * 因此深浅色与任何配色主题下都与预览背景协调; 其余是 beautiful-mermaid 自带的 15 套主题。
 */
export const VSCODE_THEME = "vscode";
/**
 * 变量带兜底色: 预览里取编辑器配色, 原始 SVG 另存或单独打开时没有这些变量, 退回与深浅色对应的
 * github-light / github-dark 配色。
 */
function vscodeColors(dark: boolean): { bg: string; fg: string; accent: string } {
	const fallback = THEMES[dark ? "github-dark" : "github-light"] ?? {
		bg: "#ffffff",
		fg: "#1f2328",
	};
	return {
		bg: `var(--vscode-editor-background, ${fallback.bg})`,
		fg: `var(--vscode-editor-foreground, ${fallback.fg})`,
		accent: `var(--vscode-textLink-foreground, ${fallback.accent ?? fallback.fg})`,
	};
}

export const MERMAID_THEMES: readonly string[] = [VSCODE_THEME, ...Object.keys(THEMES)];
export const DEFAULT_LIGHT_THEME = VSCODE_THEME;
export const DEFAULT_DARK_THEME = VSCODE_THEME;

const CACHE_CAPACITY = 100;

export interface MermaidSettings {
	readonly enabled: boolean;
	readonly theme: string;
	/** 当前是深色或高对比度深色主题; 决定 `vscode` 主题的兜底色。 */
	readonly dark: boolean;
	/** 内置(或 bierner)mermaid 扩展可用且仍处理 `mermaid` 语言。 */
	readonly builtinAvailable: boolean;
}

export function resolveTheme(name: string | undefined, fallback: string): string {
	return name !== undefined && MERMAID_THEMES.includes(name) ? name : fallback;
}

/**
 * 把 beautiful-mermaid 的 SVG 改造成可以安全内联进预览的形态。
 *
 * 原始输出会 `@import` Google Fonts; 这里删掉外部字体改用预览字体与编辑器等宽字体,
 * 再按共用规则限定样式与 id 的作用域。
 */
export function prepareMermaidSvg(svg: string, prefix: string): string {
	const local = svg
		.replace(/@import\s+url\([^)]*\)\s*;?/g, "")
		.replace(/'Inter'/g, "var(--markdown-font-family, system-ui)")
		.replace(/'JetBrains Mono'/g, "var(--vscode-editor-font-family, ui-monospace)");
	return scopeSvg(local, prefix);
}

function hashOf(theme: string, source: string): string {
	return createHash("sha256").update(theme).update("\0").update(source).digest("hex").slice(0, 8);
}

export interface MermaidRenderer {
	readonly render: FenceRenderer;
	clear(): void;
}

/**
 * 只接管 ```` ```mermaid ```` 块。beautiful-mermaid 不支持的图类型或语法错误会抛错; 关闭开关时同样不由它渲染。
 * 这两种情况下: 内置 mermaid 可用就返回 `undefined`, 由 fence 链路交还内置渲染与报错;
 * 不可用(VS Code 低于 1.121, 或内置扩展被禁用)时交给 `fallback`(Kroki 的 mermaid)。
 */
export function createMermaidRenderer(
	settings: () => MermaidSettings,
	fallback?: FenceRenderer,
	tools?: DiagramTools
): MermaidRenderer {
	// 失败结果同样缓存为 null, 免得每次渲染都重新解析一遍注定失败的源码。
	const cache = new LruCache<string, { display: string; source: string } | null>(CACHE_CAPACITY);
	const prefixes = new PrefixCounter();

	const render: FenceRenderer = block => {
		if (block.lang !== "mermaid") return undefined;
		const { enabled, theme, dark, builtinAvailable } = settings();
		const handOver = () => (builtinAvailable ? undefined : fallback?.(block));
		if (!enabled) return handOver();

		// vscode 主题的兜底色随深浅色变化, 深浅色也要进缓存键
		const variant = theme === VSCODE_THEME ? `${theme}-${dark ? "dark" : "light"}` : theme;
		const hash = hashOf(variant, block.source);
		const prefix = `mtk-m${hash}`;
		const key = `${variant}\0${block.source}`;
		let entry = cache.get(key);
		if (entry === undefined) {
			try {
				const colors = theme === VSCODE_THEME ? vscodeColors(dark) : THEMES[theme];
				const raw = renderMermaidSVG(block.source, { ...colors, transparent: true });
				entry = { display: prepareMermaidSvg(raw, prefix), source: raw };
			} catch {
				entry = null;
			}
			cache.set(key, entry);
		}
		if (entry === null) return handOver();

		const unique = withPrefix(entry.display, prefix, prefixes.next(block.env, prefix));
		const menu = tools?.({ id: prefix, type: "mermaid", svg: entry.source }) ?? "";
		return `<div${containerAttrs(block.token, "mtk-mermaid")}>${menu}${unique}</div>\n`;
	};

	return { render, clear: () => cache.clear() };
}
