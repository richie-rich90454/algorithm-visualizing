/**
 * surface-code-error-correction.ts - Surface Code Error Correction (Small Toy Simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A surface code stores one logical qubit in a lattice of physical data
 * qubits. Z-type stabilizer checks measure the parity of the four data qubits
 * around each plaquette; a single X error flips the parity of the checks that
 * touch it, producing a syndrome. A decoder searches for the smallest error
 * pattern consistent with that syndrome and applies it as a correction.
 *
 * This is a small, exact toy simulator: the lattice holds at most 16 data
 * qubits and the decoder brute-forces every error pattern to find a true
 * minimum-weight solution. The mathematical step (syndrome extraction and
 * minimum-weight decoding) is exact, but this is NOT a fault-tolerant device:
 * it ignores measurement noise, Y errors, logical operators, and real
 * minimum-weight-perfect-matching decoding. It is a teaching model only.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n * p) for n data qubits and p plaquettes in the toy decoder
 *   Space: O(n + p) for the lattice, syndrome, and best pattern
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Data qubits are nodes on an integer grid; plaquette checks sit between.
 *   - A red data qubit carries an X error; a red check is a violated syndrome.
 *   - The final frame shows the residual flips after applying the correction.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SurfaceInput {
    rows?: number;
    cols?: number;
    errors?: number[];
}

interface Lattice {
    rows: number;
    cols: number;
    n: number;
    errors: number[];
    plaquettes: number[][];
}

/** Read and clamp the input into a small lattice plus a set of X errors. */
function normalize(input: unknown): Lattice {
    const task = (input as SurfaceInput | null) ?? {};
    const rows = Math.min(4, Math.max(2, Math.floor(Number(task.rows ?? 3)) || 3));
    const cols = Math.min(4, Math.max(2, Math.floor(Number(task.cols ?? 3)) || 3));
    const n = rows * cols;
    const raw = Array.isArray(task.errors)
        ? task.errors.map((e) => Math.abs(Math.floor(Number(e))) % n)
        : [Math.floor(n / 2)];
    const errors = [...new Set(raw)].sort((a, b) => a - b);
    const plaquettes: number[][] = [];
    for (let r = 0; r < rows - 1; r += 1) {
        for (let c = 0; c < cols - 1; c += 1) {
            plaquettes.push([
                r * cols + c,
                r * cols + c + 1,
                (r + 1) * cols + c,
                (r + 1) * cols + c + 1,
            ]);
        }
    }
    return { rows, cols, n, errors, plaquettes };
}

/** Parity of X errors on the four data qubits around every plaquette. */
function syndromeOf(bits: number[], plaquettes: number[][]): number[] {
    return plaquettes.map((block) => {
        let parity = 0;
        for (const q of block) {
            parity += bits[q] ?? 0;
        }
        return parity % 2;
    });
}

/** Brute-force the minimum-weight pattern with a given syndrome (exact). */
function minWeightDecode(target: number[], plaquettes: number[][], n: number): number[] {
    const key = target.join("");
    let best = new Array<number>(n).fill(0);
    let bestWeight = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 1 << n; mask += 1) {
        let weight = 0;
        for (let i = 0; i < n; i += 1) {
            weight += (mask >> i) & 1;
        }
        if (weight >= bestWeight) {
            continue;
        }
        const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
        if (syndromeOf(bits, plaquettes).join("") === key) {
            best = bits;
            bestWeight = weight;
        }
    }
    return best;
}

function population(bits: number[]): number {
    return bits.reduce((sum, b) => sum + b, 0);
}

/** Build data-qubit and plaquette nodes for one frame. */
function makeEntities(
    lattice: Lattice,
    syndrome: number[],
    correction: number[],
    phase: "idle" | "error" | "syndrome" | "correct" | "done",
): VisualEntity[] {
    const { cols, n, errors, plaquettes } = lattice;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        let state: EntityState = "idle";
        if (phase === "error" || phase === "syndrome") {
            state = errors.includes(i) ? "error" : "idle";
        } else if (phase === "correct") {
            state = correction[i] ? "comparing" : "idle";
        } else if (phase === "done") {
            const residual = (errors.includes(i) ? 1 : 0) ^ (correction[i] ?? 0);
            state = residual ? "error" : "sorted";
        }
        entities.push({
            id: `q-${i}`,
            type: "node",
            label: `q${i}`,
            value: errors.includes(i) ? 1 : 0,
            state,
            x: i % cols,
            y: Math.floor(i / cols),
            width: 0,
            height: 0,
            metadata: { index: i, row: Math.floor(i / cols), col: i % cols, kind: "data" },
        });
    }
    for (let k = 0; k < plaquettes.length; k += 1) {
        const showSyndrome = phase === "syndrome" || phase === "correct" || phase === "done";
        entities.push({
            id: `s-${k}`,
            type: "node",
            label: `S${k}`,
            value: showSyndrome ? (syndrome[k] ?? 0) : 0,
            state: showSyndrome && syndrome[k] ? "error" : "idle",
            x: (k % (cols - 1)) + 0.5,
            y: Math.floor(k / (cols - 1)) + 0.5,
            width: 0,
            height: 0,
            metadata: { index: k, row: Math.floor(k / (cols - 1)), col: k % (cols - 1), kind: "check" },
        });
    }
    return entities;
}

/** The small surface-code decoder generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const lattice = normalize(input);
    const { rows, cols, n, errors, plaquettes } = lattice;
    const errorBits = Array.from({ length: n }, (_, i) => (errors.includes(i) ? 1 : 0));
    const zeroSyndrome = new Array<number>(plaquettes.length).fill(0);
    const syndrome = syndromeOf(errorBits, plaquettes);
    const correction = minWeightDecode(syndrome, plaquettes, n);
    const residual = errorBits.map((bit, i) => bit ^ (correction[i] ?? 0));
    const cleared = syndromeOf(residual, plaquettes);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(lattice, zeroSyndrome, correction, "idle"),
        edges: [],
        description: `Preparing a ${rows} by ${cols} surface-code patch with ${n} data qubits and ${plaquettes.length} stabilizer checks.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { rows, cols, qubits: n, checks: plaquettes.length, errors: [...errors], syndrome: zeroSyndrome, correction: new Array<number>(n).fill(0), residual: new Array<number>(n).fill(0) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(lattice, zeroSyndrome, correction, "error"),
        edges: [],
        description: `X errors are injected on qubit(s) ${errors.join(", ") || "none"}. A red qubit has flipped.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { rows, cols, qubits: n, checks: plaquettes.length, errors: [...errors], syndrome: zeroSyndrome, correction: new Array<number>(n).fill(0), residual: errorBits },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(lattice, syndrome, correction, "syndrome"),
        edges: [],
        description: `Measuring Z stabilizers gives the syndrome ${syndrome.join("")}; a red check was flipped by an adjacent X error.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { rows, cols, qubits: n, checks: plaquettes.length, errors: [...errors], syndrome: [...syndrome], correction: new Array<number>(n).fill(0), residual: errorBits },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(lattice, syndrome, correction, "correct"),
        edges: [],
        description: `Minimum-weight decoding finds a weight-${population(correction)} correction consistent with the syndrome.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { rows, cols, qubits: n, checks: plaquettes.length, errors: [...errors], syndrome: [...syndrome], correction: [...correction], residual: errorBits },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(lattice, cleared, correction, "done"),
        edges: [],
        description: `Applying the correction clears every syndrome; residual flips remain on ${population(residual)} qubit(s). Exact toy decoder, not fault-tolerant hardware.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { rows, cols, qubits: n, checks: plaquettes.length, errors: [...errors], syndrome: [...cleared], correction: [...correction], residual: [...residual], correctionWeight: population(correction), residualWeight: population(residual) },
    };
}

/** The surface-code teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a checkerboard of parity checks laid over the data qubits. An error on one qubit flips only the neighboring checks, so the pattern of red checks tells you roughly where the error happened. The decoder guesses the smallest set of qubits that could have produced exactly that pattern, then flips those qubits again to cancel the damage.",
        invariants: [
            "A plaquette check is violated exactly when an odd number of its data qubits carry an X error.",
            "The chosen correction has the same syndrome as the injected error pattern.",
            "Applying the correction XORs it with the error, so every measured syndrome becomes zero.",
        ],
        correctness:
            "Syndrome extraction is linear over the bits: the syndrome of the XOR of two error patterns is the XOR of their syndromes. Because the decoder picks a correction with an identical syndrome, the residual error has zero syndrome and all checks read out clear. Searching all 2^n patterns and taking the smallest consistent weight guarantees a true minimum-weight correction for this small lattice.",
        complexityRationale:
            "The decoder enumerates all 2^n error patterns and, for each candidate, evaluates p plaquette parities, giving O(2^n * p) time. Storing the lattice, syndrome, and best pattern uses O(n + p) space. Real decoders replace the brute-force search with minimum-weight perfect matching.",
        uses: [
            "A teaching model for how stabilizer measurements detect errors",
            "Introducing the idea of syndrome decoding and minimum-weight recovery",
            "A stepping stone toward understanding logical qubits and distance",
        ],
        references: [
            "Kitaev, Fault-tolerant Quantum Computation by Anyons, 2003",
            "Fowler et al., Surface Codes: Towards Practical Large-Scale Quantum Computation, 2012",
        ],
        workedExample:
            "On a 3 by 3 patch, an X error on the center qubit flips the four surrounding plaquettes. The decoder finds that same single-qubit pattern as the unique weight-one explanation, applies X there again, and clears every check. A paired set of errors that forms a full stabilizer may leave zero syndrome, which is the seed of a logical error.",
    },
    id: "surface-code-error-correction",
    name: "Surface Code Error Correction (Small Toy Simulator)",
    category: "quantum",
    complexity: { time: "O(2^n * p)", space: "O(n + p)" },
    defaultInput: { rows: 3, cols: 3, errors: [4] },
    visualType: "point",
    run,
    pseudocode: [
        "lay out data qubits and Z plaquette checks",
        "inject X errors on the requested data qubits",
        "measure each plaquette to build the syndrome",
        "search all patterns for the smallest with that syndrome",
        "apply the correction and clear every syndrome bit",
    ],
};

export default module;
