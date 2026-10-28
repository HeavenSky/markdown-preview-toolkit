import type { MarkdownIt, StateCore, Token } from "markdown-it";
import { escapeHtml } from "../../markdown/html";

export const TASK_TOKEN = "markdown_toolkit_task";

/** 列表项段落开头的 `[ ]`, `[x]` 或 `[X]`, 其后为空白或段落结束。 */
const MARKER = /^\[([ xX])\](?=\s|$)/;

// 用 type 而不是 interface: token.meta 要求带索引签名的对象类型
export type TaskMeta = {
	readonly checked: boolean;
	/** 原样保留的标记, 关闭功能时用来还原文本。 */
	readonly marker: string;
	/** 列表项在源码中的起始行(从 0 开始)。 */
	readonly line: number;
};

function isTaskMeta(value: unknown): value is TaskMeta {
	const meta = value as Partial<TaskMeta> | null;
	return (
		typeof meta?.checked === "boolean" &&
		typeof meta.marker === "string" &&
		typeof meta.line === "number"
	);
}

export interface TaskRenderOptions {
	readonly enabled: boolean;
	/** 返回点击回写用的链接; 无法回写(没有文档 URI 或关闭了点击回写)时返回 `undefined`。 */
	link(env: unknown, meta: TaskMeta): string | undefined;
}

function markListAsTaskList(tokens: Token[], itemIndex: number): void {
	const item = tokens[itemIndex];
	if (!item) return;
	for (let index = itemIndex - 1; index >= 0; index--) {
		const token = tokens[index];
		if (!token) continue;
		const isList = token.type === "bullet_list_open" || token.type === "ordered_list_open";
		if (isList && token.level === item.level - 1) {
			const classes = String(token.attrGet("class") ?? "").split(/\s+/);
			if (!classes.includes("contains-task-list"))
				token.attrJoin("class", "contains-task-list");
			return;
		}
	}
}

/**
 * 解析阶段识别任务项: 删去标记文本, 在段落开头插入自定义 token。
 *
 * 只做结构识别, 不读配置: 核心按文档版本缓存解析结果, 配置变化不会让缓存失效。
 */
export function taskListRule(state: StateCore): void {
	const tokens = state.tokens;
	for (let index = 2; index < tokens.length; index++) {
		const inline = tokens[index];
		const paragraph = tokens[index - 1];
		const item = tokens[index - 2];
		if (
			inline?.type !== "inline" ||
			paragraph?.type !== "paragraph_open" ||
			item?.type !== "list_item_open"
		) {
			continue;
		}
		const first = inline.children?.[0];
		if (!first || first.type !== "text") continue;
		const match = MARKER.exec(first.content);
		if (!match) continue;

		first.content = first.content.slice(match[0].length).replace(/^\s/, "");
		inline.content = inline.content.slice(match[0].length).replace(/^\s/, "");
		const task = new state.Token(TASK_TOKEN, "input", 0);
		const meta: TaskMeta = {
			checked: match[1] !== " ",
			marker: match[0],
			line: item.map?.[0] ?? -1,
		};
		task.meta = meta;
		inline.children?.unshift(task);

		if (!String(item.attrGet("class") ?? "").includes("task-list-item"))
			item.attrJoin("class", "task-list-item");
		markListAsTaskList(tokens, index - 2);
	}
}

export function renderTask(meta: TaskMeta, env: unknown, options: TaskRenderOptions): string {
	if (!options.enabled) return `${escapeHtml(meta.marker)} `;
	const checked = meta.checked ? " checked" : "";
	const href = options.link(env, meta);
	if (href === undefined) {
		return `<input type="checkbox" class="task-list-item-checkbox" disabled${checked}> `;
	}
	return (
		`<a class="mtk-task-toggle" href="${escapeHtml(href)}">` +
		`<input type="checkbox" class="task-list-item-checkbox" tabindex="-1"${checked}></a> `
	);
}

export function installTaskList(md: MarkdownIt, options: () => TaskRenderOptions): void {
	md.core.ruler.after("inline", TASK_TOKEN, taskListRule);
	md.renderer.rules[TASK_TOKEN] = (tokens, idx, _options, env) => {
		const meta: unknown = tokens[idx]?.meta;
		return isTaskMeta(meta) ? renderTask(meta, env, options()) : "";
	};
}
