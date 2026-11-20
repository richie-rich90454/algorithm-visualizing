/**
 * v-trace.ts - V-trace Off-Policy Correction
 *
 * V-trace corrects value targets collected by a behavior policy when learning
 * a different target policy, as used by IMPALA. It truncates the importance
 * ratios with two levels: rho for the immediate temporal-difference error and
 * c for the propagating continuation. The truncated products keep variance
 * bounded while preserving a useful off-policy fixed point.
 *
 * Time O(T), space O(T) for the target table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VTraceInput {
    rewards: number[];
    values: number[];
    nextValues: number[];
    probs: number[];
    targetProbs: number[];
    gamma: number;
    rhoBar: number;
    cBar: number;
}

export interface VTraceStep {
    t: number;
    rho: number;
    c: number;
    delta: number;
    value: number;
    target: number;
}

/** Compute V-trace targets with the recursive IMPALA form. */
export function vTraceTargets(input: VTraceInput): VTraceStep[] {
    const { rewards, values, nextValues, probs, targetProbs, gamma, rhoBar, cBar } = input;
    const T = rewards.length;
    const rho: number[] = [];
    const c: number[] = [];
    for (let t = 0; t < T; t += 1) {
        const mu = probs[t] ?? 1;
        const raw = mu > 0 ? (targetProbs[t] ?? 0) / mu : 0;
        rho.push(Math.min(rhoBar, raw));
        c.push(Math.min(cBar, raw));
    }
    const target = new Array(T + 1).fill(0);
    target[T] = nextValues[T - 1] ?? 0;
    for (let t = T - 1; t >= 0; t -= 1) {
        const v = values[t] ?? 0;
        const vNext = nextValues[t] ?? 0;
        const delta = (rho[t] ?? 0) * ((rewards[t] ?? 0) + gamma * vNext - v);
        target[t] = v + delta + gamma * (c[t] ?? 0) * (target[t + 1] - vNext);
    }
    return Array.from({ length: T }, (_, t) => {
        const v = values[t] ?? 0;
        return {
            t,
            rho: rho[t] ?? 0,
            c: c[t] ?? 0,
            delta: (rho[t] ?? 0) * ((rewards[t] ?? 0) + gamma * (nextValues[t] ?? 0) - v),
            value: v,
            target: target[t] ?? 0,
        };
    });
}

function makeCells(steps: VTraceStep[], revealedFrom: number): VisualEntity[] {
    const labels = ["t", "rho", "c", "delta", "V(s)", "v-trace"];
    const entities: VisualEntity[] = [];
    steps.forEach((s, r) => {
        const values = [s.t, s.rho, s.c, s.delta, s.value, s.target];
        labels.forEach((label, col) => {
            const shown = r >= revealedFrom;
            entities.push({
                id: `cell-${r}-${col}`,
                type: "cell",
                label: shown ? `${label}: ${(values[col] ?? 0).toFixed(3)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state: shown ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<VTraceInput> | null) ?? {};
    const rewards = task.rewards ?? [1, 0, 2];
    const values = task.values ?? [2, 2, 1];
    const nextValues = task.nextValues ?? [2, 1, 0];
    const probs = task.probs ?? [0.5, 0.8, 0.4];
    const targetProbs = task.targetProbs ?? [0.5, 0.5, 0.8];
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.9;
    const rhoBar = typeof task.rhoBar === "number" ? task.rhoBar : 1;
    const cBar = typeof task.cBar === "number" ? task.cBar : 1;
    const steps = vTraceTargets({ rewards, values, nextValues, probs, targetProbs, gamma, rhoBar, cBar });
    const T = steps.length;
    const cols = 6;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(steps, T + 1),
        edges: [],
        description: `V-trace on a ${T}-step trajectory: truncate rho and c, then bootstrap backward.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: T, cols, targets: steps.map((s) => s.target) },
    };
    step += 1;
    for (let r = T - 1; r >= 0; r -= 1) {
        yield {
            stepNumber: step,
            entities: makeCells(steps, r),
            edges: [],
            description: `Step ${r}: rho=${(steps[r]?.rho ?? 0).toFixed(3)}, c=${(steps[r]?.c ?? 0).toFixed(3)}, target=${(steps[r]?.target ?? 0).toFixed(3)}.`,
            codeLineNumber: r === T - 1 ? 2 : 4,
            layout: "grid",
            meta: { rows: T, cols, current: r, targets: steps.map((s) => s.target) },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(steps, 0),
        edges: [],
        description: "Done: each state has a variance-truncated off-policy value target.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: T, cols, targets: steps.map((s) => s.target), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "V-trace fixes the value targets used by distributed actors whose behavior policy lags the learner. It caps the importance ratio rho that weights the immediate reward and caps a second ratio c that carries later corrections, so a single unlikely action cannot dominate the target. The two caps trade a small bias for a large reduction in variance.",
        invariants: [
            "rho is truncated at rho-bar and c at c-bar.",
            "With matching policies and caps of one, the target is the ordinary multi-step return.",
            "The horizon target equals the bootstrapped value of the terminal state.",
        ],
        correctness:
            "For each step the code computes rho as the minimum of rho-bar and pi over mu, and c as the minimum of c-bar and the same ratio. It then applies the recursive form v_t = V(s_t) + rho_t times the temporal-difference error plus gamma times c_t times the difference between the next target and V(s_{t+1}). This recursion is algebraically equal to the weighted sum of truncated errors in the IMPALA derivation, which the brute-force test verifies.",
        complexityRationale:
            "Computing the truncated ratios is one O(T) pass and the backward recursion is another O(T) pass. The rho, c, and target tables use O(T) space.",
        uses: [
            "Distributed actor-critic learning in IMPALA",
            "Off-policy correction with stale actor policies",
            "Large-scale asynchronous reinforcement learning",
        ],
        references: [
            "Espeholt et al., IMPALA: Scalable Distributed Deep-RL with Importance Weighted Actor-Learner Architectures, ICML 2018",
            "Sutton and Barto, Reinforcement Learning: An Introduction, 2nd edition, Chapter 7",
        ],
        workedExample:
            "With value 2, reward 1, gamma 0.9, next value 2, and rho capped at 1, the temporal-difference error is 1 + 0.9 times 2 minus 2 = 0.8, so the target for that step is 2.8 before continuation terms. A c smaller than one shrinks how much of the following step's correction reaches this target.",
    },
    id: "v-trace",
    name: "V-trace",
    category: "ml-ai",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: {
        rewards: [1, 0, 2],
        values: [2, 2, 1],
        nextValues: [2, 1, 0],
        probs: [0.5, 0.8, 0.4],
        targetProbs: [0.5, 0.5, 0.8],
        gamma: 0.9,
        rhoBar: 1,
        cBar: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each step compute the ratio pi over mu",
        "set rho to the ratio capped at rho-bar",
        "set c to the ratio capped at c-bar",
        "initialize the horizon target to the bootstrap value",
        "for t from the last step down to zero",
        "target = V plus rho times the TD error plus gamma times c times continuation",
        "done: report all V-trace targets",
    ],
};

export default module;
