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
 * polynomial-long-division – Polynomial Long Division.
 * Cancels the leading term each step, quotient grows, rest shrinks.
 * Default (x^3+2x^2+3x+4)/(x+1): quotient x^2+x+2, remainder 2.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { dividend?: number[]; divisor?: number[] } | null) ?? {};
    const dvd = Array.isArray(t.dividend) ? [...(t.dividend as number[])] : [1, 2, 3, 4];
    const dvs = Array.isArray(t.divisor) ? [...(t.divisor as number[])] : [1, 1];
    let step = 0;
    if (dvd.length === 0 || dvs.length === 0 || dvs[0] === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate division (empty or zero leading divisor).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const row = (arr: number[], r: number, hot: number): VisualEntity[] =>
        arr.map((v, i) => C(r, i, `${v}`, v, i === hot ? "comparing" : "idle"));
    yield {
        stepNumber: step,
        entities: [...row(dvd, 0, -1), ...row(dvs, 1, -1)],
        edges: [],
        description: `Divide [${dvd}] by [${dvs}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const rem = [...dvd];
    const quot: number[] = [];
    const lead = dvs[0] as number;
    while (rem.length >= dvs.length && rem.length > 0) {
        const c = Math.trunc((rem[0] as number) / lead);
        const pos = quot.length;
        quot.push(c);
        for (let i = 0; i < dvs.length; i += 1)
            rem[i] = (rem[i] as number) - c * (dvs[i] as number);
        while (rem.length > 0 && rem[0] === 0) rem.shift();
        yield {
            stepNumber: step,
            entities: [...row(quot, 0, pos), ...row(rem.length > 0 ? rem : [0], 1, 0)],
            edges: [],
            description: `Term ${c}: quotient [${quot}], rest [${rem.length > 0 ? rem : [0]}].`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { quot: [...quot] },
        };
        step += 1;
        if (step > 12) break;
    }
    const r0 = rem.length > 0 ? (rem[0] as number) : 0;
    yield {
        stepNumber: step,
        entities: [...row(quot, 0, -1), C(1, 0, `r=${r0}`, r0, "sorted")],
        edges: [],
        description: `Quotient [${quot}], remainder ${r0}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { quot, rem: r0 },
    };
}
const module: AlgorithmModule = {
    id: "polynomial-long-division",
    name: "Polynomial Long Division",
    category: "math",
    complexity: { time: "O(n*m)", space: "O(n)" },
    defaultInput: { dividend: [1, 2, 3, 4], divisor: [1, 1] },
    visualType: "grid",
    run,
};
export default module;
