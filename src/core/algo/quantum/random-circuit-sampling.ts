/**
 * random-circuit-sampling.ts - Random Quantum Circuit Sampling (Exact Small Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Random circuit sampling means running a short random quantum circuit and
 * sampling bitstrings from its output distribution. It is the task behind
 * quantum-supremacy experiments because the Born probabilities are easy to
 * sample from on a quantum device but expensive to compute classically as the
 * circuit grows. This module builds a deterministic pseudo-random circuit of
 * Hadamard, phase, and pi-over-eight gates plus nearest-neighbor controlled-NOT
 * layers, evolves the state vector exactly with complex arithmetic, and draws
 * samples from the resulting Born distribution with a fixed seed.
 *
 * The model is exact for at most four qubits and a handful of layers, which is
 * far below the regime where sampling is classically hard. It is an
 * instructional simulator with no noise, decoherence, or finite-shot hardware
 * effects, and it does not claim any quantum advantage.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(depth * n * 2^n + samples * 2^n) for the naive sampler
 *   Space: O(2^n) complex amplitudes plus the sampled frequency table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per basis state shows its exact Born probability.
 *   - The bar with the largest probability is yellow, the final table is green.
 *   - The metadata carries the gate list, exact probabilities, and sample counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Gate {
    type: "H" | "S" | "T" | "CNOT";
    q?: number;
    control?: number;
    target?: number;
}

interface RcsInput {
    qubits?: number;
    depth?: number;
    samples?: number;
    seed?: number;
    gates?: Gate[];
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** Apply one gate to a complex state vector held as parallel real and imaginary arrays. */
function applyGate(gate: Gate, re: number[], im: number[], n: number): void {
    const dim = 1 << n;
    if (gate.type === "H" && typeof gate.q === "number") {
        const bit = 1 << gate.q;
        const inv = Math.SQRT1_2;
        for (let i = 0; i < dim; i += 1) {
            if ((i & bit) === 0) {
                const j = i | bit;
                const ar = re[i]!;
                const ai = im[i]!;
                const br = re[j]!;
                const bi = im[j]!;
                re[i] = (ar + br) * inv;
                im[i] = (ai + bi) * inv;
                re[j] = (ar - br) * inv;
                im[j] = (ai - bi) * inv;
            }
        }
    } else if (gate.type === "S" && typeof gate.q === "number") {
        const bit = 1 << gate.q;
        for (let i = 0; i < dim; i += 1) {
            if ((i & bit) !== 0) {
                const r = re[i]!;
                re[i] = -im[i]!;
                im[i] = r;
            }
        }
    } else if (gate.type === "T" && typeof gate.q === "number") {
        const bit = 1 << gate.q;
        const c = Math.SQRT1_2;
        for (let i = 0; i < dim; i += 1) {
            if ((i & bit) !== 0) {
                const r = re[i]!;
                const m = im[i]!;
                re[i] = r * c - m * c;
                im[i] = r * c + m * c;
            }
        }
    } else if (gate.type === "CNOT" && typeof gate.control === "number" && typeof gate.target === "number") {
        const cbit = 1 << gate.control;
        const tbit = 1 << gate.target;
        for (let i = 0; i < dim; i += 1) {
            if ((i & cbit) !== 0 && (i & tbit) === 0) {
                const j = i | tbit;
                const r = re[i]!;
                const m = im[i]!;
                re[i] = re[j]!;
                im[i] = im[j]!;
                re[j] = r;
                im[j] = m;
            }
        }
    }
}

function bornProbabilities(re: number[], im: number[]): number[] {
    return re.map((r, i) => r * r + im[i]! * im[i]!);
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((p, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: i.toString(2).padStart(values.length <= 8 ? 3 : 4, "0"),
        value: p,
        state: (done ? "sorted" : i === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, probability: p },
    }));
}

/** Build a pseudo-random Clifford-plus-T circuit from a fixed seed. */
function buildCircuit(n: number, depth: number, seed: number): Gate[] {
    const rand = makeRandom(seed);
    const gates: Gate[] = [];
    const choices: Array<"H" | "S" | "T"> = ["H", "S", "T"];
    for (let layer = 0; layer < depth; layer += 1) {
        for (let q = 0; q < n; q += 1) {
            const pick = choices[Math.floor(rand() * choices.length)] ?? "H";
            gates.push({ type: pick, q });
        }
        for (let q = 0; q + 1 < n; q += 2) {
            if (rand() > 0.35) gates.push({ type: "CNOT", control: q, target: q + 1 });
        }
    }
    return gates;
}

/** The random circuit sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RcsInput | null) ?? {};
    const n = typeof task.qubits === "number" ? Math.max(1, Math.min(4, Math.floor(task.qubits))) : 3;
    const depth = typeof task.depth === "number" ? Math.max(1, Math.min(5, Math.floor(task.depth))) : 2;
    const samples = typeof task.samples === "number" ? Math.max(0, Math.min(20000, Math.floor(task.samples))) : 2000;
    const seed = typeof task.seed === "number" ? task.seed : 12345;
    const gates: Gate[] = Array.isArray(task.gates) ? task.gates : buildCircuit(n, depth, seed);
    const dim = 1 << n;

    const re = new Array<number>(dim).fill(0);
    const im = new Array<number>(dim).fill(0);
    re[0] = 1;
    let step = 0;
    let applied = 0;

    yield {
        stepNumber: step++,
        entities: makeBars(bornProbabilities(re, im), -1, false),
        edges: [],
        description: `${n} qubits start in the all-zero state; ${gates.length} gates from a fixed-seed random circuit will be applied.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, seed, samples, gates: JSON.stringify(gates), probabilities: [1], frequencies: [], applied: 0 },
    };

    for (const gate of gates) {
        applyGate(gate, re, im, n);
        applied += 1;
    }
    const probabilities = bornProbabilities(re, im);
    let largest = 0;
    for (let i = 1; i < dim; i += 1) {
        if (probabilities[i]! > probabilities[largest]!) largest = i;
    }
    yield {
        stepNumber: step++,
        entities: makeBars(probabilities, largest, false),
        edges: [],
        description: `Circuit applied exactly; the output distribution has ${dim} outcomes and sums to ${probabilities.reduce((a, b) => a + b, 0).toFixed(6)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, seed, samples, gates: JSON.stringify(gates), probabilities, frequencies: [], applied },
    };

    const rand = makeRandom(seed ^ 0x5f3759df);
    const frequencies = new Array<number>(dim).fill(0);
    const cumulative: number[] = [];
    let running = 0;
    for (const p of probabilities) {
        running += p;
        cumulative.push(running);
    }
    for (let s = 0; s < samples; s += 1) {
        const draw = rand();
        let outcome = cumulative.findIndex((c) => draw < c);
        if (outcome < 0) outcome = dim - 1;
        frequencies[outcome] = frequencies[outcome]! + 1;
    }
    yield {
        stepNumber: step++,
        entities: makeBars(frequencies.map((count) => count / Math.max(1, samples)), largest, true),
        edges: [],
        description: `Sampled ${samples} bitstrings; the empirical frequencies track the Born probabilities within finite-shot error.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, seed, samples, gates: JSON.stringify(gates), probabilities, frequencies, applied },
    };
}

/** The random circuit sampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A random quantum circuit scrambles a simple starting state into a complicated superposition. Measuring it gives a probability distribution over bitstrings that is straightforward to sample from with a quantum device but rapidly becomes costly to compute on a classical computer. This small simulator builds such a circuit from a seed, computes the Born probabilities exactly, and shows how a finite number of shots approximates that distribution.",
        invariants: [
            "The state vector stays normalized after every gate.",
            "Born probabilities are nonnegative and sum to one.",
            "Sample frequencies sum to the number of shots and converge to the probabilities as shots grow.",
        ],
        correctness:
            "Each gate is a unitary operator, so the state vector remains normalized and the squared magnitudes of its amplitudes form a valid probability distribution. The sampler draws a uniform number in zero to one and inverts the cumulative distribution, so the chance of outcome k is exactly its Born probability; the finite count then follows a multinomial distribution around that value. An independent state-vector simulation of the same gate list reproduces the probabilities, confirming the exact evolution.",
        complexityRationale:
            "There are O(depth * n) gates and each touches O(2^n) amplitudes, so evolving the state costs O(depth * n * 2^n). Each of the samples scans the cumulative distribution in O(2^n), giving O(samples * 2^n). Storing the amplitudes and the frequency table costs O(2^n).",
        uses: [
            "Benchmarking quantum processors through random circuit sampling tasks",
            "Studying the transition from easy to hard classical simulation",
            "A teaching example of Born-rule sampling and finite-shot statistics",
        ],
        references: [
            "Arute et al., Quantum Supremacy Using a Programmable Superconducting Processor, 2019",
            "Boixo et al., Characterizing Quantum Supremacy in Near-Term Devices, 2018",
        ],
        workedExample:
            "With one qubit, a Hadamard gate on the zero state gives amplitudes (0.7071, 0.7071) and Born probabilities (0.5, 0.5). Sampling two thousand shots yields roughly a thousand zeroes and a thousand ones, with the small imbalance explained by ordinary finite-shot noise.",
    },
    id: "random-circuit-sampling",
    name: "Random Circuit Sampling (Exact Small Simulation)",
    category: "quantum",
    complexity: { time: "O(depth * n * 2^n + samples * 2^n)", space: "O(2^n)" },
    defaultInput: { qubits: 3, depth: 2, samples: 2000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the qubit count, depth, seed, and shot count",
        "generate a seed-random circuit of single-qubit and CNOT gates",
        "initialize the all-zero state vector",
        "apply each gate with exact complex arithmetic",
        "compute Born probabilities as squared amplitudes",
        "build the cumulative distribution over outcomes",
        "draw seeded samples and tally their frequencies",
        "done: report probabilities and sampled frequencies",
    ],
};

export default module;
