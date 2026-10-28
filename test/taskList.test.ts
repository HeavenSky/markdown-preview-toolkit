import { describe, expect, it } from "vitest";
import { buildToggleQuery, parseToggleQuery, planToggle } from "../src/features/taskList/line";
import { type TaskRenderOptions, installTaskList } from "../src/features/taskList/rule";
import { createPreviewMd } from "./markdown-helpers";

const linking: TaskRenderOptions = {
	enabled: true,
	link: (env, meta) =>
		(env as { doc?: string }).doc
			? `vscode://ext/toggle-task?line=${meta.line}&checked=${meta.checked ? 1 : 0}`
			: undefined,
};

function render(
	markdown: string,
	options: TaskRenderOptions = linking,
	env: Record<string, unknown> = { doc: "file:///a.md" }
): string {
	const { md, finish } = createPreviewMd();
	installTaskList(md, () => options);
	return finish().render(markdown, env);
}

describe("任务列表渲染", () => {
	it("识别各种列表符号与勾选状态", () => {
		const html = render("- [ ] todo\n* [x] done\n1. [X] upper\n");
		expect(html.match(/class="task-list-item-checkbox"/g)).toHaveLength(3);
		expect(html).toContain('href="vscode://ext/toggle-task?line=0&amp;checked=0"');
		expect(html).toContain('href="vscode://ext/toggle-task?line=1&amp;checked=1"');
		expect(html).toContain('href="vscode://ext/toggle-task?line=2&amp;checked=1"');
		expect(html).not.toMatch(/\[[ xX]\]/);
	});

	it("li 与所在列表带 GitHub 的 class, 列表 class 不重复", () => {
		const html = render("- [ ] a\n- [ ] b\n");
		expect(html).toMatch(/<ul class="contains-task-list code-line" data-line="0">/);
		expect(html.match(/contains-task-list/g)).toHaveLength(1);
		expect(html.match(/<li class="task-list-item code-line"/g)).toHaveLength(2);
	});

	it("嵌套列表与引用内的列表同样识别, 行号取列表项起始行", () => {
		const html = render("- [ ] a\n  - [x] nested\n\n> 1. [ ] quoted\n");
		expect(html).toContain("line=1&amp;checked=1");
		expect(html).toContain("line=3&amp;checked=0");
	});

	it.each(["- [ ]a", "- text [ ] later", "- [] empty", "[ ] not a list", "- [y] other"])(
		"不识别: %s",
		source => {
			expect(render(`${source}\n`)).not.toContain("task-list-item-checkbox");
		}
	);

	it("关闭功能时原样输出标记", () => {
		const html = render("- [X] done\n", { enabled: false, link: () => undefined });
		expect(html).toMatch(/<li class="task-list-item code-line" data-line="0">\[X\] done<\/li>/);
	});

	it("无法回写时输出 disabled 勾选框", () => {
		const html = render("- [x] done\n", linking, {});
		expect(html).toContain(
			'<input type="checkbox" class="task-list-item-checkbox" disabled checked> done'
		);
		expect(html).not.toContain("<a ");
	});

	it("重复渲染同一批 token 输出一致", () => {
		const { md, finish } = createPreviewMd();
		installTaskList(md, () => linking);
		finish();
		const tokens = md.parse("- [ ] a\n- [x] b\n", {});
		const env = { doc: "file:///a.md" };
		expect(md.renderer.render(tokens, md.options, env)).toBe(
			md.renderer.render(tokens, md.options, env)
		);
	});
});

describe("源码回写", () => {
	it("切换状态只替换标记里的那一个字符", () => {
		expect(planToggle("- [ ] todo", false)).toEqual({ offset: 3, replacement: "x" });
		expect(planToggle("  * [x] done", true)).toEqual({ offset: 5, replacement: " " });
		expect(planToggle("> > 12) [X] quoted", true)).toEqual({ offset: 9, replacement: " " });
	});

	it("预览过期或不是任务行时拒绝", () => {
		expect(planToggle("- [x] done", false)).toBeUndefined();
		expect(planToggle("plain text", false)).toBeUndefined();
		expect(planToggle("- [y] other", false)).toBeUndefined();
	});

	it("查询参数往返一致, 非法参数拒绝", () => {
		const request = { doc: "file:///a b.md", line: 4, checked: true };
		expect(parseToggleQuery(buildToggleQuery(request))).toEqual(request);
		expect(parseToggleQuery("doc=x&line=-1&checked=0")).toBeUndefined();
		expect(parseToggleQuery("doc=x&line=1.5&checked=0")).toBeUndefined();
		expect(parseToggleQuery("doc=x&line=1&checked=2")).toBeUndefined();
		expect(parseToggleQuery("line=1&checked=0")).toBeUndefined();
	});
});
