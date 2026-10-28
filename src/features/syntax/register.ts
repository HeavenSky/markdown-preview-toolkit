import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import { type SyntaxLabels, installSyntax } from "./plugins";

/**
 * 解析期生效的语法开关。它们决定引擎上装哪些插件, 而核心按文档版本缓存解析结果,
 * 所以只在 `extendMarkdownIt`(引擎构建)时读取, 变化时让内置 Markdown 扩展重建引擎。
 */
const PARSE_TIME_KEYS = [
	"alerts.enabled",
	"footnotes.enabled",
	"emoji.enabled",
	"syntax.mark",
	"syntax.superscript",
	"syntax.subscript",
	"syntax.containers",
	"syntax.definitionLists",
] as const;

const SECTION = "markdownToolkit";

export interface SyntaxFeature {
	install(md: MarkdownIt): void;
}

export function registerSyntax(context: vscode.ExtensionContext): SyntaxFeature {
	const labels = (): SyntaxLabels => ({
		note: vscode.l10n.t("Note"),
		tip: vscode.l10n.t("Tip"),
		important: vscode.l10n.t("Important"),
		warning: vscode.l10n.t("Warning"),
		caution: vscode.l10n.t("Caution"),
		info: vscode.l10n.t("Info"),
		danger: vscode.l10n.t("Danger"),
		details: vscode.l10n.t("Details"),
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (PARSE_TIME_KEYS.some(key => event.affectsConfiguration(`${SECTION}.${key}`))) {
				void vscode.commands.executeCommand("markdown.api.reloadPlugins");
			}
		})
	);

	return {
		install(md) {
			const config = vscode.workspace.getConfiguration(SECTION);
			const enabled = (key: (typeof PARSE_TIME_KEYS)[number]) =>
				config.get<boolean>(key) === true;
			installSyntax(
				md,
				{
					alerts: enabled("alerts.enabled"),
					footnotes: enabled("footnotes.enabled"),
					emoji: enabled("emoji.enabled"),
					mark: enabled("syntax.mark"),
					superscript: enabled("syntax.superscript"),
					subscript: enabled("syntax.subscript"),
					containers: enabled("syntax.containers"),
					definitionLists: enabled("syntax.definitionLists"),
				},
				labels
			);
		},
	};
}
