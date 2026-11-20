/**
 * dungeon-game.ts - Dungeon Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: need[i][j] <- max(1, min(need[i+1][j], need[i][j+1]) - dungeon[i][j]).
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
    const task = (input as { dungeon?: number[][] } | null) ?? {};
    const dungeon = task.dungeon ?? [
        [-2, -3, 3],
        [-5, -10, 1],
        [10, 30, -5],
    ];
    let step = 0;
    if (dungeon.length === 0 || (dungeon[0] ?? []).length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[1]]),
            edges: [],
            description: "Empty dungeon \u2013 1 HP suffices.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const m = dungeon.length;
    const cols = (dungeon[0] ?? []).length;
    const need: number[][] = Array.from({ length: m }, () => new Array<number>(cols).fill(1));
    yield {
        stepNumber: step,
        entities: makeCells(need),
        edges: [],
        description: `Min initial HP on ${m}x${cols} dungeon, computed bottom-up from the princess.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, cols },
    };
    step += 1;
    for (let i = m - 1; i >= 0; i -= 1) {
        for (let j = cols - 1; j >= 0; j -= 1) {
            const d = dungeon[i]?.[j] ?? 0;
            if (i === m - 1 && j === cols - 1) need[i][j] = Math.max(1, 1 - d);
            else {
                const down = i + 1 < m ? (need[i + 1]?.[j] ?? 1) : Number.MAX_SAFE_INTEGER;
                const right = j + 1 < cols ? (need[i]?.[j + 1] ?? 1) : Number.MAX_SAFE_INTEGER;
                need[i][j] = Math.max(1, Math.min(down, right) - d);
            }
        }
        const states = new Map<string, EntityState>([[`${i},0`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(need, states),
            edges: [],
            description: `Row ${i} done; need[${i}][0] = ${need[i]?.[0]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, cols },
        };
        step += 1;
    }
    const answer = need[0]?.[0] ?? 1;
    yield {
        stepNumber: step,
        entities: makeCells(need, new Map([["0,0", "sorted"]])),
        edges: [],
        description: `Traceback: start with ${answer} HP to survive.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Dungeon Game computes the minimum starting health needed to reach the princess in a grid where each cell adds or subtracts health. It works backward from the destination, recording need[i][j] as the health required on entering that cell. At each cell the knight prepares for the cheaper of the right and down exits, clamped to at least one.",
        "invariants": [
            "need[i][j] is the least health with which the knight can survive from (i,j) onward.",
            "The destination needs at least one health on entry.",
            "Every move goes right or down, so backward filling sees finalized successors."
        ],
        "correctness": "From a cell the knight may go right or down, and the successor with the smaller need determines the least required entry health. Subtracting the cell's dungeon value gives the need before the cell, clamped to one. Backward induction from the destination therefore yields need at the start, the minimal initial health.",
        "complexityRationale": "Each of the m*n cells is computed from two neighbors in constant time, giving O(m*n) time. The need table uses O(m*n) space, reducible to O(n) with a single row.",
        "uses": [
            "Resource planning along a path with gains and losses",
            "Game AI computing minimum required stats",
            "Backward induction on grid decision problems"
        ],
        "references": [
            "LeetCode problem 174, Dungeon Game",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For the sample dungeon the princess cell has value -5 and needs 6 on entry. Working backward, need at the start cell with -2 becomes 7, so the knight must start with at least 7 health to reach (2,2) alive."
    },
    id: "dungeon-game",
    name: "Dungeon Game",
    category: "dynamic-programming",
    complexity: { time: "O(m\u00b7n)", space: "O(m\u00b7n)" },
    defaultInput: {
        dungeon: [
            [-2, -3, 3],
            [-5, -10, 1],
            [10, 30, -5],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set up need table sized m x cols with need at princess",
        "need[i][j] holds minimum HP entering cell (i, j)",
        "need[i][j] <- max(1, min(need[i+1][j], need[i][j+1]) - dungeon[i][j])",
        "fill table bottom-up from bottom-right to top-left",
        "each cell prepares for the cheaper of right or down exits",
        "clamp values to at least 1 HP to stay alive",
        "answer <- need[0][0] with path following min-need moves",
    ],
};

export default module;
