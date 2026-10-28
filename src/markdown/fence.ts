import type { MarkdownIt, Token } from "markdown-it";

/** 交给渲染器的一个围栏代码块。 */
export interface FenceBlock {
	/** info 字符串的首词, 小写; 例如 ```` ```PlantUML title ```` 得到 `plantuml`。 */
	readonly lang: string;
	readonly source: string;
	readonly token: Token;
	/** markdown-it 渲染环境; VS Code 预览在其中放了 `currentDocument` 等字段。 */
	readonly env: unknown;
}

/** 返回 HTML 表示接管该块; 返回 `undefined` 表示交给下一个渲染器, 最终交还原始 fence 规则。 */
export type FenceRenderer = (block: FenceBlock) => string | undefined;

const installed = new WeakSet<MarkdownIt>();

export function fenceLang(info: string): string {
	return info.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

/**
 * 改写 fence 渲染规则, 按注册顺序询问渲染器。
 *
 * 不接管的块原样交给改写前的规则, 因此内置 math 与 mermaid 这类同样挂在 fence 链路上的插件
 * 不受影响。同一个 md 实例只安装一次; VS Code 重建引擎时会传入新实例, 届时重新安装。
 */
export function installFenceRouter(md: MarkdownIt, renderers: readonly FenceRenderer[]): void {
	if (installed.has(md)) return;
	installed.add(md);

	const original = md.renderer.rules.fence;
	md.renderer.rules.fence = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const lang = token ? fenceLang(token.info) : "";
		if (token && lang) {
			const block: FenceBlock = { lang, source: token.content, token, env };
			for (const render of renderers) {
				let html: string | undefined;
				try {
					html = render(block);
				} catch (error) {
					// 渲染器自身的缺陷不应让整篇预览渲染失败; 退回原始代码块, 原因留在开发者工具里。
					console.error("[markdown-preview-toolkit] fence renderer failed", error);
					break;
				}
				if (html !== undefined) return html;
			}
		}
		return original
			? original(tokens, idx, options, env, self)
			: self.renderToken(tokens, idx, options);
	};
}
