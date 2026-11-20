/**
 * hidden-markov-model-forward.ts - Forward Algorithm for an HMM
 *
 * Computes the probability of an observation sequence given a hidden Markov
 * model by dynamic programming over time. alpha[t][j] is the probability of
 * seeing observations 0..t and ending in hidden state j. The final answer is
 * the sum of alpha at the last time step.
 *
 * Time:  O(T * K^2) for T observations and K states
 * Space: O(T * K) for the alpha table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HMMInput {
    pi?: number[];
    A?: number[][];
    B?: number[][];
    observations?: number[];
}

function makeAlphaCells(alpha: number[][], K: number, T: number, time: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let j = 0; j < K; j += 1) {
        for (let t = 0; t < T; t += 1) {
            const shown = t <= time;
            const value = shown ? alpha[t]?.[j] ?? 0 : -1;
            entities.push({
                id: `cell-${j}-${t}`,
                type: "cell",
                label: shown ? value.toFixed(4) : "?",
                value,
                state: (shown ? (t === time ? "comparing" : "sorted") : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: j, col: t },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HMMInput | null) ?? {};
    const pi = Array.isArray(task.pi) ? [...task.pi] : [0.6, 0.4];
    const A = Array.isArray(task.A) ? task.A.map((row) => [...row]) : [
        [0.7, 0.3],
        [0.4, 0.6],
    ];
    const B = Array.isArray(task.B) ? task.B.map((row) => [...row]) : [
        [0.5, 0.5],
        [0.1, 0.9],
    ];
    const observations = Array.isArray(task.observations) ? [...task.observations] : [0, 1, 1];
    const K = pi.length;
    const T = observations.length;

    const alpha: number[][] = Array.from({ length: T }, () => Array(K).fill(0));
    for (let j = 0; j < K; j += 1) {
        alpha[0]![j] = (pi[j] ?? 0) * (B[j]?.[observations[0] ?? 0] ?? 0);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeAlphaCells(alpha, K, T, 0),
        edges: [],
        description: `Initial alpha from prior and first emission: ${alpha[0]?.map((x) => x.toFixed(4)).join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: K, cols: T, time: 0, alpha: alpha.flat() },
    };
    step += 1;

    for (let t = 1; t < T; t += 1) {
        const symbol = observations[t] ?? 0;
        for (let j = 0; j < K; j += 1) {
            let sum = 0;
            for (let i = 0; i < K; i += 1) {
                sum += (alpha[t - 1]?.[i] ?? 0) * (A[i]?.[j] ?? 0);
            }
            alpha[t]![j] = sum * (B[j]?.[symbol] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makeAlphaCells(alpha, K, T, t),
            edges: [],
            description: `Time ${t}, symbol ${symbol}: summed ${K} predecessor states for each of ${K} current states.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: K, cols: T, time: t, alpha: alpha.flat() },
        };
        step += 1;
    }

    const probability = (alpha[T - 1] ?? []).reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step,
        entities: makeAlphaCells(alpha, K, T, T - 1),
        edges: [],
        description: `Probability of the observation sequence is ${probability.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: K, cols: T, time: T - 1, alpha: alpha.flat(), probability },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A hidden Markov model moves between hidden states with known transition probabilities and emits an observation from each state. To score an observation sequence we could enumerate every possible hidden path, but that is exponential. The forward algorithm instead keeps, for each time and state, the total probability of all paths ending there, reusing earlier totals at each step.",
        invariants: [
            "alpha[0][j] equals the prior probability of state j times its probability of emitting the first symbol.",
            "alpha[t][j] sums over every predecessor state i of alpha[t-1][i] times the transition probability times the emission probability.",
            "The observation probability is the sum of alpha at the final time.",
        ],
        correctness:
            "By induction on t, alpha[t][j] is exactly the sum of probabilities of all hidden paths of length t+1 that emit the observed prefix and end in state j. The base case is the prior times the first emission, and the recurrence partitions all such paths by their predecessor state. Summing over final states therefore gives the total probability of the sequence.",
        complexityRationale:
            "Each of the T time steps computes K states by summing K predecessors, costing O(T * K^2). The alpha table holds T rows of K values, so space is O(T * K).",
        uses: [
            "Speech recognition acoustic model scoring",
            "Part-of-speech tagging and sequence labeling",
            "Likelihood computation inside the Baum-Welch training algorithm",
        ],
        references: [
            "Rabiner, A Tutorial on Hidden Markov Models, 1989",
            "Durbin et al., Biological Sequence Analysis, Chapter 3",
        ],
        workedExample:
            "With states Rainy and Sunny, prior (0.6, 0.4), transitions [[0.7,0.3],[0.4,0.6]], and emissions for walk and shop [[0.5,0.5],[0.1,0.9]], observing walk then shop gives alpha[0]=(0.30,0.04). Propagating once more and summing yields the probability of the two-symbol sequence.",
    },
    id: "hidden-markov-model-forward",
    name: "Hidden Markov Model (Forward Algorithm)",
    category: "ml-ai",
    complexity: { time: "O(T * K^2)", space: "O(T * K)" },
    defaultInput: {
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
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize alpha at time zero from prior times first emission",
        "for each later time step with its observed symbol",
        "for each current hidden state",
        "sum over prior states of alpha times transition probability",
        "multiply the sum by the current state's emission probability",
        "after the last symbol sum alpha over all states",
        "done: report the observation sequence probability",
    ],
};

export default module;
