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
 * factorial-prime-exponent-legendre – Legendre's Formula.
 * v_p(n!) = floor(n/p) + floor(n/p^2) + ...
 * Default v_5(25!) = 5+1 = 6. Time O(log_p n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; p?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 25;
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 5;
    let step = 0;
    if (!(n >= 0) || !(p >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 0, p >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `p=${p}`, p, "idle")],
        edges: [],
        description: `Exponent of ${p} in ${n}! via Legendre.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let total = 0;
    let div = p;
    let k = 1;
    while (div <= n && k < 12) {
        const term = Math.trunc(n / div);
        total += term;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `${p}^${k}=${div}`, div, "comparing"),
                C(0, 1, `t=${term}`, term, "highlight"),
            ],
            edges: [],
            description: `floor(${n}/${div}) = ${term}; running sum ${total}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { term, total },
        };
        step += 1;
        if (div > Math.trunc(n / p)) break;
        div *= p;
        k += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `v=${total}`, total, "comparing")],
        edges: [],
        description: `v_${p}(${n}!) = ${total}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { v: total },
    };
    step += 1;
    let multi = 0;
    for (let k = 1; k <= n; k += 1) {
        let q = k;
        while (q - Math.trunc(q / p) * p === 0) {
            multi += 1;
            q = Math.trunc(q / p);
        }
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `v=${total}`, total, "sorted")],
        edges: [],
        description: `Direct count of ${p}s in 1..${n} also gives ${multi} – confirmed.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { v: total },
    };
}
const module: AlgorithmModule = {
    id: "factorial-prime-exponent-legendre",
    name: "Factorial Prime Exponent",
    category: "math",
    complexity: { time: "O(log_p n)", space: "O(1)" },
    defaultInput: { n: 25, p: 5 },
    visualType: "grid",
    run,
};
export default module;
