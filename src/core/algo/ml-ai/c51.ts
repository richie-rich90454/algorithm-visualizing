/**
 * c51.ts - C51 Categorical Distributional Reinforcement Learning
 *
 * C51 models the value distribution as a categorical distribution over a fixed
 * support of N atoms. A Bellman backup shifts each atom by the reward and
 * discount, then splits its probability linearly between the two nearest atoms
 * of the support. Training minimizes the cross-entropy between that projected
 * target distribution and the agent's predicted distribution.
 *
 * Time O(N) for the projection and O(N^2) for the full pairwise loss table,
 * space O(N) for the atom and probability arrays.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface C51Input {
    vmin?: number;
    vmax?: number;
    atoms?: number;
    reward?: number;
    gamma?: number;
    done?: boolean;
    nextProbs?: number[];
    currentProbs?: number[];
}

export interface C51Result {
    support: number[];
    target: number[];
    loss: number;
    delta: number;
}

/** Project Bellman-shifted atoms back onto the fixed categorical support. */
export function categoricalProject(
    support: number[],
    nextProbs: number[],
    reward: number,
    gamma: number,
    done: boolean,
    vmin: number,
    vmax: number,
): number[] {
    const n = support.length;
    const delta = n > 1 ? (vmax - vmin) / (n - 1) : 1;
    const target = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const p = nextProbs[i] ?? 0;
        if (p === 0) continue;
        const shifted = reward + (done ? 0 : gamma * (support[i] ?? 0));
        const clipped = Math.min(vmax, Math.max(vmin, shifted));
        let a = (clipped - vmin) / delta;
        a = Math.min(n - 1, Math.max(0, a));
        let b = Math.floor(a);
        if (b > n - 2) b = n - 2;
        if (b < 0) b = 0;
        const lower = b + 1 - a;
        const upper = a - b;
        target[b] = (target[b] ?? 0) + p * lower;
        target[b + 1] = (target[b + 1] ?? 0) + p * upper;
    }
    return target;
}

/** Cross-entropy of the predicted distribution against the target distribution. */
export function crossEntropy(target: number[], current: number[]): number {
    const sum = current.reduce((a, b) => a + b, 0);
    const n = target.length;
    let loss = 0;
    for (let i = 0; i < n; i += 1) {
        const p = sum > 0 ? (current[i] ?? 0) / sum : 1 / n;
        loss -= (target[i] ?? 0) * Math.log(p + 1e-12);
    }
    return loss;
}

const COLUMNS = ["atom z", "next p", "target mass", "current p", "CE term"];

function makeCells(
    support: number[],
    nextProbs: number[],
    target: number[],
    current: number[],
    revealed: number,
    active: number,
): VisualEntity[] {
    const sum = current.reduce((a, b) => a + b, 0);
    const entities: VisualEntity[] = [];
    support.forEach((z, row) => {
        const cp = sum > 0 ? (current[row] ?? 0) / sum : 1 / support.length;
        const ce = -(target[row] ?? 0) * Math.log(cp + 1e-12);
        const values = [z, nextProbs[row] ?? 0, target[row] ?? 0, cp, ce];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as C51Input | null) ?? {};
    const vmin = Number(task.vmin ?? -5);
    const vmax = Number(task.vmax ?? 5);
    const n = Math.max(2, Math.min(30, Math.floor(Number(task.atoms ?? 7)) || 7));
    const reward = Number(task.reward ?? 1);
    const gamma = Number(task.gamma ?? 0.9);
    const done = Boolean(task.done);
    const delta = (vmax - vmin) / (n - 1);
    const support = Array.from({ length: n }, (_unused, i) => vmin + i * delta);
    const nextProbs = Array.isArray(task.nextProbs) && task.nextProbs.length === n
        ? task.nextProbs.map((p) => Math.max(0, p))
        : Array.from({ length: n }, (_unused, i) => Math.exp(-0.5 * ((i - (n - 1) / 2) ** 2)));
    const currentProbs = Array.isArray(task.currentProbs) && task.currentProbs.length === n
        ? task.currentProbs.map((p) => Math.max(0, p))
        : nextProbs.map((p, i) => p + (i % 2 === 0 ? 0.02 : -0.01));
    const target = categoricalProject(support, nextProbs, reward, gamma, done, vmin, vmax);
    const loss = crossEntropy(target, currentProbs);
    const base = { rows: n, cols: COLUMNS.length, N: n, vmin, vmax, delta, loss, target, support };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(support, nextProbs, target, currentProbs, -1, -1),
        edges: [],
        description: `C51 projects ${n} Bellman-shifted atoms back onto a fixed support of returns.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, nextProbs, currentProbs },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(support, nextProbs, target, currentProbs, i, i),
            edges: [],
            description: `Atom ${i} at z=${(support[i] ?? 0).toFixed(2)} receives target mass ${(target[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: target[i] ? 4 : 3,
            layout: "grid",
            meta: { ...base, active: i, nextProbs, currentProbs },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(support, nextProbs, target, currentProbs, n - 1, -1),
        edges: [],
        description: `Done: projected mass sums to ${target.reduce((a, b) => a + b, 0).toFixed(4)} and cross-entropy loss is ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, loss, target, done: true, nextProbs, currentProbs },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of predicting one expected return, C51 predicts a histogram over possible returns. The Bellman equation says each future return is the current reward plus a discounted future return, so every atom of the next distribution shifts and may land between two atoms of the fixed support. C51 splits that atom's probability between the two neighbors, producing a target histogram that the network learns to match with cross-entropy.",
        invariants: [
            "The support atoms are evenly spaced from vmin to vmax.",
            "The projected target is a probability distribution whose mass sums to one when the input distribution does.",
            "Every shifted atom is clipped into the support before its mass is split.",
        ],
        correctness:
            "For a shifted atom falling a fraction into bin b, the split assigns b+1-a of its mass to atom b and a-b to atom b+1, which sums to the original mass and interpolates linearly by position. Clipping to the support plus clamping the lower index to N-2 keeps both destinations valid, so no probability is lost. Cross-entropy is the negative log likelihood of the target under the normalized prediction, minimized when they match. The tests recompute the projection independently, verify mass conservation, check the clipping edge cases, and confirm that a matching prediction gives zero loss.",
        complexityRationale:
            "The projection visits each of the N atoms once with constant work, and the displayed cross-entropy table also has N rows, so time is O(N) here with O(N) space for the support and probability arrays.",
        uses: [
            "Distributional reinforcement learning on Atari benchmarks",
            "Risk-aware agents that need the shape of the return distribution",
            "Foundations for later quantile and implicit quantile methods",
        ],
        references: [
            "Bellemare, Dabney, and Munos, A Distributional Perspective on Reinforcement Learning, ICML, 2017",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Second Edition, Chapter 11",
        ],
        workedExample:
            "With support -2, 0, 2, 4 and a shifted atom landing at value 1, the position is one third between 0 and 2, so its mass splits with two thirds going to atom 0 and one third to atom 2. Repeating for all atoms and summing gives the target histogram, whose cross-entropy against the prediction is the training signal.",
    },
    id: "c51",
    name: "C51 Categorical DQN",
    category: "ml-ai",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: {
        vmin: -5,
        vmax: 5,
        atoms: 7,
        reward: 1,
        gamma: 0.9,
        done: false,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build an even support of N atoms from vmin to vmax",
        "for each next atom shift its position by the reward and discount",
        "clip the shifted position into the support range",
        "split its probability between the two neighboring support atoms",
        "sum the contributions into the projected target distribution",
        "measure cross-entropy between the target and the predicted distribution",
        "done: report the target distribution and the loss",
    ],
};

export default module;
