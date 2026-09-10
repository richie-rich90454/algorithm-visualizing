/**
 * Broken-profile (plug) DP: domino tilings of an MxN board via column masks.
 * Time O(N*2^M*M), Space O(N*2^M). Default 2x3 -> 3 tilings.
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
    const task = (input as { rows?: number; cols?: number } | null) ?? {};
    const rows = typeof task.rows === "number" ? task.rows : 2;
    const cols = typeof task.cols === "number" ? task.cols : 3;
    let step = 0;
    if (rows <= 0 || cols <= 0 || rows > 4) {
        yield {
            stepNumber: step,
            entities: makeCells([[rows <= 0 || cols <= 0 ? 0 : 1]]),
            edges: [],
            description:
                rows <= 0 || cols <= 0
                    ? "Empty board \u2013 1 empty tiling."
                    : "Board too tall for this demo.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const S = 1 << rows;
    const dp: number[][] = Array.from({ length: cols + 1 }, () => new Array<number>(S).fill(0));
    dp[0][0] = 1;
    // The grid shows the dp table (cols+1 rows x S mask columns), so the
    // layout dims describe the table; the board size rides along separately.
    const gridMeta = { rows: dp.length, cols: S, boardRows: rows, boardCols: cols };
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Tile ${rows}x${cols} with dominoes. dp[col][mask]: mask = plug overhang.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...gridMeta },
    };
    step += 1;
    for (let c = 0; c < cols; c += 1) {
        for (let mask = 0; mask < S; mask += 1) {
            const ways = dp[c]?.[mask] ?? 0;
            if (ways === 0) continue;
            const dfs = (r: number, cur: number, next: number): void => {
                if (r === rows) {
                    const row = dp[c + 1];
                    if (row && row[next] !== undefined) row[next] += ways;
                    return;
                }
                if ((cur & (1 << r)) !== 0) {
                    dfs(r + 1, cur, next);
                    return;
                }
                if (r + 1 < rows && (cur & (1 << (r + 1))) === 0)
                    dfs(r + 2, cur | (1 << r) | (1 << (r + 1)), next);
                dfs(r + 1, cur | (1 << r), next | (1 << r));
            };
            dfs(0, mask, 0);
        }
        const states = new Map<string, EntityState>([[`${c + 1},0`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Column ${c} closed: dp[${c + 1}][0] = ${dp[c + 1]?.[0]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...gridMeta },
        };
        step += 1;
    }
    const answer = dp[cols]?.[0] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`${cols},0`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} domino tilings of ${rows}x${cols}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...gridMeta, answer },
    };
}

const module: AlgorithmModule = {
    id: "profile-plug-dp-broken-profile",
    name: "Broken Profile (Plug DP)",
    category: "dynamic-programming",
    complexity: { time: "O(N\u00b72^M\u00b7M)", space: "O(N\u00b72^M)" },
    defaultInput: { rows: 2, cols: 3 },
    visualType: "grid",
    run,
};

export default module;
