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
 * primitive-root-search – Smallest Primitive Root mod p.
 * Tests g=2,3...; g is root iff g^((p-1)/q) != 1 for all q | p-1.
 * Default p=11 gives root 2. Time O(p log p), space O(1).
 */
function modPow(b: number, e: number, m: number): number {
    let r = 1;
    let x = ((b % m) + m) % m;
    let k = e;
    while (k > 0) {
        if (k % 2 === 1) r = (r * x) % m;
        x = (x * x) % m;
        k = Math.trunc(k / 2);
    }
    return r;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 11;
    let step = 0;
    if (!(p >= 3)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs prime p >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    let phi = p - 1;
    const fac: number[] = [];
    let tmp = phi;
    for (let d = 2; d * d <= tmp; d += 1) {
        if (tmp - Math.trunc(tmp / d) * d === 0) {
            fac.push(d);
            while (tmp - Math.trunc(tmp / d) * d === 0) tmp = Math.trunc(tmp / d);
        }
    }
    if (tmp > 1) fac.push(tmp);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle")],
        edges: [],
        description: `Find the smallest primitive root mod ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `p-1=${phi}`, phi, "idle"),
            ...fac.map((q, i) => C(1, i, `${q}`, q, "idle")),
        ],
        edges: [],
        description: `p-1 = ${phi} = factors [${fac}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (let g = 2; g < p; g += 1) {
        let ok = true;
        let bad = 0;
        for (const q of fac) {
            const v = modPow(g, Math.trunc(phi / q), p);
            if (v === 1) {
                ok = false;
                bad = q;
                break;
            }
            if (g <= 2) {
                yield {
                    stepNumber: step,
                    entities: [C(0, 0, `g=${g}`, g, "comparing"), C(0, 1, `${v}`, v, "highlight")],
                    edges: [],
                    description: `g=${g}: ${g}^${Math.trunc(phi / q)} = ${v} != 1 mod ${p} – passes factor ${q}.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: { g },
                };
                step += 1;
            }
        }
        if (!ok) {
            if (g <= 3) {
                yield {
                    stepNumber: step,
                    entities: [C(0, 0, `g=${g}`, g, "swapped")],
                    edges: [],
                    description: `g=${g} gives 1 for factor ${bad} – not a root.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: { g },
                };
                step += 1;
            }
            continue;
        }
        yield {
            stepNumber: step,
            entities: [C(0, 0, `g=${g}`, g, "sorted")],
            edges: [],
            description: `g=${g} passes all factor tests – smallest primitive root mod ${p}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { root: g },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "highlight")],
        edges: [],
        description: `No root found – stopping honestly.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {},
    };
}
const module: AlgorithmModule = {
    id: "primitive-root-search",
    name: "Primitive Root Search",
    category: "math",
    complexity: { time: "O(p log p)", space: "O(1)" },
    defaultInput: { p: 11 },
    visualType: "grid",
    run,
};
export default module;
