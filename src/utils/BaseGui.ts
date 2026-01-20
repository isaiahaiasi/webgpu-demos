import type { GUI } from 'dat.gui';
import Stats from 'stats.js';
import type { BaseRenderer } from './BaseRenderer';


// dat.gui assumes DOM is available, so we import it dynamically to avoid
// issues with Astro SSG attempting to process at build time.
// import('dat.gui');
let dat: any;


export class BaseGui {

	label: string;

	protected parentElem: HTMLElement; 
	protected gui: GUI;
	protected stats: Stats;
	protected renderer: BaseRenderer;


	constructor(renderer: BaseRenderer, label: string = 'base') {
		this.renderer = renderer;
		this.renderer.onRender(() => { this.stats?.update() });

		// TODO: change to onInit instead of onUnpause...
		this.renderer.onStart(async () => { await this.init(); });

		this.parentElem = this.renderer.canvas.parentElement;
		this.label = label;
	}

	async init() {
		this.#cleanup();
		this.initStats();
		await this.initGui();
		this.parentElem.appendChild(this.stats.dom);
		this.parentElem.appendChild(this.gui.domElement);
	}

	destroy() {
		this.#cleanup();
	}

	#cleanup() {
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
		// dat.gui assumes DOM is available, so we import it dynamically to avoid
		// issues with Astro SSG attempting to process at build time.
		dat = dat ?? await import('dat.gui');

		this.gui = new dat.GUI({ name: `${this.label}::gui`, autoPlace: false });
		this.gui.domElement.id = `${this.label}-gui`;
		this.gui.domElement.style.position = 'absolute';
		this.gui.domElement.style.top = '0';
		this.gui.domElement.style.right = '0';
	}
}