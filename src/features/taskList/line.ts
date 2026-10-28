/** 源码中的任务行: 可带引用前缀, 列表符号后跟 `[ ]` 或 `[x]`。 */
const TASK_LINE = /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\[)([ xX])\]/;

export interface ToggleRequest {
	readonly doc: string;
	readonly line: number;
	/** 点击时预览里显示的状态, 用来确认预览没有过期。 */
	readonly checked: boolean;
}

export function buildToggleQuery(request: ToggleRequest): string {
	const params = new URLSearchParams({
		doc: request.doc,
		line: String(request.line),
		checked: request.checked ? "1" : "0",
	});
	return params.toString();
}

export function parseToggleQuery(query: string): ToggleRequest | undefined {
	const params = new URLSearchParams(query);
	const doc = params.get("doc");
	const line = Number(params.get("line"));
	const checked = params.get("checked");
	if (!doc || !Number.isInteger(line) || line < 0 || (checked !== "0" && checked !== "1"))
		return undefined;
	return { doc, line, checked: checked === "1" };
}

/**
 * 计算切换该行任务状态要替换的那一个字符。
 *
 * 不是任务行, 或当前状态与预览显示的不一致(预览已过期)时返回 `undefined`, 不做任何改动。
 */
export function planToggle(
	lineText: string,
	expectedChecked: boolean
): { offset: number; replacement: string } | undefined {
	const match = TASK_LINE.exec(lineText);
	if (!match) return undefined;
	const checked = match[2] !== " ";
	if (checked !== expectedChecked) return undefined;
	return { offset: (match[1] ?? "").length, replacement: checked ? " " : "x" };
}
