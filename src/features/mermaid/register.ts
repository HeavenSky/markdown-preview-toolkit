import * as vscode from "vscode";
import type { FenceRenderer } from "../../markdown/fence";
import { refreshPreview } from "../../shared/preview";
import { createMermaidRenderer } from "./render";

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

export function registerMermaid(
	context: vscode.ExtensionContext,
	fallback: FenceRenderer
): FenceRenderer {
	let builtinAvailable = detectBuiltinMermaid();
	const redetect = () => {
		const next = detectBuiltinMermaid();
		if (next === builtinAvailable) return;
		builtinAvailable = next;
		refreshPreview();
	};

	context.subscriptions.push(
		vscode.extensions.onDidChange(redetect),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(BUILTIN_SECTION)) redetect();
		})
	);
	return createMermaidRenderer(() => ({ builtinAvailable }), fallback);
}
