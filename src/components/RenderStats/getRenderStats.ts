import type { RenderStatsElement } from "./RenderStatsElement";

export async function getRenderStats(
	selector = 'render-stats',
) {
	await customElements.whenDefined('render-stats');
	return document.querySelector(selector) as RenderStatsElement;
}
