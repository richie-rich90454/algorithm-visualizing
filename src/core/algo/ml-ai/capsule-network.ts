/**
 * capsule-network.ts - Capsule Dynamic Routing by Agreement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Capsule routing replaces scalar pooling with small vectors whose length
 * encodes confidence. A lower capsule votes for a higher capsule through a
 * learned matrix. Routing iteratively reweights the votes: a vote that agrees
 * with the current higher-capsule output gets a larger coupling coefficient.
 * After a few rounds the higher capsules represent the dominant vote patterns.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r * L * H * d^2) for r rounds, L lower and H higher capsules
 *   Space: O(L * H + H * d) for couplings and outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grids show the coupling coefficients for each routing round.
 *   - The last grid shows the higher-capsule output vectors.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface CapsuleInput {
    lower?: Matrix;
    weights?: Matrix[][];
    routings?: number;
}

const dot = (a: number[], b: number[]): number => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
const norm = (v: number[]): number => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));

/** Squash a vector so its length lies in [0,1) while keeping its direction. */
export function squash(vector: number[]): number[] {
    const length = norm(vector);
    if (length < 1e-12) return vector.map(() => 0);
    const scale = (length * length) / (1 + length * length) / length;
    return vector.map((v) => v * scale);
}

function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exp = values.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return total === 0 ? exp.map(() => 0) : exp.map((v) => v / total);
}

/** Run iterative dynamic routing and return coupling history and final outputs. */
export function capsuleRouting(lower: Matrix, weights: Matrix[][], routings: number) {
    const L = lower.length;
    const H = weights[0]?.length ?? 0;
    const d = lower[0]?.length ?? 0;
    const votes: number[][][] = [];
    for (let i = 0; i < L; i += 1) {
        const row: number[][] = [];
        for (let j = 0; j < H; j += 1) {
            const W = weights[i]?.[j] ?? [];
            row.push(W.map((r) => dot(r, lower[i] ?? [])));
        }
        votes.push(row);
    }
    const logits: Matrix = Array.from({ length: H }, () => new Array<number>(L).fill(0));
    const history: Matrix[] = [];
    let couplings: Matrix = [];
    let outputs: Matrix = [];
    for (let iteration = 0; iteration < routings; iteration += 1) {
        const roundCouplings: Matrix = [];
        const roundOutputs: Matrix = [];
        for (let j = 0; j < H; j += 1) {
            const coupling = softmax(logits[j] ?? []);
            let output: number[] = new Array(d).fill(0);
            for (let i = 0; i < L; i += 1) {
                const vote = votes[i]?.[j] ?? [];
                for (let k = 0; k < d; k += 1) output[k] = (output[k] ?? 0) + (coupling[i] ?? 0) * (vote[k] ?? 0);
            }
            output = squash(output);
            for (let i = 0; i < L; i += 1) {
                logits[j]![i] = (logits[j]![i] ?? 0) + dot(votes[i]?.[j] ?? [], output);
            }
            roundCouplings.push(coupling);
            roundOutputs.push(output);
        }
        history.push(roundCouplings);
        couplings = roundCouplings;
        outputs = roundOutputs;
    }
    return { couplings, outputs, history };
}

function grid(matrix: Matrix, state: "idle" | "comparing" | "sorted"): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: (matrix[r]?.[c] ?? 0).toFixed(3),
                value: Number((matrix[r]?.[c] ?? 0).toFixed(8)),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CapsuleInput | null) ?? {};
    const lower: Matrix = task.lower ?? [
        [1, 0],
        [0, 1],
    ];
    const weights: Matrix[][] = task.weights ?? [
        [
            [
                [1, 0],
                [0, 1],
            ],
            [
                [0.5, 0],
                [0, 0.5],
            ],
        ],
        [
            [
                [0, 0.5],
                [0.5, 0],
            ],
            [
                [1, 0],
                [0, 1],
            ],
        ],
    ];
    const routings = typeof task.routings === "number" && task.routings > 0 ? Math.floor(task.routings) : 3;
    const { couplings, outputs, history } = capsuleRouting(lower, weights, routings);

    let step = 0;
    yield {
        stepNumber: step,
        entities: grid(history[0] ?? couplings, "idle"),
        edges: [],
        description: `Begin ${routings} routing rounds between lower and higher capsules.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: weights[0]?.length ?? 0,
            cols: lower.length,
            phase: "init",
            routings,
            couplings: history[0] ?? couplings,
            outputs: [],
        },
    };
    step += 1;

    for (let round = 0; round < routings; round += 1) {
        yield {
            stepNumber: step,
            entities: grid(history[round] ?? couplings, "comparing"),
            edges: [],
            description: `Round ${round + 1}: recompute votes, update higher capsules, then revise couplings by agreement.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: weights[0]?.length ?? 0,
                cols: lower.length,
                phase: "routing",
                routings,
                round,
                couplings: history[round] ?? couplings,
                outputs: [],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: grid(outputs, "sorted"),
        edges: [],
        description: "Routing complete: higher-capsule vectors are squashed weighted sums of agreeing votes.",
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: weights[0]?.length ?? 0,
            cols: lower[0]?.length ?? 0,
            phase: "done",
            routings,
            couplings,
            outputs,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A capsule is a small vector whose direction describes a feature and whose length describes how sure the network is. Routing starts with equal votes from lower capsules and repeatedly asks which higher capsule each vote agrees with. Agreements strengthen the coupling, so votes self-organize into groups that form stable higher-level features.",
        invariants: [
            "For each higher capsule the coupling coefficients form a probability distribution.",
            "The squash function preserves direction and keeps output length below one.",
            "Couplings are updated by the dot product of each vote with the higher-capsule output.",
        ],
        correctness:
            "Each round sets couplings to the softmax of the accumulated agreement logits, so they are nonnegative and sum to one by construction. The higher capsule is the weighted sum of its votes, and squash maps any vector to the same direction with length x squared over one plus x squared, which is always less than one. Adding vote-output agreement to the logits is exactly the routing-by-agreement update, so the loop implements the specified algorithm.",
        complexityRationale:
            "Forming all votes costs O(L H d squared). Each of the r rounds sums L votes and updates L logits per higher capsule, another O(r L H d). Storing the L by H couplings and H outputs uses O(L H + H d) space.",
        uses: [
            "Shape and pose recognition in vision capsules",
            "Grouping related features into part-whole hierarchies",
            "A teaching model for agreement-based attention alternatives",
        ],
        references: [
            "Sabour, Frosst and Hinton, Dynamic Routing Between Capsules, NeurIPS 2017",
            "Hinton et al., Matrix Capsules with EM Routing, ICLR 2018",
        ],
        workedExample:
            "With two lower capsules that are unit vectors along the two axes, the first higher capsule receives an identity vote from one and a swapped vote from the other. Equal couplings produce a combined vote whose squash keeps its direction. The vote closer to the output raises its logit, so on the next round the couplings shift toward the agreeing capsule.",
    },
    id: "capsule-network",
    name: "Capsule Network Routing",
    category: "ml-ai",
    complexity: { time: "O(r * L * H * d^2)", space: "O(L * H + H * d)" },
    defaultInput: {
        lower: [
            [1, 0],
            [0, 1],
        ],
        routings: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute each lower capsule vote for every higher capsule",
        "initialize agreement logits for every vote to zero",
        "for each routing round",
        "set couplings to the softmax of the logits",
        "sum the weighted votes and squash to get the higher capsule",
        "add vote-output agreement to each logit",
        "done: report final couplings and squashed outputs",
    ],
};

export default module;
