import type { BaseRenderer } from "../../../utils/BaseRenderer";
import { LifeGui } from "./LifeGui";
import { LifeRenderer, type LifeRendererSettings } from "./LifeRenderer";
import type { BaseGui } from "../../../utils/BaseGui";


const presets: Record<string, Partial<LifeRendererSettings>> = {
	conway: {
		boardWidth: 256,
		boardHeight: 256,
		minFrameTime: .1, // minimum frame time in seconds
		color: {
			alive: [255 * .35, 255 * .85, 255], // RGB for alive cells
			dead: [255 * 0.05, 255 * 0.01, 255 * 0.25], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.16,
			birth: [3],
			survival: [2, 3],
		}
	},
	maze: {
		boardWidth: 512,
		boardHeight: 256,
		minFrameTime: .06, // minimum frame time in seconds
		color: {
			alive: [255, 255, 255], // RGB for alive cells
			dead: [0, 0, 0], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.02,
			birth: [3],
			survival: [1, 2, 3, 4, 5],
		}
	},
	inkspot: {
		boardWidth: 1024,
		boardHeight: 450,
		minFrameTime: 0.02,
		color: {
			alive: [0, 0, 0], // RGB for alive cells
			dead: [255, 240, 250], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.02,
			birth: [3],
			survival: [0,1,2,3,4,5,6,7,8],
		},
	},
	morley: {
		boardWidth: 512,
		boardHeight: 256,
		color: {
			alive: [20, 180, 230], // RGB for alive cells
			dead: [0, 0, 0], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.2,
			birth: [3,6,8],
			survival: [2,4,5],
		},
	},
	anneal: {
		boardWidth: 820,
		boardHeight: 512,
		minFrameTime: .03, // minimum frame time in seconds
		color: {
			alive: [20, 230, 100], // RGB for alive cells
			dead: [50, 40, 10], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.5,
			birth: [4,6,7,8],
			survival: [3,5,6,7,8],
		},
	},
};


let currentRenderer: BaseRenderer | null = null;
let currentCanvasListener: () => void;
let currentGui: BaseGui;

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
	presetsContainerId = "life-presets",
) {
	init(canvasId, errorsContainerId, 'conway');
	const buttons = document.getElementById(presetsContainerId)?.children;
	[...buttons].forEach((btn) => {

		if (!(btn instanceof HTMLElement)) {
			return;
		}

		btn.addEventListener('click', () => {
			init(canvasId, errorsContainerId, btn.dataset.preset)
		});
	});
}


async function init(
	canvasId: string = "wgpu-canvas",
	errorsContainerId: string = "wgpu-errors",
	presetName: keyof typeof presets,
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

	currentRenderer = new LifeRenderer(canvas, presets[presetName]);
	currentGui = new LifeGui(currentRenderer);

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
