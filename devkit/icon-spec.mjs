/**
 * 前景: 节点与连线拼出 Markdown 的 M, 右腿延伸成下箭头, 合起来是 Markdown 标志 M↓;
 * 四个折点是细白环套圈的彩色节点, 中间节点是同色系的渐变环, 左上一颗四角星与两颗小亮点作点缀。
 * 配色沿 M 的笔画从青过渡到紫粉。
 *
 * 底座 (画布尺寸, 圆角, 背景渐变, 描边) 来自 `icon-brand.mjs`, 这里只描述前景。
 * SVG 与 PNG 都由 `scripts/gen-icon.mjs` 从这一份数据生成,
 * 因此不要手写 `media/icon.svg` —— 那会让几何变成两处真源。
 */
import { FOREGROUND, SIZE, baseShapes } from "./icon-brand.mjs";

const LINE = { kind: "linear", from: "#56C8FF", to: "#A98BFF", direction: "horizontal" };
const LINE_WIDTH = 12;
/** 中间节点的渐变环取色, 与连线同一条色带。 */
const HUB_COLORS = ["#5EE0FF", "#7A9CFF", "#B78BFF", "#E38FD8"];
/** 中间节点正中的小圆用该位置的背景色填充, 看起来是透出底色。 */
const HOLE = "#222735";
const NODE_RADIUS = 17;
const RING_WIDTH = 3.5;

/** M 的五个折点: 左下, 左上, 中间, 右上, 右腿与箭头的衔接点。 */
const M = [
	[56, 180],
	[56, 80],
	[124, 150],
	[192, 80],
	[192, 168],
];

const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** 按顺时针在若干颜色之间线性插值, 首尾相接成环。 */
const conic = colors => {
	const stops = [...colors, colors[0]].map(hexToRgb);
	return {
		kind: "conic",
		segments: 240,
		colorAt: hue => {
			const t = (hue / 360) * (stops.length - 1);
			const i = Math.min(Math.floor(t), stops.length - 2);
			const f = t - i;
			return stops[i].map((value, k) => Math.round(value + (stops[i + 1][k] - value) * f));
		},
	};
};

const node = ([cx, cy], color) => [
	{ kind: "circle", cx, cy, r: NODE_RADIUS, fill: FOREGROUND },
	{ kind: "circle", cx, cy, r: NODE_RADIUS - RING_WIDTH, fill: color },
];

const hub = ([cx, cy]) => [
	{ kind: "circle", cx, cy, r: NODE_RADIUS, fill: FOREGROUND },
	{ kind: "ring", cx, cy, outer: NODE_RADIUS - RING_WIDTH, inner: 5, fill: conic(HUB_COLORS) },
	{ kind: "circle", cx, cy, r: 5, fill: HOLE },
];

/** 四角星 ✦: 每条星芒由几段逐级收细的圆头短线叠成, 中心一个圆点撑起饱满感。 */
const sparkle = (cx, cy, size, color) => {
	const shapes = [{ kind: "circle", cx, cy, r: size * 0.24, fill: color }];
	const steps = 6;
	for (const [dx, dy] of [
		[0, -1],
		[0, 1],
		[-1, 0],
		[1, 0],
	]) {
		for (let k = 0; k < steps; k++) {
			const from = (k / steps) * size;
			const to = ((k + 1) / steps) * size;
			shapes.push({
				kind: "polyline",
				points: [
					[cx + dx * from, cy + dy * from],
					[cx + dx * to, cy + dy * to],
				],
				stroke: color,
				strokeWidth: Math.max(1.6, size * 0.42 * (1 - k / steps) ** 1.6),
			});
		}
	}
	return shapes;
};

const line = points => ({ kind: "polyline", points, stroke: LINE, strokeWidth: LINE_WIDTH });

export default {
	size: SIZE,
	label: "Markdown Preview Toolkit",
	shapes: [
		...baseShapes(),
		line(M),
		// 右腿下延与箭头, 即 Markdown 标志里的 ↓
		line([M[4], [192, 210]]),
		line([
			[174, 192],
			[192, 212],
			[210, 192],
		]),
		...node(M[0], "#5EE0FF"),
		...node(M[1], "#56B6FF"),
		...hub(M[2]),
		...node(M[3], "#9B86FF"),
		...sparkle(98, 46, 12, "#FFE08A"),
		{ kind: "circle", cx: 140, cy: 40, r: 4, fill: "#E38FD8" },
		{ kind: "circle", cx: 224, cy: 120, r: 3.5, fill: "#5EE0FF" },
	],
};
