/**
 * wilcoxon-signed-rank.ts - Wilcoxon Signed-Rank Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The signed-rank test checks whether the center of a paired set of differences
 * is zero. It discards zero differences, ranks the absolute differences (ties
 * share the average rank), then sums the ranks belonging to positive and to
 * negative differences. The smaller sum is the test statistic. Exact p-values
 * come from enumerating every sign assignment for small samples.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to rank plus O(2^n) for the exact null
 *   Space: O(n) for the ranked differences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one column per nonzero difference.
 *   - Rows show the difference, its absolute value, its rank, and its sign.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = 0.319381530 * t - 0.356563782 * t ** 2 + 1.781477937 * t ** 3 - 1.821255978 * t ** 4 + 1.330274429 * t ** 5;
    const upper = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI) * poly;
    return z >= 0 ? 1 - upper : upper;
}

/** Midranks of the absolute values, aligned with the input positions. */
function absoluteRanks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(values.length).fill(0);
    let i = 0;
    while (i < indexed.length) {
        let j = i + 1;
        while (j < indexed.length && (indexed[j] as { value: number }).value === (indexed[i] as { value: number }).value) j += 1;
        const averageRank = (i + 1 + j) / 2;
        for (let k = i; k < j; k += 1) ranks[(indexed[k] as { index: number }).index] = averageRank;
        i = j;
    }
    return ranks;
}

/** Exact two-sided p-value by enumerating all sign assignments. */
function exactPValue(ranks: number[], observedW: number): number {
    const n = ranks.length;
    let extreme = 0;
    let total = 0;
    const recurse = (index: number, plusSum: number): void => {
        if (index === n) {
            total += 1;
            const totalRank = ranks.reduce((sum, r) => sum + r, 0);
            if (Math.min(plusSum, totalRank - plusSum) <= observedW + 1e-9) extreme += 1;
            return;
        }
        const rank = ranks[index] ?? 0;
        recurse(index + 1, plusSum + rank);
        recurse(index + 1, plusSum);
    };
    recurse(0, 0);
    return total === 0 ? 1 : extreme / total;
}

function makeCells(rows: Array<Array<{ label: string; value: number; state: EntityState }>>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < (rows[row]?.length ?? 0); col += 1) {
            const cell = (rows[row] as Array<{ label: string; value: number; state: EntityState }>)[col] as { label: string; value: number; state: EntityState };
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: cell.label,
                value: cell.value,
                state: cell.state,
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
    const task = (input as { differences?: number[] } | null) ?? {};
    const raw = Array.isArray(task.differences) && task.differences.length > 0
        ? task.differences.map(Number)
        : [-1, 2, -3, 4, -5, 6, 7, -8];
    const differences = raw.filter((d) => d !== 0);
    const n = differences.length;
    const abs = differences.map(Math.abs);
    const ranks = absoluteRanks(abs);
    let wPlus = 0;
    let wMinus = 0;
    for (let i = 0; i < n; i += 1) {
        if ((differences[i] as number) > 0) wPlus += ranks[i] as number;
        else wMinus += ranks[i] as number;
    }
    const w = Math.min(wPlus, wMinus);
    const exact = n <= 16;
    const mean = (n * (n + 1)) / 4;
    const variance = (n * (n + 1) * (2 * n + 1)) / 24;
    const z = variance > 0 ? (w - mean) / Math.sqrt(variance) : 0;
    const pValue = n === 0 ? 1 : exact ? exactPValue(ranks, w) : Math.min(1, 2 * normalCdf(z));

    const buildRows = (revealed: number): Array<Array<{ label: string; value: number; state: EntityState }>> => {
        const diffRow: Array<{ label: string; value: number; state: EntityState }> = [];
        const absRow: Array<{ label: string; value: number; state: EntityState }> = [];
        const rankRow: Array<{ label: string; value: number; state: EntityState }> = [];
        const signRow: Array<{ label: string; value: number; state: EntityState }> = [];
        for (let i = 0; i < n; i += 1) {
            const positive = (differences[i] as number) > 0;
            const shown = i < revealed;
            diffRow.push({ label: String(differences[i]), value: differences[i] as number, state: shown ? "comparing" : "idle" });
            absRow.push({ label: String(abs[i]), value: abs[i] as number, state: shown ? "active" : "idle" });
            rankRow.push({ label: shown ? (ranks[i] as number).toFixed(1) : "-", value: ranks[i] as number, state: shown ? "active" : "idle" });
            signRow.push({ label: positive ? "+" : "-", value: positive ? 1 : 0, state: shown ? (positive ? "sorted" : "visited") : "idle" });
        }
        return [diffRow, absRow, rankRow, signRow];
    };

    yield {
        stepNumber: 0,
        entities: makeCells(buildRows(0)),
        edges: [],
        description: `Start with ${raw.length} paired differences; drop the zeros and rank the absolute values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: n, n, wPlus: 0, wMinus: 0, w: 0, pValue: 1, method: exact ? "exact" : "normal" },
    };
    let step = 1;
    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(buildRows(i + 1)),
            edges: [],
            description: `Difference ${differences[i]} has absolute value ${abs[i]} and midrank ${(ranks[i] as number).toFixed(1)}; it belongs to the ${(differences[i] as number) > 0 ? "positive" : "negative"} group.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 4, cols: n, n, wPlus: 0, wMinus: 0, w: 0, pValue: 1, method: exact ? "exact" : "normal" },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(buildRows(n)),
        edges: [],
        description: `W+ = ${wPlus.toFixed(1)}, W- = ${wMinus.toFixed(1)}, W = ${w.toFixed(1)}; ${exact ? "exact" : "normal-approximation"} two-sided p-value ${pValue.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 4, cols: n, n, wPlus, wMinus, w, pValue, method: exact ? "exact" : "normal" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pair two measurements and look at their differences. If there is no real shift, positive and negative differences should be equally common and similarly sized. Rank the sizes ignoring sign, then check whether the positive ranks and the negative ranks balance.",
        invariants: [
            "Zero differences are discarded before ranking.",
            "Tied absolute differences receive the average of their ranks.",
            "W+ plus W- equals n times (n+1) over two.",
        ],
        correctness:
            "Under the null hypothesis the sign of each nonzero difference is an independent fair coin flip, independent of its magnitude. Therefore every assignment of the fixed absolute ranks to plus or minus is equally likely. Enumerating those 2^n assignments gives the exact probability of a rank sum as extreme as the observed one; larger samples use the normal limit of the same distribution.",
        complexityRationale:
            "Sorting the absolute differences costs O(n log n). The exact null enumerates 2^n sign patterns, which is feasible to n = 16; beyond that a constant-time normal approximation is used. Space is O(n) for the ranked values.",
        uses: [
            "Comparing before-and-after measurements on the same subjects",
            "A nonparametric alternative to the paired t-test",
            "Analyzing matched-pairs experiments with ordinal outcomes",
        ],
        references: [
            "Wilcoxon, Individual Comparisons by Ranking Methods, 1945",
            "Conover, Practical Nonparametric Statistics, Chapter 5",
        ],
        workedExample:
            "For differences (-1, 2, -3, 4, -5, 6, 7, -8) the absolute values rank 1 through 8. Positive ranks sum to 2+4+6+7 = 19 and negative ranks sum to 1+3+5+8 = 17, so W = 17 and the signs are nearly balanced.",
    },
    id: "wilcoxon-signed-rank",
    name: "Wilcoxon Signed-Rank Test",
    category: "statistics-probability",
    complexity: { time: "O(n log n + 2^n)", space: "O(n)" },
    defaultInput: { differences: [-1, 2, -3, 4, -5, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "discard differences equal to zero",
        "rank the absolute differences, averaging ranks for ties",
        "sum the ranks with a positive sign into W plus",
        "sum the ranks with a negative sign into W minus",
        "set W to the smaller of W plus and W minus",
        "enumerate sign assignments for the exact null, or approximate",
        "report W and the two-sided p-value",
    ],
};

export default module;
