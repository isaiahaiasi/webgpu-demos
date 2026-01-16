import type { BaseRenderer } from "./BaseRenderer";

// NOTE: This probably doesn't need to be generic.
// NOTE: Each demo might have different functionality (eg pausing)
// NOTE: Or have different subscribers (eg for GUI/Stats)
export async function initRender(
	rendererConstructor: new (c: HTMLCanvasElement, label: string) => BaseRenderer,
	rendererLabel: string,
	canvasId: string = "wgpu-canvas",
	errorsContainerId: string = "wgpu-errors",
) {
	const canvas = <HTMLCanvasElement> document.getElementById(canvasId);

	if (!canvas) {
		console.error(`Could not get canvas with id ${canvasId}`);
	}

	const renderer = new rendererConstructor(canvas, rendererLabel);

	canvas.addEventListener("click", () => {
		if (renderer.loop.paused) {
			renderer.loop.start();
			canvas.classList.remove('paused')
		} else {
			renderer.loop.stop();
			canvas.classList.add('paused')
		}
	});

	try {

		await renderer.initialize();

	} finally {
		const errorsContainer = document.getElementById(errorsContainerId);

		for (const errorMessage of renderer.errors) {
			const errorEl = document.createElement("div");
			errorEl.className = "wgpu-error-message";
			errorEl.textContent = errorMessage;
			errorsContainer.appendChild(errorEl);
		}
	}
}
