import { LifeGui } from "./LifeGui";
import { LifeRenderer } from "./LifeRenderer";
import type { BaseGui } from "../../../utils/BaseGui";
import { PauseHandler } from "../../../utils/PauseHandler";
import { presets, type PresetName } from "./presets";


/** Handles initial connection with DOM (canvas, buttons) & re-initialization */
export class RendererHandler {
	canvas: HTMLCanvasElement;
	errorsContainer: HTMLElement;
	renderer: LifeRenderer;
	gui: BaseGui;

	constructor(
		canvasId = "wgpu-canvas",
		errorsContainerId = "wgpu-errors",
		guiContainerId = "wgpu-gui",
		presetsContainerId = "life-presets",
	) {
		this.canvas = <HTMLCanvasElement>document.getElementById(canvasId);
		this.errorsContainer = document.getElementById(errorsContainerId);

		if (!this.canvas) {
			throw new Error(`Could not get canvas with id ${canvasId}`);
		}

		const buttons = document.getElementById(presetsContainerId)?.children;
		[...buttons].forEach((btn) => {

			if (!(btn instanceof HTMLElement)) {
				return;
			}

			btn.addEventListener('click', () => {
				this.init(<PresetName>btn.dataset.preset);
			});
		});

		this.renderer = new LifeRenderer(this.canvas, "life");
		this.gui = new LifeGui(this.renderer, guiContainerId);
		new PauseHandler(this.canvas).init(this.renderer);
		// initRenderMediaControls(this.renderer);

		this.init('conway');
	}

	async init(presetName: PresetName) {
		try {
			await this.renderer.initialize(presets[presetName]);
			await this.gui.init();
		} finally {
			this.printErrors();
		}
	}

	printErrors() {
		for (const errorMessage of this.renderer?.errors) {
			console.warn(errorMessage);

			if (this.errorsContainer) {
				const errorEl = document.createElement("div");
				errorEl.className = "wgpu-error-message";
				errorEl.textContent = errorMessage;
				this.errorsContainer.appendChild(errorEl);
			}
		}
	}
}



