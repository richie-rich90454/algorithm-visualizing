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
 * binary-gcd-stein – Stein's Binary GCD.
 * Strips common powers of two, then odd subtract-and-halve.
 * Default gcd(48, 36) = 12. Time O(log max(a,b)), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number } | null) ?? {};
    let a = typeof t.a === "number" ? Math.trunc(t.a) : 48;
    let b = typeof t.b === "number" ? Math.trunc(t.b) : 36;
    let step = 0;
    if (!(a >= 0) || !(b >= 0) || (a === 0 && b === 0)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate – need non-negative inputs, not both zero.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    if (a === 0 || b === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `gcd=${a + b}`, a + b, "sorted")],
            edges: [],
            description: `One input is zero – gcd is ${a + b}.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { gcd: a + b },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${a}`, a, "idle"), C(0, 1, `b=${b}`, b, "idle")],
        edges: [],
        description: `Binary gcd(${a}, ${b}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let shift = 0;
    while (a % 2 === 0 && b % 2 === 0) {
        a = Math.trunc(a / 2);
        b = Math.trunc(b / 2);
        shift += 1;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `a=${a}`, a, "comparing"),
            C(0, 1, `b=${b}`, b, "comparing"),
            C(0, 2, `2^${shift}`, 2 ** shift, "highlight"),
        ],
        edges: [],
        description: `Stripped 2^${shift}: now (${a}, ${b}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { shift },
    };
    step += 1;
    for (let guard = 0; guard < 20; guard += 1) {
        if (a === 0) break;
        while (a % 2 === 0) a = Math.trunc(a / 2);
        if (a > b) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        b = b - a;
        if (guard < 3) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `a=${a}`, a, "comparing"), C(0, 1, `b=${b}`, b, "comparing")],
                edges: [],
                description: `Odd step ${guard + 1}: (${a}, ${b}).`,
                codeLineNumber: 2,
                layout: "grid",
                meta: {},
            };
            step += 1;
        }
    }
    const rest = a === 0 ? b : a;
    const gcd = rest * 2 ** shift;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `gcd=${gcd}`, gcd, "sorted")],
        edges: [],
        description: `gcd = ${rest} x 2^${shift} = ${gcd}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { gcd },
    };
}
const module: AlgorithmModule = {
    id: "binary-gcd-stein",
    name: "Binary GCD (Stein)",
    category: "math",
    complexity: { time: "O(log max(a, b))", space: "O(1)" },
    defaultInput: { a: 48, b: 36 },
    visualType: "grid",
    run,
};
export default module;
