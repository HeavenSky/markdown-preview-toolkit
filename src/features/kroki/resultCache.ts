import { createHash } from "node:crypto";
import { LruCache } from "../../shared/lru";
import { type KrokiResult, isTransient } from "./client";

const CACHE_CAPACITY = 200;
const TRANSIENT_TTL_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 300;
/** 活跃条目在持续不被查看这么久后移出活跃集合, 结果随之只受历史 LRU 约束。 */
const ACTIVE_TTL_MS = 10 * 60_000;

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
 * 最近被查看过的条目另存于活跃集合, 不随历史 LRU 淘汰: 活跃图表数超过 `CACHE_CAPACITY`
 * 时也不会互相淘汰, 进而避免每次刷新都重新请求刚被淘汰的图。
 */
export class KrokiCache {
	readonly #entries = new LruCache<string, Entry>(CACHE_CAPACITY);
	/** 活跃预览所需的条目; `Entry` 与历史缓存共享同一个结果对象, 不复制 SVG 内容。 */
	readonly #active = new Map<string, { entry: Entry; lastUsed: number }>();
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
		const now = this.#now();
		this.#pruneActive(now);
		const entry = this.#entries.get(key) ?? this.#active.get(key)?.entry;
		if (entry && entry.expiresAt > now) {
			this.#touchActive(key, entry, now);
			return entry.result;
		}
		if (!this.#inflight.has(key)) this.#fetch(key, server, type, source);
		return undefined;
	}

	clear(): void {
		this.#generation += 1;
		this.#entries.clear();
		this.#active.clear();
		this.#inflight.clear();
	}

	dispose(): void {
		this.clear();
		if (this.#timer) clearTimeout(this.#timer);
	}

	#touchActive(key: string, entry: Entry, now: number): void {
		const active = this.#active.get(key);
		if (active) {
			active.entry = entry;
			active.lastUsed = now;
		} else {
			this.#active.set(key, { entry, lastUsed: now });
		}
	}

	#pruneActive(now: number): void {
		for (const [key, active] of this.#active) {
			if (now - active.lastUsed > ACTIVE_TTL_MS) this.#active.delete(key);
		}
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
			const entry = { result, expiresAt: this.#now() + ttl };
			this.#entries.set(key, entry);
			this.#touchActive(key, entry, this.#now());
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
