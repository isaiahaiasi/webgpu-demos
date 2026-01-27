import { GUI } from 'lil-gui';
import Stats from 'stats.js';
import type { BaseRenderer } from './BaseRenderer';


export class BaseGui {

	label: string;

	protected container: HTMLElement;
	protected gui: GUI;
	protected stats: Stats;
	protected renderer: BaseRenderer;

	showStats = true;


	constructor(renderer: BaseRenderer, containerId?: string, label?: string) {
		this.label = label ?? 'gui_BASE';
		this.renderer = renderer;

		this.container = containerId
			? document.getElementById(containerId)
			: this.renderer.canvas.parentElement;

		this.renderer.onRender(() => { this.stats?.update() });
		this.renderer.onStart(async () => { await this.init(); });
	}

	async init() {
		this.destroy();
		this.initStats();
		await this.initGui();

		this.gui.add(this, "showStats")
			.name("Show Stats")
			.onChange((v: boolean) => {
				if (v) {
					this.container.prepend(this.stats.dom);
				} else {
					this.stats?.dom.remove();
				}
			});

		this.container.appendChild(this.stats.dom);
		this.container.appendChild(this.gui.domElement);
	}

	destroy() {
		this.stats?.dom.remove();
		this.gui?.domElement.remove();
		this.gui?.destroy();
	}

	protected initStats() {
		this.stats = new Stats();
		this.stats.showPanel(0);
		this.stats.dom.style.position = 'absolute';
		this.stats.dom.id = `${this.label}-stats`;
	}

	protected async initGui() {
		this.gui = new GUI({ autoPlace: false });
		this.gui.domElement.id = `${this.label}-gui`;
		this.gui.domElement.style.position = 'absolute';
		this.gui.domElement.style.top = '0';
		this.gui.domElement.style.right = '0';
	}
}