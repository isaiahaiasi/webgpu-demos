import { GUI } from 'lil-gui';
import type { BaseRenderer } from './BaseRenderer';


export abstract class BaseGui {
	public label: string;
	public container: HTMLElement;
	public options: GUI;

	protected renderer: BaseRenderer;

	abstract addGuiControls(): void;

	constructor(renderer: BaseRenderer, container?: HTMLElement, label?: string) {
		this.label = label ?? 'gui';
		this.renderer = renderer;
		this.container = container ?? this.renderer.canvas.parentElement;
		this.renderer.onStart(async () => { await this.init(); });
	}

	async init() {
		if (this.options) {
			return;
		}

		await this.initGui();
		this.addGuiControls();
		this.container.appendChild(this.options.domElement);
	}

	destroy() {
		this.options?.destroy();
	}

	protected async initGui() {
		this.options = this.options ?? new GUI({ autoPlace: false });
		this.options.domElement.id = `${this.label}-gui`;
		this.options.domElement.style.position = 'absolute';
		this.options.domElement.style.top = '0';
		this.options.domElement.style.right = '0';
	}
}
