/**
 * arbitrary-precision-division.ts - Grade-School Long Division.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Divides one nonnegative integer string by another using long division. A
 * running remainder is extended one dividend digit at a time; for each new
 * value the largest quotient digit from 0 to 9 whose product with the divisor
 * still fits is chosen, that product is subtracted, and the next digit is
 * brought down. All comparisons and subtractions are done on digit strings.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(len(dividend) * 10 * len(divisor)) digit work
 *   Space: O(len(dividend) + len(divisor)) for the trace and result
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row shows the brought-down value, chosen digit, and remainder.
 *   - The chosen quotient digit is highlighted.
 *   - The final frame reports the quotient and remainder, or a zero-divisor error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DivisionInput {
    dividend?: string;
    divisor?: string;
}

function normalize(value: string): string {
    return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, "") : "0";
}

function compare(x: string, y: string): number {
    const a = normalize(x);
    const b = normalize(y);
    if (a.length !== b.length) {
        return a.length < b.length ? -1 : 1;
    }
    return a === b ? 0 : a < b ? -1 : 1;
}

function multiplyByDigit(value: string, digit: number): string {
    if (digit === 0) {
        return "0";
    }
    let carry = 0;
    let out = "";
    for (let i = value.length - 1; i >= 0; i -= 1) {
        const product = (value.charCodeAt(i) - 48) * digit + carry;
        out = String(product % 10) + out;
        carry = Math.floor(product / 10);
    }
    if (carry > 0) {
        out = String(carry) + out;
    }
    return normalize(out);
}

function subtract(x: string, y: string): string {
    let i = x.length - 1;
    let j = y.length - 1;
    let borrow = 0;
    const out: number[] = [];
    while (i >= 0) {
        const dx = x.charCodeAt(i) - 48;
        const dy = j >= 0 ? y.charCodeAt(j) - 48 : 0;
        let digit = dx - dy - borrow;
        if (digit < 0) {
            digit += 10;
            borrow = 1;
        } else {
            borrow = 0;
        }
        out.push(digit);
        i -= 1;
        j -= 1;
    }
    return normalize(out.reverse().join(""));
}

function table(
    brought: string,
    digit: number,
    product: string,
    remainder: string,
    divisor: string,
    position: number,
    done: boolean,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number | string }> = [
        { field: "position", value: position },
        { field: "brought down", value: brought },
        { field: "quotient digit", value: digit },
        { field: "digit x divisor", value: product },
        { field: "new remainder", value: remainder },
        { field: "divisor", value: divisor },
    ];
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : i === 2 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DivisionInput | null) ?? {};
    const dividend = normalize(typeof task.dividend === "string" ? task.dividend : "1000");
    const divisor = normalize(typeof task.divisor === "string" ? task.divisor : "7");
    let step = 0;

    if (divisor === "0") {
        yield {
            stepNumber: step,
            entities: table("0", 0, "0", "0", divisor, 0, true).map((entity) => ({
                ...entity,
                state: "error" as EntityState,
            })),
            edges: [],
            description: "Division by zero is undefined; no quotient exists.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 6, cols: 1, error: "division by zero", dividend, divisor },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: table("0", 0, "0", "0", divisor, 0, false),
        edges: [],
        description: `Divide ${dividend} by ${divisor}, bringing down one digit at a time.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 6, cols: 1, dividend, divisor },
    };
    step += 1;

    let remainder = "0";
    let quotient = "";
    for (let index = 0; index < dividend.length; index += 1) {
        const brought = normalize(remainder + dividend[index]);
        let digit = 0;
        for (let candidate = 9; candidate >= 1; candidate -= 1) {
            if (compare(multiplyByDigit(divisor, candidate), brought) <= 0) {
                digit = candidate;
                break;
            }
        }
        const product = multiplyByDigit(divisor, digit);
        remainder = digit === 0 ? brought : subtract(brought, product);
        quotient += String(digit);

        yield {
            stepNumber: step,
            entities: table(brought, digit, product, remainder, divisor, index + 1, false),
            edges: [],
            description: `Digit ${index + 1}: bring down ${dividend[index]} to get ${brought}; choose ${digit}, subtract ${product}, remainder ${remainder}.`,
            codeLineNumber: digit === 0 ? 3 : 4,
            layout: "grid",
            meta: { rows: 6, cols: 1, dividend, divisor, position: index + 1, brought, digit, product, remainder },
        };
        step += 1;
    }

    const result = normalize(quotient);
    yield {
        stepNumber: step,
        entities: table("0", 0, "0", remainder, divisor, dividend.length, true),
        edges: [],
        description: `Done: ${dividend} divided by ${divisor} gives quotient ${result} and remainder ${remainder}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 6, cols: 1, dividend, divisor, quotient: result, remainder },
    };
}

const module: AlgorithmModule = {
    id: "arbitrary-precision-division",
    name: "Arbitrary-Precision Division",
    category: "math",
    complexity: { time: "O(n * m)", space: "O(n + m)" },
    defaultInput: { dividend: "1000", divisor: "7" },
    visualType: "grid",
    run,
    pseudocode: [
        "set remainder to zero and empty the quotient",
        "for each dividend digit from left to right",
        "append it to the remainder to form the brought-down value",
        "choose the largest digit d so that d times the divisor fits",
        "subtract that product and append d to the quotient",
        "return the quotient and the final remainder",
    ],
    education: {
        intuition:
            "Long division carries a remainder that never reaches the divisor. Bringing down the next dividend digit makes a new working number; the largest single digit that can multiply the divisor without exceeding it becomes the next quotient digit, and subtracting leaves a smaller remainder to repeat with.",
        invariants: [
            "After each digit, dividend prefix equals quotient-so-far times divisor plus the current remainder.",
            "The remainder is always nonnegative and strictly less than the divisor.",
            "Each quotient position receives a single digit from 0 to 9.",
        ],
        correctness:
            "For a brought-down value v, choosing the maximal d with d times divisor at most v guarantees that the subtracted remainder v minus d times divisor is less than the divisor, so the invariant is restored. Because the prefix identity holds initially and is preserved at every digit, it also holds at the end, which is exactly the division identity quotient times divisor plus remainder equals dividend.",
        complexityRationale:
            "Each of the n dividend digits tests at most ten candidate digits, and each trial multiplication and subtraction touches at most m divisor digits, so time is O(n times m). The stored remainder and quotient have at most n plus m digits, giving linear space.",
        uses: [
            "Big-integer libraries implementing the division operator",
            "Exact rational arithmetic and fraction reduction",
            "Converting large integers between bases",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.3.1",
            "Wikipedia, Long division",
        ],
        workedExample:
            "Dividing 1000 by 7: the first nonzero bring-down 10 yields digit 1 and remainder 3; bringing down 0 gives 30, digit 4, remainder 2; bringing down the last 0 gives 20, digit 2, remainder 6. The quotient is 142 with remainder 6.",
    },
};

export default module;
