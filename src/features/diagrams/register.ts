import * as vscode from "vscode";
import { type DiagramSource, type DiagramTools, renderToolsMenu } from "../../markdown/tools";
import { LruCache } from "../../shared/lru";
import type { UriRouter } from "../../shared/uri";

const STORE_CAPACITY = 300;
const PATH = "/diagram-source";

type Action = "copy" | "save" | "open";

/** 文件名只保留安全字符, 例: `plantuml-mtk-k1a2b3c4d.svg`。 */
function fileNameOf(source: DiagramSource): string {
	return `${source.type}-${source.id}.svg`.replace(/[^\w.-]+/g, "-");
}

/**
 * 图表的 `</>` 菜单: 渲染时登记原始 SVG, 点击菜单项时按标识取回并复制, 另存或用内置图片预览打开。
 *
 * 原始 SVG 只存在内存里; 超出容量或扩展重启后取不到, 此时提示刷新预览重新登记。
 */
export function registerDiagramTools(
	context: vscode.ExtensionContext,
	router: UriRouter
): DiagramTools {
	const store = new LruCache<string, DiagramSource>(STORE_CAPACITY);

	const handle = async (uri: vscode.Uri) => {
		const params = new URLSearchParams(uri.query);
		const action = params.get("action") as Action | null;
		const source = store.get(params.get("id") ?? "");
		if (!source) {
			void vscode.window.showWarningMessage(
				vscode.l10n.t(
					"This diagram is no longer available. Refresh the preview and try again."
				)
			);
			return;
		}
		const bytes = new TextEncoder().encode(source.svg);
		if (action === "copy") {
			await vscode.env.clipboard.writeText(source.svg);
			void vscode.window.showInformationMessage(
				vscode.l10n.t("SVG copied to the clipboard.")
			);
		} else if (action === "save") {
			const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
			const target = await vscode.window.showSaveDialog({
				defaultUri: folder ? vscode.Uri.joinPath(folder, fileNameOf(source)) : undefined,
				filters: { SVG: ["svg"] },
				saveLabel: vscode.l10n.t("Save SVG"),
			});
			if (target) await vscode.workspace.fs.writeFile(target, bytes);
		} else if (action === "open") {
			const target = vscode.Uri.joinPath(
				context.globalStorageUri,
				"diagrams",
				fileNameOf(source)
			);
			await vscode.workspace.fs.writeFile(target, bytes);
			await vscode.commands.executeCommand(
				"vscode.openWith",
				target,
				"imagePreview.previewEditor"
			);
		}
	};

	const base = router.route(PATH, handle);
	const link = (action: Action, id: string) => `${base}?${new URLSearchParams({ action, id })}`;
	const labels = () => ({
		title: vscode.l10n.t("Diagram source"),
		copy: vscode.l10n.t("Copy SVG"),
		save: vscode.l10n.t("Save SVG…"),
		open: vscode.l10n.t("Open SVG"),
	});

	return source => {
		store.set(source.id, source);
		return renderToolsMenu(
			{
				copy: link("copy", source.id),
				save: link("save", source.id),
				open: link("open", source.id),
			},
			labels()
		);
	};
}
