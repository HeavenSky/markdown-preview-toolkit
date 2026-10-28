import type { FenceRenderer } from "../../markdown/fence";

export interface MermaidSettings {
	/** 内置(或 bierner)mermaid 扩展可用且仍处理 `mermaid` 语言。 */
	readonly builtinAvailable: boolean;
}

/**
 * 只接管 ```` ```mermaid ```` 块: 内置 mermaid 可用时返回 `undefined`, 由 fence 链路交还内置渲染与报错;
 * 不可用(VS Code 低于 1.121, 或内置扩展被禁用)时交给 `fallback`(Kroki 的 mermaid)。
 */
export function createMermaidRenderer(
	settings: () => MermaidSettings,
	fallback?: FenceRenderer
): FenceRenderer {
	return block => {
		if (block.lang !== "mermaid" || settings().builtinAvailable) return undefined;
		return fallback?.(block);
	};
}
