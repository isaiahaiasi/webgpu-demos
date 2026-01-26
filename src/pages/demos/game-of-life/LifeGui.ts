import type { GUI } from "dat.gui";
import { BaseGui } from "../../../utils/BaseGui";
import type { LifeRenderer } from "./LifeRenderer";

export class LifeGui extends BaseGui {
	declare renderer: LifeRenderer;


	async initGui() {
		await super.initGui();
		this.addControls();
	}

	addControls() {
		// Controls that require a full reset
		const staticControls = this.gui.addFolder("Static");
		staticControls.add(this.renderer.settings, "workGroupSize", [4, 8, 16])
			.name("WorkGroupSize")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		staticControls.add(
			this.renderer.settings, "boardWidth", 32, 2048, 1)
			.name("BoardWidth")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		staticControls.add(this.renderer.settings, "boardHeight", 32, 2048, 1)
			.name("BoardHeight")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		staticControls.add(this.renderer.settings.rules, "initialDensity", 0, 1)
			.name("Density")
			.onFinishChange(() => {
				this.renderer.restart();
			});

		staticControls.open();

		// Controls that can update live
		const dynamicControls = this.gui.addFolder("Dynamic");
		dynamicControls.add(
			this.renderer.settings,
			"minFrameTime", 0, 1, 0.01)
			.name("MinFrameTime");

		dynamicControls.addColor(this.renderer.settings.color, "alive")
			.name("Alive Color")
			.onChange(() => { this.renderer.updateColorBuffer(); });
		dynamicControls.addColor(this.renderer.settings.color, "dead")
			.name("Dead Color")
			.onChange(() => { this.renderer.updateColorBuffer() });

		dynamicControls.open();
		console.log(this.renderer.settings.color)
	}
}
