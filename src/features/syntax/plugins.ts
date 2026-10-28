import type { MarkdownIt } from "markdown-it";
import { full as emoji } from "markdown-it-emoji";
import footnote from "markdown-it-footnote";
import mark from "markdown-it-mark";
import sup from "markdown-it-sup";
import { type AlertType, installAlerts } from "./alerts";
import { type ContainerName, installContainers } from "./containers";

/** 解析期语法开关; 每个为 true 的开关在引擎上装一个插件。 */
export interface SyntaxFlags {
	readonly alerts: boolean;
	readonly footnotes: boolean;
	readonly emoji: boolean;
	readonly mark: boolean;
	readonly superscript: boolean;
	readonly containers: boolean;
}

export type SyntaxLabels = Readonly<Record<AlertType | ContainerName, string>>;

export function installSyntax(
	md: MarkdownIt,
	flags: SyntaxFlags,
	labels: () => SyntaxLabels
): void {
	if (flags.alerts) installAlerts(md, labels);
	if (flags.footnotes) md.use(footnote);
	// 不转换 `:)` 这类表情符号, 与 GitHub 一致, 只认 `:smile:` 形式的短码
	if (flags.emoji) md.use(emoji, { shortcuts: {} });
	if (flags.mark) md.use(mark);
	if (flags.superscript) md.use(sup);
	if (flags.containers) installContainers(md, labels);
}
