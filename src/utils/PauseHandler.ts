import type { BaseRenderer } from "./BaseRenderer";


export class PauseHandler {
	currentCanvasListener?: () => void;
	canvas: HTMLCanvasElement;
	renderer?: BaseRenderer;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
	}

	cleanup() {
		this.canvas.removeEventListener('click', this.currentCanvasListener);
	}

	init(renderer: BaseRenderer) {
		if (renderer === this.renderer) {
			return;
		}

		this.cleanup();

		this.renderer = renderer;

		this.currentCanvasListener = () => {
			if (this.renderer.loop.paused) {
				this.renderer.loop.start();
			} else {
				this.renderer.loop.stop();
			}
		}

		this.canvas.addEventListener("click", this.currentCanvasListener);

		// Other things might pause/unpause the renderer,
		// so we listen for changes instead of handling in the onClick listener.
		
		const pausedCSSClass = 'paused';

		this.renderer.onStart(() => {
			this.canvas.classList.remove(pausedCSSClass);
		});
		this.renderer.onStop(() => {
			this.canvas.classList.add(pausedCSSClass);
		});
	}
}
