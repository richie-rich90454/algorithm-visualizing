/**
 * arcface.ts - ArcFace Additive Angular Margin
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ArcFace strengthens face-classification losses by adding an angular margin
 * to the true class. After normalizing the feature and weight vectors, it
 * computes the angle between them and uses cos(theta + m) as the target logit
 * scaled by s. The margin enlarges the angular gap between classes and yields
 * more discriminative embeddings.
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
 *   - Bars show the cosine of the angle, the margin-shifted cosine, and the
 *     final scaled logit.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ArcfaceInput {
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

/** Compute the ArcFace target logit with an additive angular margin. */
export function arcfaceLogit(feature: number[], weight: number[], scale: number, margin: number) {
    const xn = normalize(feature);
    const wn = normalize(weight);
    const len = Math.min(xn.length, wn.length);
    let dot = 0;
    for (let i = 0; i < len; i += 1) dot += (xn[i] ?? 0) * (wn[i] ?? 0);
    const cosTheta = Math.max(-1, Math.min(1, dot));
    const theta = Math.acos(cosTheta);
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const shifted = cosTheta * Math.cos(margin) - sinTheta * Math.sin(margin);
    const logit = scale * shifted;
    return { cosTheta, theta, shifted, logit, xn, wn };
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
    const task = (input as ArcfaceInput | null) ?? {};
    const feature: number[] = task.feature ?? [2, 1, 0.5];
    const weight: number[] = task.weight ?? [1, 1, 0];
    const scale = typeof task.scale === "number" ? task.scale : 10;
    const margin = typeof task.margin === "number" ? task.margin : 0.5;
    const { cosTheta, theta, shifted, logit } = arcfaceLogit(feature, weight, scale, margin);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(cosTheta === 0 ? [0] : [cosTheta, 0, 0], ["comparing", "idle", "idle"]),
        edges: [],
        description: `Normalize feature and weight, then measure cos(theta) = ${cosTheta.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "cosine", scale, margin, cosTheta, theta, shifted: 0, logit: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([cosTheta, shifted, 0], ["sorted", "active", "idle"]),
        edges: [],
        description: `Angle theta is ${theta.toFixed(4)} rad; cos(theta + margin) is ${shifted.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "margin", scale, margin, cosTheta, theta, shifted, logit: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([cosTheta, shifted, logit], ["sorted", "sorted", "active"]),
        edges: [],
        description: `Done: scaled target logit is ${logit.toFixed(4)} at scale ${scale}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", scale, margin, cosTheta, theta, shifted, logit, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ArcFace asks not just that a feature point fall near its class weight direction, but that it fall within a smaller angular cone. It adds a fixed angle m to the true class angle before taking the cosine, then multiplies by a scale s. The larger angular gap makes embeddings from different classes easier to tell apart.",
        invariants: [
            "Feature and weight vectors are normalized to unit length before the angle is measured.",
            "The cosine of the angle lies in the interval from negative one to one.",
            "A positive margin strictly lowers the true-class target logit relative to the unshifted cosine.",
        ],
        correctness:
            "Normalizing a vector divides it by its Euclidean norm, so the dot product of two unit vectors equals the cosine of the angle between them. The angle is arccos of that cosine, and the trigonometric identity cos(theta + m) = cos(theta)cos(m) minus sin(theta)sin(m) is evaluated exactly with sin(theta) taken as the nonnegative square root of one minus cosine squared. Scaling the shifted cosine by s preserves ordering among logits while increasing gradient magnitude, which is the intended effect of the loss.",
        complexityRationale:
            "Normalizing and dotting two d-dimensional vectors and evaluating the trigonometric terms take O(d) time. Only the normalized copies are stored, using O(d) space.",
        uses: [
            "Face recognition embedding training",
            "Metric learning with angular margins",
            "Verification tasks that compare normalized feature vectors",
        ],
        references: [
            "Deng et al., ArcFace: Additive Angular Margin Loss for Deep Face Recognition, CVPR 2019",
            "Liu et al., SphereFace, CVPR 2017",
        ],
        workedExample:
            "With feature (2,1,0.5), weight (1,1,0), scale 10 and margin 0.5 radians, normalization gives a cosine near 0.86 and an angle near 0.54 radians. The shifted cosine cos(1.04) is about 0.51, so the scaled logit is about 5.1 rather than the unshifted 8.6.",
    },
    id: "arcface",
    name: "ArcFace (Additive Angular Margin)",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { feature: [2, 1, 0.5], weight: [1, 1, 0], scale: 10, margin: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the feature, class weight, scale and angular margin",
        "normalize both vectors to unit length",
        "compute cos(theta) as their dot product",
        "set theta to arccos of the clamped cosine",
        "compute cos(theta + margin) via the angle addition identity",
        "multiply by the scale to get the target logit",
        "done: report the logit and intermediate angles",
    ],
};

export default module;
