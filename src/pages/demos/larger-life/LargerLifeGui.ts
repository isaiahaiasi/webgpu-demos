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

		const ruleControls = this.gui.addFolder("Rules");
		ruleControls.add(this.renderer.settings.rules, "includeSelf")
			.name("IncludeSelf")
			.onChange(() => {
				this.renderer.updateRuleBuffer();
			});
		ruleControls.add(this.renderer.settings.rules, "neighborDistance", 1, 15, 1)
			.name("N. Distance")
			.onChange(() => {
				this.renderer.updateRuleBuffer();
			});
		ruleControls.add(this.renderer.settings.rules, "survivalMin", 0, 1)
			.name("SurvivalMin")
			.onChange(() => {
				this.renderer.updateRuleBuffer();
			});
		ruleControls.add(this.renderer.settings.rules, "survivalMax", 0, 1)
			.name("SurvivalMax")
			.onChange(() => {
				this.renderer.updateRuleBuffer();
			});
		ruleControls.add(this.renderer.settings.rules, "birthMin", 0, 1)
			.name("BirthMin")
			.onChange(() => {
				this.renderer.updateRuleBuffer();
			});
		ruleControls.add(this.renderer.settings.rules, "birthMax", 0, 1)
			.name("BirthMax")
			.onChange(() => {
				this.renderer.updateRuleBuffer();
			});

		ruleControls.add(
			this.renderer.settings,
			"minFrameTime", 0, 1, 0.01)
			.name("MinFrameTime");

		ruleControls.addColor(this.renderer.settings.color, "alive")
			.name("Alive Color")
			.onChange(() => this.renderer.updateColorBuffer());
		ruleControls.addColor(this.renderer.settings.color, "dead")
			.name("Dead Color")
			.onChange(() => this.renderer.updateColorBuffer());
	}
}