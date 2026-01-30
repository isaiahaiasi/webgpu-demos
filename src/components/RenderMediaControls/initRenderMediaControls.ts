import type { BaseRenderer } from "../../utils/BaseRenderer";
import type { RenderMediaControlsElement } from "./RenderMediaControlsElement";

/** Initialize render media controls with given renderer.
 * Selector defaults to custom element name.
 * If multiple render-media-controls are on the page, must pass a selector.
 */
export function initRenderMediaControls(
	renderer: BaseRenderer,
	selector = "render-media-controls",
) {
	const controls = document.querySelector(selector) as RenderMediaControlsElement;
	if (controls) {
		controls.setRunner(renderer);
	}
}
