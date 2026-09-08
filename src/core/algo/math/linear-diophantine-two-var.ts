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
 * linear-diophantine-two-var – Solve a*x + b*y = c.
 * Extended Euclid gives one solution; shifts give them all.
 * Default 6x+9y = 30: (2,2), general (2+3t, 2-2t). Time O(log).
 */
function egcd(a: number, b: number): [number, number, number] {
    if (b === 0) return [a, 1, 0];
    const [g, x1, y1] = egcd(b, a - Math.trunc(a / b) * b);
    return [g, y1, x1 - Math.trunc(a / b) * y1];
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number; c?: number } | null) ?? {};
    const a = typeof t.a === "number" ? Math.trunc(t.a) : 6;
    const b = typeof t.b === "number" ? Math.trunc(t.b) : 9;
    const c = typeof t.c === "number" ? Math.trunc(t.c) : 30;
    let step = 0;
    if (a === 0 && b === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (a and b both zero).`,
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
            C(0, 2, `c=${c}`, c, "idle"),
        ],
        edges: [],
        description: `Solve ${a}x + ${b}y = ${c}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const [g, xg, yg] = egcd(Math.abs(a), Math.abs(b));
    yield {
        stepNumber: step,
        entities: [C(0, 0, `g=${g}`, g, "highlight")],
        edges: [],
        description: `gcd(${a}, ${b}) = ${g} via Euclid.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { g },
    };
    step += 1;
    if (((c % g) + g) % g !== 0) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `g=${g}`, g, "swapped")],
            edges: [],
            description: `${g} does not divide ${c} – no integer solution.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { solutions: false },
        };
        return;
    }
    const sx = (a < 0 ? -xg : xg) * Math.trunc(c / g);
    const sy = (b < 0 ? -yg : yg) * Math.trunc(c / g);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x=${sx}`, sx, "comparing"), C(0, 1, `y=${sy}`, sy, "comparing")],
        edges: [],
        description: `Particular solution (${sx}, ${sy}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {},
    };
    step += 1;
    // ponytail: shift to the smallest non-negative x for a tidy demo point
    const dx = Math.trunc(b / g),
        dy = Math.trunc(a / g);
    let px = sx,
        py = sy;
    for (let guard = 0; guard < 20 && px < 0; guard += 1) {
        px += dx;
        py -= dy;
    }
    for (let guard = 0; guard < 20 && px - dx >= 0; guard += 1) {
        px -= dx;
        py += dy;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x=${px}`, px, "highlight"), C(0, 1, `y=${py}`, py, "highlight")],
        edges: [],
        description: `Shifted tidy solution (${px}, ${py}); general +(${dx}, -${dy})t.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const ok = a * px + b * py === c;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `x=${px}`, px, ok ? "sorted" : "swapped"),
            C(0, 1, `y=${py}`, py, ok ? "sorted" : "swapped"),
        ],
        edges: [],
        description: ok
            ? `Check ${a}x${px}+${b}x${py} = ${c} – verified.`
            : `Check failed – stopping honestly.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ok },
    };
}
const module: AlgorithmModule = {
    id: "linear-diophantine-two-var",
    name: "Linear Diophantine (2 vars)",
    category: "math",
    complexity: { time: "O(log min(a, b))", space: "O(1)" },
    defaultInput: { a: 6, b: 9, c: 30 },
    visualType: "grid",
    run,
};
export default module;
