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
 * inclusion-exclusion-counting – Inclusion-Exclusion Count.
 * |A u B| = |A| + |B| - |A n B| for divisibility sets to n.
 * Default to 30 by 2 or 3: 15+10-5 = 20. Time O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; divisors?: number[] } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 30;
    const ds = Array.isArray(t.divisors) ? (t.divisors as number[]).map(Math.trunc) : [2, 3];
    let step = 0;
    if (!(n >= 1) || ds.length !== 2 || ds.some((d) => !(d >= 1))) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 1 and exactly two divisors).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const [d1, d2] = [ds[0] as number, ds[1] as number];
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `n=${n}`, n, "idle"),
            C(0, 1, `d1=${d1}`, d1, "idle"),
            C(0, 2, `d2=${d2}`, d2, "idle"),
        ],
        edges: [],
        description: `Count numbers to ${n} divisible by ${d1} or ${d2}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const c1 = Math.trunc(n / d1);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `|A|=${c1}`, c1, "comparing")],
        edges: [],
        description: `|A| = floor(${n}/${d1}) = ${c1}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { c1 },
    };
    step += 1;
    const c2 = Math.trunc(n / d2);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `|A|=${c1}`, c1, "idle"), C(0, 1, `|B|=${c2}`, c2, "comparing")],
        edges: [],
        description: `|B| = floor(${n}/${d2}) = ${c2}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { c2 },
    };
    step += 1;
    const l =
        (d1 * d2) /
        ((): number => {
            let x = d1,
                y = d2;
            while (y !== 0) {
                const r = x - Math.trunc(x / y) * y;
                x = y;
                y = r;
            }
            return x;
        })();
    const c12 = Math.trunc(n / l);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `|AnB|=${c12}`, c12, "comparing")],
        edges: [],
        description: `|A n B| = floor(${n}/${l}) = ${c12} (lcm ${l}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { c12 },
    };
    step += 1;
    const uni = c1 + c2 - c12;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `U=${uni}`, uni, "sorted")],
        edges: [],
        description: `|A u B| = ${c1}+${c2}-${c12} = ${uni}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { uni },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Inclusion-exclusion counts the size of a union of sets by adding their individual sizes and subtracting overlaps so nothing is counted twice. For two divisor sets the union is |A| + |B| minus the intersection. Here the sets are multiples of two divisors below n, and the overlap is counted by their least common multiple.",
        "invariants": [
            "|A| equals floor(n/d1) and |B| equals floor(n/d2).",
            "The intersection of the two sets is the multiples of lcm(d1, d2).",
            "Every element of the union is counted exactly once by the alternating sum."
        ],
        "correctness": "An element in only one set appears in exactly one of |A| or |B|; an element in both appears twice in the sum and once in the intersection, so subtracting leaves one. Elements in neither appear zero times. The alternating sum therefore equals the union cardinality.",
        "complexityRationale": "Only a few floor divisions and one lcm are computed, so time is O(1). No arrays are needed, giving O(1) space.",
        "uses": [
            "Counting integers divisible by any of several primes",
            "Avoiding double counts in combinatorial enumeration",
            "Computing totients and sieve-style counting formulas"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 2",
            "Stanley, Enumerative Combinatorics, Vol. 1, Section 2.1"
        ],
        "workedExample": "For n = 30 with divisors 2 and 3, |A| = 15, |B| = 10, and the overlap of multiples of 6 is 5. The union is 15 + 10 - 5 = 20 numbers divisible by 2 or 3."
    },
    id: "inclusion-exclusion-counting",
    name: "Inclusion-Exclusion Counting",
    category: "math",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { n: 30, divisors: [2, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "state the two divisor sets A and B below n",
        "count |A| = ⌊n/d1⌋ and |B| = ⌊n/d2⌋",
        "count the overlap |A ∩ B| = ⌊n/lcm⌋",
        "combine |A ∪ B| = |A| + |B| − |A ∩ B|",
        "done: union count = uni",
    ],
};
export default module;
