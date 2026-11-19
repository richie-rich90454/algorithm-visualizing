/**
 * forward-backward-algorithm.ts - Forward-Backward Algorithm for an HMM
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a fixed hidden Markov model and an observed sequence, the forward-
 * backward algorithm computes the posterior probability of every hidden state
 * at every time (and of every state transition). It runs the forward pass to
 * get alpha, the backward pass to get beta, then combines them with Bayes'
 * rule. These smoothed posteriors are what inference and Baum-Welch training
 * rely on.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * K^2) for T observations and K hidden states
 *   Space: O(T * K) for the alpha and beta tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows alpha, then beta, then the posterior gamma.
 *   - The active column is YELLOW; finished columns are GREEN.
 *   - meta identifies the phase and carries the full tables.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HMMInput {
    pi?: number[];
    A?: number[][];
    B?: number[][];
    observations?: number[];
}

const DEFAULT = {
    pi: [0.6, 0.4],
    A: [
        [0.7, 0.3],
        [0.4, 0.6],
    ],
    B: [
        [0.5, 0.5],
        [0.1, 0.9],
    ],
    observations: [0, 1, 1],
};

function makeCells(
    rows: number,
    cols: number,
    values: number[][] | null,
    activeCol: number,
    doneCols: Set<number>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let t = 0; t < cols; t += 1) {
            let state: EntityState = "unvisited";
            if (doneCols.has(t)) {
                state = "sorted";
            } else if (t === activeCol) {
                state = "comparing";
            }
            const value = values ? (values[t]?.[i] ?? 0) : -1;
            cells.push({
                id: `cell-${i}-${t}`,
                type: "cell",
                label: values ? value.toFixed(4) : "?",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: t },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HMMInput | null) ?? {};
    const pi = Array.isArray(task.pi) ? [...task.pi] : [...DEFAULT.pi];
    const A = Array.isArray(task.A) ? task.A.map((row) => [...row]) : DEFAULT.A.map((row) => [...row]);
    const B = Array.isArray(task.B) ? task.B.map((row) => [...row]) : DEFAULT.B.map((row) => [...row]);
    const observations = Array.isArray(task.observations) ? [...task.observations] : [...DEFAULT.observations];
    const K = pi.length;
    const T = observations.length;

    if (K === 0 || T === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty model or observation sequence: no posteriors to compute.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: K, cols: T, phase: "empty" },
        };
        return;
    }

    const alpha: number[][] = Array.from({ length: T }, () => Array<number>(K).fill(0));
    const beta: number[][] = Array.from({ length: T }, () => Array<number>(K).fill(0));
    const gamma: number[][] = Array.from({ length: T }, () => Array<number>(K).fill(0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(K, T, null, -1, new Set()),
        edges: [],
        description: `Forward-backward on ${T} observation(s) across ${K} hidden state(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: K, cols: T, phase: "setup" },
    };
    step += 1;

    for (let j = 0; j < K; j += 1) {
        alpha[0]![j] = (pi[j] ?? 0) * (B[j]?.[observations[0] ?? 0] ?? 0);
    }
    yield {
        stepNumber: step,
        entities: makeCells(K, T, alpha, 0, new Set()),
        edges: [],
        description: "Forward initialization: prior times the first emission.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: K, cols: T, phase: "forward", alpha: alpha.flat() },
    };
    step += 1;

    for (let t = 1; t < T; t += 1) {
        for (let j = 0; j < K; j += 1) {
            let sum = 0;
            for (let i = 0; i < K; i += 1) {
                sum += (alpha[t - 1]?.[i] ?? 0) * (A[i]?.[j] ?? 0);
            }
            alpha[t]![j] = sum * (B[j]?.[observations[t] ?? 0] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makeCells(K, T, alpha, t, new Set([t])),
            edges: [],
            description: `Forward time ${t}: summed ${K} predecessor states for each current state.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: K, cols: T, phase: "forward", alpha: alpha.flat() },
        };
        step += 1;
    }

    for (let i = 0; i < K; i += 1) {
        beta[T - 1]![i] = 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(K, T, beta, T - 1, new Set()),
        edges: [],
        description: "Backward initialization: beta is one at the final time.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: K, cols: T, phase: "backward", beta: beta.flat() },
    };
    step += 1;

    for (let t = T - 2; t >= 0; t -= 1) {
        for (let i = 0; i < K; i += 1) {
            let sum = 0;
            for (let j = 0; j < K; j += 1) {
                sum += (A[i]?.[j] ?? 0) * (B[j]?.[observations[t + 1] ?? 0] ?? 0) * (beta[t + 1]?.[j] ?? 0);
            }
            beta[t]![i] = sum;
        }
        yield {
            stepNumber: step,
            entities: makeCells(K, T, beta, t, new Set([t])),
            edges: [],
            description: `Backward time ${t}: summed over future states and emissions.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: K, cols: T, phase: "backward", beta: beta.flat() },
        };
        step += 1;
    }

    let probability = 0;
    for (let i = 0; i < K; i += 1) {
        probability += (alpha[T - 1]?.[i] ?? 0) * (beta[T - 1]?.[i] ?? 0);
    }
    const safe = probability > 0 ? probability : Number.MIN_VALUE;
    const xi: number[][][] = [];
    for (let t = 0; t < T; t += 1) {
        for (let i = 0; i < K; i += 1) {
            gamma[t]![i] = ((alpha[t]?.[i] ?? 0) * (beta[t]?.[i] ?? 0)) / safe;
        }
    }
    for (let t = 0; t < T - 1; t += 1) {
        const layer: number[][] = Array.from({ length: K }, () => Array<number>(K).fill(0));
        for (let i = 0; i < K; i += 1) {
            for (let j = 0; j < K; j += 1) {
                layer[i]![j] =
                    ((alpha[t]?.[i] ?? 0) * (A[i]?.[j] ?? 0) * (B[j]?.[observations[t + 1] ?? 0] ?? 0) * (beta[t + 1]?.[j] ?? 0)) / safe;
            }
        }
        xi.push(layer);
    }
    yield {
        stepNumber: step,
        entities: makeCells(K, T, gamma, -1, new Set(Array.from({ length: T }, (_, t) => t))),
        edges: [],
        description: `Posterior state probabilities gamma; sequence probability ${probability.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: K,
            cols: T,
            phase: "posterior",
            gamma: gamma.flat(),
            xi: xi.flat(2),
            transitions: T - 1,
            probability,
            logLikelihood: Math.log(probability > 0 ? probability : Number.MIN_VALUE),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The forward pass tells us how likely each hidden state is to explain the observations seen so far, while the backward pass tells us how well each state explains the observations still to come. Multiplying the two at each moment and normalizing gives the posterior chance the model was in that state then, taking into account the entire sequence rather than only the past.",
        invariants: [
            "alpha at time t summarizes all observed prefixes ending in a given state.",
            "beta at time t summarizes all observed suffixes given the current state.",
            "Gamma at each time is nonnegative and sums to one across states.",
        ],
        correctness:
            "By induction the forward pass sums probabilities of all prefixes ending in a state and the backward pass sums probabilities of all suffixes starting from it. Their product is proportional to the total probability of the full sequence passing through that state at that time, so normalizing by the sequence probability gives the exact posterior by Bayes' rule. The same construction over state pairs gives transition posteriors.",
        complexityRationale:
            "Each of the T times computes K states by summing K predecessor or successor terms, requiring O(T * K^2) time. The alpha, beta, and gamma tables each hold T by K values, so O(T * K) space suffices.",
        uses: [
            "Smoothing part-of-speech tags with surrounding context",
            "Computing posterior state occupancies inside Baum-Welch training",
            "Filtering and prediction for hidden Markov models",
        ],
        references: [
            "Rabiner, A Tutorial on Hidden Markov Models, 1989",
            "Durbin et al., Biological Sequence Analysis, Chapter 3",
        ],
        workedExample:
            "With states Rainy and Sunny observing walk then shop, the forward alpha at time zero is (0.30, 0.04). The backward beta at the last time is (1, 1). Combining forward and backward values and normalizing gives the posterior chance of each state at each of the two times.",
    },
    id: "forward-backward-algorithm",
    name: "Forward-Backward Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(T * K^2)", space: "O(T * K)" },
    defaultInput: { ...DEFAULT },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize alpha at time zero from prior times first emission",
        "for each later time sum predecessors times transition times emission",
        "initialize beta at the final time to one for every state",
        "for each earlier time sum successors times transition times emission",
        "combine alpha and beta and divide by the sequence probability",
        "accumulate transition posteriors from alpha, beta, and the model",
        "done: report the posterior state and transition probabilities",
    ],
};

export default module;
