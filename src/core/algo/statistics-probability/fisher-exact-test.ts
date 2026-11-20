/**
 * fisher-exact-test.ts - Fisher's Exact Test for a 2x2 Table
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fisher's exact test conditions on both margins of a 2x2 contingency table.
 * Under the null hypothesis of independence, the count in the top-left cell
 * follows a hypergeometric distribution. The test enumerates every table with
 * the same margins, computes its probability, and sums the probabilities that
 * are no larger than the observed one to obtain the two-sided p-value. One-sided
 * upper and lower tail probabilities are reported as well.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) where r is the number of admissible top-left counts
 *   Space: O(r) for the enumerated distribution and display cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The top two grid rows show the current 2x2 table.
 *   - The third row shows the hypergeometric probability of each admissible
 *     table, with the one being tested highlighted.
 *   - The final frame reports both one-sided and two-sided p-values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Natural logarithm of n! computed by summation, valid for small tables. */
function logFactorial(n: number): number {
    let sum = 0;
    for (let i = 2; i <= n; i += 1) {
        sum += Math.log(i);
    }
    return sum;
}

/** Log of the binomial coefficient C(n, k). */
export function logCombination(n: number, k: number): number {
    if (k < 0 || k > n) {
        return -Infinity;
    }
    const kk = Math.min(k, n - k);
    return logFactorial(n) - logFactorial(kk) - logFactorial(n - kk);
}

export interface FisherResult {
    a: number;
    b: number;
    c: number;
    d: number;
    support: number[];
    probabilities: number[];
    observedProbability: number;
    pGreater: number;
    pLess: number;
    pTwoSided: number;
}

/** Enumerate the exact conditional distribution and all three p-values. */
export function fisherExact(table: number[]): FisherResult {
    const [a, b, c, d] = table.map((v) => Math.max(0, Math.floor(v)));
    const row1 = (a ?? 0) + (b ?? 0);
    const col1 = (a ?? 0) + (c ?? 0);
    const total = row1 + (c ?? 0) + (d ?? 0);
    const min = Math.max(0, row1 - (total - col1));
    const max = Math.min(row1, col1);
    const logDenominator = logCombination(total, row1);

    const support: number[] = [];
    const probabilities: number[] = [];
    for (let x = min; x <= max; x += 1) {
        const logProb =
            logCombination(col1, x) + logCombination(total - col1, row1 - x) - logDenominator;
        support.push(x);
        probabilities.push(Math.exp(logProb));
    }

    const observedIndex = support.indexOf(a ?? 0);
    const observedProbability = observedIndex >= 0 ? (probabilities[observedIndex] ?? 0) : 0;
    let pGreater = 0;
    let pLess = 0;
    let pTwoSided = 0;
    for (let i = 0; i < support.length; i += 1) {
        const p = probabilities[i] ?? 0;
        if ((support[i] ?? 0) >= (a ?? 0)) {
            pGreater += p;
        }
        if ((support[i] ?? 0) <= (a ?? 0)) {
            pLess += p;
        }
        if (p <= observedProbability * (1 + 1e-9)) {
            pTwoSided += p;
        }
    }

    return {
        a: a ?? 0,
        b: b ?? 0,
        c: c ?? 0,
        d: d ?? 0,
        support,
        probabilities,
        observedProbability,
        pGreater: Math.min(1, pGreater),
        pLess: Math.min(1, pLess),
        pTwoSided: Math.min(1, pTwoSided),
    };
}

/** Grid cells for the 2x2 table plus one cell per admissible table. */
function makeCells(result: FisherResult, current: number, phase: string): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const table = [
        [result.a, result.b],
        [result.c, result.d],
    ];
    for (let r = 0; r < 2; r += 1) {
        for (let col = 0; col < 2; col += 1) {
            const value = table[r]?.[col] ?? 0;
            cells.push({
                id: `cell-table-${r}-${col}`,
                type: "cell",
                label: String(value),
                value,
                state: phase === "done" ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col, role: "table" },
            });
        }
    }
    const shownA = phase === "done" ? result.a : (result.support[current] ?? result.a);
    const shown = [
        [shownA, result.a + result.b - shownA],
        [result.a + result.c - shownA, result.c + result.d - (result.a + result.b - shownA)],
    ];
    for (let col = 0; col < 2; col += 1) {
        for (let r = 0; r < 2; r += 1) {
            const cell = cells[r * 2 + col];
            if (cell) {
                cell.label = String(shown[r]?.[col] ?? 0);
                cell.value = shown[r]?.[col] ?? 0;
                cell.state = phase === "done" ? "sorted" : "comparing";
            }
        }
    }
    result.support.forEach((x, index) => {
        let state: EntityState = "idle";
        if (phase === "done") {
            state = x === result.a ? "sorted" : "idle";
        } else if (index === current) {
            state = "active";
        }
        cells.push({
            id: `cell-prob-${index}`,
            type: "cell",
            label: `a=${x}:${(result.probabilities[index] ?? 0).toFixed(4)}`,
            value: result.probabilities[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 2, col: index, role: "probability", count: x },
        });
    });
    return cells;
}

/** The Fisher exact test generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { table?: number[] } | null) ?? {};
    const raw = Array.isArray(task.table) ? task.table : [3, 1, 1, 3];
    const table = [0, 1, 2, 3].map((i) => Math.max(0, Math.floor(Number(raw[i]) || 0)));
    const result = fisherExact(table);
    const cols = Math.max(2, result.support.length);

    yield {
        stepNumber: 0,
        entities: makeCells(result, 0, "setup"),
        edges: [],
        description: `Setting up Fisher's exact test on the table [${table.join(", ")}] with fixed margins.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 3,
            cols,
            table,
            support: result.support,
            probabilities: result.probabilities,
            observedProbability: result.observedProbability,
            pGreater: 0,
            pLess: 0,
            pTwoSided: 0,
            phase: "setup",
        },
    };

    let cumulative = 0;
    for (let i = 0; i < result.support.length; i += 1) {
        const p = result.probabilities[i] ?? 0;
        const x = result.support[i] ?? 0;
        cumulative += p;
        yield {
            stepNumber: 1 + i,
            entities: makeCells(result, i, "enumerate"),
            edges: [],
            description: `Enumerating a=${x}: hypergeometric probability ${p.toFixed(5)}; cumulative mass ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 3,
                cols,
                table,
                support: result.support,
                probabilities: result.probabilities,
                observedProbability: result.observedProbability,
                pGreater: 0,
                pLess: 0,
                pTwoSided: 0,
                phase: "enumerate",
                index: i,
                count: x,
                probability: p,
                cumulative,
            },
        };
    }

    yield {
        stepNumber: 1 + result.support.length,
        entities: makeCells(result, 0, "done"),
        edges: [],
        description: `Observed top-left ${result.a} has probability ${result.observedProbability.toFixed(5)}; two-sided p ${result.pTwoSided.toFixed(5)}, upper-tail p ${result.pGreater.toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 3,
            cols,
            table,
            support: result.support,
            probabilities: result.probabilities,
            observedProbability: result.observedProbability,
            pGreater: result.pGreater,
            pLess: result.pLess,
            pTwoSided: result.pTwoSided,
            phase: "done",
            done: true,
        },
    };
}

/** The Fisher exact test module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fisher's exact test asks how surprising the observed table is if the two classifications are independent, while keeping the row and column totals fixed. That conditioning removes nuisance parameters and leaves a hypergeometric distribution over the possible top-left counts. Adding up the probabilities of tables at least as extreme as the observed one gives an exact p-value without large-sample approximations.",
        invariants: [
            "Every enumerated table has the same row and column totals as the observation.",
            "The hypergeometric probabilities over the whole support sum to one.",
            "The two-sided p-value is the sum of probabilities no larger than the observed probability.",
        ],
        correctness:
            "Conditioned on the margins, the top-left count has hypergeometric probability C(m1, x) C(n - m1, r1 - x) / C(n, r1), which is exactly the chance of drawing x successes in r1 draws without replacement from a population with m1 successes. Because small probabilities correspond to tables far from independence, summing all probabilities at most the observed one gives a valid exact significance level, and the one-sided sums are the corresponding tail probabilities.",
        complexityRationale:
            "Only r admissible top-left counts exist, where r is at most the smaller margin plus one, and each needs a constant number of logarithm sums, giving O(r) time and O(r) space for the distribution.",
        uses: [
            "Analyzing small 2x2 clinical trial and epidemiology tables",
            "Testing association between two categorical variables with sparse counts",
            "A gold standard reference for approximate tests such as chi-square",
        ],
        references: [
            "Fisher, The Design of Experiments, Chapter 4, 1935",
            "Agresti, Categorical Data Analysis, exact inference chapter",
        ],
        workedExample:
            "For the table [[3, 1], [1, 3]] both margins are 4 out of 8, so the top-left count x runs from 0 to 4 with probabilities 1, 16, 36, 16, 1 over 70. The observed x = 3 has probability 16/70, and summing the tables with probability at most 16/70 gives 34/70, about 0.486.",
    },
    id: "fisher-exact-test",
    name: "Fisher Exact Test",
    category: "statistics-probability",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { table: [3, 1, 1, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the 2x2 table and fix both row and column margins",
        "find the smallest and largest feasible top-left counts",
        "for each feasible count compute hypergeometric probability C(col1, x) C(n - col1, row1 - x) / C(n, row1)",
        "record the probability of the observed table",
        "sum the upper tail, the lower tail, and all probabilities at most the observed one",
        "done: report the one-sided and two-sided exact p-values",
    ],
};

export default module;
