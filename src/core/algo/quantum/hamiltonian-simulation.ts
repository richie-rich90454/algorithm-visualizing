/**
 * hamiltonian-simulation.ts - Hamiltonian Simulation (exact small simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hamiltonian simulation applies the time evolution operator exp(-i H t) to a
 * quantum state. For a single qubit with H equal to b_x times Pauli X plus b_z
 * times Pauli Z, the evolution has a closed form because H squared is
 * proportional to the identity. The simulator walks through evenly spaced
 * times and reports the resulting measurement probabilities at each step.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact two-dimensional state-vector calculation for a traceless
 * real one-qubit Hamiltonian. It is not a physical quantum processor: no gate
 * decomposition, Trotter error, decoherence, or sampling noise is included,
 * and observables beyond the computational basis are not measured.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(steps) for a fixed two-dimensional Hilbert space
 *   Space: O(1) for two complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the probability of measuring zero and one.
 *   - The bar at the current evolution time is highlighted.
 *   - The final frame reports the complex amplitudes and the norm.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function bars(p0: number, p1: number): VisualEntity[] {
    return [
        {
            id: "amp-0",
            type: "bar" as const,
            label: `|0>: ${p0.toFixed(3)}`,
            value: p0,
            state: "active" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 0, probability: p0, basis: "|0>" },
        },
        {
            id: "amp-1",
            type: "bar" as const,
            label: `|1>: ${p1.toFixed(3)}`,
            value: p1,
            state: "comparing" as const,
            x: 1,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 1, probability: p1, basis: "|1>" },
        },
    ];
}

function evolve(bx: number, bz: number, phi: number, time: number): number[] {
    const theta = Math.sqrt(bx * bx + bz * bz);
    const psi0 = Math.cos(phi);
    const psi1 = Math.sin(phi);
    if (theta < 1e-12) {
        return [psi0, 0, psi1, 0];
    }
    const cosine = Math.cos(theta * time);
    const sine = Math.sin(theta * time) / theta;
    const re0 = cosine * psi0;
    const im0 = -sine * (bz * psi0 + bx * psi1);
    const re1 = cosine * psi1;
    const im1 = -sine * (bx * psi0 - bz * psi1);
    return [re0, im0, re1, im1];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bx?: number; bz?: number; phi?: number; t?: number; steps?: number } | null) ?? {};
    const bx = typeof task.bx === "number" ? task.bx : 1;
    const bz = typeof task.bz === "number" ? task.bz : 0.5;
    const phi = typeof task.phi === "number" ? task.phi : 0.3;
    const totalTime = typeof task.t === "number" ? task.t : 2;
    const steps = Math.max(1, Math.min(12, typeof task.steps === "number" ? Math.floor(task.steps) : 8));

    let step = 0;
    for (let j = 0; j <= steps; j += 1) {
        const time = (totalTime * j) / steps;
        const amps = evolve(bx, bz, phi, time);
        const p0 = amps[0] * amps[0] + amps[1] * amps[1];
        const p1 = amps[2] * amps[2] + amps[3] * amps[3];
        const norm = p0 + p1;
        yield {
            stepNumber: step,
            entities: bars(p0, p1),
            edges: [],
            description: j === 0
                ? `Start in state cos(phi)|0> + sin(phi)|1> under Hamiltonian ${bx} X + ${bz} Z.`
                : `Evolve to time ${time.toFixed(3)}: the measured probabilities are ${p0.toFixed(4)} and ${p1.toFixed(4)}.`,
            codeLineNumber: j === 0 ? 0 : j === steps ? 5 : 3,
            layout: "array",
            meta: { bx, bz, phi, time, p0, p1, norm, amps: [...amps], final: j === steps },
        };
        step += 1;
    }

    const finalAmps = evolve(bx, bz, phi, totalTime);
    const fp0 = finalAmps[0] * finalAmps[0] + finalAmps[1] * finalAmps[1];
    const fp1 = finalAmps[2] * finalAmps[2] + finalAmps[3] * finalAmps[3];
    yield {
        stepNumber: step,
        entities: bars(fp0, fp1),
        edges: [],
        description: `At time ${totalTime.toFixed(3)} the state has amplitudes (${finalAmps[0].toFixed(4)}, ${finalAmps[1].toFixed(4)}) and (${finalAmps[2].toFixed(4)}, ${finalAmps[3].toFixed(4)}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { bx, bz, phi, time: totalTime, p0: fp0, p1: fp1, norm: fp0 + fp1, amps: [...finalAmps] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Hamiltonian is the rule that tells a quantum state how to rotate in time. Simulating it means applying a rotation whose angle grows with time and whose axis is set by the Hamiltonian. For a single qubit the rotation has a simple closed form, so the evolution can be computed exactly rather than approximated by many small gates.",
        invariants: [
            "The state remains normalized at every simulated time.",
            "For a traceless Hamiltonian the evolution is a rotation about the axis b_x X plus b_z Z.",
            "Setting b_x to zero leaves the basis probabilities unchanged because Z only adds phases.",
        ],
        correctness:
            "Writing H as b_x X plus b_z Z gives H squared equal to theta squared times the identity with theta the square root of b_x squared plus b_z squared. The power series for exp(-i H t) therefore separates into an even part proportional to cosine of theta t and an odd part proportional to sine of theta t times H over theta, which is the closed form used by the simulator. Applying it to the initial state yields the reported amplitudes, and the squared magnitudes sum to one because the evolution matrix is unitary.",
        complexityRationale:
            "Each of the steps evaluates a constant number of trigonometric and arithmetic operations on a two-amplitude state, so the simulation is O(steps) time and O(1) space. General n-qubit Hamiltonians would instead require exponential state storage.",
        uses: [
            "Simulating molecules and materials on quantum computers",
            "Studying quantum annealing and adiabatic evolution",
            "Benchmarking Trotter and other product-formula approximations",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information (2010), Chapter 4",
            "Lloyd, Universal Quantum Simulators (1996)",
        ],
        workedExample:
            "With b_x equal to 1, b_z equal to 0, and the state |0>, the Hamiltonian is Pauli X and theta is 1. At time pi over 2 the amplitudes are cos(pi/2) equals 0 and minus i sin(pi/2) equals minus i, so the state is minus i times |1> and the probability of measuring one is 1.",
    },
    id: "hamiltonian-simulation",
    name: "Hamiltonian Simulation",
    category: "quantum",
    complexity: { time: "O(steps)", space: "O(1)" },
    defaultInput: { bx: 1, bz: 0.5, phi: 0.3, t: 2, steps: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "read the Hamiltonian coefficients, initial angle, and final time",
        "compute theta as the square root of bx squared plus bz squared",
        "for each evenly spaced time step",
        "form cosine of theta times t and sine of theta times t",
        "apply the closed form evolution to the two amplitudes",
        "report the measurement probabilities at that time",
        "after the last step report the final complex amplitudes",
    ],
};

export default module;
