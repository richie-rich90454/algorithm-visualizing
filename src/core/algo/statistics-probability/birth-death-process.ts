/**
 * birth-death-process.ts - Birth-Death Process Stationary Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A birth-death process is a continuous-time Markov chain on states 0..N that
 * only moves one step up at rate lambda_i or one step down at rate mu_i. When
 * all rates are positive the chain is reversible, so the stationary
 * distribution follows from detailed balance: pi_i = pi_0 times the product of
 * lambda_{k-1}/mu_k for k from 1 to i. Normalizing the weights gives pi. The
 * visualization checks the global balance equations and reports the mean.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for weights, normalization, balance checks, and the mean
 *   Space: O(N) for the distribution and its weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid row shows one cell per state with its stationary probability.
 *   - The state currently being normalized or checked is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface BirthDeathResult {
    distribution: number[];
    balanceError: number[];
    mean: number;
}

/** Compute the stationary distribution and balance residuals of a birth-death chain. */
export function birthDeathStationary(lambda: number[], mu: number[]): BirthDeathResult {
    const N = lambda.length - 1;
    const weights: number[] = new Array(N + 1).fill(0);
    weights[0] = 1;
    for (let i = 1; i <= N; i += 1) {
        const up = lambda[i - 1] ?? 0;
        const down = mu[i] ?? 0;
        weights[i] = down > 0 ? (weights[i - 1] ?? 0) * (up / down) : 0;
    }
    const total = weights.reduce((a, b) => a + b, 0);
    const distribution = total > 0 ? weights.map((w) => w / total) : weights.map(() => 0);
    const balanceError: number[] = [];
    for (let i = 0; i <= N; i += 1) {
        const inflow = (i > 0 ? (distribution[i - 1] ?? 0) * (lambda[i - 1] ?? 0) : 0) +
            (i < N ? (distribution[i + 1] ?? 0) * (mu[i + 1] ?? 0) : 0);
        const outflow = (distribution[i] ?? 0) * ((lambda[i] ?? 0) + (mu[i] ?? 0));
        balanceError.push(Math.abs(inflow - outflow));
    }
    let mean = 0;
    for (let i = 0; i <= N; i += 1) {
        mean += i * (distribution[i] ?? 0);
    }
    return { distribution, balanceError, mean };
}

function makeCells(distribution: number[], active: number, done: boolean): VisualEntity[] {
    return distribution.map((value, i) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (i === active) {
            state = "comparing";
        } else if (i < active) {
            state = "visited";
        }
        return {
            id: `cell-0-${i}`,
            type: "cell" as const,
            label: `pi${i}=${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i, state: i },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number[]; mu?: number[] } | null) ?? {};
    const lambdaInput = Array.isArray(task.lambda) && task.lambda.length >= 2 ? task.lambda : [0.5, 0.5, 0.5, 0];
    const muInput = Array.isArray(task.mu) && task.mu.length >= 2 ? task.mu : [0, 0.3, 0.3, 0.3];
    const lambda = lambdaInput.map((v) => Math.max(0, Number(v) || 0));
    const N = lambda.length - 1;
    const mu: number[] = [];
    for (let i = 0; i <= N; i += 1) {
        mu.push(i === 0 ? 0 : Math.max(0, Number(muInput[i]) || 0));
    }
    const result = birthDeathStationary(lambda, mu);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(result.distribution, -1, false),
        edges: [],
        description: `Birth-death chain on states 0..${N} with birth rates [${lambda.join(", ")}] and death rates [${mu.slice(1).join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: N + 1, lambda, mu, mean: 0, maxBalanceError: 0 },
    };
    step += 1;

    for (let i = 1; i <= N; i += 1) {
        const ratio = (mu[i] ?? 0) > 0 ? (lambda[i - 1] ?? 0) / (mu[i] ?? 0) : Infinity;
        yield {
            stepNumber: step,
            entities: makeCells(result.distribution, i, false),
            edges: [],
            description: `State ${i} weight = state ${i - 1} weight times lambda/${lambda[i - 1]} over mu/${mu[i]} = ${ratio.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: N + 1, lambda, mu, state: i, ratio, mean: 0 },
        };
        step += 1;
    }

    const maxError = Math.max(0, ...result.balanceError);
    yield {
        stepNumber: step,
        entities: makeCells(result.distribution, -1, true),
        edges: [],
        description: `Stationary distribution sums to one; mean population ${result.mean.toFixed(3)}, max balance error ${maxError.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: N + 1,
            lambda,
            mu,
            distribution: result.distribution,
            balanceError: result.balanceError,
            mean: result.mean,
            maxBalanceError: maxError,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In a birth-death chain the only way into a state is from its two neighbors. At equilibrium the flow from left to right must match the flow back, which makes the chain reversible. That lets us write every state's probability in terms of the previous one and a simple ratio of birth to death rates, then scale all the weights to add up to one.",
        invariants: [
            "Detailed balance holds: pi_i lambda_i equals pi_{i+1} mu_{i+1} for adjacent states.",
            "The stationary probabilities are nonnegative and sum to one.",
            "Global balance at each state means incoming probability flow equals outgoing flow.",
        ],
        correctness:
            "Repeatedly applying detailed balance gives pi_i = pi_0 product_{k=1..i} lambda_{k-1}/mu_k, and dividing by the total makes the vector sum to one. Summing detailed balance for the edges adjacent to state i yields the global balance equation inflow = outflow; the computed residuals confirm it. The long-run mean is by definition the probability-weighted sum of the state indices.",
        complexityRationale:
            "Each state needs one ratio multiplication, one balance comparison, and one contribution to the mean, so the whole computation is O(N) time and O(N) space for the N+1 probabilities.",
        uses: [
            "Modeling queue lengths with state-dependent arrival and service rates",
            "Population dynamics and extinction risk in ecology",
            "Analyzing molecule counts in stochastic chemical kinetics",
        ],
        references: [
            "Karlin and Taylor, A First Course in Stochastic Processes, Chapter 4",
            "Norris, Markov Chains, Chapter 3",
        ],
        workedExample:
            "With birth rates all 0.5 and death rates 0.3 from state one onward, the ratios are 0.5/0.3 = 5/3 for every step. The weights 1, 5/3, 25/9, 125/27 are normalized to probabilities that decrease geometrically if deaths exceed births, and the mean is their index-weighted sum.",
    },
    id: "birth-death-process",
    name: "Birth-Death Process",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: { lambda: [0.5, 0.5, 0.5, 0], mu: [0, 0.3, 0.3, 0.3] },
    visualType: "grid",
    run,
    pseudocode: [
        "read birth rates lambda and death rates mu for each state",
        "set the unnormalized weight of state zero to one",
        "for each state i multiply the previous weight by lambda i-1 over mu i",
        "divide every weight by the total to obtain pi",
        "verify inflow equals outflow at each state",
        "sum i times pi i to get the mean population",
        "report the stationary distribution and balance error",
    ],
};

export default module;
