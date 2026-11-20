/**
 * bivariate-bicycle-code.ts - Bivariate Bicycle quantum LDPC code checks
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bivariate bicycle code is a CSS quantum LDPC code built from two
 * polynomials over the group ring of a two-dimensional torus. One polynomial
 * gives the X-type stabilizer checks and the other gives the Z-type checks;
 * shifting a polynomial around the torus generates every check. Two check
 * families define a valid CSS code exactly when every X check commutes with
 * every Z check, which over binary coefficients means their bitwise overlap is
 * even. This module constructs one small commuting example on a 3 by 3 torus,
 * verifies commutation by brute force, and computes the number of logical
 * qubits by binary rank elimination.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r^2 n) for all check overlaps plus O(r n^2) for binary ranks
 *   Space: O(r n) for the two check matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells form the check-by-qubit parity matrix of the current check family.
 *   - A one marks a qubit covered by a check; a highlighted row is being tested.
 *   - meta carries both matrices, the commutation verdict, and the code count.
 *
 * This is a classical simulation of the stabilizer structure, not a physical
 * quantum memory or a decoder. The torus size and polynomials are fixed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const SIDE = 3;
const SITES = SIDE * SIDE;
const QUBITS = 2 * SITES;
/** X-check polynomial 1 + x + y. */
const A_SUPPORT: Array<[number, number]> = [[0, 0], [1, 0], [0, 1]];
/** Z-check polynomial (1 + y)(1 + xy + x^2 y^2) on a 3 by 3 torus. */
const B_SUPPORT: Array<[number, number]> = [[0, 0], [0, 1], [1, 1], [1, 2], [2, 0], [2, 2]];

/** Build the torus-shifted check matrix for one polynomial. */
function buildChecks(support: Array<[number, number]>): number[][] {
    const checks: number[][] = [];
    for (let row = 0; row < SIDE; row += 1) {
        for (let col = 0; col < SIDE; col += 1) {
            const bits = new Array<number>(QUBITS).fill(0);
            for (const [dx, dy] of support) {
                const x = (dx + row) % SIDE;
                const y = (dy + col) % SIDE;
                bits[x * SIDE + y] = 1;
            }
            checks.push(bits);
        }
    }
    return checks;
}

/** Binary rank of a matrix over GF(2). */
function rankOverF2(matrix: number[][]): number {
    const rows = matrix.map((row) => [...row]);
    let rank = 0;
    for (let col = 0; col < (rows[0]?.length ?? 0); col += 1) {
        let pivot = -1;
        for (let i = rank; i < rows.length; i += 1) {
            if (rows[i]![col] === 1) {
                pivot = i;
                break;
            }
        }
        if (pivot === -1) continue;
        [rows[rank], rows[pivot]] = [rows[pivot]!, rows[rank]!];
        for (let i = 0; i < rows.length; i += 1) {
            if (i !== rank && rows[i]![col] === 1) {
                for (let j = col; j < rows[i]!.length; j += 1) {
                    rows[i]![j] = (rows[i]![j] ?? 0) ^ (rows[rank]![j] ?? 0);
                }
            }
        }
        rank += 1;
    }
    return rank;
}

/** True when every X check overlaps every Z check in an even number of qubits. */
function allCommute(xChecks: number[][], zChecks: number[][]): boolean {
    for (const xRow of xChecks) {
        for (const zRow of zChecks) {
            let overlap = 0;
            for (let qubit = 0; qubit < QUBITS; qubit += 1) {
                overlap += (xRow[qubit] ?? 0) & (zRow[qubit] ?? 0);
            }
            if (overlap % 2 !== 0) return false;
        }
    }
    return true;
}

function makeCells(matrix: number[][], highlightedRow: number, done: boolean, phase: "x" | "z"): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const bit = matrix[row]![col] ?? 0;
            let state: EntityState = bit === 1 ? "active" : "unvisited";
            if (row === highlightedRow && bit === 1) state = "comparing";
            if (done) state = bit === 1 ? "sorted" : "unvisited";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: String(bit),
                value: bit,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, bit, phase, check: row, qubit: col },
            });
        }
    }
    return entities;
}

/** The bivariate bicycle code generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const xChecks = buildChecks(A_SUPPORT);
    const zChecks = buildChecks(B_SUPPORT);
    const commute = allCommute(xChecks, zChecks);
    const rankX = rankOverF2(xChecks);
    const rankZ = rankOverF2(zChecks);
    const logicals = QUBITS - rankX - rankZ;
    const commonMeta = {
        side: SIDE,
        sites: SITES,
        qubits: QUBITS,
        checks: xChecks.length,
        rows: xChecks.length,
        cols: QUBITS,
        rankX,
        rankZ,
        logicals,
        commute,
        hxFlat: xChecks.flat(),
        hzFlat: zChecks.flat(),
    };

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(xChecks, -1, false, "x"),
        edges: [],
        description: `A ${SIDE} by ${SIDE} torus gives ${QUBITS} qubits and ${xChecks.length} X checks from 1 + x + y.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...commonMeta, phase: "x" },
    };

    yield {
        stepNumber: step++,
        entities: makeCells(zChecks, -1, false, "z"),
        edges: [],
        description: `The second polynomial gives ${zChecks.length} Z checks, each covering six qubits.`,
        codeLineNumber: 2,
        layout: "matrix",
        meta: { ...commonMeta, phase: "z" },
    };

    yield {
        stepNumber: step++,
        entities: makeCells(zChecks, 0, false, "z"),
        edges: [],
        description: commute
            ? "Testing the first X check against each Z check: every overlap has even parity."
            : "An odd overlap was found, so this pair does not define a CSS code.",
        codeLineNumber: 4,
        layout: "matrix",
        meta: { ...commonMeta, phase: "z" },
    };

    yield {
        stepNumber: step++,
        entities: makeCells(xChecks, -1, true, "x"),
        edges: [],
        description: `The two families commute; binary ranks ${rankX} and ${rankZ} leave ${logicals} logical qubits.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: { ...commonMeta, phase: "x" },
    };
}

/** The bivariate bicycle code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A bicycle code generates many parity checks by taking one small pattern and sliding it around a grid that wraps at both edges. A quantum CSS code needs two such pattern families, one for bit flips and one for phase flips. They are compatible only when every check of one family touches an even number of qubits of every check in the other family, because overlapping X and Z operators must commute.",
        invariants: [
            "Every check is a torus shift of its defining polynomial support.",
            "The X and Z matrices have one column per physical qubit.",
            "Commutation holds exactly when all X row and Z row overlaps are even.",
            "The number of logical qubits is the physical count minus the two binary ranks.",
        ],
        correctness:
            "X and Z Pauli strings commute exactly when they overlap on an even number of qubits, so testing the parity of every row pair is a complete commutation check for a CSS code. The binary rank of each check family is the number of independent stabilizer generators, and the CSS count formula n minus rank Hx minus rank Hz gives the number of encoded logical qubits. The module computes both quantities directly from the constructed matrices.",
        complexityRationale:
            "There are r checks and n qubits, so all pairwise overlaps cost O(r squared times n) bitwise operations. Binary elimination on an r by n matrix costs O(r n squared) in this straightforward implementation. Both matrices occupy O(r n) space.",
        uses: [
            "Quantum error correction with low-weight stabilizer checks",
            "Constructing quantum LDPC codes with good rates",
            "Studying torus-based code families proposed for hardware",
        ],
        references: [
            "Bravyi, Cross, Gambetta, Maslov, and Rengaswamy, High-threshold and Low-overhead Fault-tolerant Quantum Memory, 2024",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "On a 3 by 3 torus the X pattern 1 + x + y gives nine shifted checks over eighteen qubits. The Z pattern (1 + y)(1 + xy + x squared y squared) gives nine more checks of weight six. Each X check overlaps each Z check in zero, two, or four positions, so they commute. Binary elimination finds ranks seven and two, leaving eighteen minus seven minus two, or nine logical qubits.",
    },
    id: "bivariate-bicycle-code",
    name: "Bivariate Bicycle Code",
    category: "quantum",
    complexity: { time: "O(r^2 n + r n^2)", space: "O(r n)" },
    defaultInput: {},
    visualType: "matrix",
    run,
    pseudocode: [
        "choose two polynomials on a wrapping two-dimensional torus",
        "shift each polynomial to build its check matrix",
        "place X-type checks on one set of physical qubits",
        "place Z-type checks on the full qubit set",
        "for every X and Z check pair count shared qubits",
        "reject the construction if any overlap is odd",
        "compute binary ranks and subtract from the qubit count",
        "done: report commutation and the number of logical qubits",
    ],
};

export default module;
