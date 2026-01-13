export class RenderLoop {
	#animFrameId: number;
	timeSinceLastRender: number;
	timeSinceFirstRender = 0;
	paused = true;

	start(callback: (deltaTime: number) => boolean | void) {
		this.timeSinceFirstRender = 0;
		let prevTime = 0;

		if (this.#animFrameId) {
			cancelAnimationFrame(this.#animFrameId);
		}

		this.paused = false;

		const loop = (currentTime: number) => {
			this.#animFrameId = null;

			const deltaTime = (currentTime - prevTime) * 0.001 // ms -> s
			prevTime = currentTime;

			const resetTimeSinceLastRender = callback(deltaTime);

			if (resetTimeSinceLastRender === false) {
				this.timeSinceLastRender += deltaTime;
			} else {
				this.timeSinceLastRender = 0;
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
	}
}