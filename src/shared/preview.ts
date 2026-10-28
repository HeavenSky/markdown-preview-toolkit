import * as vscode from "vscode";

/** 让已打开的 Markdown 预览按当前配置与缓存重新渲染。 */
export function refreshPreview(): void {
	void vscode.commands.executeCommand("markdown.preview.refresh");
}
