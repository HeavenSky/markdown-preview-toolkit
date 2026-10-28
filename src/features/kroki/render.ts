import type { FenceBlock, FenceRenderer } from "../../markdown/fence";
import { containerAttrs, escapeHtml, renderErrorBlock } from "../../markdown/html";
import { PrefixCounter, labelSvg, withPrefix } from "../../markdown/svg";
import type { DiagramTools } from "../../markdown/tools";
import type { KrokiFailure, KrokiResult } from "./client";
import type { KrokiCache } from "./resultCache";
import { krokiPrefix, prepareKrokiSvg } from "./svg";

export interface KrokiSettings {
	readonly enabled: boolean;
	/** 规范化后的服务器地址; 配置非法时为 `undefined`。 */
	readonly server: string | undefined;
	readonly rawServer: string;
	readonly languages: ReadonlyMap<string, string>;
}

/** 面向用户的文案, 由宿主侧按界面语言提供。 */
export interface KrokiMessages {
	pending(): string;
	invalidServer(raw: string): string;
	failure(failure: KrokiFailure, server: string): string;
	alt(type: string): string;
}

/** 请求结果写入缓存前先改造成可内联的显示副本, 每张图只处理一次; 原始 SVG 一并保留。 */
export function prepareResult(result: KrokiResult, prefix: string): KrokiResult {
	if (result.kind !== "svg") return result;
	const prepared = prepareKrokiSvg(result.svg, prefix);
	return prepared === undefined
		? { kind: "error", failure: { reason: "not-svg" } }
		: { kind: "svg", svg: prepared.display, source: prepared.source };
}

interface RenderContext {
	readonly cache: KrokiCache;
	readonly messages: KrokiMessages;
	readonly prefixes: PrefixCounter;
	readonly tools: DiagramTools | undefined;
}

/**
 * Kroki 图以内联 SVG 输出, 与 mermaid 一样限定了样式与 id 的作用域并用 CSS 覆盖字体;
 * 缓存里的 SVG 以 `krokiPrefix` 为前缀, 同一次渲染里重复出现的图再追加序号。
 * 提供 `tools` 时在右上角加 `</>` 菜单, 用于复制, 另存或单独查看原始 SVG。
 */
export function createKrokiRenderer(
	settings: () => KrokiSettings,
	cache: KrokiCache,
	messages: KrokiMessages,
	tools?: DiagramTools
): FenceRenderer {
	const context: RenderContext = { cache, messages, prefixes: new PrefixCounter(), tools };
	return block => {
		const current = settings();
		const type = current.languages.get(block.lang);
		return type ? renderKroki(block, type, current, context) : undefined;
	};
}

/** 把块固定按 `type` 交给 Kroki 渲染, 不查语言表; 用于内置 mermaid 不可用时的兜底。 */
export function createKrokiTypeRenderer(
	type: string,
	settings: () => KrokiSettings,
	cache: KrokiCache,
	messages: KrokiMessages,
	tools?: DiagramTools
): FenceRenderer {
	const context: RenderContext = { cache, messages, prefixes: new PrefixCounter(), tools };
	return block => renderKroki(block, type, settings(), context);
}

function renderKroki(
	block: FenceBlock,
	type: string,
	current: KrokiSettings,
	{ cache, messages, prefixes, tools }: RenderContext
): string | undefined {
	if (!current.enabled) return undefined;
	if (current.server === undefined) {
		return renderErrorBlock(
			block.token,
			messages.invalidServer(current.rawServer),
			block.source
		);
	}
	const result = cache.lookup(current.server, type, block.source);
	if (result === undefined) {
		return `<div${containerAttrs(block.token, "mtk-kroki mtk-kroki-pending")}>${escapeHtml(messages.pending())}</div>\n`;
	}
	if (result.kind === "error") {
		return renderErrorBlock(
			block.token,
			messages.failure(result.failure, current.server),
			block.source
		);
	}
	const base = krokiPrefix(current.server, type, block.source);
	const svg = labelSvg(
		withPrefix(result.svg, base, prefixes.next(block.env, base)),
		messages.alt(type)
	);
	const menu = tools?.({ id: base, type, svg: result.source ?? result.svg }) ?? "";
	return `<div${containerAttrs(block.token, "mtk-kroki")} data-mtk-type="${escapeHtml(type)}">${menu}${svg}</div>\n`;
}
