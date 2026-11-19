/**
 * residue-number-system.ts - Residue Number System Encoding and CRT Recovery.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A residue number system represents an integer x modulo several pairwise
 * coprime moduli m_i by the tuple of residues x mod m_i. As long as x is below
 * the product M of the moduli, the Chinese remainder theorem recovers x
 * uniquely. This module encodes x, shows each CRT basis term, and reconstructs
 * the original value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) residues plus O(k log M) modular inverses for k moduli
 *   Space: O(k) for the residue tuple and basis
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid lists each modulus, its residue, basis M_i and inverse y_i.
 *   - The newest basis row is highlighted while reconstruction is assembled.
 *   - The final frame reports the dynamic range M and the recovered value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RnsInput {
    moduli?: number[];
    x?: number;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

/** Modular inverse of a modulo m, assuming gcd(a,m)=1. */
function modInverse(a: number, m: number): number {
    let [oldR, r] = [((a % m) + m) % m, m];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % m) + m) % m;
}

interface BasisRow {
    index: number;
    modulus: number;
    residue: number;
    Mi: number;
    inverse: number;
}

function makeEntities(rows: BasisRow[], done: boolean, shown: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < shown; i += 1) {
        const row = rows[i]!;
        const values: Array<[string, number]> = [
            ["m", row.modulus],
            ["r", row.residue],
            ["Mi", row.Mi],
            ["yi", row.inverse],
        ];
        values.forEach(([name, value], col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: `${name}=${value}`,
                value,
                state: (done ? "sorted" : i === shown - 1 ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RnsInput | null) ?? {};
    const fallback = [3, 5, 7];
    const moduli = Array.isArray(task.moduli) && task.moduli.length >= 2 && task.moduli.every((m) => m > 1)
        ? task.moduli.slice()
        : fallback;
    const pairwiseCoprime = moduli.every((m, i) => moduli.every((n, j) => i === j || gcd(m, n) === 1));
    if (!pairwiseCoprime) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "The moduli must be pairwise coprime for a residue number system.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 0, cols: 4, error: true, recovered: 0 },
        };
        return;
    }

    const M = moduli.reduce((product, m) => product * m, 1);
    const x = typeof task.x === "number" ? ((Math.trunc(task.x) % M) + M) % M : 23;
    const rows: BasisRow[] = moduli.map((modulus, index) => {
        const Mi = M / modulus;
        return {
            index,
            modulus,
            residue: x % modulus,
            Mi,
            inverse: modInverse(Mi % modulus, modulus),
        };
    });

    yield {
        stepNumber: 0,
        entities: makeEntities(rows, false, 0),
        edges: [],
        description: `Encoding x=${x} with moduli [${moduli.join(",")}], dynamic range M=${M}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: rows.length, cols: 4, M, x, shown: 0 },
    };

    let recovered = 0;
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]!;
        recovered += row.residue * row.Mi * row.inverse;
        yield {
            stepNumber: i + 1,
            entities: makeEntities(rows, false, i + 1),
            edges: [],
            description: `Modulus ${row.modulus}: residue ${row.residue}, basis ${row.Mi}, inverse ${row.inverse}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: rows.length,
                cols: 4,
                M,
                x,
                shown: i + 1,
                partial: recovered % M,
            },
        };
    }

    const answer = recovered % M;
    yield {
        stepNumber: rows.length + 1,
        entities: makeEntities(rows, true, rows.length),
        edges: [],
        description: `Done: the residues [${rows.map((r) => r.residue).join(",")}] reconstruct to ${answer}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: rows.length, cols: 4, M, x, recovered: answer, residues: rows.map((r) => r.residue) },
    };
}

const module: AlgorithmModule = {
    id: "residue-number-system",
    name: "Residue Number System",
    category: "math",
    complexity: { time: "O(k log M)", space: "O(k)" },
    defaultInput: { moduli: [3, 5, 7], x: 23 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose pairwise coprime moduli and let M be their product",
        "represent x by the residues r[i] = x mod m[i]",
        "compute basis M[i] = M / m[i] and its inverse y[i] modulo m[i]",
        "sum r[i] times M[i] times y[i] for every modulus",
        "reduce the sum modulo M to recover x",
        "done: report the reconstructed value",
    ],
    education: {
        intuition:
            "Instead of storing a number directly, store its remainders under several coprime moduli. Small operations like addition and multiplication become independent per residue, which is attractive in hardware and cryptography. The Chinese remainder theorem guarantees that the tuple identifies exactly one value within the product of the moduli.",
        invariants: [
            "The moduli are pairwise coprime, so the CRT applies.",
            "Each residue equals x modulo its modulus.",
            "Each basis M[i] times its inverse y[i] is 1 modulo m[i] and 0 modulo the others.",
            "The recovered sum is taken modulo the product M.",
        ],
        correctness:
            "For each modulus, the CRT basis term M[i]*y[i] is congruent to 1 modulo m[i] and to 0 modulo every other modulus. Summing r[i] times that term therefore reproduces every residue r[i], and because the residues determine a unique class modulo M, the sum reduced modulo M equals the original x whenever 0 <= x < M.",
        complexityRationale:
            "Computing k residues and k CRT basis inverses takes O(k log M) extended-gcd work, where M is the product of moduli. Storing the residue tuple and basis arrays uses O(k) space.",
        uses: [
            "Fast parallel arithmetic in residue number system hardware",
            "Residue-based cryptography and secret sharing",
            "Fault detection by checking consistency across moduli",
        ],
        references: [
            "Soderstrand, Vernam and Matula, Residue Number System Arithmetic",
            "Wikipedia, Chinese remainder theorem and residue number system",
        ],
        workedExample:
            "With moduli 3, 5, 7 the product is 105 and x=23 has residues 2, 3, 2. The CRT bases are 35, 21, 15 with inverses 2, 1, 1, and the sum 2*35*2 + 3*21*1 + 2*15*1 = 233, which is 23 modulo 105.",
    },
};

export default module;
