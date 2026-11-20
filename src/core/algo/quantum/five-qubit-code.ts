/**
 * five-qubit-code.ts - The [[5,1,3]] Perfect Quantum Error-Correcting Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The five-qubit code is the smallest code that corrects any single-qubit Pauli
 * error. It encodes one logical qubit in five physical qubits using four
 * stabilizer generators. A Pauli error anticommutes with a subset of the
 * generators, producing a four-bit syndrome that uniquely identifies which of
 * the fifteen non-identity single-qubit errors occurred. Applying that same
 * Pauli (each is self-inverse up to phase) restores the encoded state.
 *
 * This is an exact state-vector simulation on 32 amplitudes. It is a teaching
 * model of the stabilizer machinery, not a physical device or a fault-tolerant
 * implementation with noisy measurements.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n * g) for n = 5 qubits and g Pauli/generator applications
 *   Space: O(2^n) for the complex state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability of each 5-bit basis state.
 *   - Frames walk through encode, error, syndrome, correction, and verification.
 *   - Metadata reports the syndrome, identified error, and state fidelity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type P = "I" | "X" | "Y" | "Z";
type Complex = [number, number];

interface FiveQubitInput {
    logical?: 0 | 1;
    errorQubit?: number;
    errorType?: P;
}

const N = 5;
const DIM = 1 << N;
const STABILIZERS: P[][] = [
    ["X", "Z", "Z", "X", "I"],
    ["I", "X", "Z", "Z", "X"],
    ["X", "I", "X", "Z", "Z"],
    ["Z", "X", "I", "X", "Z"],
];
const LOGICAL_X: P[] = ["X", "X", "X", "X", "X"];
const LOGICAL_Z: P[] = ["Z", "Z", "Z", "Z", "Z"];

function zeroState(): { re: number[]; im: number[] } {
    const re = new Array<number>(DIM).fill(0);
    const im = new Array<number>(DIM).fill(0);
    re[0] = 1;
    return { re, im };
}

/** Apply a single Pauli on one qubit (qubit 0 is the most significant bit). */
function applySingle(re: number[], im: number[], target: number, p: P): void {
    if (p === "I") return;
    const bit = N - 1 - target;
    const mask = 1 << bit;
    for (let i = 0; i < DIM; i += 1) {
        if ((i & mask) !== 0) continue;
        const j = i | mask;
        const ar = re[i]!;
        const ai = im[i]!;
        const br = re[j]!;
        const bi = im[j]!;
        if (p === "X") {
            re[i] = br;
            im[i] = bi;
            re[j] = ar;
            im[j] = ai;
        } else if (p === "Z") {
            re[j] = -br;
            im[j] = -bi;
        } else {
            re[i] = bi;
            im[i] = -br;
            re[j] = -ai;
            im[j] = ar;
        }
    }
}

/** Apply a full five-qubit Pauli string to a state in place. */
function applyPauli(state: { re: number[]; im: number[] }, str: P[]): void {
    for (let q = 0; q < N; q += 1) applySingle(state.re, state.im, q, str[q] ?? "I");
}

function norm(state: { re: number[]; im: number[] }): number {
    let sum = 0;
    for (let i = 0; i < DIM; i += 1) sum += state.re[i]! ** 2 + state.im[i]! ** 2;
    return Math.sqrt(sum);
}

function normalize(state: { re: number[]; im: number[] }): void {
    const n = norm(state);
    if (n < 1e-14) return;
    for (let i = 0; i < DIM; i += 1) {
        state.re[i] = state.re[i]! / n;
        state.im[i] = state.im[i]! / n;
    }
}

/** Project onto the common +1 eigenspace of the stabilizers and logical Z. */
function encode(logical: 0 | 1): { re: number[]; im: number[] } {
    const state = zeroState();
    for (const gen of [...STABILIZERS, LOGICAL_Z]) {
        const flipped = { re: [...state.re], im: [...state.im] };
        applyPauli(flipped, gen);
        for (let i = 0; i < DIM; i += 1) {
            state.re[i] = (state.re[i]! + flipped.re[i]!) * 0.5;
            state.im[i] = (state.im[i]! + flipped.im[i]!) * 0.5;
        }
        normalize(state);
    }
    if (logical === 1) applyPauli(state, LOGICAL_X);
    normalize(state);
    return state;
}

function anticommutes(a: P[], b: P[]): boolean {
    let count = 0;
    for (let q = 0; q < N; q += 1) {
        const x = a[q] ?? "I";
        const y = b[q] ?? "I";
        if (x !== "I" && y !== "I" && x !== y) count += 1;
    }
    return count % 2 === 1;
}

function syndromeOf(str: P[]): string {
    return STABILIZERS.map((g) => (anticommutes(str, g) ? "1" : "0")).join("");
}

/** Build the lookup from syndrome to the unique single-qubit Pauli error. */
function buildSyndromeTable(): Map<string, { qubit: number; type: P; str: P[] }> {
    const table = new Map<string, { qubit: number; type: P; str: P[] }>();
    for (let q = 0; q < N; q += 1) {
        for (const type of ["X", "Y", "Z"] as P[]) {
            const str: P[] = ["I", "I", "I", "I", "I"];
            str[q] = type;
            table.set(syndromeOf(str), { qubit: q, type, str });
        }
    }
    return table;
}

function fidelity(a: { re: number[]; im: number[] }, b: { re: number[]; im: number[] }): number {
    let re = 0;
    let im = 0;
    for (let i = 0; i < DIM; i += 1) {
        re += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
        im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
    }
    return Math.sqrt(re * re + im * im) / (norm(a) * norm(b));
}

function basisLabel(index: number): string {
    return index.toString(2).padStart(N, "0");
}

function probabilitiesOf(state: { re: number[]; im: number[] }): number[] {
    return state.re.map((re, i) => re * re + state.im[i]! * state.im[i]!);
}

function makeBars(state: { re: number[]; im: number[] }, highlight: number, done: boolean): VisualEntity[] {
    return state.re.map((re, index) => {
        const im = state.im[index]!;
        const probability = re * re + im * im;
        let state_: EntityState = "idle";
        if (index === highlight) state_ = done ? "sorted" : "error";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `|${basisLabel(index)}> ${probability.toFixed(3)}`,
            value: probability,
            state: state_,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: basisLabel(index), probability, re, im },
        };
    });
}

/** The five-qubit code generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FiveQubitInput | null) ?? {};
    const logical: 0 | 1 = task.logical === 1 ? 1 : 0;
    const errorQubit = Math.min(N - 1, Math.max(0, Math.floor(Number(task.errorQubit ?? 2)) || 0));
    const errorType: P = task.errorType === "X" || task.errorType === "Y" || task.errorType === "Z" ? task.errorType : "X";
    const table = buildSyndromeTable();

    const codeword = encode(logical);
    yield {
        stepNumber: 0,
        entities: makeBars(codeword, -1, false),
        edges: [],
        description: `Encoded logical |${logical}> into five qubits; a superposition of eight codewords.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { logical, errorQubit, errorType, syndrome: "0000", identifiedError: "", fidelity: 1, correctable: true, probabilities: probabilitiesOf(codeword), storedPairs: table.size },
    };

    let checkOk = true;
    for (const gen of STABILIZERS) {
        const applied = { re: [...codeword.re], im: [...codeword.im] };
        applyPauli(applied, gen);
        if (fidelity(codeword, applied) < 1 - 1e-8) checkOk = false;
    }
    yield {
        stepNumber: 1,
        entities: makeBars(codeword, -1, false),
        edges: [],
        description: `All four stabilizer measurements return +1: the state is a valid codeword (${checkOk ? "verified" : "check failed"}).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { logical, errorQubit, errorType, syndrome: "0000", identifiedError: "", fidelity: 1, stabilizersPassed: checkOk },
    };

    const errorStr: P[] = ["I", "I", "I", "I", "I"];
    errorStr[errorQubit] = errorType;
    const damaged = { re: [...codeword.re], im: [...codeword.im] };
    applyPauli(damaged, errorStr);
    normalize(damaged);
    yield {
        stepNumber: 2,
        entities: makeBars(damaged, -1, false),
        edges: [],
        description: `A ${errorType} error on qubit ${errorQubit} perturbs the encoded state.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { logical, errorQubit, errorType, syndrome: "0000", identifiedError: "", fidelity: fidelity(codeword, damaged), correctable: true },
    };

    const syndrome = syndromeOf(errorStr);
    const identified = table.get(syndrome);
    yield {
        stepNumber: 3,
        entities: makeBars(damaged, -1, false),
        edges: [],
        description: `Measuring the four stabilizers gives syndrome ${syndrome}, which uniquely identifies ${identified ? `${identified.type} on qubit ${identified.qubit}` : "an uncorrectable pattern"}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            logical,
            errorQubit,
            errorType,
            syndrome,
            identifiedError: identified ? `${identified.type}${identified.qubit}` : "",
            fidelity: fidelity(codeword, damaged),
            correctable: Boolean(identified),
        },
    };

    const corrected = { re: [...damaged.re], im: [...damaged.im] };
    if (identified) applyPauli(corrected, identified.str);
    normalize(corrected);
    const finalFidelity = fidelity(codeword, corrected);
    yield {
        stepNumber: 4,
        entities: makeBars(corrected, -1, true),
        edges: [],
        description: `Applying the identified correction restores the codeword with fidelity ${finalFidelity.toFixed(6)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            logical,
            errorQubit,
            errorType,
            syndrome,
            identifiedError: identified ? `${identified.type}${identified.qubit}` : "",
            fidelity: finalFidelity,
            correctable: Boolean(identified),
            done: true,
        },
    };
}

/** The five-qubit code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Spread one logical qubit across five physical qubits so that no single-qubit error can masquerade as a different one. Four parity checks watch the state without measuring the logical information. Their combined answer, the syndrome, names which of the fifteen possible single-qubit errors happened, so you can undo it exactly.",
        invariants: [
            "Every encoded codeword is a +1 eigenstate of all four stabilizer generators.",
            "Each of the fifteen non-identity single-qubit Paulis has a distinct syndrome.",
            "Applying a Pauli error twice returns the state up to a physically irrelevant global phase.",
        ],
        correctness:
            "The stabilizer group has sixteen elements and defines a two-dimensional code space, giving one logical qubit. A single-qubit Pauli either commutes or anticommutes with each generator, and the five-qubit code is nondegenerate: the fifteen errors produce fifteen distinct four-bit syndromes. Measuring the syndrome therefore identifies the error, and reapplying that self-inverse Pauli returns the state, since the difference is only a global phase.",
        complexityRationale:
            "The simulator stores 32 complex amplitudes and applies each five-qubit Pauli with five single-qubit passes over the vector, so preparation and correction are O(2^5 times 5). Building the syndrome table checks fifteen errors against four generators, a small constant cost.",
        uses: [
            "The canonical example of a distance-three quantum code",
            "A teaching model for stabilizer codes and syndrome decoding",
            "A building block for concatenated and larger quantum codes",
        ],
        references: [
            "Bennett et al., Perfect Quantum Error Correcting Code, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "Encode logical zero, then apply an X error on qubit two. The syndrome comes back as a unique four-bit pattern that the lookup table maps to X on qubit two. Applying X there again restores the original codeword with fidelity one.",
    },
    id: "five-qubit-code",
    name: "Five-Qubit Code",
    category: "quantum",
    complexity: { time: "O(2^n * g)", space: "O(2^n)" },
    defaultInput: { logical: 0, errorQubit: 2, errorType: "X" },
    visualType: "array",
    run,
    pseudocode: [
        "list the four stabilizer generators",
        "project a basis state onto the common plus-one eigenspace",
        "apply logical X to encode the one state",
        "inject a single-qubit Pauli error",
        "measure the four stabilizers to get the syndrome",
        "look up the unique error matching that syndrome",
        "apply the same Pauli as the correction",
        "done: verify the restored state matches the codeword",
    ],
};

export default module;
