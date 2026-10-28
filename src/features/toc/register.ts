import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import { refreshPreview } from "../../shared/preview";
import { type PreviewConfig, type TocSettings, installToc } from "./build";

const SECTION = "markdownToolkit.toc";

export interface TocFeature {
	install(md: MarkdownIt, previewConfig: () => PreviewConfig): void;
	readonly sidebarEnabled: () => boolean;
}

export function registerToc(context: vscode.ExtensionContext): TocFeature {
	const settings = (): TocSettings => {
		const config = vscode.workspace.getConfiguration(SECTION);
		return {
			minLevel: config.get<number>("minLevel") ?? 1,
			maxLevel: config.get<number>("maxLevel") ?? 3,
			sidebar: config.get<boolean>("sidebar") === true,
		};
	};
	const labels = () => ({
		title: vscode.l10n.t("Contents"),
		toggle: vscode.l10n.t("Show or hide the table of contents"),
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(SECTION)) refreshPreview();
		})
	);

	return {
		install: (md, previewConfig) => installToc(md, settings, labels, previewConfig),
		sidebarEnabled: () => settings().sidebar,
	};
}
