/**
 * Word Break (count): dp[i] = sum of dp[j] where s[j..i) is a word.
 * Time O(n^2), Space O(n). Default "catsanddog" -> 2 ways.
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
    const task = (input as { s?: string; dict?: string[] } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "catsanddog";
    const dict = task.dict ?? ["cat", "cats", "and", "sand", "dog"];
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[1]]),
            edges: [],
            description: "Empty string \u2013 one (empty) segmentation.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const words = new Set(dict);
    const n = s.length;
    const dp: number[] = new Array<number>(n + 1).fill(0);
    dp[0] = 1;
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]]),
        edges: [],
        description: `Segment "${s}" with [${dict.join(", ")}]. dp[0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        let total = 0;
        let piece = "";
        for (let j = 0; j < i; j += 1) {
            const sub = s.slice(j, i);
            if (words.has(sub)) {
                total += dp[j] ?? 0;
                piece = sub;
            }
        }
        dp[i] = total;
        const states = new Map<string, EntityState>([[`0,${i}`, total > 0 ? "comparing" : "idle"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...dp]], states),
            edges: [],
            description: `dp[${i}] = ${total}${piece ? ` (ends with "${piece}")` : ""}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = dp[n] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]], new Map([[`0,${n}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} segmentation(s) of "${s}".`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "word-break-count",
    name: "Word Break (Count)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { s: "catsanddog", dict: ["cat", "cats", "and", "sand", "dog"] },
    visualType: "grid",
    run,
};

export default module;
