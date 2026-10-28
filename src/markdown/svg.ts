import { escapeHtml } from "./html";

/**
 * 把外部生成的 SVG 改造成可以安全内联进预览的形态, mermaid 与 Kroki 共用。
 *
 * 多张图内联在同一页面时, 无作用域的 `<style>` 规则会外泄到整个预览, 固定的 marker id 会互相冲突;
 * 这里把样式与 id 全部限定到以 `prefix` 为 id 的根元素之下, 并让根元素按 viewBox 等比缩放。
 */

/** 只保留 `<svg>…</svg>` 本体, 去掉 XML 声明, DOCTYPE 与注释等前后缀。 */
export function extractSvg(text: string): string | undefined {
	const start = text.search(/<svg[\s>]/);
	const end = text.lastIndexOf("</svg>");
	return start >= 0 && end > start ? text.slice(start, end + "</svg>".length) : undefined;
}

/**
 * 去掉脚本与事件处理属性。预览的安全策略本就禁止这些脚本执行, 这里在源头剥掉, 不依赖策略兜底。
 */
export function sanitizeSvg(svg: string): string {
	return svg
		.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
		.replace(/<script\b[^>]*\/>/gi, "")
		.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/(\s(?:xlink:)?href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#");
}

/**
 * 把每个选择器限定到根元素之下。选择器以根元素自身带的 class 开头时(例: svgbob 的 `.svgbob line`,
 * 而 `svgbob` 就在根 `<svg>` 上), 另外生成一份挂在根元素自身的写法, 否则一条都匹配不上。
 */
export function scopeCss(css: string, prefix: string, rootClasses: readonly string[] = []): string {
	const scopeOne = (selector: string): string[] => {
		if (selector === "svg") return [`#${prefix}`];
		const scoped = [`#${prefix} ${selector}`];
		const leading = selector.match(/^\.([\w-]+)/)?.[1];
		if (leading && rootClasses.includes(leading)) scoped.unshift(`#${prefix}${selector}`);
		return scoped;
	};
	return css.replace(
		/(^|[{}])(\s*)([^{}@]+?)(\s*)\{/g,
		(_match, lead: string, space: string, selectors: string, gap: string) => {
			const scopedSelectors = selectors
				.split(",")
				.map(selector => selector.trim())
				.flatMap(scopeOne)
				.join(", ");
			return `${lead}${space}${scopedSelectors}${gap}{`;
		}
	);
}

export function scopeSvg(svg: string, prefix: string): string {
	const rootTag = svg.match(/^<svg\b[^>]*>/)?.[0] ?? "";
	const rootId = rootTag.match(/\sid="([^"]*)"/)?.[1];
	const rootClasses = (rootTag.match(/\sclass="([^"]*)"/)?.[1] ?? "")
		.split(/\s+/)
		.filter(Boolean);
	const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(match => match[1] ?? ""));
	if (rootId !== undefined) ids.delete(rootId);

	let scoped = svg.replace(
		/<style([^>]*)>([\s\S]*?)<\/style>/g,
		(_match, attrs: string, css: string) => {
			return `<style${attrs}>${scopeCss(css, prefix, rootClasses)}</style>`;
		}
	);
	scoped = scoped.replace(
		/(\sid="|url\(#|href="#)([^")]+)/g,
		(match, lead: string, id: string) => {
			if (id === rootId) return `${lead}${prefix}`;
			return ids.has(id) ? `${lead}${prefix}-${id}` : match;
		}
	);
	// 原图按内容给出固定宽高, 窄预览里会被裁切; 限宽后按 viewBox 等比缩放。
	// 追加在已有 style 之后, 否则会被其中写死的宽高覆盖。
	return scoped.replace(/^<svg\b[^>]*>/, tag => {
		// 没写宽度的根元素会被撑满整个预览(例: d2); 按 viewBox 补上原始尺寸, 之后只缩小不放大
		const viewBox = tag.match(
			/\sviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/
		);
		// 反过来, 只有宽高没有 viewBox 的根元素(例: svgbob)不会随卡片缩放, 内边距一挤图形就溢出; 按宽高补上 viewBox
		const size = tag.match(/\swidth="([\d.]+)(?:px)?"[\s\S]*?\sheight="([\d.]+)(?:px)?"/);
		const root =
			viewBox && !/\swidth="/.test(tag)
				? tag.replace(/^<svg\b/, `<svg width="${viewBox[1]}" height="${viewBox[2]}"`)
				: !/\sviewBox="/.test(tag) && size
					? tag.replace(/^<svg\b/, `<svg viewBox="0 0 ${size[1]} ${size[2]}"`)
					: tag;
		const sized = /\sstyle="/.test(root)
			? root.replace(/\sstyle="([^"]*)"/, (_m, style: string) => {
					const base = style.trim().replace(/;?$/, ";");
					return ` style="${base === ";" ? "" : base}max-width:100%;height:auto;overflow:visible"`;
				})
			: root.replace(
					/\/?>$/,
					end => ` style="max-width:100%;height:auto;overflow:visible"${end}`
				);
		return rootId !== undefined ? sized : sized.replace(/^<svg\b/, `<svg id="${prefix}"`);
	});
}

/**
 * 同一次渲染里相同的图会得到相同的前缀; 按渲染环境计数, 第二次起追加序号以保持 id 唯一。
 */
export class PrefixCounter {
	readonly #seen = new WeakMap<object, Map<string, number>>();

	next(env: unknown, prefix: string): string {
		if (typeof env !== "object" || env === null) return prefix;
		const counts = this.#seen.get(env) ?? new Map<string, number>();
		this.#seen.set(env, counts);
		const count = counts.get(prefix) ?? 0;
		counts.set(prefix, count + 1);
		return count === 0 ? prefix : `${prefix}-${count}`;
	}
}

/** 给根元素加上图片语义与无障碍名称; 放在根 `<svg>` 上, 外层容器里的 `</>` 菜单才不会被当成图片的一部分。 */
export function labelSvg(svg: string, label: string): string {
	return svg.replace(/^<svg\b/, `<svg role="img" aria-label="${escapeHtml(label)}"`);
}

/** 把以 `base` 为前缀的 SVG 改写成以 `prefix` 为前缀。 */
export function withPrefix(svg: string, base: string, prefix: string): string {
	return prefix === base ? svg : svg.replaceAll(base, prefix);
}
