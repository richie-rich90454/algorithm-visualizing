/**
 * Dungeon Game (reverse): need[i][j] = max(1, min(need[i+1][j], need[i][j+1]) - d[i][j]).
 * Time O(m*n), Space O(m*n). Default answer: 7 HP.
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
            meta: {},
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
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
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
};

export default module;
