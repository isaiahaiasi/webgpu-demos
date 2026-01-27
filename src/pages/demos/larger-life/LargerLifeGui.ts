import { BaseGui } from "../../../utils/BaseGui";
import type { LargerLifeRenderer } from "./LargerLifeRenderer";

export class LargerLifeGui extends BaseGui {

	declare renderer: LargerLifeRenderer;

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

		// Currently static but should be converted to Uniforms
		const ruleControls = this.gui.addFolder("Rules");
		ruleControls.add(this.renderer.settings.rules, "includeSelf")
			.name("IncludeSelf")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		ruleControls.add(this.renderer.settings.rules, "neighborhoodDistance", 1, 15, 1)
			.name("N. Distance")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		ruleControls.add(this.renderer.settings.rules, "survivalMin", 0, 1)
			.name("SurvivalMin")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		ruleControls.add(this.renderer.settings.rules, "survivalMax", 0, 1)
			.name("SurvivalMax")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		ruleControls.add(this.renderer.settings.rules, "birthMin", 0, 1)
			.name("BirthMin")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		ruleControls.add(this.renderer.settings.rules, "birthMax", 0, 1)
			.name("BirthMax")
			.onFinishChange(() => {
				this.renderer.restart();
			});

		const dynamicControls = this.gui.addFolder("Dynamic");
		dynamicControls.add(
			this.renderer.settings,
			"minFrameTime", 0, 1, 0.01)
			.name("MinFrameTime");

		dynamicControls.addColor(this.renderer.settings.color, "alive")
			.name("Alive Color")
			.onChange(() => this.renderer.updateColorBuffer());
		dynamicControls.addColor(this.renderer.settings.color, "dead")
			.name("Dead Color")
			.onChange(() => this.renderer.updateColorBuffer());
	}
}