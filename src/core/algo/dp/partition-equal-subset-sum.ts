/**
 * partition-equal-subset-sum.ts - Equal Subset Partition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a list of nonnegative integers, decide whether it can be split into
 * two groups whose sums are equal. If the total is odd the answer is no.
 * Otherwise the question becomes: can some subset reach exactly half the
 * total? A boolean dynamic-programming table answers that in pseudo-polynomial
 * time, and the table itself makes a clear visualization of which sums are
 * reachable after considering each prefix of the input.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * S) where S is half the total sum
 *   Space: O(n * S) for the DP table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per (value prefix, reachable sum) pair.
 *   - Green means the sum is reachable; gray means it is not.
 *   - The cell being filled is blue (active); unvisited rows stay idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    dp: boolean[][],
    rows: number,
    cols: number,
    currentRow: number,
    currentCol: number,
    done: boolean,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let s = 0; s < cols; s += 1) {
            const computed = done || i < currentRow || (i === currentRow && s <= currentCol);
            const reachable = dp[i]?.[s] ?? false;
            let state: EntityState = "unvisited";
            if (computed) {
                state = reachable ? "sorted" : "idle";
            }
            if (!done && i === currentRow && s === currentCol) {
                state = "active";
            }
            cells.push({
                id: `cell-${i}-${s}`,
                type: "cell" as const,
                label: reachable ? "1" : "0",
                value: reachable ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: s, reachable },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(input)
        ? [...(input as number[])]
        : [...(task.values ?? [1, 5, 11, 5])];
    const n = values.length;
    const total = values.reduce((sum, value) => sum + value, 0);
    const target = Math.floor(total / 2);
    const cols = target + 1;
    const rows = n + 1;

    const dp: boolean[][] = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
    dp[0]![0] = true;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, rows, cols, 0, 0, false),
        edges: [],
        description: `Total is ${total}; target half-sum is ${target}. Cell (0,0) starts reachable.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows, cols, target, canPartition: false, cellsComputed: 1 },
    };
    step += 1;

    if (total % 2 === 1) {
        yield {
            stepNumber: step,
            entities: makeCells(dp, rows, cols, 0, 0, false),
            edges: [],
            description: `Total ${total} is odd, so no equal split can exist.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows, cols, target, canPartition: false, cellsComputed: 1 },
        };
        step += 1;
    }

    let cellsComputed = 1;
    for (let i = 1; i <= n; i += 1) {
        const value = values[i - 1] ?? 0;
        for (let s = 0; s < cols; s += 1) {
            const without = dp[i - 1]?.[s] ?? false;
            const includeValue = s >= value && (dp[i - 1]?.[s - value] ?? false);
            dp[i]![s] = without || includeValue;
            cellsComputed += 1;
            yield {
                stepNumber: step,
                entities: makeCells(dp, rows, cols, i, s, false),
                edges: [],
                description: `Row ${i}, sum ${s}: value ${value} gives ${includeValue ? "a" : "no"} new way; reachable = ${dp[i]![s]}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { rows, cols, target, canPartition: false, cellsComputed },
            };
            step += 1;
        }
    }

    const canPartition = total % 2 === 0 && (dp[n]?.[target] ?? false);
    yield {
        stepNumber: step,
        entities: makeCells(dp, rows, cols, n, cols - 1, true),
        edges: [],
        description: canPartition
            ? `Equal partition exists: a subset sums to ${target}, the other half also sums to ${target}.`
            : `No equal partition exists: target sum ${target} is not reachable with ${values.length} values.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, target, canPartition, cellsComputed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Splitting a list into two equal halves is the same as asking whether some subset sums to half the total. Build a table where entry (i, s) says whether using the first i values can make the sum s. Each new value either is skipped or is added to every previously reachable sum.",
        invariants: [
            "An odd total can never be split into two equal integer sums.",
            "Entry (i, s) is true exactly when a subset of the first i values sums to s.",
            "Reachable sums only grow as more values are considered.",
        ],
        correctness:
            "For value i, a sum s is reachable either without it (entry i-1, s) or with it (entry i-1, s-value when s is at least value). These are the only two choices for that value, so the recurrence is exact by induction on i. The last row therefore reports whether half the total is reachable, which is precisely the equal-partition condition.",
        complexityRationale:
            "The table has (n+1) rows and (total/2 + 1) columns, and each cell is computed once, giving O(n * total) time and space. This is pseudo-polynomial: it depends on the numeric sum, not just the number of input values.",
        uses: [
            "Splitting workloads or tasks into two balanced sets",
            "A first example of pseudo-polynomial dynamic programming",
            "Subset-sum-style feasibility checks in scheduling",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, Chapter 15",
            "Karp, Reducibility Among Combinatorial Problems, 1972",
        ],
        workedExample:
            "For [1, 5, 11, 5] the total is 22 and the target is 11. The subset {11} reaches 11, so the remaining values {1, 5, 5} also sum to 11 and an equal partition exists.",
    },
    id: "partition-equal-subset-sum",
    name: "Equal Subset Partition",
    category: "dynamic-programming",
    complexity: { time: "O(n * total)", space: "O(n * total)" },
    defaultInput: { values: [1, 5, 11, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "sum all values and set target to half the total",
        "if the total is odd, an equal split is impossible",
        "let dp[i][s] mean a subset of the first i values sums to s",
        "set dp[0][0] true and all other entries false",
        "for each value: copy old sums and add the value to them",
        "after the last row, check whether the target is reachable",
        "done: report whether an equal partition exists",
    ],
};

export default module;
