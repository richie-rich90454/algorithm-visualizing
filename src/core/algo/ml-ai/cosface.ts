/**
 * cosface.ts - CosFace Additive Cosine Margin
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CosFace subtracts a fixed cosine margin m directly from the normalized
 * cosine of the true class, then scales the result by s. Unlike ArcFace, which
 * shifts the angle before taking the cosine, CosFace shifts the cosine value
 * itself. Both widen the decision margin, but through different geometry.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for d-dimensional vectors
 *   Space: O(d) for the normalized vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the raw cosine, the margin-shifted cosine, and the final logit.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CosfaceInput {
    feature?: number[];
    weight?: number[];
    scale?: number;
    margin?: number;
}

/** Return the unit vector in the direction of v, or the zero vector. */
export function normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return norm === 0 ? v.map(() => 0) : v.map((x) => x / norm);
}

/** Compute the CosFace target logit with an additive cosine margin. */
export function cosfaceLogit(feature: number[], weight: number[], scale: number, margin: number) {
    const xn = normalize(feature);
    const wn = normalize(weight);
    const len = Math.min(xn.length, wn.length);
    let dot = 0;
    for (let i = 0; i < len; i += 1) dot += (xn[i] ?? 0) * (wn[i] ?? 0);
    const cosTheta = Math.max(-1, Math.min(1, dot));
    const shifted = cosTheta - margin;
    const logit = scale * shifted;
    return { cosTheta, shifted, logit, xn, wn };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CosfaceInput | null) ?? {};
    const feature: number[] = task.feature ?? [2, 1, 0.5];
    const weight: number[] = task.weight ?? [1, 1, 0];
    const scale = typeof task.scale === "number" ? task.scale : 10;
    const margin = typeof task.margin === "number" ? task.margin : 0.35;
    const { cosTheta, shifted, logit } = cosfaceLogit(feature, weight, scale, margin);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars([cosTheta, 0, 0], ["comparing", "idle", "idle"]),
        edges: [],
        description: `Normalize both vectors and measure their cosine: ${cosTheta.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "cosine", scale, margin, cosTheta, shifted: 0, logit: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([cosTheta, shifted, 0], ["sorted", "active", "idle"]),
        edges: [],
        description: `Subtract the cosine margin ${margin}: shifted value ${shifted.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "margin", scale, margin, cosTheta, shifted, logit: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([cosTheta, shifted, logit], ["sorted", "sorted", "active"]),
        edges: [],
        description: `Done: scaled target logit is ${logit.toFixed(4)} at scale ${scale}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", scale, margin, cosTheta, shifted, logit, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CosFace makes classification margins easier by working directly on cosine values. It subtracts a fixed amount m from the normalized cosine of the correct class, then scales by s. Because it shifts the value rather than the angle, its geometry differs from ArcFace while achieving the same goal of compact, well-separated embeddings.",
        invariants: [
            "Feature and weight are normalized before the cosine is taken.",
            "The cosine lies in the interval from negative one to one.",
            "The shifted value equals the cosine minus the margin, so a positive margin always lowers the target logit.",
        ],
        correctness:
            "Normalizing divides each vector by its Euclidean norm, so their dot product is the cosine of the angle between them. Subtracting the margin m and scaling by s is exactly the CosFace target logit. Since the subtraction is linear in the cosine, the ranking of samples by target logit is preserved for a fixed margin, and the larger scale amplifies gradients as intended. The cosine is clamped to the valid range before the margin is applied to avoid numeric drift.",
        complexityRationale:
            "Normalization and the dot product take O(d) time for d dimensions, and the subtraction and scaling are constant time. Only the normalized vectors are kept, using O(d) space.",
        uses: [
            "Face recognition and verification",
            "Large-scale classification with many classes",
            "An angular-margin alternative to ArcFace and SphereFace",
        ],
        references: [
            "Wang et al., CosFace: Large Margin Cosine Loss for Deep Face Recognition, CVPR 2018",
            "Deng et al., ArcFace, CVPR 2019",
        ],
        workedExample:
            "With feature (2,1,0.5), weight (1,1,0), scale 10 and cosine margin 0.35, the normalized cosine is about 0.86. Subtracting 0.35 gives about 0.51, so the scaled logit is about 5.1, compared with 8.6 when no margin is applied.",
    },
    id: "cosface",
    name: "CosFace (Additive Cosine Margin)",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { feature: [2, 1, 0.5], weight: [1, 1, 0], scale: 10, margin: 0.35 },
    visualType: "array",
    run,
    pseudocode: [
        "read the feature, class weight, scale and cosine margin",
        "normalize both vectors to unit length",
        "compute their dot product as the cosine",
        "subtract the margin from the cosine value",
        "multiply by the scale to get the target logit",
        "done: report the logit and intermediate values",
    ],
};

export default module;
