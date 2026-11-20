/**
 * balanced-ternary-conversion.ts - Integer to Balanced Ternary
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Balanced ternary writes an integer with digits -1, 0 and +1 (often printed
 * as -, 0 and +) using powers of three. Repeated division by three produces
 * a remainder in {0, 1, 2}; remainder 2 is rewritten as digit -1 with a carry
 * of one to the next quotient. The same rule works for negative numbers, so no
 * separate sign handling is needed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log_3 |n|) division steps
 *   Space: O(log_3 |n|) for the emitted digits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the digits collected so far, most significant first.
 *   - The newest digit is GREEN; earlier committed digits are GREY.
 *   - The final frame shows the reconstructed value for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Convert an integer to balanced ternary digits, least significant first. */
function convert(nInput: number): number[] {
    let n = Math.trunc(nInput);
    if (n === 0) {
        return [0];
    }
    const digits: number[] = [];
    while (n !== 0) {
        const quotient = Math.floor(n / 3);
        const remainder = n - 3 * quotient;
        if (remainder === 0) {
            digits.push(0);
            n = quotient;
        } else if (remainder === 1) {
            digits.push(1);
            n = quotient;
        } else {
            digits.push(-1);
            n = quotient + 1;
        }
    }
    return digits;
}

function symbol(digit: number): string {
    return digit === -1 ? "-" : digit === 0 ? "0" : "+";
}

function cells(digits: number[], newestIndex = -1): VisualEntity[] {
    const ordered = digits.slice().reverse();
    return ordered.map((digit, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: symbol(digit),
        value: digit,
        state: (index === ordered.length - 1 - newestIndex ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, digit },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 37;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [
            {
                id: "cell-value",
                type: "cell",
                label: String(n),
                value: n,
                state: "highlight",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            },
        ],
        edges: [],
        description: `Converting ${n} to balanced ternary with digits minus one, zero and plus one.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, step },
    };
    step += 1;

    const digits = convert(n);
    let current = n;
    for (let index = 0; index < digits.length; index += 1) {
        const digit = digits[index] ?? 0;
        const quotient = Math.floor(current / 3);
        const remainder = current - 3 * quotient;
        const raw = remainder === 2 ? "-1 (borrow)" : String(remainder);
        yield {
            stepNumber: step,
            entities: cells(digits.slice(0, index + 1), index),
            edges: [],
            description: `${current} divided by 3 gives remainder ${remainder} (digit ${raw}); new quotient ${remainder === 2 ? quotient + 1 : quotient}.`,
            codeLineNumber: remainder === 0 ? 2 : remainder === 1 ? 3 : 4,
            layout: "grid",
            meta: {
                step,
                current,
                remainder,
                digit,
                quotient: remainder === 2 ? quotient + 1 : quotient,
            },
        };
        current = remainder === 2 ? quotient + 1 : quotient;
        step += 1;
    }

    const text = digits.slice().reverse().map(symbol).join("");
    let reconstructed = 0;
    for (let i = 0; i < digits.length; i += 1) {
        reconstructed += (digits[i] ?? 0) * 3 ** i;
    }
    yield {
        stepNumber: step,
        entities: cells(digits).map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `Balanced ternary of ${n} is ${text}; reconstructing the powers of three gives ${reconstructed}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, digits, text, reconstructed, step },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary ternary uses the digits 0, 1 and 2. Balanced ternary replaces 2 with the digit minus one and carries one to the next place, giving the symmetric digit set minus one, zero and plus one. Because the digits are centered around zero, negative numbers need no separate sign: just keep applying the same division rule.",
        invariants: [
            "Every emitted digit lies in the set minus one, zero, or plus one.",
            "The current value equals the reconstructed value of the digits emitted so far plus three raised to the next position times the remaining quotient.",
            "A remainder of two always becomes digit minus one with a carry of one.",
        ],
        correctness:
            "At each step n = 3q + r with r in {0, 1, 2}. When r is 0 or 1 the digit r satisfies n = 3q + digit. When r is 2 we set digit to minus one and q' = q + 1, so 3q' - 1 = 3q + 2 = n. Inductively the reconstructed powers of three equal the original integer, and the quotient strictly shrinks in absolute value so the loop terminates.",
        complexityRationale:
            "Every iteration divides the magnitude by three, so the number of steps and the number of stored digits are both O(log base 3 of |n|). Each step does constant arithmetic, giving that same logarithmic time bound and O(log |n|) space.",
        uses: [
            "Balanced ternary arithmetic circuits and early ternary computers",
            "Signed-digit representations that avoid separate sign bits",
            "Efficient comparison and rounding in exact numerical schemes",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.1",
            "Setun, the Soviet balanced ternary computer, 1958",
        ],
        workedExample:
            "For n = 37: 37 = 3*12 + 1 gives digit +; 12 = 3*4 + 0 gives 0; 4 = 3*1 + 1 gives +; 1 = 3*0 + 1 gives +. Reading the digits from most significant gives + + 0 + with place values 27, 9, 3 and 1, so the value is 27 + 9 + 0 + 1 = 37.",
    },
    id: "balanced-ternary-conversion",
    name: "Balanced Ternary Conversion",
    category: "math",
    complexity: { time: "O(log |n|)", space: "O(log |n|)" },
    defaultInput: { n: 37 },
    visualType: "grid",
    run,
    pseudocode: [
        "input integer n; if n is zero return digit zero",
        "while n is not zero",
        "divide n by three to get quotient and remainder",
        "if remainder is zero emit digit zero",
        "if remainder is one emit digit plus one",
        "if remainder is two emit minus one and increment quotient",
        "set n to the adjusted quotient",
        "done: reverse the digits and verify the reconstruction",
    ],
};

export default module;
