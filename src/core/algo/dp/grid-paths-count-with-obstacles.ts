/**
 * Unique paths with obstacles: dp[i][j] = dp[i-1][j] + dp[i][j-1] (0 on blocks).
 * Time O(m*n), Space O(m*n). Default 3x3 center block -> 2 paths.
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
    const task = (input as { obstacleGrid?: number[][] } | null) ?? {};
    const obs = task.obstacleGrid ?? [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
    ];
    let step = 0;
    if (obs.length === 0 || (obs[0] ?? []).length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty grid \u2013 no paths.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const m = obs.length;
    const cols = (obs[0] ?? []).length;
    const dp: number[][] = Array.from({ length: m }, () => new Array<number>(cols).fill(0));
    if ((obs[0]?.[0] ?? 1) === 0) dp[0][0] = 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Count paths through ${m}x${cols} grid; 1 marks a blocked cell. dp[0][0] = ${dp[0]?.[0]}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, cols },
    };
    step += 1;
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            if (i === 0 && j === 0) continue;
            if ((obs[i]?.[j] ?? 0) === 1) {
                dp[i][j] = 0;
                continue;
            }
            dp[i][j] = (i > 0 ? (dp[i - 1]?.[j] ?? 0) : 0) + (j > 0 ? (dp[i]?.[j - 1] ?? 0) : 0);
        }
        const states = new Map<string, EntityState>([[`${i},${cols - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Row ${i} filled; dp[${i}][${cols - 1}] = ${dp[i]?.[cols - 1]}.`,
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
        description: `Traceback: ${answer} obstacle-avoiding paths to the goal.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "grid-paths-count-with-obstacles",
    name: "Grid Paths with Obstacles",
    category: "dynamic-programming",
    complexity: { time: "O(m\u00b7n)", space: "O(m\u00b7n)" },
    defaultInput: {
        obstacleGrid: [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
