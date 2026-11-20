/**
 * cross-entropy-information.ts - Cross Entropy of Two Distributions
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cross entropy measures the average number of bits needed to encode events
 * from distribution p using a code designed for distribution q. It is
 * H(p,q) = -sum p(x) log2 q(x). The excess over the true entropy H(p) is the
 * Kullback-Leibler divergence, which is always nonnegative.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n outcomes
 *   Space: O(n) for the displayed per-outcome contributions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per outcome with columns p, q, and the bit contribution.
 *   - The current outcome is highlighted during the accumulation pass.
 *   - The final frame reports H(p,q), H(p), and their difference.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    p?: number[];
    q?: number[];
}

/** Normalize a vector of nonnegative weights into a probability distribution. */
function normalize(values: number[], fallback: number[]): number[] {
    const source = values.length > 0 ? values : fallback;
    const safe = source.map((v) => Math.max(0, Number.isFinite(v) ? v : 0));
    const total = safe.reduce((sum, v) => sum + v, 0);
    if (total <= 0) return safe.map(() => 1 / safe.length);
    return safe.map((v) => v / total);
}

function makeCells(
    p: number[],
    q: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < p.length; row += 1) {
        const pValue = p[row] ?? 0;
        const qValue = Math.max(1e-12, q[row] ?? 0);
        const contribution = pValue > 0 ? -pValue * Math.log2(qValue) : 0;
        const columns = [pValue, qValue, contribution];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = "sorted";
            else if (row === current) state = "comparing";
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
    const p = normalize(Array.isArray(task.p) ? task.p : [], [0.5, 0.25, 0.15, 0.1]);
    const q = normalize(Array.isArray(task.q) ? task.q : [], [0.25, 0.25, 0.25, 0.25]);
    const n = p.length;

    const contributions: number[] = [];
    const selfEntropy: number[] = [];
    let hCross = 0;
    let hP = 0;
    for (let i = 0; i < n; i += 1) {
        const pValue = p[i] ?? 0;
        const qValue = Math.max(1e-12, q[i] ?? 0);
        const term = pValue > 0 ? -pValue * Math.log2(qValue) : 0;
        const selfTerm = pValue > 0 ? -pValue * Math.log2(pValue) : 0;
        contributions.push(term);
        selfEntropy.push(selfTerm);
        hCross += term;
        hP += selfTerm;
    }
    const kl = hCross - hP;

    const metaAll = {
        family: "cross-entropy",
        rows: n,
        cols: 3,
        hCross: Number(hCross.toFixed(6)),
        hP: Number(hP.toFixed(6)),
        kl: Number(kl.toFixed(6)),
        nonnegative: kl >= -1e-12,
        contributions: contributions.map((v) => Number(v.toFixed(6))),
    };

    yield {
        stepNumber: 0,
        entities: makeCells(p, q, -1, false),
        edges: [],
        description: `Cross entropy between two distributions over ${n} outcomes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaAll,
    };

    let step = 1;
    let running = 0;
    for (let i = 0; i < n; i += 1) {
        running += contributions[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(p, q, i, false),
            edges: [],
            description: `Outcome ${i}: p=${(p[i] ?? 0).toFixed(3)}, q=${(q[i] ?? 0).toFixed(3)}, contribution ${(contributions[i] ?? 0).toFixed(3)} bits; running total ${running.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...metaAll, current: i, running: Number(running.toFixed(6)) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(p, q, -1, true),
        edges: [],
        description: `H(p,q)=${hCross.toFixed(4)} bits, H(p)=${hP.toFixed(4)} bits, divergence ${kl.toFixed(4)} bits.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...metaAll, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine compressing messages drawn from distribution p but using a codebook tuned to a different distribution q. Outcomes that p makes common but q considers rare are expensive to encode. Cross entropy adds up those costs; it equals the true entropy of p only when the codebook matches p exactly, and the gap is the divergence between the two.",
        invariants: [
            "Both input vectors are normalized to nonnegative distributions summing to one.",
            "Each contribution is -p_i times the base-two logarithm of q_i.",
            "Cross entropy is at least the entropy of p, so the divergence is nonnegative.",
        ],
        correctness:
            "By Gibbs' inequality, the divergence sum p_i log2(p_i/q_i) is nonnegative whenever p and q are distributions, so H(p,q) = H(p) + divergence >= H(p). Equality holds if and only if p equals q everywhere. The generator computes the same per-outcome terms that define H(p,q), and the reported divergence is their difference, so the nonnegativity check validates the computation.",
        complexityRationale:
            "The generator walks the n outcomes once to accumulate contributions and once more to emit frames, giving O(n) time. It stores one contribution per outcome for the grid, so space is O(n).",
        uses: [
            "The log loss used to train classifiers with softmax outputs",
            "Comparing language models by bits per token",
            "Measuring coding inefficiency in information theory",
        ],
        references: [
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 6",
        ],
        workedExample:
            "Let p = [0.5, 0.5] and q = [0.9, 0.1]. Cross entropy is -0.5*log2(0.9) - 0.5*log2(0.1), about 1.78 bits. The entropy of p is exactly 1 bit, so the divergence is about 0.78 bits, confirming that using the mismatched code costs more.",
    },
    id: "cross-entropy-information",
    name: "Cross Entropy Information",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { p: [0.5, 0.25, 0.15, 0.1], q: [0.25, 0.25, 0.25, 0.25] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the true distribution p and the coding distribution q",
        "normalize both vectors so their entries sum to one",
        "for each outcome compute minus p times log base two of q",
        "add every contribution to obtain the cross entropy",
        "separately add minus p times log base two of p for the entropy",
        "subtract the entropy from the cross entropy for the divergence",
        "done: report cross entropy, entropy, and divergence",
    ],
};

export default module;
