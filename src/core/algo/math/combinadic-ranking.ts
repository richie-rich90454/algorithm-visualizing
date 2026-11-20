/**
 * combinadic-ranking.ts - Combinatorial Number System Ranking.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The combinatorial number system assigns every k-element subset of {0, ...,
 * n-1} a unique rank from zero upward. For a subset c(0) < c(1) < ... <
 * c(k-1) the rank is the sum of binomial(c(i), i+1). The inverse operation
 * recovers the subset from a rank by greedily choosing the largest possible
 * element at each position. This ordering is the colexicographic order of
 * combinations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * n) with a binomial table, or O(k * n^2) computing on demand
 *   Space: O(n * k) for the binomial table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row shows one chosen element and its binomial contribution.
 *   - The active row is highlighted while the rank accumulates.
 *   - The final frame reports the rank and the subset recovered by unranking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CombinadicInput {
    n?: number;
    k?: number;
    subset?: number[];
}

function binomialTable(n: number, k: number): number[][] {
    const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0));
    for (let i = 0; i <= n; i += 1) {
        table[i]![0] = 1;
        for (let j = 1; j <= Math.min(i, k); j += 1) {
            table[i]![j] = (table[i - 1]?.[j - 1] ?? 0) + (table[i - 1]?.[j] ?? 0);
        }
    }
    return table;
}

function rankOf(subset: number[], table: number[][]): number {
    let rank = 0;
    for (let i = 0; i < subset.length; i += 1) {
        rank += table[subset[i] ?? 0]?.[i + 1] ?? 0;
    }
    return rank;
}

function unrank(rank: number, n: number, k: number, table: number[][]): number[] {
    const subset: number[] = new Array<number>(k).fill(0);
    let remaining = rank;
    for (let i = k; i >= 1; i -= 1) {
        let value = i - 1;
        while (value + 1 < n && (table[value + 1]?.[i] ?? 0) <= remaining) {
            value += 1;
        }
        subset[i - 1] = value;
        remaining -= table[value]?.[i] ?? 0;
    }
    return subset;
}

function table(
    subset: number[],
    contributions: number[],
    upto: number,
    running: number,
    active: boolean,
    done: boolean,
    recovered: number[],
    n: number,
    k: number,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number | string }> = [
        { field: "n", value: n },
        { field: "k", value: k },
        { field: "rank so far", value: running },
    ];
    subset.forEach((element, index) => {
        rows.push({
            field: `c(${index})`,
            value: `${element} -> C(${element},${index + 1}) = ${contributions[index] ?? 0}`,
        });
    });
    if (done) {
        rows.push({ field: "unranked", value: `[${recovered.join(",")}]` });
    }
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : active && i === 2 ? "active" : i > 2 && i - 3 < upto ? "visited" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CombinadicInput | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 1 ? Math.trunc(task.n) : 6;
    const k = typeof task.k === "number" && task.k >= 0 && task.k <= n ? Math.trunc(task.k) : 3;
    const fallback = [1, 3, 5];
    const raw = Array.isArray(task.subset) ? task.subset.filter((x) => Number.isInteger(x) && x >= 0 && x < n) : [];
    const valid = raw.length === k && raw.every((x, i) => i === 0 || x > raw[i - 1]!);
    const subset = valid ? raw.slice() : fallback.filter((x) => x < n).slice(0, k);
    const tableBin = binomialTable(n, k);
    const contributions = subset.map((element, index) => tableBin[element]?.[index + 1] ?? 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(subset, contributions, 0, 0, false, false, [], n, k),
        edges: [],
        description: `Rank the ${k}-subset [${subset.join(",")}] of {0,...,${n - 1}} in the combinatorial number system.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3 + k + 1, cols: 1, n, k, subset },
    };
    step += 1;

    let running = 0;
    for (let i = 0; i < subset.length; i += 1) {
        const contribution = contributions[i] ?? 0;
        running += contribution;
        yield {
            stepNumber: step,
            entities: table(subset, contributions, i + 1, running, true, false, [], n, k),
            edges: [],
            description: `Element c(${i}) = ${subset[i]} contributes C(${subset[i]},${i + 1}) = ${contribution}; rank is now ${running}.`,
            codeLineNumber: contribution > 0 ? 2 : 3,
            layout: "grid",
            meta: { rows: 3 + k + 1, cols: 1, n, k, position: i, element: subset[i], contribution, rank: running },
        };
        step += 1;
    }

    const rank = rankOf(subset, tableBin);
    const recovered = unrank(rank, n, k, tableBin);
    yield {
        stepNumber: step,
        entities: table(subset, contributions, k, rank, false, true, recovered, n, k),
        edges: [],
        description: `Done: rank = ${rank}; unranking returns [${recovered.join(",")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 3 + k + 2, cols: 1, n, k, rank, recovered, roundTrips: recovered.join(",") === subset.join(",") },
    };
}

const module: AlgorithmModule = {
    id: "combinadic-ranking",
    name: "Combinadic Ranking",
    category: "math",
    complexity: { time: "O(n*k)", space: "O(n*k)" },
    defaultInput: { n: 6, k: 3, subset: [1, 3, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "build a binomial coefficient table C(i,j) for i up to n and j up to k",
        "write the subset in increasing order as c(0) < c(1) < ... < c(k-1)",
        "for each position i add C(c(i), i+1) to the rank",
        "to unrank, for i from k down to 1 pick the largest c with C(c,i) <= remaining",
        "subtract C(c,i) from the remaining rank and continue",
        "return the rank and the recovered subset",
    ],
    education: {
        intuition:
            "There is a one-to-one dictionary between k-element subsets and integers below C(n,k). Each element of the subset contributes a binomial coefficient that counts how many smaller combinations come before it, so summing those contributions gives a unique rank and undoing the choices recovers the subset.",
        invariants: [
            "The contributions C(c(i), i+1) are strictly decreasing as i grows, so each subset has a unique sum.",
            "After processing i positions the running rank equals the rank of the partial combination.",
            "Unranking is the exact inverse of ranking for every valid subset.",
        ],
        correctness:
            "At position i, fixing c(i) and allowing the remaining positions to vary gives exactly C(c(i), i+1) combinations that precede any combination with a larger value there, which is the colexicographic counting argument. Summing these disjoint blocks enumerates all subsets from zero, and the greedy unranking walks those same blocks backward, so it returns the original subset.",
        complexityRationale:
            "Filling the binomial table touches roughly n times k entries, and ranking or unranking makes k table lookups or a scan of at most n candidates per position, so both are O(n times k) with O(n times k) table space.",
        uses: [
            "Enumerating combinations in colexicographic order",
            "Ranking and unranking hands in combinatorial card systems",
            "Indexing subsets in exhaustive search and combinatorics libraries",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 4A, Section 7.2.1.3",
            "Wikipedia, Combinatorial number system",
        ],
        workedExample:
            "For n = 6, k = 3 and subset [1,3,5], the contributions are C(1,1)=1, C(3,2)=3, and C(5,3)=10, giving rank 14. Unranking 14 greedily recovers c(2)=5, c(1)=3, c(0)=1, so it returns the same subset.",
    },
};

export default module;
