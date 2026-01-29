import type { BaseRenderer } from "../../utils/BaseRenderer";

export class RenderMediaControlsElement extends HTMLElement {
	private runner: BaseRenderer;
	private frameCountSpan: HTMLSpanElement | null = null;
	private playPauseBtn: HTMLButtonElement | null = null;

	connectedCallback() {
		this.frameCountSpan = this.querySelector("[data-frame-count]");

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
				this.frameCountSpan.textContent = String(
					this.runner.loop.frameCount,
				);
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

customElements.define("render-loop-controls", RenderMediaControlsElement);