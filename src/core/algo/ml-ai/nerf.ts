/**
 * nerf.ts - NeRF Volume Rendering
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A neural radiance field renders a pixel by marching a ray through a scene
 * and compositing the color and density at each sampled point. Each sample
 * contributes light in proportion to its opacity and the transmittance of all
 * earlier samples, reproducing the integral of the rendering equation with a
 * discrete sum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N samples along the ray
 *   Space: O(N) for the per-sample transmittance and contribution
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the accumulated red, green and blue channels and the remaining
 *     transmittance as the ray passes each sample.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NeRFSample {
    t: number;
    sigma: number;
    color: number[];
}

interface NeRFInput {
    samples?: NeRFSample[];
}

/** Composite a set of ray samples into a final RGB color and transmittance. */
export function volumeRender(samples: NeRFSample[]): {
    color: number[];
    transmittance: number;
    contributions: number[][];
    transmittances: number[];
} {
    let transmittance = 1;
    const color = [0, 0, 0];
    const contributions: number[][] = [];
    const transmittances: number[] = [];
    for (let i = 0; i < samples.length; i += 1) {
        const sample = samples[i];
        if (!sample) continue;
        const next = samples[i + 1];
        const previous = samples[i - 1];
        const delta = next
            ? next.t - sample.t
            : (previous ? sample.t - previous.t : 1);
        const alpha = 1 - Math.exp(-Math.max(0, sample.sigma) * Math.max(0, delta));
        const weight = transmittance * alpha;
        const contribution = [0, 1, 2].map((channel) => weight * (sample.color[channel] ?? 0));
        for (let channel = 0; channel < 3; channel += 1) {
            color[channel] = (color[channel] ?? 0) + (contribution[channel] ?? 0);
        }
        contributions.push(contribution);
        transmittances.push(transmittance);
        transmittance *= 1 - alpha;
    }
    return { color, transmittance, contributions, transmittances };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function runningColor(contributions: number[][], upTo: number): number[] {
    const result = [0, 0, 0];
    for (let i = 0; i <= upTo && i < contributions.length; i += 1) {
        const contribution = contributions[i];
        if (!contribution) continue;
        for (let channel = 0; channel < 3; channel += 1) {
            result[channel] = (result[channel] ?? 0) + (contribution[channel] ?? 0);
        }
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NeRFInput | null) ?? {};
    const samples: NeRFSample[] = task.samples ?? [
        { t: 1, sigma: 0.2, color: [0.9, 0.2, 0.1] },
        { t: 2, sigma: 0.5, color: [0.1, 0.7, 0.3] },
        { t: 3, sigma: 0.1, color: [0.2, 0.3, 0.9] },
    ];
    const { color, transmittance, contributions, transmittances } = volumeRender(samples);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars([0, 0, 0, 1], ["unvisited", "unvisited", "unvisited", "comparing"]),
        edges: [],
        description: `March a ray through ${samples.length} samples with full transmittance.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "start", color: [0, 0, 0], transmittance: 1 },
    };
    step += 1;

    for (let i = 0; i < samples.length; i += 1) {
        const accumulated = runningColor(contributions, i);
        const trans = transmittances[i] ?? 1;
        yield {
            stepNumber: step,
            entities: bars([...accumulated, trans], ["active", "comparing", "comparing", "comparing"]),
            edges: [],
            description: `Sample ${i}: opacity ${(1 - Math.exp(-(samples[i]?.sigma ?? 0))).toFixed(3)}; transmittance now ${trans.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "sample", color: accumulated, transmittance: trans },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars([...color, transmittance], ["sorted", "sorted", "sorted", "sorted"]),
        edges: [],
        description: `Done: composited RGB (${color.map((v) => v.toFixed(2)).join(", ")}) with transmittance ${transmittance.toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", color, transmittance },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A radiance field describes color and density at every point in space. To render one pixel, NeRF shoots a ray and samples points along it. Dense points block light from behind them, so each sample contributes only the light that was not already absorbed, producing the final color by front-to-back compositing.",
        invariants: [
            "Transmittance starts at one and never increases.",
            "Each sample's opacity is one minus the exponential of negative density times step size.",
            "The final color is the sum of transmittance times opacity times sample color over all samples.",
        ],
        correctness:
            "The rendering integral along a ray can be written as the integral of transmittance times density times color. Discretizing with sample spacing delta gives opacity alpha = 1 minus exp(-sigma delta), the exact transmittance decay of a constant-density segment. Front-to-back compositing accumulates transmittance times alpha times color, then multiplies transmittance by one minus alpha, which is the discrete quadrature of the same integral. For a single sample the result reduces to alpha times its color, matching the analytic solution of a constant-density segment.",
        complexityRationale:
            "Each of the N samples needs a constant number of arithmetic operations per color channel, giving O(N) time. Only the running color and transmittance plus the per-sample arrays are stored, using O(N) space.",
        uses: [
            "Novel view synthesis and 3D scene reconstruction",
            "Photorealistic rendering of captured objects",
            "Generating training views for robotics and simulation",
        ],
        references: [
            "Mildenhall et al., NeRF: Representing Scenes as Neural Radiance Fields, ECCV 2020",
            "Max, Optical Models for Direct Volume Rendering, IEEE TVCG 1995",
        ],
        workedExample:
            "For a single sample at distance 1 with density 0.2 and color (0.9, 0.2, 0.1), opacity is 1 minus exp(-0.2), about 0.181. The final color is roughly (0.163, 0.036, 0.018) and the remaining transmittance is about 0.819, exactly the constant-density analytic result.",
    },
    id: "nerf",
    name: "NeRF Volume Rendering",
    category: "ml-ai",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: {
        samples: [
            { t: 1, sigma: 0.2, color: [0.9, 0.2, 0.1] },
            { t: 2, sigma: 0.5, color: [0.1, 0.7, 0.3] },
            { t: 3, sigma: 0.1, color: [0.2, 0.3, 0.9] },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the sampled distances, densities and colors along the ray",
        "set accumulated color to black and transmittance to one",
        "for each sample compute opacity from density and step size",
        "add transmittance times opacity times sample color to the color",
        "multiply transmittance by one minus opacity",
        "done: report the composited color and transmittance",
    ],
};

export default module;
