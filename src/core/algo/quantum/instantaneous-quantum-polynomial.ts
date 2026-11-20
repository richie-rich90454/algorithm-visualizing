/**
 * instantaneous-quantum-polynomial.ts - Instantaneous Quantum Polynomial Circuit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An instantaneous quantum polynomial, or IQP, circuit starts with a Hadamard
 * on every qubit, applies only diagonal phase gates that all commute, and ends
 * with a second layer of Hadamards. Diagonal gates of angle a times pi over
 * four produce phases in the cyclotomic ring, and sampling the final
 * distribution is believed to be classically hard at scale. This module builds
 * a deterministic IQP instance, evolves the state vector exactly with complex
 * arithmetic, and reports the full Born distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n 2^n) for the two Hadamard layers plus O(2^n) phase updates
 *   Space: O(2^n) complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per basis state shows its exact Born probability.
 *   - The basis state receiving the current phase is yellow; the output is green.
 *   - meta carries the gate coefficients, phases, and output probabilities.
 *
 * LIMITS: this is an exact noiseless state-vector model for at most three
 * qubits. It shows the structure of IQP circuits, not a quantum advantage or a
 * hardware sampling experiment, and no finite-shot statistics are modeled.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    qubits?: number;
    seed?: number;
}

/** Apply a Hadamard gate to one qubit of a parallel real/imaginary state vector. */
function applyHadamard(re: number[], im: number[], n: number, q: number): void {
    const bit = 1 << q;
    const inv = Math.SQRT1_2;
    for (let i = 0; i < (1 << n); i += 1) {
        if ((i & bit) !== 0) {
            continue;
        }
        const j = i | bit;
        const ar = re[i] ?? 0;
        const ai = im[i] ?? 0;
        const br = re[j] ?? 0;
        const bi = im[j] ?? 0;
        re[i] = (ar + br) * inv;
        im[i] = (ai + bi) * inv;
        re[j] = (ar - br) * inv;
        im[j] = (ai - bi) * inv;
    }
}

/** Deterministic phase coefficients for the diagonal IQP layer. */
function coefficients(n: number, seed: number): { singles: number[]; pairs: number[][] } {
    const singles = Array.from({ length: n }, (_, p) => (seed + 3 * p) % 4);
    const pairs = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let p = 0; p < n; p += 1) {
        for (let q = p + 1; q < n; q += 1) {
            pairs[p]![q] = (seed * (p + 1) + 3 * q + p) % 5;
        }
    }
    return { singles, pairs };
}

/** Total phase of basis state s in units of pi over four. */
function phaseUnits(s: number, n: number, singles: number[], pairs: number[][]): number {
    let units = 0;
    for (let p = 0; p < n; p += 1) {
        if ((s & (1 << p)) !== 0) {
            units += singles[p] ?? 0;
        }
    }
    for (let p = 0; p < n; p += 1) {
        for (let q = p + 1; q < n; q += 1) {
            if ((s & (1 << p)) !== 0 && (s & (1 << q)) !== 0) {
                units += pairs[p]?.[q] ?? 0;
            }
        }
    }
    return units;
}

/** Build probability bars for the current state. */
function makeBars(probabilities: number[], active: number, done: boolean): VisualEntity[] {
    return probabilities.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done ? ("sorted" as EntityState) : index === active ? ("comparing" as EntityState) : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value, basis: index.toString(2).padStart(3, "0") },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = typeof task.qubits === "number" && Number.isFinite(task.qubits)
        ? Math.max(1, Math.min(3, Math.round(task.qubits)))
        : 3;
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed)
        ? Math.max(0, Math.min(1000, Math.round(task.seed)))
        : 7;
    const dim = 1 << n;
    const { singles, pairs } = coefficients(n, seed);
    const units = Array.from({ length: dim }, (_, s) => phaseUnits(s, n, singles, pairs));
    const re = new Array<number>(dim).fill(0);
    const im = new Array<number>(dim).fill(0);
    re[0] = 1;

    const probabilities = () => re.map((value, i) => value * value + (im[i] ?? 0) * (im[i] ?? 0));
    const norm = () => probabilities().reduce((sum, value) => sum + value, 0);

    const meta = (active: number, done: boolean) => ({
        qubits: n,
        seed,
        basisStates: dim,
        singleCoefficients: singles,
        pairCoefficients: pairs.map((row) => row.join(",")),
        phaseUnits: [...units],
        phases: units.map((u) => (u * Math.PI) / 4),
        probabilities: probabilities(),
        mostLikely: probabilities().reduce((best, value, i, all) => (value > (all[best] ?? 0) ? i : best), 0),
        norm: norm(),
        active,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities(), -1, false),
        edges: [],
        description: `IQP circuit on ${n} qubits: Hadamards, ${units.length} diagonal phase terms, then Hadamards.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(-1, false),
    };

    for (let q = 0; q < n; q += 1) {
        applyHadamard(re, im, n, q);
    }
    yield {
        stepNumber: 1,
        entities: makeBars(probabilities(), -1, false),
        edges: [],
        description: `The first Hadamard layer spreads the state uniformly over ${dim} basis states.`,
        codeLineNumber: 1,
        layout: "array",
        meta: meta(-1, false),
    };

    let step = 2;
    for (let s = 0; s < dim; s += 1) {
        const angle = (units[s] ?? 0) * Math.PI / 4;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const currentRe = re[s] ?? 0;
        const currentIm = im[s] ?? 0;
        re[s] = currentRe * cosine - currentIm * sine;
        im[s] = currentRe * sine + currentIm * cosine;
        yield {
            stepNumber: step,
            entities: makeBars(probabilities(), s, false),
            edges: [],
            description: `Basis state ${s} receives phase ${(units[s] ?? 0)} times pi over four from the commuting diagonal layer.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(s, false),
        };
        step += 1;
    }

    for (let q = 0; q < n; q += 1) {
        applyHadamard(re, im, n, q);
    }
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), -1, false),
        edges: [],
        description: `The final Hadamard layer interferes the phases into a Born distribution with norm ${norm().toFixed(8)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta(-1, false),
    };
    step += 1;

    const final = probabilities();
    const mostLikely = final.reduce((best, value, i, all) => (value > (all[best] ?? 0) ? i : best), 0);
    yield {
        stepNumber: step,
        entities: makeBars(final, -1, true),
        edges: [],
        description: `IQP output: outcome ${mostLikely} has the largest exact probability ${(final[mostLikely] ?? 0).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An IQP circuit is deliberately simple to describe: flip every qubit into an even superposition, apply a layer of diagonal phase gates that all commute with one another, then flip back. Because the phases commute, their order never matters, yet the second Hadamard layer makes the output distribution extremely intricate. That gap between a simple description and a hard-to-simulate answer is what makes IQP interesting for quantum advantage.",
        invariants: [
            "Every gate in the middle layer is diagonal, so all of them commute.",
            "The phase of a basis state is pi over four times a sum of single-qubit and pair coefficients selected by its bits.",
            "The state vector remains normalized at every stage.",
        ],
        correctness:
            "A Hadamard on every qubit sends the all-zero state to the uniform superposition with positive amplitudes. The diagonal layer multiplies the amplitude of basis state s by exp(i times its phase), which changes no magnitude. A second Hadamard layer maps the amplitude at s to the sum over outputs j of minus one to the power of the bitwise dot product of j and s times the phase factor, divided by the square root of the dimension. Summing squared magnitudes over all outputs gives one, and an independent dense matrix build of the full unitary reproduces exactly the same output amplitudes in the companion test.",
        complexityRationale:
            "Each Hadamard layer touches all pairs of amplitudes for every qubit, costing O(n 2^n), and the diagonal layer costs O(2^n). The state vector uses O(2^n) complex amplitudes, which is why the simulation is limited to three qubits here.",
        uses: [
            "Studying sampling-based quantum advantage and complexity separations",
            "Testing classical simulators against small exactly computable circuits",
            "Teaching interference from commuting diagonal phase gates",
        ],
        references: [
            "Shepherd and Bremner, Instantaneous Quantum Computation, 2009",
            "Bremner, Montanaro, and Shepherd, Achieving Quantum Supremacy with Sparse and Noisy Commuting Gates, 2016",
        ],
        workedExample:
            "On two qubits with single coefficients one and zero and one pair coefficient one, the basis states receive phases zero, pi over four, zero, and pi over four. After the second Hadamard layer the four outcome probabilities sum to one, and the exact distribution follows from adding the four signed phase factors for each output.",
    },
    id: "instantaneous-quantum-polynomial",
    name: "Instantaneous Quantum Polynomial Circuit",
    category: "quantum",
    complexity: { time: "O(n 2^n)", space: "O(2^n)" },
    defaultInput: { qubits: 3, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the qubit count and a deterministic phase seed",
        "build single-qubit and pair phase coefficients",
        "apply a Hadamard gate to every qubit",
        "for each basis state apply its diagonal phase exp(i*pi*units/4)",
        "apply a Hadamard gate to every qubit again",
        "square the amplitudes to obtain Born probabilities",
        "locate the most likely output and check normalization",
        "done: report the exact output distribution",
    ],
};

export default module;
