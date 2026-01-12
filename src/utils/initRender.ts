import type { BaseRenderer } from "./BaseRenderer";

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
