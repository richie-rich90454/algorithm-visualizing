/**
 * arbitrary-precision-multiplication.ts - Grade-School Long Multiplication.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multiplies two nonnegative integer strings using the pencil-and-paper
 * algorithm. Each digit of the multiplier produces a partial product of the
 * multiplicand, shifted by one place; the partial products are accumulated
 * into a digit array with carries. No machine integer ever holds the whole
 * value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(len(a) * len(b)) single-digit products
 *   Space: O(len(a) + len(b)) for the result digits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row shows one partial product and its shift.
 *   - The active multiplier digit is highlighted while its row is added.
 *   - The final frame reports the full product without leading zeros.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MultiplicationInput {
    a?: string;
    b?: string;
}

function normalize(value: string): string {
    return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, "") : "0";
}

function digitsToString(digits: number[]): string {
    return digits.join("").replace(/^0+(?=\d)/, "") || "0";
}

function table(
    digit: number,
    shift: number,
    partial: string,
    running: string,
    a: string,
    digitIndex: number,
    done: boolean,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number | string }> = [
        { field: "multiplier digit", value: digit },
        { field: "place / zeros", value: shift },
        { field: "multiplicand", value: a },
        { field: "partial product", value: partial },
        { field: "running total", value: running },
        { field: "digit index", value: digitIndex },
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
    const task = (input as MultiplicationInput | null) ?? {};
    const a = normalize(typeof task.a === "string" ? task.a : "123456789");
    const b = normalize(typeof task.b === "string" ? task.b : "98765");
    const la = a.length;
    const lb = b.length;
    const result = new Array<number>(la + lb).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(0, 0, "0", "0", a, 0, false),
        edges: [],
        description: `Multiply ${a} by ${b} using one partial product per digit of the multiplier.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 6, cols: 1, a, b },
    };
    step += 1;

    for (let i = lb - 1; i >= 0; i -= 1) {
        const digit = b.charCodeAt(i) - 48;
        const shift = lb - 1 - i;
        let carry = 0;
        for (let j = la - 1; j >= 0; j -= 1) {
            const product = digit * (a.charCodeAt(j) - 48) + (result[i + j + 1] ?? 0) + carry;
            result[i + j + 1] = product % 10;
            carry = Math.floor(product / 10);
        }
        result[i] = (result[i] ?? 0) + carry;

        let partialDigits = "";
        let pCarry = 0;
        for (let j = la - 1; j >= 0; j -= 1) {
            const p = digit * (a.charCodeAt(j) - 48) + pCarry;
            partialDigits = String(p % 10) + partialDigits;
            pCarry = Math.floor(p / 10);
        }
        if (pCarry > 0) {
            partialDigits = String(pCarry) + partialDigits;
        }
        const partial = partialDigits + "0".repeat(shift);
        const running = digitsToString(result);

        yield {
            stepNumber: step,
            entities: table(digit, shift, partial, running, a, lb - 1 - i, false),
            edges: [],
            description: `Multiplier digit ${digit} at place ${shift}: add partial product ${partial}; running total ${running}.`,
            codeLineNumber: digit === 0 ? 4 : 3,
            layout: "grid",
            meta: { rows: 6, cols: 1, a, b, digit, shift, partial, running },
        };
        step += 1;
    }

    const product = digitsToString(result);
    yield {
        stepNumber: step,
        entities: table(0, 0, product, product, a, lb, true),
        edges: [],
        description: `Done: ${a} x ${b} = ${product}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 6, cols: 1, a, b, product },
    };
}

const module: AlgorithmModule = {
    id: "arbitrary-precision-multiplication",
    name: "Arbitrary-Precision Multiplication",
    category: "math",
    complexity: { time: "O(n*m)", space: "O(n+m)" },
    defaultInput: { a: "123456789", b: "98765" },
    visualType: "grid",
    run,
    pseudocode: [
        "write a and b as decimal digit arrays and allocate a zero result",
        "for each digit of b from right to left at place s",
        "multiply it by every digit of a, adding carries into the result",
        "add the carry out of the row into the next higher place",
        "shift the partial product by s places before accumulating",
        "reverse the result digits and strip leading zeros",
    ],
    education: {
        intuition:
            "Long multiplication breaks a big product into small, familiar products. Each digit of the multiplier is multiplied by the entire multiplicand to form a shifted partial product, and all the partial products are summed using carries exactly as in grade school.",
        invariants: [
            "After finishing multiplier digit i, the result array holds the sum of all partial products for digits at i and below.",
            "Every result slot stays a single decimal digit after each carry is propagated.",
            "A multiplier digit of zero contributes a shifted row of zeros.",
        ],
        correctness:
            "Writing b as the sum of its digits times powers of ten, distributivity gives a times b as the sum of a times each digit times its power of ten, which is exactly the shifted partial products. The inner carry propagation makes each accumulated row equal to that partial product in decimal, so the final digit array is the true product.",
        complexityRationale:
            "There are len(b) rows and len(a) digit products per row, so the time is quadratic in the input lengths. The result occupies len(a) + len(b) digits, giving linear space.",
        uses: [
            "Big-integer libraries before faster Karatsuba or Toom-Cook methods",
            "Exact arithmetic in computer algebra systems for small operands",
            "Illustrating why subquadratic multiplication matters",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.3.1",
            "Wikipedia, Multiplication algorithm, Long multiplication",
        ],
        workedExample:
            "To compute 12 x 34, the digit 4 gives partial product 48, and the digit 3 shifted one place gives 360. Their sum 408 is the product, matching the digit-array accumulation.",
    },
};

export default module;
