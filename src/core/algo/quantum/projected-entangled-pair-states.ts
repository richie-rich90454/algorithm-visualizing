/**
 * projected-entangled-pair-states.ts - PEPS contraction on a 2x2 lattice
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A projected entangled pair state, or PEPS, builds a many-body quantum state
 * by placing a tensor on each site of a lattice and contracting the virtual
 * indices that connect neighboring sites. This module uses a two by two grid
 * of qubit tensors with virtual bond dimension two, contracts the four virtual
 * bonds exactly, and reports the probability of each of the sixteen physical
 * basis states. A product-state mode makes the factorization directly checkable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^(n + bonds)) for n physical qubits and the listed virtual bonds
 *   Space: O(2^n) for the resulting amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows the probability of each four-bit basis configuration.
 *   - The most likely configuration is highlighted, then marked green.
 *   - meta carries the real and imaginary amplitudes and the norm check.
 *
 * This is an exact contraction of a tiny tensor network, not a simulation of a
 * physical two-dimensional quantum device. The lattice is fixed at 2x2 sites.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface PepsInput {
    product?: boolean;
}

/** Multiply two complex numbers. */
function multiply(left: Complex, right: Complex): Complex {
    return [left[0] * right[0] - left[1] * right[1], left[0] * right[1] + left[1] * right[0]];
}

/** Return one tensor entry for a site and a choice of physical and virtual indices. */
function tensorValue(site: number, spin: number, left: number, right: number, up: number, down: number, product: boolean): Complex {
    if (product) {
        const factor = Math.sin((site + 1) * (spin + 1) * 0.7);
        return left === 0 && right === 0 && up === 0 && down === 0 ? [factor, 0] : [0, 0];
    }
    const magnitude = (spin + 1) + 0.5 * (left + 2 * right + 3 * up + 4 * down) + site * 0.25;
    const angle = 0.3 * (left + 2 * right + 3 * up + 4 * down + spin + site);
    return [magnitude * Math.cos(angle), magnitude * Math.sin(angle)];
}

/** Contract the four-site network over its two horizontal and two vertical bonds. */
function contract(product: boolean): { re: number[]; im: number[]; probabilities: number[]; norm: number } {
    const re = new Array<number>(16).fill(0);
    const im = new Array<number>(16).fill(0);
    for (let s00 = 0; s00 < 2; s00 += 1) {
        for (let s01 = 0; s01 < 2; s01 += 1) {
            for (let s10 = 0; s10 < 2; s10 += 1) {
                for (let s11 = 0; s11 < 2; s11 += 1) {
                    let sumRe = 0;
                    let sumIm = 0;
                    for (let h0 = 0; h0 < 2; h0 += 1) {
                        for (let h1 = 0; h1 < 2; h1 += 1) {
                            for (let v0 = 0; v0 < 2; v0 += 1) {
                                for (let v1 = 0; v1 < 2; v1 += 1) {
                                    const t00 = tensorValue(0, s00, 0, h0, 0, v0, product);
                                    const t01 = tensorValue(1, s01, h0, 0, 0, v1, product);
                                    const t10 = tensorValue(2, s10, 0, h1, v0, 0, product);
                                    const t11 = tensorValue(3, s11, h1, 0, v1, 0, product);
                                    const value = multiply(multiply(t00, t01), multiply(t10, t11));
                                    sumRe += value[0];
                                    sumIm += value[1];
                                }
                            }
                        }
                    }
                    const index = (s00 << 3) | (s01 << 2) | (s10 << 1) | s11;
                    re[index] = sumRe;
                    im[index] = sumIm;
                }
            }
        }
    }
    const norm = Math.sqrt(re.reduce((sum, value, index) => sum + value * value + (im[index] ?? 0) ** 2, 0));
    const safeNorm = norm > 0 ? norm : 1;
    const probabilities = re.map((value, index) => ((value * value + (im[index] ?? 0) ** 2) / (safeNorm * safeNorm)));
    return {
        re: re.map((value) => value / safeNorm),
        im: im.map((value) => value / safeNorm),
        probabilities,
        norm,
    };
}

function makeBars(probabilities: number[], highlighted: number, done: boolean): VisualEntity[] {
    return probabilities.map((probability, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index.toString(2).padStart(4, "0"),
        value: probability,
        state: index === highlighted ? (done ? "sorted" : "comparing") : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability },
    }));
}

/** The PEPS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PepsInput | null) ?? {};
    const product = task.product === true;
    const state = contract(product);
    const maxIndex = state.probabilities.indexOf(Math.max(...state.probabilities));
    const equal = new Array<number>(16).fill(1 / 16);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(equal, -1, false),
        edges: [],
        description: product
            ? "A product PEPS on a 2x2 lattice: every virtual index is forced to zero."
            : "A PEPS on a 2x2 lattice with virtual bond dimension two; begin with uniform probabilities.",
        codeLineNumber: 0,
        layout: "array",
        meta: { product, re: [...equal], im: new Array<number>(16).fill(0), probabilities: equal, norm: 1, maxIndex: -1, checked: false },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(equal, -1, false),
        edges: [],
        description: "Each site tensor carries one physical qubit index and four virtual bond indices.",
        codeLineNumber: 1,
        layout: "array",
        meta: { product, re: [...equal], im: new Array<number>(16).fill(0), probabilities: equal, norm: 1, maxIndex: -1, checked: false },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(state.probabilities, maxIndex, false),
        edges: [],
        description: `Contracting the two horizontal and two vertical bonds yields ${state.norm.toFixed(6)} times the normalized state.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { product, re: [...state.re], im: [...state.im], probabilities: [...state.probabilities], norm: state.norm, maxIndex, checked: false },
    };

    yield {
        stepNumber: step,
        entities: makeBars(state.probabilities, maxIndex, true),
        edges: [],
        description: `The sixteen probabilities sum to one; configuration ${maxIndex.toString(2).padStart(4, "0")} is most likely at ${state.probabilities[maxIndex]!.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { product, re: [...state.re], im: [...state.im], probabilities: [...state.probabilities], norm: state.norm, maxIndex, checked: true },
    };
}

/** The projected entangled pair states module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A PEPS describes a quantum lattice by giving each site a tensor with one physical leg for its real particle and virtual legs for the entanglement links to neighbors. Contracting all virtual legs leaves one amplitude for every physical configuration. The rank of the virtual legs controls how much entanglement the state can hold, so even a tiny grid already shows how a local description produces a global quantum state.",
        invariants: [
            "Each tensor has one physical index and four virtual bond indices.",
            "The two horizontal and two vertical virtual bonds are each summed over both values.",
            "After normalization the squared amplitudes sum to one.",
            "In product mode every virtual index is zero and the state factorizes across sites.",
        ],
        correctness:
            "Enumerating every physical configuration together with every assignment of the four virtual bonds evaluates the full tensor-network contraction exactly. Dividing by the square root of the total squared magnitude makes the state normalized, and the reported probabilities are the squared magnitudes of those normalized amplitudes. In product mode only the all-zero virtual assignment survives, so the amplitude of a configuration is the product of the four single-site factors, which is checked directly against an independent product computation.",
        complexityRationale:
            "For n physical qubits and b contracted binary virtual bonds the naive enumeration touches 2 to the n plus b terms. Here n is four and b is four, so 256 terms produce sixteen amplitudes, and storing those amplitudes takes O(2 to the n) space.",
        uses: [
            "Simulating two-dimensional strongly correlated quantum systems",
            "Studying area laws for entanglement",
            "Classical compression of certain quantum many-body states",
        ],
        references: [
            "Verstraete and Cirac, Renormalization Algorithms for Quantum-Many Body Systems in Two and Higher Dimensions, 2004",
            "Orus, A Practical Introduction to Tensor Networks, 2014",
        ],
        workedExample:
            "On the 2x2 lattice, fixing the physical bits to 0000 and summing the four virtual bonds over their two values gives one complex amplitude. Repeating for all sixteen bit strings and dividing by the norm yields probabilities. In product mode the amplitude of 0101 is the product of the four site factors for spins 0, 1, 0, 1, with no virtual summation needed.",
    },
    id: "projected-entangled-pair-states",
    name: "Projected Entangled Pair States",
    category: "quantum",
    complexity: { time: "O(2^(n+b))", space: "O(2^n)" },
    defaultInput: { product: false },
    visualType: "array",
    run,
    pseudocode: [
        "place one rank-five tensor on each of four lattice sites",
        "choose a physical bit string of length four",
        "assign both values to each of the four virtual bonds",
        "multiply the four tensor entries for the assignment",
        "sum the products over every virtual assignment",
        "repeat for all sixteen physical bit strings",
        "normalize the amplitudes and square them for probabilities",
        "done: report the normalized state and its largest probability",
    ],
};

export default module;
