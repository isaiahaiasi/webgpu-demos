import { PubSub } from "./PubSub";


type RenderLoopEvents = 'render' | 'step' | 'start' | 'stop';


export class RenderLoop {

	callback: (deltaTime: number) => boolean;
	frameCount = 0;
	timeSinceLastRender: number;
	timeSinceFirstRender = 0;
	pubsub = new PubSub<RenderLoopEvents>();

	#animFrameId: number;
	#paused = true;
	#prevRenderTime: number = Number.MAX_SAFE_INTEGER;

	// Used so consumers of the RenderLoop class can throttle the render loop.
	// This is important because requestAnimationframe is called based on *browser*
	// refresh rate--it doesn't care how long it takes to actually render
	// a new frame.
	framesPending = 0;
	maxPendingFrames = 2;

	// Don't respect time scaling if the frame took more than 1/15th of a second.
	maxTimeDelta = .067;
	targetFrameTime = .0166667;

	get paused() { return this.#paused; }


	constructor(callback: (deltaTime: number) => boolean) {
		this.callback = callback;
	}

	getDeltaTime(currentTime: number) {
		const delta = (currentTime - this.#prevRenderTime) * 0.001;
		return delta < this.maxTimeDelta ? delta : this.targetFrameTime;
	}

	step(currentTime?: number) {
		if (!currentTime) {
			currentTime = performance.now();
		}

		this.#animFrameId = null;

		const deltaTime = this.getDeltaTime(currentTime);

		this.#prevRenderTime = currentTime;

		let wasFrameRendered = false;

		if (this.framesPending < this.maxPendingFrames) {
			wasFrameRendered = this.callback(deltaTime);
		}

		this.pubsub.call('step');

		if (wasFrameRendered === false) {
			this.timeSinceLastRender += deltaTime;
		} else {
			this.frameCount += 1;
			this.timeSinceLastRender = 0;
			this.pubsub.call('render');
		}

		this.timeSinceFirstRender += deltaTime;
	}

	start() {
		this.timeSinceFirstRender = 0;
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
		this.#prevRenderTime = 0;
		this.pubsub.call('stop');
	}
}