/**
 * 围栏代码块语言名到 Kroki 图类型的映射。
 *
 * 不含 `mermaid`(由 beautiful-mermaid 与内置渲染负责)与 `math`(内置 KaTeX 负责)。
 */
export const DEFAULT_KROKI_LANGUAGES: Readonly<Record<string, string>> = {
	plantuml: "plantuml",
	puml: "plantuml",
	c4plantuml: "c4plantuml",
	ditaa: "ditaa",
	blockdiag: "blockdiag",
	seqdiag: "seqdiag",
	actdiag: "actdiag",
	nwdiag: "nwdiag",
	packetdiag: "packetdiag",
	rackdiag: "rackdiag",
	umlet: "umlet",
	graphviz: "graphviz",
	dot: "graphviz",
	erd: "erd",
	svgbob: "svgbob",
	symbolator: "symbolator",
	nomnoml: "nomnoml",
	vega: "vega",
	vegalite: "vegalite",
	wavedrom: "wavedrom",
	bpmn: "bpmn",
	bytefield: "bytefield",
	excalidraw: "excalidraw",
	pikchr: "pikchr",
	structurizr: "structurizr",
	diagramsnet: "diagramsnet",
	d2: "d2",
	tikz: "tikz",
	dbml: "dbml",
	wireviz: "wireviz",
	goat: "goat",
};

/**
 * 按图类型随请求发送的 Kroki 图表选项(以 `Kroki-Diagram-Options-<名字>` 请求头传递)。
 * d2 默认在图四周留约 100px 空白, 放在预览里卡片大半是空的, 收窄到 20。
 */
export const DIAGRAM_OPTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	d2: { pad: "20" },
};

/**
 * 在默认表上叠加用户覆盖: 键按小写匹配语言名, 值为 Kroki 图类型, 空字符串表示取消该语言;
 * 非字符串的值忽略, 免得一处手误让整张表失效。
 */
export function resolveKrokiLanguages(overrides: unknown): ReadonlyMap<string, string> {
	const languages = new Map(Object.entries(DEFAULT_KROKI_LANGUAGES));
	if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) {
		return languages;
	}
	for (const [lang, type] of Object.entries(overrides)) {
		if (typeof type !== "string") continue;
		const key = lang.trim().toLowerCase();
		const value = type.trim().toLowerCase();
		if (!key) continue;
		if (value) languages.set(key, value);
		else languages.delete(key);
	}
	return languages;
}

/** 只接受 http 与 https 的绝对地址, 去掉末尾斜杠; 非法时返回 `undefined`。 */
export function normalizeServer(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return undefined;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
	if (url.search || url.hash) return undefined;
	return url.href.replace(/\/+$/, "");
}
