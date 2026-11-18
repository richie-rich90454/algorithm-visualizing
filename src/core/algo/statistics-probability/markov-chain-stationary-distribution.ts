/**
 * markov-chain-stationary-distribution.ts - Stationary Distribution by Power
 * Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a finite Markov chain with row-stochastic transition matrix P, a
 * stationary distribution is a probability vector pi with pi equals pi times P.
 * Repeatedly multiplying a starting distribution by P converges to pi when the
 * chain is irreducible and aperiodic. Each matrix-vector product is exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for n states
 *   Space: O(n) for the distribution vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per state shows the current probability mass.
 *   - Bars shift toward their limiting values on every iteration.
 *   - The final frame is green and reports the residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ChainInput {
    transition?: number[][];
    iterations?: number;
    initial?: number[];
}

/** Build one bar per state from a probability vector. */
function makeBars(distribution: number[], done: boolean): VisualEntity[] {
    return distribution.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `s${index}: ${value.toFixed(4)}`,
        value,
        state: done ? "sorted" : "comparing",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, state: index, probability: value },
    }));
}

/** The Markov stationary distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ChainInput | null) ?? {};
    const transition: number[][] = Array.isArray(task.transition)
        ? task.transition.map((row) => [...row])
        : [
              [0.9, 0.1],
              [0.2, 0.8],
          ];
    const n = transition.length;
    const iterations = Math.max(1, Math.floor(task.iterations ?? 20));
    let distribution: number[] = Array.isArray(task.initial) && task.initial.length === n
        ? [...task.initial]
        : new Array<number>(n).fill(1 / n);
    const initialSum = distribution.reduce((a, b) => a + b, 0);
    distribution = initialSum === 0 ? new Array<number>(n).fill(1 / n) : distribution.map((v) => v / initialSum);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(distribution, false),
        edges: [],
        description: `Starting distribution over ${n} state(s); iterating pi times P.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { states: n, iteration: 0, distribution: [...distribution], residual: 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const next = new Array<number>(n).fill(0);
        for (let i = 0; i < n; i += 1) {
            const row = transition[i] ?? [];
            for (let j = 0; j < n; j += 1) {
                next[j] = (next[j] ?? 0) + (distribution[i] ?? 0) * (row[j] ?? 0);
            }
        }
        const residual = next.reduce((max, value, j) => Math.max(max, Math.abs(value - (distribution[j] ?? 0))), 0);
        distribution = next;
        yield {
            stepNumber: step,
            entities: makeBars(distribution, false),
            edges: [],
            description: `Iteration ${iteration}: distribution [${distribution.map((v) => v.toFixed(3)).join(", ")}], residual ${residual.toFixed(6)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { states: n, iteration, distribution: [...distribution], residual },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(distribution, true),
        edges: [],
        description: `Final stationary estimate [${distribution.map((v) => v.toFixed(4)).join(", ")}].`,
        codeLineNumber: 3,
        layout: "array",
        meta: { states: n, iteration: iterations, distribution: [...distribution], residual: 0, done: true },
    };
}

/** The Markov stationary distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A stationary distribution is an equilibrium: once the chain reaches those state probabilities, one more transition leaves them unchanged. Starting from any reasonable guess and repeatedly applying the transition matrix washes out the initial guess, so the vector settles toward the equilibrium.",
        invariants: [
            "Every iterate is a probability vector whose entries sum to one.",
            "A row-stochastic transition matrix maps probability vectors to probability vectors.",
            "The residual measures how far one step moves the distribution; it tends to zero at equilibrium.",
        ],
        correctness:
            "Multiplying by P on the right is the definition of advancing a row-distribution by one Markov step, so the iterate after k steps is the starting distribution times P to the k. For an irreducible aperiodic finite chain, the Perron-Frobenius theorem gives a unique eigenvalue one with a positive left eigenvector and all other eigenvalues smaller in magnitude, so the iterates converge to that normalized eigenvector, which satisfies pi times P equals pi.",
        complexityRationale:
            "One matrix-vector product visits all n squared entries of P, so k iterations cost O(k times n squared). Only the current and next probability vectors are stored, giving O(n) space beyond the matrix.",
        uses: [
            "Modeling long-run market share or customer states",
            "Page rank style importance scores on small graphs",
            "Estimating equilibrium occupancy in queuing systems",
        ],
        references: [
            "Norris, Markov Chains, Chapter 1",
            "Grinstead and Snell, Introduction to Probability, Chapter 11",
        ],
        workedExample:
            "For the two-state chain with transitions 0.9 to stay and 0.1 to switch versus 0.2 to switch in and 0.8 to stay, solving pi times P equals pi gives pi zero equal to twice pi one. Normalizing yields (2/3, 1/3), and repeated multiplication from a uniform start approaches those values.",
    },
    id: "markov-chain-stationary-distribution",
    name: "Markov Chain Stationary Distribution",
    category: "statistics-probability",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        transition: [
            [0.9, 0.1],
            [0.2, 0.8],
        ],
        iterations: 20,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the transition matrix and choose a starting distribution",
        "normalize the starting distribution to sum to one",
        "for each iteration multiply the distribution by the transition matrix",
        "compute the largest change across all states as the residual",
        "replace the distribution with the new one",
        "stop after the requested number of iterations",
        "done: report the limiting distribution and its residual",
    ],
};

export default module;
