/**
 * min-path-sum-grid.ts - Min Path Sum (Grid)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i][j] <- grid[i][j] + min(dp[i-1][j], dp[i][j-1]).
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m\u00b7n)
 *   Space: O(m\u00b7n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Minimum path sum finds the route from the top-left to bottom-right of a grid with the smallest total cell cost, moving only right or down. Each cell stores its own cost plus the cheaper of the top and left accumulated costs. Filling in row-major order makes both predecessors available when a cell is computed.",
        "invariants": [
            "dp[i][j] is the minimum sum of any path reaching (i,j).",
            "The start cell holds just its own value.",
            "The first row and column have only one possible incoming direction."
        ],
        "correctness": "Any path to a cell arrives from above or from the left, so the minimum of those two accumulated sums plus the cell cost is optimal. Induction over row-major order ensures predecessors are final. Therefore dp at the destination is the minimum path sum, and parent pointers recover a path.",
        "complexityRationale": "Each of the m*n cells does constant work, so time is O(m*n). The table uses O(m*n) space, reducible to O(n) with one row.",
        "uses": [
            "Least-cost routing through a weighted grid",
            "Image seam carving and terrain path planning",
            "A gateway two-dimensional DP example"
        ],
        "references": [
            "LeetCode problem 64, Minimum Path Sum",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For grid [[1,3,1],[1,5,1],[4,2,1]] the cheapest path goes along the top row then down the last column, with values 1, 3, 1, 1, 1 totaling 7. The DP reports 7 at the bottom-right cell."
    },
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
    pseudocode: [
        "set up dp with dp[0][0] <- grid[0][0] as start",
        "dp[i][j] holds min path sum reaching cell (i, j)",
        "dp[i][j] <- grid[i][j] + min(dp[i-1][j], dp[i][j-1])",
        "fill first row and column then interior in order",
        "edges propagate straight-line sums from the start",
        "interior cells pick the cheaper of top or left entry",
        "answer <- dp[m-1][cols-1] with path backtraced via mins",
    ],
};

export default module;
