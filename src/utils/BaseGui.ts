import { GUI } from 'lil-gui';
import Stats from 'stats.js';
import type { BaseRenderer } from './BaseRenderer';


export abstract class BaseGui {
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

	abstract addGuiControls(): void;

	constructor(renderer: BaseRenderer, container?: HTMLElement, label?: string) {
		this.label = label ?? 'gui';
		this.renderer = renderer;

		console.log({renderer, canvas: renderer.canvas})

		this.container = container ?? this.renderer.canvas.parentElement;

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
			this.addDefaultGuiOptions();
			this.addGuiControls();
			this.container.appendChild(this.gui.domElement);
		}
	}

	destroy() {
		this.stats?.dom.remove();
		this.gui?.destroy();
	}

	protected initStats() {
		if (this.stats) {
			return;
		}

		this.stats = new Stats();
		this.stats.showPanel(0);
		this.stats.dom.style.position = 'absolute';
		this.stats.dom.id = `${this.label}-stats`;
	}

	protected async initGui() {
		this.gui = this.gui ?? new GUI({ autoPlace: false });
		this.gui.domElement.id = `${this.label}-gui`;
		this.gui.domElement.style.position = 'absolute';
		this.gui.domElement.style.top = '0';
		this.gui.domElement.style.right = '0';
	}

	private addDefaultGuiOptions() {
		this.gui.add(this, "showStats").name("Show Stats");
	}
}
