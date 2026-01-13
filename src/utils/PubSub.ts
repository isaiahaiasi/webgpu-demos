export class PubSub<T extends string> {
	#listeners = {} as Record<T, Map<number, () => void>>;

	add(event: T, listener: () => void): number {
		if (!this.#listeners[event]) {
			this.#listeners[event] = new Map();
		}

		const key = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

		this.#listeners[event].set(key, listener);

		return key;
	}

	remove(event: T, key: number): boolean {
		if (!this.#listeners[event]) {
			return false;
		}

		return this.#listeners[event].delete(key);
	}

	call(event: T) {
		if (!this.#listeners[event]) {
			return;
		}

		for (const listener of this.#listeners[event].values()) {
			listener();
		}
	}
}
