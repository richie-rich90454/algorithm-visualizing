/**
 * profile-plug-dp-broken-profile.ts - Broken Profile (Plug DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[col][next] <- sum over valid fillings from (col, mask).
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N\u00b72^M\u00b7M)
 *   Space: O(N\u00b72^M)
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...gridMeta, answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Broken profile, or plug DP, counts tilings by sweeping cell by cell and remembering only the boundary between processed and unprocessed cells. That boundary is encoded as a bitmask of plugs indicating which neighboring cells still need filling. Transitions place a tile in one of the valid local patterns and update the mask, keeping the state space to O(2^width).",
        "invariants": [
            "dp[col][mask] counts partial tilings whose overhang into the next column is mask.",
            "Every transition fills one cell using a locally valid tile placement.",
            "A complete tiling ends with an empty overhang mask."
        ],
        "correctness": "Because tiles only interact across the frontier, the mask is a sufficient statistic for all future choices, so states with the same mask have identical continuation counts. Enumerating the local placements covers every tiling exactly once. Induction over the sweep yields the full tiling count at dp[cols][0].",
        "complexityRationale": "There are O(N) cells and O(2^M) masks, each with O(M) transition work, giving O(N*2^M*M) time and O(N*2^M) space as stated.",
        "uses": [
            "Counting domino and tromino tilings of grids",
            "Hamiltonian path counting on small-width graphs",
            "Connectivity DP with a narrow frontier"
        ],
        "references": [
            "KACTL handbook, Broken Profile DP chapter",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6"
        ],
        "workedExample": "For a 2x3 board the sweep starts with dp[0][0] = 1. Placing vertical or horizontal pieces updates the overhang mask column by column, and dp[3][0] ends as 3, the number of domino tilings of a 2x3 rectangle."
    },
    id: "profile-plug-dp-broken-profile",
    name: "Broken Profile (Plug DP)",
    category: "dynamic-programming",
    complexity: { time: "O(N\u00b72^M\u00b7M)", space: "O(N\u00b72^M)" },
    defaultInput: { rows: 2, cols: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[col][mask] <- 0 with dp[0][0] <- 1",
        "mask holds plug overhang into the next column",
        "dp[col][next] <- sum over valid fillings from (col, mask)",
        "process columns left to right expanding plug states",
        "each cell branches on place-right, place-down, or fill",
        "propagate counts into next-column mask configurations",
        "answer <- dp[cols][0] as tilings with empty overhang",
    ],
};

export default module;
