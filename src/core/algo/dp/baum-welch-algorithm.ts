/**
 * baum-welch-algorithm.ts - Baum-Welch Training of a Hidden Markov Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Baum-Welch is the expectation-maximization algorithm for hidden Markov
 * models. Given only an observation sequence, it alternates between an
 * E-step (the forward-backward algorithm, producing posterior state and
 * transition probabilities) and an M-step (re-estimating the prior,
 * transition, and emission probabilities from those posteriors). Each full
 * cycle never decreases the likelihood of the observed sequence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * T * K^2) for T observations and K states
 *   Space: O(T * K) for the forward/backward tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows the posterior state probability gamma at each time.
 *   - E-step cells are PINK, M-step cells are GREEN.
 *   - meta carries gamma, xi, the parameters, and the log-likelihood.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HMMParams {
    pi: number[];
    A: number[][];
    B: number[][];
}

const DEFAULT: HMMParams & { observations: number[]; iterations: number } = {
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
    iterations: 4,
};

/** Forward probabilities alpha[t][j]. */
function forward(pi: number[], A: number[][], B: number[][], obs: number[]): number[][] {
    const K = pi.length;
    const T = obs.length;
    const alpha: number[][] = Array.from({ length: T }, () => Array<number>(K).fill(0));
    for (let j = 0; j < K; j += 1) {
        alpha[0]![j] = (pi[j] ?? 0) * (B[j]?.[obs[0] ?? 0] ?? 0);
    }
    for (let t = 1; t < T; t += 1) {
        for (let j = 0; j < K; j += 1) {
            let sum = 0;
            for (let i = 0; i < K; i += 1) {
                sum += (alpha[t - 1]?.[i] ?? 0) * (A[i]?.[j] ?? 0);
            }
            alpha[t]![j] = sum * (B[j]?.[obs[t] ?? 0] ?? 0);
        }
    }
    return alpha;
}

/** Backward probabilities beta[t][i]. */
function backward(A: number[][], B: number[][], obs: number[]): number[][] {
    const K = A.length;
    const T = obs.length;
    const beta: number[][] = Array.from({ length: T }, () => Array<number>(K).fill(0));
    for (let i = 0; i < K; i += 1) {
        beta[T - 1]![i] = 1;
    }
    for (let t = T - 2; t >= 0; t -= 1) {
        for (let i = 0; i < K; i += 1) {
            let sum = 0;
            for (let j = 0; j < K; j += 1) {
                sum += (A[i]?.[j] ?? 0) * (B[j]?.[obs[t + 1] ?? 0] ?? 0) * (beta[t + 1]?.[j] ?? 0);
            }
            beta[t]![i] = sum;
        }
    }
    return beta;
}

interface EStep {
    gamma: number[][];
    xi: number[][][];
    logLikelihood: number;
}

function eStep(params: HMMParams, obs: number[]): EStep {
    const { pi, A, B } = params;
    const K = pi.length;
    const T = obs.length;
    const alpha = forward(pi, A, B, obs);
    const beta = backward(A, B, obs);

    let probability = 0;
    for (let i = 0; i < K; i += 1) {
        probability += (alpha[T - 1]?.[i] ?? 0) * (beta[T - 1]?.[i] ?? 0);
    }
    const safe = probability > 0 ? probability : Number.MIN_VALUE;
    const gamma: number[][] = Array.from({ length: T }, () => Array<number>(K).fill(0));
    for (let t = 0; t < T; t += 1) {
        for (let i = 0; i < K; i += 1) {
            gamma[t]![i] = ((alpha[t]?.[i] ?? 0) * (beta[t]?.[i] ?? 0)) / safe;
        }
    }
    const xi: number[][][] = [];
    for (let t = 0; t < T - 1; t += 1) {
        const layer: number[][] = Array.from({ length: K }, () => Array<number>(K).fill(0));
        for (let i = 0; i < K; i += 1) {
            for (let j = 0; j < K; j += 1) {
                layer[i]![j] =
                    ((alpha[t]?.[i] ?? 0) *
                        (A[i]?.[j] ?? 0) *
                        (B[j]?.[obs[t + 1] ?? 0] ?? 0) *
                        (beta[t + 1]?.[j] ?? 0)) /
                    safe;
            }
        }
        xi.push(layer);
    }
    return { gamma, xi, logLikelihood: Math.log(probability > 0 ? probability : Number.MIN_VALUE) };
}

/** Re-estimate the HMM parameters from posterior state and transition counts. */
function mStep(params: HMMParams, obs: number[], step: EStep): HMMParams {
    const { A, B } = params;
    const K = A.length;
    const T = obs.length;
    const M = B[0]?.length ?? 1;

    const pi = step.gamma[0]?.map((value) => value) ?? Array<number>(K).fill(0);

    const nextA: number[][] = Array.from({ length: K }, () => Array<number>(K).fill(0));
    for (let i = 0; i < K; i += 1) {
        let denom = 0;
        for (let t = 0; t < T - 1; t += 1) {
            denom += step.gamma[t]?.[i] ?? 0;
        }
        for (let j = 0; j < K; j += 1) {
            let numerator = 0;
            for (let t = 0; t < T - 1; t += 1) {
                numerator += step.xi[t]?.[i]?.[j] ?? 0;
            }
            nextA[i]![j] = denom > 0 ? numerator / denom : (A[i]?.[j] ?? 0);
        }
    }

    const nextB: number[][] = Array.from({ length: K }, () => Array<number>(M).fill(0));
    for (let i = 0; i < K; i += 1) {
        let denom = 0;
        for (let t = 0; t < T; t += 1) {
            denom += step.gamma[t]?.[i] ?? 0;
        }
        for (let k = 0; k < M; k += 1) {
            let numerator = 0;
            for (let t = 0; t < T; t += 1) {
                if (obs[t] === k) {
                    numerator += step.gamma[t]?.[i] ?? 0;
                }
            }
            nextB[i]![k] = denom > 0 ? numerator / denom : (B[i]?.[k] ?? 0);
        }
    }
    return { pi, A: nextA, B: nextB };
}

function makeCells(gamma: number[][] | null, K: number, T: number, state: EntityState): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < K; i += 1) {
        for (let t = 0; t < T; t += 1) {
            const value = gamma ? (gamma[t]?.[i] ?? 0) : -1;
            cells.push({
                id: `cell-${i}-${t}`,
                type: "cell",
                label: gamma ? value.toFixed(4) : "?",
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
    const task = (input as Partial<HMMParams & { observations: number[]; iterations: number }> | null) ?? {};
    const pi = Array.isArray(task.pi) ? [...task.pi] : [...DEFAULT.pi];
    const A = Array.isArray(task.A) ? task.A.map((row) => [...row]) : DEFAULT.A.map((row) => [...row]);
    const B = Array.isArray(task.B) ? task.B.map((row) => [...row]) : DEFAULT.B.map((row) => [...row]);
    const observations = Array.isArray(task.observations) ? [...task.observations] : [...DEFAULT.observations];
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : DEFAULT.iterations;
    const K = pi.length;
    const T = observations.length;

    if (K === 0 || T === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty model or observation sequence: nothing to train.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: K, cols: T, iterations: 0 },
        };
        return;
    }

    let params: HMMParams = { pi, A, B };
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(null, K, T, "idle"),
        edges: [],
        description: `Training Baum-Welch on ${T} observation(s) with ${K} hidden state(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: K, cols: T, iteration: 0, pi: [...params.pi], A: params.A.flat(), B: params.B.flat() },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const e = eStep(params, observations);
        yield {
            stepNumber: step,
            entities: makeCells(e.gamma, K, T, "comparing"),
            edges: [],
            description: `Iteration ${iteration} E-step: forward-backward posteriors, log-likelihood ${e.logLikelihood.toFixed(5)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: K,
                cols: T,
                iteration,
                gamma: e.gamma.flat(),
                xi: e.xi.flat(2),
                transitions: T - 1,
                logLikelihood: e.logLikelihood,
            },
        };
        step += 1;

        params = mStep(params, observations, e);
        yield {
            stepNumber: step,
            entities: makeCells(e.gamma, K, T, "sorted"),
            edges: [],
            description: `Iteration ${iteration} M-step: re-estimated prior, transitions, and emissions.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: K,
                cols: T,
                iteration,
                pi: [...params.pi],
                A: params.A.flat(),
                B: params.B.flat(),
                logLikelihood: e.logLikelihood,
            },
        };
        step += 1;
    }

    const final = eStep(params, observations);
    yield {
        stepNumber: step,
        entities: makeCells(final.gamma, K, T, "sorted"),
        edges: [],
        description: `Trained for ${iterations} iteration(s); final log-likelihood ${final.logLikelihood.toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: K,
            cols: T,
            iteration: iterations,
            pi: [...params.pi],
            A: params.A.flat(),
            B: params.B.flat(),
            logLikelihood: final.logLikelihood,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Baum-Welch trains a hidden Markov model when the hidden states are never observed. Start with a guess at the model. Ask how likely each hidden state and transition is at each moment given the observations, then re-estimate the model's probabilities from those soft counts. Repeating the two steps makes the observations steadily more likely under the model.",
        invariants: [
            "The posterior state probabilities gamma at each time sum to one.",
            "The transition posteriors xi at each time sum to one over all state pairs.",
            "The observed-sequence log-likelihood never decreases after a full E and M cycle.",
        ],
        correctness:
            "The E-step is the forward-backward computation, which gives exact posterior probabilities by Bayes' rule over all hidden paths. The M-step maximizes the expected complete-data log-likelihood, a lower bound on the observed log-likelihood that is tight at the current parameters. By the EM inequality each cycle cannot lower the true log-likelihood, so the iteration converges to a stationary point.",
        complexityRationale:
            "The forward and backward passes each visit T times and K squared transitions, so an iteration costs O(T * K^2). Keeping the alpha and beta tables uses O(T * K) space, and the xi layer can be accumulated one time step at a time.",
        uses: [
            "Training speech-recognition acoustic models",
            "Learning part-of-speech tagger probabilities from unlabeled text",
            "Fitting biological sequence models in bioinformatics",
        ],
        references: [
            "Rabiner, A Tutorial on Hidden Markov Models and Selected Applications, 1989",
            "Dempster, Laird, and Rubin, Maximum Likelihood from Incomplete Data, 1977",
            "Durbin et al., Biological Sequence Analysis, Chapter 3",
        ],
        workedExample:
            "With two states, prior (0.6, 0.4), and observations (0, 1, 1), the first E-step computes gamma for each of the three times. The M-step sets the new prior to gamma at time zero and divides transition posteriors by state posteriors to update the transition matrix. After a few cycles the likelihood of the sequence rises and then levels off.",
    },
    id: "baum-welch-algorithm",
    name: "Baum-Welch Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(iterations * T * K^2)", space: "O(T * K)" },
    defaultInput: { ...DEFAULT },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the prior, transition, and emission probabilities",
        "E-step: run forward and backward to get state and transition posteriors",
        "compute the observed log-likelihood from the forward probabilities",
        "M-step: re-estimate prior from the time-zero posteriors",
        "re-estimate transitions from transition posteriors divided by state posteriors",
        "re-estimate emissions from state posteriors at each observed symbol",
        "repeat the E and M steps for the chosen iterations",
        "done: report the fitted model and final log-likelihood",
    ],
};

export default module;
