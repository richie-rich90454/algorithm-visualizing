/**
 * arbitrary-precision-addition.ts - Grade-School Arbitrary-Precision Addition.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adds two nonnegative integers that may be far larger than a machine word by
 * storing them as strings of decimal digits. It scans from the least
 * significant digit, adds the two digits and the incoming carry, writes the
 * units digit, and passes the tens digit to the next column.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(max(len(a), len(b))) digit operations
 *   Space: O(max(len(a), len(b))) for the result digits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid column shows one digit position of a, b, the carry, and the sum.
 *   - The active column is highlighted while it is processed.
 *   - The final frame reports the complete sum with no leading zeros.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdditionInput {
    a?: string;
    b?: string;
}

function normalize(value: string): string {
    const trimmed = /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, "") : "0";
    return trimmed;
}

function column(
    index: number,
    da: number,
    db: number,
    carryIn: number,
    sumDigit: number,
    carryOut: number,
    prefix: string,
    active: boolean,
    done: boolean,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number | string }> = [
        { field: "position", value: index },
        { field: "digit a", value: da },
        { field: "digit b", value: db },
        { field: "carry in", value: carryIn },
        { field: "sum digit", value: sumDigit },
        { field: "carry out", value: carryOut },
        { field: "sum so far", value: prefix || "0" },
    ];
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdditionInput | null) ?? {};
    const a = normalize(typeof task.a === "string" ? task.a : "99999999999999999999");
    const b = normalize(typeof task.b === "string" ? task.b : "1");

    let i = a.length - 1;
    let j = b.length - 1;
    let carry = 0;
    const digits: number[] = [];
    let step = 0;
    let position = 0;
    let prefix = "";

    yield {
        stepNumber: step,
        entities: column(0, 0, 0, 0, 0, 0, "", false, false),
        edges: [],
        description: `Add ${a} and ${b} digit by digit from right to left, propagating the carry.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 7, cols: 1, a, b, position: 0 },
    };
    step += 1;

    while (i >= 0 || j >= 0 || carry > 0) {
        const da = i >= 0 ? a.charCodeAt(i) - 48 : 0;
        const db = j >= 0 ? b.charCodeAt(j) - 48 : 0;
        const carryIn = carry;
        const total = da + db + carryIn;
        const sumDigit = total % 10;
        carry = Math.floor(total / 10);
        digits.push(sumDigit);
        prefix = digits
            .slice()
            .reverse()
            .join("");
        position += 1;

        yield {
            stepNumber: step,
            entities: column(position, da, db, carryIn, sumDigit, carry, prefix, true, false),
            edges: [],
            description: `Position ${position}: ${da} + ${db} + carry ${carryIn} = ${total}; write ${sumDigit}, carry ${carry}.`,
            codeLineNumber: carry > 0 ? 3 : 4,
            layout: "grid",
            meta: { rows: 7, cols: 1, a, b, position, da, db, carryIn, sumDigit, carryOut: carry },
        };
        step += 1;
        i -= 1;
        j -= 1;
    }

    const result = digits
        .slice()
        .reverse()
        .join("")
        .replace(/^0+(?=\d)/, "");
    yield {
        stepNumber: step,
        entities: column(position, 0, 0, 0, 0, 0, result, false, true),
        edges: [],
        description: `Done: ${a} + ${b} = ${result}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 7, cols: 1, a, b, result, positions: position },
    };
}

const module: AlgorithmModule = {
    id: "arbitrary-precision-addition",
    name: "Arbitrary-Precision Addition",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { a: "99999999999999999999", b: "1" },
    visualType: "grid",
    run,
    pseudocode: [
        "align a and b on their least significant digits and set carry = 0",
        "while digits remain or carry is nonzero",
        "add the current digits of a and b plus the carry",
        "append the sum modulo 10 and set carry to the sum divided by 10",
        "move one place left in both numbers",
        "reverse the collected digits and strip leading zeros",
    ],
    education: {
        intuition:
            "Addition works the same way on paper no matter how many digits there are. Starting at the rightmost column, add the two digits and any carry from the column before, write down the units digit, and remember the tens digit for the next column.",
        invariants: [
            "After processing k columns, the collected digits are the correct low k digits of the sum.",
            "The carry into a column is either zero or one.",
            "Remaining unprocessed digits sit to the left of the current position.",
        ],
        correctness:
            "At each column the total da plus db plus the incoming carry equals the true column sum, so its units digit is the correct result digit and its tens digit is exactly the carry owed to the next higher place. Induction over columns proves every output digit is correct, and appending the final carry completes the most significant place.",
        complexityRationale:
            "Each of the at most max(len(a), len(b)) plus one columns is handled with a constant number of digit operations, so time is linear in the input length. The output digit array has the same order of length, giving linear space.",
        uses: [
            "Big-integer libraries in languages without native arbitrary precision",
            "Cryptographic arithmetic on operands larger than a machine word",
            "Teaching column arithmetic and carry propagation",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Section 4.3.1",
            "Wikipedia, Arbitrary-precision arithmetic",
        ],
        workedExample:
            "Adding 999 and 1: the rightmost column is 9 + 1 = 10, write 0 carry 1; the next is 9 + 0 + 1 = 10, write 0 carry 1; the next repeats; the final carry 1 is appended, giving 1000.",
    },
};

export default module;
