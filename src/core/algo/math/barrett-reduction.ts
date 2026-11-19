/**
 * barrett-reduction.ts - Barrett Modular Reduction.
 *
 * Reduces x modulo m without division by using a precomputed reciprocal
 * mu = floor(2^(2k) / m) with 2^(k-1) <= m < 2^k. A few shifts and one
 * multiplication approximate the quotient, followed by a small correction.
 *
 * Time O(1) word operations, space O(1).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cells(entries: Array<{ label: string; value: number }>, active: number): VisualEntity[] {
    return entries.map((entry, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${entry.label}=${entry.value}`,
        value: entry.value,
        state: (i === active ? "comparing" : i < active ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { m?: number; x?: number } | null) ?? {};
    const m = typeof task.m === "number" ? Math.max(3, Math.trunc(task.m)) : 17;
    const x = typeof task.x === "number" ? Math.max(0, Math.trunc(task.x)) : 123456;

    let k = 1;
    while (Math.pow(2, k) <= m) k += 1;
    const mu = Math.floor(Math.pow(2, 2 * k) / m);
    let step = 0;

    const snapshot = (label: string, value: number, active: number, description: string, line: number) => ({
        stepNumber: step,
        entities: cells([{ label: "m", value: m }, { label: "x", value: x }, { label, value }], active),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid" as const,
        meta: { m, x, k, mu, [label]: value },
    });

    yield {
        stepNumber: step,
        entities: cells([{ label: "m", value: m }, { label: "x", value: x }, { label: "mu", value: mu }], 2),
        edges: [],
        description: `Precompute k=${k} (2^k > ${m}) and reciprocal mu=floor(2^${2 * k}/${m})=${mu}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, x, k, mu },
    };
    step += 1;

    const q1 = Math.floor(x / Math.pow(2, k - 1));
    yield snapshot("q1", q1, 3, `First quotient approximation q1 = floor(x / 2^${k - 1}) = ${q1}.`, 1);
    step += 1;

    const q2 = Math.floor((q1 * mu) / Math.pow(2, k + 1));
    yield snapshot("q2", q2, 4, `Multiply by mu and shift: q2 = floor(q1*mu / 2^${k + 1}) = ${q2}.`, 2);
    step += 1;

    let r = x - q2 * m;
    yield snapshot("r", r, 5, `Initial remainder r = x - q2*m = ${r}.`, 3);
    step += 1;

    while (r >= m) r -= m;
    while (r < 0) r += m;
    yield {
        stepNumber: step,
        entities: cells([{ label: "m", value: m }, { label: "x", value: x }, { label: "r", value: r }], 6),
        edges: [],
        description: `Done: after at most two corrections, ${x} mod ${m} = ${r}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { m, x, k, mu, result: r, quotient: q2 },
    };
}

const module: AlgorithmModule = {
    id: "barrett-reduction",
    name: "Barrett Reduction",
    category: "math",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { m: 17, x: 123456 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose k with 2^(k-1) <= m < 2^k and set mu <- floor(2^(2k)/m)",
        "q1 <- floor(x / 2^(k-1))",
        "q <- floor(q1*mu / 2^(k+1))",
        "r <- x - q*m",
        "while r >= m: r <- r - m; while r < 0: r <- r + m",
        "done: r is x mod m",
    ],
    education: {
        intuition:
            "Dividing a big integer is expensive, but multiplying by a fixed reciprocal is cheaper. Barrett precomputes an approximation of 2^(2k)/m once, then estimates the quotient of any x with shifts and a multiply and cleans up the small error with a couple of subtractions.",
        invariants: [
            "2^(k-1) <= m < 2^k, so k is the bit length of m.",
            "The estimated quotient q differs from the true floor(x/m) by at most a small constant.",
            "After the correction loop, 0 <= r < m and r is congruent to x modulo m.",
        ],
        correctness:
            "The reciprocal mu approximates 2^(2k)/m with error below one, so the shift-and-multiply chain yields a quotient within two of floor(x/m). Subtracting m while r >= m and adding m while r < 0 moves r into the canonical range [0,m) while preserving the residue, which is exactly x mod m.",
        complexityRationale:
            "The setup and reduction use a fixed number of shifts, multiplications and corrections regardless of operand size when modeled as word operations, so time and space are constant in that model.",
        uses: [
            "Modular arithmetic inside RSA and elliptic-curve cryptography",
            "Fast repeated reduction in polynomial and lattice computations",
            "Fixed-modulus arithmetic in digital signal processing",
        ],
        references: [
            "Barrett, Implementing the Rivest Shamir and Adleman Public Key Encryption Algorithm, 1986",
            "Hankerson, Menezes, and Vanstone, Guide to Elliptic Curve Cryptography",
        ],
        workedExample:
            "For m=17 and x=123456, k=5 and mu=floor(1024/17)=60. The estimate gives q=7233 and r=495; subtracting 17 repeatedly lands on 2, which is indeed 123456 mod 17.",
    },
};

export default module;
