import { BaseGui } from "../../../utils/BaseGui";
import type { MultiLifeRenderer } from "./MultiNeighborRenderer";

export class MultiLifeGui extends BaseGui {

	declare renderer: MultiLifeRenderer;

	async initGui() {
		await super.initGui();
		this.addControls();
	}

	addControls() {
		const staticControls = this.gui.addFolder("Static");
		staticControls.add(this.renderer.settings, "workGroupSize", [4, 8, 16])
			.name("WorkGroupSize")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		staticControls.add(
			this.renderer.settings, "width", 32, 2048, 1)
			.name("BoardWidth")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		staticControls.add(this.renderer.settings, "height", 32, 2048, 1)
			.name("BoardHeight")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		staticControls.add(this.renderer.settings, "initialDensity", 0, 1)
			.name("Density")
			.onFinishChange(() => {
				this.renderer.restart();
			});

		const ruleControls = this.gui.addFolder("Rules");

		ruleControls.add({ preset: 0}, "preset", [0,1,2])
			.name("Preset")
			.onChange((v: number) => {
				// This may or may not trigger a restart,
				// depending on whether a static property (eg width) is defined on the preset.
				this.renderer.updateSettings(this.renderer.presets[v])
			});

		ruleControls.add(
			this.renderer.loop.frametime,
			"min", 0, 1, 0.01)
			.name("MinFrameTime");

		ruleControls.addColor(this.renderer.settings.color, "alive")
			.name("Alive Color")
			.onChange(() => this.renderer.updateColorBuffer());
		ruleControls.addColor(this.renderer.settings.color, "dead")
			.name("Dead Color")
			.onChange(() => this.renderer.updateColorBuffer());
	}
}