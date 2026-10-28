// 本插件的功能截图场景; 启动, 截图与压缩在 devkit/shoot-ext.mjs.
// 用法: npm run shots, 或 node scripts/shoot.mjs [输出目录, 默认 artifacts/shots] [--readme] [场景名过滤...]
//   preview    打开示例文件并在右侧打开预览
//   toc        展开悬浮目录栏, 点击目录项跳转
//   task       在预览里点击未勾选的任务, 检查源码是否被改写
//   toggle     运行时关闭脚注开关, 检查已打开的预览是否按新插件重新解析
//   optional   运行时打开全部可选语法开关, 拍可选语法一节
//   nobuiltin  让内置 mermaid 不再接管 mermaid, 检查不支持的图改由 Kroki 渲染
//   source     图表的 </> 菜单: 复制原始 SVG 并核对剪贴板, 再用内置图片预览单独打开
// 环境变量 MTK_KROKI_SERVER 覆盖 Kroki 服务器地址, 用于拍服务不可达时的错误展示。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../devkit/shoot-ext.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = "preview-sample.md";

const settings = {};
if (process.env.MTK_KROKI_SERVER)
	settings["markdownToolkit.kroki.server"] = process.env.MTK_KROKI_SERVER;

// id 决定独立实例的配置目录名, 要短; port 在各插件之间错开, 便于并行重拍
const h = await launch({
	repo: REPO,
	id: "mdtk",
	port: 9346,
	settings,
	setup(ws) {
		fs.copyFileSync(path.join(REPO, "test/fixtures", SAMPLE), path.join(ws, SAMPLE));
	},
	open: [SAMPLE],
});

/** 预览内容在嵌套的 webview iframe 里, 逐个 frame 找到选择器所在的那个。 */
async function previewFrame(selector) {
	for (let i = 0; i < 20; i++) {
		for (const frame of h.page.frames()) {
			if (
				await frame
					.locator(selector)
					.count()
					.catch(() => 0)
			)
				return frame;
		}
		await h.sleep(500);
	}
	throw new Error(`预览里找不到 ${selector}`);
}

try {
	if (h.want("preview")) {
		await h.command("Markdown: Open Preview to the Side", 6000);
		await h.shot("preview");
		// 在预览上滚动一屏左右, 拍下半部分
		const vp = await h.page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
		await h.page.mouse.move(vp.w * 0.8, vp.h * 0.5);
		await h.page.mouse.wheel(0, 600);
		await h.sleep(1500);
		await h.shot("preview-scrolled", { keepMouse: true });
		await h.page.mouse.wheel(0, 700);
		await h.sleep(1500);
		await h.shot("preview-scrolled-2", { keepMouse: true });
	}
	if (h.want("toc")) {
		if (!h.want("preview")) await h.command("Markdown: Open Preview to the Side", 6000);
		const frame = await previewFrame(".mtk-toc-sidebar-toggle");
		const state = await frame.evaluate(() => ({
			width: innerWidth,
			collapsed: document
				.querySelector(".mtk-toc-sidebar")
				?.classList.contains("is-collapsed"),
		}));
		console.log("目录栏初始状态", state);
		if (state.collapsed) {
			await frame.locator(".mtk-toc-sidebar-toggle").click();
			await h.sleep(800);
		}
		await frame.locator('.mtk-toc-sidebar a:text-is("Kroki")').click();
		await h.sleep(1500);
		await h.shot("toc", { keepMouse: true });
	}
	if (h.want("task")) {
		if (!h.want("preview") && !h.want("toc"))
			await h.command("Markdown: Open Preview to the Side", 6000);
		const frame = await previewFrame(".mtk-task-toggle");
		await frame.locator(".mtk-task-toggle:has(input:not([checked]))").first().click();
		await h.sleep(2500);
		// 首次经 vscode:// 打开扩展 URI 时 VS Code 可能弹出确认框; 记录后点确认继续
		const dialog = h.page.locator(".monaco-dialog-box");
		if (await dialog.count()) {
			console.log(
				"出现确认框:",
				(await dialog.innerText()).replace(/\s+/g, " ").slice(0, 200)
			);
			await h.shot("task-dialog");
			await dialog.locator(".monaco-button", { hasText: "Open" }).click();
			await h.sleep(2500);
		}
		const lines = await h.page
			.locator(".editor-group-container .monaco-editor .view-lines")
			.first()
			.innerText();
		console.log(
			"编辑器里的任务行:",
			lines
				.split("\n")
				.filter(line => line.includes("release"))
				.join(" | ") || lines.slice(0, 200)
		);
		await h.shot("task", { keepMouse: true });
	}
	if (h.want("toggle")) {
		await h.command("Markdown: Open Preview to the Side", 6000);
		// 开关变化会触发 markdown.api.reloadPlugins, 预览 frame 可能被重建, 每次计数前重新查找
		const count = async () =>
			(await previewFrame(".markdown-alert")).locator(".footnote-ref").count();
		console.log("关闭前脚注引用数:", await count());
		await h.settings({ "markdownToolkit.footnotes.enabled": false }, 4000);
		console.log("关闭后脚注引用数:", await count());
		await h.shot("toggle", { keepMouse: true });
	}
	if (h.want("optional")) {
		if (!h.want("toggle")) await h.command("Markdown: Open Preview to the Side", 6000);
		const heading = '#core-optional-syntax, h2:text-is("Optional syntax")';
		const before = await previewFrame(".markdown-alert");
		console.log("开启前容器数:", await before.locator(".mtk-container").count());
		await h.settings(
			{
				"markdownToolkit.syntax.mark": true,
				"markdownToolkit.syntax.superscript": true,
				"markdownToolkit.syntax.subscript": true,
				"markdownToolkit.syntax.containers": true,
				"markdownToolkit.syntax.definitionLists": true,
			},
			4000
		);
		const frame = await previewFrame(".mtk-container");
		console.log("开启后容器数:", await frame.locator(".mtk-container").count());
		await frame
			.locator(heading)
			.first()
			.evaluate(element => element.scrollIntoView());
		await h.sleep(1500);
		await h.shot("optional", { keepMouse: true });
	}
	if (h.want("nobuiltin")) {
		await h.command("Markdown: Open Preview to the Side", 6000);
		const krokiMermaid = async () =>
			(await previewFrame(".markdown-alert"))
				.locator('.mtk-kroki[data-mtk-type="mermaid"]')
				.count();
		console.log("内置可用时 Kroki 渲染的 mermaid 数:", await krokiMermaid());
		// 与内置扩展缺失或被禁用走同一条检测分支
		await h.settings({ "markdown-mermaid.languages": [] }, 6000);
		console.log("内置不接管后 Kroki 渲染的 mermaid 数:", await krokiMermaid());
		const frame = await previewFrame('.mtk-kroki[data-mtk-type="mermaid"]');
		await frame
			.locator('.mtk-kroki[data-mtk-type="mermaid"]')
			.first()
			.evaluate(element => element.scrollIntoView());
		await h.sleep(1500);
		await h.shot("nobuiltin", { keepMouse: true });
	}
	if (h.want("source")) {
		await h.command("Markdown: Open Preview to the Side", 6000);
		const card = '.mtk-kroki[data-mtk-type="plantuml"]';
		const pick = async label => {
			const frame = await previewFrame(card);
			await frame
				.locator(card)
				.first()
				.evaluate(element => element.scrollIntoView({ block: "center" }));
			const menu = frame.locator(`${card} .mtk-diagram-tools`);
			if (!(await menu.evaluate(element => element.open))) {
				await menu.locator("summary").click();
				await h.sleep(500);
			}
			await frame.locator(`${card} .mtk-diagram-tools-item`, { hasText: label }).click();
			await h.sleep(2500);
			const dialog = h.page.locator(".monaco-dialog-box");
			if (await dialog.count()) {
				await dialog.locator(".monaco-button", { hasText: "Open" }).click();
				await h.sleep(2500);
			}
		};
		await pick("Copy SVG");
		await h.shot("source-menu", { keepMouse: true });
		// 预览页读不了剪贴板, 粘贴到新建的空白文件里核对
		await h.command("File: New Untitled Text File", 1500);
		await h.press("Mod+V", 1200);
		const pasted = await h.page
			.locator(".editor-group-container .monaco-editor .view-lines")
			.last()
			.innerText();
		console.log(
			"粘贴开头:",
			pasted.slice(0, 50).replace(/\s+/g, " "),
			"| 含 textLength:",
			pasted.includes("textLength")
		);
		await h.command("View: Revert and Close Editor", 1200);
		await pick("Open SVG");
		const tab = await h.page
			.locator(".tabs-container .tab.active")
			.innerText()
			.catch(() => "");
		console.log("当前标签:", tab.replace(/\s+/g, " "));
		await h.shot("source-open", { keepMouse: true });
	}
} finally {
	await h.close();
}
