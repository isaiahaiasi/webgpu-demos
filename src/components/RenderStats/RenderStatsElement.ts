export class RenderStatsElement extends HTMLElement {
	timings = new Map<string, Timing>();
	#timingsContainerElement: HTMLElement;

	constructor() {
		super();
		this.#timingsContainerElement = this.querySelector("pre");
	}

	add(name: string, formatFn: (v: number) => string) {
		const timing = new Timing(name, formatFn);
		this.timings.set(name, timing);
		this.#timingsContainerElement.appendChild(timing.timeElement);
	}

	update(name: string, value: number) {
		const timing = this.timings.get(name);
		if (timing && value) {
			timing.time = value;
		}
	}
}

customElements.define("render-stats", RenderStatsElement);


class Timing {
	timeElement: HTMLElement;
	#name: string;
	#timeResultElement: HTMLElement;
	#formatFn: (v: number) => string;

	#rollingAverage = new NonNegativeRollingAverage();

	get time() { return this.#rollingAverage.get(); }
	set time(v) {
		this.#rollingAverage.addSample(v);
		this.#timeResultElement.textContent = this.#formatFn(
			this.#rollingAverage.get()
		);
	}

	constructor(name: string, formatFn: (v: number) => string) {
		this.#name = name;
		this.#formatFn = formatFn;
		this.timeElement = document.createElement("div");
		this.timeElement.appendChild(document.createTextNode(`${this.#name}: `));
		this.#timeResultElement = document.createElement("span");
		this.#timeResultElement.appendChild(document.createTextNode("--"));
		this.timeElement.appendChild(this.#timeResultElement);
	}
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
