/** 本模块用到的 fetch 子集, 测试里注入假实现。 */
export type FetchLike = (
	url: string,
	init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type KrokiFailure =
	| { readonly reason: "http"; readonly status: number; readonly detail: string }
	| { readonly reason: "timeout"; readonly timeoutMs: number }
	| { readonly reason: "network"; readonly detail: string }
	| { readonly reason: "not-svg" };

export type KrokiResult =
	| {
			readonly kind: "svg";
			/** 预览里显示的 SVG; 经 `prepareResult` 处理后是显示副本。 */
			readonly svg: string;
			/** 引擎输出的原始 SVG, 只在经过 `prepareResult` 后存在。 */
			readonly source?: string;
	  }
	| { readonly kind: "error"; readonly failure: KrokiFailure };

/** 网络不可达与超时是暂时性的, 过期后应重试; 服务端明确拒绝的图源错误不是。 */
export function isTransient(failure: KrokiFailure): boolean {
	return failure.reason === "timeout" || failure.reason === "network";
}

/**
 * 以 `POST {server}/{type}/svg` 请求 Kroki 渲染。
 *
 * 用 POST 而不是把源码编码进 URL: Kroki 默认限制 URI 长度为 4096, 大图会被拒。
 */
export async function requestKroki(
	fetchImpl: FetchLike,
	server: string,
	type: string,
	source: string,
	timeoutMs: number,
	options: Readonly<Record<string, string>> = {}
): Promise<KrokiResult> {
	try {
		const response = await fetchImpl(`${server}/${encodeURIComponent(type)}/svg`, {
			method: "POST",
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				Accept: "image/svg+xml",
				...Object.fromEntries(
					Object.entries(options).map(([name, value]) => [
						`Kroki-Diagram-Options-${name}`,
						value,
					])
				),
			},
			body: source,
			signal: AbortSignal.timeout(timeoutMs),
		});
		const body = await response.text();
		if (!response.ok) {
			return {
				kind: "error",
				failure: { reason: "http", status: response.status, detail: body.trim() },
			};
		}
		if (!/<svg[\s>]/.test(body)) return { kind: "error", failure: { reason: "not-svg" } };
		return { kind: "svg", svg: body };
	} catch (error) {
		if (error instanceof Error && error.name === "TimeoutError") {
			return { kind: "error", failure: { reason: "timeout", timeoutMs } };
		}
		const cause =
			error instanceof Error && error.cause instanceof Error
				? `: ${error.cause.message}`
				: "";
		const detail = error instanceof Error ? `${error.message}${cause}` : String(error);
		return { kind: "error", failure: { reason: "network", detail } };
	}
}
