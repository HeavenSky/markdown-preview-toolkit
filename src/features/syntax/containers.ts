import type { MarkdownIt, Token } from "markdown-it";
import container from "markdown-it-container";
import { containerAttrs, escapeHtml } from "../../markdown/html";

/** VitePress 风格的容器名; 不注册 `mermaid`, 内置 mermaid 的 `::: mermaid` 写法不受影响。 */
export const CONTAINER_NAMES = ["tip", "info", "warning", "danger", "details"] as const;
export type ContainerName = (typeof CONTAINER_NAMES)[number];

/** `::: warning 自定义标题` 中名字之后的部分; 为空时用默认标题。 */
function customTitle(info: string, name: string): string {
	return info.trim().slice(name.length).trim();
}

export function installContainers(
	md: MarkdownIt,
	labels: () => Readonly<Record<ContainerName, string>>
): void {
	for (const name of CONTAINER_NAMES) {
		md.use(container, name, {
			render(tokens: Token[], idx: number) {
				const token = tokens[idx];
				if (!token) return "";
				const className = `mtk-container mtk-container-${name}`;
				if (token.nesting !== 1) return name === "details" ? "</details>\n" : "</div>\n";
				const title = escapeHtml(customTitle(token.info, name) || labels()[name]);
				return name === "details"
					? `<details${containerAttrs(token, className)}><summary>${title}</summary>\n`
					: `<div${containerAttrs(token, className)}><p class="mtk-container-title">${title}</p>\n`;
			},
		});
	}
}
