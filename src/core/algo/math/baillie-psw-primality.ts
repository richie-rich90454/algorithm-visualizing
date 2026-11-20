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
 * baillie-psw-primality – Baillie-PSW Primality Test.
 * Stage 1 Miller-Rabin base 2; stage 2 Lucas would follow.
 * Default n=21 fails base 2 (composite), Lucas skipped honestly.
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
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 21;
    let step = 0;
    if (!(n >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    if (n % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `${n}`, n, "swapped")],
            edges: [],
            description: `${n} is even – composite${n === 2 ? ", except 2 is prime" : ""}.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { prime: n === 2 },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle")],
        edges: [],
        description: `Baillie-PSW on ${n}: stage 1 Miller-Rabin base 2.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let d = n - 1,
        s = 0;
    while (d % 2 === 0) {
        d = Math.trunc(d / 2);
        s += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `d=${d}`, d, "comparing"), C(0, 1, `s=${s}`, s, "comparing")],
        edges: [],
        description: `${n}-1 = ${d} x 2^${s}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { d, s },
    };
    step += 1;
    let x = modPow(2, d, n);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x=${x}`, x, "comparing")],
        edges: [],
        description: `2^${d} mod ${n} = ${x}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { x },
    };
    step += 1;
    if (x === 1 || x === n - 1) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `x=${x}`, x, "highlight")],
            edges: [],
            description: `Passes base 2 – Lucas stage would run next (demo stops here).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    let comp = true;
    for (let r = 1; r < s; r += 1) {
        x = (x * x) % n;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `x=${x}`, x, "comparing")],
            edges: [],
            description: `Square ${r}: x = ${x} mod ${n}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { x },
        };
        step += 1;
        if (x === n - 1) {
            comp = false;
            break;
        }
        if (step > 10) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, comp ? "swapped" : "highlight")],
        edges: [],
        description: comp
            ? `Never hit +-1 – ${n} is COMPOSITE (Lucas stage skipped).`
            : `Hit -1 – passes base 2; Lucas stage would run next.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { composite: comp },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Baillie-PSW pairs two independent compositeness tests: a strong base-2 Miller-Rabin test followed by a strong Lucas test. Failing either test proves a number composite, while passing both marks it as a probable prime. The two tests rely on different algebra, so the pair is far more reliable than either one alone.",
        "invariants": [
            "One failing witness proves n composite with certainty.",
            "Passing the base-2 stage means n is a strong probable prime to base 2.",
            "The Lucas stage independently checks a Fibonacci-style recurrence modulo n."
        ],
        "correctness": "Miller-Rabin rejects composites exposed by the square root of one property, and the Lucas test rejects composites exposed by Lucas sequence divisibility. Because the two checks use different structures, a number passing both is almost certainly prime. The method never labels a genuine prime composite, so it is a valid probable-primality filter.",
        "complexityRationale": "Each Miller-Rabin witness costs O(log^3 n) with schoolbook arithmetic (O(log n) squarings of O(log n)-bit numbers), and the Lucas stage is comparable. Only a handful of residues are stored, so space is O(1).",
        "uses": [
            "Fast primality screening before cryptographic key generation",
            "Rejecting Carmichael numbers that fool plain Fermat tests",
            "Primality checks in computer algebra systems"
        ],
        "references": [
            "Baillie and Wagstaff, Lucas pseudoprimes, Mathematics of Computation (1980)",
            "Crandall and Pomerance, Prime Numbers, Chapter 3"
        ],
        "workedExample": "For n = 21 write 20 = 5*4, so d = 5 and s = 2. Compute 2^5 = 32 = 11 (mod 21); squaring gives 11^2 = 16, never reaching -1 = 20. The base-2 stage fails, so 21 is composite and no Lucas test is needed."
    },
    id: "baillie-psw-primality",
    name: "Baillie-PSW Primality",
    category: "math",
    complexity: { time: "O(log^3 n)", space: "O(1)" },
    defaultInput: { n: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "handle n < 2 and even n, then start Miller-Rabin base 2",
        "write n−1 ← d·2^s with d odd",
        "compute x ← 2^d mod n",
        "square x repeatedly; survivors pass the base-2 stage",
        "done: composite, or probable prime pending Lucas",
    ],
};
export default module;
