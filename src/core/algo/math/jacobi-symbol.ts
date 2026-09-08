import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * jacobi-symbol – Jacobi Symbol (a|n).
 * Quadratic-reciprocity reduction, no factoring needed.
 * Default (10|21) = -1. Time O(log a log n), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; n?: number } | null) ?? {};
    let x = typeof t.a === "number" ? Math.trunc(t.a) : 10;
    let y = typeof t.n === "number" ? Math.trunc(t.n) : 21;
    let step = 0;
    if (!(y >= 3) || y % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs odd n >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    x = ((x % y) + y) % y;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${x}`, x, "idle"), C(0, 1, `n=${y}`, y, "idle")],
        edges: [],
        description: `Compute (${x}|${y}) by reciprocity.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let s = 1;
    for (let guard = 0; guard < 20 && x !== 0; guard += 1) {
        while (x % 2 === 0) {
            x = Math.trunc(x / 2);
            const r = y % 8;
            if (r === 3 || r === 5) s = -s;
            if (guard === 0) {
                yield {
                    stepNumber: step,
                    entities: [
                        C(0, 0, `a=${x}`, x, "comparing"),
                        C(0, 1, `s=${s}`, s, "highlight"),
                    ],
                    edges: [],
                    description: `Factor out 2: n mod 8 = ${r}, sign now ${s}.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: { s },
                };
                step += 1;
            }
        }
        const tmp = x;
        x = y;
        y = tmp;
        if (x % 4 === 3 && y % 4 === 3) s = -s;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `a=${x}`, x, "comparing"),
                C(0, 1, `n=${y}`, y, "comparing"),
                C(0, 2, `s=${s}`, s, "highlight"),
            ],
            edges: [],
            description: `Reciprocity flip: sign ${s}, reduce ${x} mod ${y}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { s },
        };
        step += 1;
        x = x % y;
        if (step > 10) break;
    }
    const out = y === 1 ? s : 0;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${out}`, out, "sorted")],
        edges: [],
        description: `Jacobi symbol = ${out}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { jacobi: out },
    };
}
const module: AlgorithmModule = {
    id: "jacobi-symbol",
    name: "Jacobi Symbol",
    category: "math",
    complexity: { time: "O(log a log n)", space: "O(1)" },
    defaultInput: { a: 10, n: 21 },
    visualType: "grid",
    run,
};
export default module;
