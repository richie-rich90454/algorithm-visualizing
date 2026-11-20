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
            meta: { step },
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
        meta: { step },
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

    education: {
        "intuition": "Polynomial long division divides one polynomial by another, producing a quotient and a remainder of smaller degree. At each step the leading term of the remainder is cancelled by subtracting a suitable multiple of the divisor, and that multiple becomes the next quotient term. It mirrors numerical long division but aligns by degree instead of decimal place.",
        "invariants": [
            "At every step dividend = divisor*quotient + remainder.",
            "The degree of the remainder strictly decreases after each cancellation.",
            "The process stops when the remainder degree is below the divisor degree."
        ],
        "correctness": "Each step subtracts a multiple of the divisor chosen to kill the current leading term, which preserves the identity dividend = divisor*quotient + remainder while lowering the remainder degree. When no cancellation is possible the degree condition holds, so the quotient and remainder satisfy the division algorithm's unique characterization.",
        "complexityRationale": "There are O(n) quotient terms for a degree-n dividend and each cancellation touches O(m) coefficients of a degree-m divisor, costing O(n*m) time. The working arrays use O(n) space.",
        "uses": [
            "Dividing polynomials in computer algebra systems",
            "Reducing polynomials modulo another for finite-field arithmetic",
            "Computing rational function forms"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.1",
            "von zur Gathen and Gerhard, Modern Computer Algebra, Chapter 2"
        ],
        "workedExample": "Divide x^3 + 2x^2 + 3x + 4 by x + 1. Cancel x^3 with x^2, leaving x^2 + 3x + 4; cancel x^2 with x, leaving 2x + 4; cancel 2x with 2, leaving remainder 2. The quotient is x^2 + x + 2 with remainder 2."
    },
    id: "polynomial-long-division",
    name: "Polynomial Long Division",
    category: "math",
    complexity: { time: "O(n*m)", space: "O(n)" },
    defaultInput: { dividend: [1, 2, 3, 4], divisor: [1, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "line up dividend and nonzero divisor",
        "cancel the leading term; record one quotient term",
        "done: quotient with remainder r0",
        "each round shrinks the working remainder",
        "done: degree rule stops the division",
    ],
};
export default module;
