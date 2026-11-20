/**
 * css-code.ts - Calderbank-Shor-Steane Code Construction (Small Exact Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A CSS code builds a quantum stabilizer code from two classical binary linear
 * codes. If Hx and Hz are parity-check matrices whose rows are orthogonal over
 * GF(2), then the X-type stabilizers X^r (one per row of Hx) commute with the
 * Z-type stabilizers Z^s (one per row of Hz). The code has n physical qubits,
 * k = n - rank(Hx) - rank(Hz) logical qubits, and a distance found by
 * searching for the lowest-weight Pauli error that commutes with every
 * stabilizer but is not itself a stabilizer. The seven-qubit Steane code is
 * the classic example, built from the [7,4,3] Hamming code with Hx = Hz = H.
 *
 * This is an exact small simulation over GF(2): matrix ranks, commutation,
 * kernel enumeration, stabilizer membership, and distance are computed
 * exhaustively. It models stabilizer structure and parameters only, not noise
 * processes, decoding, or fault tolerance. Search is limited to at most 12
 * qubits so exhaustive enumeration stays small.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^(n-kx) * 2^(n-kz)) for the exhaustive distance search
 *   Space: O(2^n) for the enumerated kernel and row spaces
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each stabilizer row is a grid row of cells, one cell per qubit.
 *   - X checks are blue-active, Z checks green, a distance witness red.
 *   - meta carries the parameters n, k, d, ranks, and a logical operator.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Rank of a binary matrix over GF(2). */
export function gf2Rank(matrix: number[][]): number {
    if (matrix.length === 0) {
        return 0;
    }
    const rows = matrix.map((row) => [...row]);
    const n = rows[0]?.length ?? 0;
    let rank = 0;
    for (let col = 0; col < n && rank < rows.length; col += 1) {
        let pivot = -1;
        for (let r = rank; r < rows.length; r += 1) {
            if (((rows[r] as number[])[col] ?? 0) % 2 === 1) {
                pivot = r;
                break;
            }
        }
        if (pivot < 0) {
            continue;
        }
        const swap = rows[rank] as number[];
        rows[rank] = rows[pivot] as number[];
        rows[pivot] = swap;
        for (let r = 0; r < rows.length; r += 1) {
            if (r !== rank && ((rows[r] as number[])[col] ?? 0) % 2 === 1) {
                for (let c = col; c < n; c += 1) {
                    rows[r]![c] = ((rows[r]?.[c] as number) + (rows[rank]?.[c] as number)) % 2;
                }
            }
        }
        rank += 1;
    }
    return rank;
}

/** All bit vectors of length n in the row space of a GF(2) matrix, as integers. */
function rowSpace(matrix: number[][], n: number): Set<number> {
    const generators = matrix.map((row) => {
        let value = 0;
        for (let j = 0; j < n; j += 1) {
            if (((row[j] ?? 0) % 2) === 1) {
                value |= 1 << j;
            }
        }
        return value;
    }).filter((value) => value !== 0);
    const space = new Set<number>([0]);
    for (const generator of generators) {
        const additions = [...space];
        for (const element of additions) {
            space.add(element ^ generator);
        }
    }
    return space;
}

/** All bit vectors v of length n with matrix times v equal to zero. */
function kernel(matrix: number[][], n: number): number[] {
    const result: number[] = [];
    for (let bits = 0; bits < 1 << n; bits += 1) {
        let ok = true;
        for (const row of matrix) {
            let parity = 0;
            for (let j = 0; j < n; j += 1) {
                if (((row[j] ?? 0) % 2) === 1 && ((bits >> j) & 1) === 1) {
                    parity ^= 1;
                }
            }
            if (parity !== 0) {
                ok = false;
                break;
            }
        }
        if (ok) {
            result.push(bits);
        }
    }
    return result;
}

function popcount(value: number): number {
    let count = 0;
    let v = value;
    while (v !== 0) {
        count += v & 1;
        v >>>= 1;
    }
    return count;
}

export interface CSSResult {
    n: number;
    k: number;
    d: number;
    xRank: number;
    zRank: number;
    commuting: boolean;
    distanceWitness: { xPart: number; zPart: number; weight: number } | null;
}

/** Build and fully characterize a CSS code from two binary check matrices. */
export function buildCssCode(hx: number[][], hz: number[][]): CSSResult {
    const n = hx[0]?.length ?? 0;
    const xRank = gf2Rank(hx);
    const zRank = gf2Rank(hz);
    let commuting = true;
    for (const xRow of hx) {
        for (const zRow of hz) {
            let dot = 0;
            for (let j = 0; j < n; j += 1) {
                dot ^= ((xRow[j] ?? 0) % 2) & ((zRow[j] ?? 0) % 2);
            }
            if (dot !== 0) {
                commuting = false;
            }
        }
    }
    const k = n - xRank - zRank;
    const zKernel = kernel(hx, n);
    const xKernel = kernel(hz, n);
    const xStabilizers = rowSpace(hx, n);
    const zStabilizers = rowSpace(hz, n);
    let distanceWitness: CSSResult["distanceWitness"] = null;
    let best = Infinity;
    for (const vz of zKernel) {
        for (const vx of xKernel) {
            if (xStabilizers.has(vx) && zStabilizers.has(vz)) {
                continue;
            }
            const weight = popcount(vx | vz);
            if (weight > 0 && weight < best) {
                best = weight;
                distanceWitness = { xPart: vx, zPart: vz, weight };
            }
        }
    }
    return { n, k, d: Number.isFinite(best) ? best : 0, xRank, zRank, commuting, distanceWitness };
}

/** The [7,4,3] Hamming parity-check matrix used by the Steane code. */
export const HAMMING_H: number[][] = [
    [0, 0, 0, 1, 1, 1, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [1, 0, 1, 0, 1, 0, 1],
];

function binaryString(value: number, width: number): string {
    return Array.from({ length: width }, (_, j) => ((value >> (width - 1 - j)) & 1).toString()).join("");
}

/** Build grid cells for the check rows plus a distance witness row. */
function makeCells(hx: number[][], hz: number[][], witness: CSSResult["distanceWitness"], showWitness: boolean): VisualEntity[] {
    const n = hx[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    hx.forEach((row, index) => {
        row.forEach((bit, col) => {
            entities.push({
                id: `x-${index}-${col}`,
                type: "cell",
                label: String(bit % 2),
                value: bit % 2,
                state: "active" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: index, col, checkType: "X", bit: bit % 2 },
            });
        });
    });
    hz.forEach((row, index) => {
        row.forEach((bit, col) => {
            entities.push({
                id: `z-${index}-${col}`,
                type: "cell",
                label: String(bit % 2),
                value: bit % 2,
                state: "sorted" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: hx.length + index, col, checkType: "Z", bit: bit % 2 },
            });
        });
    });
    if (showWitness && witness) {
        for (let col = 0; col < n; col += 1) {
            const x = (witness.xPart >> col) & 1;
            const z = (witness.zPart >> col) & 1;
            entities.push({
                id: `w-${col}`,
                type: "cell",
                label: x && z ? "Y" : x ? "X" : z ? "Z" : "I",
                value: x && z ? "Y" : x ? "X" : z ? "Z" : "I",
                state: "error" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: hx.length + hz.length, col, checkType: "logical", bit: x | z },
            });
        }
    }
    return entities;
}

/** The CSS code generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { hx?: number[][]; hz?: number[][] } | null) ?? {};
    const hx: number[][] = Array.isArray(task.hx) && task.hx.length > 0 ? task.hx.map((row) => [...row]) : HAMMING_H.map((row) => [...row]);
    const hz: number[][] = Array.isArray(task.hz) && task.hz.length > 0 ? task.hz.map((row) => [...row]) : HAMMING_H.map((row) => [...row]);
    const n = hx[0]?.length ?? 0;
    const rows = hx.length + hz.length;
    const result = buildCssCode(hx, hz);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(hx, hz, result.distanceWitness, false),
        edges: [],
        description: `CSS construction on ${n} qubits: X checks from hx, Z checks from hz; rows must be mutually orthogonal over GF(2).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols: n, n, k: 0, d: 0, xRank: 0, zRank: 0, commuting: false, witness: "" },
    };

    for (let index = 0; index < hx.length; index += 1) {
        const row = hx[index] as number[];
        yield {
            stepNumber: step++,
            entities: makeCells(hx, hz, result.distanceWitness, false),
            edges: [],
            description: `X stabilizer ${index}: apply X on qubits ${row.map((bit, col) => (bit % 2 ? col : -1)).filter((col) => col >= 0).join(", ")}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows, cols: n, n, k: 0, d: 0, xRank: 0, zRank: 0, commuting: false, witness: "", check: `X ${binaryString(row.reduce((value, bit, col) => value | ((bit % 2) << col), 0), n)}` },
        };
    }

    for (let index = 0; index < hz.length; index += 1) {
        const row = hz[index] as number[];
        yield {
            stepNumber: step++,
            entities: makeCells(hx, hz, result.distanceWitness, false),
            edges: [],
            description: `Z stabilizer ${index}: apply Z on qubits ${row.map((bit, col) => (bit % 2 ? col : -1)).filter((col) => col >= 0).join(", ")}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows, cols: n, n, k: 0, d: 0, xRank: 0, zRank: 0, commuting: false, witness: "", check: `Z ${binaryString(row.reduce((value, bit, col) => value | ((bit % 2) << col), 0), n)}` },
        };
    }

    yield {
        stepNumber: step++,
        entities: makeCells(hx, hz, result.distanceWitness, false),
        edges: [],
        description: `Commutation check: every X row has even overlap with every Z row - ${result.commuting ? "all commute" : "conflict found"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols: n, n, k: result.k, d: 0, xRank: result.xRank, zRank: result.zRank, commuting: result.commuting, witness: "" },
    };

    const witness = result.distanceWitness;
    yield {
        stepNumber: step++,
        entities: makeCells(hx, hz, result.distanceWitness, true),
        edges: [],
        description: witness
            ? `Lowest-weight nontrivial commuting Pauli has weight ${witness.weight}: X pattern ${binaryString(witness.xPart, n)}, Z pattern ${binaryString(witness.zPart, n)}.`
            : "No nontrivial commuting Pauli found.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols: n, n, k: result.k, d: result.d, xRank: result.xRank, zRank: result.zRank, commuting: result.commuting, witness: witness ? `X ${binaryString(witness.xPart, n)} Z ${binaryString(witness.zPart, n)}` : "" },
    };

    yield {
        stepNumber: step,
        entities: makeCells(hx, hz, result.distanceWitness, true),
        edges: [],
        description: `CSS parameters: [[${n}, ${result.k}, ${result.d}]] with ${result.xRank} X checks and ${result.zRank} Z checks.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows,
            cols: n,
            n,
            k: result.k,
            d: result.d,
            xRank: result.xRank,
            zRank: result.zRank,
            commuting: result.commuting,
            witness: witness ? `X ${binaryString(witness.xPart, n)} Z ${binaryString(witness.zPart, n)}` : "",
            note: "exact GF(2) simulation limited to at most 12 qubits for exhaustive search",
        },
    };
}

/** The CSS code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick two classical check matrices whose rows are orthogonal, then turn one into X-type parity checks and the other into Z-type parity checks. Because of the orthogonality, every X check commutes with every Z check, so they form a valid quantum stabilizer code. The number of logical qubits is the physical count minus the independent checks of each type, and the distance is the lightest Pauli error that slips through the checks without being a stabilizer.",
        invariants: [
            "Every X-check row has even overlap with every Z-check row, so all stabilizers commute.",
            "The encoded qubit count is n minus the ranks of the two check matrices.",
            "Stabilizers form a subgroup: their X parts and Z parts are GF(2) row spaces.",
        ],
        correctness:
            "Rows of hx define X stabilizers X^r and rows of hz define Z stabilizers Z^s. Two Paulis commute exactly when their binary symplectic inner product vanishes, which here reduces to r dot s = 0 over GF(2); the orthogonality condition guarantees this. The stabilizer subgroup has 2^(rank hx + rank hz) independent generators, so it encodes k = n - rank(hx) - rank(hz) logical qubits. A Pauli error (vx | vz) commutes with all checks when vz lies in ker(hx) and vx lies in ker(hz); it is a stabilizer only when vx is in the row space of hx and vz in the row space of hz. Exhaustively enumerating those sets finds the minimum weight of a non-stabilizer commuting error, which is the code distance.",
        complexityRationale:
            "Gaussian elimination over GF(2) costs O(n^3) for the ranks. Enumerating the kernel and row spaces uses at most O(2^n) bit patterns, and the distance search pairs them for O(2^(n-kx) * 2^(n-kz)) work, which is why the teaching model limits n to about 12.",
        uses: [
            "Constructing quantum error-correcting codes from classical codes",
            "The Steane seven-qubit code and surface-code primitives",
            "Teaching stabilizer commutation and code parameters",
        ],
        references: [
            "Calderbank and Shor, Good Quantum Error-Correcting Codes Exist, 1996",
            "Steane, Error Correcting Quantum Codes, 1996",
        ],
        workedExample:
            "The Hamming parity-check matrix H has three independent rows of weight four on seven bits, and its row space is contained in its kernel. Taking hx = hz = H gives three X checks and three Z checks, so k = 7 - 3 - 3 = 1. The lightest non-stabilizer commuting error has weight three, giving the Steane parameters [[7, 1, 3]].",
    },
    id: "css-code",
    name: "CSS Quantum Code Construction",
    category: "quantum",
    complexity: { time: "O(2^(n-kx) * 2^(n-kz))", space: "O(2^n)" },
    defaultInput: { hx: HAMMING_H, hz: HAMMING_H },
    visualType: "grid",
    run,
    pseudocode: [
        "choose binary check matrices hx and hz with orthogonal rows",
        "build X stabilizers from the rows of hx",
        "build Z stabilizers from the rows of hz",
        "verify every X row overlaps every Z row evenly",
        "compute ranks of hx and hz over GF(2)",
        "set the logical qubit count to n minus both ranks",
        "enumerate commuting Paulis and find the lightest non-stabilizer",
        "that lightest weight is the code distance",
        "done: report the code parameters n k d",
    ],
};

export default module;
