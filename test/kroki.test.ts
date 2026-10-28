import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KrokiCache, cacheKey } from "../src/features/kroki/resultCache";
import { type FetchLike, type KrokiResult, requestKroki } from "../src/features/kroki/client";
import {
	DEFAULT_KROKI_LANGUAGES,
	normalizeServer,
	resolveKrokiLanguages,
} from "../src/features/kroki/languages";
import {
	type KrokiSettings,
	createKrokiRenderer,
	createKrokiTypeRenderer,
	prepareResult,
} from "../src/features/kroki/render";
import { krokiPrefix } from "../src/features/kroki/svg";
import { installFenceRouter } from "../src/markdown/fence";
import { createPreviewMd } from "./markdown-helpers";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>';

function fakeFetch(
	respond: (url: string, body: string) => Promise<{ ok: boolean; status: number; body: string }>
): FetchLike & { calls: Array<{ url: string; body: string; method: string }> } {
	const calls: Array<{ url: string; body: string; method: string }> = [];
	const impl = (async (url, init) => {
		calls.push({ url, body: init.body, method: init.method });
		const { ok, status, body } = await respond(url, init.body);
		return { ok, status, text: async () => body };
	}) as FetchLike & { calls: typeof calls };
	impl.calls = calls;
	return impl;
}

describe("语言表", () => {
	it("别名映射到 Kroki 类型", () => {
		const languages = resolveKrokiLanguages(undefined);
		expect(languages.get("puml")).toBe("plantuml");
		expect(languages.get("dot")).toBe("graphviz");
		expect(languages.has("mermaid")).toBe(false);
		expect(languages.has("math")).toBe(false);
	});

	it("用户覆盖可追加, 改写与取消, 非字符串值忽略", () => {
		const languages = resolveKrokiLanguages({
			UML: "PlantUML",
			dot: "",
			d2: 42,
			graphviz: " graphviz ",
		});
		expect(languages.get("uml")).toBe("plantuml");
		expect(languages.has("dot")).toBe(false);
		expect(languages.get("d2")).toBe("d2");
		expect(languages.get("graphviz")).toBe("graphviz");
		expect(languages.size).toBe(Object.keys(DEFAULT_KROKI_LANGUAGES).length);
	});

	it("服务器地址只接受 http 与 https, 去掉末尾斜杠", () => {
		expect(normalizeServer("https://kroki.io/")).toBe("https://kroki.io");
		expect(normalizeServer(" http://localhost:8000 ")).toBe("http://localhost:8000");
		expect(normalizeServer("http://host/kroki//")).toBe("http://host/kroki");
		expect(normalizeServer("ftp://kroki.io")).toBeUndefined();
		expect(normalizeServer("kroki.io")).toBeUndefined();
		expect(normalizeServer("https://kroki.io/?x=1")).toBeUndefined();
		expect(normalizeServer(undefined)).toBeUndefined();
	});
});

describe("requestKroki", () => {
	it("以 POST 发送源码并返回 SVG", async () => {
		const fetchImpl = fakeFetch(async () => ({ ok: true, status: 200, body: SVG }));
		const result = await requestKroki(
			fetchImpl,
			"https://kroki.io",
			"graphviz",
			"digraph{a->b}",
			5000
		);
		expect(result).toEqual({ kind: "svg", svg: SVG });
		expect(fetchImpl.calls).toEqual([
			{ url: "https://kroki.io/graphviz/svg", body: "digraph{a->b}", method: "POST" },
		]);
	});

	it("HTTP 错误带上状态码与响应正文", async () => {
		const fetchImpl = fakeFetch(async () => ({
			ok: false,
			status: 400,
			body: " Syntax error \n",
		}));
		const result = await requestKroki(
			fetchImpl,
			"https://kroki.io",
			"plantuml",
			"@startuml",
			5000
		);
		expect(result).toEqual({
			kind: "error",
			failure: { reason: "http", status: 400, detail: "Syntax error" },
		});
	});

	it("响应不是 SVG 时报错", async () => {
		const fetchImpl = fakeFetch(async () => ({
			ok: true,
			status: 200,
			body: "<html>proxy</html>",
		}));
		const result = await requestKroki(fetchImpl, "https://kroki.io", "d2", "a -> b", 5000);
		expect(result).toEqual({ kind: "error", failure: { reason: "not-svg" } });
	});

	it("超时与网络错误分别归类", async () => {
		const timeout = fakeFetch(async () => {
			throw new DOMException("timed out", "TimeoutError");
		});
		expect(await requestKroki(timeout, "http://localhost:8000", "d2", "a", 1000)).toEqual({
			kind: "error",
			failure: { reason: "timeout", timeoutMs: 1000 },
		});
		const network = fakeFetch(async () => {
			throw new TypeError("fetch failed", {
				cause: new Error("connect ECONNREFUSED 127.0.0.1:9"),
			});
		});
		expect(await requestKroki(network, "http://127.0.0.1:9", "d2", "a", 1000)).toEqual({
			kind: "error",
			failure: {
				reason: "network",
				detail: "fetch failed: connect ECONNREFUSED 127.0.0.1:9",
			},
		});
	});
});

describe("KrokiCache", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	function setup(results: KrokiResult[]) {
		let now = 0;
		const request = vi.fn(async () => results.shift() ?? { kind: "svg" as const, svg: SVG });
		const onUpdate = vi.fn();
		const cache = new KrokiCache({ request, onUpdate, now: () => now });
		return { cache, request, onUpdate, advance: (ms: number) => (now += ms) };
	}

	it("缓存键稳定, 且随服务器变化", () => {
		expect(cacheKey("a", "d2", "x")).toBe(cacheKey("a", "d2", "x"));
		expect(cacheKey("a", "d2", "x")).not.toBe(cacheKey("b", "d2", "x"));
	});

	it("未命中先返回 undefined, 在途请求合并为一次, 结果到达后防抖刷新一次", async () => {
		const { cache, request, onUpdate } = setup([]);
		expect(cache.lookup("s", "d2", "a")).toBeUndefined();
		expect(cache.lookup("s", "d2", "a")).toBeUndefined();
		expect(cache.lookup("s", "d2", "b")).toBeUndefined();
		expect(request).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(0);
		expect(onUpdate).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(300);
		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(cache.lookup("s", "d2", "a")).toEqual({ kind: "svg", svg: SVG });
		expect(request).toHaveBeenCalledTimes(2);
	});

	it("网络错误 30 秒后过期并重新请求, 图源错误一直保留", async () => {
		const network: KrokiResult = {
			kind: "error",
			failure: { reason: "network", detail: "down" },
		};
		const http: KrokiResult = {
			kind: "error",
			failure: { reason: "http", status: 400, detail: "bad" },
		};
		const { cache, request, advance } = setup([network, http]);
		cache.lookup("s", "d2", "net");
		cache.lookup("s", "d2", "src");
		await vi.advanceTimersByTimeAsync(0);
		expect(cache.lookup("s", "d2", "net")).toEqual(network);
		advance(30_001);
		expect(cache.lookup("s", "d2", "net")).toBeUndefined();
		expect(cache.lookup("s", "d2", "src")).toEqual(http);
		expect(request).toHaveBeenCalledTimes(3);
	});

	it("清空后丢弃在途请求的结果", async () => {
		const { cache, onUpdate } = setup([]);
		cache.lookup("s", "d2", "a");
		cache.clear();
		await vi.advanceTimersByTimeAsync(1000);
		expect(onUpdate).not.toHaveBeenCalled();
	});
});

describe("Kroki 渲染器", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const messages = {
		pending: () => "Rendering…",
		invalidServer: (raw: string) => `Invalid server ${raw}`,
		failure: () => "Kroki failed <bad>",
		alt: (type: string) => `${type} diagram`,
	};

	function setup(settings: Partial<KrokiSettings>, result: KrokiResult) {
		const cache = new KrokiCache({
			request: async (server, type, source) =>
				prepareResult(result, krokiPrefix(server, type, source)),
			onUpdate: () => {},
		});
		const full: KrokiSettings = {
			enabled: true,
			server: "https://kroki.io",
			rawServer: "https://kroki.io",
			languages: resolveKrokiLanguages(undefined),
			...settings,
		};
		const { md, finish } = createPreviewMd();
		installFenceRouter(md, [createKrokiRenderer(() => full, cache, messages)]);
		return finish();
	}

	const SOURCE = "```dot\ndigraph{a->b}\n```\n";

	it("先输出占位, 结果到达后输出内联 SVG, 重复的图 id 不冲突", async () => {
		const md = setup(
			{},
			{ kind: "svg", svg: '<?xml version="1.0"?><svg viewBox="0 0 1 1"><g id="n"/></svg>' }
		);
		expect(md.render(SOURCE)).toContain(
			'<div data-line="0" class="code-line mtk-kroki mtk-kroki-pending">Rendering…</div>'
		);
		await vi.advanceTimersByTimeAsync(0);
		const html = md.render(SOURCE + "\n" + SOURCE);
		const base = krokiPrefix("https://kroki.io", "graphviz", "digraph{a->b}\n");
		expect(html).toContain(
			`<div data-line="0" class="code-line mtk-kroki" data-mtk-type="graphviz"><svg role="img" aria-label="graphviz diagram" id="${base}" width="1" height="1" viewBox="0 0 1 1" style="max-width:100%;height:auto;overflow:visible"><style>#${base} text`
		);
		expect(html).toContain(`<g id="${base}-n"/></svg></div>`);
		expect(html).toContain(`aria-label="graphviz diagram" id="${base}-1"`);
		expect(html).toContain(`<g id="${base}-1-n"/>`);
		expect(html).not.toContain("<?xml");
	});

	it("返回内容不是 SVG 时按失败处理", async () => {
		const md = setup({}, { kind: "svg", svg: "<html>proxy</html>" });
		md.render(SOURCE);
		await vi.advanceTimersByTimeAsync(0);
		expect(md.render(SOURCE)).toContain("Kroki failed &lt;bad&gt;");
	});

	it("失败时输出转义后的错误块与源码", async () => {
		const md = setup({}, { kind: "error", failure: { reason: "not-svg" } });
		md.render(SOURCE);
		await vi.advanceTimersByTimeAsync(0);
		const html = md.render(SOURCE);
		expect(html).toContain("Kroki failed &lt;bad&gt;");
		expect(html).toContain("<code>digraph{a-&gt;b}\n</code>");
	});

	it("服务器地址非法时不发请求, 直接提示", () => {
		const md = setup({ server: undefined, rawServer: "kroki" }, { kind: "svg", svg: SVG });
		expect(md.render(SOURCE)).toContain("Invalid server kroki");
	});

	it("关闭开关或未登记的语言交还原始代码块", () => {
		expect(setup({ enabled: false }, { kind: "svg", svg: SVG }).render(SOURCE)).toContain(
			"language-dot"
		);
		expect(setup({}, { kind: "svg", svg: SVG }).render("```js\n1\n```\n")).toContain(
			"language-js"
		);
	});

	it("按固定类型渲染时不查语言表, 关闭 Kroki 时不接管", async () => {
		const requested: string[] = [];
		const cache = new KrokiCache({
			request: async (_server, type) => {
				requested.push(type);
				return { kind: "svg", svg: SVG };
			},
			onUpdate: () => {},
		});
		const settings: KrokiSettings = {
			enabled: true,
			server: "https://kroki.io",
			rawServer: "https://kroki.io",
			languages: resolveKrokiLanguages(undefined),
		};
		const renderMermaid = createKrokiTypeRenderer("mermaid", () => settings, cache, messages);
		const { md, finish } = createPreviewMd();
		installFenceRouter(md, [renderMermaid]);
		const view = finish();
		expect(view.render("```mermaid\npie\n```\n")).toContain("mtk-kroki-pending");
		expect(requested).toEqual(["mermaid"]);
		const disabled = createKrokiTypeRenderer(
			"mermaid",
			() => ({ ...settings, enabled: false }),
			cache,
			messages
		);
		expect(
			disabled({
				lang: "mermaid",
				source: "pie",
				token: md.parse("```mermaid\npie\n```", {})[0]!,
				env: {},
			})
		).toBeUndefined();
	});
});

describe("Kroki 图表选项", () => {
	it("按图类型把选项作为请求头发送", async () => {
		let headers: Record<string, string> = {};
		const fetchImpl: FetchLike = async (_url, init) => {
			headers = init.headers;
			return { ok: true, status: 200, text: async () => SVG };
		};
		await requestKroki(fetchImpl, "https://kroki.io", "d2", "a -> b", 5000, { pad: "20" });
		expect(headers["Kroki-Diagram-Options-pad"]).toBe("20");
		await requestKroki(fetchImpl, "https://kroki.io", "graphviz", "digraph{}", 5000);
		expect(Object.keys(headers).filter(name => name.startsWith("Kroki-"))).toEqual([]);
	});
});

describe("图表 </> 菜单", () => {
	it("Kroki 图带菜单, 登记的是引擎输出的原始 SVG", async () => {
		vi.useFakeTimers();
		const raw =
			'<?xml version="1.0"?><svg viewBox="0 0 1 1"><text font-family="Times" textLength="9">a</text></svg>';
		const cache = new KrokiCache({
			request: async (server, type, source) =>
				prepareResult({ kind: "svg", svg: raw }, krokiPrefix(server, type, source)),
			onUpdate: () => {},
		});
		const registered: Array<{ id: string; type: string; svg: string }> = [];
		const tools = (source: { id: string; type: string; svg: string }) => {
			registered.push(source);
			return `<details class="mtk-diagram-tools">${source.id}</details>`;
		};
		const settings: KrokiSettings = {
			enabled: true,
			server: "https://kroki.io",
			rawServer: "https://kroki.io",
			languages: resolveKrokiLanguages(undefined),
		};
		const { md, finish } = createPreviewMd();
		installFenceRouter(md, [
			createKrokiRenderer(
				() => settings,
				cache,
				{ pending: () => "…", invalidServer: () => "", failure: () => "", alt: t => t },
				tools
			),
		]);
		const view = finish();
		view.render("```dot\nx\n```\n");
		await vi.advanceTimersByTimeAsync(0);
		const html = view.render("```dot\nx\n```\n");
		const base = krokiPrefix("https://kroki.io", "graphviz", "x\n");
		expect(html).toContain(
			`data-mtk-type="graphviz"><details class="mtk-diagram-tools">${base}</details><svg`
		);
		expect(registered.at(-1)).toEqual({ id: base, type: "graphviz", svg: raw });
		expect(html).toContain('textLength="9"');
		vi.useRealTimers();
	});
});
