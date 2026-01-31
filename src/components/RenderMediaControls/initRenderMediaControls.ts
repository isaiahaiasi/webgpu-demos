import { custom } from "astro:schema";
import type { BaseRenderer } from "../../utils/BaseRenderer";
import type { RenderMediaControlsElement } from "./RenderMediaControlsElement";

/** Initialize render media controls with given renderer.
 * Selector defaults to custom element name.
 * If multiple render-media-controls are on the page, must pass a selector.
 */
export async function initRenderMediaControls(
	renderer: BaseRenderer,
	selector = "render-media-controls",
) {
	await customElements.whenDefined('render-media-controls');
	const controls = document.querySelector(selector) as RenderMediaControlsElement;
	controls?.setRunner(renderer);
}
