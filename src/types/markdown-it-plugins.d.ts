// markdown-it-mark 与 markdown-it-sup 在 npm 上没有类型包, 二者都是无选项的 markdown-it 插件。

declare module "markdown-it-mark" {
	import type { PluginSimple } from "markdown-it";
	const plugin: PluginSimple;
	export default plugin;
}

declare module "markdown-it-sup" {
	import type { PluginSimple } from "markdown-it";
	const plugin: PluginSimple;
	export default plugin;
}
