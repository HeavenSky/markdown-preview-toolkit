import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import { refreshPreview } from "../../shared/preview";
import type { UriRouter } from "../../shared/uri";
import { buildToggleQuery, parseToggleQuery, planToggle } from "./line";
import { type TaskRenderOptions, installTaskList } from "./rule";

const SECTION = "markdownToolkit.taskList";
const TOGGLE_PATH = "/toggle-task";

/** 核心渲染时在 env 里放了当前文档的 URI; 按形状判断, 不依赖与核心共享同一个 Uri 类。 */
function currentDocument(env: unknown): string | undefined {
	if (typeof env !== "object" || env === null) return undefined;
	const value = (env as { currentDocument?: { scheme?: unknown; toString(): string } })
		.currentDocument;
	return value && typeof value.scheme === "string" ? value.toString() : undefined;
}

/** 预览里的勾选框包在 `vscode://` 链接里, 点击后由本处理器校验并改写源码中的那一个字符。 */
async function handleToggle(uri: vscode.Uri): Promise<void> {
	const request = parseToggleQuery(uri.query);
	if (!request) return;
	const outdated = () =>
		void vscode.window.showWarningMessage(
			vscode.l10n.t("The preview is out of date. Refresh and try again.")
		);

	let document: vscode.TextDocument;
	try {
		document = await vscode.workspace.openTextDocument(vscode.Uri.parse(request.doc, true));
	} catch {
		outdated();
		return;
	}
	if (document.languageId !== "markdown" || request.line >= document.lineCount) {
		outdated();
		return;
	}
	const plan = planToggle(document.lineAt(request.line).text, request.checked);
	if (!plan) {
		outdated();
		return;
	}
	const edit = new vscode.WorkspaceEdit();
	const start = new vscode.Position(request.line, plan.offset);
	edit.replace(document.uri, new vscode.Range(start, start.translate(0, 1)), plan.replacement);
	await vscode.workspace.applyEdit(edit);
}

export interface TaskListFeature {
	install(md: MarkdownIt): void;
}

export function registerTaskList(
	context: vscode.ExtensionContext,
	router: UriRouter
): TaskListFeature {
	const base = router.route(TOGGLE_PATH, handleToggle);
	const options = (): TaskRenderOptions => {
		const config = vscode.workspace.getConfiguration(SECTION);
		const clickToToggle = config.get<boolean>("clickToToggle") === true;
		return {
			enabled: config.get<boolean>("enabled") === true,
			link: (env, meta) => {
				const doc = currentDocument(env);
				if (!clickToToggle || !doc || meta.line < 0) return undefined;
				return `${base}?${buildToggleQuery({ doc, line: meta.line, checked: meta.checked })}`;
			},
		};
	};

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(SECTION)) refreshPreview();
		})
	);
	return { install: md => installTaskList(md, options) };
}
