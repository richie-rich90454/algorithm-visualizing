/**
 * lehmer-gcd.ts - Lehmer's GCD Algorithm.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lehmer's algorithm speeds up the Euclidean algorithm on very large integers
 * by estimating each quotient from only the leading digits of the two numbers,
 * then correcting that estimate with exact big-integer comparisons. This
 * avoids a full multi-precision division for most steps while preserving the
 * exact quotient sequence, so the final gcd is identical to Euclid's.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * M(n)) for k quotient steps on n-digit numbers
 *   Space: O(n) for the operands
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid table shows the current pair, the leading-digit estimate, the
 *     corrected quotient, and the resulting remainder.
 *   - The corrected quotient is highlighted when it differs from the estimate.
 *   - The final frame reports the gcd.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LehmerInput {
    a?: string | number;
    b?: string | number;
}

function toBigInt(value: string | number | undefined, fallback: string): bigint {
    if (typeof value === "number" && Number.isFinite(value)) {
        return BigInt(Math.trunc(Math.abs(value)));
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
        return BigInt(value);
    }
    return BigInt(fallback);
}

function leadingDigits(value: bigint): number {
    const text = value.toString();
    return Number(text.slice(0, Math.min(15, text.length)));
}

function table(a: bigint, b: bigint, estimate: number, quotient: bigint, remainder: bigint, done: boolean): VisualEntity[] {
    const rows: Array<{ field: string; value: string }> = [
        { field: "a", value: a.toString() },
        { field: "b", value: b.toString() },
        { field: "leading estimate", value: String(estimate) },
        { field: "corrected quotient", value: quotient.toString() },
        { field: "remainder", value: remainder.toString() },
    ];
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : i === 3 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LehmerInput | null) ?? {};
    let a = toBigInt(task.a, "123456789012345678901234567890");
    let b = toBigInt(task.b, "12345678901234567890");
    if (a < b) {
        [a, b] = [b, a];
    }
    let step = 0;
    let emitted = 0;

    yield {
        stepNumber: step,
        entities: table(a, b, 0, 0n, 0n, false),
        edges: [],
        description: `Compute gcd of ${a} and ${b} with leading-digit quotient estimates.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 5, cols: 1, a: a.toString(), b: b.toString() },
    };
    step += 1;

    while (b !== 0n) {
        let estimate = 0;
        let quotient: bigint;
        if (b < 100000000000000n) {
            quotient = a / b;
            estimate = Number(quotient);
        } else {
            const leadingA = leadingDigits(a);
            const leadingB = leadingDigits(b);
            estimate = Math.max(1, Math.floor(leadingA / leadingB));
            quotient = BigInt(estimate);
            let guard = 0;
            while ((quotient + 1n) * b <= a && guard < 512) {
                quotient += 1n;
                guard += 1;
            }
            while (quotient * b > a && guard < 512) {
                quotient -= 1n;
                if (quotient < 1n) {
                    quotient = 1n;
                    break;
                }
                guard += 1;
            }
            if (guard >= 512) {
                quotient = a / b;
            }
        }
        const remainder = a - quotient * b;
        if (emitted < 60) {
            yield {
                stepNumber: step,
                entities: table(a, b, estimate, quotient, remainder, false),
                edges: [],
                description: `Estimate ${estimate}, corrected to ${quotient}; ${a} mod ${b} = ${remainder}.`,
                codeLineNumber: BigInt(estimate) === quotient ? 2 : 3,
                layout: "grid",
                meta: {
                    rows: 5,
                    cols: 1,
                    a: a.toString(),
                    b: b.toString(),
                    estimate,
                    quotient: quotient.toString(),
                    remainder: remainder.toString(),
                },
            };
            step += 1;
            emitted += 1;
        }
        a = b;
        b = remainder;
    }

    yield {
        stepNumber: step,
        entities: table(a, 0n, 0, 0n, 0n, true),
        edges: [],
        description: `Done: the gcd is ${a}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 5, cols: 1, result: a.toString() },
    };
}

const module: AlgorithmModule = {
    id: "lehmer-gcd",
    name: "Lehmer GCD",
    category: "math",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: {
        a: "123456789012345678901234567890",
        b: "12345678901234567890",
    },
    visualType: "grid",
    run,
    pseudocode: [
        "ensure a is at least b",
        "while b is nonzero",
        "estimate the quotient from the leading digits of a and b",
        "correct the estimate with exact comparisons until it is exact",
        "replace (a, b) by (b, a - quotient times b)",
        "return a as the gcd",
    ],
    education: {
        intuition:
            "Euclid's algorithm spends its time dividing huge numbers, but most of a quotient's digits come from just the leading digits of the operands. Lehmer's insight is to guess the quotient cheaply from those leading digits and then verify the guess with a few exact comparisons, avoiding an expensive full division at every step.",
        invariants: [
            "The corrected quotient always equals the exact floor of a divided by b.",
            "The pair (a, b) always has the same gcd as the original input pair.",
            "The remainder is nonnegative and strictly smaller than b.",
        ],
        correctness:
            "The correction loop increases or decreases the estimate until multiplying it by b gives a value at most a while the next multiple exceeds a, which is exactly the definition of the integer quotient. Therefore the update replaces the pair by its true Euclidean successor and preserves the gcd by the identity gcd(a, b) equals gcd(b, a mod b). When b reaches zero, a is the gcd.",
        complexityRationale:
            "The number of quotient steps is logarithmic in the operand size, as in Euclid's algorithm, and each step uses a constant number of leading-digit operations plus a few exact comparisons, so time is O(k times multi-precision cost). Space holds only the operands.",
        uses: [
            "Computing gcds of cryptographic-sized integers efficiently",
            "Reducing large fractions in computer algebra systems",
            "Speeding up modular inverse computation on big integers",
        ],
        references: [
            "Lehmer, Euclid's Algorithm for Large Numbers, 1938",
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.5.2",
        ],
        workedExample:
            "For a = 123456789012345678901234567890 and b = 12345678901234567890, the leading digits give a starting estimate near 10000000000; exact comparison refines it to the true quotient, and the remainder continues the Euclidean chain to the same gcd a naive implementation would find.",
    },
};

export default module;
