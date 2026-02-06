import { initRenderMediaControls } from "../../../components/RenderMediaControls/initRenderMediaControls";
import { PauseHandler } from "../../../utils/PauseHandler";
import { MultiLifeGui } from "./MultiNeighborGui";
import { MultiLifeRenderer } from "./MultiNeighborRenderer";


export async function main(
	canvasId: string,
	errorsContainerId: string,
	guiContainerId: string,
) {

	const canvas = <HTMLCanvasElement>document.getElementById(canvasId);

	if (!canvas) {
		console.error(`Could not get canvas with id ${canvasId}`);
	}

	const renderer = new MultiLifeRenderer(canvas);
	new MultiLifeGui(renderer, guiContainerId, 'multi-life');
	new PauseHandler(canvas).init(renderer);
	initRenderMediaControls(renderer);
	

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
