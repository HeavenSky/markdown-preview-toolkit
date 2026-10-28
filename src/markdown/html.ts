import type { Token } from "markdown-it";

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, char => HTML_ESCAPES[char] ?? char);
}

/** 错误摘要最长保留的字符数; 超出部分以省略号代替, 避免把整段服务端响应塞进预览。 */
export const ERROR_MESSAGE_MAX_CHARS = 500;

export function truncate(text: string, maxChars: number): string {
	return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/**
 * 拼出自定义块外层容器的属性串(以空格开头), 保留 token 上已有的属性并追加 class。
 *
 * 核心的 sourcemap 插件把 `data-line` 与 `code-line` 写在 token 上, 预览靠它们同步滚动;
 * 这里只读不写 token —— 核心按文档版本缓存 token, 改写会在每次渲染时累积 class。
 */
export function containerAttrs(token: Token, className: string): string {
	const attrs = new Map<string, string>();
	for (const [name, raw] of token.attrs ?? []) {
		const value = String(raw);
		attrs.set(
			name,
			name === "class" && attrs.has(name) ? `${attrs.get(name)} ${value}` : value
		);
	}
	attrs.set("class", attrs.has("class") ? `${attrs.get("class")} ${className}` : className);
	return [...attrs]
		.map(([name, value]) => ` ${escapeHtml(name)}="${escapeHtml(value)}"`)
		.join("");
}

/** 渲染失败时的统一展示: 一行错误摘要加上原始源码, 不输出堆栈。 */
export function renderErrorBlock(token: Token, message: string, source: string): string {
	return (
		`<div${containerAttrs(token, "mtk-error")}>` +
		`<p class="mtk-error-message">${escapeHtml(truncate(message, ERROR_MESSAGE_MAX_CHARS))}</p>` +
		`<pre class="mtk-error-source"><code>${escapeHtml(source)}</code></pre>` +
		"</div>\n"
	);
}
