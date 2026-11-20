/**
 * color-code.ts - Distance-3 Triangular Color Code (Syndrome Decoding Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The smallest two-dimensional color code is the seven-qubit triangular code
 * equivalent to the Steane code. Data qubits sit at the vertices and faces of
 * a triangle, and six stabilizer checks (three X-type and three Z-type
 * plaquettes) each overlap an even number of qubits. In a CSS code a bit-flip
 * (X) error is detected by the Z checks and a phase-flip (Z) error by the X
 * checks. Because each qubit belongs to a unique nonempty subset of the three
 * Z checks, its syndrome pattern identifies it uniquely. This module simulates
 * a single X or Z error, measures the syndrome, looks up the offending qubit,
 * applies the correction, and verifies that all checks return to zero.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(q) per syndrome extraction for q = 7 checks on 7 qubits
 *   Space: O(q) for the error pattern and syndrome bits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each data qubit's error flag (1 means X or Z error present).
 *   - The faulty qubit is red, the syndrome highlight is yellow, and a clean
 *     final state is green.
 *   - The final frame reports the syndrome, identified qubit, and correction.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ColorCodeInput {
    error?: number;
    type?: "X" | "Z";
}

/** The three plaquettes; X-checks and Z-checks share these supports. */
const PLAQUETTES: number[][] = [
    [0, 2, 4, 6],
    [1, 2, 5, 6],
    [3, 4, 5, 6],
];
const QUBITS = 7;

/** Map a syndrome bitmask to the qubit whose check membership it matches. */
function lookup(mask: number): number {
    for (let q = 0; q < QUBITS; q += 1) {
        let m = 0;
        for (let p = 0; p < PLAQUETTES.length; p += 1) {
            if (PLAQUETTES[p]!.includes(q)) m |= 1 << p;
        }
        if (m === mask) return q;
    }
    return -1;
}

/** Measure a syndrome from a subset of qubits carrying errors. */
function measure(errors: Set<number>): number {
    let mask = 0;
    for (let p = 0; p < PLAQUETTES.length; p += 1) {
        let parity = 0;
        for (const q of PLAQUETTES[p]!) {
            if (errors.has(q)) parity ^= 1;
        }
        if (parity === 1) mask |= 1 << p;
    }
    return mask;
}

function makeBars(errors: Set<number>, syndromeQubit: number, done: boolean): VisualEntity[] {
    return Array.from({ length: QUBITS }, (_, q) => {
        const hasError = errors.has(q);
        const state: EntityState = done ? "sorted" : q === syndromeQubit ? "comparing" : hasError ? "error" : "idle";
        return {
            id: `bar-${q}`,
            type: "bar" as const,
            label: `q${q}${hasError ? " error" : ""}`,
            value: hasError ? 1 : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: q, error: hasError },
        };
    });
}

/** The color code syndrome-decoding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ColorCodeInput | null) ?? {};
    const error = typeof task.error === "number" ? Math.floor(task.error) : 2;
    const errorQubit = error >= 0 && error < QUBITS ? error : -1;
    const type = task.type === "Z" ? "Z" : "X";
    const errors = new Set<number>();
    let step = 0;

    const meta = (stage: string, syndrome: number, identified: number, corrected: boolean, done: boolean) => ({
        qubits: QUBITS,
        checks: PLAQUETTES.length,
        errorQubit,
        errorType: type,
        stage,
        syndrome,
        identified,
        corrected,
        clean: errors.size === 0,
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(errors, -1, false),
        edges: [],
        description: `Distance-3 color code with ${QUBITS} qubits and ${PLAQUETTES.length} plaquette checks; all stabilizers read zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("ready", 0, -1, false, false),
    };

    if (errorQubit >= 0) errors.add(errorQubit);
    yield {
        stepNumber: step++,
        entities: makeBars(errors, errorQubit, false),
        edges: [],
        description: errorQubit >= 0
            ? `A single ${type} error occurs on qubit ${errorQubit}.`
            : "No error occurred; the syndrome will be zero.",
        codeLineNumber: 2,
        layout: "array",
        meta: meta("error", 0, -1, false, false),
    };

    const syndrome = measure(errors);
    yield {
        stepNumber: step++,
        entities: makeBars(errors, -1, false),
        edges: [],
        description: syndrome === 0
            ? `All ${type} checks read even parity; no error is flagged.`
            : `${type} plaquette checks report syndrome bits ${syndrome.toString(2).padStart(3, "0")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta("syndrome", syndrome, -1, false, false),
    };

    const identified = syndrome === 0 ? -1 : lookup(syndrome);
    yield {
        stepNumber: step++,
        entities: makeBars(errors, identified, false),
        edges: [],
        description: identified >= 0
            ? `The syndrome pattern maps uniquely to qubit ${identified}.`
            : "Zero syndrome needs no correction.",
        codeLineNumber: 5,
        layout: "array",
        meta: meta("identify", syndrome, identified, false, false),
    };

    if (identified >= 0) errors.delete(identified);
    const after = measure(errors);
    yield {
        stepNumber: step,
        entities: makeBars(errors, -1, true),
        edges: [],
        description: after === 0
            ? `Applied ${type} correction on qubit ${identified}; all checks read zero and the state is restored.`
            : "Correction did not clear the syndrome.",
        codeLineNumber: 6,
        layout: "array",
        meta: meta("corrected", after, identified, identified >= 0, true),
    };
}

/** The color code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A color code stores a logical qubit in a patch of qubits and watches parity checks around each colored face. A single physical error flips the parity of exactly the faces touching that qubit, producing a syndrome. On the seven-qubit triangle every qubit has a different pattern of face memberships, so the syndrome is a unique address for the error. Correct that qubit and the patch is whole again.",
        invariants: [
            "Each of the three Z checks and three X checks overlaps an even number of qubits, so X and Z stabilizers commute.",
            "Every data qubit belongs to a distinct nonempty subset of the three checks.",
            "A single-qubit error flips exactly the checks whose plaquette contains that qubit.",
        ],
        correctness:
            "For a CSS color code, an X error anticommutes only with Z checks, so the measured Z syndrome is the incidence vector of the error location across the three plaquettes. Because the seven qubits realize the seven distinct nonzero three-bit incidence vectors, the syndrome uniquely determines the faulty qubit. Applying the same Pauli correction cancels the error, and the syndrome returns to zero. The steady-state stabilizer group is restored, so no logical information changed. The code has distance three, so it corrects any single-qubit Pauli error but not two simultaneous errors.",
        complexityRationale:
            "Extracting a syndrome evaluates three weight-four parity checks, O(q) for q checks on a fixed seven-qubit patch. Storing the error set and syndrome takes O(q) space. Decoding is a constant-time lookup because the syndrome table has one entry per qubit.",
        uses: [
            "Fault-tolerant quantum memory and logical qubits",
            "Topological error correction on neutral-atom and superconducting hardware",
            "A minimal example of CSS stabilizer decoding",
        ],
        references: [
            "Bombin and Martin-Delgado, Topological Quantum Distillation, 2006",
            "Steane, Error Correcting Quantum Codes, 1996",
        ],
        workedExample:
            "Qubit 2 lies in plaquettes 0 and 1 but not 2, so an X error there yields syndrome bits 011. The lookup table maps 011 back to qubit 2. Applying X on qubit 2 cancels the error and every check reads even again. By contrast a zero syndrome means no single error is present.",
    },
    id: "color-code",
    name: "Color Code (Distance-3 Syndrome Decoding)",
    category: "quantum",
    complexity: { time: "O(q)", space: "O(q)" },
    defaultInput: { error: 2, type: "X" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize all stabilizers to even parity",
        "introduce a single X or Z error on one data qubit",
        "measure the three matching plaquette checks",
        "form the syndrome bitmask from odd-parity checks",
        "look up the qubit whose incidence matches that mask",
        "apply the same Pauli correction to the identified qubit",
        "remeasure to confirm the syndrome is zero",
        "done: report the syndrome and correction result",
    ],
};

export default module;
