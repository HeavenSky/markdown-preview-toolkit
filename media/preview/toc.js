// 预览脚本: 悬浮目录栏的折叠与当前章节高亮。
// 目录 HTML 由扩展在渲染时生成; 预览内容更新后 DOM 会被增量替换, 因此状态存在脚本内存里,
// 每次 `vscode.markdown.updateContent` 之后重新应用。

const NARROW_WIDTH_PX = 900;
const ACTIVE_OFFSET_PX = 80;

/** 用户手动切换过的折叠状态; 未切换过时按窗口宽度决定。 */
let collapsed;
let frame = 0;

function sidebar() {
	return document.querySelector(".mtk-toc-sidebar");
}

function applyCollapsed(nav) {
	const value = collapsed ?? window.innerWidth < NARROW_WIDTH_PX;
	nav.classList.toggle("is-collapsed", value);
	nav.querySelector(".mtk-toc-sidebar-toggle")?.setAttribute("aria-expanded", String(!value));
}

function targetOf(link) {
	const id = decodeURIComponent(link.getAttribute("href").slice(1));
	return document.getElementById(id);
}

function highlight() {
	frame = 0;
	const nav = sidebar();
	if (!nav) return;
	let active;
	for (const link of nav.querySelectorAll('a[href^="#"]')) {
		const target = targetOf(link);
		if (target && target.getBoundingClientRect().top <= ACTIVE_OFFSET_PX) active = link;
	}
	for (const link of nav.querySelectorAll("a.is-active")) {
		if (link !== active) link.classList.remove("is-active");
	}
	active?.classList.add("is-active");
}

function scheduleHighlight() {
	if (!frame) frame = requestAnimationFrame(highlight);
}

function refresh() {
	const nav = sidebar();
	if (!nav) return;
	applyCollapsed(nav);
	scheduleHighlight();
}

document.addEventListener("click", event => {
	const toggle =
		event.target instanceof Element ? event.target.closest(".mtk-toc-sidebar-toggle") : null;
	const nav = toggle?.closest(".mtk-toc-sidebar");
	if (!nav) return;
	collapsed = !nav.classList.contains("is-collapsed");
	applyCollapsed(nav);
});

window.addEventListener("scroll", scheduleHighlight, { passive: true });
window.addEventListener("resize", refresh);
window.addEventListener("vscode.markdown.updateContent", refresh);
// 脚本可能在首次内容到达之后才执行, 错过那次更新事件; 目录栏节点出现或被替换时同样重新应用。
// refresh 只改属性, 不改子节点, 不会再次触发本观察器。
let pending = 0;
new MutationObserver(() => {
	if (!pending) {
		pending = requestAnimationFrame(() => {
			pending = 0;
			refresh();
		});
	}
}).observe(document.body, { childList: true, subtree: true });
refresh();
