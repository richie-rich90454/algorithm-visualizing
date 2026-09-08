/**
 * Burst Balloons: dp[l][r] = max over last-burst k of
 * val[l]*val[k+1]*val[r+2] + dp[l][k-1] + dp[k+1][r].
 * Time O(n^3), Space O(n^2). Default [3,1,5,8] -> 167.
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
    const task = (input as { nums?: number[] } | null) ?? {};
    const nums = task.nums ?? [3, 1, 5, 8];
    let step = 0;
    if (nums.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 zero coins.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = nums.length;
    const val = [1, ...nums, 1];
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Burst [${nums.join(", ")}]; padded values [${val.join(", ")}]. dp[l][l] base next.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 1; len <= n; len += 1) {
        let desc = "";
        for (let l = 0; l + len - 1 < n; l += 1) {
            const r = l + len - 1;
            let best = 0;
            let bestK = l;
            for (let k = l; k <= r; k += 1) {
                const left = k > l ? (dp[l]?.[k - 1] ?? 0) : 0;
                const right = k < r ? (dp[k + 1]?.[r] ?? 0) : 0;
                const gain = (val[l] ?? 1) * (val[k + 1] ?? 1) * (val[r + 2] ?? 1);
                const total = gain + left + right;
                if (total > best) {
                    best = total;
                    bestK = k;
                }
            }
            dp[l][r] = best;
            if (l === 0) desc = `dp[0][${r}] = ${best} (last-burst k=${bestK}).`;
        }
        const states = new Map<string, EntityState>([[`0,${len - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Length ${len} intervals filled. ${desc}`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = dp[0]?.[n - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: max coins dp[0][${n - 1}] = ${answer}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "burst-balloons",
    name: "Burst Balloons",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b3)", space: "O(n\u00b2)" },
    defaultInput: { nums: [3, 1, 5, 8] },
    visualType: "grid",
    run,
};

export default module;
