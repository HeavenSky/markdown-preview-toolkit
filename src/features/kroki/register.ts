import * as vscode from "vscode";
import type { FenceRenderer } from "../../markdown/fence";
import type { DiagramTools } from "../../markdown/tools";
import { refreshPreview } from "../../shared/preview";
import { KrokiCache } from "./resultCache";
import { type KrokiFailure, requestKroki } from "./client";
import { DIAGRAM_OPTIONS, normalizeServer, resolveKrokiLanguages } from "./languages";
import {
	type KrokiMessages,
	type KrokiSettings,
	createKrokiRenderer,
	createKrokiTypeRenderer,
	prepareResult,
} from "./render";
import { krokiPrefix } from "./svg";

const SECTION = "markdownToolkit.kroki";
const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;

function readTimeoutMs(config: vscode.WorkspaceConfiguration): number {
	const value = config.get<number>("timeout");
	return typeof value === "number" && Number.isFinite(value)
		? Math.max(MIN_TIMEOUT_MS, value)
		: DEFAULT_TIMEOUT_MS;
}

function describeFailure(failure: KrokiFailure, server: string): string {
	switch (failure.reason) {
		case "http":
			return vscode.l10n.t("Kroki returned HTTP {0}: {1}", failure.status, failure.detail);
		case "timeout":
			return vscode.l10n.t("Kroki did not respond within {0} ms.", failure.timeoutMs);
		case "network":
			return vscode.l10n.t(
				"Could not reach the Kroki server at {0}: {1}",
				server,
				failure.detail
			);
		case "not-svg":
			return vscode.l10n.t("Kroki returned a response that is not an SVG image.");
	}
}

const messages: KrokiMessages = {
	pending: () => vscode.l10n.t("Rendering diagram…"),
	invalidServer: raw =>
		vscode.l10n.t(
			"Invalid Kroki server URL: {0}. Set markdownToolkit.kroki.server to an http or https URL.",
			raw
		),
	failure: describeFailure,
	alt: type => vscode.l10n.t("{0} diagram", type),
};

export interface KrokiFeature {
	readonly render: FenceRenderer;
	/** 按 Kroki 的 mermaid 类型渲染, 供内置 mermaid 不可用时兜底。 */
	readonly renderMermaid: FenceRenderer;
	clear(): void;
}

export function registerKroki(context: vscode.ExtensionContext, tools: DiagramTools): KrokiFeature {
	let settings: KrokiSettings | undefined;
	let timeoutMs = DEFAULT_TIMEOUT_MS;
	const readSettings = (): KrokiSettings => {
		if (!settings) {
			const config = vscode.workspace.getConfiguration(SECTION);
			const rawServer = String(config.get<string>("server") ?? "");
			timeoutMs = readTimeoutMs(config);
			settings = {
				enabled: config.get<boolean>("enabled") === true,
				server: normalizeServer(rawServer),
				rawServer,
				languages: resolveKrokiLanguages(config.get("languages")),
			};
		}
		return settings;
	};

	const cache = new KrokiCache({
		request: async (server, type, source) =>
			prepareResult(
				await requestKroki(fetch, server, type, source, timeoutMs, DIAGRAM_OPTIONS[type]),
				krokiPrefix(server, type, source)
			),
		onUpdate: refreshPreview,
	});

	context.subscriptions.push(
		{ dispose: () => cache.dispose() },
		vscode.workspace.onDidChangeConfiguration(event => {
			if (!event.affectsConfiguration(SECTION)) return;
			settings = undefined;
			cache.clear();
			refreshPreview();
		})
	);

	return {
		render: createKrokiRenderer(readSettings, cache, messages, tools),
		renderMermaid: createKrokiTypeRenderer("mermaid", readSettings, cache, messages, tools),
		clear: () => cache.clear(),
	};
}
