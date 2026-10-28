import * as vscode from "vscode";

/**
 * 扩展的 `vscode://` URI 路由。
 *
 * 预览脚本无法直接调用扩展, 预览里的交互(勾选任务, 图表源码菜单)都以 `vscode://<扩展 id>/<路径>`
 * 链接交给扩展处理; 每个扩展只能注册一个 URI 处理器, 因此按路径分发。
 */
export type UriRoute = (uri: vscode.Uri) => Promise<void> | void;

export class UriRouter {
	readonly #routes = new Map<string, UriRoute>();
	readonly #base: string;

	constructor(context: vscode.ExtensionContext) {
		this.#base = `${vscode.env.uriScheme}://${context.extension.id}`;
		context.subscriptions.push(
			vscode.window.registerUriHandler({
				handleUri: uri => this.#routes.get(uri.path)?.(uri),
			})
		);
	}

	/** 登记路径并返回该路径的链接前缀(不含查询参数)。 */
	route(path: string, handler: UriRoute): string {
		this.#routes.set(path, handler);
		return `${this.#base}${path}`;
	}
}
