/**
 * beaver-triples-mpc.ts - Beaver Triple Multiplication in a Toy Field
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Secure multi-party computation can multiply two secret values with the help
 * of a pre-shared multiplication triple (a, b, c) where c equals a times b. The
 * parties reveal only the masked differences d = x minus a and e = y minus b,
 * then reconstruct x times y as c plus d times b plus e times a plus d times e.
 * All arithmetic is modular, and the masked values reveal nothing about x or y
 * by themselves. This demo works in a tiny prime field; it is exact but not a
 * complete secure protocol.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) field operations
 *   Space: O(1) values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars reveal the triple, the masked values, and the reconstructed product.
 *   - The final frame checks the product against a direct multiplication.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface BeaverInput {
    p?: number;
    x?: number;
    y?: number;
    a?: number;
    b?: number;
}

function mod(value: number, p: number): number {
    return ((value % p) + p) % p;
}

function bars(values: Array<{ label: string; value: number; revealed: boolean }>): VisualEntity[] {
    return values.map((item, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: item.revealed ? `${item.label}=${item.value}` : `${item.label}=?`,
        value: item.revealed ? item.value : 0,
        state: item.revealed ? ("sorted" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: item.label },
    }));
}

/** Reconstruct a secret product using a Beaver triple. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BeaverInput | null) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? task.p : 97;
    const x = typeof task.x === "number" ? mod(task.x, p) : 15;
    const y = typeof task.y === "number" ? mod(task.y, p) : 20;
    const a = typeof task.a === "number" ? mod(task.a, p) : 7;
    const b = typeof task.b === "number" ? mod(task.b, p) : 11;
    const c = mod(a * b, p);

    const d = mod(x - a, p);
    const e = mod(y - b, p);
    const product = mod(c + d * b + e * a + d * e, p);
    const direct = mod(x * y, p);
    const correct = product === direct;

    const all = [
        { label: "a", value: a, revealed: false },
        { label: "b", value: b, revealed: false },
        { label: "c", value: c, revealed: false },
        { label: "d", value: d, revealed: false },
        { label: "e", value: e, revealed: false },
        { label: "xy", value: product, revealed: false },
    ];
    const reveal = (count: number) => all.map((item, index) => ({ ...item, revealed: index < count }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(all),
        edges: [],
        description: `Multiply two secrets in the field modulo ${p} using a pre-shared Beaver triple.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, tripleValid: c === mod(a * b, p), d: -1, e: -1, product: -1, correct: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(3)),
        edges: [],
        description: `The triple a=${a}, b=${b}, c=${c} satisfies c = a times b modulo ${p}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { p, tripleValid: true, d: -1, e: -1, product: -1, correct: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(5)),
        edges: [],
        description: `Reveal masked differences d = x minus a = ${d} and e = y minus b = ${e}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p, tripleValid: true, d, e, product: -1, correct: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(reveal(6)),
        edges: [],
        description:
            `Reconstruct xy = c + d*b + e*a + d*e = ${product}; direct multiplication gives ${direct}. ` +
            (correct ? "They agree." : "They disagree."),
        codeLineNumber: 5,
        layout: "array",
        meta: { p, tripleValid: true, d, e, product, direct, correct },
    };
}

/** The Beaver triple module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Multiplying secret-shared numbers is the hard operation in secure computation. A Beaver triple is a hidden pair a and b together with their product c. The parties open only masked differences of their secrets with a and b; those masks look random, so no secret leaks. Combining the opened differences with c gives the true product.",
        invariants: [
            "The triple satisfies c = a times b modulo the prime.",
            "The opened values are d = x minus a and e = y minus b modulo the prime.",
            "The reconstructed product is c plus d times b plus e times a plus d times e modulo the prime.",
        ],
        correctness:
            "Substituting d = x minus a and e = y minus b, the reconstruction expands to ab + (x-a)b + (y-b)a + (x-a)(y-b), which simplifies algebraically to xy. Reducing after each step is valid because modular addition and multiplication respect this identity. The masked values d and e are uniformly distributed when a and b are random and hidden.",
        complexityRationale:
            "The protocol performs a fixed number of field additions and multiplications, so time and space are both constant. In a real system the expensive part is generating triples ahead of time, which this demo assumes are given.",
        uses: [
            "Secure multiplication inside multi-party computation protocols",
            "Privacy-preserving machine learning on jointly held data",
            "A teaching model for preprocessing-based secure computation",
        ],
        references: [
            "Beaver, Efficient Multiparty Protocols Using Circuit Randomization, 1991",
            "Cramer, Damgard, and Nielsen, Secure Multiparty Computation and Secret Sharing, 2015",
        ],
        workedExample:
            "In the field modulo 97 with secrets x=15 and y=20 and triple a=7, b=11, c=77, the opened values are d=8 and e=9. Reconstruction gives 77 + 8 times 11 + 9 times 7 + 8 times 9 = 300, which equals 9 modulo 97, the same as 15 times 20 modulo 97.",
    },
    id: "beaver-triples-mpc",
    name: "Beaver Triples MPC (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { p: 97, x: 15, y: 20, a: 7, b: 11 },
    visualType: "array",
    run,
    pseudocode: [
        "agree on a prime and receive a hidden triple a, b, c",
        "check that c equals a times b modulo the prime",
        "open d as the secret x minus the mask a",
        "open e as the secret y minus the mask b",
        "rebuild xy as c plus d*b plus e*a plus d*e",
        "reduce modulo the prime",
        "done: report the reconstructed product",
    ],
};

export default module;
