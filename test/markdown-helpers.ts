import MarkdownItFactory, { type MarkdownIt } from "markdown-it";

/**
 * 构造一个接近 VS Code 预览引擎的 markdown-it 实例。
 *
 * 只模拟本扩展依赖的那部分核心行为: `html: true`; 渲染时给标题写 `id`(核心用自己的 slugifier,
 * 这里用 `core-` 前缀的简化版, 便于断言 id 来自核心而不是本扩展的兜底); sourcemap 插件给带
 * `map` 的 token 写 `data-line` 与 `code-line`。调用方先装本扩展的插件, 再调用 `finish` 挂上
 * 核心插件, 与 VS Code 先叠加扩展插件, 后挂核心插件的顺序一致。
 */
export function createPreviewMd(): { md: MarkdownIt; finish(): MarkdownIt } {
	const md = new MarkdownItFactory({ html: true });
	return {
		md,
		finish() {
			const original = md.renderer.rules.heading_open;
			md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
				const title = tokens[idx + 1]?.content ?? "";
				tokens[idx]?.attrSet("id", `core-${title.toLowerCase().replace(/\s+/g, "-")}`);
				return original
					? original(tokens, idx, options, env, self)
					: self.renderToken(tokens, idx, options);
			};
			md.core.ruler.push("test_source_map", state => {
				for (const token of state.tokens) {
					if (token.map && token.type !== "inline") {
						token.attrSet("data-line", String(token.map[0]));
						token.attrJoin("class", "code-line");
					}
				}
			});
			return md;
		},
	};
}
