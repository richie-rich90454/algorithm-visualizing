/**
 * Min Path Sum: dp[i][j] = grid[i][j] + min(dp[i-1][j], dp[i][j-1]).
 * Time O(m*n), Space O(m*n). Default answer: 7.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: number[][] } | null) ?? {};
    const grid = task.grid ?? [
        [1, 3, 1],
        [1, 5, 1],
        [4, 2, 1],
    ];
    let step = 0;
    if (grid.length === 0 || (grid[0] ?? []).length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty grid \u2013 no path.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const m = grid.length;
    const cols = (grid[0] ?? []).length;
    const dp: number[][] = Array.from({ length: m }, () => new Array<number>(cols).fill(0));
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Min-cost path on ${m}x${cols} grid from top-left. dp[0][0] = ${grid[0]?.[0]}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, cols },
    };
    step += 1;
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const g = grid[i]?.[j] ?? 0;
            if (i === 0 && j === 0) dp[i][j] = g;
            else if (i === 0) dp[i][j] = g + (dp[i]?.[j - 1] ?? 0);
            else if (j === 0) dp[i][j] = g + (dp[i - 1]?.[j] ?? 0);
            else dp[i][j] = g + Math.min(dp[i - 1]?.[j] ?? 0, dp[i]?.[j - 1] ?? 0);
        }
        const states = new Map<string, EntityState>([[`${i},${cols - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Row ${i} done; dp[${i}][${cols - 1}] = ${dp[i]?.[cols - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, cols },
        };
        step += 1;
    }
    const answer = dp[m - 1]?.[cols - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`${m - 1},${cols - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: min path sum = ${answer}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "min-path-sum-grid",
    name: "Min Path Sum (Grid)",
    category: "dynamic-programming",
    complexity: { time: "O(m\u00b7n)", space: "O(m\u00b7n)" },
    defaultInput: {
        grid: [
            [1, 3, 1],
            [1, 5, 1],
            [4, 2, 1],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
