import { Renderer } from "./Renderer";

export async function main(canvasId: string) {
	const canvas = document.getElementById(canvasId);
	if (!canvas) {
		console.error(`Could not get canvas with id ${canvasId}`);
	}

	const renderer = new Renderer(<HTMLCanvasElement> canvas, "triangle");

	renderer.initialize();
}
