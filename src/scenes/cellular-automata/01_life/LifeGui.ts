import type GUI from "lil-gui";
import { BaseGui } from "../../../utils/BaseGui";
import type { LifeRenderer, LifeRendererSettings } from "./LifeRenderer";
import { presets } from "./presets";

export class LifeGui extends BaseGui {
	declare renderer: LifeRenderer;

	settings: LifeRendererSettings;
	staticControls: GUI;
	dynamicControls: GUI;

	#currentPreset = "conway";

	async init() {
		if (this.options && this.settings !== this.renderer.settings) {
			this.settings = this.renderer.settings;
			this.dynamicControls.destroy();
			this.staticControls.destroy();
			this.addGuiControls();
		}
		super.init();
	}

	addGuiControls() {
		// Controls that require a full reset
		this.staticControls = this.options.addFolder("Static");

		this.staticControls.add({preset: this.#currentPreset}, "preset")
			.options(Object.keys(presets))
			.onChange((v: keyof typeof presets) => {
				this.#currentPreset = v;
				this.renderer.initialize(presets[v]);
			});

		this.staticControls.add(this.renderer.settings, "workGroupSize", [4, 8, 16])
			.name("WorkGroupSize")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		this.staticControls.add(
			this.renderer.settings, "boardWidth", 32, 2048, 1)
			.name("BoardWidth")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		this.staticControls.add(this.renderer.settings, "boardHeight", 32, 2048, 1)
			.name("BoardHeight")
			.onFinishChange(() => {
				this.renderer.restart();
			});
		this.staticControls.add(this.renderer.settings.rules, "initialDensity", 0, 1)
			.name("Density")
			.onFinishChange(() => {
				this.renderer.restart();
			});

		// Controls that can update live
		this.dynamicControls = this.options.addFolder("Dynamic");
		this.dynamicControls.add(
			this.renderer.loop.frametime,
			"min", 0, 1, 0.01)
			.name("MinFrameTime");

		this.dynamicControls.addColor(this.renderer.settings.color, "alive")
			.name("Alive Color")
			.onChange(() => { this.renderer.updateColorBuffer(); });
		this.dynamicControls.addColor(this.renderer.settings.color, "dead")
			.name("Dead Color")
			.onChange(() => { this.renderer.updateColorBuffer() });

	}
}
