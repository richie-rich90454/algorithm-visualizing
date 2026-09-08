/**
 * Activity Selection (greedy): sort by finish, take if start >= last finish.
 * Time O(n log n), Space O(n). Default [[1,3],[2,4],[3,5]] -> 2.
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
    const task = (input as { intervals?: number[][] } | null) ?? {};
    const intervals = [
        ...(task.intervals ?? [
            [1, 3],
            [2, 4],
            [3, 5],
        ]),
    ].sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
    let step = 0;
    if (intervals.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No activities \u2013 select none.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = intervals.length;
    const picked: number[] = new Array<number>(n).fill(0);
    yield {
        stepNumber: step,
        entities: makeCells([[...picked]]),
        edges: [],
        description: `Earliest-finishing order: [${intervals.map((x) => `[${x[0]},${x[1]}]`).join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    let lastFinish = -1;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
        const [s, e] = intervals[i] as [number, number];
        if ((s ?? 0) >= lastFinish) {
            picked[i] = 1;
            lastFinish = e ?? 0;
            count += 1;
        }
        const states = new Map<string, EntityState>([
            [`0,${i}`, picked[i] === 1 ? "sorted" : "comparing"],
        ]);
        yield {
            stepNumber: step,
            entities: makeCells([[...picked]], states),
            edges: [],
            description: `[${s},${e}]: ${picked[i] === 1 ? `take (count ${count})` : `skip (overlaps, last finish ${lastFinish})`}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...picked]]),
        edges: [],
        description: `Traceback: ${count} compatible activities selected.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: count },
    };
}

const module: AlgorithmModule = {
    id: "activity-selection-greedy",
    name: "Activity Selection (Greedy)",
    category: "dynamic-programming",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        intervals: [
            [1, 3],
            [2, 4],
            [3, 5],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
