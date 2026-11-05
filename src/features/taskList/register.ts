import { randomUUID } from "node:crypto";
import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import { refreshPreview } from "../../shared/preview";
import type { UriRouter } from "../../shared/uri";
import { buildToggleQuery, parseToggleQuery, planToggle, toggleToken } from "./line";
import { type TaskRenderOptions, installTaskList } from "./rule";

const SECTION = "markdownToolkit.taskList";
const TOGGLE_PATH = "/toggle-task";

export interface TaskListFeature {
	install(md: MarkdownIt): void;
}

export function registerTaskList(
	context: vscode.ExtensionContext,
	router: UriRouter
): TaskListFeature {
	// 会话内随机的签发密钥: 只有本扩展渲染出的链接带有效操作标识, 手工构造的链接无法伪造
	const secret = randomUUID();
	const base = router.route(TOGGLE_PATH, uri => handleToggle(uri, secret));
	const options = (): TaskRenderOptions => {
		const config = vscode.workspace.getConfiguration(SECTION);
		const clickToToggle = config.get<boolean>("clickToToggle") === true;
		return {
			enabled: config.get<boolean>("enabled") === true,
			link: (env, meta) => {
				const doc = currentDocument(env);
				if (!clickToToggle || !doc || meta.line < 0) return undefined;
				const token = toggleToken(secret, doc, meta.line, meta.checked, meta.text);
				return `${base}?${buildToggleQuery({ doc, line: meta.line, checked: meta.checked, token })}`;
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

/** 核心渲染时在 env 里放了当前文档的 URI; 按形状判断, 不依赖与核心共享同一个 Uri 类。 */
function currentDocument(env: unknown): string | undefined {
	if (typeof env !== "object" || env === null) return undefined;
	const value = (env as { currentDocument?: { scheme?: unknown; toString(): string } })
		.currentDocument;
	return value && typeof value.scheme === "string" ? value.toString() : undefined;
}

/**
 * 预览里的勾选框包在 `vscode://` 链接里, 点击后由本处理器校验并改写源码中的那一个字符。
 *
 * 功能开关在处理时重读: 关闭回写后, 已渲染的旧链接也不再产生编辑;
 * 操作标识对不上(未由本扩展签发, 或该行原文已变)时按预览过期处理。
 */
async function handleToggle(uri: vscode.Uri, secret: string): Promise<void> {
	const request = parseToggleQuery(uri.query);
	if (!request) return;
	const config = vscode.workspace.getConfiguration(SECTION);
	if (config.get<boolean>("enabled") !== true || config.get<boolean>("clickToToggle") !== true)
		return;
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
	const text = document.lineAt(request.line).text;
	const expected = toggleToken(secret, request.doc, request.line, request.checked, text);
	if (expected !== request.token) {
		outdated();
		return;
	}
	const plan = planToggle(text, request.checked);
	if (!plan) {
		outdated();
		return;
	}
	const edit = new vscode.WorkspaceEdit();
	const start = new vscode.Position(request.line, plan.offset);
	edit.replace(document.uri, new vscode.Range(start, start.translate(0, 1)), plan.replacement);
	await vscode.workspace.applyEdit(edit);
}
