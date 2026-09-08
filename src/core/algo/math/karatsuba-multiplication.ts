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
 * karatsuba-multiplication – Karatsuba Fast Multiply.
 * Splits into halves: z0, z2, z1 = (a1+a0)(b1+b0)-z2-z0.
 * Default 12 x 34 = 408. Time O(n^1.585), space O(log n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number } | null) ?? {};
    const a = typeof t.a === "number" ? Math.trunc(t.a) : 12;
    const b = typeof t.b === "number" ? Math.trunc(t.b) : 34;
    let step = 0;
    if (!(a >= 0) || !(b >= 0)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs non-negative inputs).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const sa = String(a);
    const sb = String(b);
    const m = Math.trunc(Math.min(sa.length, sb.length) / 2) || 1;
    const p10 = 10 ** m;
    const a1 = Math.trunc(a / p10);
    const a0 = a - a1 * p10;
    const b1 = Math.trunc(b / p10);
    const b0 = b - b1 * p10;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${a}`, a, "idle"), C(0, 1, `b=${b}`, b, "idle")],
        edges: [],
        description: `Multiply ${a} x ${b}, split at 10^${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `a1=${a1}`, a1, "comparing"),
            C(0, 1, `a0=${a0}`, a0, "comparing"),
            C(1, 0, `b1=${b1}`, b1, "comparing"),
            C(1, 1, `b0=${b0}`, b0, "comparing"),
        ],
        edges: [],
        description: `Halves (${a1}|${a0}) x (${b1}|${b0}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const z0 = a0 * b0;
    const z2 = a1 * b1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `z0=${z0}`, z0, "comparing"), C(0, 1, `z2=${z2}`, z2, "comparing")],
        edges: [],
        description: `z0 = ${a0}x${b0} = ${z0}; z2 = ${a1}x${b1} = ${z2}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { z0, z2 },
    };
    step += 1;
    const z1 = (a1 + a0) * (b1 + b0) - z2 - z0;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `z1=${z1}`, z1, "comparing")],
        edges: [],
        description: `z1 = (${a1}+${a0})(${b1}+${b0})-${z2}-${z0} = ${z1}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { z1 },
    };
    step += 1;
    const out = z2 * p10 * p10 + z1 * p10 + z0;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${out}`, out, "sorted")],
        edges: [],
        description: `Combine: ${z2}x${p10 * p10} + ${z1}x${p10} + ${z0} = ${out}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { out },
    };
}
const module: AlgorithmModule = {
    id: "karatsuba-multiplication",
    name: "Karatsuba Multiplication",
    category: "math",
    complexity: { time: "O(n^1.585)", space: "O(log n)" },
    defaultInput: { a: 12, b: 34 },
    visualType: "grid",
    run,
};
export default module;
