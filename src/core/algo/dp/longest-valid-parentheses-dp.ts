/**
 * Longest Valid Parentheses: dp[i] closes at i via dp[i-1] links.
 * Time O(n), Space O(n). Default ")()())" -> 4.
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
    const task = (input as { s?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : ")()())";
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty string \u2013 length 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = s.length;
    const dp: number[] = new Array<number>(n).fill(0);
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]]),
        edges: [],
        description: `Longest valid "(...)" run in "${s}". dp[i] = best run ending at i.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    let best = 0;
    for (let i = 1; i < n; i += 1) {
        if (s[i] === ")") {
            if (s[i - 1] === "(") dp[i] = (i >= 2 ? (dp[i - 2] ?? 0) : 0) + 2;
            else {
                const prev = i - (dp[i - 1] ?? 0) - 1;
                if (prev >= 0 && s[prev] === "(")
                    dp[i] = (dp[i - 1] ?? 0) + 2 + (prev - 1 >= 0 ? (dp[prev - 1] ?? 0) : 0);
            }
        }
        if ((dp[i] ?? 0) > best) best = dp[i] ?? best;
        const states = new Map<string, EntityState>([
            [`0,${i}`, (dp[i] ?? 0) > 0 ? "comparing" : "idle"],
        ]);
        yield {
            stepNumber: step,
            entities: makeCells([[...dp]], states),
            edges: [],
            description: `i=${i} ("${s[i]}"): dp[${i}] = ${dp[i]}; best ${best}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]]),
        edges: [],
        description: `Traceback: longest valid run = ${best}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: best },
    };
}

const module: AlgorithmModule = {
    id: "longest-valid-parentheses-dp",
    name: "Longest Valid Parentheses (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { s: ")()())" },
    visualType: "grid",
    run,
};

export default module;
