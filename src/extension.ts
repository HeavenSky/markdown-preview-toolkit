/**
 * 扩展入口: 只做装配。
 *
 * 声明了 `markdown.markdownItPlugins` 后, 内置 Markdown 扩展会激活本扩展, 并对每个新建的
 * markdown-it 引擎调用返回值里的 `extendMarkdownIt`; 该函数必须同步返回同一个 md。
 */
import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import { registerDiagramTools } from "./features/diagrams/register";
import { registerKroki } from "./features/kroki/register";
import { registerMermaid } from "./features/mermaid/register";
import { registerSyntax } from "./features/syntax/register";
import { registerTaskList } from "./features/taskList/register";
import { registerToc } from "./features/toc/register";
import { type FenceRenderer, installFenceRouter } from "./markdown/fence";
import { refreshPreview } from "./shared/preview";
import { UriRouter } from "./shared/uri";

export function activate(context: vscode.ExtensionContext): {
	extendMarkdownIt(md: MarkdownIt): MarkdownIt;
} {
	const router = new UriRouter(context);
	const tools = registerDiagramTools(context, router);
	const kroki = registerKroki(context, tools);
	const mermaid = registerMermaid(context, kroki.renderMermaid);
	const toc = registerToc(context);
	const taskList = registerTaskList(context, router);
	const syntax = registerSyntax(context);
	const renderers: FenceRenderer[] = [mermaid, kroki.render];

	context.subscriptions.push(
		vscode.commands.registerCommand("markdownToolkit.clearDiagramCache", () => {
			kroki.clear();
			refreshPreview();
		})
	);

	return {
		extendMarkdownIt(md) {
			installFenceRouter(md, renderers);
			syntax.install(md);
			taskList.install(md);
			toc.install(md, () => ({ tocSidebar: toc.sidebarEnabled() }));
			return md;
		},
	};
}

export function deactivate(): void {
	// 资源都注册在 context.subscriptions 中, 由 VS Code 统一释放。
}
