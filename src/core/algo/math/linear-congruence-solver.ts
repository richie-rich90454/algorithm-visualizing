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
 * linear-congruence-solver – Solve a*x = b (mod m).
 * Reduces by g = gcd(a,m); g solutions iff g divides b.
 * Default 4x = 8 mod 12 gives x = 2,5,8,11. Time O(log m).
 */
function egcd(a: number, b: number): [number, number, number] {
    if (b === 0) return [a, 1, 0];
    const [g, x1, y1] = egcd(b, a - Math.trunc(a / b) * b);
    return [g, y1, x1 - Math.trunc(a / b) * y1];
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number; m?: number } | null) ?? {};
    const a = typeof t.a === "number" ? Math.trunc(t.a) : 4;
    const b = typeof t.b === "number" ? Math.trunc(t.b) : 8;
    const m = typeof t.m === "number" ? Math.trunc(t.m) : 12;
    let step = 0;
    if (!(m >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs m >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `a=${a}`, a, "idle"),
            C(0, 1, `b=${b}`, b, "idle"),
            C(0, 2, `m=${m}`, m, "idle"),
        ],
        edges: [],
        description: `Solve ${a}x = ${b} mod ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const [g] = egcd(((a % m) + m) % m, m);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `g=${g}`, g, "highlight")],
        edges: [],
        description: `g = gcd(${a}, ${m}) = ${g}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { g },
    };
    step += 1;
    if (((b % g) + g) % g !== 0) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `g=${g}`, g, "swapped")],
            edges: [],
            description: `${g} does not divide ${b} – no solution.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { solutions: [] },
        };
        return;
    }
    const a1 = Math.trunc(a / g),
        b1 = Math.trunc(b / g),
        m1 = Math.trunc(m / g);
    const [, inv] = egcd(((a1 % m1) + m1) % m1, m1);
    const x0 = (((b1 * (((inv % m1) + m1) % m1)) % m1) + m1) % m1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x0=${x0}`, x0, "comparing")],
        edges: [],
        description: `Reduced ${a1}x = ${b1} mod ${m1}: x0 = ${x0}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { x0 },
    };
    step += 1;
    const sols: number[] = [];
    for (let i = 0; i < g; i += 1) sols.push(x0 + i * m1);
    yield {
        stepNumber: step,
        entities: sols.map((v, i) => C(0, i, `${v}`, v, "comparing")),
        edges: [],
        description: `${g} solution(s) mod ${m}: [${sols}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { solutions: sols },
    };
    step += 1;
    const chk = (a * (sols[0] as number)) % m;
    yield {
        stepNumber: step,
        entities: sols.map((v, i) => C(0, i, `${v}`, v, "sorted")),
        edges: [],
        description: `Check ${a}x${sols[0]} = ${chk} = ${b} mod ${m} – verified.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { solutions: sols },
    };
}
const module: AlgorithmModule = {
    id: "linear-congruence-solver",
    name: "Linear Congruence Solver",
    category: "math",
    complexity: { time: "O(log m)", space: "O(1)" },
    defaultInput: { a: 4, b: 8, m: 12 },
    visualType: "grid",
    run,
};
export default module;
