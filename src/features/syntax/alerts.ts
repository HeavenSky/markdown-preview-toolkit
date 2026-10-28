import type { MarkdownIt, StateCore, Token } from "markdown-it";
import { escapeHtml } from "../../markdown/html";

export const ALERT_TITLE_TOKEN = "markdown_toolkit_alert_title";

export const ALERT_TYPES = ["note", "tip", "important", "warning", "caution"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/**
 * 提示块图标, 逐字取自 @primer/octicons 19.42.0 的 16px SVG(info, light-bulb, report, alert, stop),
 * MIT 许可证见 NOTICE.md。只复制这 5 个路径, 不把整套图标数据打进扩展。
 */
const ICON_PATHS: Readonly<Record<AlertType, string>> = {
	note: "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
	tip: "M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z",
	important:
		"M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
	warning:
		"M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
	caution:
		"M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
};

/** 引用块首个段落的第一行必须只有标记, 例如 `[!NOTE]`(类型不分大小写)。 */
const MARKER = /^\[!(note|tip|important|warning|caution)\]\s*$/i;

function closingIndex(tokens: readonly Token[], openIndex: number): number {
	const open = tokens[openIndex];
	for (let index = openIndex + 1; index < tokens.length; index++) {
		const token = tokens[index];
		if (token?.type === "blockquote_close" && token.level === open?.level) return index;
	}
	return -1;
}

/** 去掉 inline 内容中的第一行(标记行), 返回剩余内容是否为空。 */
function dropFirstLine(inline: Token): boolean {
	const children = inline.children ?? [];
	const breakIndex = children.findIndex(
		child => child.type === "softbreak" || child.type === "hardbreak"
	);
	inline.children = breakIndex < 0 ? [] : children.slice(breakIndex + 1);
	const newline = inline.content.indexOf("\n");
	inline.content = newline < 0 ? "" : inline.content.slice(newline + 1);
	return inline.children.length === 0;
}

export function alertRule(state: StateCore): void {
	const tokens = state.tokens;
	for (let index = 0; index < tokens.length; index++) {
		const open = tokens[index];
		const paragraph = tokens[index + 1];
		const inline = tokens[index + 2];
		if (
			open?.type !== "blockquote_open" ||
			paragraph?.type !== "paragraph_open" ||
			inline?.type !== "inline"
		) {
			continue;
		}
		const firstLine = inline.content.split("\n", 1)[0] ?? "";
		const match = MARKER.exec(firstLine.trim());
		const close = closingIndex(tokens, index);
		if (!match || close < 0) continue;

		const type = (match[1] ?? "note").toLowerCase() as AlertType;
		if (dropFirstLine(inline)) {
			paragraph.hidden = true;
			const paragraphClose = tokens[index + 3];
			if (paragraphClose?.type === "paragraph_close") paragraphClose.hidden = true;
		}
		open.tag = "div";
		open.attrJoin("class", `markdown-alert markdown-alert-${type}`);
		const closeToken = tokens[close];
		if (closeToken) closeToken.tag = "div";

		const title = new state.Token(ALERT_TITLE_TOKEN, "p", 0);
		title.meta = { type };
		title.block = true;
		tokens.splice(index + 1, 0, title);
	}
}

export function renderAlertTitle(type: AlertType, label: string): string {
	return (
		`<p class="markdown-alert-title"><svg class="octicon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">` +
		`<path d="${ICON_PATHS[type]}"></path></svg>${escapeHtml(label)}</p>\n`
	);
}

export function installAlerts(
	md: MarkdownIt,
	labels: () => Readonly<Record<AlertType, string>>
): void {
	md.core.ruler.after("inline", "markdown_toolkit_alerts", alertRule);
	md.renderer.rules[ALERT_TITLE_TOKEN] = (tokens, idx) => {
		const type = (tokens[idx]?.meta as { type?: unknown } | null)?.type;
		if (!ALERT_TYPES.includes(type as AlertType)) return "";
		return renderAlertTitle(type as AlertType, labels()[type as AlertType]);
	};
}
