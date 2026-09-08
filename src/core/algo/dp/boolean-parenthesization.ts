/**
 * Boolean Parenthesization: T/F tables split at each operator.
 * Time O(n^3), Space O(n^2). Default TFT with |& -> 2 true ways.
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
    const task = (input as { symbols?: string; ops?: string } | null) ?? {};
    const symbols = typeof task.symbols === "string" ? task.symbols : "TFT";
    const ops = typeof task.ops === "string" ? task.ops : "|&";
    let step = 0;
    if (symbols.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No symbols \u2013 zero ways.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = symbols.length;
    const T: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const F: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        if (symbols[i] === "T") T[i][i] = 1;
        else F[i][i] = 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(T),
        edges: [],
        description: `Parenthesize "${symbols}" with ops "${ops}". True-table diagonal seeded.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(F),
        edges: [],
        description: `False-table diagonal seeded from single symbols.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len - 1 < n; i += 1) {
            const j = i + len - 1;
            let t = 0;
            let f = 0;
            for (let k = i; k < j; k += 1) {
                const op = ops[k] ?? "&";
                const tik = T[i]?.[k] ?? 0;
                const fik = F[i]?.[k] ?? 0;
                const tkj = T[k + 1]?.[j] ?? 0;
                const fkj = F[k + 1]?.[j] ?? 0;
                if (op === "|") {
                    t += tik * tkj + tik * fkj + fik * tkj;
                    f += fik * fkj;
                } else if (op === "&") {
                    t += tik * tkj;
                    f += fik * fkj + fik * tkj + tik * fkj;
                } else {
                    t += tik * fkj + fik * tkj;
                    f += tik * tkj + fik * fkj;
                }
            }
            T[i][j] = t;
            F[i][j] = f;
        }
        const states = new Map<string, EntityState>([[`0,${len - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(T, states),
            edges: [],
            description: `Length-${len} spans: T[0][${len - 1}] = ${T[0]?.[len - 1]}, F[0][${len - 1}] = ${F[0]?.[len - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = T[0]?.[n - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(T, new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} parenthesizations evaluate true.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "boolean-parenthesization",
    name: "Boolean Parenthesization",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b3)", space: "O(n\u00b2)" },
    defaultInput: { symbols: "TFT", ops: "|&" },
    visualType: "grid",
    run,
};

export default module;
