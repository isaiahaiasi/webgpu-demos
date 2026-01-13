import { PubSub } from "./PubSub";


type RenderLoopEvents = 'render' | 'step' | 'start' | 'stop';


export class RenderLoop {

	callback: (deltaTime: number) => boolean | void;
	timeSinceLastRender: number;
	timeSinceFirstRender = 0;
	pubsub = new PubSub<RenderLoopEvents>();
	
	#animFrameId: number;
	#paused = true;


	get paused() { return this.#paused; }


	constructor(callback: (deltaTime: number) => boolean | void) {
		this.callback = callback;
	}

	start() {
		this.timeSinceFirstRender = 0;
		let prevTime = 0;

		this.stop();

		this.#paused = false;
		this.pubsub.call('start');

		const loop = (currentTime: number) => {
			this.#animFrameId = null;

			const deltaTime = (currentTime - prevTime) * 0.001 // ms -> s
			prevTime = currentTime;

			const resetTimeSinceLastRender = this.callback(deltaTime);

			this.pubsub.call('step');

			if (resetTimeSinceLastRender === false) {
				this.timeSinceLastRender += deltaTime;
			} else {
				this.timeSinceLastRender = 0;
				this.pubsub.call('render');
			}

			this.timeSinceFirstRender += deltaTime;

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
		this.pubsub.call('stop');

	}
}