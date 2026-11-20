/**
 * quantum-ldpc-code.ts - Quantum LDPC Code Syndrome Decoding (Steane [[7,1,3]])
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum LDPC codes are stabilizer codes whose parity checks each involve
 * only a few qubits. The Steane [[7,1,3]] CSS code is a compact example built
 * from the [7,4,3] classical Hamming code: its three X checks and three Z
 * checks are the rows of the same sparse parity matrix H. A bit-flip error is
 * detected by the Z checks and a phase-flip error by the X checks; the
 * resulting three-bit syndrome names exactly one column of H, and that column
 * identifies the erroneous qubit. Flipping that qubit repairs the code state.
 *
 * This is a deterministic simulation of the syndrome extraction and minimum-
 * weight decoding, not a full quantum channel simulation. It tracks binary X
 * and Z error flags and their parity-check syndromes; it does not track
 * amplitudes, measurement shot noise, or fault-tolerant circuits.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r * n) for r checks and n qubits during syndrome extraction
 *   Space: O(r * n) for the stored check matrix and error vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cell (check, qubit) shows a 1 when that check covers that qubit.
 *   - The erroneous qubit's column turns yellow, the decoded column green.
 *   - meta carries the binary syndromes, decoded positions, and success flag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Parity-check matrix of the [7,4,3] Hamming code (rows are checks, columns are qubits). */
const H: number[][] = [
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 1, 1],
];

/** Build the parity-check grid. */
function makeCells(
    highlightColumn: number,
    decodedColumn: number,
    phase: "init" | "syndrome" | "decode" | "done",
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < H.length; r += 1) {
        for (let q = 0; q < H[0]!.length; q += 1) {
            let state: EntityState = H[r]![q] === 1 ? "idle" : "unvisited";
            if (phase === "syndrome" && q === highlightColumn) {
                state = "comparing";
            } else if (phase === "decode" && q === highlightColumn) {
                state = "active";
            } else if (phase === "done") {
                state = q === decodedColumn ? "sorted" : H[r]![q] === 1 ? "idle" : "unvisited";
            }
            entities.push({
                id: `cell-${r}-${q}`,
                type: "cell",
                label: String(H[r]![q]),
                value: H[r]![q] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: q, check: r, qubit: q, bit: H[r]![q] },
            });
        }
    }
    return entities;
}

/** Compute the parity syndrome of a binary error vector under H. */
function syndrome(error: number[]): number[] {
    return H.map((row) => row.reduce((sum, bit, q) => sum + bit * (error[q] ?? 0), 0) % 2);
}

/** Find the qubit whose H column equals the given nonzero syndrome, or -1. */
function locate(syndromeBits: number[]): number {
    if (syndromeBits.every((bit) => bit === 0)) {
        return -1;
    }
    for (let q = 0; q < H[0]!.length; q += 1) {
        if (H.every((row, r) => row[q] === syndromeBits[r])) {
            return q;
        }
    }
    return -1;
}

/** The quantum LDPC decoder generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { errorQubit?: number; errorType?: string; xError?: number[]; zError?: number[] }
        | null
    ) ?? {};
    const n = H[0]!.length;
    const errorQubit = Math.floor(Number(task.errorQubit ?? 3));
    const errorType = typeof task.errorType === "string" ? task.errorType.toUpperCase() : "X";
    const xError: number[] = Array.from({ length: n }, () => 0);
    const zError: number[] = Array.from({ length: n }, () => 0);
    if (Array.isArray(task.xError) && task.xError.length === n && Array.isArray(task.zError) && task.zError.length === n) {
        for (let q = 0; q < n; q += 1) {
            xError[q] = task.xError[q] ? 1 : 0;
            zError[q] = task.zError[q] ? 1 : 0;
        }
    } else if (errorQubit >= 0 && errorQubit < n) {
        if (errorType === "X" || errorType === "Y") {
            xError[errorQubit] = 1;
        }
        if (errorType === "Z" || errorType === "Y") {
            zError[errorQubit] = 1;
        }
    }

    const sx = syndrome(xError);
    const sz = syndrome(zError);
    const decodedX = locate(sx);
    const decodedZ = locate(sz);

    const correctedX = [...xError];
    const correctedZ = [...zError];
    if (decodedX >= 0) {
        correctedX[decodedX] = (correctedX[decodedX] ?? 0) ^ 1;
    }
    if (decodedZ >= 0) {
        correctedZ[decodedZ] = (correctedZ[decodedZ] ?? 0) ^ 1;
    }
    const residualX = syndrome(correctedX);
    const residualZ = syndrome(correctedZ);
    const success = residualX.every((bit) => bit === 0) && residualZ.every((bit) => bit === 0);
    const highlight = decodedX >= 0 ? decodedX : decodedZ;

    const meta = (phase: string, done: boolean) => ({
        rows: H.length,
        cols: n,
        n,
        checks: H.length,
        k: n - 2 * H.length,
        xError: [...xError],
        zError: [...zError],
        sx,
        sz,
        decodedX,
        decodedZ,
        residualX,
        residualZ,
        success,
        distance: 3,
        phase,
        done,
        note: "Steane [[7,1,3]] CSS code: sparse Hamming checks, binary syndrome decoding; not a full amplitude simulation",
    });

    yield {
        stepNumber: 0,
        entities: makeCells(-1, -1, "init"),
        edges: [],
        description: `Steane [[7,1,3]] quantum LDPC code: ${H.length} sparse X checks and ${H.length} Z checks over ${n} qubits.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("init", false),
    };

    yield {
        stepNumber: 1,
        entities: makeCells(highlight, -1, "syndrome"),
        edges: [],
        description: `Z checks report bit-flip syndrome [${sx.join(" ")}] and X checks report phase-flip syndrome [${sz.join(" ")}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: meta("syndrome", false),
    };

    yield {
        stepNumber: 2,
        entities: makeCells(highlight, -1, "decode"),
        edges: [],
        description: `Matching each syndrome to a column of H locates the X error at qubit ${decodedX} and the Z error at qubit ${decodedZ}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta("decode", false),
    };

    yield {
        stepNumber: 3,
        entities: makeCells(highlight, decodedX >= 0 ? decodedX : decodedZ, "done"),
        edges: [],
        description: success
            ? `Correction cleared both syndromes; the code state is restored.`
            : `Residual syndromes remain after decoding; this error pattern exceeds the single-error correction distance.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta("done", true),
    };
}

/** The quantum LDPC code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A stabilizer code stores one logical qubit in several physical qubits and watches it with parity checks that each touch only a few qubits. In the Steane code, the same sparse classical Hamming matrix supplies both kinds of checks. Each possible single-qubit error produces a unique short syndrome, like a lookup code that names the faulty qubit, so measuring the syndrome tells us exactly what to flip to repair the state.",
        invariants: [
            "Each check is the parity of the qubits whose H column entry is one.",
            "Every nonzero three-bit syndrome equals exactly one column of the Hamming matrix.",
            "Applying the decoded flip clears the syndrome when the error weight is within the code distance.",
        ],
        correctness:
            "The columns of the Hamming parity matrix are all distinct nonzero three-bit vectors, so the map from a single-qubit error to its syndrome is injective. Bit-flip errors are detected by the Z checks and phase-flip errors by the X checks; an arbitrary single-qubit error is a combination of both and produces both syndromes. Matching each syndrome to its column identifies the qubit, and flipping that qubit cancels the error, returning the state to the code space. Because the code has distance three, any single-qubit error is corrected, while two-qubit errors may not be.",
        complexityRationale:
            "Syndrome extraction multiplies the r by n check matrix by the length-n error vector, costing O(r * n) per syndrome and O(r * n) overall. Storing the check matrix and error vectors uses O(r * n) space, which is sparse for real quantum LDPC families.",
        uses: [
            "Fault-tolerant quantum memory with low-weight checks",
            "A teaching example of CSS and stabilizer codes",
            "The foundation of modern quantum LDPC code constructions",
        ],
        references: [
            "Steane, Error Correcting Quantum Codes, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "With an X error on qubit 3, the bit-flip syndrome is column 3 of H, namely [0, 0, 1]. The decoder matches that syndrome to qubit 3 and flips it back; the residual syndrome is zero and the state is restored. A phase error on the same qubit is caught independently by the X checks using the same column pattern.",
    },
    id: "quantum-ldpc-code",
    name: "Quantum LDPC Code (Steane [[7,1,3]])",
    category: "quantum",
    complexity: { time: "O(r * n)", space: "O(r * n)" },
    defaultInput: { errorQubit: 3, errorType: "X" },
    visualType: "grid",
    run,
    pseudocode: [
        "store the sparse parity matrix H for the X and Z checks",
        "record the bit-flip and phase-flip error vectors",
        "compute the bit-flip syndrome as H times the X error mod two",
        "compute the phase-flip syndrome as H times the Z error mod two",
        "match each nonzero syndrome to the matching column of H",
        "flip the identified qubit for each error type",
        "recompute the syndromes and confirm they are zero",
        "done: report the decoded qubit and whether correction succeeded",
    ],
};

export default module;
