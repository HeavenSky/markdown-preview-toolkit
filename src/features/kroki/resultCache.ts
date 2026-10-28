import { createHash } from "node:crypto";
import { LruCache } from "../../shared/lru";
import { type KrokiResult, isTransient } from "./client";

const CACHE_CAPACITY = 200;
const TRANSIENT_TTL_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 300;

export interface KrokiCacheOptions {
	readonly request: (server: string, type: string, source: string) => Promise<KrokiResult>;
	/** 有新结果写入后调用, 300ms 防抖; 用于让预览重新渲染以取用缓存。 */
	readonly onUpdate: () => void;
	readonly now?: () => number;
}

interface Entry {
	readonly result: KrokiResult;
	readonly expiresAt: number;
}

export function cacheKey(server: string, type: string, source: string): string {
	return createHash("sha256")
		.update(server)
		.update("\0")
		.update(type)
		.update("\0")
		.update(source)
		.digest("hex");
}

/**
 * Kroki 结果缓存。markdown-it 的渲染是同步的, 而请求是异步的: 未命中时先返回 `undefined`
 * 让调用方输出占位, 后台请求完成后写入缓存并触发一次刷新, 刷新时再从缓存取结果。
 *
 * 只有新结果才触发刷新, 刷新后的渲染命中缓存不会再发请求, 因此不会形成刷新循环。
 */
export class KrokiCache {
	readonly #entries = new LruCache<string, Entry>(CACHE_CAPACITY);
	readonly #inflight = new Map<string, Promise<void>>();
	readonly #options: KrokiCacheOptions;
	readonly #now: () => number;
	#generation = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: KrokiCacheOptions) {
		this.#options = options;
		this.#now = options.now ?? Date.now;
	}

	lookup(server: string, type: string, source: string): KrokiResult | undefined {
		const key = cacheKey(server, type, source);
		const entry = this.#entries.get(key);
		if (entry && entry.expiresAt > this.#now()) return entry.result;
		if (!this.#inflight.has(key)) this.#fetch(key, server, type, source);
		return undefined;
	}

	clear(): void {
		this.#generation += 1;
		this.#entries.clear();
		this.#inflight.clear();
	}

	dispose(): void {
		this.clear();
		if (this.#timer) clearTimeout(this.#timer);
	}

	#fetch(key: string, server: string, type: string, source: string): void {
		const generation = this.#generation;
		const pending = this.#options.request(server, type, source).then(result => {
			// 期间被清空过: 配置已变, 这个结果不再有效
			if (generation !== this.#generation) return;
			this.#inflight.delete(key);
			const ttl =
				result.kind === "error" && isTransient(result.failure)
					? TRANSIENT_TTL_MS
					: Infinity;
			this.#entries.set(key, { result, expiresAt: this.#now() + ttl });
			this.#scheduleUpdate();
		});
		this.#inflight.set(key, pending);
	}

	#scheduleUpdate(): void {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.#timer = undefined;
			this.#options.onUpdate();
		}, REFRESH_DEBOUNCE_MS);
	}
}
