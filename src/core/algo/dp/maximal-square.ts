/**
 * maximal-square.ts - Maximal Square
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i][j] <- 0 on zero else 1 + min(top, left, diagonal).
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
    const task = (input as { matrix?: string[][] } | null) ?? {};
    const matrix = task.matrix ?? [
        ["1", "1", "0"],
        ["1", "1", "1"],
        ["0", "1", "1"],
    ];
    let step = 0;
    if (matrix.length === 0 || (matrix[0] ?? []).length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty matrix \u2013 area 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const m = matrix.length;
    const cols = (matrix[0] ?? []).length;
    const dp: number[][] = Array.from({ length: m }, () => new Array<number>(cols).fill(0));
    let side = 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Largest all-'1' square in ${m}x${cols}. Side dp starts at 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, cols },
    };
    step += 1;
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            if ((matrix[i]?.[j] ?? "0") === "1") {
                dp[i][j] =
                    i === 0 || j === 0
                        ? 1
                        : 1 +
                          Math.min(
                              dp[i - 1]?.[j] ?? 0,
                              dp[i]?.[j - 1] ?? 0,
                              dp[i - 1]?.[j - 1] ?? 0,
                          );
                if ((dp[i]?.[j] ?? 0) > side) side = dp[i]?.[j] ?? side;
            }
        }
        const states = new Map<string, EntityState>([[`${i},${cols - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Row ${i} done; best side ${side}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, cols },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Traceback: max side ${side}, area ${side * side}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: side * side },
    };
}

const module: AlgorithmModule = {
    id: "maximal-square",
    name: "Maximal Square",
    category: "dynamic-programming",
    complexity: { time: "O(m\u00b7n)", space: "O(m\u00b7n)" },
    defaultInput: {
        matrix: [
            ["1", "1", "0"],
            ["1", "1", "1"],
            ["0", "1", "1"],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp table with zeros for side lengths",
        "dp[i][j] holds largest square side ending at (i, j)",
        "dp[i][j] <- 0 on zero else 1 + min(top, left, diagonal)",
        "fill rows top to bottom and columns left to right",
        "each one-cell extends the smallest neighboring square",
        "track best side seen across the whole matrix",
        "answer <- best side with area side*side and bounds located",
    ],};

export default module;
