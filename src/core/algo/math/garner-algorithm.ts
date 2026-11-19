/**
 * garner-algorithm.ts - Garner's Algorithm for CRT Reconstruction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Garner's algorithm reconstructs an integer x from its residues modulo
 * pairwise-coprime moduli without computing the huge inverses M/m_i used by
 * the textbook Chinese Remainder Theorem. It builds the mixed-radix digits
 * a_i one at a time, where x = a_0 + a_1*m_0 + a_2*m_0*m_1 + ... . Each digit
 * is found with a single modular inverse of a running product.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^2) modular operations for k congruences
 *   Space: O(k) for the digits and running products
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each mixed-radix digit is one cell of a grid row.
 *   - The digit currently being solved is YELLOW (comparing).
 *   - Solved digits are GREEN (sorted); the final frame reports x.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function egcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const r = egcd(b, a % b);
    return { g: r.g, x: r.y, y: r.x - Math.trunc(a / b) * r.y };
}

function invMod(a: number, m: number): number {
    const { x } = egcd(((a % m) + m) % m, m);
    return ((x % m) + m) % m;
}

function makeDigits(
    digits: number[],
    states: Map<number, EntityState>,
    active: number,
): VisualEntity[] {
    return digits.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(i) ?? (i === active ? "comparing" : "sorted"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, digit: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { residues?: number[]; moduli?: number[] } | null) ?? {};
    const residues = task.residues ?? [2, 3, 2];
    const moduli = task.moduli ?? [3, 5, 7];
    const k = Math.min(residues.length, moduli.length);
    if (k === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No congruences provided, so the reconstructed value is zero.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { value: 0, digits: [] },
        };
        return;
    }

    const digits = new Array<number>(k).fill(0);
    const product = new Array<number>(k).fill(1);
    for (let i = 1; i < k; i += 1) product[i] = product[i - 1]! * moduli[i - 1]!;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeDigits(digits, new Map(), -1),
        edges: [],
        description: `Reconstructing x from ${k} residues using Garner's mixed-radix method.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { value: 0, digits: [...digits], totalModulus: product[k - 1]! * moduli[k - 1]! },
    };
    step += 1;

    for (let i = 0; i < k; i += 1) {
        let acc = residues[i]!;
        for (let j = 0; j < i; j += 1) {
            acc -= digits[j]! * product[j]!;
        }
        const factor = invMod(product[i]! % moduli[i]!, moduli[i]!);
        digits[i] = (((acc % moduli[i]!) * factor) % moduli[i]! + moduli[i]!) % moduli[i]!;
        let value = 0;
        for (let j = k - 1; j >= 0; j -= 1) value = value * moduli[j]! + digits[j]!;
        yield {
            stepNumber: step,
            entities: makeDigits(digits, new Map([[i, "sorted" as EntityState]]), i),
            edges: [],
            description: `Digit ${i}: a_${i} = ${digits[i]} modulo ${moduli[i]!}; partial x = ${value}.`,
            codeLineNumber: i === 0 ? 2 : 3,
            layout: "grid",
            meta: {
                value,
                digits: [...digits],
                digit: digits[i]!,
                modulus: moduli[i]!,
                residue: residues[i]!,
            },
        };
        step += 1;
    }

    let value = 0;
    for (let j = k - 1; j >= 0; j -= 1) value = value * moduli[j]! + digits[j]!;
    const checks = residues.map((r, i) => ((value % moduli[i]!) + moduli[i]!) % moduli[i]! === ((r % moduli[i]!) + moduli[i]!) % moduli[i]!);
    yield {
        stepNumber: step,
        entities: makeDigits(digits, new Map(digits.map((_, i) => [i, "sorted" as EntityState])), -1),
        edges: [],
        description: `Garner reconstruction gives x = ${value}, verified against all ${k} residues.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            value,
            digits: [...digits],
            moduli: [...moduli],
            residues: [...residues],
            allResiduesMatch: checks.every(Boolean),
            totalModulus: product[k - 1]! * moduli[k - 1]!,
        },
    };
}

/** The Garner CRT reconstruction module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of building the solution as one big sum of terms, Garner's algorithm writes the answer in a mixed radix. The first digit equals the first residue. Each later digit is chosen so that the partially reconstructed number matches the next congruence, and a single division undoes the accumulated product of earlier moduli.",
        invariants: [
            "The running product P_i is the product of moduli 0 through i-1.",
            "After solving digit i, the partial reconstruction matches residues 0 through i.",
            "Every digit lies in the range zero to m_i minus one.",
            "The reconstruction is unique modulo the product of all moduli.",
        ],
        correctness:
            "Assume the partial sum matches the first i congruences. Adding a_i*P_i leaves those residues unchanged because P_i is divisible by each earlier modulus. Choosing a_i to solve the i-th congruence is possible and unique because P_i is invertible modulo m_i when the moduli are pairwise coprime, so the invariant extends to i+1. Induction gives a number matching every congruence, and uniqueness follows from the Chinese Remainder Theorem.",
        complexityRationale:
            "Solving digit i costs i multiplications plus one extended-GCD inversion, so all k digits need O(k^2) modular operations and O(k) storage for the digits and running products.",
        uses: [
            "Reconstructing secret-sharing shares in threshold cryptography",
            "Fast modular arithmetic in residue number systems",
            "Exact large-integer computation from several machine-word residues",
        ],
        references: [
            "Garner, The Residue Number System, IRE Transactions on Electronic Computers, 1959",
            "Knuth, The Art of Computer Programming Volume 2, Section 4.3.2",
        ],
        workedExample:
            "For residues 2 mod 3, 3 mod 5, 2 mod 7 the products are 1, 3, 15. Digit 0 is 2. Digit 1 solves 2 + 3*a = 3 mod 5, giving a = 2. Digit 2 solves 8 + 15*a = 2 mod 7, giving a = 1. The mixed-radix form 2 + 2*3 + 1*15 evaluates to 23, which leaves remainders 2, 3, 2 as required.",
    },
    id: "garner-algorithm",
    name: "Garner's Algorithm (CRT)",
    category: "math",
    complexity: { time: "O(k^2)", space: "O(k)" },
    defaultInput: { residues: [2, 3, 2], moduli: [3, 5, 7] },
    visualType: "grid",
    run,
    pseudocode: [
        "set the first product P_0 to one",
        "for i from one to k-1 set P_i to the product of moduli before i",
        "for each index i compute the adjusted residue r_i minus earlier digits times P_j",
        "invert P_i modulo m_i with the extended Euclidean algorithm",
        "set digit a_i to the adjusted residue times that inverse modulo m_i",
        "evaluate the mixed-radix digits to obtain x",
        "done: return x and verify every original congruence",
    ],
};

export default module;
