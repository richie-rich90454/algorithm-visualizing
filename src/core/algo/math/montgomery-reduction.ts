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
 * montgomery-reduction – Montgomery REDC.
 * Computes T*R^-1 mod m without division: m' = -m^-1 mod R.
 * Default REDC(100) with m=13, R=16 gives 3. Time O(log R).
 */
function egcd(a: number, b: number): [number, number, number] {
    if (b === 0) return [a, 1, 0];
    const [g, x1, y1] = egcd(b, a - Math.trunc(a / b) * b);
    return [g, y1, x1 - Math.trunc(a / b) * y1];
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { m?: number; R?: number; T?: number } | null) ?? {};
    const m = typeof t.m === "number" ? Math.trunc(t.m) : 13;
    const R = typeof t.R === "number" ? Math.trunc(t.R) : 16;
    const T = typeof t.T === "number" ? Math.trunc(t.T) : 100;
    let step = 0;
    if (!(m >= 3) || !(R > m) || (R & (R - 1)) !== 0 || T < 0 || T >= m * R) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs odd m, R a power of two > m, 0 <= T < m*R).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const [, inv] = egcd(m, R);
    const mp = (((R - (((inv % R) + R) % R)) % R) + R) % R;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `m=${m}`, m, "idle"),
            C(0, 1, `R=${R}`, R, "idle"),
            C(0, 2, `T=${T}`, T, "idle"),
        ],
        edges: [],
        description: `REDC(${T}) with m=${m}, R=${R}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `m'=${mp}`, mp, "comparing")],
        edges: [],
        description: `m' = -m^-1 mod R = ${mp}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { mp },
    };
    step += 1;
    const m1 = ((T % R) * mp) % R;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `m1=${m1}`, m1, "comparing")],
        edges: [],
        description: `m1 = (T mod R)*m' mod R = ${m1}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { m1 },
    };
    step += 1;
    const t0 = Math.trunc((T + m1 * m) / R);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `t=${t0}`, t0, "comparing")],
        edges: [],
        description: `t = (T + m1*m)/R = ${t0}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { t0 },
    };
    step += 1;
    const out = t0 >= m ? t0 - m : t0;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `out=${out}`, out, "sorted")],
        edges: [],
        description: out === t0 ? `t < m – result ${out}.` : `t >= m – subtract: result ${out}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { out },
    };
}
const module: AlgorithmModule = {
    id: "montgomery-reduction",
    name: "Montgomery Reduction",
    category: "math",
    complexity: { time: "O(log R)", space: "O(1)" },
    defaultInput: { m: 13, R: 16, T: 100 },
    visualType: "grid",
    run,
};
export default module;
