import { TriangleRenderer } from "./TriangleRenderer";

export async function main(canvasId: string) {
	const canvas = <HTMLCanvasElement> document.getElementById(canvasId);
	if (!canvas) {
		console.error(`Could not get canvas with id ${canvasId}`);
	}

	const renderer = new TriangleRenderer(canvas, "triangle");

	renderer.initialize();
}
