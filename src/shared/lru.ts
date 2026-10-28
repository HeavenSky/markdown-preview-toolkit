/**
 * 按最近使用淘汰的有界缓存。
 *
 * 借助 Map 保持插入顺序: 命中时删除再插入即移到末尾, 超出容量时从头部淘汰最久未用的条目。
 */
export class LruCache<K, V> {
	readonly #map = new Map<K, V>();
	readonly #capacity: number;

	constructor(capacity: number) {
		if (!Number.isInteger(capacity) || capacity < 1) {
			throw new RangeError(`LruCache capacity must be a positive integer, got ${capacity}`);
		}
		this.#capacity = capacity;
	}

	get size(): number {
		return this.#map.size;
	}

	has(key: K): boolean {
		return this.#map.has(key);
	}

	get(key: K): V | undefined {
		if (!this.#map.has(key)) return undefined;
		const value = this.#map.get(key) as V;
		this.#map.delete(key);
		this.#map.set(key, value);
		return value;
	}

	set(key: K, value: V): void {
		this.#map.delete(key);
		this.#map.set(key, value);
		while (this.#map.size > this.#capacity) {
			const oldest = this.#map.keys().next();
			if (oldest.done) break;
			this.#map.delete(oldest.value);
		}
	}

	delete(key: K): boolean {
		return this.#map.delete(key);
	}

	clear(): void {
		this.#map.clear();
	}
}
