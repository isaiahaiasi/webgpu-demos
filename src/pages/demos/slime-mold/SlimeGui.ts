import { BaseGui } from "../../../utils/BaseGui";
import type { SlimeRenderer } from "./SlimeRenderer";

export class SlimeGui extends BaseGui {
  declare renderer: SlimeRenderer;

  protected async initGui() {
    await super.initGui();

    const initialOpts = this.gui.addFolder("Initial");
    initialOpts.add(this.renderer.settings, "agentCount", 1000, 4_000_000, 1000)
      .onFinishChange(() => this.renderer.restart());
    initialOpts.add(this.renderer.settings, 'startModePos')
      .options(['center', 'field', 'subField', 'filledCircle'])
      .onFinishChange(() => this.renderer.restart());
    initialOpts.add(this.renderer.settings, 'startModeDir')
        .options(['random', 'toCenter', 'fromCenter'])
        .onFinishChange(() => this.renderer.restart());
    initialOpts.add(this.renderer.settings, "includeBg")
        .onFinishChange(() => this.renderer.restart());

    const dynamicOpts = this.gui.addFolder("Dynamic");
    dynamicOpts.open();
    dynamicOpts.addColor(this.renderer.settings, "evaporateColor").name("evaporateCol");
    dynamicOpts.add(this.renderer.settings, "evaporateSpeed", 0, 15, .1).name("evaporateSpd");
    dynamicOpts.add(this.renderer.settings, "diffuseSpeed", 0, 60).name("diffuseSpd");
    dynamicOpts.add(this.renderer.settings, "moveSpeed", 0, 150, 1).name("moveSpd");
    dynamicOpts.add(this.renderer.settings, "sensorAngle", (Math.PI / 180), 90 * (Math.PI / 180));
    dynamicOpts.add(this.renderer.settings, "sensorDst", 1, 100);
    dynamicOpts.add(this.renderer.settings, "turnSpeed", 1, 50).name("turnSpd");
  }
}
