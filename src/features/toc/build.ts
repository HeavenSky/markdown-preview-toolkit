import type { MarkdownIt, Token } from "markdown-it";
import { containerAttrs, escapeHtml } from "../../markdown/html";
import { TOC_TOKEN, tocBlockRule } from "./marker";

const PLACEHOLDER = "<!--markdown-toolkit:toc-->";

export interface TocSettings {
	readonly minLevel: number;
	readonly maxLevel: number;
	readonly sidebar: boolean;
}

/** 预览脚本无法读取设置, 经渲染结果末尾的隐藏元素传递它们需要的开关。 */
export interface PreviewConfig {
	readonly tocSidebar: boolean;
	readonly codeCopy?: boolean;
}

export interface TocLabels {
	readonly title: string;
	readonly toggle: string;
}

export interface Heading {
	readonly level: number;
	readonly text: string;
	readonly id: string;
}

const LEVEL_MIN = 1;
const LEVEL_MAX = 6;

/** 把配置的层级夹到 1-6, 上下界写反时交换。 */
export function levelRange(settings: TocSettings): [number, number] {
	const clamp = (value: number) =>
		Number.isFinite(value)
			? Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.trunc(value)))
			: LEVEL_MIN;
	const a = clamp(settings.minLevel);
	const b = clamp(settings.maxLevel);
	return a <= b ? [a, b] : [b, a];
}

function plainText(token: Token | undefined): string {
	if (!token) return "";
	if (token.children) return token.children.map(plainText).join("");
	return token.type === "text" || token.type === "code_inline" || token.type === "emoji"
		? token.content
		: "";
}

/** GitHub 风格的 slug, 仅在标题没有 id(非 VS Code 引擎)时兜底。 */
export function githubSlug(text: string, used: Map<string, number>): string {
	const base = text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.replace(/\s/g, "-");
	const count = used.get(base) ?? 0;
	used.set(base, count + 1);
	return count === 0 ? base : `${base}-${count}`;
}

/** 收集标题; id 优先取核心渲染时写在 token 上的值, 与预览里的锚点保持一致。 */
export function collectHeadings(tokens: readonly Token[]): Heading[] {
	const used = new Map<string, number>();
	const headings: Heading[] = [];
	tokens.forEach((token, index) => {
		if (token.type !== "heading_open") return;
		const level = Number(token.tag.slice(1));
		const text = plainText(tokens[index + 1]).trim();
		const slug = githubSlug(text, used);
		const id = token.attrGet("id");
		headings.push({ level, text, id: id === null ? slug : String(id) });
	});
	return headings;
}

/** 生成嵌套列表; 层级跳跃(h1 后直接 h3)只多嵌套一层, 保证结构合法。 */
export function buildTocList(headings: readonly Heading[], [min, max]: [number, number]): string {
	const items = headings.filter(heading => heading.level >= min && heading.level <= max);
	const stack: number[] = [];
	let html = "";
	for (const heading of items) {
		const top = stack[stack.length - 1];
		if (top === undefined || heading.level > top) {
			html += "<ul><li>";
			stack.push(heading.level);
		} else {
			// 只有比上一层更浅时才回退一层; 介于两层之间(h1 → h3 → h2)时留在当前层做兄弟项
			while (
				stack.length > 1 &&
				heading.level < (stack[stack.length - 1] ?? 0) &&
				heading.level <= (stack[stack.length - 2] ?? 0)
			) {
				html += "</li></ul>";
				stack.pop();
			}
			html += "</li><li>";
			stack[stack.length - 1] = Math.min(
				stack[stack.length - 1] ?? heading.level,
				heading.level
			);
		}
		html += `<a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`;
	}
	while (stack.pop() !== undefined) html += "</li></ul>";
	return html;
}

export function buildSidebar(list: string, labels: TocLabels): string {
	return (
		`<nav class="mtk-toc-sidebar" aria-label="${escapeHtml(labels.title)}">` +
		'<div class="mtk-toc-sidebar-header">' +
		`<span class="mtk-toc-sidebar-title">${escapeHtml(labels.title)}</span>` +
		`<button type="button" class="mtk-toc-sidebar-toggle" title="${escapeHtml(labels.toggle)}" aria-label="${escapeHtml(labels.toggle)}" aria-expanded="true"></button>` +
		"</div>" +
		`<div class="mtk-toc-sidebar-body">${list}</div>` +
		"</nav>\n"
	);
}

export function buildPreviewConfig(config: PreviewConfig): string {
	return `<div id="mtk-preview-config" hidden data-config="${escapeHtml(JSON.stringify(config))}"></div>\n`;
}

/**
 * 安装 `[TOC]` 块规则, 并包装 `md.renderer.render`: 先调用原渲染, 此时核心已给标题写入 id,
 * 再用这些 id 生成目录替换占位, 并在末尾追加悬浮目录栏与预览脚本配置。
 */
export function installToc(
	md: MarkdownIt,
	settings: () => TocSettings,
	labels: () => TocLabels,
	previewConfig: () => PreviewConfig
): void {
	md.block.ruler.before("paragraph", TOC_TOKEN, tocBlockRule);
	md.renderer.rules[TOC_TOKEN] = (tokens, idx) => {
		const token = tokens[idx];
		return token ? `<div${containerAttrs(token, "mtk-toc")}>${PLACEHOLDER}</div>\n` : "";
	};

	const render = md.renderer.render.bind(md.renderer);
	md.renderer.render = (tokens, options, env) => {
		let html = render(tokens, options, env);
		const current = settings();
		const [min, max] = levelRange(current);
		const headings = collectHeadings(tokens).filter(
			heading => heading.level >= min && heading.level <= max
		);
		const list = buildTocList(headings, [min, max]);
		html = html.split(PLACEHOLDER).join(list);
		if (current.sidebar && headings.length >= 2) html += buildSidebar(list, labels());
		return html + buildPreviewConfig(previewConfig());
	};
}
