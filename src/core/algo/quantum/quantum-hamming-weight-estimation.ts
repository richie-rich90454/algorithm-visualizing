/**
 * quantum-hamming-weight-estimation.ts - Hamming Weight from a Phase Oracle
 *
 * A four-outcome exact simulation of Hamming weight estimation. An unknown
 * four-bit string is supplied as a phase oracle that flips the sign of index j
 * when bit j is set. Preparing a uniform superposition, applying the oracle,
 * and applying the inverse four-point Fourier transform leaves amplitude
 * (4 minus 2w) over 4 at the zero outcome, from which the weight w is recovered
 * exactly. This is an ideal single-shot model limited to four-bit strings; it
 * assumes an exact phase oracle and ignores sampling noise and fault tolerance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface WeightInput {
    bits?: number;
}

const SIZE = 4;

function popcount(value: number): number {
    let count = 0;
    let rest = value;
    while (rest > 0) {
        count += rest & 1;
        rest >>= 1;
    }
    return count;
}

function makeBars(values: number[], highlight: number, final: boolean, signed: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `index-${index}`,
        type: "bar" as const,
        label: `${index.toString(2).padStart(2, "0")}: ${value.toFixed(4)}`,
        value,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value, signed },
    }));
}

function inverseFourier(state: Complex[]): Complex[] {
    return state.map((_ignored, output) => {
        let real = 0;
        let imag = 0;
        for (let input = 0; input < SIZE; input += 1) {
            const angle = (-2 * Math.PI * output * input) / SIZE;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            const z = state[input]!;
            real += cosine * z[0] - sine * z[1];
            imag += cosine * z[1] + sine * z[0];
        }
        const inverseScale = Math.sqrt(SIZE);
        return [real / inverseScale, imag / inverseScale] as Complex;
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WeightInput | null) ?? {};
    const bits = Math.max(0, Math.min(15, typeof task.bits === "number" ? Math.floor(task.bits) : 5));
    const signs = [0, 1, 2, 3].map((j) => ((bits >> j) & 1) === 1 ? -1 : 1);
    const weight = popcount(bits);
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (amps: Complex[], done: boolean) => ({
        bits,
        bitPattern: bits.toString(2).padStart(4, "0"),
        signs,
        amplitudes: flat(amps),
        probabilities: amps.map((z) => z[0] * z[0] + z[1] * z[1]),
        amp0: amps[0]![0],
        recoveredWeight: done ? Math.round(2 * (1 - amps[0]![0])) : 0,
        classicalWeight: weight,
        norm: amps.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0),
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(signs, -1, false, true),
        edges: [],
        description: `Prepared a uniform superposition; the phase oracle for ${bits.toString(2).padStart(4, "0")} will flip the sign of indices whose bit is set.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaFor([[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]], false), signs },
    };

    let state: Complex[] = [[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]];
    yield {
        stepNumber: 1,
        entities: makeBars(state.map((z) => z[0]), -1, false, false),
        edges: [],
        description: "Prepared a uniform superposition over the four oracle input indices.",
        codeLineNumber: 1,
        layout: "array",
        meta: metaFor(state, false),
    };

    state = state.map((z, index) => [z[0] * signs[index]!, z[1] * signs[index]!]);
    yield {
        stepNumber: 2,
        entities: makeBars(state.map((z) => z[0]), signs.findIndex((v) => v < 0), false, true),
        edges: [],
        description: "The oracle flips the phase of marked indices; their magnitudes are unchanged.",
        codeLineNumber: 2,
        layout: "array",
        meta: metaFor(state, false),
    };

    state = inverseFourier(state);
    yield {
        stepNumber: 3,
        entities: makeBars(state.map((z) => z[0] ** 2 + z[1] ** 2), 0, false, false),
        edges: [],
        description: "The inverse Fourier transform converts the signed sum into an amplitude concentrated at the zero outcome.",
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor(state, false),
    };

    yield {
        stepNumber: 4,
        entities: makeBars(state.map((z) => z[0] ** 2 + z[1] ** 2), -1, true, false),
        edges: [],
        description: `The zero-outcome amplitude is ${state[0]![0].toFixed(4)}, giving Hamming weight ${2 * (1 - state[0]![0])}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(state, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The number of set bits in a short string can be read from a single carefully chosen interference experiment. If each bit flips the phase of one input in a uniform superposition, the sum of those signs is the number of zero bits minus the number of one bits. A Fourier transform turns that signed sum into the amplitude of the zero outcome, so measuring one amplitude reveals the whole Hamming weight.",
        invariants: [
            "The phase oracle changes signs but leaves every squared amplitude unchanged.",
            "The inverse Fourier transform is unitary, so total probability stays one.",
            "The zero-outcome amplitude equals (4 minus 2w) over 4, where w is the Hamming weight.",
        ],
        correctness:
            "Let s_j be minus one when bit j is set and plus one otherwise. After the oracle the state is one half times the sum over j of s_j |j>. The inverse Fourier coefficient at output zero is one quarter times the sum of the s_j, which is (4 minus 2w) over 4 because there are 4 minus w plus signs and w minus signs. Solving gives w equals 2 times (1 minus the zero amplitude), and the sign ambiguity never arises for weights between zero and four.",
        complexityRationale:
            "The model has only four amplitudes, so every step is constant time and constant memory. In the general case with m bits the phase oracle is m controlled phases and the inverse transform is a logarithmic-depth circuit, giving polynomial gate count rather than a linear scan of all 2^m strings.",
        uses: [
            "Reading Hamming weight as a subroutine of amplitude estimation",
            "Quantum algorithms for counting and property testing",
            "Demonstrations of Fourier-based extraction of global properties",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
            "Cleve and Watrous, Fast Parallel Circuits for the Quantum Fourier Transform, 2000",
        ],
        workedExample:
            "For the string 0101 the oracle signs are plus, minus, plus, minus. The signed sum is zero, so the zero amplitude is zero and the recovered weight is 2 times (1 minus 0), which is 2, matching the two set bits.",
    },
    id: "quantum-hamming-weight-estimation",
    name: "Quantum Hamming Weight Estimation",
    category: "quantum",
    complexity: { time: "O(1) for four bits", space: "O(1)" },
    defaultInput: { bits: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a four-bit string and form its phase-oracle signs",
        "prepare the uniform superposition over four input indices",
        "flip the sign of each index whose bit is set",
        "apply the inverse four-point Fourier transform",
        "read the real amplitude of the zero outcome",
        "recover the weight as twice one minus that amplitude",
        "done: compare the recovered weight with the classical count",
    ],
};

export default module;
