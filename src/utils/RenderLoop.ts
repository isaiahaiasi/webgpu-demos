import { PubSub } from "./PubSub";


type RenderLoopEvents = 'render' | 'step' | 'start' | 'stop';


/** Exposes min, max, and target values. Whenever one value is set,
 * the others are updated if necessary to stay valid.
 * (e.g., if min is 3 & max is 7, and min is updated to 9, max is also updated.)
 */
class FrameTime {
	#minFrameTime: number;
	#maxFrameTime: number;
	#targetFrameTime: number;

	get min() { return this.#minFrameTime; };
	get max() { return this.#maxFrameTime; };
	get target() { return this.#targetFrameTime; };

	set min(v: number) {
		this.#minFrameTime = v;
		if (v > this.#targetFrameTime) this.#targetFrameTime = v;
		if (v > this.#maxFrameTime) this.#maxFrameTime = v;
	};
	set max(v: number) {
		this.#maxFrameTime = v;
		if (v < this.#targetFrameTime) this.#targetFrameTime = v;
		if (v < this.#minFrameTime) this.#minFrameTime = v;
	};
	set target(v: number) {
		this.#targetFrameTime = v;
		if (v < this.#minFrameTime) this.#minFrameTime = v;
		if (v > this.#maxFrameTime) this.#maxFrameTime = v;
	};

	constructor(min = 1 / 120, target = 1 / 60, max = 1 / 15) {
		this.min = min;
		this.target = target;
		this.max = max;
	}
}


export class RenderLoop {

	callback: (deltaTime: number) => boolean;

	frameCount = 0;
	timeSinceLastRender = 0;
	timeSinceFirstRender = 0;
	frametime: FrameTime;

	pubsub = new PubSub<RenderLoopEvents>();

	#animFrameId: number;
	#paused = true;
	#prevStepTime: number = 0;

	// Allows consumers of the RenderLoop class to enforce backpressure.
	// This is necessary because `requestAnimationframe` does not care how long
	// it takes the GPU to render a new frame.
	framesPending = 0;
	maxPendingFrames = 2;

	get paused() { return this.#paused; }


	constructor(
		callback: (deltaTime: number) => boolean,
		minFrameTime = 0,
	) {
		this.callback = callback;
		this.frametime = new FrameTime(minFrameTime);
	}

	/** Time since previous step in seconds.
	 * Caps reported delta to max frame time.
	 * This prevents issues with certain frame-sensitive tasks,
	 * but the trade-off is if things rely on accumulated value it could drift.
	 */
	getDeltaTime(currentTime?: number) {
		let delta = (currentTime - this.#prevStepTime) * 0.001;

		return delta < this.frametime.max ? delta : this.frametime.target;
	}

	step(currentTime?: number) {
		const deltaTime = currentTime ? this.getDeltaTime(currentTime) : this.frametime.target;

		// If step not called by rAF, approximate its DOMHighResTimeStamp.
		this.#prevStepTime = currentTime ?? performance.now();

		// NOTE: This uses capped delta rather than "true" delta, meaning accumulated
		// time will be accurate to the game-state but not necessarily real elapsed time.
		this.timeSinceLastRender += deltaTime;
		this.timeSinceFirstRender += deltaTime;

		this.#animFrameId = null;
		this.pubsub.call('step');

		if (
			this.framesPending > this.maxPendingFrames
			|| this.frametime.min > this.timeSinceLastRender
		) {
			return;
		}


		this.callback(deltaTime);

		this.frameCount += 1;
		this.timeSinceLastRender = 0;
		this.pubsub.call('render');
	}

	start() {
		this.stop(); // Make sure cleanup is done if start() was called previously

		this.#paused = false;
		this.pubsub.call('start');

		const loop = (currentTime: number) => {
			this.step(currentTime);

			if (!this.paused) {
				this.#animFrameId = requestAnimationFrame(loop);
			}
		}

		this.#animFrameId = requestAnimationFrame((t) => loop(t));
	}

	stop() {
		if (!this.#animFrameId) {
			return;
		}

		cancelAnimationFrame(this.#animFrameId);

		this.#animFrameId = null;
		this.#paused = true;
		this.#prevStepTime = performance.now();
		this.pubsub.call('stop');
	}

	restart(){
		this.frameCount = 0;
		this.timeSinceFirstRender = 0;
		this.#prevStepTime = performance.now();
		this.start();
	}
}
