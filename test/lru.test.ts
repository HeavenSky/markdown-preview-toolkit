import { describe, expect, it } from "vitest";
import { LruCache } from "../src/shared/lru";

describe("LruCache", () => {
	it("超出容量时淘汰最久未用的条目", () => {
		const cache = new LruCache<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.get("a")).toBe(1);
		cache.set("c", 3);
		expect(cache.has("b")).toBe(false);
		expect(cache.get("a")).toBe(1);
		expect(cache.get("c")).toBe(3);
		expect(cache.size).toBe(2);
	});

	it("覆盖写入同一个键不增加条目", () => {
		const cache = new LruCache<string, number>(2);
		cache.set("a", 1);
		cache.set("a", 2);
		expect(cache.size).toBe(1);
		expect(cache.get("a")).toBe(2);
	});

	it("支持删除与清空", () => {
		const cache = new LruCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.delete("a")).toBe(true);
		cache.clear();
		expect(cache.size).toBe(0);
	});

	it("拒绝非法容量", () => {
		expect(() => new LruCache(0)).toThrow(RangeError);
		expect(() => new LruCache(1.5)).toThrow(RangeError);
	});
});
