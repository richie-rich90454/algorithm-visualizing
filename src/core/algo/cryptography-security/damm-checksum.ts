/**
 * damm-checksum.ts - Damm Check Digit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Damm algorithm folds a digit string through a 10 by 10 operation table
 * that forms a weakly totally antisymmetric quasigroup with a zero diagonal.
 * The final interim digit is the check digit, and a number including it is
 * valid exactly when folding the whole string ends at zero. It catches every
 * single-digit error and every adjacent transposition using only one table.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n digits
 *   Space: O(n) only for the displayed digit bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per digit; the computed check digit is appended at the end.
 *   - The digit currently used as the column index is highlighted.
 *   - Metadata exposes the interim digit and final validity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CheckInput {
    digits?: string;
}

/** The order-10 weakly totally antisymmetric quasigroup used by Damm. */
const OP: number[][] = [
    [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
    [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
    [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
    [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
    [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
    [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
    [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
    [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
    [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
    [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

/** Build one bar per digit. */
function makeBars(digits: number[], highlight: number): VisualEntity[] {
    return digits.map((digit, index) => ({
        id: `digit-${index}`,
        type: "bar" as const,
        label: String(digit),
        value: digit,
        state: (index === highlight ? "comparing" : index < highlight ? "visited" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, digit },
    }));
}

/** The Damm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CheckInput | null) ?? {};
    const raw = typeof task.digits === "string" ? task.digits.replace(/\D/g, "") : "572";
    const digits = raw.length > 0 ? raw.split("").map((ch) => Number(ch)) : [0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(digits, -1),
        edges: [],
        description: `Computing a Damm check digit for ${digits.join("")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { interim: 0, checkDigit: 0, valid: false, phase: "setup", digits: digits.join("") },
    };
    step += 1;

    let interim = 0;
    for (let i = 0; i < digits.length; i += 1) {
        const digit = digits[i] ?? 0;
        const previous = interim;
        interim = OP[interim]?.[digit] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(digits, i),
            edges: [],
            description: `Folding digit ${digit} from row ${previous} sets the interim to ${interim}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { interim, checkDigit: 0, valid: false, phase: "generate", digits: digits.join("") },
        };
        step += 1;
    }

    const checkDigit = interim;
    const full = [...digits, checkDigit];
    yield {
        stepNumber: step,
        entities: makeBars(full, digits.length),
        edges: [],
        description: `The check digit is ${checkDigit}; the full code is ${full.join("")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { interim, checkDigit, valid: false, phase: "appended", digits: full.join("") },
    };
    step += 1;

    let verify = 0;
    for (let i = 0; i < full.length; i += 1) {
        const digit = full[i] ?? 0;
        const previous = verify;
        verify = OP[verify]?.[digit] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(full, i),
            edges: [],
            description: `Validating digit ${digit}: row ${previous} and column ${digit} give ${verify}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { interim: verify, checkDigit, valid: false, phase: "validate", digits: full.join("") },
        };
        step += 1;
    }

    const valid = verify === 0;
    yield {
        stepNumber: step,
        entities: makeBars(full, -1),
        edges: [],
        description: valid
            ? `Code ${full.join("")} is valid: folding ends at zero.`
            : `Code ${full.join("")} fails the Damm check.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { interim: verify, checkDigit, valid, phase: "final", digits: full.join("") },
    };
}

/** The Damm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fold digits through a single special multiplication table where every row and column is a permutation and the diagonal is all zeros. Starting from zero, use each digit to pick a column and read the new state. The state you end with is the check digit, and a number plus its check digit is valid when the same fold lands back on zero.",
        invariants: [
            "Every interim value is a digit from zero to nine.",
            "Each row and each column of the operation table lists all ten digits once.",
            "A valid full code always folds to zero.",
        ],
        correctness:
            "The table is a weakly totally antisymmetric quasigroup with zero diagonal. Folding equal digits in any position gives zero, so appending the final interim digit forces the whole fold to zero. If one digit changes, a permutation row guarantees the state changes. If two adjacent digits swap, the antisymmetry property guarantees a different state unless the digits are equal, so the error is caught. The companion test checks the quasigroup properties, a published example, and brute-forces every single-digit and adjacent-transposition mutation.",
        complexityRationale:
            "Each digit needs one constant-time table lookup, so both generating and validating take O(n) time for n digits. The running state is a single digit, so only the displayed bars use space proportional to the input.",
        uses: [
            "Serial numbers and coupons where transpositions are common",
            "German bank and identity codes that need strong decimal checks",
            "A single-table alternative to weighted check digit systems",
        ],
        references: [
            "Damm, Totally Antisymmetric Quasigroups, 2004",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 3",
        ],
        workedExample:
            "Folding the digits 5, 7, 2 through the table gives interim values 9, 7, and 4, so the check digit is 4. Validating 5724 folds to 9, 7, 4, and finally 0, confirming the code is valid.",
    },
    id: "damm-checksum",
    name: "Damm Check Digit",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n) for display" },
    defaultInput: { digits: "572" },
    visualType: "array",
    run,
    pseudocode: [
        "set the interim digit to zero",
        "for each data digit",
        "replace the interim by table lookup of interim and digit",
        "the final interim is the check digit",
        "append the check digit to the number",
        "fold all digits again to validate",
        "the code is valid when the final interim is zero",
        "done: report the check digit and validity",
    ],
};

export default module;
