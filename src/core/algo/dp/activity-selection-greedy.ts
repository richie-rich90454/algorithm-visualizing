/**
 * activity-selection-greedy.ts - Activity Selection (Greedy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: for each activity i in finish order: check start[i] >= lastFinish.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
 *   Space: O(n)
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: count },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Activity selection chooses the largest set of non-overlapping activities from a list of start and finish times. Sorting by finish time and always taking the next activity that starts after the last chosen one finishes yields an optimal set. The earliest-finishing choice leaves the most room for everything that follows.",
        "invariants": [
            "The last chosen finish time never decreases.",
            "Every selected activity starts at or after that finish time, so no two selected activities overlap.",
            "After processing a prefix, no feasible solution uses fewer activities than the greedy count for that prefix."
        ],
        "correctness": "Consider the activity with the earliest finish time; any optimal solution can be modified to include it by swapping in that activity without reducing the count. Once it is chosen, the problem reduces to activities starting after its finish time, and the same argument applies recursively. Therefore the greedy sequence is optimal by induction.",
        "complexityRationale": "Sorting the activities by finish time costs O(n log n), and the single compatibility scan is O(n), so time is O(n log n). Storing the sorted list and the selected set uses O(n) space.",
        "uses": [
            "Scheduling talks or meetings in one room",
            "Selecting non-overlapping tasks on a single machine",
            "A canonical example of greedy exchange arguments"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 16.1",
            "Kleinberg and Tardos, Algorithm Design, Chapter 4"
        ],
        "workedExample": "For intervals [1,3], [2,4], [3,5] sorted by finish time, take [1,3] first. [2,4] overlaps, so skip it; [3,5] starts at 3 and is taken. The optimal set has two activities."
    },
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
    pseudocode: [
        "sort activities by finish time, set lastFinish <- -1",
        "selected <- empty set, count <- 0",
        "for each activity i in finish order: check start[i] >= lastFinish",
        "if compatible: take it, lastFinish <- finish[i], count += 1",
        "else skip it as overlapping the last selected activity",
        "continue until all activities are classified take or skip",
        "answer <- count with selected set reconstructed from takes",
    ],
};

export default module;
