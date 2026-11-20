/**
 * sum-product-algorithm.ts - Sum-Product Message Passing on a Chain
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The sum-product algorithm computes exact marginal probabilities on a tree or
 * chain factor graph by passing messages in both directions. A forward message
 * summarizes everything to the left of a variable, a backward message
 * summarizes everything to the right, and their product with the local
 * potential gives the unnormalized marginal. Messages are multiplied, not
 * maximized, which is why the result is a probability rather than a best
 * assignment.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * s^2) for n variables with s states each
 *   Space: O(n * s) for the stored messages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per variable with its two-state messages and marginal.
 *   - Forward messages fill in left to right, then backward right to left.
 *   - The final frame shows the normalized marginals.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    unary?: number[][];
    pairwise?: number[][][];
}

type Potentials = { unary: number[][]; pairwise: number[][][] };

/** Normalize any nonnegative pair into probabilities. */
function normalizePair(values: number[]): [number, number] {
    const total = (values[0] ?? 0) + (values[1] ?? 0);
    if (total <= 0) return [0.5, 0.5];
    return [(values[0] ?? 0) / total, (values[1] ?? 0) / total];
}

function makeCells(
    n: number,
    forward: number[][],
    backward: number[][],
    marginals: number[],
    brute: number[],
    current: number,
    phase: "forward" | "backward" | "done",
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < n; row += 1) {
        const f1 = forward[row]?.[1] ?? 0;
        const b1 = backward[row]?.[1] ?? 0;
        const marginal = marginals[row] ?? 0;
        const columns = [f1, b1, marginal, brute[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (phase === "done") state = "sorted";
            else if (row === current) state = phase === "forward" ? "active" : "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: (columns[col] ?? 0).toFixed(3),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const defaultPotentials: Potentials = {
        unary: [[0.6, 0.4], [0.3, 0.7], [0.5, 0.5], [0.8, 0.2], [0.2, 0.8]],
        pairwise: [
            [[0.7, 0.3], [0.3, 0.7]],
            [[0.8, 0.2], [0.2, 0.8]],
            [[0.6, 0.4], [0.4, 0.6]],
            [[0.9, 0.1], [0.1, 0.9]],
        ],
    };
    const unary = Array.isArray(task.unary) && task.unary.length > 1 ? task.unary : defaultPotentials.unary;
    const pairwise = Array.isArray(task.pairwise) && task.pairwise.length === unary.length - 1
        ? task.pairwise
        : defaultPotentials.pairwise;
    const n = unary.length;

    const forward: number[][] = Array.from({ length: n }, () => [0, 0]);
    const backward: number[][] = Array.from({ length: n }, () => [0, 0]);
    forward[0] = [1, 1];
    backward[n - 1] = [1, 1];

    const metaBase = {
        family: "sum-product",
        rows: n,
        cols: 4,
        states: 2,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(n, forward, backward, [], [], -1, "forward"),
        edges: [],
        description: `Sum-product on a chain of ${n} binary variables with ${n - 1} pairwise factors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase,
    };

    let step = 1;
    for (let i = 1; i < n; i += 1) {
        const previous = forward[i - 1] ?? [1, 1];
        const edge = pairwise[i - 1] ?? [[1, 1], [1, 1]];
        const message = [0, 1].map((x) => {
            let total = 0;
            for (let xp = 0; xp < 2; xp += 1) {
                total += (unary[i - 1]?.[xp] ?? 0) * (edge[xp]?.[x] ?? 0) * (previous[xp] ?? 0);
            }
            return total;
        });
        forward[i] = message;
        yield {
            stepNumber: step,
            entities: makeCells(n, forward, backward, [], [], i, "forward"),
            edges: [],
            description: `Forward message from variable ${i - 1} to ${i}: [${message.map((v) => v.toFixed(3)).join(", ")}].`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...metaBase, phase: "forward", current: i, forward: forward.flat() },
        };
        step += 1;
    }

    for (let i = n - 2; i >= 0; i -= 1) {
        const next = backward[i + 1] ?? [1, 1];
        const edge = pairwise[i] ?? [[1, 1], [1, 1]];
        const message = [0, 1].map((x) => {
            let total = 0;
            for (let xn = 0; xn < 2; xn += 1) {
                total += (edge[x]?.[xn] ?? 0) * (unary[i + 1]?.[xn] ?? 0) * (next[xn] ?? 0);
            }
            return total;
        });
        backward[i] = message;
        yield {
            stepNumber: step,
            entities: makeCells(n, forward, backward, [], [], i, "backward"),
            edges: [],
            description: `Backward message from variable ${i + 1} to ${i}: [${message.map((v) => v.toFixed(3)).join(", ")}].`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { ...metaBase, phase: "backward", current: i, backward: backward.flat() },
        };
        step += 1;
    }

    const beliefs = unary.map((potentials, i) => {
        const f = forward[i] ?? [1, 1];
        const b = backward[i] ?? [1, 1];
        return [0, 1].map((x) => (potentials[x] ?? 0) * (f[x] ?? 0) * (b[x] ?? 0));
    });
    const marginals = beliefs.map((belief) => normalizePair(belief)[1]);

    const brute = new Array<number>(n).fill(0);
    let partition = 0;
    for (let mask = 0; mask < 2 ** n; mask += 1) {
        const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
        let weight = 1;
        for (let i = 0; i < n; i += 1) weight *= unary[i]?.[bits[i] ?? 0] ?? 0;
        for (let i = 0; i < n - 1; i += 1) weight *= pairwise[i]?.[bits[i] ?? 0]?.[bits[i + 1] ?? 0] ?? 0;
        partition += weight;
        for (let i = 0; i < n; i += 1) {
            if (bits[i] === 1) brute[i] = (brute[i] ?? 0) + weight;
        }
    }
    for (let i = 0; i < n; i += 1) brute[i] = partition > 0 ? (brute[i] ?? 0) / partition : 0;
    const maxError = marginals.reduce((worst, value, i) => Math.max(worst, Math.abs(value - (brute[i] ?? 0))), 0);

    yield {
        stepNumber: step,
        entities: makeCells(n, forward, backward, marginals, brute, -1, "done"),
        edges: [],
        description: `Exact marginals recovered; largest gap against full enumeration is ${maxError.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...metaBase,
            phase: "done",
            forward: forward.flat(),
            backward: backward.flat(),
            marginals: marginals.map((v) => Number(v.toFixed(6))),
            brute: brute.map((v) => Number(v.toFixed(6))),
            maxError: Number(maxError.toExponential(4)),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To find the marginal probability of one variable in a chain, you need the influence of every other variable. Sum-product compresses that influence into two messages per edge: one gathered from the left and one from the right. Because the graph is a tree, those two summaries are independent, so multiplying them with the local potential gives the exact marginal.",
        invariants: [
            "A message depends only on the subtree on its side of the edge.",
            "Beliefs are products of the local potential, the forward message, and the backward message.",
            "Normalized beliefs sum to one across the two states of each variable.",
        ],
        correctness:
            "The sum-product recursion is a dynamic program over the chain. The forward message sums the joint weight of all configurations to the left consistent with a given state, and the backward message does the same for the right side. Their product with the local potential is proportional to the joint weight of every configuration with that variable state, so normalizing yields the exact marginal. The module cross-checks those marginals against enumerating all 2^n assignments and computing frequencies directly.",
        complexityRationale:
            "Each of the two passes sends one message per edge, and every message sums over s states on each side, costing O(s^2). With n variables the total work is O(n*s^2) and the stored messages use O(n*s) space.",
        uses: [
            "Inference in hidden Markov models through the forward-backward algorithm",
            "Decoding low-density parity-check codes",
            "Belief propagation on factor graphs in probabilistic programming",
        ],
        references: [
            "Pearl, Probabilistic Reasoning in Intelligent Systems, Chapter 4",
            "Kschischang, Frey, and Loeliger, Factor Graphs and the Sum-Product Algorithm, 2001",
        ],
        workedExample:
            "For a three-variable binary chain, the forward message into the middle variable combines the first variable's potential with the first edge, while the backward message combines the third variable's potential with the second edge. Multiplying those two messages by the middle potential and dividing by their total gives the probability that the middle variable is one, matching direct enumeration of the eight configurations.",
    },
    id: "sum-product-algorithm",
    name: "Sum-Product Algorithm",
    category: "statistics-probability",
    complexity: { time: "O(n * s^2)", space: "O(n * s)" },
    defaultInput: {},
    visualType: "grid",
    run,
    pseudocode: [
        "read the unary and pairwise potentials of the chain",
        "initialize the outermost messages to all ones",
        "for each edge from left to right sum over the left state",
        "multiply the potential, edge factor, and incoming message",
        "for each edge from right to left sum over the right state",
        "multiply the local potential by both incoming messages",
        "normalize each belief to obtain the marginal probability",
        "done: report the marginals and the enumeration check",
    ],
};

export default module;
