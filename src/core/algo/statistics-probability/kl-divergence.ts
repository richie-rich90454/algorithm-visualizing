/**
 * kl-divergence.ts - Kullback-Leibler Divergence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * KL divergence measures how one probability distribution P differs from a
 * reference distribution Q. It is the expected log ratio of P to Q under P:
 * sum over outcomes of P(i) * log(P(i) / Q(i)), with the convention that a zero
 * P term contributes zero. It is nonnegative, zero only when P equals Q, but
 * it is not symmetric.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k outcomes
 *   Space: O(k) for the per-outcome contribution row
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one row for P, one for Q, and one for each P*log(P/Q) term.
 *   - The outcome currently being accumulated is yellow, finished ones green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Term P(i) * log(P(i)/Q(i)), using 0 log 0 = 0 and +infinity when Q(i)=0<P(i). */
function term(p: number, q: number): number {
    if (p === 0) return 0;
    if (q === 0) return Number.POSITIVE_INFINITY;
    return p * Math.log(p / q);
}

/** Build the P, Q, and contribution rows as grid cells. */
function makeCells(
    p: number[],
    q: number[],
    contributions: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const cols = p.length;
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            let state: EntityState = "idle";
            if (row === 2 && (done || col < current)) state = "sorted";
            if (row === 2 && col === current && !done) state = "comparing";
            let label: string;
            let value: number;
            if (row === 0) {
                label = `P ${p[col]?.toFixed(3)}`;
                value = p[col] ?? 0;
            } else if (row === 1) {
                label = `Q ${q[col]?.toFixed(3)}`;
                value = q[col] ?? 0;
            } else {
                const c = contributions[col];
                label = c === null || c === undefined ? "-" : Number.isFinite(c) ? c.toFixed(3) : "inf";
                value = c ?? 0;
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value,
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

/** The KL-divergence generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number[]; q?: number[] } | null) ?? {};
    const p = Array.isArray(task.p) && task.p.length > 0 ? task.p.map(Number) : [0.5, 0.25, 0.25];
    const q = Array.isArray(task.q) && task.q.length === p.length ? task.q.map(Number) : [1 / 3, 1 / 3, 1 / 3];
    const contributions: Array<number | null> = p.map(() => null);

    const summary = (done: boolean, value: number) => ({
        rows: 3,
        cols: p.length,
        divergence: done ? value : 0,
        entropyP: -p.reduce((s, x) => s + (x > 0 ? x * Math.log(x) : 0), 0),
        crossEntropy: -p.reduce((s, x, i) => s + (x > 0 ? x * Math.log(q[i] ?? 0) : 0), 0),
    });

    yield {
        stepNumber: 0,
        entities: makeCells(p, q, contributions, -1, false),
        edges: [],
        description: `KL(P || Q) over ${p.length} outcomes: accumulate P(i) times log(P(i)/Q(i)).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(false, 0),
    };
    let step = 1;
    let total = 0;
    for (let i = 0; i < p.length; i += 1) {
        const t = term(p[i] ?? 0, q[i] ?? 0);
        contributions[i] = t;
        total += t;
        yield {
            stepNumber: step,
            entities: makeCells(p, q, contributions, i, false),
            edges: [],
            description: `Outcome ${i}: P=${(p[i] ?? 0).toFixed(3)}, Q=${(q[i] ?? 0).toFixed(3)}, term ${Number.isFinite(t) ? t.toFixed(3) : "infinity"}; running total ${Number.isFinite(total) ? total.toFixed(3) : "infinity"}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: summary(false, total),
        };
        step += 1;
    }

    const finite = Number.isFinite(total);
    yield {
        stepNumber: step,
        entities: makeCells(p, q, contributions, p.length - 1, true),
        edges: [],
        description: finite
            ? `KL(P || Q) = ${total.toFixed(6)} nats; zero only when P and Q match.`
            : "KL(P || Q) is infinite because Q assigns zero probability where P does not.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...summary(true, total), finite },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "KL divergence scores how surprised you would be if you thought the world followed Q but outcomes actually arrived from P. Outcomes where P puts mass but Q does not are heavily penalized, while outcomes Q overweights but P rarely produces barely matter. This makes the measure directional: KL(P,Q) and KL(Q,P) generally differ.",
        invariants: [
            "Each outcome contributes P(i) * log(P(i)/Q(i)), with zero P contributing zero.",
            "A zero Q probability with positive P makes the divergence infinite.",
            "The total equals cross-entropy H(P,Q) minus entropy H(P).",
        ],
        correctness:
            "Gibbs inequality, derived from log(x) <= x - 1, gives sum P(i) log(P(i)/Q(i)) >= 0 with equality only when P equals Q wherever P is positive. The accumulated sum is exactly the definition of KL divergence, and the cross-entropy minus entropy identity follows by expanding log(P/Q) into log P minus log Q. Asymmetry follows because the weighting distribution changes when the arguments are swapped.",
        complexityRationale:
            "The loop visits each of the k outcomes once, evaluating one logarithm, so time is O(k). Storing the P, Q, and contribution rows uses O(k) space.",
        uses: [
            "Comparing a learned distribution to a target in variational inference",
            "Evaluating language models through cross-entropy per token",
            "Feature selection and anomaly detection via distributional distance",
        ],
        references: [
            "Kullback and Leibler, On Information and Sufficiency, Annals of Mathematical Statistics, 1951",
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
        ],
        workedExample:
            "For P = (0.5, 0.5) and Q = (0.25, 0.75), the terms are 0.5*log(2) about 0.347 and 0.5*log(2/3) about -0.203, summing to roughly 0.143 nats. Reversing the arguments gives a different value, illustrating the asymmetry.",
    },
    id: "kl-divergence",
    name: "Kullback-Leibler Divergence",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { p: [0.5, 0.25, 0.25], q: [1 / 3, 1 / 3, 1 / 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the total divergence to zero",
        "for each outcome i",
        "contribute zero when P(i) is zero",
        "otherwise contribute P(i) times log(P(i)/Q(i))",
        "add the contribution to the running total",
        "done: report the total, entropy, and cross-entropy",
    ],
};

export default module;
