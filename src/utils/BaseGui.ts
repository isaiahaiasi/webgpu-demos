import { GUI } from 'lil-gui';
import Stats from 'stats.js';
import type { BaseRenderer } from './BaseRenderer';


export class BaseGui {

	label: string;

	protected parentElem: HTMLElement; 
	protected gui: GUI;
	protected stats: Stats;
	protected renderer: BaseRenderer;


	constructor(renderer: BaseRenderer, label: string = 'basegui') {
		this.label = label;
		this.renderer = renderer;
		this.parentElem = this.renderer.canvas.parentElement;

		this.renderer.onRender(() => { this.stats?.update() });
		this.renderer.onStart(async () => { await this.init(); });
	}

	async init() {
		this.destroy();
		this.initStats();
		await this.initGui();
		this.parentElem.appendChild(this.stats.dom);
		this.parentElem.appendChild(this.gui.domElement);
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
		this.stats.dom.id = 'life-stats';
	}

	protected async initGui() {
		this.gui = new GUI({ autoPlace: false });
		this.gui.domElement.id = `${this.label}-gui`;
		this.gui.domElement.style.position = 'absolute';
		this.gui.domElement.style.top = '0';
		this.gui.domElement.style.right = '0';
	}
}