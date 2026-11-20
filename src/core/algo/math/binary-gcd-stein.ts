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
 * binary-gcd-stein – Stein's Binary GCD.
 * Strips common powers of two, then odd subtract-and-halve.
 * Default gcd(48, 36) = 12. Time O(log max(a,b)), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number } | null) ?? {};
    let a = typeof t.a === "number" ? Math.trunc(t.a) : 48;
    let b = typeof t.b === "number" ? Math.trunc(t.b) : 36;
    let step = 0;
    if (!(a >= 0) || !(b >= 0) || (a === 0 && b === 0)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate – need non-negative inputs, not both zero.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    if (a === 0 || b === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `gcd=${a + b}`, a + b, "sorted")],
            edges: [],
            description: `One input is zero – gcd is ${a + b}.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { gcd: a + b },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${a}`, a, "idle"), C(0, 1, `b=${b}`, b, "idle")],
        edges: [],
        description: `Binary gcd(${a}, ${b}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let shift = 0;
    while (a % 2 === 0 && b % 2 === 0) {
        a = Math.trunc(a / 2);
        b = Math.trunc(b / 2);
        shift += 1;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `a=${a}`, a, "comparing"),
            C(0, 1, `b=${b}`, b, "comparing"),
            C(0, 2, `2^${shift}`, 2 ** shift, "highlight"),
        ],
        edges: [],
        description: `Stripped 2^${shift}: now (${a}, ${b}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { shift },
    };
    step += 1;
    for (let guard = 0; guard < 20; guard += 1) {
        if (a === 0) break;
        while (a % 2 === 0) a = Math.trunc(a / 2);
        if (a > b) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        b = b - a;
        if (guard < 3) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `a=${a}`, a, "comparing"), C(0, 1, `b=${b}`, b, "comparing")],
                edges: [],
                description: `Odd step ${guard + 1}: (${a}, ${b}).`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { step },
            };
            step += 1;
        }
    }
    const rest = a === 0 ? b : a;
    const gcd = rest * 2 ** shift;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `gcd=${gcd}`, gcd, "sorted")],
        edges: [],
        description: `gcd = ${rest} x 2^${shift} = ${gcd}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { gcd },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Stein's binary gcd avoids division by using only parity tests, subtractions, and shifts. It first removes all common factors of two from a and b, then repeatedly halves even values and subtracts smaller odd values from larger ones. Because shifting is cheap in binary, this can outperform Euclid's modulo-based algorithm on machine integers.",
        "invariants": [
            "The number of common factors of two already removed is tracked by the shift count.",
            "At every step gcd of the current pair equals gcd of the original pair divided by 2^shift.",
            "Odd values remain odd after subtraction and halving rules keep values shrinking."
        ],
        "correctness": "Halving an even number does not change its gcd with an odd number, and gcd(u, v) = gcd(u - v, v) for odd u and v. Removing a common factor of two consistently is exactly the stored shift. When the two values become equal, that odd value times 2^shift is the original gcd.",
        "complexityRationale": "Every iteration either halves a value or subtracts odd values, reducing the bit length at least every other step, so the number of iterations is O(log max(a, b)). Each step is a constant-time parity test, shift, or subtraction, and space is O(1).",
        "uses": [
            "Fast gcd on hardware where division is expensive",
            "Big-integer libraries using bit operations",
            "Reducing fractions and computing modular inverses"
        ],
        "references": [
            "Stein, Computational problems associated with Racah algebra (1967)",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.5.2"
        ],
        "workedExample": "For a = 48 and b = 36 both are even; strip two common factors of two, leaving odd parts 3 and 9 with shift 2. Subtract to get 6, halve to 3; now both are 3. The odd gcd is 3, so gcd = 3*2^2 = 12."
    },
    id: "binary-gcd-stein",
    name: "Binary GCD (Stein)",
    category: "math",
    complexity: { time: "O(log max(a, b))", space: "O(1)" },
    defaultInput: { a: 48, b: 36 },
    visualType: "grid",
    run,
    pseudocode: [
        "handle zeros, then state binary gcd(a, b)",
        "strip the common power of two: 2^shift",
        "halve evens and subtract odd pairs until equal",
        "restore the power: gcd = odd part × 2^shift",
        "done: gcd verified by construction",
    ],
};
export default module;
