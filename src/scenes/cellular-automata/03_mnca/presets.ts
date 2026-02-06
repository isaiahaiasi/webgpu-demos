import type { MultiLifeRendererSettings } from "./MultiNeighborRenderer";

export const presets = [
	{
		neighborhoods: [
			{
				shapes: [
					{
						type: 'CIRCLE',
						minDist: 4,
						maxDist: 7,
					}
				]
			},
			{
				shapes: [
					{
						type: 'CIRCLE',
						minDist: 1,
						maxDist: 4,
					}
				]
			}
		],
		rules: [
			{
				neighborhoodIndex: 0,
				result: 1,
				minDensity: 0.21,
				maxDensity: 0.22,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0.35,
				maxDensity: 0.50,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0.750,
				maxDensity: 0.950,
			},
			{
				neighborhoodIndex: 1,
				result: -1,
				minDensity: 0.1,
				maxDensity: 0.280,
			},
			{
				neighborhoodIndex: 1,
				result: 1,
				minDensity: 0.430,
				maxDensity: 0.550,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0.120,
				maxDensity: 0.150,
			}
		],
	},
	// GAME OF LIFE
	// (FP precision makes very precise rules have some issues)
	{
		neighborhoods: [
			{
				shapes: [
					{
						type: 'SQUARE',
						minDist: 1,
						maxDist: 1,
					}
				]
			}
		],
		rules: [
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0,
				maxDensity: 1 / 8,
			},
			{
				neighborhoodIndex: 0,
				result: 1,
				minDensity: 3 / 8,
				maxDensity: 3 / 8,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 3.9 / 8,
				maxDensity: 1,
			},
		],
	},
	// BUGS:
	{
		neighborhoods: [{
			shapes: [
				{
					type: 'CIRCLE',
					minDist: 1,
					maxDist: 5,
				}
			],
		}],
		rules: [
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 0,
				maxDensity: 33 / 120,
			},
			{
				neighborhoodIndex: 0,
				result: 1,
				minDensity: 33.3 / 121,
				maxDensity: 45 / 121,
			},
			{
				neighborhoodIndex: 0,
				result: -1,
				minDensity: 58 / 121,
				maxDensity: 1.0,
			}
		],
	}
] as const satisfies Partial<MultiLifeRendererSettings>[];
