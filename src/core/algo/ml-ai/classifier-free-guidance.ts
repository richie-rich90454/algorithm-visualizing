/**
 * classifier-free-guidance.ts - Classifier-Free Diffusion Guidance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Classifier-free guidance steers a diffusion sampler toward a condition by
 * blending two model predictions: an unconditional one and a conditional one.
 * The guided prediction is uncond plus scale times the difference cond minus
 * uncond. A scale of zero gives the unconditional prediction and a scale of one
 * gives the conditional one. This module shows that blend vector by vector over
 * a few denoising steps; it is the guidance formula itself, not a diffusion
 * model or a sampler.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * dim) for one blend per vector
 *   Space: O(dim) for the displayed guided vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are the guided prediction components at the current step.
 *   - The current step's vector is ACTIVE; earlier steps are summarized in meta.
 *   - Guidance scale, step, and all guided vectors are reported in meta.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GuidanceInput {
    uncond?: number[][];
    cond?: number[][];
    scale?: number;
}

function vectors(value: number[][] | undefined, fallback: number[][]): number[][] {
    return Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row))
        ? value
        : fallback;
}

/** Build the guided-vector bars for a frame. */
function makeBars(vector: number[]): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `component-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: "active" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Run the guidance blend across denoising steps. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GuidanceInput | null) ?? {};
    const uncond = vectors(task.uncond, [[1, 2, 3, 4], [0.5, 1, 1.5, 2]]);
    const cond = vectors(task.cond, [[2, 3, 1, 5], [1, 2, 2, 3]]);
    const scale = typeof task.scale === "number" ? task.scale : 2;
    const steps = Math.min(uncond.length, cond.length);
    const guided: number[][] = [];
    for (let i = 0; i < steps; i += 1) {
        const base = uncond[i] ?? [];
        const target = cond[i] ?? [];
        const dim = Math.min(base.length, target.length);
        const blended: number[] = [];
        for (let d = 0; d < dim; d += 1) {
            const u = base[d] ?? 0;
            const c = target[d] ?? 0;
            blended.push(u + scale * (c - u));
        }
        guided.push(blended);
    }
    let step = 0;

    const frame = (index: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(guided[index] ?? []),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: {
            scale,
            step: index,
            steps,
            guidedFlat: guided.flatMap((row) => row),
        },
    });

    yield frame(0, `Guidance scale ${scale}: blend ${steps} unconditional and conditional prediction vector(s).`, 0);

    for (let i = 0; i < steps; i += 1) {
        const blended = guided[i] ?? [];
        yield frame(i, `Step ${i}: guided = uncond + ${scale} times (cond - uncond), component 0 = ${blended[0]?.toFixed(3)}.`, 2);
    }

    yield frame(steps - 1, `Guidance finished across ${steps} step(s) at scale ${scale}.`, 5);
}

/** The classifier-free guidance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A conditional diffusion model can be asked to draw both with and without a prompt. Classifier-free guidance takes the difference between those two predictions and extrapolates beyond the conditional one, which sharpens adherence to the prompt without training a separate classifier. The guide scale controls how far the sampler is pushed.",
        invariants: [
            "At scale zero the guided prediction equals the unconditional prediction.",
            "At scale one the guided prediction equals the conditional prediction.",
            "The guided vector is an affine combination of the two predictions with coefficients (1 - scale) and scale.",
        ],
        correctness:
            "Expanding uncond plus scale times (cond minus uncond) gives (1 - scale) times uncond plus scale times cond, so the weights on the two predictions sum to one. Substituting scale zero and one reproduces the two endpoint predictions exactly, which a test verifies alongside a component-by-component reference.",
        complexityRationale:
            "Each of the steps blends dim components with a constant number of operations, so O(steps * dim) time. Only the current vector is displayed, giving O(dim) working space, plus the stored guided vectors for the metadata summary.",
        uses: [
            "Prompt-following image and video diffusion samplers",
            "Text-to-speech and music generation conditioning",
            "Controlled generation where a single scale tunes fidelity",
        ],
        references: [
            "Ho and Salimans, Classifier-Free Diffusion Guidance, 2021",
            "Nichol et al., GLIDE: Towards Photorealistic Image Generation, 2021",
        ],
        workedExample:
            "If the unconditional prediction is [1, 2] and the conditional one is [3, 4], the difference is [2, 2]. At scale 2 the guided prediction is [1, 2] + 2*[2, 2] = [5, 6], which lies beyond the conditional prediction in the direction that favors the prompt.",
    },
    id: "classifier-free-guidance",
    name: "Classifier-Free Guidance",
    category: "ml-ai",
    complexity: { time: "O(steps * dim)", space: "O(dim)" },
    defaultInput: { uncond: [[1, 2, 3, 4], [0.5, 1, 1.5, 2]], cond: [[2, 3, 1, 5], [1, 2, 2, 3]], scale: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "load the unconditional and conditional predictions for each step",
        "set the guidance scale",
        "for each denoising step",
        "compute the difference cond minus uncond componentwise",
        "set guided to uncond plus scale times that difference",
        "advance to the next step",
        "done: report all guided prediction vectors",
    ],
};

export default module;
