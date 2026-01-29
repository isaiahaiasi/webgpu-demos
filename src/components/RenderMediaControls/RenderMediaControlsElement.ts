import type { BaseRenderer } from "../../utils/BaseRenderer";


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


export class RenderMediaControlsElement extends HTMLElement {
	private runner: BaseRenderer;
	private frameCountSpan: HTMLSpanElement | null = null;
  private timeSpan: HTMLSpanElement | null = null;
	private playPauseBtn: HTMLButtonElement | null = null;

	connectedCallback() {
		this.frameCountSpan = this.querySelector("[data-frame-count]");
		this.timeSpan = this.querySelector("[data-time]");

		this.playPauseBtn = this.querySelector(
			"[data-playpause]",
		) as HTMLButtonElement;
		const resetBtn = this.querySelector(
			"[data-reset]",
		) as HTMLButtonElement;
		const stepBtn = this.querySelector(
			"[data-step]",
		) as HTMLButtonElement;

		this.playPauseBtn?.addEventListener("click", () => {
			if (this.runner?.loop.paused) {
				this.runner.loop.start();
			} else {
				this.runner?.loop.stop();
			}
		}
			
		);
		resetBtn?.addEventListener("click", () => this.runner?.restart());
		stepBtn?.addEventListener("click", () => {
			if (!this.runner?.loop.paused) {
				this.runner?.loop.stop();
			}
			this.runner?.loop.step();
		});
	}

	setRunner(runner: BaseRenderer) {
		this.runner = runner;
		this.runner.onRender(() => {
			if (this.frameCountSpan) {
				this.frameCountSpan.textContent = "" + this.runner.loop.frameCount;
			}
      if (this.timeSpan) {
        this.timeSpan.textContent = this.runner.loop.timeSinceFirstRender.toFixed(3);
      }
		});
		this.runner.onStart(() => {
			this.playPauseBtn.textContent = "Stop";
		});
		this.runner.onStop(() => {
			this.playPauseBtn.textContent = "Play ";
		});
	}
}

customElements.define("render-media-controls", RenderMediaControlsElement);