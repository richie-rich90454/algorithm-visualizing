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
 * lucas-lehmer-mersenne – Lucas-Lehmer Test for Mersenne Numbers.
 * s=4, s = s*s-2 mod Mp; Mp prime iff s_(p-2) = 0.
 * Default p=5, M31 prime. Time O(p^2 log p), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 5;
    let step = 0;
    if (!(p >= 3)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `p=${p}?`, p, "highlight")],
            edges: [],
            description: `${p} is degenerate (needs prime exponent >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const m = 2 ** p - 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle"), C(0, 1, `M=${m}`, m, "highlight")],
        edges: [],
        description: `M${p} = 2^${p}-1 = ${m}; seed s0 = 4.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m },
    };
    step += 1;
    let s = 4;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `M=${m}`, m, "idle"), C(1, 0, "s0=4", 4, "comparing")],
        edges: [],
        description: `s0 = 4.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (let i = 1; i <= p - 2; i += 1) {
        s = (((s * s - 2) % m) + m) % m;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `M=${m}`, m, "idle"),
                C(1, 0, `s${i}=${s}`, s, i === p - 2 ? "highlight" : "comparing"),
            ],
            edges: [],
            description: `s${i} = s${i - 1}^2 - 2 mod ${m} = ${s}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { i, s },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `M=${m}`, m, s === 0 ? "sorted" : "swapped")],
        edges: [],
        description:
            s === 0
                ? `s${p - 2} = 0 – M${p} = ${m} is PRIME.`
                : `s${p - 2} = ${s} – M${p} = ${m} is composite.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { prime: s === 0 },
    };
}
const module: AlgorithmModule = {
    id: "lucas-lehmer-mersenne",
    name: "Lucas-Lehmer Mersenne Test",
    category: "math",
    complexity: { time: "O(p^2 log p)", space: "O(1)" },
    defaultInput: { p: 5 },
    visualType: "grid",
    run,
};
export default module;
