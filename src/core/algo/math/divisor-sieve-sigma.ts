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
 * divisor-sieve-sigma – Divisor Sieve (Sigma Function).
 * Adds each d to multiples 2d, 3d...; sigma(n) sums divisors.
 * Default sigma(12) = 1+2+3+4+6+12 = 28. Time O(n log n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 12;
    let step = 0;
    if (!(n >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const sig = new Array<number>(n + 1).fill(0);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle")],
        edges: [],
        description: `Sieve divisor sums up to ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    for (let d = 1; d <= n; d += 1) {
        for (let m = d; m <= n; m += d) sig[m] = (sig[m] as number) + d;
        if (d <= 3) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `d=${d}`, d, "comparing"),
                    C(0, 1, `s[${n}]=${sig[n]}`, sig[n] as number, "highlight"),
                ],
                edges: [],
                description: `Add ${d} to its multiples; partial sigma(${n}) = ${sig[n]}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { d },
            };
            step += 1;
        }
    }
    const divs: number[] = [];
    for (let d = 1; d <= n; d += 1) if (n - Math.trunc(n / d) * d === 0) divs.push(d);
    yield {
        stepNumber: step,
        entities: divs.map((d, i) => C(0, i, `${d}`, d, "comparing")),
        edges: [],
        description: `Divisors of ${n}: [${divs}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `s=${sig[n]}`, sig[n] as number, "sorted")],
        edges: [],
        description: `sigma(${n}) = ${divs.join("+")} = ${sig[n]}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { sigma: sig[n] },
    };
}
const module: AlgorithmModule = {
    id: "divisor-sieve-sigma",
    name: "Divisor Sieve (Sigma)",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { n: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "zero the sigma table sig[1..n]",
        "add each d to sig[d], sig[2d], ... (sieve pass)",
        "read off the divisors of n from the table",
        "sum the divisors into sigma(n)",
        "done: sigma(n) = sum of its divisors",
    ],
};
export default module;
