/**
 * Interleaving String: dp[i][j] from s1[i-1] or s2[j-1] matching s3[i+j-1].
 * Time O(n*m), Space O(n*m). Default -> true.
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
    const task = (input as { s1?: string; s2?: string; s3?: string } | null) ?? {};
    const s1 = typeof task.s1 === "string" ? task.s1 : "aabcc";
    const s2 = typeof task.s2 === "string" ? task.s2 : "dbbca";
    const s3 = typeof task.s3 === "string" ? task.s3 : "aadbbcbcac";
    let step = 0;
    if (s1.length + s2.length !== s3.length) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: `Lengths ${s1.length} + ${s2.length} \u2260 ${s3.length} \u2013 cannot interleave.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    if (s1.length === 0 || s2.length === 0) {
        const match = s1 + s2 === s3;
        yield {
            stepNumber: step,
            entities: makeCells([[match ? 1 : 0]]),
            edges: [],
            description: match
                ? "Trivial interleave \u2013 match."
                : "Trivial interleave \u2013 no match.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = s1.length;
    const m = s2.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    dp[0][0] = 1;
    for (let i = 1; i <= n; i += 1)
        dp[i][0] = dp[i - 1]?.[0] === 1 && s1[i - 1] === s3[i - 1] ? 1 : 0;
    for (let j = 1; j <= m; j += 1)
        dp[0][j] = dp[0]?.[j - 1] === 1 && s2[j - 1] === s3[j - 1] ? 1 : 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Is "${s3}" an interleave of "${s1}" + "${s2}"? First row/col seeded.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const k = i + j - 1;
            const fromS1 = dp[i - 1]?.[j] === 1 && s1[i - 1] === s3[k] ? 1 : 0;
            const fromS2 = dp[i]?.[j - 1] === 1 && s2[j - 1] === s3[k] ? 1 : 0;
            dp[i][j] = fromS1 === 1 || fromS2 === 1 ? 1 : 0;
        }
        const states = new Map<string, EntityState>([[`${i},${m}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Row ${i} done; dp[${i}][${m}] = ${dp[i]?.[m] === 1}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, m },
        };
        step += 1;
    }
    const match = (dp[n]?.[m] ?? 0) === 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`${n},${m}`, "sorted"]])),
        edges: [],
        description: match ? `"${s3}" is an interleaving.` : `"${s3}" is not an interleaving.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { match },
    };
}

const module: AlgorithmModule = {
    id: "interleaving-string",
    name: "Interleaving String",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7m)", space: "O(n\u00b7m)" },
    defaultInput: { s1: "aabcc", s2: "dbbca", s3: "aadbbcbcac" },
    visualType: "grid",
    run,
};

export default module;
