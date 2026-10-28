import * as vscode from "vscode";
import type { FenceRenderer } from "../../markdown/fence";
import type { DiagramTools } from "../../markdown/tools";
import { refreshPreview } from "../../shared/preview";
import {
	DEFAULT_DARK_THEME,
	DEFAULT_LIGHT_THEME,
	type MermaidRenderer,
	createMermaidRenderer,
	resolveTheme,
} from "./render";

const SECTION = "markdownToolkit.mermaid";

/** VS Code 1.121 起内置的 mermaid 扩展, 以及更早版本上它的前身(市场扩展)。 */
const BUILTIN_MERMAID_IDS = ["vscode.mermaid-markdown-features", "bierner.markdown-mermaid"];
/** 二者共用的配置节, `languages` 决定它们接管哪些代码块语言。 */
const BUILTIN_SECTION = "markdown-mermaid";

/** 扩展已安装且启用(禁用的扩展不会被 getExtension 返回), 并且仍处理 `mermaid` 语言。 */
function detectBuiltinMermaid(): boolean {
	if (!BUILTIN_MERMAID_IDS.some(id => vscode.extensions.getExtension(id))) return false;
	const languages: unknown = vscode.workspace.getConfiguration(BUILTIN_SECTION).get("languages");
	return (
		!Array.isArray(languages) ||
		languages.some(lang => typeof lang === "string" && lang.toLowerCase() === "mermaid")
	);
}

function isDarkTheme(kind: vscode.ColorThemeKind): boolean {
	return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
}

export function registerMermaid(
	context: vscode.ExtensionContext,
	fallback: FenceRenderer,
	tools: DiagramTools
): MermaidRenderer {
	let builtinAvailable = detectBuiltinMermaid();
	const redetect = () => {
		const next = detectBuiltinMermaid();
		if (next === builtinAvailable) return;
		builtinAvailable = next;
		refreshPreview();
	};

	const renderer = createMermaidRenderer(
		() => {
			const config = vscode.workspace.getConfiguration(SECTION);
			const dark = isDarkTheme(vscode.window.activeColorTheme.kind);
			const theme = dark
				? resolveTheme(config.get<string>("darkTheme"), DEFAULT_DARK_THEME)
				: resolveTheme(config.get<string>("lightTheme"), DEFAULT_LIGHT_THEME);
			return {
				enabled: config.get<boolean>("enabled") === true,
				theme,
				dark,
				builtinAvailable,
			};
		},
		fallback,
		tools
	);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveColorTheme(refreshPreview),
		vscode.extensions.onDidChange(redetect),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(SECTION)) refreshPreview();
			if (event.affectsConfiguration(BUILTIN_SECTION)) redetect();
		})
	);
	return renderer;
}
