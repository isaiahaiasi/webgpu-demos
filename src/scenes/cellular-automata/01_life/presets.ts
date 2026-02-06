import type { LifeRendererSettings } from "./LifeRenderer";

export const presets = {
	conway: {
		boardWidth: 256,
		boardHeight: 256,
		minFrameTime: .1, // minimum frame time in seconds
		color: {
			alive: [.35, .85, 1], // RGB for alive cells
			dead: [0.05, 0.01, 0.25], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.16,
			birth: [3],
			survival: [2, 3],
		}
	},
	maze: {
		boardWidth: 512,
		boardHeight: 256,
		minFrameTime: .06, // minimum frame time in seconds
		color: {
			alive: [1, 1, 1], // RGB for alive cells
			dead: [0, 0, 0], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.02,
			birth: [3],
			survival: [1, 2, 3, 4, 5],
		}
	},
	inkspot: {
		boardWidth: 1024,
		boardHeight: 450,
		minFrameTime: 0.02,
		color: {
			alive: [0, 0, 0], // RGB for alive cells
			dead: [0.92, 0.89, 0.86], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.02,
			birth: [3],
			survival: [0, 1, 2, 3, 4, 5, 6, 7, 8],
		},
	},
	morley: {
		boardWidth: 512,
		boardHeight: 256,
		color: {
			alive: [0.08, 0.71, 0.90], // RGB for alive cells
			dead: [0, 0, 0], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.2,
			birth: [3, 6, 8],
			survival: [2, 4, 5],
		},
	},
	anneal: {
		boardWidth: 820,
		boardHeight: 512,
		minFrameTime: .03, // minimum frame time in seconds
		color: {
			alive: [0.08, 0.90, 0.39], // RGB for alive cells
			dead: [0.20, 0.16, 0.04], // RGB for dead cells
		},
		rules: {
			initialDensity: 0.5,
			birth: [4, 6, 7, 8],
			survival: [3, 5, 6, 7, 8],
		},
	},
} as const satisfies Record<string, Partial<LifeRendererSettings>>;

export type PresetName = keyof typeof presets;