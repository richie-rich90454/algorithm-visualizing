/**
 * steane-code.ts - Steane [[7,1,3]] Code: Hamming Syndrome Correction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Steane code encodes one logical qubit into seven physical qubits. Its
 * X-type stabilizers are the parity checks of the classical [7,4,3] Hamming
 * code, and its Z-type stabilizers are the checks of the dual code. A single
 * bit-flip (X) error is detected by measuring the three Hamming parity checks;
 * the resulting three-bit syndrome is exactly the binary label of the flipped
 * qubit, so applying X there corrects the error.
 *
 * This simulation carries out that classical side of the CSS code exactly:
 * it enumerates the valid codewords, computes the syndrome of every single-bit
 * error, and corrects it. It does not simulate phase (Z) errors, continuous
 * noise, or full quantum stabilizer measurement circuits; the limit is stated
 * so the model is not mistaken for a fault-tolerant device.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per syndrome (three parity bits) and O(2^4) to list codewords
 *   Space: O(2^7) for a seven-qubit state vector if one is prepared
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Seven bars show the bits of a codeword after an error and after repair.
 *   - The flipped bit is red; the corrected bit turns green.
 *   - The syndrome, error position, and validity are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Columns of the Hamming parity-check matrix are the binary labels 1..7. */
const CHECK_COLUMNS = [1, 2, 3, 4, 5, 6, 7];

/** Hamming syndrome of a seven-bit word (bits 0..6), a value in 0..7. */
export function hammingSyndrome(word: number): number {
    let syndrome = 0;
    for (let qubit = 0; qubit < 7; qubit += 1) {
        if (((word >> qubit) & 1) === 1) syndrome ^= CHECK_COLUMNS[qubit]!;
    }
    return syndrome;
}

/** All 16 codewords of the [7,4,3] Hamming code (syndrome zero). */
export function hammingCodewords(): number[] {
    const words: number[] = [];
    for (let word = 0; word < 1 << 7; word += 1) {
        if (hammingSyndrome(word) === 0) words.push(word);
    }
    return words;
}

export interface CorrectionResult {
    errored: number;
    syndrome: number;
    errorQubit: number;
    corrected: number;
    valid: boolean;
}

/** Correct a single bit-flip error using its Hamming syndrome. */
export function correctBitFlip(codeword: number, errorQubit: number): CorrectionResult {
    const errored = codeword ^ (1 << errorQubit);
    const syndrome = hammingSyndrome(errored);
    const inferred = syndrome === 0 ? -1 : syndrome - 1;
    const corrected = inferred >= 0 ? errored ^ (1 << inferred) : errored;
    return {
        errored,
        syndrome,
        errorQubit: inferred,
        corrected,
        valid: hammingSyndrome(corrected) === 0 && corrected === codeword,
    };
}

/** Bars for a seven-bit word, highlighting an error and its repair. */
function makeBars(word: number, error: number, repaired: boolean): VisualEntity[] {
    return Array.from({ length: 7 }, (_, qubit) => {
        const bit = (word >> qubit) & 1;
        const state: EntityState = repaired
            ? qubit === error
                ? "sorted"
                : "idle"
            : qubit === error
              ? "error"
              : "unvisited";
        return {
            id: `bar-${qubit}`,
            type: "bar" as const,
            label: String(bit),
            value: bit,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: qubit, bit, qubit },
        };
    });
}

/** The Steane code generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { codeword?: number; errorQubit?: number } | null) ?? {};
    const codewords = hammingCodewords();
    const codeword = typeof task.codeword === "number" && hammingSyndrome(task.codeword) === 0
        ? task.codeword
        : codewords[3] ?? 0;
    const errorQubit = typeof task.errorQubit === "number" ? Math.max(0, Math.min(6, Math.floor(task.errorQubit))) : 4;
    const correction = correctBitFlip(codeword, errorQubit);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(codeword, -1, false),
        edges: [],
        description: `Encoding a valid Steane codeword ${codeword.toString(2).padStart(7, "0")} from the Hamming [7,4,3] code.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { codeword, syndrome: 0, codewordCount: codewords.length, errorQubit: -1, valid: true },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(correction.errored, errorQubit, false),
        edges: [],
        description: `A bit-flip error occurs on qubit ${errorQubit}, giving ${correction.errored.toString(2).padStart(7, "0")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { codeword, syndrome: 0, codewordCount: codewords.length, errorQubit, valid: false },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(correction.errored, correction.errorQubit, false),
        edges: [],
        description: `The three parity checks give syndrome ${correction.syndrome} (binary ${correction.syndrome.toString(2).padStart(3, "0")}), naming qubit ${correction.errorQubit}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            codeword,
            syndrome: correction.syndrome,
            codewordCount: codewords.length,
            errorQubit: correction.errorQubit,
            valid: false,
        },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(correction.corrected, correction.errorQubit, true),
        edges: [],
        description: `Applying X to qubit ${correction.errorQubit} restores ${correction.corrected.toString(2).padStart(7, "0")}, a valid codeword.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            codeword,
            syndrome: 0,
            codewordCount: codewords.length,
            errorQubit: correction.errorQubit,
            valid: correction.valid,
        },
    };

    yield {
        stepNumber: step,
        entities: makeBars(correction.corrected, -1, true),
        edges: [],
        description: correction.valid
            ? "Error corrected: all parity checks pass and the original codeword is restored."
            : "Correction failed to restore the codeword.",
        codeLineNumber: 6,
        layout: "array",
        meta: {
            codeword,
            syndrome: hammingSyndrome(correction.corrected),
            codewordCount: codewords.length,
            errorQubit: -1,
            valid: correction.valid,
        },
    };
}

/** The Steane code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Spread one logical bit across seven physical qubits so that a single mistake leaves a recognizable fingerprint. Three parity checks act like a three-bit address: their combined result points straight at the qubit that flipped. Flip that qubit back and the original codeword is restored without ever measuring the encoded information itself.",
        invariants: [
            "Every valid codeword has syndrome zero under the three Hamming checks.",
            "A single bit-flip error produces a nonzero syndrome equal to the binary label of the bad qubit.",
            "The eight nonzero syndromes are distinct, so the error location is unambiguous.",
        ],
        correctness:
            "The parity-check columns are the binary labels 1 through 7, which are distinct and nonzero. A single error on qubit e contributes exactly its column to the syndrome, so the syndrome equals e + 1 and uniquely identifies e. Applying X to that qubit toggles the same bit back, returning the original codeword, whose syndrome is zero. Because the checks span only the error space and not the logical operators, the correction leaves the encoded logical state intact.",
        complexityRationale:
            "Computing a syndrome XORs three parity bits, and correction flips one bit, so both are constant time. Enumerating all codewords scans 2^7 words once; a full seven-qubit state vector would use 2^7 amplitudes.",
        uses: [
            "Protecting logical qubits in early fault-tolerant architectures",
            "A teaching bridge from classical Hamming codes to quantum CSS codes",
            "Transversal logical gates in the Steane code family",
        ],
        references: [
            "Steane, Error Correcting Quantum Codes, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "Take the valid codeword 0000111. A bit flip on qubit 4 yields syndrome 101 (binary five), pointing to qubit 4. Applying X there restores 0000111, and all three checks read zero again.",
    },
    id: "steane-code",
    name: "Steane Code (Hamming Syndrome)",
    category: "quantum",
    complexity: { time: "O(1) per syndrome", space: "O(2^7) state vector" },
    defaultInput: { codeword: 7, errorQubit: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "list the seven-bit codewords of the Hamming code",
        "choose a valid codeword as the encoded state",
        "introduce a single bit-flip error on one qubit",
        "measure the three parity checks to form the syndrome",
        "read the syndrome as the binary label of the bad qubit",
        "apply a bit flip to that qubit to correct the error",
        "verify the syndrome is zero and the codeword is restored",
        "done: report the corrected seven-bit codeword",
    ],
};

export default module;
