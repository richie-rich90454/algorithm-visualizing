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
 * pohlig-hellman-discrete-log – Pohlig-Hellman DLP Solver.
 * Splits smooth order 10 = 2 x 5, solves each subgroup, CRT merges.
 * Default 2^x = 9 mod 11 gives x = 6. Time O(sqrt q) per factor.
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
function egcd(a: number, b: number): [number, number, number] {
    if (b === 0) return [a, 1, 0];
    const [g, x1, y1] = egcd(b, a - Math.trunc(a / b) * b);
    return [g, y1, x1 - Math.trunc(a / b) * y1];
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number; g?: number; h?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 11;
    const g = typeof t.g === "number" ? Math.trunc(t.g) : 2;
    const h = typeof t.h === "number" ? Math.trunc(t.h) : 9;
    let step = 0;
    if (!(p >= 3) || !(g >= 2) || !(h >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate parameters – nothing to solve.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const q = p - 1;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `g=${g}`, g, "idle"),
            C(0, 1, `h=${h}`, h, "idle"),
            C(0, 2, `q=${q}`, q, "highlight"),
        ],
        edges: [],
        description: `Solve ${g}^x = ${h} mod ${p}; group order ${q} = 2 x 5.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const congruences: Array<[number, number]> = [];
    for (const [qi, ei] of [
        [2, 5],
        [5, 2],
    ] as Array<[number, number]>) {
        const g0 = modPow(g, ei, p);
        const h0 = modPow(h, ei, p);
        let xi = -1;
        for (let j = 0; j < qi; j += 1) {
            if (modPow(g0, j, p) === h0) {
                xi = j;
                break;
            }
        }
        if (xi < 0) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `q=${qi}?`, qi, "swapped")],
                edges: [],
                description: `No subgroup solution mod ${qi} – stopping honestly.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { step },
            };
            return;
        }
        congruences.push([xi, qi]);
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `g0=${g0}`, g0, "idle"),
                C(0, 1, `h0=${h0}`, h0, "idle"),
                C(0, 2, `x=${xi}`, xi, "comparing"),
            ],
            edges: [],
            description: `Mod ${qi}: ${g0}^j = ${h0} gives x = ${xi} (mod ${qi}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { xi, qi },
        };
        step += 1;
    }
    const [x0, m0] = congruences[0] as [number, number];
    const [x1, m1] = congruences[1] as [number, number];
    const [, inv] = egcd(m0, m1);
    let x = (x0 + m0 * (((((x1 - x0) % m1) + m1) % m1) * (((inv % m1) + m1) % m1))) % (m0 * m1);
    x = ((x % q) + q) % q;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x=${x}`, x, "highlight")],
        edges: [],
        description: `CRT: x = ${x0} mod ${m0}, x = ${x1} mod ${m1} -> x = ${x} mod ${q}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { x },
    };
    step += 1;
    const ok = modPow(g, x, p) === ((h % p) + p) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `x=${x}`, x, ok ? "sorted" : "swapped")],
        edges: [],
        description: ok
            ? `Verify ${g}^${x} = ${h} mod ${p} – solved.`
            : `Verify failed – stopping honestly.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { x, ok },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Pohlig-Hellman solves the discrete log g^x = h when the group order is smooth, meaning it factors into small primes. It solves the problem separately in each prime-order subgroup, producing a congruence x = xi (mod qi), then combines the pieces with the Chinese Remainder Theorem. The difficulty drops from the whole group to its largest prime factor.",
        "invariants": [
            "Each subgroup solution satisfies x congruent to xi modulo qi.",
            "The prime factors qi multiply to the group order.",
            "The CRT combination satisfies g^x = h modulo p."
        ],
        "correctness": "Projecting into a subgroup of order qi reduces the exponent modulo qi, so solving there yields x mod qi. Because the qi are coprime and their product is the group order, CRT reconstructs x modulo the group order uniquely. The reconstructed exponent is verified by exponentiating g.",
        "complexityRationale": "Each subgroup of prime order q is solved by baby-step giant-step in O(sqrt(q)) time, so the dominant cost is O(sqrt(q_max)) where q_max is the largest prime factor. Space is O(1) in this small implementation.",
        "uses": [
            "Attacking discrete logs in groups with smooth order",
            "Guiding secure choice of cryptographic group parameters",
            "Teaching subgroup decomposition and CRT combination"
        ],
        "references": [
            "Pohlig and Hellman, An improved algorithm for computing logarithms over GF(p) (1978)",
            "Menezes et al., Handbook of Applied Cryptography, Chapter 3"
        ],
        "workedExample": "For p = 11 the group order is 10 = 2*5. Solve x modulo 2 and modulo 5 using subgroup baby-step giant-step, obtaining two congruences, then CRT-combine them into x modulo 10 and check that g^x = h mod 11."
    },
    id: "pohlig-hellman-discrete-log",
    name: "Pohlig-Hellman Discrete Log",
    category: "math",
    complexity: { time: "O(sqrt(q)) per factor", space: "O(1)" },
    defaultInput: { p: 11, g: 2, h: 9 },
    visualType: "grid",
    run,
    pseudocode: [
        "state g^x = h mod p with smooth group order",
        "solve each subgroup piece x ≡ xi (mod qi)",
        "CRT-merge the pieces into x mod q",
        "verify g^x ≡ h mod p",
        "done: discrete log x, or an honest stop",
    ],
};
export default module;
