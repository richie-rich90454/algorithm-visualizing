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
 * fermat-factorization – Fermat's Difference of Squares.
 * Finds a with a*a - n a perfect square; factors are a-b, a+b.
 * Default 77 = 7 x 11 (a=9, b=2). Time O(sqrt n), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 77;
    let step = 0;
    if (!(n >= 3) || n % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `n=${n}?`, n, "highlight")],
            edges: [],
            description: `${n} is degenerate for Fermat (needs odd n >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const a0 = Math.ceil(Math.sqrt(n));
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle")],
        edges: [],
        description: `Factor odd ${n} as a difference of squares.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `a0=${a0}`, a0, "highlight")],
        edges: [],
        description: `Start at a = ceil(sqrt(${n})) = ${a0}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let a = a0;
    for (let guard = 0; guard < 50; guard += 1) {
        const b2 = a * a - n;
        const b = Math.round(Math.sqrt(b2));
        if (b * b === b2 && b !== 0) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `n=${n}`, n, "idle"),
                    C(1, 0, `a=${a}`, a, "comparing"),
                    C(1, 1, `b2=${b2}`, b2, "comparing"),
                ],
                edges: [],
                description: `${a}^2 - ${n} = ${b2}; sqrt is exactly ${b}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { a, b },
            };
            step += 1;
            const f1 = a - b,
                f2 = a + b;
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `n=${n}`, n, "idle"),
                    C(1, 0, `${f1}`, f1, "sorted"),
                    C(1, 1, `${f2}`, f2, "sorted"),
                ],
                edges: [],
                description: `Factors ${a}-${b} = ${f1}, ${a}+${b} = ${f2}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { factors: [f1, f2] },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: [C(0, 0, `${f1}`, f1, "sorted"), C(0, 1, `${f2}`, f2, "sorted")],
                edges: [],
                description: `Verify ${f1} x ${f2} = ${f1 * f2}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { factors: [f1, f2] },
            };
            return;
        }
        if (guard < 2) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `n=${n}`, n, "idle"),
                    C(1, 0, `a=${a}`, a, "comparing"),
                    C(1, 1, `${b2}`, b2, "idle"),
                ],
                edges: [],
                description: `${a}^2 - ${n} = ${b2}, not a square – try a+1.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { a },
            };
            step += 1;
        }
        a += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "highlight")],
        edges: [],
        description: `No square within cap – stopping honestly.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {},
    };
}
const module: AlgorithmModule = {
    id: "fermat-factorization",
    name: "Fermat Factorization",
    category: "math",
    complexity: { time: "O(sqrt(n))", space: "O(1)" },
    defaultInput: { n: 77 },
    visualType: "grid",
    run,
};
export default module;
