/**
 * mcnemar-test.ts - McNemar Test for Paired Binary Data
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * McNemar's test compares two paired classifiers or repeated binary readings.
 * Only the discordant pairs matter: b cases where the first reading is positive
 * and the second negative, and c cases in the opposite direction. The test
 * forms a chi-square statistic with a continuity correction and computes an
 * exact two-sided p value from the binomial distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + min(b,c)) for n = b + c discordant cases
 *   Space: O(n) for the displayed case bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per discordant case, positive direction sorted, negative visited.
 *   - The case currently being tallied is highlighted.
 *   - The final frame reports the statistic and the exact p value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCases(b: number, c: number, active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < b + c; i += 1) {
        const positive = i < b;
        let state: EntityState = positive ? "sorted" : "visited";
        if (done) {
            state = positive ? "sorted" : "visited";
        } else if (i === active) {
            state = "active";
        }
        entities.push({
            id: `case-${i}`,
            type: "bar" as const,
            label: positive ? "+" : "-",
            value: positive ? 1 : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, positive },
        });
    }
    return entities;
}

function binomialTail(n: number, upTo: number): number {
    const half = 0.5 ** n;
    let term = half;
    let sum = 0;
    for (let i = 0; i <= upTo; i += 1) {
        sum += term;
        term = (term * (n - i)) / (i + 1);
    }
    return sum;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { table?: number[]; b?: number; c?: number } | null) ?? {};
    const table: number[] = Array.isArray(task.table) ? task.table.slice(0, 4) : [20, 12, 3, 18];
    while (table.length < 4) {
        table.push(0);
    }
    const b = Math.max(0, Math.floor(task.b ?? table[1] ?? 0));
    const c = Math.max(0, Math.floor(task.c ?? table[2] ?? 0));
    const n = b + c;

    yield {
        stepNumber: 0,
        entities: makeCases(b, c, -1, false),
        edges: [],
        description: `McNemar test on ${n} discordant pair(s): b = ${b}, c = ${c}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { b, c, n, statistic: 0, pValue: 1 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCases(b, c, i, false),
            edges: [],
            description: `Tallying discordant case ${i + 1} of ${n} as ${i < b ? "positive" : "negative"}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { b, c, n, statistic: 0, pValue: 1 },
        };
        step += 1;
    }

    const correctedNumerator = n > 0 ? Math.max(0, Math.abs(b - c) - 1) ** 2 : 0;
    const statistic = n > 0 ? correctedNumerator / n : 0;
    yield {
        stepNumber: step,
        entities: makeCases(b, c, -1, true),
        edges: [],
        description: `Continuity-corrected chi-square statistic is ${statistic.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { b, c, n, statistic, pValue: 1 },
    };
    step += 1;

    const tail = n > 0 ? binomialTail(n, Math.min(b, c)) : 1;
    const pValue = Math.min(1, 2 * tail);
    yield {
        stepNumber: step,
        entities: makeCases(b, c, -1, true),
        edges: [],
        description: `Exact two-sided binomial tail sums to ${tail.toFixed(6)}; p value ${pValue.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { b, c, n, statistic, pValue, tail },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCases(b, c, -1, true),
        edges: [],
        description: `McNemar: statistic ${statistic.toFixed(4)}, exact p value ${pValue.toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { b, c, n, statistic, pValue, tail },
    };
}

/** The McNemar test module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When the same subjects are measured twice, the concordant cells carry no information about a change. McNemar's test looks only at the pairs that switched, asking whether switches in one direction are more common than switches in the other.",
        invariants: [
            "Only the two discordant cells b and c influence the result.",
            "Under the null hypothesis each discordant case is equally likely to switch in either direction.",
            "The exact p value is the two-sided binomial tail with n equals b plus c trials.",
        ],
        correctness:
            "Each discordant pair is an independent Bernoulli trial with probability one half under the null, so the count in either direction is binomial. Summing probabilities up to the smaller count and doubling gives the two-sided exact p value. The continuity-corrected statistic approximates the same tail with a chi-square distribution on one degree of freedom.",
        complexityRationale:
            "Creating and tallying the discordant cases is linear in n. The binomial tail is accumulated iteratively up to the smaller of b and c, so no factorial recomputation is needed.",
        uses: [
            "Comparing two medical tests on the same patients",
            "Evaluating whether two classifiers differ on a shared validation set",
            "Analyzing before-and-after binary survey responses",
        ],
        references: [
            "McNemar, Note on the Significance of Paired Observations, 1947",
            "Agresti, Analysis of Categorical Data, Chapter 6",
        ],
        workedExample:
            "With b equals 12 and c equals 3 there are 15 discordant pairs. The corrected statistic is (9 minus 1) squared over 15, about 4.27. Summing binomial probabilities up to 3 and doubling gives a p value near 0.035, so the two readings differ.",
    },
    id: "mcnemar-test",
    name: "McNemar Test",
    category: "statistics-probability",
    complexity: { time: "O(n + min(b,c))", space: "O(n)" },
    defaultInput: { table: [20, 12, 3, 18] },
    visualType: "array",
    run,
    pseudocode: [
        "read the four cells of the paired two by two table",
        "let b and c be the two discordant cell counts",
        "form n discordant cases, b of one type and c of the other",
        "for each discordant case tally its direction",
        "set the statistic to (abs(b minus c) minus 1) squared over n",
        "sum binomial probabilities from zero to the smaller of b and c",
        "double the tail and cap it at one for the two sided p value",
        "done: report the McNemar statistic and exact p value",
    ],
};

export default module;
