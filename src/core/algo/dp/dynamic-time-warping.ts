/**
 * dynamic-time-warping.ts - Dynamic Time Warping Distance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dynamic time warping measures similarity between two sequences that may
 * differ in length or speed. It builds a cost matrix in which cell (i, j) is
 * the local distance between a[i] and b[j] plus the cheapest cost to reach
 * that cell from a predecessor to the upper, left, or upper-left. The
 * bottom-right cell is the warping distance, and a backtrace gives the
 * alignment path.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) for sequences of length n and m
 *   Space: O(n * m) for the cost matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell shows the accumulated warping cost.
 *   - The cell currently being computed is YELLOW.
 *   - The final alignment path is GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    dp: number[][],
    rows: number,
    cols: number,
    active: [number, number] | null,
    path: Set<string>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const key = `${i},${j}`;
            let state: EntityState = "unvisited";
            if (path.has(key)) {
                state = "sorted";
            } else if (active && active[0] === i && active[1] === j) {
                state = "comparing";
            }
            const value = dp[i]?.[j] ?? 0;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const a = Array.isArray(task.a) ? [...task.a] : [1, 2, 3, 4, 2];
    const b = Array.isArray(task.b) ? [...task.b] : [1, 1, 3, 4];
    const rows = a.length;
    const cols = b.length;

    if (rows === 0 || cols === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: rows === 0 && cols === 0
                ? "Both sequences are empty, so the warping distance is zero."
                : "One sequence is empty, so no warping path exists.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows, cols, distance: 0, empty: true },
        };
        return;
    }

    const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
    dp[0]![0] = Math.abs((a[0] ?? 0) - (b[0] ?? 0));
    for (let i = 1; i < rows; i += 1) {
        dp[i]![0] = (dp[i - 1]?.[0] ?? 0) + Math.abs((a[i] ?? 0) - (b[0] ?? 0));
    }
    for (let j = 1; j < cols; j += 1) {
        dp[0]![j] = (dp[0]?.[j - 1] ?? 0) + Math.abs((a[0] ?? 0) - (b[j] ?? 0));
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, rows, cols, [0, 0], new Set()),
        edges: [],
        description: `Warping "${a.join(",")}" against "${b.join(",")}"; the first row and column are initialized.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, step, cost: dp.flat() },
    };
    step += 1;

    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const local = Math.abs((a[i] ?? 0) - (b[j] ?? 0));
            const best = Math.min(dp[i - 1]?.[j] ?? Infinity, dp[i]?.[j - 1] ?? Infinity, dp[i - 1]?.[j - 1] ?? Infinity);
            dp[i]![j] = local + best;
            yield {
                stepNumber: step,
                entities: makeCells(dp, rows, cols, [i, j], new Set()),
                edges: [],
                description: `dp[${i}][${j}] = |${a[i]} - ${b[j]}| + min(up, left, diagonal) = ${dp[i]?.[j]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols, step, cost: dp.flat() },
            };
            step += 1;
        }
    }

    const pathI: number[] = [];
    const pathJ: number[] = [];
    let i = rows - 1;
    let j = cols - 1;
    while (i > 0 || j > 0) {
        pathI.push(i);
        pathJ.push(j);
        if (i === 0) {
            j -= 1;
        } else if (j === 0) {
            i -= 1;
        } else {
            const up = dp[i - 1]?.[j] ?? Infinity;
            const left = dp[i]?.[j - 1] ?? Infinity;
            const diag = dp[i - 1]?.[j - 1] ?? Infinity;
            if (diag <= up && diag <= left) {
                i -= 1;
                j -= 1;
            } else if (up <= left) {
                i -= 1;
            } else {
                j -= 1;
            }
        }
    }
    pathI.push(0);
    pathJ.push(0);
    pathI.reverse();
    pathJ.reverse();

    const pathSet = new Set<string>();
    for (let k = 0; k < pathI.length; k += 1) {
        pathSet.add(`${pathI[k]},${pathJ[k]}`);
    }
    const distance = dp[rows - 1]?.[cols - 1] ?? 0;

    yield {
        stepNumber: step,
        entities: makeCells(dp, rows, cols, null, pathSet),
        edges: [],
        description: `Warping distance ${distance.toFixed(4)} along a path of ${pathI.length} aligned pairs.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, distance, pathI, pathJ, cost: dp.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two sequences can describe the same shape at different speeds, such as the same spoken word said quickly or slowly. Dynamic time warping stretches or compresses the time axis locally by allowing an index in either sequence to advance while the other waits. A DP matrix records the cheapest accumulated mismatch cost to every pair of positions, and the final cell is the best total alignment.",
        invariants: [
            "Each cell stores the minimum cost of any monotone warping path reaching it.",
            "Every allowed step advances one or both indices by exactly one.",
            "The cost matrix is nondecreasing along every row and column.",
        ],
        correctness:
            "Any warping path reaching (i, j) must arrive from (i-1, j), (i, j-1), or (i-1, j-1), so the recurrence considers every optimal subpath. Filling in increasing index order guarantees those predecessor costs are final when needed. By induction each cell is optimal, so the bottom-right cell is the minimum-cost full alignment, and the backtrace follows one such path.",
        complexityRationale:
            "There are n times m cells, each computed from three predecessors with constant work, giving O(n * m) time. Storing the whole matrix for the backtrace uses O(n * m) space.",
        uses: [
            "Speech recognition and speaker verification",
            "Matching time series such as sensor traces or stock curves",
            "Handwriting and gesture recognition",
        ],
        references: [
            "Berndt and Clifford, Using Dynamic Time Warping to Find Patterns in Time Series, 1994",
            "Keogh and Pazzani, Derivative Dynamic Time Warping, 2001",
        ],
        workedExample:
            "Warping [1, 2, 3] against [1, 1, 3]: the first cell costs 0. Matching the repeated 1 lets the path stay in the first row while b advances, then both advance. The final accumulated cost is the sum of the small local mismatches along that monotone path.",
    },
    id: "dynamic-time-warping",
    name: "Dynamic Time Warping",
    category: "dynamic-programming",
    complexity: { time: "O(n * m)", space: "O(n * m)" },
    defaultInput: { a: [1, 2, 3, 4, 2], b: [1, 1, 3, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "build an n by m cost matrix initialized to zero",
        "set the first row and column from cumulative absolute differences",
        "for each remaining cell compute the local absolute difference",
        "add the minimum of the upper, left, and diagonal cells",
        "store the result as the accumulated warping cost",
        "backtrace from the bottom-right along the cheapest predecessors",
        "done: report the warping distance and alignment path",
    ],
};

export default module;
