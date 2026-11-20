/**
 * lottery-ticket-hypothesis.ts - Iterative Magnitude Pruning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The lottery ticket hypothesis says a dense network contains a small sparse
 * subnetwork that can train to comparable accuracy when retrained from its
 * original initialization. The practical core is iterative magnitude
 * pruning: train, remove the smallest-magnitude weights, and repeat, leaving
 * a sparse mask over the original weights.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n log n) to rank surviving weights each round
 *   Space: O(n) for the mask and weight arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show weight magnitudes for each round.
 *   - Pruned weights turn red; surviving weights stay green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PruneInput {
    weights?: number[];
    pruneRate?: number;
    rounds?: number;
}

/**
 * Build a mask keeping the largest-magnitude weights. Ties go to the smaller
 * index so exactly k weights are pruned.
 */
export function pruneMask(weights: number[], pruneRate: number) {
    const n = weights.length;
    if (n === 0) return { mask: [] as boolean[], pruned: [] as number[], k: 0 };
    const rate = Math.max(0, Math.min(1, pruneRate));
    const k = Math.min(n - 1, Math.max(0, Math.floor(n * rate)));
    const order = weights
        .map((w, i) => ({ i, mag: Math.abs(w) }))
        .sort((a, b) => a.mag - b.mag || a.i - b.i);
    const pruned = order.slice(0, k).map((item) => item.i);
    const prunedSet = new Set(pruned);
    return { mask: weights.map((_, i) => !prunedSet.has(i)), pruned, k };
}

/**
 * Repeatedly prune a fraction of the weights that are still active. Returns a
 * mask after each round and the final surviving values.
 */
export function iterativeMagnitudePruning(weights: number[], pruneRate: number, rounds: number) {
    let active = weights.map((_, i) => i);
    const masks: boolean[][] = [];
    for (let r = 0; r < Math.max(0, Math.floor(rounds)); r += 1) {
        if (active.length <= 1) break;
        const magnitudes = active.map((i) => Math.abs(weights[i] ?? 0));
        const rate = Math.max(0, Math.min(1, pruneRate));
        const k = Math.min(active.length - 1, Math.max(1, Math.floor(active.length * rate)));
        const localOrder = magnitudes.map((m, j) => ({ j, m })).sort((a, b) => a.m - b.m || a.j - b.j);
        const dropLocal = new Set(localOrder.slice(0, k).map((item) => item.j));
        active = active.filter((_, j) => !dropLocal.has(j));
        const alive = new Set(active);
        masks.push(weights.map((_, i) => alive.has(i)));
    }
    const alive = new Set(active);
    return { masks, survivors: weights.map((w, i) => (alive.has(i) ? w : 0)), active: active.length };
}

function bars(weights: number[], mask: boolean[]): VisualEntity[] {
    return weights.map((value, index) => ({
        id: `w-${index}`,
        type: "bar" as const,
        label: Math.abs(value).toFixed(3),
        value: Number(Math.abs(value).toFixed(8)),
        state: mask[index] === false ? "error" : "sorted",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, magnitude: Math.abs(value), alive: mask[index] !== false },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PruneInput | null) ?? {};
    const weights: number[] = task.weights ?? [-0.9, 0.2, 1.3, -0.05, 0.6, -1.1, 0.35, 0.02];
    const pruneRate = typeof task.pruneRate === "number" ? task.pruneRate : 0.3;
    const rounds = task.rounds ?? 2;
    const { masks, survivors, active } = iterativeMagnitudePruning(weights, pruneRate, rounds);
    const allAlive = weights.map(() => true);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(weights, allAlive),
        edges: [],
        description: `Start with ${weights.length} weights from the original initialization.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "init", pruneRate, rounds, alive: weights.length, masks: [] },
    };
    step += 1;

    for (let r = 0; r < masks.length; r += 1) {
        const mask = masks[r] ?? [];
        const aliveCount = mask.filter(Boolean).length;
        yield {
            stepNumber: step,
            entities: bars(weights, mask),
            edges: [],
            description: `Round ${r + 1}: prune the smallest magnitudes; ${aliveCount} weights remain.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "prune", pruneRate, rounds, alive: aliveCount, masks },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(survivors, survivors.map((_, i) => (survivors[i] === 0 ? false : true))),
        edges: [],
        description: `Done: winning ticket keeps ${active} of ${weights.length} weights at their initial values.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", pruneRate, rounds, alive: active, masks, survivors },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A trained network may contain a much smaller subnetwork that, when reset to its original weights, learns just as well. Iterative magnitude pruning searches for that winning ticket by repeatedly deleting the smallest weights and retraining the rest. The visualization focuses on the deterministic pruning step: which weights survive at their initialization values.",
        invariants: [
            "Pruning never changes the value of a weight that survives.",
            "The mask only ever removes weights, so the number of survivors never increases.",
            "Ties in magnitude break toward the smaller index, making the mask deterministic.",
        ],
        correctness:
            "Sorting weights by absolute magnitude and dropping the smallest k removes exactly the least influential weights by that criterion, with index tie-breaking ensuring a unique result. Repeating the sort over only the still-active indices prunes a fixed fraction of the remaining subnetwork each round. Since survivors are copied unchanged from the original vector, the returned ticket is a genuine subnetwork of the initialization rather than a new set of values.",
        complexityRationale:
            "Each round sorts the active weights, costing O(m log m) for m survivors, over a fixed number of rounds. Storing the masks and survivor vector uses O(n) space.",
        uses: [
            "Model compression and sparse inference",
            "Studying trainability of sparse subnetworks",
            "Reducing memory and compute for deployed models",
        ],
        references: [
            "Frankle and Carbin, The Lottery Ticket Hypothesis, ICLR 2019",
            "Frankle et al., Stabilizing the Lottery Ticket Hypothesis, 2019",
        ],
        workedExample:
            "From weights 0.9, 0.2, 1.3, 0.05 magnitude with eight weights and prune rate 0.3, two weights with the smallest magnitudes are removed each round. Their positions are set to zero while every survivor keeps its original sign and size, leaving a sparse ticket.",
    },
    id: "lottery-ticket-hypothesis",
    name: "Lottery Ticket Hypothesis (Magnitude Pruning)",
    category: "ml-ai",
    complexity: { time: "O(rounds * n log n)", space: "O(n)" },
    defaultInput: { weights: [-0.9, 0.2, 1.3, -0.05, 0.6, -1.1, 0.35, 0.02], pruneRate: 0.3, rounds: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the weights, prune rate and number of rounds",
        "mark every weight as active in a mask",
        "for each round rank active weights by magnitude",
        "set the smallest-magnitude fraction to inactive",
        "keep surviving weights at their initial values",
        "done: report the sparse winning ticket",
    ],
};

export default module;
