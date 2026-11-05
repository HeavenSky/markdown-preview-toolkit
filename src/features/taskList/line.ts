import { createHash } from "node:crypto";

/** 源码中的任务行: 可带引用前缀, 列表符号后跟 `[ ]` 或 `[x]`。 */
const TASK_LINE = /^(\s*(?:>\s*)*(?:[-+*]|\d+[.)])\s+\[)([ xX])\]/;

export interface ToggleRequest {
	readonly doc: string;
	readonly line: number;
	/** 点击时预览里显示的状态, 用来确认预览没有过期。 */
	readonly checked: boolean;
	/** 会话内签发且绑定任务快照的操作标识; 伪造或过期的链接拿不到有效标识。 */
	readonly token: string;
}

/**
 * 计算一条任务回写链接的操作标识。
 *
 * 标识用只在扩展会话内存里存在的 `secret` 对文档, 行号, 勾选状态与该行原文做摘要:
 * 手工构造或转改 `doc` 等参数的链接对不上标识, 预览过期后该行原文已变的旧链接同样对不上。
 */
export function toggleToken(
	secret: string,
	doc: string,
	line: number,
	checked: boolean,
	lineText: string
): string {
	return createHash("sha256")
		.update(secret)
		.update("\0")
		.update(doc)
		.update("\0")
		.update(String(line))
		.update("\0")
		.update(checked ? "1" : "0")
		.update("\0")
		.update(lineText)
		.digest("hex")
		.slice(0, 32);
}

export function buildToggleQuery(request: ToggleRequest): string {
	const params = new URLSearchParams({
		doc: request.doc,
		line: String(request.line),
		checked: request.checked ? "1" : "0",
		token: request.token,
	});
	return params.toString();
}

export function parseToggleQuery(query: string): ToggleRequest | undefined {
	const params = new URLSearchParams(query);
	const doc = params.get("doc");
	const line = Number(params.get("line"));
	const checked = params.get("checked");
	const token = params.get("token");
	if (
		!doc ||
		!Number.isInteger(line) ||
		line < 0 ||
		(checked !== "0" && checked !== "1") ||
		!token
	)
		return undefined;
	return { doc, line, checked: checked === "1", token };
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
