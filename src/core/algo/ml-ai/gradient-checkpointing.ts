/**
 * gradient-checkpointing.ts - Activation Gradient Checkpointing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gradient checkpointing trades compute for memory in deep networks. Instead
 * of storing every layer's activation for the backward pass, only every k-th
 * activation is kept. During backpropagation the missing activations inside a
 * segment are recomputed from the nearest stored checkpoint. The optimal
 * uniform choice k about the square root of the depth uses O(sqrt(n)) memory
 * with one extra forward pass.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) forward plus O(n) recomputation in the backward pass
 *   Space: O(n / k + k) activations, O(sqrt(n)) with the default k
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars represent the n layers; stored checkpoints are green.
 *   - Recomputed layers are highlighted during the backward phase.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CheckpointInput {
    layers?: number;
    segment?: number;
}

/**
 * Plan uniform checkpoints. Activations are indexed 0..n-1; a checkpoint at
 * index c means activation c is stored. Each layer recovers its input by
 * recomputing from the greatest stored checkpoint at or before it.
 */
export function checkpointPlan(n: number, segment?: number) {
    const layers = Math.max(0, Math.floor(n));
    if (layers === 0) return { checkpoints: [] as number[], k: 1, recompute: [] as number[], segments: [] as number[][] };
    const k = Math.max(1, Math.floor(segment ?? Math.ceil(Math.sqrt(layers))));
    const checkpoints: number[] = [];
    for (let i = 0; i < layers; i += k) checkpoints.push(i);
    const recompute: number[] = [];
    for (let i = 0; i < layers; i += 1) {
        let previous = 0;
        for (const c of checkpoints) {
            if (c <= i) previous = c;
            else break;
        }
        recompute.push(i - previous);
    }
    const segments: number[][] = checkpoints.map((c, idx) => {
        const next = checkpoints[idx + 1] ?? layers;
        const members: number[] = [];
        for (let i = c; i < next; i += 1) members.push(i);
        return members;
    });
    return { checkpoints, k, recompute, segments };
}

function bars(n: number, checkpoints: number[], active: number[]): VisualEntity[] {
    const stored = new Set(checkpoints);
    const activeSet = new Set(active);
    return Array.from({ length: n }, (_, i) => ({
        id: `layer-${i}`,
        type: "bar" as const,
        label: `${i}${stored.has(i) ? "*" : ""}`,
        value: stored.has(i) ? 1 : 0.3,
        state: (activeSet.has(i) ? "active" : stored.has(i) ? "sorted" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, checkpoint: stored.has(i) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CheckpointInput | null) ?? {};
    const layers = task.layers ?? 16;
    const segment = task.segment;
    const { checkpoints, k, recompute, segments } = checkpointPlan(layers, segment);
    const maxRecompute = recompute.length === 0 ? 0 : Math.max(...recompute);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(layers, [], []),
        edges: [],
        description: `Plan checkpoints for a network of ${layers} layers.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", layers, k, checkpoints, maxRecompute, recompute: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(layers, checkpoints, []),
        edges: [],
        description: `Store every ${k}-th activation: ${checkpoints.length} checkpoints in total.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "store", layers, k, checkpoints, maxRecompute, recompute: [] },
    };
    step += 1;

    const firstSegment = segments[1] ?? segments[0] ?? [];
    yield {
        stepNumber: step,
        entities: bars(layers, checkpoints, firstSegment),
        edges: [],
        description: `During backward, recompute at most ${maxRecompute} activations per segment.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "recompute", layers, k, checkpoints, maxRecompute, recompute },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(layers, checkpoints, []),
        edges: [],
        description: `Done: memory drops from ${layers} to ${checkpoints.length} stored activations.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            phase: "done",
            layers,
            k,
            checkpoints,
            maxRecompute,
            recompute,
            stored: checkpoints.length,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A backward pass normally needs every forward activation, which costs memory proportional to depth. Checkpointing stores only a sparse set of them and recomputes the gaps when they are needed. Choosing a checkpoint every sqrt(n) layers balances the cost of stored activations against the cost of recomputation, cutting memory to a square-root scale.",
        invariants: [
            "Activation zero is always a checkpoint, so the first segment can be recomputed from a known state.",
            "Consecutive checkpoints are exactly k indices apart, except possibly the last gap.",
            "Every layer's recompute count equals its distance from the nearest stored checkpoint at or before it.",
        ],
        correctness:
            "By storing activation at indices that are multiples of k, any layer i lies within a segment whose left endpoint c is stored. Recomputing forward from c reconstructs every activation up to i using the same layer functions as the original pass, so the backward pass receives identical values. Since successive checkpoints differ by k, the number of recomputed steps for any layer is less than k, bounding recomputation by O(k) per segment and memory by O(n/k + k). The default k of ceil of the square root of n minimizes this sum up to constants.",
        complexityRationale:
            "The forward pass stores n/k checkpoints and each of the n layers may be recomputed once more in backward, giving O(n) time overall with one extra forward. Memory is O(n/k + k), which is O(sqrt(n)) for the default segment length.",
        uses: [
            "Training very deep transformer and residual networks",
            "Reducing GPU memory for large batch sizes",
            "Making long-sequence models fit on limited hardware",
        ],
        references: [
            "Griewank and Walther, Algorithm 851: ADOL-C, ACM TOMS 2000",
            "Chen et al., Training Deep Nets with Sublinear Memory Cost, arXiv 2016",
        ],
        workedExample:
            "For 16 layers the default segment is 4, so checkpoints are stored at layers 0, 4, 8 and 12. During backward, layer 6 is recovered by recomputing layers 5 and 6 from the stored activation at layer 4, at most three steps, while only four activations occupy memory instead of sixteen.",
    },
    id: "gradient-checkpointing",
    name: "Gradient Checkpointing",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(sqrt(n))" },
    defaultInput: { layers: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number of layers and an optional segment length",
        "choose k as the ceiling of the square root of the depth",
        "store the activation at every k-th layer including layer zero",
        "for each layer find the nearest stored checkpoint at or before it",
        "during backward recompute the activations up to that layer",
        "free each recomputed segment once its gradient is done",
        "done: report the stored checkpoints and recomputation bound",
    ],
};

export default module;
