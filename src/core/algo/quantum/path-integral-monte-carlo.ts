/**
 * path-integral-monte-carlo.ts - Path Integral Monte Carlo (exact two-level model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Path integral Monte Carlo expresses the thermal partition function as a sum
 * over imaginary-time trajectories. Each time slice contributes a diagonal
 * Boltzmann weight and an off-diagonal tunneling weight, so the partition
 * function is the trace of a product of small transfer matrices. For a two-level
 * system the trace is evaluated exactly by contracting a two by two matrix,
 * which is the same result as enumerating every closed path but far cheaper.
 *
 * This module is an exact small simulation: it uses a first-order Trotter
 * breakup and no random sampling, so the only error is the known O(dtau) shift
 * from the discretization. It does not model continuous variables, sampling
 * noise, or higher-order Trotter decompositions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(slices * 2^2) for the transfer-matrix contraction
 *   Space: O(1) beyond the frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two diagonal contributions to the current transfer product.
 *   - Early slices are yellow; the converged partition function is green.
 *   - meta carries the estimate, exact continuum value, and relative error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, spin: index === 0 ? 1 : -1 },
    }));
}

/** Build the transfer matrix for one imaginary-time slice. */
function transfer(epsilon: number, delta: number, dtau: number): number[][] {
    const tunneling = (dtau * delta) / 2;
    const diagonal = (dtau * epsilon) / 2;
    return [
        [Math.cosh(tunneling) * Math.exp(-diagonal), Math.sinh(tunneling) * Math.exp(diagonal)],
        [Math.sinh(tunneling) * Math.exp(-diagonal), Math.cosh(tunneling) * Math.exp(diagonal)],
    ];
}

/** Compute (matrix)^power for a two by two matrix and return both diagonal entries. */
function tracePower(matrix: number[][], power: number): [number, number] {
    let product: number[][] = [
        [1, 0],
        [0, 1],
    ];
    for (let step = 0; step < power; step += 1) {
        const next: number[][] = [
            [0, 0],
            [0, 0],
        ];
        for (let row = 0; row < 2; row += 1) {
            for (let col = 0; col < 2; col += 1) {
                for (let k = 0; k < 2; k += 1) {
                    next[row]![col] = (next[row]![col] ?? 0) + (product[row]![k] ?? 0) * (matrix[k]![col] ?? 0);
                }
            }
        }
        product = next;
    }
    return [product[0]![0] ?? 0, product[1]![1] ?? 0];
}

/** Contract the imaginary-time path integral for a two-level system. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { epsilon?: number; delta?: number; beta?: number; dtau?: number } | null) ?? {};
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1.2;
    const delta = typeof task.delta === "number" ? task.delta : 0.9;
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 1;
    const dtau = typeof task.dtau === "number" && task.dtau > 0 ? task.dtau : 0.1;
    const slices = Math.max(1, Math.round(beta / dtau));
    const stepSize = beta / slices;
    const matrix = transfer(epsilon, delta, stepSize);
    const energy = Math.sqrt((epsilon / 2) ** 2 + (delta / 2) ** 2);
    const exact = 2 * Math.cosh(beta * energy);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([1, 0], "idle"),
        edges: [],
        description: `Contracting a ${slices}-slice imaginary-time path integral for beta ${beta}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { slices: 0, beta, dtau: stepSize, estimate: 2, exact, relativeError: Math.abs(2 - exact) / exact, epsilon, delta },
    };
    step += 1;

    for (let count = 1; count <= slices; count += 1) {
        const diagonal = tracePower(matrix, count);
        const estimate = diagonal[0] + diagonal[1];
        yield {
            stepNumber: step,
            entities: makeBars(diagonal, count === slices ? "sorted" : "comparing"),
            edges: [],
            description: `Slice ${count}: partition function estimate ${estimate.toFixed(6)} from the closed-path weights.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                slices: count,
                beta,
                dtau: stepSize,
                estimate,
                exact,
                relativeError: Math.abs(estimate - exact) / exact,
                epsilon,
                delta,
            },
        };
        step += 1;
    }

    const diagonal = tracePower(matrix, slices);
    const estimate = diagonal[0] + diagonal[1];
    yield {
        stepNumber: step,
        entities: makeBars(diagonal, "sorted"),
        edges: [],
        description: `Final Z = ${estimate.toFixed(6)} versus exact ${exact.toFixed(6)} (relative error ${(Math.abs(estimate - exact) / exact).toExponential(2)}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            slices,
            beta,
            dtau: stepSize,
            estimate,
            exact,
            relativeError: Math.abs(estimate - exact) / exact,
            epsilon,
            delta,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The thermal properties of a quantum system come from summing over every possible imaginary-time history. Each history is a closed path because the trace identifies the first and last time slice. For a two-level system the sum over paths collapses into repeatedly multiplying a two by two transfer matrix, whose diagonal entries weight the two starting states.",
        invariants: [
            "The transfer matrix is positive, so every path contributes a nonnegative weight.",
            "A product of k transfer matrices sums all paths of k imaginary-time steps.",
            "Taking the trace closes the path and gives the partition function.",
        ],
        correctness:
            "A first-order Trotter slice factors exp(-dtau H) into a diagonal Z rotation and an off-diagonal X rotation. In the Z basis the diagonal factor contributes exp(-dtau epsilon s over 2) and the X factor has matrix elements cosh of dtau delta over 2 for staying in place and sinh for flipping. Multiplying slice matrices therefore sums the weights of all intermediate spin assignments, and the trace identifies the endpoints to enforce a closed path. As dtau tends to zero the Trotter product converges to exp(-beta H), whose trace is two cosh of beta times the energy scale.",
        complexityRationale:
            "Each slice multiplies two by two matrices at constant cost, so the contraction is O(slices). Only a handful of scalars are stored, giving O(1) space beyond the emitted frames.",
        uses: [
            "Estimating thermal averages of small quantum systems",
            "A teaching bridge between path integrals and lattice simulations",
            "Benchmarking quantum Monte Carlo samplers against an exact answer",
        ],
        references: [
            "Creutz, Quantum Monte Carlo on the Lattice, 1983",
            "Foulkes et al., Path Integral Monte Carlo Methods for Fermions, 2001",
        ],
        workedExample:
            "With epsilon 1.2, delta 0.9, beta 1 and ten slices of width 0.1, the transfer product has trace about 2.58963 while the continuum answer two cosh of beta times the energy is about 2.58937, a relative error of one part in ten thousand from the Trotter breakup.",
    },
    id: "path-integral-monte-carlo",
    name: "Path Integral Monte Carlo (Two-Level Model)",
    category: "quantum",
    complexity: { time: "O(slices)", space: "O(1)" },
    defaultInput: { epsilon: 1.2, delta: 0.9, beta: 1, dtau: 0.1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the Hamiltonian couplings, inverse temperature, and slice width",
        "build the two by two imaginary-time transfer matrix",
        "start the path product at the identity matrix",
        "for each slice multiply the running product by the transfer matrix",
        "sum the two diagonal entries to close the path",
        "compare with the exact two cosh continuum partition function",
        "done: report the estimate and its relative error",
    ],
};

export default module;
