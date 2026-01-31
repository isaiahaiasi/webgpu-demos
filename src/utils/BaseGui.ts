import { GUI } from 'lil-gui';
import Stats from 'stats.js';
import type { BaseRenderer } from './BaseRenderer';


export class BaseGui {


	public label: string;

	protected container: HTMLElement;
	protected gui: GUI;
	protected stats: Stats;
	protected renderer: BaseRenderer;

	#showStats = true;

	get showStats() { return this.#showStats; }
	set showStats(v) {
		this.#showStats = v;
		if (v) {
			this.container.prepend(this.stats.dom);
		} else {
			this.stats?.dom.remove();
		}
	}


	constructor(renderer: BaseRenderer, containerId?: string, label?: string) {
		this.label = label ?? 'gui';
		this.renderer = renderer;

		this.container = containerId
			? document.getElementById(containerId)
			: this.renderer.canvas.parentElement;

		this.renderer.onRender(() => { this.stats?.update() });
		this.renderer.onStart(async () => { await this.init(); });
	}

	async init() {
		if (!this.stats) {
			this.initStats();
			this.container.appendChild(this.stats.dom);
		}
		
		if (!this.gui) {
			await this.initGui();
			this.container.appendChild(this.gui.domElement);
			this.addDefaultGuiOptions();
		}
	}

	protected initStats() {
		if (this.stats) {
			this.stats.dom.remove();
		}

		this.stats = new Stats();
		this.stats.showPanel(0);
		this.stats.dom.style.position = 'absolute';
		this.stats.dom.id = `${this.label}-stats`;
	}

	protected async initGui() {
		if (this.gui) {
			this.gui.destroy();
		}

		this.gui = new GUI({ autoPlace: false });
		this.gui.domElement.id = `${this.label}-gui`;
		this.gui.domElement.style.position = 'absolute';
		this.gui.domElement.style.top = '0';
		this.gui.domElement.style.right = '0';
	}

	private addDefaultGuiOptions() {
		this.gui.add(this, "showStats").name("Show Stats");
	}
}
