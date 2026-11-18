/**
 * variational-quantum-eigensolver.ts - VQE for a One-Qubit Hamiltonian (exact toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A variational quantum eigensolver prepares a parameterized trial state and
 * minimizes its energy expectation to approximate the ground state of a
 * Hamiltonian. This toy model uses a single qubit with Hamiltonian
 * H = a*I + b*X + c*Z and the ansatz R_y(theta)|0>. The expectation value
 * a + c*cos(theta) + b*sin(theta) is evaluated exactly and minimized by a
 * grid search over theta.
 *
 * This is an exact small-scale simulation of the variational loop, not a
 * physical quantum computer or a fault-tolerant implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) expectation evaluations
 *   Space: O(samples) for the plotted energy curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the energy expectation at each sampled angle.
 *   - The current best angle is yellow; the final optimum is green.
 *   - The metadata reports the best energy, best angle, and exact ground energy.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Expectation value of a*I + b*X + c*Z in the state R_y(theta)|0>. */
function expectation(theta: number, a: number, b: number, c: number): number {
    return a + c * Math.cos(theta) + b * Math.sin(theta);
}

/** Exact lowest eigenvalue of the two by two Hamiltonian. */
function groundEnergy(a: number, b: number, c: number): number {
    return a - Math.sqrt(b * b + c * c);
}

function makeBars(
    samples: number[],
    bestIndex: number,
    final: boolean,
): VisualEntity[] {
    return samples.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: index === bestIndex ? (final ? "sorted" : "comparing") : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The VQE generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; c?: number; samples?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 0.5;
    const b = typeof task.b === "number" ? task.b : 0.8;
    const c = typeof task.c === "number" ? task.c : 0.6;
    const samples = Math.min(120, Math.max(4, typeof task.samples === "number" ? Math.floor(task.samples) : 24));
    const exact = groundEnergy(a, b, c);

    const energies: number[] = Array.from({ length: samples }, (_, index) =>
        expectation((2 * Math.PI * index) / samples, a, b, c),
    );
    let bestIndex = 0;
    let bestEnergy = energies[0]!;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(energies, 0, false),
        edges: [],
        description: `Preparing a one-qubit VQE with Hamiltonian a*I + b*X + c*Z and ${samples} trial angles.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { samples, bestEnergy: energies[0]!, bestTheta: 0, exact, a, b, c },
    };
    step += 1;

    for (let index = 0; index < samples; index += 1) {
        if ((energies[index] ?? 0) < bestEnergy) {
            bestEnergy = energies[index]!;
            bestIndex = index;
        }
        const theta = (2 * Math.PI * index) / samples;
        yield {
            stepNumber: step,
            entities: makeBars(energies, bestIndex, false),
            edges: [],
            description: `Angle ${index + 1}: theta = ${theta.toFixed(4)}, energy = ${energies[index]!.toFixed(6)}; best so far ${bestEnergy.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { samples, bestEnergy, bestTheta: (2 * Math.PI * bestIndex) / samples, exact, a, b, c },
        };
        step += 1;
    }

    const bestTheta = (2 * Math.PI * bestIndex) / samples;
    yield {
        stepNumber: step,
        entities: makeBars(energies, bestIndex, true),
        edges: [],
        description: `Best trial energy ${energies[bestIndex]!.toFixed(6)} at theta = ${bestTheta.toFixed(4)}; exact ground energy ${exact.toFixed(6)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { samples, bestEnergy: energies[bestIndex]!, bestTheta, exact, a, b, c },
    };
}

/** The variational quantum eigensolver module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than diagonalizing a Hamiltonian directly, VQE guesses a trial state controlled by a few parameters, measures its energy, and lets a classical optimizer adjust the parameters downhill. Repeated measurements trade hardware precision for short circuits, which is why the method suits noisy intermediate-scale devices.",
        invariants: [
            "The trial state R_y(theta)|0> is normalized for every angle.",
            "The energy expectation is a + c*cos(theta) + b*sin(theta).",
            "The ground energy is the lowest eigenvalue a minus the square root of b squared plus c squared.",
        ],
        correctness:
            "Expanding the two by two Hamiltonian a*I + b*X + c*Z gives eigenvalues a plus or minus the square root of b squared plus c squared. The trial state's energy equals a plus c*cos(theta) plus b*sin(theta), whose minimum over theta is exactly a minus that square root. A fine grid search reaches this minimum up to the grid spacing, so the variational optimum matches the true ground energy.",
        complexityRationale:
            "Each sample evaluates one closed-form expectation in constant time, so the grid search uses O(samples) time and stores O(samples) energies for the plot. A real VQE would instead spend O(shots) measurements per sample.",
        uses: [
            "Approximating molecular ground-state energies in quantum chemistry",
            "A benchmark workload for noisy intermediate-scale quantum devices",
            "A teaching model for hybrid quantum-classical optimization",
        ],
        references: [
            "Peruzzo et al., A Variational Eigenvalue Solver on a Photonic Quantum Processor, 2014",
            "Cerezo et al., Variational Quantum Algorithms, 2021",
        ],
        workedExample:
            "For a = 0, b = 0, c = 1 the Hamiltonian is just Z, with ground energy -1. The energy a + cos(theta) is minimized at theta = pi, where the trial state is |1> and the measured expectation equals -1, matching the exact eigenvalue.",
    },
    id: "variational-quantum-eigensolver",
    name: "Variational Quantum Eigensolver",
    category: "quantum",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { a: 0.5, b: 0.8, c: 0.6, samples: 24 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a Hamiltonian and a parameterized trial state",
        "sample trial angles across the parameter range",
        "prepare the trial state for each angle",
        "measure the energy expectation at that angle",
        "track the lowest energy seen so far",
        "set the best angle to the minimizing sample",
        "done: report the best energy and the exact ground energy",
    ],
};

export default module;
