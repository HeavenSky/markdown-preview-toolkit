import type { StateBlock } from "markdown-it";

export const TOC_TOKEN = "markdown_toolkit_toc";

const MARKER = /^(?:\[toc\]|\[\[toc\]\])$/i;

/**
 * 识别独占一段的 `[TOC]` 或 `[[toc]]`(不分大小写)。
 *
 * 只做识别, 不读配置: 核心按文档版本缓存解析结果, 配置变化不会让缓存失效。
 * 标记后紧跟非空行时它只是段落里的一行文字, 不识别。
 */
export function tocBlockRule(
	state: StateBlock,
	startLine: number,
	endLine: number,
	silent: boolean
): boolean {
	if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
	const start = state.bMarks[startLine]! + state.tShift[startLine]!;
	const line = state.src.slice(start, state.eMarks[startLine]).trim();
	if (!MARKER.test(line)) return false;
	const next = startLine + 1;
	if (next < endLine && !state.isEmpty(next)) return false;
	if (silent) return true;

	const token = state.push(TOC_TOKEN, "nav", 0);
	token.block = true;
	token.markup = line;
	token.map = [startLine, next];
	state.line = next;
	return true;
}
