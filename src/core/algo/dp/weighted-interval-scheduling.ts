/**
 * Weighted Interval Scheduling: dp[j] = max(dp[j-1], w[j] + dp[p(j)]).
 * Time O(n log n), Space O(n). Default -> optimal weight 10.
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

interface Job {
    s: number;
    e: number;
    w: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { jobs?: Job[] } | null) ?? {};
    const jobs = [
        ...(task.jobs ?? [
            { s: 1, e: 3, w: 5 },
            { s: 2, e: 5, w: 6 },
            { s: 4, e: 6, w: 5 },
        ]),
    ].sort((a, b) => a.e - b.e);
    let step = 0;
    if (jobs.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No jobs \u2013 weight 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = jobs.length;
    const prev: number[] = jobs.map((job, j) => {
        let p = -1;
        for (let k = j - 1; k >= 0; k -= 1) {
            if ((jobs[k]?.e ?? 0) <= job.s) {
                p = k;
                break;
            }
        }
        return p;
    });
    const dp: number[] = new Array<number>(n).fill(0);
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]]),
        edges: [],
        description: `Schedule ${n} jobs by end time; p(j) = last compatible job.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let j = 0; j < n; j += 1) {
        const job = jobs[j] as Job;
        const take =
            job.w +
            (prev[j] !== undefined && (prev[j] as number) >= 0 ? (dp[prev[j] as number] ?? 0) : 0);
        const skip = j > 0 ? (dp[j - 1] ?? 0) : 0;
        dp[j] = Math.max(take, skip);
        const states = new Map<string, EntityState>([[`0,${j}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...dp]], states),
            edges: [],
            description: `Job ${j} [${job.s},${job.e}] w=${job.w}: max(${take} take, ${skip} skip) = ${dp[j]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]], new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: optimal weight = ${dp[n - 1]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: dp[n - 1] },
    };
}

const module: AlgorithmModule = {
    id: "weighted-interval-scheduling",
    name: "Weighted Interval Scheduling",
    category: "dynamic-programming",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        jobs: [
            { s: 1, e: 3, w: 5 },
            { s: 2, e: 5, w: 6 },
            { s: 4, e: 6, w: 5 },
        ],
    },
    visualType: "grid",
    run,
};

export default module;
