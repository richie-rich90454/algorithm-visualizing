/**
 * jensen-shannon-divergence.ts - Jensen-Shannon Divergence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jensen-Shannon divergence is a symmetric, bounded version of KL divergence.
 * It compares two distributions P and Q to their pointwise midpoint M:
 * JSD(P,Q) = 0.5*KL(P||M) + 0.5*KL(Q||M). Using log base two keeps the value
 * between zero, when P and Q match, and one, when they have no overlap.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k outcomes
 *   Space: O(k) for the grid rows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows hold P, Q, the midpoint M, and the running contribution.
 *   - The outcome currently accumulated is yellow; finished ones are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    p?: number[];
    q?: number[];
}

/** One KL term with the 0 log 0 = 0 convention, in bits. */
function klTerm(a: number, b: number): number {
    if (a === 0) return 0;
    return a * Math.log2(a / b);
}

/** Build the four grid rows for P, Q, M, and the per-outcome contribution. */
function makeCells(
    p: number[],
    q: number[],
    m: number[],
    contributions: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const cols = p.length;
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            let state: EntityState = "idle";
            if (row === 3) {
                if (done || col < current) state = "sorted";
                if (col === current && !done) state = "comparing";
            }
            const source = row === 0 ? p : row === 1 ? q : m;
            const c = contributions[col];
            const label = row === 3
                ? c === null || c === undefined ? "-" : c.toFixed(3)
                : (source[col] ?? 0).toFixed(3);
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value: row === 3 ? (c ?? 0) : (source[col] ?? 0),
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

/** The Jensen-Shannon divergence generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const p = Array.isArray(task.p) && task.p.length > 0 ? task.p.map(Number) : [0.5, 0.25, 0.25, 0];
    const q = Array.isArray(task.q) && task.q.length === p.length ? task.q.map(Number) : [0.1, 0.1, 0.4, 0.4];
    const m = p.map((value, i) => 0.5 * (value + (q[i] ?? 0)));
    const contributions: Array<number | null> = p.map(() => null);

    const summary = (value: number) => ({
        rows: 4,
        cols: p.length,
        divergence: value,
        klPM: 0,
        klQM: 0,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(p, q, m, contributions, -1, false),
        edges: [],
        description: `Jensen-Shannon divergence over ${p.length} outcomes: average the two KL terms against the midpoint M.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(0),
    };
    let step = 1;
    let klPM = 0;
    let klQM = 0;

    for (let i = 0; i < p.length; i += 1) {
        const term = 0.5 * klTerm(p[i] ?? 0, m[i] ?? 0) + 0.5 * klTerm(q[i] ?? 0, m[i] ?? 0);
        klPM += klTerm(p[i] ?? 0, m[i] ?? 0);
        klQM += klTerm(q[i] ?? 0, m[i] ?? 0);
        contributions[i] = term;
        yield {
            stepNumber: step,
            entities: makeCells(p, q, m, contributions, i, false),
            edges: [],
            description: `Outcome ${i}: P=${(p[i] ?? 0).toFixed(3)}, Q=${(q[i] ?? 0).toFixed(3)}, M=${(m[i] ?? 0).toFixed(3)}; contribution ${term.toFixed(4)} bits.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...summary(0.5 * klPM + 0.5 * klQM), klPM, klQM },
        };
        step += 1;
    }

    const divergence = 0.5 * klPM + 0.5 * klQM;
    yield {
        stepNumber: step,
        entities: makeCells(p, q, m, contributions, p.length - 1, true),
        edges: [],
        description: `JSD(P,Q) = ${divergence.toFixed(6)} bits; symmetric and bounded by one.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...summary(divergence), klPM, klQM },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "KL divergence is one-sided, which is awkward when you just want to know whether two distributions differ. Jensen-Shannon fixes that by measuring both distributions against their own average. The result is symmetric, finite even when one distribution has zeros, and capped at one bit for log base two.",
        invariants: [
            "The midpoint distribution M equals (P+Q)/2 at every outcome.",
            "Each KL contribution is nonnegative under the 0 log 0 convention.",
            "JSD equals zero exactly when P and Q are identical.",
        ],
        correctness:
            "Because M is the midpoint, JSD is the Jensen-Shannon average of two KL divergences. KL is nonnegative and zero only for identical distributions, so JSD is nonnegative and vanishes only when both KL terms vanish, that is when P equals Q. Symmetry holds because swapping P and Q leaves M unchanged and only exchanges the two equally weighted terms. With log base two, the maximum of one is attained when P and Q have disjoint support.",
        complexityRationale:
            "Each outcome needs a constant number of logarithms, so time is O(k). The four grid rows use O(k) space.",
        uses: [
            "Comparing topic distributions in natural language processing",
            "Measuring drift between model predictions and production traffic",
            "Training generative adversarial networks with a stable divergence",
        ],
        references: [
            "Lin, Divergence Measures Based on the Shannon Entropy, IEEE Transactions on Information Theory, 1991",
            "Cover and Thomas, Elements of Information Theory, Chapter 11",
        ],
        workedExample:
            "With P = (0.5, 0.5, 0, 0) and Q = (0, 0, 0.5, 0.5), the midpoint is (0.25, 0.25, 0.25, 0.25). Each KL term is one bit, so JSD is (0.5*1 + 0.5*1) = 1 bit, the maximum, reflecting disjoint supports.",
    },
    id: "jensen-shannon-divergence",
    name: "Jensen-Shannon Divergence",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { p: [0.5, 0.25, 0.25, 0], q: [0.1, 0.1, 0.4, 0.4] },
    visualType: "grid",
    run,
    pseudocode: [
        "form the midpoint distribution M as half of P plus half of Q",
        "initialize both KL accumulators to zero",
        "for each outcome i",
        "add P(i) times log2(P(i)/M(i)) to the first accumulator",
        "add Q(i) times log2(Q(i)/M(i)) to the second accumulator",
        "set the outcome contribution to half the sum of the two terms",
        "done: report half of each accumulator added together",
    ],
};

export default module;
