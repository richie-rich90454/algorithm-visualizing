/**
 * classifier-guidance.ts - Classifier Guidance for Diffusion Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Classifier guidance steers a diffusion sampler toward a target class using
 * the gradient of an external classifier. At every denoising step the model
 * proposes an unconditional mean, and the classifier's gradient with respect
 * to the current sample is added to that mean, multiplied by a guidance scale.
 * A larger scale pushes harder toward the class. This is distinct from
 * classifier-free guidance, which blends a conditional and an unconditional
 * model prediction and never trains a separate classifier.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T d) for T steps and d dimensions
 *   Space: O(T d) for the reported gradient and guided-mean tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the base mean, classifier gradient, and guided mean per step.
 *   - The guided mean is highlighted; the base and gradient are summarized in meta.
 *   - Meta exposes every vector and the guidance scale.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GuidanceInput {
    baseMeans?: number[][];
    xs?: number[][];
    w?: number[];
    c?: number;
    scale?: number;
}

function bars(values: number[], state: EntityState, prefix: string): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: `d${index}=${value.toFixed(3)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function flatten(rows: number[][]): number[] {
    return rows.reduce<number[]>((acc, row) => acc.concat(row), []);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GuidanceInput | null) ?? {};
    const baseMeans: number[][] = Array.isArray(task.baseMeans) && task.baseMeans.length > 0
        ? task.baseMeans.map((row) => [...row])
        : [
              [0.2, -0.1, 0.4],
              [0.35, 0.05, 0.2],
              [0.5, 0.3, -0.1],
          ];
    const xs: number[][] = Array.isArray(task.xs) && task.xs.length === baseMeans.length
        ? task.xs.map((row) => [...row])
        : baseMeans.map((row, t) => row.map((v, j) => v + 0.3 * Math.sin(2.1 * (t + 1) + j)));
    const T = baseMeans.length;
    const d = T > 0 ? (baseMeans[0]?.length ?? 0) : 0;
    const w: number[] = Array.isArray(task.w) && task.w.length === d
        ? [...task.w]
        : Array.from({ length: d }, (_, j) => 0.5 + 0.2 * j);
    const c = typeof task.c === "number" ? task.c : 0.1;
    const scale = typeof task.scale === "number" ? task.scale : 2;

    const grads: number[][] = [];
    const guided: number[][] = [];
    for (let t = 0; t < T; t += 1) {
        const grad = (xs[t] ?? []).map((x, j) => (w[j] ?? 0) + 2 * c * x);
        grads.push(grad);
        guided.push((baseMeans[t] ?? []).map((v, j) => v + scale * (grad[j] ?? 0)));
    }

    const commonMeta = {
        T,
        d,
        scale,
        w,
        c,
        baseMeans: flatten(baseMeans),
        xs: flatten(xs),
        grads: flatten(grads),
        guided: flatten(guided),
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(baseMeans[0] ?? [], "idle", "base"),
        edges: [],
        description: `Classifier guidance with scale ${scale} over ${T} denoising steps; quadratic classifier gradient.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...commonMeta, t: -1 },
    };
    step += 1;

    for (let t = 0; t < T; t += 1) {
        yield {
            stepNumber: step,
            entities: bars(grads[t] ?? [], "comparing", "grad"),
            edges: [],
            description: `Step ${t + 1}: classifier gradient with respect to the current sample.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...commonMeta, t },
        };
        step += 1;

        yield {
            stepNumber: step,
            entities: bars(guided[t] ?? [], "active", "guided"),
            edges: [],
            description: `Step ${t + 1}: guided mean equals the base mean plus scale times the classifier gradient.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...commonMeta, t },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(guided[T - 1] ?? [], "sorted", "guided"),
        edges: [],
        description: `Done: ${T} guided means computed; the final shift magnitude is scale times the final classifier gradient.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...commonMeta, t: T, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a diffusion sampler that knows nothing about labels. To make it draw a particular class, classifier guidance borrows a separate classifier and asks which small change to the current image would most increase the class score. That direction is added to the sampler's next prediction, with a knob controlling how strongly to follow it. Large knobs give stronger class signals but can distort the sample.",
        invariants: [
            "The classifier gradient at sample x is the linear weight plus twice the quadratic coefficient times x.",
            "The guided mean is the base mean plus scale times the classifier gradient, applied componentwise.",
            "A scale of zero leaves every guided mean equal to the base mean.",
        ],
        correctness:
            "Classifier guidance modifies the reverse diffusion mean by adding the score gradient of the classifier times the posterior variance; in this teaching model the variance is folded into the scale, giving guided mean equal to base mean plus scale times gradient. With a quadratic classifier logit the derivative is w plus 2 c x, so every guided component is an exact arithmetic expression. The test recomputes every gradient and guided mean independently and checks the zero-scale identity.",
        complexityRationale:
            "For each of the T steps the gradient and guided mean each touch d components once, so time is O(T d). Storing the base means, samples, gradients, and guided means uses O(T d) space.",
        uses: [
            "Class-conditional image generation with diffusion models",
            "Steering scientific sample generation toward a target property",
            "Controllable generation before classifier-free guidance was introduced",
        ],
        references: [
            "Dhariwal and Nichol, Diffusion Models Beat GANs on Image Synthesis, NeurIPS 2021",
            "Ho and Salimans, Classifier-Free Diffusion Guidance, 2021",
        ],
        workedExample:
            "At a step where the base mean is 0.4 in one dimension, the current sample is 1.0, the classifier weight is 0.5, the quadratic coefficient is 0.1, and the scale is 2, the gradient is 0.5 plus 0.2 or 0.7. The guided mean becomes 0.4 plus 2 times 0.7, which is 1.8, pushing the sample toward the class.",
    },
    id: "classifier-guidance",
    name: "Classifier Guidance for Diffusion",
    category: "ml-ai",
    complexity: { time: "O(T d)", space: "O(T d)" },
    defaultInput: {
        baseMeans: [
            [0.2, -0.1, 0.4],
            [0.35, 0.05, 0.2],
            [0.5, 0.3, -0.1],
        ],
        xs: [
            [0.5, -0.4, 0.8],
            [0.7, 0.1, 0.3],
            [1.0, 0.6, -0.2],
        ],
        w: [0.5, 0.7, 0.9],
        c: 0.1,
        scale: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the base means, current samples, and classifier parameters",
        "for each denoising step evaluate the classifier gradient at the sample",
        "multiply the gradient by the guidance scale",
        "add it componentwise to the base mean",
        "record the guided mean as the next sampler prediction",
        "done: report the guided means and final shift",
    ],
};

export default module;
