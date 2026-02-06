import { BaseGui } from "../../utils/BaseGui";
import type { SlimeRenderer } from "./SlimeRenderer";

export class SlimeGui extends BaseGui {
	declare renderer: SlimeRenderer;

	addGuiControls() {
		this.showStats = false;

		const initialOpts = this.gui.addFolder("Initial");

		initialOpts.add(this.renderer.settings, "agentCountTrunc", 1, 4_000, 1)
			.name("agents (x1k)")
			.onFinishChange(() => this.renderer.restart());

		initialOpts.add(this.renderer.settings, 'startModePos')
			.options(['center', 'field', 'subField', 'filledCircle'])
			.onFinishChange(() => this.renderer.restart());

		initialOpts.add(this.renderer.settings, 'startModeDir')
			.options(['random', 'toCenter', 'fromCenter'])
			.onFinishChange(() => this.renderer.restart());

		initialOpts.add(
			this.renderer.settings, "texWidth", 32, 2048, 16)
			.name("BoardWidth")
			.onFinishChange(() => {
				this.renderer.restart();
			});

		initialOpts.add(this.renderer.settings, "texHeight", 32, 2048, 16)
			.name("BoardHeight")
			.onFinishChange(() => {
				this.renderer.restart();
			});

		initialOpts.add(this.renderer.settings, "includeBg")
			.onFinishChange(() => this.renderer.restart());

		const dynamicOpts = this.gui.addFolder("Dynamic");
		dynamicOpts.addColor(this.renderer.settings, "backgroundColor")
			.name("bgCol");
		dynamicOpts.addColor(this.renderer.settings, "evaporateColor")
			.name("evaporateCol")
			.onChange((v: number[]) => {
				// If any color channel is 100%, evaporation of that channel will be 0,
				// so we clamp each channel to just under 100%.
				this.renderer.settings.evaporateColor = v.map(c => c == 1 ? c - 0.01 : c);
			});
		dynamicOpts.add(this.renderer.settings, "evaporateSpeed", 0, 100, .1)
			.name("evaporateSpd");
		dynamicOpts.add(this.renderer.settings, "diffuseSpeed", 0, 100)
			.name("diffuseSpd");
		dynamicOpts.add(this.renderer.settings, "moveSpeed", 0, 200, 1)
			.name("moveSpd");
		dynamicOpts.add(this.renderer.settings, "sensorAngle", (Math.PI / 180), 90 * (Math.PI / 180));
		dynamicOpts.add(this.renderer.settings, "sensorDst", 1, 100);
		dynamicOpts.add(this.renderer.settings, "turnSpeed", 1, 75).name("turnSpd");
	}
}
