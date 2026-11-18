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
            meta: { step },
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
        description: `Seed s0 = 4 mod ${m}; iterate s = s^2-2.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { step },
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

    education: {
        "intuition": "The Lucas-Lehmer test decides whether a Mersenne number Mp = 2^p - 1 is prime. Starting from s = 4, it repeatedly replaces s with s^2 - 2 modulo Mp for p-2 iterations. The number is prime exactly when the final residue is zero, making it far faster than general primality tests for these special numbers.",
        "invariants": [
            "The sequence is always reduced modulo Mp.",
            "There are exactly p-2 squarings before the final check.",
            "The final residue is zero if and only if Mp is prime."
        ],
        "correctness": "The test is a specialized theorem for Mersenne numbers: the recurrence tracks powers of a specific element in the multiplicative group of the quadratic extension modulo Mp, and the residue vanishes exactly when that group has the order forcing primality. Therefore the zero condition is equivalent to Mp being prime.",
        "complexityRationale": "There are O(p) iterations, each squaring a number of O(p) bits, costing O(p^2 log p) with the schoolbook multiplication modeled here. Only one residue and a counter are stored, so space is O(1).",
        "uses": [
            "Testing Mersenne numbers for the Great Internet Mersenne Prime Search",
            "Discovering the largest known primes",
            "Specialized primality testing for numbers of the form 2^p - 1"
        ],
        "references": [
            "Lucas, Theorie des fonctions numeriques simplement periodiques (1878)",
            "Crandall and Pomerance, Prime Numbers, Section 4.2"
        ],
        "workedExample": "For p = 5, Mp = 31. Starting s = 4, three iterations give 4^2-2 = 14, 14^2-2 = 194 = 8 mod 31, and 8^2-2 = 62 = 0 mod 31. The final residue is zero, so 31 is prime."
    },
    id: "lucas-lehmer-mersenne",
    name: "Lucas-Lehmer Mersenne Test",
    category: "math",
    complexity: { time: "O(p^2 log p)", space: "O(1)" },
    defaultInput: { p: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "form Mp = 2^p − 1 with seed s0 = 4",
        "show the seed s0 = 4",
        "iterate s ← s² − 2 mod Mp",
        "a final zero means Mp is prime",
        "done: Mp prime or composite",
    ],
};
export default module;
