import type { BaseGui } from "../../../utils/BaseGui";
import type { BaseRenderer } from "../../../utils/BaseRenderer";
import { LargerLifeGui } from "./LargerLifeGui";
import { LargerLifeRenderer } from "./LargerLifeRenderer";



let currentRenderer: BaseRenderer | null = null;
let currentGui: BaseGui | null = null;
let currentCanvasListener: (() => void) | null = null;


function handlePause(canvas: HTMLCanvasElement, renderer: BaseRenderer) {
	const paused = 'paused';

	canvas.removeEventListener('click', currentCanvasListener);

	currentCanvasListener = () => {
		if (renderer.loop.paused) {
			renderer.loop.start();
		} else {
			renderer.loop.stop();
		}
	}

	canvas.addEventListener("click", currentCanvasListener);

	// Lots of other things might pause/unpause the renderer,
	// so we listen for changes instead of handling in the onClick listener.
	renderer.onStart(() => {
		canvas.classList.remove(paused);
	});
	renderer.onStop(() => {
		canvas.classList.add(paused);
	});
}

export async function main(
	canvasId = "wgpu-canvas",
	errorsContainerId = "wgpu-errors",
) {
	if (currentRenderer) {
		currentRenderer.loop.stop();
	}

	if (currentGui) {
		currentGui.destroy();
	}

	const canvas = <HTMLCanvasElement>document.getElementById(canvasId);

	if (!canvas) {
		console.error(`Could not get canvas with id ${canvasId}`);
	}

	currentRenderer = new LargerLifeRenderer(canvas);
	currentGui = new LargerLifeGui(currentRenderer);

	handlePause(canvas, currentRenderer);

	try {
		await currentGui.init();
		await currentRenderer.initialize();

	} finally {
		const errorsContainer = document.getElementById(errorsContainerId);

		for (const errorMessage of currentRenderer.errors) {
			const errorEl = document.createElement("div");
			errorEl.className = "wgpu-error-message";
			errorEl.textContent = errorMessage;
			errorsContainer.appendChild(errorEl);
		}
	}
}
