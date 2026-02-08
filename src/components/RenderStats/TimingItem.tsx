import { createEffect, createSignal, onCleanup, onMount, type Component } from "solid-js";
import { useRenderer } from "../SceneWrapper/createScene";
import type { BaseRenderer } from "../../utils/BaseRenderer";

interface TimingItemProps {
	name: string;
	formatFn: (v: number) => string;
	updateFn: (renderer: BaseRenderer) => number;
}

export const TimingItem: Component<TimingItemProps> = (props) => {
	const [currentStat, setCurrentStat] = createSignal("---");
	const getRenderer = useRenderer();
	const rollingAverage = new NonNegativeRollingAverage();

	createEffect(() => {
		const renderer = getRenderer();

		if (!renderer) return;

		const listenerId = renderer.onRender(() => {
			rollingAverage.addSample(props.updateFn(renderer));
			const updatedAverage = rollingAverage.get();
			setCurrentStat(props.formatFn(updatedAverage));
		});

		onCleanup(() => { renderer.loop.pubsub.remove("render", listenerId) });
	});

	return <div>{props.name}: <span> { currentStat() } </span> </div>
}

// https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
// We disallow negative values as this is used for timestamp queries
// where it's possible for a query to return a beginning time greater than the
// end time. See: https://gpuweb.github.io/gpuweb/#timestamp
class NonNegativeRollingAverage {
	#total = 0;
	#samples = [];
	#cursor = 0;
	#numSamples: number;
	constructor(numSamples = 120) {
		this.#numSamples = numSamples;
	}

	addSample(v: number) {
		if (!Number.isNaN(v) && Number.isFinite(v) && v >= 0) {
			this.#total += v - (this.#samples[this.#cursor] || 0);
			this.#samples[this.#cursor] = v;
			this.#cursor = (this.#cursor + 1) % this.#numSamples;
		}
	}
	get() {
		return this.#total / this.#samples.length;
	}
}