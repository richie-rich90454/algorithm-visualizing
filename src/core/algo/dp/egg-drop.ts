/**
 * egg-drop.ts - Egg Drop
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: F(e, m) <- F(e-1, m-1) + F(e, m-1) + 1.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(eggs\u00b7moves)
 *   Space: O(eggs)
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
    const task = (input as { eggs?: number; floors?: number } | null) ?? {};
    const eggs = typeof task.eggs === "number" ? task.eggs : 2;
    const floors = typeof task.floors === "number" ? task.floors : 10;
    let step = 0;
    if (eggs <= 0 || floors <= 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 no eggs or no floors.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    let dp: number[] = new Array<number>(eggs + 1).fill(0);
    const rows: number[][] = [[...dp]];
    yield {
        stepNumber: step,
        entities: makeCells(rows),
        edges: [],
        description: `${eggs} eggs, ${floors} floors. F(e,0) = 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { eggs, floors },
    };
    step += 1;
    let moves = 0;
    while ((dp[eggs] ?? 0) < floors && moves <= floors) {
        moves += 1;
        const next = new Array<number>(eggs + 1).fill(0);
        for (let e = 1; e <= eggs; e += 1) next[e] = (dp[e - 1] ?? 0) + (dp[e] ?? 0) + 1;
        dp = next;
        rows.push([...dp]);
        const states = new Map<string, EntityState>([[`${rows.length - 1},${eggs}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(rows, states),
            edges: [],
            description: `m=${moves}: F(${eggs},${moves}) = ${dp[eggs]} floors covered.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { eggs, floors },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(rows, new Map([[`${rows.length - 1},${eggs}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${moves} moves cover ${dp[eggs]} floors \u2265 ${floors} \u2013 answer ${moves}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: moves },
    };
}

const module: AlgorithmModule = {
    id: "egg-drop",
    name: "Egg Drop",
    category: "dynamic-programming",
    complexity: { time: "O(eggs\u00b7moves)", space: "O(eggs)" },
    defaultInput: { eggs: 2, floors: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[e] <- floors covered with e eggs and m moves",
        "base F(e, 0) <- 0 with zero moves covering nothing",
        "F(e, m) <- F(e-1, m-1) + F(e, m-1) + 1",
        "increase moves m until coverage reaches floors target",
        "each move splits into break versus survive subcases",
        "accumulate coverage across egg counts per move round",
        "answer <- smallest m with F(eggs, m) >= floors target",
    ],
};

export default module;
