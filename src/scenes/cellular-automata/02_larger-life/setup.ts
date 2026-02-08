import { LargerLifeGui } from "./LargerLifeGui";
import { LargerLifeRenderer } from "./LargerLifeRenderer";


export async function main(
	canvasId: string,
	errorsContainerId: string,
	guiContainerId: string,
) {

	const canvas = <HTMLCanvasElement>document.getElementById(canvasId);

	if (!canvas) {
		console.error(`Could not get canvas with id ${canvasId}`);
	}

	const renderer = new LargerLifeRenderer(canvas);
	new LargerLifeGui(renderer, guiContainerId, 'largerlife');
	// new PauseHandler(canvas).init(renderer);

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
