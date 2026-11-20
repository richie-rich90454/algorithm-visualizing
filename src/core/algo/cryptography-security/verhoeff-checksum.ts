/**
 * verhoeff-checksum.ts - Verhoeff Check Digit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Verhoeff maps each decimal digit to an element of the dihedral group D5,
 * applies a position-dependent permutation, and multiplies the results with a
 * noncommutative table. A check digit is chosen so the full product is the
 * identity. This detects every single-digit error and every adjacent
 * transposition, which simple weighted sums cannot.
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
 *   - One bar per digit shows its value; the computed check digit is appended.
 *   - The digit currently folded into the running product is highlighted.
 *   - Metadata exposes the running checksum and the final validity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CheckInput {
    digits?: string;
}

/** Cayley table of the dihedral group D5 on digits zero through nine. */
const D: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/** Multiplicative inverse of each digit in D5. */
const INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** Position-dependent permutation rows, indexed by position mod eight. */
const P: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Build one bar per digit of the number. */
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

/** The Verhoeff generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CheckInput | null) ?? {};
    const raw = typeof task.digits === "string" ? task.digits.replace(/\D/g, "") : "236";
    const digits = raw.length > 0 ? raw.split("").map((ch) => Number(ch)) : [0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(digits, -1),
        edges: [],
        description: `Computing a Verhoeff check digit for ${digits.join("")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { checksum: 0, checkDigit: 0, valid: false, phase: "setup", digits: digits.join("") },
    };
    step += 1;

    let checksum = 0;
    for (let i = 0; i < digits.length; i += 1) {
        const position = digits.length - 1 - i;
        const digit = digits[position] ?? 0;
        checksum = D[checksum]?.[P[(i + 1) % 8]?.[digit] ?? 0] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(digits, position),
            edges: [],
            description: `Folding digit ${digit} at position ${position} from the right gives checksum ${checksum}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { checksum, checkDigit: 0, valid: false, phase: "generate", digits: digits.join("") },
        };
        step += 1;
    }

    const checkDigit = INV[checksum] ?? 0;
    const full = [...digits, checkDigit];
    yield {
        stepNumber: step,
        entities: makeBars(full, digits.length),
        edges: [],
        description: `The check digit is ${checkDigit}; the full code is ${full.join("")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { checksum, checkDigit, valid: false, phase: "appended", digits: full.join("") },
    };
    step += 1;

    let verify = 0;
    for (let i = 0; i < full.length; i += 1) {
        const position = full.length - 1 - i;
        const digit = full[position] ?? 0;
        verify = D[verify]?.[P[i % 8]?.[digit] ?? 0] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(full, position),
            edges: [],
            description: `Validating digit ${digit}: running product is ${verify}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { checksum: verify, checkDigit, valid: false, phase: "validate", digits: full.join("") },
        };
        step += 1;
    }

    const valid = verify === 0;
    yield {
        stepNumber: step,
        entities: makeBars(full, -1),
        edges: [],
        description: valid
            ? `Code ${full.join("")} is valid: the group product is the identity.`
            : `Code ${full.join("")} fails the Verhoeff check.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { checksum: verify, checkDigit, valid, phase: "final", digits: full.join("") },
    };
}

/** The Verhoeff module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of adding weighted digits, Verhoeff treats digits as elements of a small noncommutative group called D5. Each position applies a different permutation before multiplying into a running product. A check digit is selected so that multiplying everything returns the identity, and the noncommutativity is what catches swapped neighbors.",
        invariants: [
            "Every intermediate checksum is a digit from zero to nine.",
            "The permutation applied depends only on the distance from the right end.",
            "A valid full code leaves the running product at zero.",
        ],
        correctness:
            "The multiplication table is the Cayley table of the dihedral group D5, so each row and column is a permutation and every element has an inverse in the table. Changing one digit changes the group product because the permutation is a bijection. Swapping two adjacent digits changes the product because D5 is noncommutative and the two positions use different permutations. The chosen check digit is the inverse of the product of the permuted data digits, so appending it makes the total product the identity. The companion test verifies published examples and brute-forces all single-digit and adjacent-transposition mutations.",
        complexityRationale:
            "Each digit requires two constant-time table lookups, so generating and validating are both O(n) for n digits. Only the displayed bars are proportional to the input; the running checksum uses constant space.",
        uses: [
            "Identity and account numbers that must catch mistyped digits",
            "Vehicle identification numbers and postal codes",
            "Any decimal identifier where transpositions are common",
        ],
        references: [
            "Verhoeff, Error Detecting Decimal Codes, 1969",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 3",
        ],
        workedExample:
            "For the digits 236 the running products are 3, 1, and 2, so the check digit is the inverse of 2, namely 3. The full code 2363 validates because folding its digits from the right ends with checksum zero.",
    },
    id: "verhoeff-checksum",
    name: "Verhoeff Check Digit",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n) for display" },
    defaultInput: { digits: "236" },
    visualType: "array",
    run,
    pseudocode: [
        "reverse the data digits and set the checksum to zero",
        "for each digit from the right",
        "permute it by its position modulo eight",
        "replace the checksum by table lookup of checksum and permuted digit",
        "set the check digit to the inverse of the final checksum",
        "append it and repeat the fold to validate",
        "the code is valid when the final checksum is zero",
        "done: report the check digit and validity",
    ],
};

export default module;
