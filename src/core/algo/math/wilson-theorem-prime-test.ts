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
 * wilson-theorem-prime-test – Wilson Primality Check.
 * p prime iff (p-1)! = -1 mod p; builds the factorial live.
 * Default p=7: 720 mod 7 = 6 = -1, prime. Time O(p).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 7;
    let step = 0;
    if (!(p >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs p >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle")],
        edges: [],
        description: `Wilson: p=${p} prime iff ${p - 1}! = ${p - 1} mod ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let f = 1;
    for (let k = 1; k <= p - 1; k += 1) {
        f = (f * k) % p;
        if (k <= 3 || k === p - 1) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `${k}!=${f}`, f, k === p - 1 ? "highlight" : "comparing")],
                edges: [],
                description: `${k}! mod ${p} = ${f}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { k, f },
            };
            step += 1;
        }
    }
    const prime = f === p - 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${f}`, f, prime ? "sorted" : "swapped")],
        edges: [],
        description: prime
            ? `${p - 1}! = ${f} = -1 mod ${p} – PRIME.`
            : `${p - 1}! = ${f} != -1 mod ${p} – composite.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { prime },
    };
}
const module: AlgorithmModule = {
    id: "wilson-theorem-prime-test",
    name: "Wilson Theorem Prime Test",
    category: "math",
    complexity: { time: "O(p)", space: "O(1)" },
    defaultInput: { p: 7 },
    visualType: "grid",
    run,
};
export default module;
