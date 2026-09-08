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
 * integer-sqrt-newton – Newton's Integer Square Root.
 * Halves via x = (x + n/x)/2 until stable, floors honestly.
 * Default isqrt(50) = 7. Time O(log n), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 50;
    let step = 0;
    if (!(n >= 0)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 0).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    if (n < 2) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `${n}`, n, "sorted")],
            edges: [],
            description: `isqrt(${n}) = ${n} trivially.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { root: n },
        };
        return;
    }
    let x = Math.trunc(n / 2) || 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `x0=${x}`, x, "highlight")],
        edges: [],
        description: `Newton for sqrt(${n}) from x0 = ${x}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (let guard = 0; guard < 10; guard += 1) {
        const nx = Math.trunc((x + Math.trunc(n / x)) / 2);
        yield {
            stepNumber: step,
            entities: [C(0, 0, `${x}`, x, "comparing"), C(0, 1, `${nx}`, nx, "highlight")],
            edges: [],
            description: `x -> (${x} + ${Math.trunc(n / x)})/2 = ${nx}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { x: nx },
        };
        step += 1;
        if (nx >= x) {
            x = nx;
            break;
        }
        x = nx;
    }
    while ((x + 1) * (x + 1) <= n) x += 1;
    while (x * x > n) x -= 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${x}`, x, "sorted")],
        edges: [],
        description: `isqrt(${n}) = ${x}: ${x}^2 = ${x * x} <= ${n} < ${(x + 1) * (x + 1)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { root: x },
    };
}
const module: AlgorithmModule = {
    id: "integer-sqrt-newton",
    name: "Integer Square Root (Newton)",
    category: "math",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { n: 50 },
    visualType: "grid",
    run,
};
export default module;
